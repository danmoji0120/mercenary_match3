import { afterEach, describe, expect, it } from 'vitest';
import { createBattleStats, type MatchResolution, type MatchStep, type TileType } from '@mercenary/shared';
import { Battle, createParticipant } from '../src/battle';

const battles: Battle[] = [];
function make() {
  const events: Array<{ name: string; value: any }> = [];
  const battle = new Battle([createParticipant('a', 'a', 'A', false, 11), createParticipant('b', 'b', 'B', false, 12)], { snapshot: () => undefined, event: (_id, name, value) => events.push({ name, value }), ended: () => undefined }, Date.now(), 0, 13);
  battle.tick(battle.startsAt); battles.push(battle); return { battle, events };
}
afterEach(() => { for (const battle of battles.splice(0)) if (battle.phase !== 'FINISHED') battle.forfeit('a') });

const cells = (count: number, row = 0) => Array.from({ length: count }, (_, col) => ({ row, col }));
function resolution(groups: Array<{ type: TileType; count: number; chain?: number }>): MatchResolution {
  const byChain = new Map<number, MatchStep>();
  for (const group of groups) { const chain = group.chain ?? 1; const step = byChain.get(chain) ?? { chain, groups: [], boardAfterRemoval: Array(49).fill(null), boardAfterFill: Array<TileType>(49).fill('MANA') }; step.groups.push({ type: group.type, cells: cells(group.count, step.groups.length) }); byChain.set(chain, step) }
  return { requestId: `r-${Math.random()}`, steps: [...byChain.values()], finalBoard: Array<TileType>(49).fill('MANA'), effects: groups.map((group) => ({ type: group.type, amount: 0, matched: group.count, chain: group.chain ?? 1 })), shuffled: false };
}
const apply = (battle: Battle, playerId: string, value: MatchResolution) => (battle as any).finalizeResolution(battle.player(playerId), value);

describe('frenzy lifecycle', () => {
  it('starts only at 30 seconds remaining and emits once', () => { const { battle, events } = make(); battle.tick(battle.endsAt - 30_001); expect(battle.isFrenzy).toBe(false); battle.tick(battle.endsAt - 30_000); expect(battle.isFrenzy).toBe(true); battle.tick(battle.endsAt - 20_000); expect(events.filter((event) => event.name === 'frenzyStarted')).toHaveLength(2) });
  it('restores frenzy from a reconnect snapshot without client calculation', () => { const { battle } = make(); const at = battle.endsAt - 30_000; battle.tick(at); const snapshot = battle.snapshotFor('a', at + 1_000); expect(snapshot.frenzy).toMatchObject({ isFrenzy: true, frenzyStartedAt: at, remainingMs: 29_000, attackMultiplier: 1.35, shieldMultiplier: 0.8, healMultiplier: 0.5 }) });
  it('does not start frenzy after the match has ended', () => { const { battle, events } = make(); battle.forfeit('a'); battle.tick(battle.endsAt - 10_000); expect(battle.isFrenzy).toBe(false); expect(events.filter((event) => event.name === 'frenzyStarted')).toHaveLength(0) });
  it('a fresh rematch battle resets frenzy and statistics', () => { const { battle } = make(); battle.tick(battle.endsAt - 30_000); apply(battle, 'a', resolution([{ type: 'SWORD', count: 3 }])); const next = new Battle([createParticipant('a2', 'a2', 'A', false, 1), createParticipant('b2', 'b2', 'B', false, 2)], { snapshot: () => undefined, event: () => undefined, ended: () => undefined }, Date.now(), 0, 4); battles.push(next); expect(next.isFrenzy).toBe(false); expect(next.stats.a2).toEqual(createBattleStats()) });
  it('applies frenzy values to match effects and data-defined skill attacks', () => { const { battle } = make(); battle.tick(battle.endsAt - 30_000); const value = resolution([{ type: 'SWORD', count: 3 }, { type: 'SHIELD', count: 3 }, { type: 'HEAL', count: 3 }, { type: 'MANA', count: 3 }]); battle.player('a')!.hp = 900; apply(battle, 'a', value); expect(value.effects.map((effect) => effect.amount)).toEqual([95, 52, 18, 20]); battle.player('a')!.gauge = 100; battle.useSkill('a', 'skill'); expect(battle.pendingAttacks.at(-1)?.damage).toBe(243) });
});

describe('authoritative battle statistics', () => {
  it('counts separated groups, matched tiles, and maximum chain', () => { const { battle } = make(); apply(battle, 'a', resolution([{ type: 'SWORD', count: 3 }, { type: 'SWORD', count: 4 }, { type: 'SHIELD', count: 3 }, { type: 'HEAL', count: 4, chain: 2 }, { type: 'MANA', count: 5, chain: 2 }])); expect(battle.stats.a).toMatchObject({ swordMatchCount: 2, swordTilesMatched: 7, shieldMatchCount: 1, shieldTilesMatched: 3, healMatchCount: 1, healTilesMatched: 4, manaMatchCount: 1, manaTilesMatched: 5, maxChain: 2 }) });
  it('records only actual shield, healing, and mana gains below caps', () => { const { battle } = make(); const player = battle.player('a')!; player.shield = 490; player.hp = 990; player.gauge = 90; apply(battle, 'a', resolution([{ type: 'SHIELD', count: 5 }, { type: 'HEAL', count: 5 }, { type: 'MANA', count: 5 }])); expect(battle.stats.a).toMatchObject({ shieldGained: 10, healingDone: 10, manaGained: 10 }) });
  it('separates generated, bypass, shield, HP, received, blocked, and pre-impact support shield', () => { const { battle } = make(); battle.player('b')!.shield = 70; battle.player('a')!.gauge = 100; battle.useSkill('a', 'skill'); const attack = battle.pendingAttacks[0]!; battle.tick(attack.arrivesAt); expect(battle.stats.a).toMatchObject({ totalDamageGenerated: 180, shieldDamageDealt: 126, hpDamageDealt: 54, directHpDamageBypass: 54, skillUseCount: 1, attacksQueued: 1 }); expect(battle.stats.b).toMatchObject({ totalDamageReceived: 180, hpDamageReceived: 54, damageBlockedByShield: 126, shieldBreakCount: 0, bonusShieldFromEffects: 75 }) });
  it('counts fully blocked normal attacks and prevents duplicate resolution', () => { const { battle } = make(); battle.player('b')!.shield = 500; apply(battle, 'a', resolution([{ type: 'SWORD', count: 3 }])); const attack = battle.pendingAttacks[0]!; battle.tick(attack.arrivesAt); const frozen = structuredClone(battle.stats.b); battle.tick(attack.arrivesAt + 1); expect(battle.stats.b.attacksFullyBlocked).toBe(1); expect(battle.stats.b).toEqual(frozen) });
  it('freezes final statistics and records explicit end reasons', () => { const { battle } = make(); battle.player('a')!.gauge = 100; battle.useSkill('a', 'late'); battle.forfeit('a', 'DISCONNECT'); const result = battle.result!; const stats = JSON.stringify(result.stats); battle.tick(Date.now() + 999_999); expect(JSON.stringify(result.stats)).toBe(stats); expect(result).toMatchObject({ reason: 'DISCONNECT', endedByDisconnect: true, endedByTimeout: false }) });
  it('records timeout metadata', () => { const { battle } = make(); battle.tick(battle.endsAt); expect(battle.result).toMatchObject({ reason: 'TIMEOUT', endedByTimeout: true, endedByHpZero: false }); expect(battle.result?.matchDurationMs).toBe(120_000) });
});
