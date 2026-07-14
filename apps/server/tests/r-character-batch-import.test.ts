import { describe, expect, it } from 'vitest';
import { effectFor, type MatchResolution, type TileType, type UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant, type BattleHooks } from '../src/battle.js';
import { loadCharacterRegistry } from '../src/character-registry.js';

const registry = loadCharacterRegistry();
const hooks: BattleHooks = { snapshot: () => undefined, event: () => undefined, ended: () => undefined };

function loadout(combatantCharacterId: string, supportCharacterId1 = 'evelyn_trauma_stitcher', supportCharacterId2 = 'eda_curse_appraiser'): UserLoadout {
  return { combatantCharacterId, supportCharacterId1, supportCharacterId2, loadoutVersion: 1 };
}

function make(aLoadout: UserLoadout, bLoadout: UserLoadout, battleId?: string) {
  const a = createParticipant('a', 'a', 'A', false, 31, registry.snapshot(aLoadout));
  const b = createParticipant('b', 'b', 'B', false, 32, registry.snapshot(bLoadout));
  const battle = new Battle([a, b], hooks, Date.now(), 0, 33, registry, battleId);
  battle.tick(battle.startsAt);
  return { a, b, battle };
}

function use(battle: Battle, participantId: string) {
  battle.player(participantId)!.gauge = 100;
  expect(battle.useSkill(participantId, `r-batch-${participantId}`)).toBe(true);
}

function resolution(groups: Array<{ type: TileType; count: number; chain: number }>): MatchResolution {
  const steps = [...new Set(groups.map((group) => group.chain))].map((chain) => {
    const chainGroups = groups.filter((group) => group.chain === chain).map((group, groupIndex) => ({ type: group.type, cells: Array.from({ length: group.count }, (_, index) => ({ row: groupIndex, col: index })) }));
    return { chain, groups: chainGroups, boardAfterRemoval: Array(49).fill(null), boardAfterFill: Array<TileType>(49).fill('MANA') };
  });
  return { requestId: 'r-batch-resolution', steps, finalBoard: Array<TileType>(49).fill('MANA'), effects: groups.map((group) => ({ type: group.type, amount: 0, matched: group.count, chain: group.chain })), shuffled: false };
}

describe('R Character Batch Import 0.5.1 runtime fixtures', () => {
  it('uses pre-incoming damage.currentAmount for Eira and preserves its 10-second cooldown', () => {
    const { a, battle } = make(loadout('yuria_counter_sword', 'defense_module_eira'), loadout('sniper_isila'));
    a.shield = 90; use(battle, 'b');
    const attack = battle.pendingAttacks[0]!; expect(attack.damage).toBe(175);
    battle.tick(attack.arrivesAt - 100);
    expect(a.shield).toBe(140);
    const runtime = battle.snapshotFor('a').self.effectRuntime!.abilities[1]!;
    expect(runtime).toMatchObject({ abilityId: 'defense_module_eira_support', triggersUsed: 1 });
    expect(runtime.cooldownEndsAt).toBeGreaterThan(attack.createdAt + 9_000);
    battle.forfeit('a');

    const belowThreshold = make(loadout('yuria_counter_sword', 'defense_module_eira'), loadout('feather_sniper_erika'));
    belowThreshold.a.shield = 90; use(belowThreshold.battle, 'b');
    const weakerAttack = belowThreshold.battle.pendingAttacks[0]!; expect(weakerAttack.damage).toBe(145);
    belowThreshold.battle.tick(weakerAttack.arrivesAt - 100);
    expect(belowThreshold.a.shield).toBe(90);
    expect(belowThreshold.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0);
    belowThreshold.battle.forfeit('a');
  });

  it('applies Uniel shield and consumes exactly one 30% next-hit reduction', () => {
    const { a, battle } = make(loadout('shield_assistant_uniel'), loadout('sniper_isila'));
    use(battle, 'a'); expect(a.shield).toBe(100);
    expect(battle.snapshotFor('a').self.effectRuntime?.statuses).toContainEqual(expect.objectContaining({ id: 'r_next_incoming_damage_reduction_30', stackCount: 1 }));
    use(battle, 'b'); const attack = battle.pendingAttacks[0]!; battle.tick(attack.arrivesAt);
    expect(a.shield).toBe(0); expect(a.hp).toBe(a.maxHp - 22);
    expect(battle.snapshotFor('a').self.effectRuntime?.statuses.map((status) => status.id)).not.toContain('r_next_incoming_damage_reduction_30');
    battle.forfeit('a');
  });

  it('keeps Nyara damage, 25% healing reduction, and four-mana-match bonus exact', () => {
    const active = make(loadout('spy_nyara'), loadout('repair_core_12'));
    use(active.battle, 'a'); const attack = active.battle.pendingAttacks[0]!; expect(attack.damage).toBe(120); active.battle.tick(attack.arrivesAt);
    expect(active.b.hp).toBe(active.b.maxHp - 120);
    expect(active.battle.snapshotFor('b').self.effectRuntime?.statuses.map((status) => status.id)).toContain('r_healing_reduction_25');
    active.b.hp = active.b.maxHp - 200; use(active.battle, 'b');
    expect(active.b.hp).toBe(active.b.maxHp - 110); expect(active.b.shield).toBe(50);
    active.battle.forfeit('a');

    const support = make(loadout('yuria_counter_sword', 'spy_nyara'), loadout('sniper_isila'));
    support.battle.finalizeResolution(support.a, resolution([{ type: 'MANA', count: 4, chain: 1 }]));
    expect(support.a.gauge).toBe(effectFor('MANA', 4, 1, false) + 9);
    expect(support.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    support.battle.forfeit('a');
  });

  it('applies Corta mana after active cost and observes only owner-side ACTIVE_USED', () => {
    const active = make(loadout('tactical_operator_corta'), loadout('sniper_isila'));
    use(active.battle, 'a'); expect(active.a.gauge).toBe(30); expect(active.a.shield).toBe(65); active.battle.forfeit('a');

    const support = make(loadout('sniper_isila', 'tactical_operator_corta'), loadout('sniper_isila', 'tactical_operator_corta'));
    use(support.battle, 'b'); expect(support.a.gauge).toBe(0); expect(support.b.gauge).toBe(8);
    use(support.battle, 'a'); expect(support.a.gauge).toBe(8);
    expect(support.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    support.battle.forfeit('a');
  });

  it('triggers Isila once for a chain-three sword match and queues exactly 32 damage', () => {
    const { a, battle } = make(loadout('yuria_counter_sword', 'sniper_isila'), loadout('shield_assistant_uniel'));
    battle.finalizeResolution(a, resolution([
      { type: 'MANA', count: 3, chain: 1 }, { type: 'SHIELD', count: 3, chain: 2 },
      { type: 'SWORD', count: 3, chain: 3 }, { type: 'SWORD', count: 3, chain: 3 },
    ]));
    const supportAttacks = battle.pendingAttacks.filter((attack) => attack.sourceAbilityId === 'sniper_isila_support');
    expect(supportAttacks).toHaveLength(1); expect(supportAttacks[0]?.damage).toBe(32);
    expect(battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    battle.forfeit('a');
  });

  it('uses actual healing for Repair Core 12 and applies the persistent 20% reduction', () => {
    const repairActive = make(loadout('repair_core_12'), loadout('sniper_isila'));
    repairActive.a.hp = repairActive.a.maxHp - 150; use(repairActive.battle, 'a');
    expect(repairActive.a.hp).toBe(repairActive.a.maxHp - 30); expect(repairActive.a.shield).toBe(50);
    repairActive.battle.forfeit('a');

    const enough = make(loadout('evelyn_trauma_stitcher', 'repair_core_12'), loadout('sniper_isila'));
    enough.a.hp = enough.a.maxHp - 120; use(enough.battle, 'a'); expect(enough.a.hp).toBe(enough.a.maxHp);
    expect(enough.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    expect(enough.battle.stats.a.shieldByAbilityId.repair_core_12_support).toBe(35); enough.battle.forfeit('a');
    const short = make(loadout('evelyn_trauma_stitcher', 'repair_core_12'), loadout('sniper_isila'));
    short.a.hp = short.a.maxHp - 80; use(short.battle, 'a'); expect(short.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0);
    expect(short.battle.stats.a.shieldByAbilityId.repair_core_12_support).toBeUndefined(); short.battle.forfeit('a');

    const reduction = make(loadout('gatekeeper_brom'), loadout('sniper_isila'));
    use(reduction.battle, 'a'); use(reduction.battle, 'b'); const attack = reduction.battle.pendingAttacks[0]!; reduction.battle.tick(attack.arrivesAt);
    expect(reduction.a.shield).toBe(0); expect(reduction.a.hp).toBe(reduction.a.maxHp - 10);
    expect(reduction.battle.snapshotFor('a').self.effectRuntime?.statuses.map((status) => status.id)).toContain('r_damage_reduction_20');
    reduction.battle.forfeit('a');
  });

  it('routes SHIELD_BROKEN to the broken side and restores status, cooldown, and trigger count', () => {
    const routed = make(loadout('yuria_counter_sword', 'shield_assistant_uniel'), loadout('sniper_isila', 'shield_assistant_uniel'));
    routed.a.shield = 50; use(routed.battle, 'b'); routed.battle.tick(routed.battle.pendingAttacks[0]!.arrivesAt);
    expect(routed.a.shield).toBe(60); expect(routed.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1); expect(routed.battle.snapshotFor('b').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0); routed.battle.forfeit('a');

    const original = make(loadout('shield_assistant_uniel', 'defense_module_eira'), loadout('sniper_isila'));
    use(original.battle, 'a'); original.a.shield = 90; use(original.battle, 'b'); const pending = original.battle.pendingAttacks[0]!; original.battle.tick(pending.arrivesAt - 100);
    const state = original.battle.serializeRuntimeState(), restored = make(loadout('shield_assistant_uniel', 'defense_module_eira'), loadout('sniper_isila'), state.battleId);
    restored.battle.restoreRuntimeState(state);
    expect(restored.battle.snapshotFor('a').self.effectRuntime?.statuses).toEqual(original.battle.snapshotFor('a').self.effectRuntime?.statuses);
    expect(restored.battle.snapshotFor('a').self.effectRuntime?.abilities[1]).toEqual(original.battle.snapshotFor('a').self.effectRuntime?.abilities[1]);
    restored.battle.tick(pending.arrivesAt); original.battle.tick(pending.arrivesAt);
    expect(restored.battle.snapshotFor('a').self).toEqual(original.battle.snapshotFor('a').self);
    restored.battle.forfeit('a'); original.battle.forfeit('a');
  });
});
