import type { AbilityRuntimeSnapshot, BattleParticipant, EffectRuntimeSnapshot, PendingAttack, RuntimeJsonValue, RuntimeValueScope, ScheduledEffectSnapshot, StatusSnapshot } from '@mercenary/shared';
import type { CharacterRegistry } from './character-registry.js';
import type { AbilityDefinition, ConditionDefinition, EffectDefinition, EffectOriginMetadata, EffectResult, JsonValue, StatusRemovalReason, TriggerContext, TriggerType, ValueExpression } from './effect-types.js';
import { CustomCommandBuilder, seededCustomRng } from './custom-ability.js';
import { childOrigin, supportMayTrigger } from './effect-origin.js';
import { evaluateNumber, evaluateValue } from './value-expression.js';
import { RuntimeValueStore, type SerializedRuntimeValues } from './runtime-values.js';
import { runtimeTrigger, type PublicTriggerEvent } from './trigger-emitters.js';

interface AbilityRuntime { runtimeKey: string; participantId: string; abilityId: string; supportSlot: number; cooldownEndsAt: number; triggersUsed: number; usedThisBattle: boolean; charges: number }
interface StatusRuntime { instanceId: string; statusId: string; sourceParticipantId: string; targetParticipantId: string; stackCount: number; expiresAt: number; origin?: EffectOriginMetadata }
interface ScheduledRuntime extends ScheduledEffectSnapshot { effects: EffectDefinition[]; context: TriggerContext }
interface DeferredRuntime { ability: AbilityRuntime; effects: EffectDefinition[]; conditions: ConditionDefinition[]; context: TriggerContext; effectKey: string }
export interface EffectEngineState {
  abilities: Array<[string, AbilityRuntime[]]>;
  statuses: StatusRuntime[];
  scheduled: ScheduledRuntime[];
  flags: Array<[string, Array<[string, number | boolean | string]>]>;
  customState: Array<[string, Array<[string, JsonValue]>]>;
  runtimeValues?: SerializedRuntimeValues;
  sequence: number;
  eventSequence: number;
  instanceSequence: number;
  chainTriggers: Array<[string, number]>;
}
export interface QueueAbilityAttack { sourceId: string; targetId: string; amount: number; travelMs: number; sourceAbilityId: string; tags: string[]; shieldBypassRatio: number; origin?: TriggerContext['origin'] }
export interface EffectEngineHost {
  participant(id: string): BattleParticipant | undefined;
  opponent(id: string): BattleParticipant;
  queueAbilityAttack(value: QueueAbilityAttack): PendingAttack;
  gainShield(participantId: string, amount: number, abilityId: string, context: TriggerContext): EffectResult;
  heal(participantId: string, amount: number, abilityId: string, context: TriggerContext): EffectResult;
  gainMana(participantId: string, amount: number): EffectResult;
  emitAbility(participantId: string, ability: AbilityDefinition, origin?: TriggerContext['origin']): void;
  emitStatus(participantId: string, statusId: string, active: boolean): void;
  emitMessage(participantId: string, message: string): void;
  incrementStat(participantId: string, field: string, abilityId?: string, amount?: number): void;
}

const compare = (left: number | boolean | string | undefined, operator: string | undefined, right: number | boolean | string | undefined) => operator === 'eq' ? left === right : operator === 'neq' ? left !== right : operator === 'gt' ? Number(left) > Number(right) : operator === 'gte' ? Number(left) >= Number(right) : operator === 'lt' ? Number(left) < Number(right) : operator === 'lte' ? Number(left) <= Number(right) : false;

export class BattleEffectEngine {
  private abilities = new Map<string, AbilityRuntime[]>();
  private statuses: StatusRuntime[] = [];
  private scheduled: ScheduledRuntime[] = [];
  private deferred = new Map<string, DeferredRuntime[]>();
  private scopeTotals = new Map<string, number>();
  private flags = new Map<string, Map<string, number | boolean | string>>();
  private messages = new Map<string, string[]>();
  private customState = new Map<string, Map<string, JsonValue>>();
  private runtimeValues: RuntimeValueStore;
  private preImpact = new Set<string>();
  private removingStatusInstances = new Set<string>();
  private sequence = 0;
  private eventSequence = 0;
  private instanceSequence = 0;
  private chainTriggers = new Map<string, number>();
  constructor(private battleId: string, participants: [BattleParticipant, BattleParticipant], private registry: CharacterRegistry, private host: EffectEngineHost) {
    this.runtimeValues = new RuntimeValueStore(participants.map((participant) => participant.id));
    for (const participant of participants) {
      const loadout = participant.battleLoadout!; const ids = [registry.get(loadout.combatant.characterId)!.combatant.skillId, ...loadout.supports.map((item) => registry.get(item.characterId)!.support.effectId)];
      this.abilities.set(participant.id, ids.map((abilityId, supportSlot) => ({ runtimeKey: `${participant.id}:${supportSlot}:${abilityId}`, participantId: participant.id, abilityId, supportSlot, cooldownEndsAt: 0, triggersUsed: 0, usedThisBattle: false, charges: 0 })));
      this.flags.set(participant.id, new Map()); this.messages.set(participant.id, []); this.customState.set(participant.id, new Map());
    }
  }
  private definition(runtime: AbilityRuntime) { return this.registry.content.ability(runtime.abilityId) }
  activeDefinition(participantId: string) { return this.definition(this.abilities.get(participantId)![0]!) }
  useActive(participantId: string, now: number) {
    const runtime = this.abilities.get(participantId)?.[0]; if (!runtime) return false; const ability = this.definition(runtime);
    if (ability.kind !== 'active' || !this.available(runtime, ability, now)) return false;
    return this.activate(runtime, ability, this.context(participantId, this.host.opponent(participantId).id, now, { skillId: ability.id, sourceType: 'active_skill', sourceTags: ['active_skill', ...ability.tags] }));
  }
  dispatch(type: TriggerType, sourceParticipantId: string, context: Partial<TriggerContext> = {}) {
    const now = context.serverTime ?? Date.now(); const opponentId = context.targetParticipantId ?? this.host.opponent(sourceParticipantId).id;
    const full = this.context(sourceParticipantId, opponentId, now, context);
    for (const runtime of this.abilities.get(sourceParticipantId)?.slice(1) ?? []) { const ability = this.definition(runtime); if (ability.trigger.type !== type || !this.available(runtime, ability, now, full.scopeKey) || !supportMayTrigger(full.origin, ability.id)) continue; if (!this.conditions(ability.conditions, full, runtime)) continue; this.activate(runtime, ability, full) }
    return full;
  }
  emitPublic(event: PublicTriggerEvent, sourceParticipantId: string, context: Partial<TriggerContext> = {}) {
    return this.dispatch(runtimeTrigger(event), sourceParticipantId, { ...context, origin: context.origin ?? this.eventOrigin(event, sourceParticipantId, context.skillId) });
  }
  emitOpponentPublic(event: PublicTriggerEvent, eventActorParticipantId: string, context: Partial<TriggerContext> = {}) {
    const observerId = this.host.opponent(eventActorParticipantId).id;
    return this.dispatch(runtimeTrigger(event), observerId, { ...context, targetParticipantId: eventActorParticipantId, origin: context.origin ?? this.eventOrigin(event, eventActorParticipantId, context.skillId) });
  }
  emitPublicForBoth(event: PublicTriggerEvent, eventActorParticipantId: string, context: Partial<TriggerContext> = {}) {
    const origin = context.origin ?? this.eventOrigin(event, eventActorParticipantId, context.skillId), observerId = this.host.opponent(eventActorParticipantId).id;
    const actor = this.dispatch(runtimeTrigger(event), eventActorParticipantId, { ...context, targetParticipantId: observerId, origin });
    const observer = this.dispatch(runtimeTrigger(event), observerId, { ...context, targetParticipantId: eventActorParticipantId, origin });
    return { actor, observer };
  }
  completeChain(chainId: string) { this.runtimeValues.clearChain(chainId); for (const key of this.chainTriggers.keys()) if (key.endsWith(`:${chainId}`)) this.chainTriggers.delete(key); for (const key of this.scopeTotals.keys()) if (key.includes(`:${chainId}:`)) this.scopeTotals.delete(key) }
  tick(now: number, pendingAttacks: PendingAttack[]) {
    this.expireStatuses(now);
    for (const attack of pendingAttacks) if (!this.preImpact.has(attack.id) && attack.arrivesAt - now <= 150) { this.preImpact.add(attack.id); const event = this.emitPublic('BEFORE_ATTACK_IMPACT', attack.targetId, { targetParticipantId: attack.sourceId, attackId: attack.id, currentAmount: attack.damage, sourceType: attack.kind === 'SKILL' ? 'active_skill' : 'enemy_attack', sourceTags: attack.sourceTags ?? [], serverTime: now, origin: attack.origin }); attack.damage = event.currentAmount ?? attack.damage }
    const due = this.scheduled.filter((item) => item.executeAt <= now).sort((a,b) => a.executeAt - b.executeAt || a.sequence - b.sequence); this.scheduled = this.scheduled.filter((item) => item.executeAt > now);
    for (const item of due) if (this.host.participant(item.sourceParticipantId)?.hp && this.host.participant(item.targetParticipantId)) { const runtime = this.abilities.get(item.sourceParticipantId)?.find((value) => value.abilityId === item.sourceAbilityId); if (runtime) this.execute(runtime, item.effects, { ...item.context, serverTime: now }) }
  }
  outgoing(attack: PendingAttack, now: number) {
    let multiplier = 1, bypass = attack.shieldBypassRatio ?? 0;
    for (const status of this.activeStatuses(attack.sourceId, now)) { const definition = this.registry.content.status(status.statusId); for (const modifier of definition.modifiers) { if (modifier.type === 'outgoing_damage_multiplier') multiplier *= modifier.value; if (modifier.type === 'shield_bypass_bonus') bypass += modifier.value } if (definition.consumePolicy?.type === 'on_next_outgoing_damage') this.removeStatus(status, 'CONSUMED', now) }
    attack.damage = Math.round(attack.damage * multiplier); attack.shieldBypassRatio = Math.min(.5, bypass); return attack;
  }
  incoming(attack: PendingAttack, now: number) {
    let multiplier = 1;
    for (const status of this.activeStatuses(attack.targetId, now)) { const definition = this.registry.content.status(status.statusId); for (const modifier of definition.modifiers) if (modifier.type === 'incoming_damage_multiplier') multiplier *= modifier.value; if (definition.consumePolicy?.type === 'on_next_incoming_attack') this.removeStatus(status, 'CONSUMED', now) }
    const reduced = attack.damage - Math.round(attack.damage * multiplier); if (reduced > 0) this.host.incrementStat(attack.targetId, 'damageReduced', undefined, reduced); attack.damage -= reduced; return attack;
  }
  healingMultiplier(participantId: string, now = Date.now()) { return this.activeStatuses(participantId, now).reduce((value, status) => this.registry.content.status(status.statusId).modifiers.filter((item) => item.type === 'healing_received_multiplier').reduce((next, item) => next * item.value, value), 1) }
  shieldMultiplier(participantId: string, now = Date.now()) { return this.activeStatuses(participantId, now).reduce((value, status) => this.registry.content.status(status.statusId).modifiers.filter((item) => item.type === 'shield_gain_multiplier').reduce((next, item) => next * item.value, value), 1) }
  attackResolved(attack: PendingAttack, result: EffectResult, now: number, before: { hp: number; shield: number }, after: { hp: number; shield: number }) {
    const target = this.host.participant(attack.targetId)!;
    const context = this.context(attack.sourceId, attack.targetId, now, { attackId: attack.id, sourceType: attack.kind === 'SKILL' ? 'active_skill' : 'enemy_attack', sourceTags: attack.sourceTags ?? [], shieldBefore: before.shield, shieldAfter: after.shield, hpBefore: before.hp, hpAfter: after.hp, shieldBroken: result.shieldBroken, effectResults: {}, origin: attack.origin });
    for (const deferred of this.deferred.get(attack.id) ?? []) { const next = { ...deferred.context, serverTime: now, effectResults: { ...deferred.context.effectResults, [deferred.effectKey]: result } }; if (this.conditions(deferred.conditions, next, deferred.ability)) this.execute(deferred.ability, deferred.effects, next) } this.deferred.delete(attack.id);
    if (result.shieldBroken) this.emitPublic('SHIELD_BROKEN', attack.targetId, { ...context, targetParticipantId: attack.sourceId });
    if (before.hp / target.maxHp > .25 && after.hp / target.maxHp <= .25) this.emitPublic('HP_THRESHOLD_CROSSED', attack.targetId, { ...context, targetParticipantId: attack.sourceId, hpThresholdCrossed: 25 });
    this.emitPublic('AFTER_DAMAGE', attack.sourceId, { ...context, finalAmount: result.finalAmount });
  }
  snapshot(participantId: string, viewerId = participantId): EffectRuntimeSnapshot {
    const runtimes = this.abilities.get(participantId)!; const summaries = runtimes.map((runtime) => this.registry.content.summary(runtime.abilityId)); const statusSnapshots: StatusSnapshot[] = this.statuses.filter((item) => item.targetParticipantId === participantId).map((item) => { const definition = this.registry.content.status(item.statusId); return { id: item.statusId, name: definition.name, sourceParticipantId: item.sourceParticipantId, targetParticipantId: item.targetParticipantId, stackCount: item.stackCount, expiresAt: item.expiresAt, visible: viewerId === participantId ? definition.visibleToOwner : definition.visibleToOpponent } }).filter((item) => item.visible);
    const abilities: AbilityRuntimeSnapshot[] = runtimes.map((item) => ({ runtimeKey: item.runtimeKey, abilityId: item.abilityId, cooldownEndsAt: item.cooldownEndsAt, triggersUsed: item.triggersUsed, usedThisBattle: item.usedThisBattle, remainingCharges: item.charges }));
    return { activeAbility: summaries[0]!, supportAbilities: [summaries[1]!, summaries[2]!], statuses: statusSnapshots, abilities, scheduledEffects: this.scheduled.filter((item) => item.sourceParticipantId === participantId).map(({ effects: _effects, context: runtimeContext, ...item }) => ({ ...item, origin: runtimeContext.origin })), runtimeFlags: Object.fromEntries(this.flags.get(participantId)!), runtimeValues: this.runtimeValues.snapshot(participantId), customState: Object.fromEntries(this.customState.get(participantId)!) as Record<string, RuntimeJsonValue>, messages: [...this.messages.get(participantId)!] };
  }
  serializeState(): EffectEngineState { return structuredClone({ abilities: [...this.abilities], statuses: this.statuses, scheduled: this.scheduled, flags: [...this.flags].map(([id, values]) => [id, [...values]]), runtimeValues: this.runtimeValues.serialize(), customState: [...this.customState].map(([id, values]) => [id, [...values]]), sequence: this.sequence, eventSequence: this.eventSequence, instanceSequence: this.instanceSequence, chainTriggers: [...this.chainTriggers] }) }
  restoreState(value: EffectEngineState) { const requireAbility = (id: string) => { try { this.registry.content.ability(id) } catch { throw new Error(`EFFECT_STATE_CONTENT_MISSING:${id}`) } }; for (const [, runtimes] of value.abilities) for (const runtime of runtimes) requireAbility(runtime.abilityId); for (const status of value.statuses) { try { this.registry.content.status(status.statusId) } catch { throw new Error(`EFFECT_STATE_CONTENT_MISSING:${status.statusId}`) } } for (const scheduled of value.scheduled) requireAbility(scheduled.sourceAbilityId); for (const [, entries] of value.customState) for (const [key, item] of entries) { if (!this.registry.get(key.split('.')[0]!)) throw new Error(`EFFECT_STATE_CONTENT_MISSING:${key}`); const serialized = JSON.stringify(item); if (serialized === undefined) throw new Error('EFFECT_STATE_CUSTOM_NOT_JSON'); JSON.parse(serialized) } this.abilities = new Map(structuredClone(value.abilities)); this.statuses = structuredClone(value.statuses); this.scheduled = structuredClone(value.scheduled); this.flags = new Map(value.flags.map(([id, entries]) => [id, new Map(entries)])); this.runtimeValues.restore(value.runtimeValues); this.customState = new Map(value.customState.map(([id, entries]) => [id, new Map(structuredClone(entries))])); this.sequence = value.sequence; this.eventSequence = value.eventSequence; this.instanceSequence = value.instanceSequence; this.chainTriggers = new Map(value.chainTriggers) }
  clear() { this.scheduled = []; this.deferred.clear(); this.statuses = []; this.preImpact.clear(); this.scopeTotals.clear(); this.chainTriggers.clear(); this.runtimeValues.clearAll() }
  finish() { this.scheduled = []; this.deferred.clear(); this.preImpact.clear(); this.scopeTotals.clear(); this.chainTriggers.clear(); this.runtimeValues.clearAll() }
  private available(runtime: AbilityRuntime, ability: AbilityDefinition, now: number, scopeKey?: string) { const chainKey = `${runtime.runtimeKey}:${scopeKey ?? ''}`; return now >= runtime.cooldownEndsAt && (!ability.oncePerBattle || !runtime.usedThisBattle) && (ability.maxTriggersPerBattle === null || runtime.triggersUsed < ability.maxTriggersPerBattle) && (!ability.chainLimit || !scopeKey || (this.chainTriggers.get(chainKey) ?? 0) < ability.chainLimit.maxTriggers) }
  private activate(runtime: AbilityRuntime, ability: AbilityDefinition, context: TriggerContext) { runtime.cooldownEndsAt = context.serverTime + ability.cooldownMs; runtime.triggersUsed++; runtime.usedThisBattle = true; if (ability.chainLimit && context.scopeKey) { const chainKey = `${runtime.runtimeKey}:${context.scopeKey}`; this.chainTriggers.set(chainKey, (this.chainTriggers.get(chainKey) ?? 0) + 1) } const eventId = this.nextEventId(), loadout = this.host.participant(runtime.participantId)?.battleLoadout; const characterId = runtime.supportSlot === 0 ? loadout?.combatant.characterId ?? '' : loadout?.supports[runtime.supportSlot - 1]?.characterId ?? ''; const source = { sourceCharacterId: characterId, sourceAbilityId: ability.id }; context.origin = context.origin ? childOrigin(context.origin, eventId, ability.kind === 'active' ? 'ACTIVE_ABILITY' : 'SUPPORT_ABILITY', source) : { eventId, rootEventId: eventId, ...source, originType: ability.kind === 'active' ? 'ACTIVE_ABILITY' : 'SUPPORT_ABILITY', generationDepth: 0, canTriggerSupport: true, canBeCopied: true, canBeConverted: true }; this.host.emitAbility(runtime.participantId, ability, context.origin); this.host.incrementStat(runtime.participantId, ability.kind === 'active' ? 'activeSkillUsesById' : 'supportEffectTriggersById', ability.id, 1); this.execute(runtime, ability.effects, context); return context.origin }
  private context(source: string, target: string, now: number, extra: Partial<TriggerContext> = {}): TriggerContext { return { battleId: this.battleId, sourceParticipantId: source, targetParticipantId: target, effectResults: {}, serverTime: now, ...extra } }
  private execute(runtime: AbilityRuntime, effects: EffectDefinition[], context: TriggerContext) {
    let latestAttack: PendingAttack | undefined;
    for (const effect of effects) {
      if (effect.type !== 'conditional' && effect.conditions && !this.conditions(effect.conditions, context, runtime)) continue;
      const targetId = effect.target === 'opponent' ? this.host.opponent(runtime.participantId).id : runtime.participantId; let result: EffectResult = {};
      const expressionContext = { self: this.host.participant(runtime.participantId)!, enemy: this.host.opponent(runtime.participantId), event: context, runtimeValue: (expression: Extract<ValueExpression, { type: 'RUNTIME_VALUE' }>) => this.runtimeValue(expression, runtime, context) };
      if (effect.type === 'deal_damage') { const requested = evaluateNumber(effect.amount, expressionContext, context.currentAmount ?? 0); const bypass = evaluateNumber(effect.shieldBypassRatio, expressionContext, Number(this.flags.get(runtime.participantId)!.get('shieldBypassRatio') ?? 0)); latestAttack = this.host.queueAbilityAttack({ sourceId: runtime.participantId, targetId, amount: requested, travelMs: effect.travelMs ?? 0, sourceAbilityId: runtime.abilityId, tags: effect.tags ?? [], shieldBypassRatio: bypass, origin: context.origin }); result = { requestedAmount: requested }; }
      else if (effect.type === 'gain_shield') { let amount = evaluateNumber(effect.amount, expressionContext); if (effect.scope === 'chain_step' && effect.cap !== undefined) { const key = `${runtime.runtimeKey}:${context.scopeKey ?? context.serverTime}:${effect.scope}`; const used = this.scopeTotals.get(key) ?? 0; amount = Math.max(0, Math.min(amount, effect.cap - used)); this.scopeTotals.set(key, used + amount) } result = this.host.gainShield(targetId, amount, runtime.abilityId, context) }
      else if (effect.type === 'heal') result = this.host.heal(targetId, evaluateNumber(effect.amount, expressionContext), runtime.abilityId, context);
      else if (effect.type === 'gain_mana') result = this.host.gainMana(targetId, evaluateNumber(effect.amount, expressionContext));
      else if (effect.type === 'apply_status') result = this.applyStatus(effect.statusId!, runtime.participantId, targetId, effect.durationMs, context);
      else if (effect.type === 'remove_status') result = this.removeStatuses(effect, targetId, context);
      else if (effect.type === 'refresh_status') result = this.applyStatus(effect.statusId!, runtime.participantId, targetId, effect.durationMs, context);
      else if (effect.type === 'schedule_effects') this.schedule(runtime, targetId, effect.effects ?? [], effect.delayMs ?? 0, context);
      else if (effect.type === 'conditional') { if (this.hasUnresolvedResult(effect.conditions ?? [], context) && latestAttack) { const referenced = this.effectReference(effect.conditions ?? [])!; const list = this.deferred.get(latestAttack.id) ?? []; list.push({ ability: runtime, effects: effect.effects ?? [], conditions: effect.conditions ?? [], context: { ...context, effectResults: { ...context.effectResults } }, effectKey: referenced }); this.deferred.set(latestAttack.id, list) } else this.execute(runtime, this.conditions(effect.conditions ?? [], context, runtime) ? effect.effects ?? [] : effect.elseEffects ?? [], context) }
      else if (effect.type === 'convert_overheal_to_shield') { const previous = context.effectResults[this.effectReference(effect.conditions ?? []) ?? '']; const maximum = typeof effect.maximum === 'number' ? effect.maximum : Infinity; const amount = Math.min(maximum, Math.round((previous?.overhealing ?? 0) * evaluateNumber(effect.ratio, expressionContext))); result = this.host.gainShield(targetId, amount, runtime.abilityId, context) }
      else if (effect.type === 'grant_charge') { runtime.charges += effect.initialCharges ?? 1; result = { finalAmount: runtime.charges } }
      else if (effect.type === 'consume_charge') { if (runtime.charges > 0) { runtime.charges--; result = { chargeConsumed: true } } }
      else if (effect.type === 'modify_event_amount') { const before = context.currentAmount ?? context.baseAmount ?? 0, operand = evaluateNumber(effect.value as number | ValueExpression | undefined, expressionContext, effect.operation === 'MULTIPLY' ? 1 : 0); context.currentAmount = Math.round(effect.operation === 'SET' ? operand : effect.operation === 'ADD' ? before + operand : before * operand); result = { requestedAmount: before, finalAmount: context.currentAmount } }
      else if (effect.type === 'set_shield_bypass_ratio') { this.flags.get(runtime.participantId)!.set('shieldBypassRatio', Math.min(.5, Math.max(0, evaluateNumber(effect.ratio, expressionContext)))); result = { finalAmount: Number(this.flags.get(runtime.participantId)!.get('shieldBypassRatio')) } }
      else if (effect.type === 'cap_value') { const before = context.currentAmount ?? 0, maximum = evaluateNumber(effect.maximum, expressionContext, before); context.currentAmount = Math.min(maximum, Math.max(evaluateNumber(effect.amount, expressionContext, -Infinity), before)); result = { requestedAmount: before, finalAmount: context.currentAmount } }
      else if (effect.type === 'consume_resource') result = this.consumeResource(targetId, effect.resource!, evaluateNumber(effect.amount, expressionContext), effect.allowPartial ?? false, effect.canReduceHpBelowOne ?? false);
      else if (effect.type === 'store_value') result = this.storeRuntimeValue(effect, runtime, context, expressionContext);
      else if (effect.type === 'custom') this.executeCustom(runtime, effect, context);
      else if (effect.type === 'set_runtime_flag') { const flags = this.flags.get(runtime.participantId)!, previousValue = flags.get(effect.flag!), currentValue = effect.value as number | boolean | string; flags.set(effect.flag!, currentValue); result = { key: effect.flag, previousValue, currentValue, existed: previousValue !== undefined, changed: previousValue !== currentValue } }
      else if (effect.type === 'consume_runtime_flag') { const flags = this.flags.get(runtime.participantId)!, previousValue = flags.get(effect.flag!), existed = flags.delete(effect.flag!); result = { key: effect.flag, previousValue, existed, changed: existed } }
      else if (effect.type === 'emit_battle_message') { const message = effect.message ?? ''; this.messages.get(targetId)!.push(message); this.messages.set(targetId, this.messages.get(targetId)!.slice(-5)); this.host.emitMessage(targetId, message) }
      else if (effect.type === 'cancel_current_effect') return;
      if (effect.key && effect.type !== 'deal_damage') context.effectResults[effect.key] = result;
    }
  }
  private schedule(runtime: AbilityRuntime, targetId: string, effects: EffectDefinition[], delayMs: number, context: TriggerContext) { const eventId = this.nextEventId(); const origin = context.origin ? childOrigin(context.origin, eventId, 'SCHEDULED') : undefined; this.scheduled.push({ id: `scheduled-${this.battleId}-${++this.sequence}`, executeAt: context.serverTime + delayMs, sourceParticipantId: runtime.participantId, targetParticipantId: targetId, effects, sourceAbilityId: runtime.abilityId, sourceAttackId: context.attackId, sequence: this.sequence, context: { ...context, origin, effectResults: { ...context.effectResults } } }) }
  private applyStatus(statusId: string, sourceId: string, targetId: string, duration: number | undefined, context: TriggerContext): EffectResult {
    const definition = this.registry.content.status(statusId), existing = this.statuses.find((item) => item.statusId === statusId && item.targetParticipantId === targetId), durationMs = duration ?? definition.durationMs, expiresAt = context.serverTime + durationMs;
    if (existing) {
      const previousStacks = existing.stackCount;
      if (definition.refreshPolicy === 'ignore') return { statusApplied: false, statusRefreshed: false, statusId, previousStacks, currentStacks: previousStacks };
      if (definition.refreshPolicy === 'extend') existing.expiresAt += durationMs; else existing.expiresAt = expiresAt;
      if (definition.refreshPolicy === 'stack') existing.stackCount = Math.min(definition.maxStacks, existing.stackCount + 1);
      existing.origin = context.origin;
      const result = { statusApplied: false, statusRefreshed: true, statusId, previousStacks, currentStacks: existing.stackCount };
      this.emitPublic('STATUS_APPLIED', targetId, { targetParticipantId: sourceId, statusId, statusApplied: false, statusRefreshed: true, statusPreviousStacks: previousStacks, statusCurrentStacks: existing.stackCount, statusDurationMs: durationMs, serverTime: context.serverTime, origin: context.origin });
      return result;
    }
    const status = { instanceId: `status-${this.battleId}-${++this.instanceSequence}`, statusId, sourceParticipantId: sourceId, targetParticipantId: targetId, stackCount: 1, expiresAt, origin: context.origin };
    this.statuses.push(status); this.host.emitStatus(targetId, statusId, true);
    this.emitPublic('STATUS_APPLIED', targetId, { targetParticipantId: sourceId, statusId, statusApplied: true, statusRefreshed: false, statusPreviousStacks: 0, statusCurrentStacks: 1, statusDurationMs: durationMs, serverTime: context.serverTime, origin: context.origin });
    return { statusApplied: true, statusRefreshed: false, statusId, previousStacks: 0, currentStacks: 1 };
  }
  private activeStatuses(participantId: string, now: number) { this.expireStatuses(now); return this.statuses.filter((item) => item.targetParticipantId === participantId) }
  private expireStatuses(now: number) { for (const status of [...this.statuses]) if (status.expiresAt <= now) this.removeStatus(status, 'EXPIRED', now) }
  private removeStatuses(effect: EffectDefinition, targetId: string, context: TriggerContext): EffectResult {
    const selection = effect.selection ?? 'OLDEST_FIRST', limit = effect.maxCount ?? Number.MAX_SAFE_INTEGER;
    const candidates = this.statuses.filter((status) => status.targetParticipantId === targetId && (effect.statusId ? status.statusId === effect.statusId : effect.filter?.tag ? this.registry.content.status(status.statusId).tags.includes(effect.filter.tag) : false));
    if (selection === 'NEWEST_FIRST') candidates.reverse();
    const removed = candidates.slice(0, limit);
    for (const status of removed) this.removeStatus(status, effect.filter ? 'DISPEL' : 'EXPLICIT', context.serverTime, context);
    return { removedCount: removed.length, removedStatusIds: removed.map((status) => status.statusId), removalReason: effect.filter ? 'DISPEL' : 'EXPLICIT' };
  }
  private removeStatus(status: StatusRuntime, reason: StatusRemovalReason, now: number, context?: TriggerContext) {
    const index = this.statuses.indexOf(status); if (index < 0 || this.removingStatusInstances.has(status.instanceId)) return false;
    this.removingStatusInstances.add(status.instanceId);
    try {
      this.emitPublicForBoth('STATUS_REMOVED', status.targetParticipantId, { statusId: status.statusId, statusPreviousStacks: status.stackCount, statusRemovalReason: reason, statusWasExpired: reason === 'EXPIRED', serverTime: now, origin: context?.origin ?? status.origin });
      const currentIndex = this.statuses.indexOf(status); if (currentIndex >= 0) this.statuses.splice(currentIndex, 1);
      this.host.emitStatus(status.targetParticipantId, status.statusId, false);
      this.runtimeValues.clearStatus(status.targetParticipantId, status.statusId);
      return true;
    } finally { this.removingStatusInstances.delete(status.instanceId) }
  }
  private conditions(values: ConditionDefinition[], context: TriggerContext, runtime: AbilityRuntime) { return values.every((item) => this.condition(item, context, runtime)) }
  private condition(item: ConditionDefinition, context: TriggerContext, runtime: AbilityRuntime): boolean { const self = this.host.participant(runtime.participantId)!, opponent = this.host.opponent(runtime.participantId); switch (item.type) { case 'any': return (item.conditions ?? []).some((value) => this.condition(value, context, runtime)); case 'all': return (item.conditions ?? []).every((value) => this.condition(value, context, runtime)); case 'not': return !this.condition(item.condition!, context, runtime); case 'tile_type_is': return context.tileType === item.tileType; case 'matched_tile_count': return compare(context.matchedTileCount, item.operator, item.value); case 'source_type_is': return item.value === 'enemy_attack' ? ['enemy_attack','active_skill'].includes(context.sourceType ?? '') : context.sourceType === item.value; case 'source_has_tag': return context.sourceTags?.includes(item.tag!) ?? false; case 'target_has_status': return this.statuses.some((value) => value.targetParticipantId === context.targetParticipantId && value.statusId === item.statusId); case 'target_lacks_status': return !this.statuses.some((value) => value.targetParticipantId === context.targetParticipantId && value.statusId === item.statusId); case 'self_hp_ratio': return compare(self.hp / self.maxHp, item.operator, item.value); case 'self_shield_amount': return compare(self.shield, item.operator, item.value); case 'opponent_hp_ratio': return compare(opponent.hp / opponent.maxHp, item.operator, item.value); case 'opponent_shield_amount': return compare(opponent.shield, item.operator, item.value); case 'incoming_damage': return compare(context.currentAmount, item.operator, item.value); case 'shield_was_broken': return compare(context.shieldBroken, item.operator, item.value); case 'hp_threshold_crossed': return context.hpThresholdCrossed === item.value && (!item.direction || item.direction === 'downward'); case 'cooldown_ready': return context.serverTime >= runtime.cooldownEndsAt; case 'charge_available': return compare(runtime.charges, item.operator ?? 'gt', item.value ?? 0); case 'once_per_battle_available': return !runtime.usedThisBattle; case 'effect_result_compare': return compare(context.effectResults[item.effectKey!]?.[item.field! as keyof EffectResult] as number | boolean | undefined, item.operator, item.value); case 'expression_compare': return compare(evaluateValue(item.left!, { self, enemy: opponent, event: context }), item.operator, evaluateValue(item.right!, { self, enemy: opponent, event: context })); case 'event_type_is': return context.sourceType === item.value; case 'compare_number': case 'compare_ratio': return compare(context[item.field! as keyof TriggerContext] as number | undefined, item.operator, item.value); default: throw new Error(`CONDITION_RUNTIME_UNSUPPORTED:${item.type}`) } }
  private nextEventId() { return `${this.battleId}:effect:${++this.eventSequence}` }
  private eventOrigin(event: PublicTriggerEvent, eventActorParticipantId: string, skillId?: string): EffectOriginMetadata { const eventId = this.nextEventId(), characterId = this.host.participant(eventActorParticipantId)?.battleLoadout?.combatant.characterId ?? ''; return { eventId, rootEventId: eventId, sourceCharacterId: characterId, sourceAbilityId: skillId ?? `system.${event.toLowerCase()}`, originType: event === 'TILE_MATCH_RESOLVED' || event === 'CHAIN_STEP_RESOLVED' ? 'TILE_MATCH' : event.startsWith('STATUS_') ? 'STATUS' : 'SUPPORT_ABILITY', generationDepth: 0, canTriggerSupport: true, canBeCopied: true, canBeConverted: true } }
  private consumeResource(participantId: string, resource: 'HP' | 'SHIELD' | 'MANA', requested: number, allowPartial: boolean, canReduceHpBelowOne: boolean): EffectResult { if (!Number.isFinite(requested) || requested < 0) throw new Error('CONSUME_RESOURCE_AMOUNT_INVALID'); const participant = this.host.participant(participantId)!; const available = Math.max(0, resource === 'HP' ? participant.hp - (canReduceHpBelowOne ? 0 : 1) : resource === 'SHIELD' ? participant.shield : participant.gauge); if (!allowPartial && available < requested) throw new Error(`CONSUME_RESOURCE_INSUFFICIENT:${resource}`); const consumed = Math.max(0, Math.min(available, requested)); if (resource === 'HP') participant.hp -= consumed; else if (resource === 'SHIELD') participant.shield -= consumed; else participant.gauge -= consumed; return { requestedAmount: requested, consumedAmount: consumed, finalAmount: consumed, remainingAmount: available - consumed, wasPartial: consumed < requested, resource } }
  private runtimeAddress(scope: RuntimeValueScope, key: string, runtime: AbilityRuntime, context: TriggerContext, target: 'SELF' | 'ENEMY', statusId?: string) { return { participantId: target === 'ENEMY' ? this.host.opponent(runtime.participantId).id : runtime.participantId, scope, key, abilityId: scope === 'ABILITY' ? runtime.abilityId : undefined, statusId: scope === 'STATUS' ? statusId : undefined, chainId: scope === 'CHAIN' ? context.scopeKey : undefined } }
  private runtimeValue(expression: Extract<ValueExpression, { type: 'RUNTIME_VALUE' }>, runtime: AbilityRuntime, context: TriggerContext) {
    const address = this.runtimeAddress(expression.scope, expression.key, runtime, context, expression.target, expression.statusId);
    if (expression.scope === 'STATUS' && !this.statuses.some((status) => status.targetParticipantId === address.participantId && status.statusId === expression.statusId)) throw new Error(`RUNTIME_VALUE_STATUS_INACTIVE:${expression.statusId}`);
    const stored = this.runtimeValues.read(address); if (stored !== undefined) return stored;
    return evaluateNumber(expression.defaultValue, { self: this.host.participant(runtime.participantId)!, enemy: this.host.opponent(runtime.participantId), event: context });
  }
  private storeRuntimeValue(effect: EffectDefinition, runtime: AbilityRuntime, context: TriggerContext, expressionContext: Parameters<typeof evaluateNumber>[1]): EffectResult {
    const scope = effect.scope as RuntimeValueScope, operation = effect.operation as Exclude<EffectDefinition['operation'], 'MULTIPLY'>;
    const address = this.runtimeAddress(scope, effect.runtimeKey!, runtime, context, effect.target === 'opponent' ? 'ENEMY' : 'SELF', effect.statusId);
    if (scope === 'STATUS' && !this.statuses.some((status) => status.targetParticipantId === address.participantId && status.statusId === effect.statusId)) throw new Error(`RUNTIME_VALUE_STATUS_INACTIVE:${effect.statusId}`);
    const result = this.runtimeValues.mutate(address, { operation: operation!, value: operation === 'CLEAR' || operation === 'CLAMP' ? undefined : evaluateNumber(effect.value as number | ValueExpression, expressionContext), minimum: effect.minimum === undefined ? undefined : evaluateNumber(effect.minimum, expressionContext), maximum: effect.maximum === undefined ? undefined : evaluateNumber(effect.maximum, expressionContext) });
    return { scope: result.scope, key: result.key, existed: result.existed, previousValue: result.previousValue, nextValue: result.nextValue, cleared: result.cleared, finalAmount: result.nextValue ?? undefined };
  }
  private executeCustom(runtime: AbilityRuntime, effect: EffectDefinition, context: TriggerContext) { const actor = this.host.participant(runtime.participantId)!, enemy = this.host.opponent(runtime.participantId), state = this.customState.get(runtime.participantId)!; const seed = [...`${this.battleId}:${runtime.abilityId}:${this.eventSequence}`].reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619), 2166136261); const result = this.registry.customHandlers.execute(effect.handlerId!, { actor: structuredClone(actor), enemy: structuredClone(enemy), triggeringEvent: structuredClone(context), results: structuredClone(context.effectResults), runtimeFlags: Object.freeze(Object.fromEntries(this.flags.get(runtime.participantId)!)), customState: Object.freeze(Object.fromEntries(state)), rng: seededCustomRng(seed), command: new CustomCommandBuilder() }, effect.parameters ?? null); for (const [key, value] of Object.entries(result.statePatch ?? {})) state.set(key, structuredClone(value)); const customOrigin = context.origin ? childOrigin(context.origin, this.nextEventId(), 'CUSTOM') : undefined; this.execute(runtime, result.commands, { ...context, origin: customOrigin }) }
  private hasUnresolvedResult(values: ConditionDefinition[], context: TriggerContext) { const key = this.effectReference(values); return Boolean(key && !context.effectResults[key]) }
  private effectReference(values: ConditionDefinition[]): string | undefined { for (const value of values) { if (value.type === 'effect_result_compare') return value.effectKey; const nested = value.conditions ? this.effectReference(value.conditions) : value.condition ? this.effectReference([value.condition]) : undefined; if (nested) return nested } return undefined }
}
