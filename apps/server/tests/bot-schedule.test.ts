import { afterEach, describe, expect, it, vi } from 'vitest';
import { Battle, createParticipant } from '../src/battle';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() });

describe('bot scheduler', () => {
  it('waits for both initial thinking and skill reaction before firing', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); vi.spyOn(Math, 'random').mockReturnValue(0);
    const human = createParticipant('human', 'h', 'Human', false, 1), bot = createParticipant('bot', 'b', 'Bot', true, 2);
    bot.gauge = 100;
    const battle = new Battle([human, bot], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 3);
    battle.tick(battle.startsAt);
    vi.advanceTimersByTime(2_199); expect(battle.pendingAttacks).toHaveLength(0);
    vi.advanceTimersByTime(1); expect(battle.pendingAttacks).toHaveLength(0);
    vi.advanceTimersByTime(999); expect(battle.pendingAttacks).toHaveLength(0);
    vi.advanceTimersByTime(1); expect(battle.pendingAttacks).toHaveLength(1);
    expect(battle.pendingAttacks[0]?.kind).toBe('SKILL'); battle.forfeit('human');
  });
  it('rechecks gauge after the reaction delay', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); vi.spyOn(Math, 'random').mockReturnValue(0);
    const human = createParticipant('human', 'h', 'Human', false, 1), bot = createParticipant('bot', 'b', 'Bot', true, 2); bot.gauge = 100;
    const battle = new Battle([human, bot], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 3); battle.tick(battle.startsAt);
    vi.advanceTimersByTime(2_200); bot.gauge = 0; vi.advanceTimersByTime(1_000); expect(battle.pendingAttacks).toHaveLength(0); battle.forfeit('human');
  });
  it('keeps only one skill timer for the same full gauge', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); const human = createParticipant('human', 'h', 'Human', false, 1), bot = createParticipant('bot', 'b', 'Bot', true, 2); bot.gauge = 100;
    const battle = new Battle([human, bot], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 3); battle.tick(battle.startsAt); (battle as any).scheduleSkillDecision('bot'); (battle as any).scheduleSkillDecision('bot'); expect((battle as any).botSkillTimers.size).toBe(1); battle.forfeit('human'); expect((battle as any).botSkillTimers.size).toBe(0);
  });
  it('does not move while the board is processing and clears all timers on finish', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); const human = createParticipant('human', 'h', 'Human', false, 1), bot = createParticipant('bot', 'b', 'Bot', true, 2);
    const battle = new Battle([human, bot], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 3); battle.tick(battle.startsAt); bot.board.processing = true; expect((battle as any).performBotMove('bot')).toBe(false); expect(battle.snapshotFor('human').botDiagnostics?.swapActionCount).toBe(0); battle.forfeit('human'); expect((battle as any).botTimers.size).toBe(0);
  });
  it('starts the next think delay after the resolution settle buffer', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); vi.spyOn(Math, 'random').mockReturnValue(0);
    const human = createParticipant('human', 'h', 'Human', false, 1), bot = createParticipant('bot', 'b', 'Bot', true, 2);
    const battle = new Battle([human, bot], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 3); battle.tick(battle.startsAt);
    vi.advanceTimersByTime(2_200); expect(battle.snapshotFor('human').botDiagnostics?.swapActionCount).toBe(1); bot.gauge = 0;
    vi.advanceTimersByTime(2_699); expect(battle.snapshotFor('human').botDiagnostics?.swapActionCount).toBe(1);
    vi.advanceTimersByTime(1); expect(battle.snapshotFor('human').botDiagnostics?.swapActionCount).toBe(2); battle.forfeit('human');
  });
  it('a new battle starts with empty recent-action diagnostics', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01T00:00:00Z')); vi.spyOn(Math, 'random').mockReturnValue(0);
    const first = new Battle([createParticipant('h1', 'h1', 'H', false, 1), createParticipant('bot1', 'b1', 'Bot', true, 2)], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 3); first.tick(first.startsAt); vi.advanceTimersByTime(2_200); expect(first.snapshotFor('h1').botDiagnostics?.recentActions.length).toBeGreaterThan(0); first.forfeit('h1');
    const next = new Battle([createParticipant('h2', 'h2', 'H', false, 4), createParticipant('bot2', 'b2', 'Bot', true, 5)], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 6); expect(next.snapshotFor('h2').botDiagnostics?.recentActions).toEqual([]); next.forfeit('h2');
  });
});
