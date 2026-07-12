import { BATTLE_CONFIG, findMatches, listLegalSwaps, swapTiles, type BattleParticipant, type PendingAttack, type Position, type TileType } from '@mercenary/shared';
import { BOT_CONFIG, type BotConfig } from './bot-config.js';

export type BotPickTier = 'optimal' | 'top' | 'random';
export interface BotDecision { from: Position; to: Position; score: number; highValue: boolean; maxMatched: number; primaryType: TileType; pickTier?: BotPickTier }
export interface BotEvaluationContext { recentActions?: TileType[] }

const base: Record<TileType, number> = { SWORD: 5, SHIELD: 3.5, HEAL: 3, MANA: 2.7 };
const countRecent = (actions: TileType[], type: TileType) => actions.filter((action) => action === type).length;

export function evaluateBotMoves(bot: BattleParticipant, opponent: BattleParticipant, incoming: PendingAttack[], random = Math.random, config: BotConfig = BOT_CONFIG, context: BotEvaluationContext = {}): BotDecision[] {
  const moves = listLegalSwaps(bot.board.tiles), recent = context.recentActions?.slice(-2) ?? [];
  const hpRatio = bot.hp / BATTLE_CONFIG.maxHp, shieldRatio = bot.shield / BATTLE_CONFIG.maxShield;
  const strongIncoming = incoming.some((attack) => attack.kind === 'SKILL' || attack.damage >= 115);
  const lethalIncoming = incoming.reduce((sum, attack) => sum + attack.damage, 0) >= bot.hp + bot.shield;
  const seesStrongAttack = strongIncoming && random() < config.strongAttackDefenseAwarenessChance;
  const healAwarenessChance = hpRatio <= 0.2 ? config.criticalHpHealAwarenessChance : config.lowHpHealAwarenessChance;
  const seesHealing = hpRatio <= 0.4 ? random() < healAwarenessChance : true;

  return moves.map(([from, to]) => {
    const groups = findMatches(swapTiles(bot.board.tiles, from, to));
    let score = groups.reduce((sum, group) => sum + base[group.type] * group.cells.length, 0);
    const maxMatched = Math.max(...groups.map((group) => group.cells.length));
    const primaryType = [...groups].sort((a, b) => base[b.type] * b.cells.length - base[a.type] * a.cells.length)[0]!.type;
    const types = new Set(groups.map((group) => group.type));

    if (types.has('HEAL')) {
      if (hpRatio > 0.7) score += 0;
      else if (hpRatio > 0.4) score += 3;
      else if (hpRatio > 0.2) score += seesHealing ? 12 : -2;
      else score += seesHealing ? 20 : 0;
      const repeatFactor = hpRatio <= config.emergencyHpThreshold ? 0.4 : 1;
      if (recent.at(-1) === 'HEAL') score -= config.repeatedHealPenalty * repeatFactor;
      if (countRecent(recent, 'HEAL') === 2) score -= config.doubleHealPenalty * repeatFactor;
    }
    if (types.has('SHIELD')) {
      if (shieldRatio >= 0.8) score -= 18;
      else if (shieldRatio >= 0.6) score -= 8;
      if (seesStrongAttack) score += 18;
      const repeatFactor = lethalIncoming ? 0.4 : 1;
      if (recent.at(-1) === 'SHIELD') score -= config.repeatedShieldPenalty * repeatFactor;
      if (countRecent(recent, 'SHIELD') === 2) score -= config.doubleShieldPenalty * repeatFactor;
    }
    if (types.has('MANA')) {
      if (bot.gauge <= 50) score += 4;
      else if (bot.gauge >= 100) score -= 16;
      else if (bot.gauge >= 80) score -= 8;
    }
    if (types.has('SWORD') && bot.shield >= 300 && opponent.hp <= 400) score += 15;

    const missChance = maxMatched >= 5 ? config.fiveMatchMissChance : maxMatched === 4 ? config.fourMatchMissChance : 0;
    const highValue = maxMatched >= 4;
    if (highValue && random() < missChance) score *= 0.3;
    return { from, to, score, highValue, maxMatched, primaryType };
  }).sort((a, b) => b.score - a.score);
}

export function selectBotDecision(decisions: BotDecision[], random = Math.random, config: BotConfig = BOT_CONFIG): BotDecision | null {
  if (!decisions.length) return null;
  if (decisions.length === 1) { decisions[0]!.pickTier = 'optimal'; return decisions[0]! }
  const roll = random();
  if (roll < config.bestMoveChance) { decisions[0]!.pickTier = 'optimal'; return decisions[0]! }
  if (roll < config.bestMoveChance + config.topMoveChance) {
    const top = decisions.slice(0, Math.min(5, decisions.length));
    const selected = top[Math.floor(random() * top.length)]!; selected.pickTier = 'top'; return selected;
  }
  const selected = decisions[Math.floor(random() * decisions.length)]!; selected.pickTier = 'random'; return selected;
}

export function chooseBotMove(bot: BattleParticipant, opponent: BattleParticipant, incoming: PendingAttack[], random = Math.random, config: BotConfig = BOT_CONFIG, context: BotEvaluationContext = {}): BotDecision | null {
  return selectBotDecision(evaluateBotMoves(bot, opponent, incoming, random, config, context), random, config);
}

export function botSkillUseChance(opponent: BattleParticipant, isFrenzy: boolean, config: BotConfig = BOT_CONFIG): number {
  let chance = config.skillUseChance;
  if (opponent.shield >= BATTLE_CONFIG.maxShield * 0.6) chance -= 0.2;
  if (opponent.hp <= BATTLE_CONFIG.maxHp * 0.3) chance += 0.15;
  if (isFrenzy) chance += 0.1;
  return Math.max(0.1, Math.min(0.9, chance));
}

export function shouldBotUseSkill(opponent: BattleParticipant, isFrenzy: boolean, random = Math.random, config: BotConfig = BOT_CONFIG): boolean {
  return random() < botSkillUseChance(opponent, isFrenzy, config);
}
