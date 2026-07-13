import type { AbilityRuntimeSnapshot, BattleParticipant, EffectRuntimeSnapshot, PendingAttack, ScheduledEffectSnapshot, StatusSnapshot } from '@mercenary/shared';
import { BATTLE_CONFIG } from '@mercenary/shared';
import type { CharacterRegistry } from './character-registry.js';
import type { AbilityDefinition, ConditionDefinition, EffectDefinition, EffectResult, TriggerContext, TriggerType } from './effect-types.js';

interface AbilityRuntime { runtimeKey: string; participantId: string; abilityId: string; supportSlot: number; cooldownEndsAt: number; triggersUsed: number; usedThisBattle: boolean; charges: number }
interface StatusRuntime { instanceId: string; statusId: string; sourceParticipantId: string; targetParticipantId: string; stackCount: number; expiresAt: number }
interface ScheduledRuntime extends ScheduledEffectSnapshot { effects: EffectDefinition[]; context: TriggerContext }
interface DeferredRuntime { ability: AbilityRuntime; effects: EffectDefinition[]; conditions: ConditionDefinition[]; context: TriggerContext; effectKey: string }
export interface QueueAbilityAttack { sourceId: string; targetId: string; amount: number; travelMs: number; sourceAbilityId: string; tags: string[]; shieldBypassRatio: number }
export interface EffectEngineHost {
  participant(id: string): BattleParticipant | undefined;
  opponent(id: string): BattleParticipant;
  queueAbilityAttack(value: QueueAbilityAttack): PendingAttack;
  gainShield(participantId: string, amount: number, abilityId: string): EffectResult;
  heal(participantId: string, amount: number, abilityId: string): EffectResult;
  gainMana(participantId: string, amount: number): EffectResult;
  emitAbility(participantId: string, ability: AbilityDefinition): void;
  emitStatus(participantId: string, statusId: string, active: boolean): void;
  emitMessage(participantId: string, message: string): void;
  incrementStat(participantId: string, field: string, abilityId?: string, amount?: number): void;
}

let runtimeSequence = 0;
const runtimeId = (prefix: string) => `${prefix}-${(++runtimeSequence).toString(36)}`;
const compare = (left: number | boolean | string | undefined, operator: string | undefined, right: number | boolean | string | undefined) => operator === 'eq' ? left === right : operator === 'neq' ? left !== right : operator === 'gt' ? Number(left) > Number(right) : operator === 'gte' ? Number(left) >= Number(right) : operator === 'lt' ? Number(left) < Number(right) : operator === 'lte' ? Number(left) <= Number(right) : false;

export class BattleEffectEngine {
  private abilities = new Map<string, AbilityRuntime[]>();
  private statuses: StatusRuntime[] = [];
  private scheduled: ScheduledRuntime[] = [];
  private deferred = new Map<string, DeferredRuntime[]>();
  private scopeTotals = new Map<string, number>();
  private flags = new Map<string, Map<string, number | boolean | string>>();
  private messages = new Map<string, string[]>();
  private preImpact = new Set<string>();
  private sequence = 0;
  constructor(private battleId: string, participants: [BattleParticipant, BattleParticipant], private registry: CharacterRegistry, private host: EffectEngineHost) {
    for (const participant of participants) {
      const loadout = participant.battleLoadout!; const ids = [registry.get(loadout.combatant.characterId)!.combatant.skillId, ...loadout.supports.map((item) => registry.get(item.characterId)!.support.effectId)];
      this.abilities.set(participant.id, ids.map((abilityId, supportSlot) => ({ runtimeKey: `${participant.id}:${supportSlot}:${abilityId}`, participantId: participant.id, abilityId, supportSlot, cooldownEndsAt: 0, triggersUsed: 0, usedThisBattle: false, charges: 0 })));
      this.flags.set(participant.id, new Map()); this.messages.set(participant.id, []);
    }
  }
  private definition(runtime: AbilityRuntime) { return this.registry.content.ability(runtime.abilityId) }
  activeDefinition(participantId: string) { return this.definition(this.abilities.get(participantId)![0]!) }
  useActive(participantId: string, now: number) {
    const runtime = this.abilities.get(participantId)?.[0]; if (!runtime) return false; const ability = this.definition(runtime);
    if (ability.kind !== 'active' || !this.available(runtime, ability, now)) return false;
    this.activate(runtime, ability, this.context(participantId, this.host.opponent(participantId).id, now, { skillId: ability.id, sourceType: 'active_skill', sourceTags: ['active_skill', ...ability.tags] })); return true;
  }
  dispatch(type: TriggerType, sourceParticipantId: string, context: Partial<TriggerContext> = {}) {
    const now = context.serverTime ?? Date.now(); const opponentId = context.targetParticipantId ?? this.host.opponent(sourceParticipantId).id;
    for (const runtime of this.abilities.get(sourceParticipantId)?.slice(1) ?? []) { const ability = this.definition(runtime); if (ability.trigger.type !== type || !this.available(runtime, ability, now)) continue; const full = this.context(sourceParticipantId, opponentId, now, context); if (!this.conditions(ability.conditions, full, runtime)) continue; this.activate(runtime, ability, full) }
  }
  tick(now: number, pendingAttacks: PendingAttack[]) {
    this.expireStatuses(now);
    for (const attack of pendingAttacks) if (!this.preImpact.has(attack.id) && attack.arrivesAt - now <= 150) { this.preImpact.add(attack.id); this.dispatch('before_attack_impact', attack.targetId, { targetParticipantId: attack.sourceId, attackId: attack.id, currentAmount: attack.damage, sourceType: attack.kind === 'SKILL' ? 'active_skill' : 'enemy_attack', sourceTags: attack.sourceTags ?? [], serverTime: now }) }
    const due = this.scheduled.filter((item) => item.executeAt <= now).sort((a,b) => a.executeAt - b.executeAt || a.sequence - b.sequence); this.scheduled = this.scheduled.filter((item) => item.executeAt > now);
    for (const item of due) if (this.host.participant(item.sourceParticipantId)?.hp && this.host.participant(item.targetParticipantId)) { const runtime = this.abilities.get(item.sourceParticipantId)?.find((value) => value.abilityId === item.sourceAbilityId); if (runtime) this.execute(runtime, item.effects, { ...item.context, serverTime: now }) }
  }
  outgoing(attack: PendingAttack, now: number) {
    let multiplier = 1, bypass = attack.shieldBypassRatio ?? 0;
    for (const status of this.activeStatuses(attack.sourceId, now)) { const definition = this.registry.content.status(status.statusId); for (const modifier of definition.modifiers) { if (modifier.type === 'outgoing_damage_multiplier') multiplier *= modifier.value; if (modifier.type === 'shield_bypass_bonus') bypass += modifier.value } if (definition.consumePolicy?.type === 'on_next_outgoing_damage') this.removeStatus(status) }
    attack.damage = Math.round(attack.damage * multiplier); attack.shieldBypassRatio = Math.min(.5, bypass); return attack;
  }
  incoming(attack: PendingAttack, now: number) {
    let multiplier = 1;
    for (const status of this.activeStatuses(attack.targetId, now)) { const definition = this.registry.content.status(status.statusId); for (const modifier of definition.modifiers) if (modifier.type === 'incoming_damage_multiplier') multiplier *= modifier.value; if (definition.consumePolicy?.type === 'on_next_incoming_attack') this.removeStatus(status) }
    const reduced = attack.damage - Math.round(attack.damage * multiplier); if (reduced > 0) this.host.incrementStat(attack.targetId, 'damageReduced', undefined, reduced); attack.damage -= reduced; return attack;
  }
  healingMultiplier(participantId: string, now = Date.now()) { return this.activeStatuses(participantId, now).reduce((value, status) => this.registry.content.status(status.statusId).modifiers.filter((item) => item.type === 'healing_received_multiplier').reduce((next, item) => next * item.value, value), 1) }
  shieldMultiplier(participantId: string, now = Date.now()) { return this.activeStatuses(participantId, now).reduce((value, status) => this.registry.content.status(status.statusId).modifiers.filter((item) => item.type === 'shield_gain_multiplier').reduce((next, item) => next * item.value, value), 1) }
  attackResolved(attack: PendingAttack, result: EffectResult, now: number, before: { hp: number; shield: number }, after: { hp: number; shield: number }) {
    const context = this.context(attack.sourceId, attack.targetId, now, { attackId: attack.id, sourceType: attack.kind === 'SKILL' ? 'active_skill' : 'enemy_attack', sourceTags: attack.sourceTags ?? [], shieldBefore: before.shield, shieldAfter: after.shield, hpBefore: before.hp, hpAfter: after.hp, shieldBroken: result.shieldBroken, effectResults: {} });
    for (const deferred of this.deferred.get(attack.id) ?? []) { const next = { ...deferred.context, serverTime: now, effectResults: { ...deferred.context.effectResults, [deferred.effectKey]: result } }; if (this.conditions(deferred.conditions, next, deferred.ability)) this.execute(deferred.ability, deferred.effects, next) } this.deferred.delete(attack.id);
    if (result.shieldBroken) this.dispatch('shield_broken', attack.targetId, { ...context, targetParticipantId: attack.sourceId });
    if (before.hp / BATTLE_CONFIG.maxHp > .25 && after.hp / BATTLE_CONFIG.maxHp <= .25) this.dispatch('hp_threshold_crossed', attack.targetId, { ...context, targetParticipantId: attack.sourceId, hpThresholdCrossed: 25 });
    this.dispatch('after_damage', attack.sourceId, context);
  }
  snapshot(participantId: string, viewerId = participantId): EffectRuntimeSnapshot {
    const runtimes = this.abilities.get(participantId)!; const summaries = runtimes.map((runtime) => this.registry.content.summary(runtime.abilityId)); const statusSnapshots: StatusSnapshot[] = this.statuses.filter((item) => item.targetParticipantId === participantId).map((item) => { const definition = this.registry.content.status(item.statusId); return { id: item.statusId, name: definition.name, sourceParticipantId: item.sourceParticipantId, targetParticipantId: item.targetParticipantId, stackCount: item.stackCount, expiresAt: item.expiresAt, visible: viewerId === participantId ? definition.visibleToOwner : definition.visibleToOpponent } }).filter((item) => item.visible);
    const abilities: AbilityRuntimeSnapshot[] = runtimes.map((item) => ({ runtimeKey: item.runtimeKey, abilityId: item.abilityId, cooldownEndsAt: item.cooldownEndsAt, triggersUsed: item.triggersUsed, usedThisBattle: item.usedThisBattle, remainingCharges: item.charges }));
    return { activeAbility: summaries[0]!, supportAbilities: [summaries[1]!, summaries[2]!], statuses: statusSnapshots, abilities, scheduledEffects: this.scheduled.filter((item) => item.sourceParticipantId === participantId).map(({ effects: _effects, context: _context, ...item }) => item), runtimeFlags: Object.fromEntries(this.flags.get(participantId)!), messages: [...this.messages.get(participantId)!] };
  }
  clear() { this.scheduled = []; this.deferred.clear(); this.statuses = []; this.preImpact.clear(); this.scopeTotals.clear() }
  finish() { this.scheduled = []; this.deferred.clear(); this.preImpact.clear(); this.scopeTotals.clear() }
  private available(runtime: AbilityRuntime, ability: AbilityDefinition, now: number) { return now >= runtime.cooldownEndsAt && (!ability.oncePerBattle || !runtime.usedThisBattle) && (ability.maxTriggersPerBattle === null || runtime.triggersUsed < ability.maxTriggersPerBattle) }
  private activate(runtime: AbilityRuntime, ability: AbilityDefinition, context: TriggerContext) { runtime.cooldownEndsAt = context.serverTime + ability.cooldownMs; runtime.triggersUsed++; runtime.usedThisBattle = true; this.host.emitAbility(runtime.participantId, ability); this.host.incrementStat(runtime.participantId, ability.kind === 'active' ? 'activeSkillUsesById' : 'supportEffectTriggersById', ability.id, 1); this.execute(runtime, ability.effects, context) }
  private context(source: string, target: string, now: number, extra: Partial<TriggerContext> = {}): TriggerContext { return { battleId: this.battleId, sourceParticipantId: source, targetParticipantId: target, effectResults: {}, serverTime: now, ...extra } }
  private execute(runtime: AbilityRuntime, effects: EffectDefinition[], context: TriggerContext) {
    let latestAttack: PendingAttack | undefined;
    for (const effect of effects) {
      if (effect.type !== 'conditional' && effect.conditions && !this.conditions(effect.conditions, context, runtime)) continue;
      const targetId = effect.target === 'opponent' ? this.host.opponent(runtime.participantId).id : runtime.participantId; let result: EffectResult = {};
      if (effect.type === 'deal_damage') { const requested = effect.amount ?? context.currentAmount ?? 0; latestAttack = this.host.queueAbilityAttack({ sourceId: runtime.participantId, targetId, amount: requested, travelMs: effect.travelMs ?? 0, sourceAbilityId: runtime.abilityId, tags: effect.tags ?? [], shieldBypassRatio: effect.shieldBypassRatio ?? Number(this.flags.get(runtime.participantId)!.get('shieldBypassRatio') ?? 0) }); result = { requestedAmount: requested }; }
      else if (effect.type === 'gain_shield') { let amount = effect.amount ?? 0; if (effect.scope && effect.cap !== undefined) { const key = `${runtime.runtimeKey}:${context.scopeKey ?? context.serverTime}:${effect.scope}`; const used = this.scopeTotals.get(key) ?? 0; amount = Math.max(0, Math.min(amount, effect.cap - used)); this.scopeTotals.set(key, used + amount) } result = this.host.gainShield(targetId, amount, runtime.abilityId) }
      else if (effect.type === 'heal') result = this.host.heal(targetId, effect.amount ?? 0, runtime.abilityId);
      else if (effect.type === 'gain_mana') result = this.host.gainMana(targetId, effect.amount ?? 0);
      else if (effect.type === 'apply_status') result = { statusApplied: this.applyStatus(effect.statusId!, runtime.participantId, targetId, effect.durationMs, context.serverTime) };
      else if (effect.type === 'remove_status') { for (const item of [...this.statuses]) if (item.targetParticipantId === targetId && item.statusId === effect.statusId) this.removeStatus(item) }
      else if (effect.type === 'refresh_status') this.applyStatus(effect.statusId!, runtime.participantId, targetId, effect.durationMs, context.serverTime);
      else if (effect.type === 'schedule_effects') this.schedule(runtime, targetId, effect.effects ?? [], effect.delayMs ?? 0, context);
      else if (effect.type === 'conditional') { if (this.hasUnresolvedResult(effect.conditions ?? [], context) && latestAttack) { const referenced = this.effectReference(effect.conditions ?? [])!; const list = this.deferred.get(latestAttack.id) ?? []; list.push({ ability: runtime, effects: effect.effects ?? [], conditions: effect.conditions ?? [], context: { ...context, effectResults: { ...context.effectResults } }, effectKey: referenced }); this.deferred.set(latestAttack.id, list) } else if (this.conditions(effect.conditions ?? [], context, runtime)) this.execute(runtime, effect.effects ?? [], context) }
      else if (effect.type === 'convert_overheal_to_shield') { const previous = context.effectResults[this.effectReference(effect.conditions ?? []) ?? '']; const amount = Math.min(effect.maximum ?? Infinity, Math.round((previous?.overhealing ?? 0) * (effect.ratio ?? 0))); result = this.host.gainShield(targetId, amount, runtime.abilityId) }
      else if (effect.type === 'grant_charge') { runtime.charges += effect.initialCharges ?? 1; result = { finalAmount: runtime.charges } }
      else if (effect.type === 'consume_charge') { if (runtime.charges > 0) { runtime.charges--; result = { chargeConsumed: true } } }
      else if (effect.type === 'modify_event_amount') { const before = context.currentAmount ?? context.baseAmount ?? 0; context.currentAmount = Math.round(before * (effect.ratio ?? 1) + (effect.amount ?? 0)); result = { requestedAmount: before, finalAmount: context.currentAmount } }
      else if (effect.type === 'set_shield_bypass_ratio') { this.flags.get(runtime.participantId)!.set('shieldBypassRatio', Math.min(.5, Math.max(0, effect.ratio ?? 0))); result = { finalAmount: Number(this.flags.get(runtime.participantId)!.get('shieldBypassRatio')) } }
      else if (effect.type === 'cap_value') { const before = context.currentAmount ?? 0; context.currentAmount = Math.min(effect.maximum ?? before, Math.max(effect.amount ?? -Infinity, before)); result = { requestedAmount: before, finalAmount: context.currentAmount } }
      else if (effect.type === 'set_runtime_flag') this.flags.get(runtime.participantId)!.set(effect.flag!, effect.value ?? true);
      else if (effect.type === 'consume_runtime_flag') this.flags.get(runtime.participantId)!.delete(effect.flag!);
      else if (effect.type === 'emit_battle_message') { const message = effect.message ?? ''; this.messages.get(targetId)!.push(message); this.messages.set(targetId, this.messages.get(targetId)!.slice(-5)); this.host.emitMessage(targetId, message) }
      else if (effect.type === 'cancel_current_effect') return;
      if (effect.key && effect.type !== 'deal_damage') context.effectResults[effect.key] = result;
    }
  }
  private schedule(runtime: AbilityRuntime, targetId: string, effects: EffectDefinition[], delayMs: number, context: TriggerContext) { this.scheduled.push({ id: runtimeId('scheduled'), executeAt: context.serverTime + delayMs, sourceParticipantId: runtime.participantId, targetParticipantId: targetId, effects, sourceAbilityId: runtime.abilityId, sourceAttackId: context.attackId, sequence: ++this.sequence, context: { ...context, effectResults: { ...context.effectResults } } }) }
  private applyStatus(statusId: string, sourceId: string, targetId: string, duration: number | undefined, now: number) { const definition = this.registry.content.status(statusId), existing = this.statuses.find((item) => item.statusId === statusId && item.targetParticipantId === targetId); const expiresAt = now + (duration ?? definition.durationMs); if (existing) { if (definition.refreshPolicy === 'ignore') return false; if (definition.refreshPolicy === 'extend') existing.expiresAt += duration ?? definition.durationMs; else existing.expiresAt = expiresAt; if (definition.refreshPolicy === 'stack') existing.stackCount = Math.min(definition.maxStacks, existing.stackCount + 1); return true } this.statuses.push({ instanceId: runtimeId('status'), statusId, sourceParticipantId: sourceId, targetParticipantId: targetId, stackCount: 1, expiresAt }); this.host.emitStatus(targetId, statusId, true); return true }
  private activeStatuses(participantId: string, now: number) { this.expireStatuses(now); return this.statuses.filter((item) => item.targetParticipantId === participantId) }
  private expireStatuses(now: number) { for (const status of [...this.statuses]) if (status.expiresAt <= now) this.removeStatus(status) }
  private removeStatus(status: StatusRuntime) { const index = this.statuses.indexOf(status); if (index >= 0) this.statuses.splice(index, 1); this.host.emitStatus(status.targetParticipantId, status.statusId, false) }
  private conditions(values: ConditionDefinition[], context: TriggerContext, runtime: AbilityRuntime) { return values.every((item) => this.condition(item, context, runtime)) }
  private condition(item: ConditionDefinition, context: TriggerContext, runtime: AbilityRuntime): boolean { const self = this.host.participant(runtime.participantId)!, opponent = this.host.opponent(runtime.participantId); switch (item.type) { case 'any': return (item.conditions ?? []).some((value) => this.condition(value, context, runtime)); case 'all': return (item.conditions ?? []).every((value) => this.condition(value, context, runtime)); case 'not': return !this.condition(item.condition!, context, runtime); case 'tile_type_is': return context.tileType === item.tileType; case 'matched_tile_count': return compare(context.matchedTileCount, item.operator, item.value); case 'source_type_is': return item.value === 'enemy_attack' ? ['enemy_attack','active_skill'].includes(context.sourceType ?? '') : context.sourceType === item.value; case 'source_has_tag': return context.sourceTags?.includes(item.tag!) ?? false; case 'target_has_status': return this.statuses.some((value) => value.targetParticipantId === context.targetParticipantId && value.statusId === item.statusId); case 'target_lacks_status': return !this.statuses.some((value) => value.targetParticipantId === context.targetParticipantId && value.statusId === item.statusId); case 'self_hp_ratio': return compare(self.hp / BATTLE_CONFIG.maxHp, item.operator, item.value); case 'self_shield_amount': return compare(self.shield, item.operator, item.value); case 'opponent_hp_ratio': return compare(opponent.hp / BATTLE_CONFIG.maxHp, item.operator, item.value); case 'opponent_shield_amount': return compare(opponent.shield, item.operator, item.value); case 'incoming_damage': return compare(context.currentAmount, item.operator, item.value); case 'shield_was_broken': return compare(context.shieldBroken, item.operator, item.value); case 'hp_threshold_crossed': return context.hpThresholdCrossed === item.value && (!item.direction || item.direction === 'downward'); case 'cooldown_ready': return context.serverTime >= runtime.cooldownEndsAt; case 'charge_available': return compare(runtime.charges, item.operator ?? 'gt', item.value ?? 0); case 'once_per_battle_available': return !runtime.usedThisBattle; case 'effect_result_compare': return compare(context.effectResults[item.effectKey!]?.[item.field! as keyof EffectResult] as number | boolean | undefined, item.operator, item.value); case 'compare_number': case 'compare_ratio': return compare(context[item.field! as keyof TriggerContext] as number | undefined, item.operator, item.value); default: return false } }
  private hasUnresolvedResult(values: ConditionDefinition[], context: TriggerContext) { const key = this.effectReference(values); return Boolean(key && !context.effectResults[key]) }
  private effectReference(values: ConditionDefinition[]): string | undefined { for (const value of values) { if (value.type === 'effect_result_compare') return value.effectKey; const nested = value.conditions ? this.effectReference(value.conditions) : value.condition ? this.effectReference([value.condition]) : undefined; if (nested) return nested } return undefined }
}
