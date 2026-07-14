import { describe, expect, it } from 'vitest';
import { type MatchResolution, type TileType, type UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant, type BattleHooks } from '../src/battle.js';
import { loadCharacterRegistry } from '../src/character-registry.js';

const registry = loadCharacterRegistry();
const hooks: BattleHooks = { snapshot: () => undefined, event: () => undefined, ended: () => undefined };
let requestSequence = 0;

function loadout(combatantCharacterId: string, supportCharacterId1 = 'evelyn_trauma_stitcher', supportCharacterId2 = 'eda_curse_appraiser'): UserLoadout {
  return { combatantCharacterId, supportCharacterId1, supportCharacterId2, loadoutVersion: 1 };
}

function make(aLoadout: UserLoadout, bLoadout: UserLoadout, battleId?: string) {
  const a = createParticipant('a', 'a', 'A', false, 41, registry.snapshot(aLoadout));
  const b = createParticipant('b', 'b', 'B', false, 42, registry.snapshot(bLoadout));
  const battle = new Battle([a, b], hooks, Date.now(), 0, 43, registry, battleId);
  battle.tick(battle.startsAt);
  return { a, b, battle };
}

function use(battle: Battle, participantId: string) {
  battle.player(participantId)!.gauge = 100;
  requestSequence += 1;
  expect(battle.useSkill(participantId, `r-batch-0.5.2-${requestSequence}`)).toBe(true);
}

function resolution(groups: Array<{ type: TileType; count: number; chain: number }>): MatchResolution {
  const steps = [...new Set(groups.map((group) => group.chain))].map((chain) => ({
    chain,
    groups: groups.filter((group) => group.chain === chain).map((group, groupIndex) => ({ type: group.type, cells: Array.from({ length: group.count }, (_, index) => ({ row: groupIndex, col: index })) })),
    boardAfterRemoval: Array(49).fill(null),
    boardAfterFill: Array<TileType>(49).fill('MANA'),
  }));
  return { requestId: `r-batch-0.5.2-resolution-${requestSequence}`, steps, finalBoard: Array<TileType>(49).fill('MANA'), effects: groups.map((group) => ({ type: group.type, amount: 0, matched: group.count, chain: group.chain })), shuffled: false };
}

describe('R Character Batch Import 0.5.2 runtime fixtures', () => {
  it('applies Mirena shield, persistent reduction, and the pre-impact threshold support', () => {
    const active = make(loadout('bound_shield_mirena'), loadout('sniper_isila'));
    use(active.battle, 'a');
    expect(active.a.shield).toBe(130);
    expect(active.battle.snapshotFor('a').self.effectRuntime?.statuses).toContainEqual(expect.objectContaining({ id: 'r_damage_reduction_20', stackCount: 1 }));
    use(active.battle, 'b'); const reduced = active.battle.pendingAttacks[0]!; active.battle.tick(reduced.arrivesAt);
    expect(active.a.shield).toBe(0); expect(active.a.hp).toBe(active.a.maxHp - 10);
    active.battle.forfeit('a');

    const support = make(loadout('yuria_counter_sword', 'bound_shield_mirena'), loadout('sniper_isila'));
    support.a.shield = 90; use(support.battle, 'b'); const attack = support.battle.pendingAttacks[0]!;
    expect(attack.damage).toBe(175); support.battle.tick(attack.arrivesAt - 100);
    expect(support.a.shield).toBe(140);
    expect(support.battle.snapshotFor('a').self.effectRuntime?.abilities[1]).toMatchObject({ abilityId: 'bound_shield_mirena_support', triggersUsed: 1 });
    support.battle.forfeit('a');
  });

  it('removes one oldest DEBUFF and only heals a living combatant once below 25%', () => {
    const plainHeal = make(loadout('poison_treatment_shez'), loadout('sniper_isila'));
    plainHeal.a.hp = plainHeal.a.maxHp - 200; const plainBefore = plainHeal.a.hp; use(plainHeal.battle, 'a');
    expect(plainHeal.a.hp - plainBefore).toBe(125); plainHeal.battle.forfeit('a');

    const cleanse = make(loadout('poison_treatment_shez'), loadout('ice_lancer_yukira'));
    use(cleanse.battle, 'b'); cleanse.battle.tick(cleanse.battle.pendingAttacks[0]!.arrivesAt);
    expect(cleanse.battle.snapshotFor('a').self.effectRuntime?.statuses.map((status) => status.id)).toContain('r_healing_reduction_25');
    const beforeHeal = cleanse.a.hp; use(cleanse.battle, 'a');
    expect(cleanse.a.hp - beforeHeal).toBe(94);
    expect(cleanse.battle.snapshotFor('a').self.effectRuntime?.statuses.map((status) => status.id)).not.toContain('r_healing_reduction_25');
    cleanse.battle.forfeit('a');

    const threshold = make(loadout('yuria_counter_sword', 'poison_treatment_shez'), loadout('broom_bomber_elma'));
    threshold.a.hp = 300; use(threshold.battle, 'b'); threshold.battle.tick(threshold.battle.pendingAttacks[0]!.arrivesAt);
    expect(threshold.a.hp).toBe(280);
    expect(threshold.battle.snapshotFor('a').self.effectRuntime?.abilities[1]).toMatchObject({ abilityId: 'poison_treatment_shez_support', triggersUsed: 1 });
    threshold.a.hp = 300; use(threshold.battle, 'b'); threshold.battle.tick(threshold.battle.pendingAttacks.at(-1)!.arrivesAt);
    expect(threshold.a.hp).toBe(180);
    expect(threshold.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    threshold.battle.forfeit('a');

    const defeated = make(loadout('yuria_counter_sword', 'poison_treatment_shez'), loadout('broom_bomber_elma'));
    defeated.a.hp = 100; use(defeated.battle, 'b'); defeated.battle.tick(defeated.battle.pendingAttacks[0]!.arrivesAt);
    expect(defeated.a.hp).toBe(0); expect(defeated.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0);
  });

  it('consumes Voidrin next-hit reduction exactly once within its status window', () => {
    const { a, battle } = make(loadout('rift_shield_voidrin'), loadout('sniper_isila'));
    use(battle, 'a'); expect(a.shield).toBe(100);
    use(battle, 'b'); const first = battle.pendingAttacks[0]!; battle.tick(first.arrivesAt);
    expect(a.shield).toBe(0); expect(a.hp).toBe(a.maxHp - 22);
    expect(battle.snapshotFor('a').self.effectRuntime?.statuses.map((status) => status.id)).not.toContain('r_next_incoming_damage_reduction_30');
    use(battle, 'b'); const second = battle.pendingAttacks.at(-1)!; battle.tick(second.arrivesAt);
    expect(a.hp).toBe(a.maxHp - 197);
    battle.forfeit('a');
  });

  it('keeps Yukira damage and five-second healing reduction exact', () => {
    const { b, battle } = make(loadout('ice_lancer_yukira'), loadout('slime_cleanup_lumia'));
    use(battle, 'a'); const attack = battle.pendingAttacks[0]!; expect(attack.damage).toBe(120); battle.tick(attack.arrivesAt);
    expect(b.hp).toBe(b.maxHp - 120);
    expect(battle.snapshotFor('b').self.effectRuntime?.statuses.map((status) => status.id)).toContain('r_healing_reduction_25');
    b.hp = b.maxHp - 200; use(battle, 'b');
    expect(b.hp).toBe(b.maxHp - 110); expect(b.shield).toBe(50);
    battle.forfeit('a');
  });

  it('uses actual healing for Lumia and triggers Elma once per sword chain', () => {
    const active = make(loadout('slime_cleanup_lumia'), loadout('sniper_isila'));
    active.a.hp = active.a.maxHp - 150; use(active.battle, 'a');
    expect(active.a.hp).toBe(active.a.maxHp - 30); expect(active.a.shield).toBe(50); active.battle.forfeit('a');

    const enough = make(loadout('evelyn_trauma_stitcher', 'slime_cleanup_lumia'), loadout('sniper_isila'));
    enough.a.hp = enough.a.maxHp - 120; use(enough.battle, 'a');
    expect(enough.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    expect(enough.battle.stats.a.shieldByAbilityId.slime_cleanup_lumia_support).toBe(35); enough.battle.forfeit('a');
    const short = make(loadout('evelyn_trauma_stitcher', 'slime_cleanup_lumia'), loadout('sniper_isila'));
    short.a.hp = short.a.maxHp - 80; use(short.battle, 'a');
    expect(short.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0);
    expect(short.battle.stats.a.shieldByAbilityId.slime_cleanup_lumia_support).toBeUndefined(); short.battle.forfeit('a');

    const chain = make(loadout('yuria_counter_sword', 'broom_bomber_elma'), loadout('rift_shield_voidrin'));
    chain.battle.finalizeResolution(chain.a, resolution([{ type: 'MANA', count: 3, chain: 1 }, { type: 'SHIELD', count: 3, chain: 2 }, { type: 'SWORD', count: 3, chain: 3 }, { type: 'SWORD', count: 3, chain: 3 }]));
    const supportAttacks = chain.battle.pendingAttacks.filter((attack) => attack.sourceAbilityId === 'broom_bomber_elma_support');
    expect(supportAttacks).toHaveLength(1); expect(supportAttacks[0]?.damage).toBe(32);
    expect(chain.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1); chain.battle.forfeit('a');
  });

  it('keeps Colin active and conditional pre-impact support values exact', () => {
    const active = make(loadout('wagon_escort_colin'), loadout('sniper_isila'));
    use(active.battle, 'a'); expect(active.a.shield).toBe(55); expect(active.battle.pendingAttacks[0]?.damage).toBe(120);
    active.battle.tick(active.battle.pendingAttacks[0]!.arrivesAt); expect(active.b.hp).toBe(active.b.maxHp - 120); active.battle.forfeit('a');

    const support = make(loadout('yuria_counter_sword', 'wagon_escort_colin'), loadout('sniper_isila'));
    support.a.shield = 90; use(support.battle, 'b'); const attack = support.battle.pendingAttacks[0]!; support.battle.tick(attack.arrivesAt - 100);
    expect(support.a.shield).toBe(140); expect(support.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1); support.battle.forfeit('a');
  });

  it('restores status, cooldown, battle limit, and chain limit runtime state', () => {
    const original = make(loadout('rift_shield_voidrin', 'poison_treatment_shez', 'broom_bomber_elma'), loadout('broom_bomber_elma'));
    use(original.battle, 'a'); original.a.shield = 0; original.a.hp = 300;
    use(original.battle, 'b'); original.battle.tick(original.battle.pendingAttacks[0]!.arrivesAt);
    original.battle.finalizeResolution(original.a, resolution([{ type: 'MANA', count: 3, chain: 1 }, { type: 'SHIELD', count: 3, chain: 2 }, { type: 'SWORD', count: 3, chain: 3 }]));
    const state = original.battle.serializeRuntimeState();
    const restored = make(loadout('rift_shield_voidrin', 'poison_treatment_shez', 'broom_bomber_elma'), loadout('broom_bomber_elma'), state.battleId);
    restored.battle.restoreRuntimeState(state);
    expect(restored.battle.snapshotFor('a').self.effectRuntime).toEqual(original.battle.snapshotFor('a').self.effectRuntime);
    expect(restored.battle.serializeRuntimeState()).toEqual(state);
    restored.battle.forfeit('a'); original.battle.forfeit('a');
  });
});
