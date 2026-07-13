import {
  BATTLE_CONFIG, DEFAULT_LOADOUT as LEGACY_LOADOUT, SeededRandom, applyGauge, applyHeal, applyPercentage, applyShield,
  createBattleStats, effectFor, generateBoard, listLegalSwaps, resolveAttack, resolveSwap, shuffleBoard, swordTravelMs, timeResult,
  migrateBattleLoadoutSnapshot, tileEffectPercentage,
  type BattleDecision, type BattleParticipant, type BattleResult, type BattleSnapshot, type BattleStats, type BotDiagnostics, type CombatEvent, type FrenzyState, type MatchResolution,
  type PendingAttack, type SwapRequest, type TileType, type BattleLoadoutSnapshot, type BoardState, type LegacyBattleLoadoutSnapshot,
} from '@mercenary/shared';
import { chooseBotMove, shouldBotUseAbility, type BotDecision } from './bot.js';
import { BOT_CONFIG, botActionDelay, botDefenseDelay, botSkillDelay } from './bot-config.js';
import { BOT_LOADOUT, CharacterRegistry, DEFAULT_LOADOUT, loadCharacterRegistry } from './character-registry.js';
import { BattleEffectEngine, type EffectEngineState, type QueueAbilityAttack } from './effect-engine.js';
import type { AbilityDefinition, EffectResult } from './effect-types.js';

export interface BattleHooks {
  snapshot(playerId: string, value: BattleSnapshot): void;
  event(playerId: string, name: string, value: unknown): void;
  ended(battle: Battle): void;
}

export interface BattleRuntimeState {
  readonly schemaVersion: 2;
  readonly battleId: string;
  readonly phase: BattleSnapshot['phase'];
  readonly startsAt: number;
  readonly endsAt: number;
  readonly players: Array<{ id: string; hp: number; maxHp: number; shield: number; gauge: number; board: BoardState; battleLoadout: BattleLoadoutSnapshot }>;
  readonly pendingAttacks: PendingAttack[];
  readonly result: BattleResult | null;
  readonly stats: Record<string, BattleStats>;
  readonly isFrenzy: boolean;
  readonly frenzyStartedAt: number | null;
  readonly rngState: number;
  readonly effectState: EffectEngineState;
  readonly usedSkillRequests: string[];
  readonly processedAttackIds: string[];
  readonly battleStartedDispatched: boolean;
  readonly rematchReady: string[];
  readonly exitedPlayers: string[];
}
export interface LegacyBattleRuntimeState extends Omit<BattleRuntimeState, 'schemaVersion' | 'players'> {
  readonly schemaVersion: 1;
  readonly players: Array<{ id: string; hp: number; shield: number; gauge: number; board: BoardState; battleLoadout: LegacyBattleLoadoutSnapshot }>;
}

let sequence = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;

export function createParticipant(playerId: string, token: string, name: string, isBot = false, seed = Date.now(), battleLoadout: BattleLoadoutSnapshot | LegacyBattleLoadoutSnapshot = loadCharacterRegistry().snapshot(isBot ? BOT_LOADOUT : DEFAULT_LOADOUT)): BattleParticipant {
  const frozenLoadout = migrateBattleLoadoutSnapshot(battleLoadout);
  const combatStats = Object.freeze({ ...frozenLoadout.combatant.combatStats });
  return { id: playerId, sessionToken: token, name, isBot, connected: true, hp: combatStats.maxHp, maxHp: combatStats.maxHp, combatStats, shield: 0, gauge: 0, board: { tiles: generateBoard(new SeededRandom(seed)), version: 1, processing: false }, loadout: LEGACY_LOADOUT, battleLoadout: frozenLoadout };
}

export class Battle {
  readonly id: string;
  phase: BattleSnapshot['phase'] = 'COUNTDOWN';
  startsAt: number;
  endsAt: number;
  pendingAttacks: PendingAttack[] = [];
  result: BattleResult | null = null;
  stats: Record<string, BattleStats>;
  isFrenzy = false;
  frenzyStartedAt: number | null = null;
  rematchReady = new Set<string>();
  exitedPlayers = new Set<string>();
  private timer: NodeJS.Timeout;
  private botTimers = new Set<NodeJS.Timeout>();
  private botActionTimers = new Map<string, NodeJS.Timeout>();
  private botSkillTimers = new Map<string, NodeJS.Timeout>();
  private botSkillPending = new Set<string>();
  private botDiagnostics = new Map<string, BotDiagnostics>();
  private usedSkillRequests = new Set<string>();
  private processedAttackIds = new Set<string>();
  private rng: SeededRandom;
  private effects: BattleEffectEngine;
  private battleStartedDispatched = false;

  constructor(public players: [BattleParticipant, BattleParticipant], private hooks: BattleHooks, now = Date.now(), countdownMs = Number(process.env.COUNTDOWN_MS ?? 3_000), seed = now, private registry: CharacterRegistry = loadCharacterRegistry(), battleId = id('battle')) {
    this.id = battleId;
    this.startsAt = now + countdownMs;
    this.endsAt = this.startsAt + BATTLE_CONFIG.durationMs;
    this.rng = new SeededRandom(seed);
    this.stats = Object.fromEntries(players.map((player) => [player.id, createBattleStats()]));
    this.effects = new BattleEffectEngine(this.id, players, registry, {
      participant: (participantId) => this.player(participantId), opponent: (participantId) => this.other(participantId), queueAbilityAttack: (value) => this.queueAbilityAttack(value),
      gainShield: (participantId, amount, abilityId) => this.effectShield(participantId, amount, abilityId), heal: (participantId, amount, abilityId) => this.effectHeal(participantId, amount, abilityId), gainMana: (participantId, amount) => this.effectMana(participantId, amount),
      emitAbility: (participantId, ability, origin) => this.emitAbility(participantId, ability, origin), emitStatus: (participantId, statusId, active) => this.emitAll('combatEvent', { type: 'STATUS_CHANGED', at: Date.now(), participantId, statusId, active } satisfies CombatEvent), emitMessage: (participantId, message) => this.emitAll('combatEvent', { type: 'BATTLE_MESSAGE', at: Date.now(), participantId, message } satisfies CombatEvent), incrementStat: (participantId, field, abilityId, amount) => this.incrementEffectStat(participantId, field, abilityId, amount),
    });
    for (const player of players) if (player.isBot) this.botDiagnostics.set(player.id, { swapActionCount: 0, resolvedMatchGroupCount: 0, healDecisionCount: 0, shieldDecisionCount: 0, manaDecisionCount: 0, swordDecisionCount: 0, skillDecisionCount: 0, skillUseCount: 0, optimalMovePickCount: 0, topMovePickCount: 0, randomMovePickCount: 0, recentActions: [] });
    this.timer = setInterval(() => this.tick(), 25);
    this.timer.unref?.();
    for (const player of players) if (player.isBot) this.scheduleBot(player.id, true);
  }

  other(playerId: string) { return this.players.find((player) => player.id !== playerId)! }
  player(playerId: string) { return this.players.find((player) => player.id === playerId) }
  serializeEffectState() { return this.effects.serializeState() }
  restoreEffectState(state: EffectEngineState) { this.effects.restoreState(state) }
  serializeRuntimeState(): BattleRuntimeState {
    return structuredClone({ schemaVersion: 2, battleId: this.id, phase: this.phase, startsAt: this.startsAt, endsAt: this.endsAt, players: this.players.map((player) => ({ id: player.id, hp: player.hp, maxHp: player.maxHp, shield: player.shield, gauge: player.gauge, board: player.board, battleLoadout: player.battleLoadout! })), pendingAttacks: this.pendingAttacks, result: this.result, stats: this.stats, isFrenzy: this.isFrenzy, frenzyStartedAt: this.frenzyStartedAt, rngState: this.rng.serializeState(), effectState: this.effects.serializeState(), usedSkillRequests: [...this.usedSkillRequests], processedAttackIds: [...this.processedAttackIds], battleStartedDispatched: this.battleStartedDispatched, rematchReady: [...this.rematchReady], exitedPlayers: [...this.exitedPlayers] });
  }
  restoreRuntimeState(state: BattleRuntimeState | LegacyBattleRuntimeState): void {
    const version: number = state.schemaVersion;
    if (version !== 1 && version !== 2) throw new Error(`UNSUPPORTED_BATTLE_RUNTIME_SNAPSHOT_VERSION:${String(version)}`);
    if (state.battleId !== this.id) throw new Error('BATTLE_RUNTIME_SNAPSHOT_ID_MISMATCH');
    for (const saved of state.players) {
      const player = this.player(saved.id); if (!player) throw new Error(`BATTLE_RUNTIME_SNAPSHOT_PLAYER_MISSING:${saved.id}`);
      const loadout = migrateBattleLoadoutSnapshot(saved.battleLoadout), combatStats = loadout.combatant.combatStats;
      const maxHp = 'maxHp' in saved ? saved.maxHp : combatStats.maxHp;
      if (maxHp !== combatStats.maxHp || saved.hp < 0 || saved.hp > maxHp) throw new Error('BATTLE_RUNTIME_SNAPSHOT_STATS_INVALID');
      player.hp = saved.hp; player.maxHp = maxHp; player.combatStats = Object.freeze({ ...combatStats }); player.shield = saved.shield; player.gauge = saved.gauge; player.board = structuredClone(saved.board); player.battleLoadout = loadout;
    }
    this.phase = state.phase; this.startsAt = state.startsAt; this.endsAt = state.endsAt; this.pendingAttacks = structuredClone(state.pendingAttacks); this.result = structuredClone(state.result); this.stats = structuredClone(state.stats); this.isFrenzy = state.isFrenzy; this.frenzyStartedAt = state.frenzyStartedAt; this.rng.restoreState(state.rngState); this.effects.restoreState(state.effectState); this.usedSkillRequests = new Set(state.usedSkillRequests); this.processedAttackIds = new Set(state.processedAttackIds); this.battleStartedDispatched = state.battleStartedDispatched; this.rematchReady = new Set(state.rematchReady); this.exitedPlayers = new Set(state.exitedPlayers);
  }

  private publicPlayer(player: BattleParticipant, viewerId: string) {
    return { id: player.id, name: player.name, isBot: player.isBot, connected: player.connected, hp: player.hp, maxHp: player.maxHp, combatStats: { ...player.combatStats }, shield: player.shield, gauge: player.gauge, loadout: player.battleLoadout!, effectRuntime: this.effects.snapshot(player.id, viewerId) };
  }

  private frenzyState(now = Date.now()): FrenzyState {
    return { isFrenzy: this.isFrenzy, frenzyStartedAt: this.frenzyStartedAt, remainingMs: Math.max(0, this.endsAt - now), attackMultiplier: this.isFrenzy ? BATTLE_CONFIG.frenzyAttackMultiplier : 1, shieldMultiplier: this.isFrenzy ? BATTLE_CONFIG.frenzyShieldMultiplier : 1, healMultiplier: this.isFrenzy ? BATTLE_CONFIG.frenzyHealMultiplier : 1, manaMultiplier: this.isFrenzy ? BATTLE_CONFIG.frenzyManaMultiplier : 1 };
  }

  private statsSnapshot(): Record<string, BattleStats> {
    return Object.fromEntries(Object.entries(this.stats).map(([playerId, stats]) => [playerId, { ...stats }]));
  }

  snapshotFor(playerId: string, now = Date.now()): BattleSnapshot {
    const self = this.player(playerId)!; const opponent = this.other(playerId);
    const diagnostics = this.botDiagnostics.get(opponent.isBot ? opponent.id : self.id);
    return { battleId: this.id, phase: this.phase, serverNow: now, startsAt: this.startsAt, endsAt: this.endsAt, selfId: self.id, self: this.publicPlayer(self, playerId), opponent: this.publicPlayer(opponent, playerId), board: { ...self.board, tiles: [...self.board.tiles] }, pendingAttacks: this.pendingAttacks.filter((attack) => attack.targetId === playerId), result: this.result, frenzy: this.frenzyState(now), stats: this.statsSnapshot(), botDiagnostics: diagnostics ? { ...diagnostics, recentActions: [...diagnostics.recentActions] } : undefined, rematchReady: [...this.rematchReady] };
  }

  broadcastSnapshots() { for (const player of this.players) if (!player.isBot) this.hooks.snapshot(player.id, this.snapshotFor(player.id)) }

  private emitAll(name: string, value: unknown) { for (const player of this.players) if (!player.isBot) this.hooks.event(player.id, name, value) }

  tick(now = Date.now()) {
    if (this.phase === 'COUNTDOWN' && now >= this.startsAt) { this.phase = 'PLAYING'; if (!this.battleStartedDispatched) { this.battleStartedDispatched = true; for (const player of this.players) this.effects.dispatch('battle_started', player.id, { serverTime: now }) } this.broadcastSnapshots() }
    if (this.phase !== 'PLAYING') return;
    this.effects.tick(now, this.pendingAttacks);
    if (!this.isFrenzy && now < this.endsAt && this.endsAt - now <= BATTLE_CONFIG.frenzyStartRemainingMs) {
      this.isFrenzy = true; this.frenzyStartedAt = now; const state = this.frenzyState(now);
      this.emitAll('frenzyStarted', state); this.broadcastSnapshots();
    }
    const arrived = this.pendingAttacks.filter((attack) => attack.arrivesAt <= now);
    for (const attack of arrived) {
      this.pendingAttacks.splice(this.pendingAttacks.indexOf(attack), 1);
      if (this.processedAttackIds.has(attack.id)) continue;
      this.processedAttackIds.add(attack.id);
      const target = this.player(attack.targetId);
      if (!target) continue;
      const before = { hp: target.hp, shield: target.shield }; this.effects.incoming(attack, now); const damage = resolveAttack(target, attack); const after = { hp: target.hp, shield: target.shield };
      const sourceStats = this.stats[attack.sourceId], targetStats = this.stats[attack.targetId];
      if (sourceStats && targetStats) {
        sourceStats.shieldDamageDealt += damage.absorbed; sourceStats.hpDamageDealt += damage.hpDamage;
        targetStats.damageBlockedByShield += damage.absorbed; targetStats.hpDamageReceived += damage.hpDamage; targetStats.totalDamageReceived += damage.absorbed + damage.hpDamage;
        if (damage.hpDamage === 0 && damage.absorbed === attack.damage) targetStats.attacksFullyBlocked++;
        if (damage.shieldBroken) targetStats.shieldBreakCount++;
        const bypass = Math.min(damage.hpDamage, Math.round(attack.damage * (attack.shieldBypassRatio ?? 0))); sourceStats.directHpDamageBypass += bypass;
        if (attack.sourceAbilityId) sourceStats.damageByAbilityId[attack.sourceAbilityId] = (sourceStats.damageByAbilityId[attack.sourceAbilityId] ?? 0) + damage.absorbed + damage.hpDamage;
      }
      const event: CombatEvent = { type: 'ATTACK_RESOLVED', at: now, attackId: attack.id, ...damage };
      this.emitAll('combatEvent', event);
      this.effects.attackResolved(attack, { requestedAmount: attack.damage, finalAmount: attack.damage, shieldDamage: damage.absorbed, hpDamage: damage.hpDamage, shieldBroken: damage.shieldBroken, targetDefeated: target.hp <= 0 }, now, before, after);
      if (target.hp <= 0) { this.finish({ winnerId: attack.sourceId, reason: 'HP_ZERO', endedAt: now }); return }
    }
    if (now >= this.endsAt) { this.finish(timeResult(this.players[0], this.players[1], now)); return }
    if (arrived.length) this.broadcastSnapshots();
  }

  swap(playerId: string, request: SwapRequest): MatchResolution | null {
    const player = this.player(playerId);
    if (!player || this.phase !== 'PLAYING' || player.board.processing) return null;
    player.board.processing = true;
    const resolution = resolveSwap({ ...player.board, processing: false }, request, this.rng);
    if (!resolution) { player.board.processing = false; return null }
    player.board.tiles = resolution.finalBoard; player.board.version++; player.board.processing = false;
    this.finalizeResolution(player, resolution);
    if (!player.isBot) this.hooks.event(player.id, 'boardResolved', resolution);
    this.broadcastSnapshots();
    return resolution;
  }

  finalizeResolution(player: BattleParticipant, resolution: MatchResolution) {
    this.recordMatches(player.id, resolution);
    resolution.effects = resolution.effects.map((effect) => {
      const rawAmount = effectFor(effect.type, effect.matched, effect.chain, this.isFrenzy);
      return { ...effect, amount: applyPercentage(rawAmount, tileEffectPercentage(player.combatStats, effect.type)) };
    });
    this.applyEffects(player, resolution);
    for (const step of resolution.steps) for (let groupIndex = 0; groupIndex < step.groups.length; groupIndex++) { const group = step.groups[groupIndex]!; this.effects.dispatch('match_group_resolved', player.id, { tileType: group.type, matchedTileCount: group.cells.length, chainLevel: step.chain, scopeKey: `${player.id}:${player.board.version}:${step.chain}`, serverTime: Date.now() }) }
  }

  private recordMatches(playerId: string, resolution: MatchResolution) {
    const stats = this.stats[playerId]; if (!stats) return;
    type MatchStatKey = 'swordMatchCount' | 'swordTilesMatched' | 'shieldMatchCount' | 'shieldTilesMatched' | 'healMatchCount' | 'healTilesMatched' | 'manaMatchCount' | 'manaTilesMatched';
    const keys: Record<TileType, [MatchStatKey, MatchStatKey]> = { SWORD: ['swordMatchCount', 'swordTilesMatched'], SHIELD: ['shieldMatchCount', 'shieldTilesMatched'], HEAL: ['healMatchCount', 'healTilesMatched'], MANA: ['manaMatchCount', 'manaTilesMatched'] };
    for (const step of resolution.steps) {
      stats.maxChain = Math.max(stats.maxChain, step.chain);
      for (const group of step.groups) { const [countKey, tilesKey] = keys[group.type]; stats[countKey]++; stats[tilesKey] += group.cells.length }
    }
  }

  private applyEffects(player: BattleParticipant, resolution: MatchResolution) {
    const now = Date.now(); const opponent = this.other(player.id);
    for (const effect of resolution.effects) {
      let event: CombatEvent | null = null;
      if (effect.type === 'SWORD') {
        const attack: PendingAttack = this.effects.outgoing({ id: id('attack'), sourceId: player.id, targetId: opponent.id, damage: effect.amount, kind: 'SWORD', createdAt: now, arrivesAt: now + swordTravelMs(effect.matched), sourceTags: ['normal_attack','offense'] }, now);
        this.pendingAttacks.push(attack); event = { type: 'ATTACK_QUEUED', at: now, attack };
        this.stats[player.id]!.totalDamageGenerated += attack.damage; this.stats[player.id]!.attacksQueued++;
        if (opponent.isBot) this.scheduleBot(opponent.id, false, botDefenseDelay());
      } else if (effect.type === 'SHIELD') { const requested = Math.round(effect.amount * this.effects.shieldMultiplier(player.id, now)); const amount = applyShield(player, requested); this.stats[player.id]!.shieldGained += amount; event = { type: 'SHIELD_GAINED', at: now, participantId: player.id, amount } }
      else if (effect.type === 'HEAL') { const multiplier = this.effects.healingMultiplier(player.id, now), requested = Math.round(effect.amount * multiplier), amount = applyHeal(player, requested); this.stats[player.id]!.healingDone += amount; this.stats[player.id]!.healingPrevented += Math.max(0, effect.amount - requested); event = { type: 'HEALED', at: now, participantId: player.id, amount } }
      else { const amount = applyGauge(player, effect.amount); this.stats[player.id]!.manaGained += amount; event = { type: 'GAUGE_GAINED', at: now, participantId: player.id, amount } }
      if (event) this.emitAll('combatEvent', event);
    }
  }

  useSkill(playerId: string, requestId: string): boolean {
    const player = this.player(playerId);
    const ability = player ? this.effects.activeDefinition(playerId) : undefined;
    if (!player || !ability || this.phase !== 'PLAYING' || player.gauge < ability.cost || !requestId || this.usedSkillRequests.has(requestId)) return false;
    const now = Date.now(); if (!this.effects.useActive(playerId, now)) return false; this.usedSkillRequests.add(requestId); player.gauge -= ability.cost; this.stats[playerId]!.skillUseCount++; this.broadcastSnapshots(); return true;
  }

  setConnected(playerId: string, connected: boolean) { const player = this.player(playerId); if (player) { player.connected = connected; this.broadcastSnapshots() } }
  ensurePlayableBoard(playerId: string) { const player = this.player(playerId); if (player && !listLegalSwaps(player.board.tiles).length) { player.board.tiles = shuffleBoard(player.board.tiles, this.rng); player.board.version++ } }

  finish(decision: BattleDecision) {
    if (this.phase === 'FINISHED') return;
    this.phase = 'FINISHED';
    this.result = { ...decision, matchDurationMs: Math.max(0, decision.endedAt - this.startsAt), endedByHpZero: decision.reason === 'HP_ZERO', endedByTimeout: decision.reason === 'TIMEOUT', endedByForfeit: decision.reason === 'FORFEIT', endedByDisconnect: decision.reason === 'DISCONNECT', frenzyStarted: this.isFrenzy, frenzyDurationMs: this.frenzyStartedAt === null ? 0 : Math.max(0, decision.endedAt - this.frenzyStartedAt), stats: this.statsSnapshot() };
    for (const player of this.players) this.effects.dispatch('battle_finished', player.id, { serverTime: decision.endedAt }); this.effects.finish(); this.pendingAttacks = []; clearInterval(this.timer); for (const timer of this.botTimers) clearTimeout(timer); this.botTimers.clear(); this.botActionTimers.clear(); this.botSkillTimers.clear(); this.botSkillPending.clear();
    this.broadcastSnapshots(); this.emitAll('battleEnded', this.result); this.hooks.ended(this);
  }
  forfeit(playerId: string, reason: BattleDecision['reason'] = 'FORFEIT') { if (this.phase !== 'FINISHED') this.finish({ winnerId: this.other(playerId).id, reason, endedAt: Date.now() }) }
  rematch(playerId: string) { if (this.phase !== 'FINISHED' || this.exitedPlayers.size || this.exitedPlayers.has(playerId)) return false; this.rematchReady.add(playerId); this.broadcastSnapshots(); return this.other(playerId).isBot || this.rematchReady.size === 2 }
  exit(playerId: string) { if (this.phase !== 'FINISHED' || !this.player(playerId)) return false; this.rematchReady.delete(playerId); this.exitedPlayers.add(playerId); if (this.exitedPlayers.size === this.players.filter((player) => !player.isBot).length) this.effects.clear(); return true }

  private queueAbilityAttack(value: QueueAbilityAttack) { const now = Date.now(); const frenzy = this.isFrenzy ? BATTLE_CONFIG.frenzyAttackMultiplier : 1; const attack = this.effects.outgoing({ id: id('attack'), sourceId: value.sourceId, targetId: value.targetId, damage: Math.round(value.amount * frenzy), kind: 'SKILL', createdAt: now, arrivesAt: now + value.travelMs, sourceAbilityId: value.sourceAbilityId, sourceTags: value.tags, shieldBypassRatio: value.shieldBypassRatio, origin: value.origin }, now); this.pendingAttacks.push(attack); const stats = this.stats[value.sourceId]!; stats.totalDamageGenerated += attack.damage; stats.attacksQueued++; this.emitAll('combatEvent', { type: 'ATTACK_QUEUED', at: now, attack, origin: value.origin } satisfies CombatEvent); return attack }
  private effectShield(participantId: string, requested: number, abilityId: string): EffectResult { const player = this.player(participantId)!; const multiplier = (this.isFrenzy ? BATTLE_CONFIG.frenzyShieldMultiplier : 1) * this.effects.shieldMultiplier(participantId); const finalAmount = Math.round(requested * multiplier), actualShieldGain = applyShield(player, finalAmount); const stats = this.stats[participantId]!; stats.shieldGained += actualShieldGain; stats.bonusShieldFromEffects += actualShieldGain; stats.shieldByAbilityId[abilityId] = (stats.shieldByAbilityId[abilityId] ?? 0) + actualShieldGain; this.emitAll('combatEvent', { type: 'SHIELD_GAINED', at: Date.now(), participantId, amount: actualShieldGain } satisfies CombatEvent); return { requestedAmount: requested, finalAmount, actualShieldGain } }
  private effectHeal(participantId: string, requested: number, abilityId: string): EffectResult { const player = this.player(participantId)!; const frenzy = this.isFrenzy ? BATTLE_CONFIG.frenzyHealMultiplier : 1, received = this.effects.healingMultiplier(participantId); const finalAmount = Math.round(requested * frenzy * received), actualHealing = applyHeal(player, finalAmount), overhealing = Math.max(0, finalAmount - actualHealing); const prevented = Math.max(0, Math.round(requested * frenzy) - finalAmount), stats = this.stats[participantId]!; stats.healingDone += actualHealing; stats.healingPrevented += prevented; stats.healingByAbilityId[abilityId] = (stats.healingByAbilityId[abilityId] ?? 0) + actualHealing; this.emitAll('combatEvent', { type: 'HEALED', at: Date.now(), participantId, amount: actualHealing } satisfies CombatEvent); return { requestedAmount: requested, finalAmount, actualHealing, overhealing } }
  private effectMana(participantId: string, requested: number): EffectResult { const player = this.player(participantId)!; const finalAmount = applyGauge(player, requested); this.stats[participantId]!.manaGained += finalAmount; this.emitAll('combatEvent', { type: 'GAUGE_GAINED', at: Date.now(), participantId, amount: finalAmount } satisfies CombatEvent); return { requestedAmount: requested, finalAmount } }
  private emitAbility(participantId: string, ability: AbilityDefinition, origin?: QueueAbilityAttack['origin']) { if (ability.kind === 'support' && ability.trigger.type === 'shield_broken') this.stats[participantId]!.countersTriggered++; if (ability.kind === 'support' && ability.trigger.type === 'hp_threshold_crossed') this.stats[participantId]!.emergencyHealsTriggered++; this.emitAll('combatEvent', { type: 'ABILITY_TRIGGERED', at: Date.now(), participantId, abilityId: ability.id, abilityName: ability.name, kind: ability.kind, origin } satisfies CombatEvent) }
  private incrementEffectStat(participantId: string, field: string, abilityId?: string, amount = 1) { const stats = this.stats[participantId] as unknown as Record<string, unknown>; if (abilityId) { const map = stats[field] as Record<string, number>; map[abilityId] = (map[abilityId] ?? 0) + amount } else stats[field] = Number(stats[field] ?? 0) + amount }

  debug(playerId: string, action: 'deterministicBoard' | 'swordMove' | 'shieldMove' | 'healMove' | 'manaMove' | 'time35' | 'time5' | 'win' | 'lose') {
    if (process.env.NODE_ENV === 'production' || (process.env.ENABLE_TEST_API !== 'true' && process.env.NODE_ENV !== 'development')) return;
    const player = this.player(playerId); if (!player) return;
    if (action === 'deterministicBoard') { player.board.tiles = generateBoard(new SeededRandom(42)); player.board.version++; this.broadcastSnapshots() }
    else if (['swordMove', 'shieldMove', 'healMove', 'manaMove'].includes(action)) {
      const wanted: TileType = action === 'swordMove' ? 'SWORD' : action === 'shieldMove' ? 'SHIELD' : action === 'healMove' ? 'HEAL' : 'MANA';
      for (let seed = 1; seed < 5_000; seed++) {
        const board = generateBoard(new SeededRandom(seed));
        const move = listLegalSwaps(board).find(([from, to]) => {
          const groups = resolveSwap({ tiles: board, version: 1, processing: false }, { from, to, requestId: 'probe' }, new SeededRandom(999));
          return groups?.steps[0]?.groups.some((group) => group.type === wanted && (wanted !== 'SWORD' || group.cells.length >= 5));
        });
        if (move) { player.board.tiles = board; player.board.version++; this.swap(playerId, { from: move[0], to: move[1], requestId: id(`debug-${wanted.toLowerCase()}`) }); break }
      }
    }
    else if (action === 'time35' || action === 'time5') { this.endsAt = Date.now() + (action === 'time35' ? 35_000 : 5_000); this.broadcastSnapshots() }
    else if (action === 'win') { this.other(playerId).hp = 0; this.finish({ winnerId: playerId, reason: 'HP_ZERO', endedAt: Date.now() }) }
    else { player.hp = 0; this.finish({ winnerId: this.other(playerId).id, reason: 'HP_ZERO', endedAt: Date.now() }) }
  }

  private recordBotDecision(botId: string, decision: BotDecision, resolution: MatchResolution) {
    const diagnostics = this.botDiagnostics.get(botId); if (!diagnostics) return;
    diagnostics.swapActionCount++; diagnostics.resolvedMatchGroupCount += resolution.steps.reduce((sum, step) => sum + step.groups.length, 0);
    const countKey = decision.primaryType === 'HEAL' ? 'healDecisionCount' : decision.primaryType === 'SHIELD' ? 'shieldDecisionCount' : decision.primaryType === 'MANA' ? 'manaDecisionCount' : 'swordDecisionCount';
    diagnostics[countKey]++;
    const pickKey = decision.pickTier === 'optimal' ? 'optimalMovePickCount' : decision.pickTier === 'top' ? 'topMovePickCount' : 'randomMovePickCount'; diagnostics[pickKey]++;
    diagnostics.recentActions.push(decision.primaryType); diagnostics.recentActions = diagnostics.recentActions.slice(-2);
  }

  private performBotMove(botId: string): boolean {
    const bot = this.player(botId); if (!bot || this.phase !== 'PLAYING' || bot.board.processing) return false;
    const opponent = this.other(botId), diagnostics = this.botDiagnostics.get(botId);
    const move = chooseBotMove(bot, opponent, this.pendingAttacks.filter((attack) => attack.targetId === botId), Math.random, BOT_CONFIG, { recentActions: diagnostics?.recentActions });
    if (!move) { this.ensurePlayableBoard(botId); return false }
    const resolution = this.swap(botId, { from: move.from, to: move.to, requestId: id('bot-swap') });
    if (!resolution) return false; this.recordBotDecision(botId, move, resolution); return true;
  }

  private scheduleSkillDecision(botId: string) {
    if (this.botSkillPending.has(botId) || this.phase !== 'PLAYING') return;
    this.botSkillPending.add(botId);
    const skillTimer = setTimeout(() => {
      this.botTimers.delete(skillTimer); this.botSkillTimers.delete(botId); this.botSkillPending.delete(botId);
      const bot = this.player(botId), diagnostics = this.botDiagnostics.get(botId); let moved = false;
      if (this.phase === 'PLAYING' && bot && bot.gauge >= 100 && !bot.board.processing) {
        if (diagnostics) diagnostics.skillDecisionCount++;
        if (shouldBotUseAbility(bot, this.other(botId), this.effects.activeDefinition(botId), this.pendingAttacks.filter((attack) => attack.targetId === botId), this.isFrenzy)) {
          if (this.useSkill(bot.id, id('bot-skill')) && diagnostics) diagnostics.skillUseCount++;
        } else moved = this.performBotMove(botId);
      }
      this.scheduleBot(botId, false, undefined, moved);
    }, botSkillDelay());
    skillTimer.unref?.(); this.botTimers.add(skillTimer); this.botSkillTimers.set(botId, skillTimer);
  }

  private scheduleBot(botId: string, firstAction = false, overrideDelay?: number, afterResolution = false) {
    if (this.phase === 'FINISHED') return;
    const previous = this.botActionTimers.get(botId);
    if (previous) { clearTimeout(previous); this.botTimers.delete(previous) }
    const untilStart = firstAction ? Math.max(0, this.startsAt - Date.now()) : 0;
    const delay = overrideDelay ?? untilStart + botActionDelay(firstAction) + (afterResolution ? BOT_CONFIG.boardResolutionSettleMs : 0);
    const timer = setTimeout(() => {
      this.botTimers.delete(timer); this.botActionTimers.delete(botId);
      if (this.phase === 'PLAYING') {
        const bot = this.player(botId)!;
        if (bot.gauge >= 100) {
          this.scheduleSkillDecision(botId);
          return;
        } else {
          const moved = this.performBotMove(botId); this.scheduleBot(botId, false, undefined, moved); return;
        }
      }
      this.scheduleBot(botId);
    }, delay);
    timer.unref?.(); this.botTimers.add(timer); this.botActionTimers.set(botId, timer);
  }
}
