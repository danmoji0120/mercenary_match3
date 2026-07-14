import { describe, expect, it } from 'vitest';
import type { CombatEvent, MatchResolution, TileType, UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant, type BattleHooks } from '../src/battle.js';
import { loadCharacterRegistry } from '../src/character-registry.js';

const registry = loadCharacterRegistry();
const starterSupports = ['marta_guard_captain', 'evelyn_trauma_stitcher'] as const;

function loadout(combatantCharacterId: string, supportCharacterId1 = starterSupports[0], supportCharacterId2 = starterSupports[1]): UserLoadout {
  return { combatantCharacterId, supportCharacterId1, supportCharacterId2, loadoutVersion: 1 };
}

function make(aLoadout: UserLoadout, bLoadout: UserLoadout, events: CombatEvent[] = []) {
  const hooks: BattleHooks = {
    snapshot: () => undefined,
    event: (_playerId, name, value) => { if (name === 'combatEvent') events.push(value as CombatEvent); },
    ended: () => undefined,
  };
  const a = createParticipant('a', 'a', 'A', false, 11, registry.snapshot(aLoadout));
  const b = createParticipant('b', 'b', 'B', false, 12, registry.snapshot(bLoadout));
  const battle = new Battle([a, b], hooks, Date.now(), 0, 13, registry);
  battle.tick(battle.startsAt);
  return { a, b, battle };
}

function use(battle: Battle, participantId: string) {
  const participant = battle.player(participantId)!;
  participant.gauge = 100;
  expect(battle.useSkill(participantId, `representative-${participantId}`)).toBe(true);
}

function addStatus(battle: Battle, statusId: string, sourceParticipantId: string, targetParticipantId: string, instanceId: string) {
  const state = battle.serializeEffectState();
  state.statuses.push({ instanceId, statusId, sourceParticipantId, targetParticipantId, stackCount: 1, expiresAt: Date.now() + 60_000 });
  battle.restoreEffectState(state);
}

function healResolution(amount: number): MatchResolution {
  const cells = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }];
  return {
    requestId: 'representative-heal',
    steps: [{ chain: 1, groups: [{ type: 'HEAL', cells }], boardAfterRemoval: Array(49).fill(null), boardAfterFill: Array<TileType>(49).fill('MANA') }],
    finalBoard: Array<TileType>(49).fill('MANA'), effects: [{ type: 'HEAL', amount, matched: 3, chain: 1 }], shuffled: false,
  };
}

describe('Representative Character Import 0.4 runtime integration', () => {
  it('routes ACTIVE_USED only to the active owner support', () => {
    const { a, battle } = make(
      loadout('mountain_gunner_berka', 'reality_leak_knight_morgan'),
      loadout('apprentice_shieldbearer_riel'),
    );
    use(battle, 'b');
    expect(a.shield).toBe(0);
    expect(battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0);
    use(battle, 'a');
    expect(a.shield).toBe(48);
    expect(battle.pendingAttacks.at(-1)?.damage).toBe(175);
    expect(battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    battle.forfeit('a');
  });

  it('routes SHIELD_GAINED to the enemy observer and preserves support origin metadata', () => {
    const events: CombatEvent[] = [];
    const { a, b, battle } = make(
      loadout('mountain_gunner_berka', 'fortress_breaker_camilla'),
      loadout('apprentice_shieldbearer_riel'),
      events,
    );
    use(battle, 'b');
    expect(b.shield).toBe(115);
    expect(a.shield).toBe(0);
    expect(battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    const triggered = events.find((event) => event.type === 'ABILITY_TRIGGERED' && event.abilityId === 'fortress_breaker_camilla_support');
    expect(triggered).toMatchObject({ participantId: 'a', origin: { sourceCharacterId: 'fortress_breaker_camilla', sourceAbilityId: 'fortress_breaker_camilla_support', originType: 'SUPPORT_ABILITY', rootEventId: expect.any(String), parentEventId: expect.any(String) } });
    battle.forfeit('a');
  });

  it('does not let Camilla react to shield gained by her own side', () => {
    const { a, battle } = make(
      loadout('apprentice_shieldbearer_riel', 'fortress_breaker_camilla'),
      loadout('mountain_gunner_berka'),
    );
    use(battle, 'a');
    expect(a.shield).toBe(170);
    expect(battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(0);
    battle.forfeit('a');
  });

  it('uses canonical REMOVE_STATUS tag filters and resultKey values for Nox damage', () => {
    const { b, battle } = make(loadout('void_cleaner_nox'), loadout('mountain_gunner_berka', 'evelyn_trauma_stitcher', 'eda_curse_appraiser'));
    addStatus(battle, 'healing_reduction', 'b', 'a', 'nox-self-debuff');
    addStatus(battle, 'emergency_guard', 'b', 'b', 'nox-enemy-buff');
    use(battle, 'a');
    expect(battle.pendingAttacks[0]?.damage).toBe(215);
    expect(battle.snapshotFor('a').self.effectRuntime?.statuses).toHaveLength(0);
    expect(battle.snapshotFor('b').self.effectRuntime?.statuses).toHaveLength(0);
    battle.tick(battle.pendingAttacks[0]!.arrivesAt);
    expect(b.hp).toBe(b.maxHp - 215);
    battle.forfeit('a');
  });

  it('lets Nox observe an enemy status removal, gain 9 mana, and snapshot it', () => {
    const { a, battle } = make(
      loadout('mountain_gunner_berka', 'void_cleaner_nox'),
      loadout('failed_saint_noael'),
    );
    addStatus(battle, 'healing_reduction', 'a', 'b', 'nox-observed-debuff');
    use(battle, 'b');
    expect(a.gauge).toBe(9);
    expect(battle.snapshotFor('a').self.effectRuntime?.supportAbilities[0]).toMatchObject({ id: 'void_cleaner_nox_support' });
    expect(battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    const state = battle.serializeRuntimeState();
    expect(state.players.find((player) => player.id === 'a')?.gauge).toBe(9);
    expect(state.effectState.abilities.find(([participantId]) => participantId === 'a')?.[1][1]?.triggersUsed).toBe(1);
    battle.forfeit('a');
  });

  it('preserves Noael active values and the 5-second 0.8 aftereffect support status', () => {
    const active = make(loadout('failed_saint_noael'), loadout('mountain_gunner_berka'));
    active.a.hp = active.a.maxHp - 80;
    use(active.battle, 'a');
    expect(active.a.hp).toBe(active.a.maxHp);
    expect(active.a.shield).toBe(130);
    expect(active.battle.snapshotFor('a').self.effectRuntime?.statuses).toHaveLength(0);
    active.battle.forfeit('a');

    const support = make(loadout('yuria_counter_sword', 'failed_saint_noael'), loadout('mountain_gunner_berka'));
    support.a.hp = 300;
    use(support.battle, 'b');
    support.battle.tick(support.battle.pendingAttacks[0]!.arrivesAt);
    expect(support.a.hp).toBe(300);
    expect(support.battle.snapshotFor('a').self.effectRuntime?.statuses).toContainEqual(expect.objectContaining({ id: 'noael_aftereffect', stackCount: 1 }));
    support.a.hp = 200;
    support.battle.finalizeResolution(support.a, healResolution(100));
    // A three-tile heal has canonical raw value 35; the 0.8 received-healing modifier yields 28.
    expect(support.a.hp).toBe(228);
    expect(support.battle.snapshotFor('a').self.effectRuntime?.abilities[1]?.triggersUsed).toBe(1);
    support.battle.forfeit('a');
  });
});
