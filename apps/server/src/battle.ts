import {
  BATTLE_CONFIG, DEFAULT_LOADOUT, SeededRandom, activeSkillDamage, applyGauge, applyHeal, applyShield,
  createBattleStats, effectFor, generateBoard, listLegalSwaps, resolveAttack, resolveSwap, shuffleBoard, swordTravelMs, timeResult,
  type BattleDecision, type BattleParticipant, type BattleResult, type BattleSnapshot, type BattleStats, type BotDiagnostics, type CombatEvent, type FrenzyState, type MatchResolution,
  type PendingAttack, type SwapRequest, type TileType,
} from '@mercenary/shared';
import { chooseBotMove, shouldBotUseSkill, type BotDecision } from './bot.js';
import { BOT_CONFIG, botActionDelay, botDefenseDelay, botSkillDelay } from './bot-config.js';

export interface BattleHooks {
  snapshot(playerId: string, value: BattleSnapshot): void;
  event(playerId: string, name: string, value: unknown): void;
  ended(battle: Battle): void;
}

let sequence = 0;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}`;

export function createParticipant(playerId: string, token: string, name: string, isBot = false, seed = Date.now()): BattleParticipant {
  return { id: playerId, sessionToken: token, name, isBot, connected: true, hp: 1_000, shield: 0, gauge: 0, board: { tiles: generateBoard(new SeededRandom(seed)), version: 1, processing: false }, loadout: DEFAULT_LOADOUT };
}

export class Battle {
  readonly id = id('battle');
  phase: BattleSnapshot['phase'] = 'COUNTDOWN';
  startsAt: number;
  endsAt: number;
  pendingAttacks: PendingAttack[] = [];
  result: BattleResult | null = null;
  stats: Record<string, BattleStats>;
  isFrenzy = false;
  frenzyStartedAt: number | null = null;
  rematchReady = new Set<string>();
  private timer: NodeJS.Timeout;
  private botTimers = new Set<NodeJS.Timeout>();
  private botActionTimers = new Map<string, NodeJS.Timeout>();
  private botSkillTimers = new Map<string, NodeJS.Timeout>();
  private botSkillPending = new Set<string>();
  private botDiagnostics = new Map<string, BotDiagnostics>();
  private usedSkillRequests = new Set<string>();
  private processedAttackIds = new Set<string>();
  private rng: SeededRandom;

  constructor(public players: [BattleParticipant, BattleParticipant], private hooks: BattleHooks, now = Date.now(), countdownMs = Number(process.env.COUNTDOWN_MS ?? 3_000), seed = now) {
    this.startsAt = now + countdownMs;
    this.endsAt = this.startsAt + BATTLE_CONFIG.durationMs;
    this.rng = new SeededRandom(seed);
    this.stats = Object.fromEntries(players.map((player) => [player.id, createBattleStats()]));
    for (const player of players) if (player.isBot) this.botDiagnostics.set(player.id, { swapActionCount: 0, resolvedMatchGroupCount: 0, healDecisionCount: 0, shieldDecisionCount: 0, manaDecisionCount: 0, swordDecisionCount: 0, skillDecisionCount: 0, skillUseCount: 0, optimalMovePickCount: 0, topMovePickCount: 0, randomMovePickCount: 0, recentActions: [] });
    this.timer = setInterval(() => this.tick(), 25);
    this.timer.unref?.();
    for (const player of players) if (player.isBot) this.scheduleBot(player.id, true);
  }

  other(playerId: string) { return this.players.find((player) => player.id !== playerId)! }
  player(playerId: string) { return this.players.find((player) => player.id === playerId) }

  private publicPlayer(player: BattleParticipant) {
    return { id: player.id, name: player.name, isBot: player.isBot, connected: player.connected, hp: player.hp, shield: player.shield, gauge: player.gauge };
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
    return { battleId: this.id, phase: this.phase, serverNow: now, startsAt: this.startsAt, endsAt: this.endsAt, selfId: self.id, self: this.publicPlayer(self), opponent: this.publicPlayer(opponent), board: { ...self.board, tiles: [...self.board.tiles] }, pendingAttacks: this.pendingAttacks.filter((attack) => attack.targetId === playerId), result: this.result, frenzy: this.frenzyState(now), stats: this.statsSnapshot(), botDiagnostics: diagnostics ? { ...diagnostics, recentActions: [...diagnostics.recentActions] } : undefined, rematchReady: [...this.rematchReady] };
  }

  broadcastSnapshots() { for (const player of this.players) if (!player.isBot) this.hooks.snapshot(player.id, this.snapshotFor(player.id)) }

  private emitAll(name: string, value: unknown) { for (const player of this.players) if (!player.isBot) this.hooks.event(player.id, name, value) }

  tick(now = Date.now()) {
    if (this.phase === 'COUNTDOWN' && now >= this.startsAt) { this.phase = 'PLAYING'; this.broadcastSnapshots() }
    if (this.phase !== 'PLAYING') return;
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
      const damage = resolveAttack(target, attack);
      const sourceStats = this.stats[attack.sourceId], targetStats = this.stats[attack.targetId];
      if (sourceStats && targetStats) {
        sourceStats.shieldDamageDealt += damage.absorbed; sourceStats.hpDamageDealt += damage.hpDamage;
        targetStats.damageBlockedByShield += damage.absorbed; targetStats.hpDamageReceived += damage.hpDamage; targetStats.totalDamageReceived += damage.absorbed + damage.hpDamage;
        if (damage.hpDamage === 0 && damage.absorbed === attack.damage) targetStats.attacksFullyBlocked++;
        if (damage.shieldBroken) targetStats.shieldBreakCount++;
      }
      const event: CombatEvent = { type: 'ATTACK_RESOLVED', at: now, attackId: attack.id, ...damage };
      this.emitAll('combatEvent', event);
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

  private finalizeResolution(player: BattleParticipant, resolution: MatchResolution) {
    this.recordMatches(player.id, resolution);
    resolution.effects = resolution.effects.map((effect) => ({ ...effect, amount: effectFor(effect.type, effect.matched, effect.chain, this.isFrenzy) }));
    this.applyEffects(player, resolution);
  }

  private recordMatches(playerId: string, resolution: MatchResolution) {
    const stats = this.stats[playerId]; if (!stats) return;
    const keys: Record<TileType, [keyof BattleStats, keyof BattleStats]> = { SWORD: ['swordMatchCount', 'swordTilesMatched'], SHIELD: ['shieldMatchCount', 'shieldTilesMatched'], HEAL: ['healMatchCount', 'healTilesMatched'], MANA: ['manaMatchCount', 'manaTilesMatched'] };
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
        const attack: PendingAttack = { id: id('attack'), sourceId: player.id, targetId: opponent.id, damage: effect.amount, kind: 'SWORD', createdAt: now, arrivesAt: now + swordTravelMs(effect.matched) };
        this.pendingAttacks.push(attack); event = { type: 'ATTACK_QUEUED', at: now, attack };
        this.stats[player.id]!.totalDamageGenerated += attack.damage; this.stats[player.id]!.attacksQueued++;
        if (opponent.isBot) this.scheduleBot(opponent.id, false, botDefenseDelay());
      } else if (effect.type === 'SHIELD') { const amount = applyShield(player, effect.amount); this.stats[player.id]!.shieldGained += amount; event = { type: 'SHIELD_GAINED', at: now, participantId: player.id, amount } }
      else if (effect.type === 'HEAL') { const amount = applyHeal(player, effect.amount); this.stats[player.id]!.healingDone += amount; event = { type: 'HEALED', at: now, participantId: player.id, amount } }
      else { const amount = applyGauge(player, effect.amount); this.stats[player.id]!.manaGained += amount; event = { type: 'GAUGE_GAINED', at: now, participantId: player.id, amount } }
      if (event) this.emitAll('combatEvent', event);
    }
  }

  useSkill(playerId: string, requestId: string): boolean {
    const player = this.player(playerId);
    if (!player || this.phase !== 'PLAYING' || player.gauge < 100 || !requestId || this.usedSkillRequests.has(requestId)) return false;
    this.usedSkillRequests.add(requestId); player.gauge = 0; const now = Date.now(); const opponent = this.other(playerId);
    const attack: PendingAttack = { id: id('attack'), sourceId: playerId, targetId: opponent.id, damage: activeSkillDamage(this.isFrenzy), kind: 'SKILL', createdAt: now, arrivesAt: now + BATTLE_CONFIG.skillTravelMs };
    this.stats[playerId]!.skillUseCount++; this.stats[playerId]!.totalDamageGenerated += attack.damage; this.stats[playerId]!.attacksQueued++;
    this.pendingAttacks.push(attack); this.emitAll('combatEvent', { type: 'ATTACK_QUEUED', at: now, attack } satisfies CombatEvent); this.broadcastSnapshots(); return true;
  }

  setConnected(playerId: string, connected: boolean) { const player = this.player(playerId); if (player) { player.connected = connected; this.broadcastSnapshots() } }
  ensurePlayableBoard(playerId: string) { const player = this.player(playerId); if (player && !listLegalSwaps(player.board.tiles).length) { player.board.tiles = shuffleBoard(player.board.tiles, this.rng); player.board.version++ } }

  finish(decision: BattleDecision) {
    if (this.phase === 'FINISHED') return;
    this.phase = 'FINISHED';
    this.result = { ...decision, matchDurationMs: Math.max(0, decision.endedAt - this.startsAt), endedByHpZero: decision.reason === 'HP_ZERO', endedByTimeout: decision.reason === 'TIMEOUT', endedByForfeit: decision.reason === 'FORFEIT', endedByDisconnect: decision.reason === 'DISCONNECT', frenzyStarted: this.isFrenzy, frenzyDurationMs: this.frenzyStartedAt === null ? 0 : Math.max(0, decision.endedAt - this.frenzyStartedAt), stats: this.statsSnapshot() };
    this.pendingAttacks = []; clearInterval(this.timer); for (const timer of this.botTimers) clearTimeout(timer); this.botTimers.clear(); this.botActionTimers.clear(); this.botSkillTimers.clear(); this.botSkillPending.clear();
    this.broadcastSnapshots(); this.emitAll('battleEnded', this.result); this.hooks.ended(this);
  }
  forfeit(playerId: string, reason: BattleDecision['reason'] = 'FORFEIT') { if (this.phase !== 'FINISHED') this.finish({ winnerId: this.other(playerId).id, reason, endedAt: Date.now() }) }
  rematch(playerId: string) { if (this.phase !== 'FINISHED') return false; this.rematchReady.add(playerId); this.broadcastSnapshots(); return this.other(playerId).isBot || this.rematchReady.size === 2 }

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
        if (shouldBotUseSkill(this.other(botId), this.isFrenzy)) {
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
