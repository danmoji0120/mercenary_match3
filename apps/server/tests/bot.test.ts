import { describe, expect, it } from 'vitest';
import { SeededRandom, findMatches, listLegalSwaps, swapTiles, type PendingAttack, type TileType } from '@mercenary/shared';
import { botSkillUseChance, chooseBotMove, evaluateBotMoves, selectBotDecision, shouldBotUseSkill, type BotDecision } from '../src/bot';
import { BOT_CONFIG, botActionDelay, botDefenseDelay, botSkillDelay, validateBotConfig } from '../src/bot-config';
import { createParticipant } from '../src/battle';

const decision = (score: number): BotDecision => ({ from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, score, highValue: false, maxMatched: 3, primaryType: 'SWORD' });
const sequence = (...values: number[]) => { let index = 0; return () => values[index++] ?? values.at(-1) ?? 0 };
const hasType = (bot: ReturnType<typeof createParticipant>, move: BotDecision, type: TileType) => findMatches(swapTiles(bot.board.tiles, move.from, move.to)).some((group) => group.type === type);
const bestTypeScore = (bot: ReturnType<typeof createParticipant>, moves: BotDecision[], type: TileType) => Math.max(...moves.filter((move) => hasType(bot, move, type)).map((move) => move.score));

function findScenario(type: TileType, exactLength?: number) {
  for (let seed = 1; seed < 8_000; seed++) {
    const bot = createParticipant('bot', 'bot', 'Bot', true, seed);
    if (listLegalSwaps(bot.board.tiles).some(([a, b]) => findMatches(swapTiles(bot.board.tiles, a, b)).some((group) => group.type === type && (exactLength === undefined || group.cells.length === exactLength)))) return bot;
  }
  throw new Error('scenario not found');
}

describe('bot configuration', () => {
  it('uses the slower timing ranges', () => { expect(botActionDelay(true, () => 0)).toBe(2_200); expect(botActionDelay(true, () => 0.999999)).toBe(3_400); expect(botActionDelay(false, () => 0)).toBe(1_800); expect(botActionDelay(false, () => 0.999999)).toBe(2_900); expect(botSkillDelay(() => 0)).toBe(1_000); expect(botSkillDelay(() => 0.999999)).toBe(1_800); expect(botDefenseDelay(() => 0)).toBe(900); expect(botDefenseDelay(() => 0.999999)).toBe(1_600) });
  it('requires move probabilities to total exactly one', () => { expect(BOT_CONFIG.bestMoveChance + BOT_CONFIG.topMoveChance + BOT_CONFIG.randomMoveChance).toBe(1); expect(() => validateBotConfig({ ...BOT_CONFIG, randomMoveChance: 0.3 })).toThrow(/total/) });
  it('rejects invalid probabilities and delay ranges', () => { expect(() => validateBotConfig({ ...BOT_CONFIG, skillUseChance: 2 })).toThrow(/probability/); expect(() => validateBotConfig({ ...BOT_CONFIG, actionDelayMinMs: 3_000 })).toThrow(/delay/) });
});

describe('bot move selection', () => {
  const ranked = [decision(50), decision(40), decision(30), decision(20), decision(10), decision(1)];
  it('selects the best candidate in the 30% branch', () => expect(selectBotDecision(ranked, () => 0.1)).toBe(ranked[0]));
  it('selects among available top candidates in the next 30%', () => { expect(selectBotDecision(ranked, sequence(0.4, 0.8))).toBe(ranked[4]); const two = ranked.slice(0, 2); expect(selectBotDecision(two, sequence(0.4, 0.99))).toBe(two[1]) });
  it('selects any legal candidate in the final 40%', () => expect(selectBotDecision(ranked, sequence(0.9, 0.99))).toBe(ranked[5]));
  it('handles a single candidate', () => expect(selectBotDecision([ranked[3]!], () => 0.99)).toBe(ranked[3]));
  it('does not always select the highest score', () => { const choices = [selectBotDecision(ranked, sequence(0.1)), selectBotDecision(ranked, sequence(0.4, 0.8)), selectBotDecision(ranked, sequence(0.9, 0.99))]; expect(new Set(choices).size).toBe(3) });
  it('only chooses legal swaps and is reproducible with a seed', () => { const bot = createParticipant('bot', 'b', 'Bot', true, 22), foe = createParticipant('foe', 'f', 'Foe', false, 23); const a = new SeededRandom(77), b = new SeededRandom(77); const first = chooseBotMove(bot, foe, [], () => a.next())!; const second = chooseBotMove(bot, foe, [], () => b.next())!; expect(first).toEqual(second); expect(listLegalSwaps(bot.board.tiles).some(([from, to]) => JSON.stringify([from, to]) === JSON.stringify([first.from, first.to]))).toBe(true) });
});

describe('high-value move misses', () => {
  it.each([[4, 'fourMatchMissChance'], [5, 'fiveMatchMissChance']] as const)('can miss a %i-match without deleting legal candidates', (length, key) => {
    const bot = findScenario('SWORD', length), foe = createParticipant('foe', 'f', 'Foe', false, 8);
    const aware = evaluateBotMoves(bot, foe, [], () => 0, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 });
    const missed = evaluateBotMoves(bot, foe, [], () => 0, { ...BOT_CONFIG, [key]: 1 });
    const high = aware.find((move) => move.maxMatched === length)!; const degraded = missed.find((move) => JSON.stringify([move.from, move.to]) === JSON.stringify([high.from, high.to]))!;
    expect(degraded.score).toBeLessThan(high.score); expect(missed).toHaveLength(aware.length); expect(selectBotDecision(missed, () => 0.99)).not.toBeNull();
  });
});

describe('survival and mana scoring', () => {
  it('does not force healing above 70% and can miss it below 40%', () => { const bot = findScenario('HEAL'), foe = createParticipant('foe', 'f', 'Foe', false, 2); bot.hp = 800; const healthy = evaluateBotMoves(bot, foe, [], () => 0.99, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); bot.hp = 350; const aware = evaluateBotMoves(bot, foe, [], () => 0, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); const unaware = evaluateBotMoves(bot, foe, [], () => 0.99, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); expect(bestTypeScore(bot, aware, 'HEAL')).toBeGreaterThan(bestTypeScore(bot, unaware, 'HEAL')); expect(bestTypeScore(bot, healthy, 'HEAL')).toBeLessThan(bestTypeScore(bot, aware, 'HEAL')); const nonHealIndex = unaware.findIndex((move) => move.primaryType !== 'HEAL'); expect(nonHealIndex).toBeGreaterThanOrEqual(0); expect(selectBotDecision(unaware, sequence(0.9, (nonHealIndex + 0.1) / unaware.length))?.primaryType).not.toBe('HEAL') });
  it('raises critical healing but still passes through final selection', () => { const bot = findScenario('HEAL'), foe = createParticipant('foe', 'f', 'Foe', false, 2); bot.hp = 150; const aware = evaluateBotMoves(bot, foe, [], () => 0, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); const unaware = evaluateBotMoves(bot, foe, [], () => 0.99, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); expect(bestTypeScore(bot, aware, 'HEAL')).toBeGreaterThan(bestTypeScore(bot, unaware, 'HEAL')); expect(selectBotDecision(aware, sequence(0.9, 0.99))).not.toBeNull() });
  it('penalizes repeated healing and relaxes it in emergency', () => { const bot = findScenario('HEAL'), foe = createParticipant('foe', 'f', 'Foe', false, 2); bot.hp = 300; const none = evaluateBotMoves(bot, foe, [], () => 0, BOT_CONFIG, { recentActions: [] }); const once = evaluateBotMoves(bot, foe, [], () => 0, BOT_CONFIG, { recentActions: ['HEAL'] }); const twice = evaluateBotMoves(bot, foe, [], () => 0, BOT_CONFIG, { recentActions: ['HEAL', 'HEAL'] }); expect(bestTypeScore(bot, once, 'HEAL')).toBeLessThan(bestTypeScore(bot, none, 'HEAL')); expect(bestTypeScore(bot, twice, 'HEAL')).toBeLessThan(bestTypeScore(bot, once, 'HEAL')); bot.hp = 100; const emergency = evaluateBotMoves(bot, foe, [], () => 0, BOT_CONFIG, { recentActions: ['HEAL', 'HEAL'] }); expect(bestTypeScore(bot, emergency, 'HEAL')).toBeGreaterThan(bestTypeScore(bot, twice, 'HEAL')) });
  it('reduces shield scoring at 60% and further at 80%', () => { const bot = findScenario('SHIELD'), foe = createParticipant('foe', 'f', 'Foe', false, 2); bot.shield = 0; const low = evaluateBotMoves(bot, foe, [], () => 0.99); bot.shield = 300; const medium = evaluateBotMoves(bot, foe, [], () => 0.99); bot.shield = 400; const high = evaluateBotMoves(bot, foe, [], () => 0.99); expect(bestTypeScore(bot, medium, 'SHIELD')).toBeLessThan(bestTypeScore(bot, low, 'SHIELD')); expect(bestTypeScore(bot, high, 'SHIELD')).toBeLessThan(bestTypeScore(bot, medium, 'SHIELD')) });
  it('can miss strong attacks and does not boost small attacks', () => { const bot = findScenario('SHIELD'), foe = createParticipant('foe', 'f', 'Foe', false, 2); const strong: PendingAttack[] = [{ id: 'a', sourceId: 'foe', targetId: 'bot', damage: 170, kind: 'SWORD', createdAt: 1, arrivesAt: 2 }], small = [{ ...strong[0]!, damage: 70 }]; const sees = evaluateBotMoves(bot, foe, strong, () => 0, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); const misses = evaluateBotMoves(bot, foe, strong, () => 0.99, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); const seesSmall = evaluateBotMoves(bot, foe, small, () => 0, { ...BOT_CONFIG, fourMatchMissChance: 0, fiveMatchMissChance: 0 }); expect(bestTypeScore(bot, sees, 'SHIELD')).toBeGreaterThan(bestTypeScore(bot, misses, 'SHIELD')); expect(bestTypeScore(bot, seesSmall, 'SHIELD')).toBe(bestTypeScore(bot, misses, 'SHIELD')) });
  it('penalizes repeated shields and relaxes on lethal danger', () => { const bot = findScenario('SHIELD'), foe = createParticipant('foe', 'f', 'Foe', false, 2); bot.hp = 300; const none = evaluateBotMoves(bot, foe, [], () => 0.99, BOT_CONFIG, { recentActions: [] }); const twice = evaluateBotMoves(bot, foe, [], () => 0.99, BOT_CONFIG, { recentActions: ['SHIELD', 'SHIELD'] }); const lethal: PendingAttack[] = [{ id: 'x', sourceId: 'foe', targetId: 'bot', damage: 500, kind: 'SKILL', createdAt: 1, arrivesAt: 2 }]; const emergency = evaluateBotMoves(bot, foe, lethal, () => 0.99, BOT_CONFIG, { recentActions: ['SHIELD', 'SHIELD'] }); expect(bestTypeScore(bot, twice, 'SHIELD')).toBeLessThan(bestTypeScore(bot, none, 'SHIELD')); expect(bestTypeScore(bot, emergency, 'SHIELD')).toBeGreaterThan(bestTypeScore(bot, twice, 'SHIELD')) });
  it('reduces mana scoring at 80 and 100 gauge', () => { const bot = findScenario('MANA'), foe = createParticipant('foe', 'f', 'Foe', false, 2); bot.gauge = 40; const low = evaluateBotMoves(bot, foe, [], () => 0.99); bot.gauge = 80; const high = evaluateBotMoves(bot, foe, [], () => 0.99); bot.gauge = 100; const full = evaluateBotMoves(bot, foe, [], () => 0.99); expect(bestTypeScore(bot, high, 'MANA')).toBeLessThan(bestTypeScore(bot, low, 'MANA')); expect(bestTypeScore(bot, full, 'MANA')).toBeLessThan(bestTypeScore(bot, high, 'MANA')) });
});

describe('skill judgment', () => {
  it('can defer skill use deterministically', () => { const foe = createParticipant('foe', 'f', 'Foe', false, 2); expect(shouldBotUseSkill(foe, false, () => 0.64)).toBe(true); expect(shouldBotUseSkill(foe, false, () => 0.66)).toBe(false) });
  it('uses less often into high shield and more often against low HP or frenzy', () => { const foe = createParticipant('foe', 'f', 'Foe', false, 2); const normal = botSkillUseChance(foe, false); foe.shield = 400; expect(botSkillUseChance(foe, false)).toBeLessThan(normal); foe.shield = 0; foe.hp = 200; expect(botSkillUseChance(foe, false)).toBeGreaterThan(normal); foe.hp = 1000; expect(botSkillUseChance(foe, true)).toBeGreaterThan(normal) });
});
