import { describe, expect, it } from 'vitest';
import type { CharacterDefinition, MatchResolution, TileType, UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant } from '../src/battle.js';
import { CharacterRegistry, DEFAULT_LOADOUT, loadCharacterRegistry } from '../src/character-registry.js';
import { ContentRegistry } from '../src/content-registry.js';
import type { AbilityDefinition, EffectDefinition, TriggerType } from '../src/effect-types.js';
import { RuntimeValueStore, type RuntimeValueAddress } from '../src/runtime-values.js';
import { runtimeEffectFixture, RUNTIME_EFFECT_FIXTURE_TYPES } from './fixtures/runtime-effect-coverage.js';

const hooks = { snapshot: () => undefined, event: () => undefined, ended: () => undefined };
const marker: EffectDefinition = { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.triggerCount', operation: 'ADD', value: 1 };

function ability(base: AbilityDefinition, id: string, kind: 'active' | 'support', effects: readonly EffectDefinition[], trigger: TriggerType): AbilityDefinition {
  return { ...structuredClone(base), id, kind, name: id, trigger: { type: trigger }, cost: kind === 'active' ? 0 : 100, cooldownMs: 0, oncePerBattle: false, maxTriggersPerBattle: null, chainLimit: null, conditions: [], effects: structuredClone(effects), enabled: true };
}

function character(base: CharacterDefinition, id: string, combatantSkill: string, supportSkill: string): CharacterDefinition {
  return { ...structuredClone(base), id, name: id, shortName: id, starter: false, defaultSlots: undefined, portraitAsset: '', assets: undefined, combatant: { skillId: combatantSkill }, support: { effectId: supportSkill } };
}

function registry(activeEffects: readonly EffectDefinition[], supportTrigger: TriggerType = 'battle_finished', supportEffects: readonly EffectDefinition[] = [marker]) {
  const production = loadCharacterRegistry(), yuria = production.get('yuria_counter_sword')!, clarice = production.get('clarice_heavy_shield')!;
  const active = ability(production.content.ability(yuria.combatant.skillId), 'coverage_active', 'active', activeEffects.length ? activeEffects : [{ type: 'set_runtime_flag', flag: 'coverage.noop', value: true }], 'active_requested');
  const support = ability(production.content.ability(clarice.support.effectId), 'coverage_support', 'support', supportEffects, supportTrigger);
  const content = new ContentRegistry([...production.content.abilities.values(), active, support], [...production.content.statuses.values()]);
  return new CharacterRegistry([...production.all, character(yuria, 'coverage_actor', active.id, yuria.support.effectId), character(clarice, 'coverage_supporter', clarice.combatant.skillId, support.id)], content);
}

function loadout(): UserLoadout { return { combatantCharacterId: 'coverage_actor', supportCharacterId1: 'coverage_supporter', supportCharacterId2: 'marta_guard_captain', loadoutVersion: 1 } }
function battleFor(value: CharacterRegistry, supportOnOpponent = false) { const a = createParticipant('a', 'a', 'A', false, 1, value.snapshot(loadout())), b = createParticipant('b', 'b', 'B', false, 2, value.snapshot(supportOnOpponent ? loadout() : DEFAULT_LOADOUT)), battle = new Battle([a, b], hooks, Date.now(), 0, 3, value); battle.tick(battle.startsAt); return { a, b, battle } }
function resolution(type: TileType = 'MANA'): MatchResolution { const cells = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]; return { requestId: 'coverage-chain', steps: [{ chain: 1, groups: [{ type, cells }], boardAfterRemoval: Array(49).fill(null), boardAfterFill: Array<TileType>(49).fill('MANA') }], finalBoard: Array<TileType>(49).fill('MANA'), effects: [{ type, amount: 10, matched: 3, chain: 1 }], shuffled: false } }

describe('runtime value store', () => {
  const address = (scope: RuntimeValueAddress['scope'], key: string, owner?: string): RuntimeValueAddress => ({ participantId: 'a', scope, key, ...(scope === 'ABILITY' ? { abilityId: owner } : scope === 'STATUS' ? { statusId: owner } : scope === 'CHAIN' ? { chainId: owner } : {}) });
  it('supports all operations, deterministic snapshots, scoped cleanup, and legacy restore', () => {
    const store = new RuntimeValueStore(['a', 'b']), battle = address('BATTLE', 'counter');
    expect(store.mutate(battle, { operation: 'SET', value: 10 }).nextValue).toBe(10);
    expect(store.mutate(battle, { operation: 'ADD', value: 5 }).nextValue).toBe(15);
    expect(store.mutate(battle, { operation: 'SUBTRACT', value: 3 }).nextValue).toBe(12);
    expect(store.mutate(battle, { operation: 'MIN', value: 8 }).nextValue).toBe(8);
    expect(store.mutate(battle, { operation: 'MAX', value: 11 }).nextValue).toBe(11);
    expect(store.mutate(battle, { operation: 'CLAMP', minimum: 0, maximum: 7 }).nextValue).toBe(7);
    store.mutate(address('ABILITY', 'charge', 'coverage_active'), { operation: 'SET', value: 2 });
    store.mutate(address('STATUS', 'charge', 'damage_reduction'), { operation: 'SET', value: 3 });
    store.mutate(address('CHAIN', 'charge', 'chain-1'), { operation: 'SET', value: 4 });
    const serialized = store.serialize(), restored = new RuntimeValueStore(['a', 'b']); restored.restore(serialized);
    expect(restored.snapshot('a')).toEqual(store.snapshot('a'));
    restored.clearStatus('a', 'damage_reduction'); restored.clearChain('chain-1');
    expect(restored.snapshot('a').statuses).toEqual({}); expect(restored.snapshot('a').chains).toEqual({});
    expect(restored.mutate(battle, { operation: 'CLEAR' }).cleared).toBe(true); restored.restore(undefined); expect(restored.snapshot('a').battle).toEqual({});
  });
  it('rejects missing scope owners, invalid keys, bounds, and non-finite values explicitly', () => {
    const store = new RuntimeValueStore(['a']);
    expect(() => store.read(address('ABILITY', 'key'))).toThrow('RUNTIME_VALUE_ABILITY_REQUIRED');
    expect(() => store.read(address('BATTLE', 'Bad key'))).toThrow('RUNTIME_VALUE_KEY_INVALID');
    expect(() => store.mutate(address('BATTLE', 'key'), { operation: 'SET', value: Number.NaN })).toThrow('RUNTIME_VALUE_NON_FINITE');
    expect(() => store.mutate(address('BATTLE', 'key'), { operation: 'CLAMP', minimum: 2, maximum: 1 })).toThrow('RUNTIME_VALUE_BOUNDS_INVALID');
  });
});

describe('runtime effect and trigger coverage', () => {
  it('executes the seven coverage effects and persists result-derived values', () => {
    expect(RUNTIME_EFFECT_FIXTURE_TYPES).toHaveLength(7);
    const { a, battle } = battleFor(registry(runtimeEffectFixture)); a.shield = 20;
    expect(battle.useSkill('a', 'coverage')).toBe(true);
    const runtime = battle.snapshotFor('a').self.effectRuntime!;
    expect(a.shield).toBe(8); expect(a.gauge).toBe(9); expect(runtime.runtimeFlags).toEqual({}); expect(runtime.statuses).toEqual([]);
    expect(runtime.runtimeValues.battle).toMatchObject({ 'coverage.consumed': 12, 'coverage.removed': 1, 'coverage.mana': 9, 'coverage.flagSet': 1, 'coverage.flagCleared': 1 });
    const state = battle.serializeEffectState(), restored = battleFor(registry([])); restored.battle.restoreEffectState(state);
    expect(restored.battle.snapshotFor('a').self.effectRuntime?.runtimeValues).toEqual(runtime.runtimeValues);
    battle.forfeit('a'); restored.battle.forfeit('a');
  });

  it('MODIFY_EVENT changes the shared pre-impact event exactly once and exposes its result', () => {
    const supportEffects: EffectDefinition[] = [{ type: 'modify_event_amount', path: 'damage.currentAmount', operation: 'MULTIPLY', value: 0.5, key: 'modified' }, { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.modified', operation: 'SET', value: { type: 'RESULT_VALUE', resultKey: 'modified', path: 'finalAmount' } }];
    const { b, battle } = battleFor(registry([{ type: 'deal_damage', target: 'opponent', amount: 100, travelMs: 200 }], 'before_attack_impact', supportEffects), true);
    expect(battle.useSkill('a', 'modify')).toBe(true); const attack = battle.pendingAttacks[0]!; battle.tick(attack.arrivesAt - 100); expect(attack.damage).toBe(50); battle.tick(attack.arrivesAt); expect(b.hp).toBe(950);
    expect(battle.snapshotFor('b').self.effectRuntime?.runtimeValues.battle['coverage.modified']).toBe(50); battle.forfeit('a');
  });

  const cases: Array<{ trigger: TriggerType; effects: EffectDefinition[]; act(value: ReturnType<typeof battleFor>): void }> = [
    { trigger: 'active_requested', effects: [], act: ({ battle }) => { battle.useSkill('a', 'active') } },
    { trigger: 'chain_step_resolved', effects: [], act: ({ a, battle }) => { battle.finalizeResolution(a, resolution()) } },
    { trigger: 'after_shield_gain', effects: [{ type: 'gain_shield', target: 'self', amount: 10 }], act: ({ battle }) => { battle.useSkill('a', 'shield') } },
    { trigger: 'after_heal', effects: [{ type: 'heal', target: 'self', amount: 10 }], act: ({ a, battle }) => { a.hp -= 20; battle.useSkill('a', 'heal') } },
    { trigger: 'status_applied', effects: [{ type: 'apply_status', target: 'self', statusId: 'damage_reduction', durationMs: 5_000 }], act: ({ battle }) => { battle.useSkill('a', 'status-applied') } },
    { trigger: 'status_expired', effects: [{ type: 'apply_status', target: 'self', statusId: 'damage_reduction', durationMs: 5_000 }, { type: 'remove_status', target: 'self', statusId: 'damage_reduction' }], act: ({ battle }) => { battle.useSkill('a', 'status-removed') } },
  ];

  for (const value of cases) it(`dispatches ${value.trigger} once with recursion protection`, () => {
    const supportEffects: EffectDefinition[] = value.trigger === 'after_shield_gain' ? [marker, { type: 'gain_shield', target: 'self', amount: 1 }] : value.trigger === 'after_heal' ? [marker, { type: 'heal', target: 'self', amount: 1 }] : value.trigger === 'status_applied' ? [marker, { type: 'apply_status', target: 'self', statusId: 'damage_reduction', durationMs: 5_000 }] : [marker];
    const opponentObserver = value.trigger === 'after_shield_gain';
    const current = battleFor(registry(value.effects, value.trigger, supportEffects), opponentObserver); value.act(current);
    const observerId = opponentObserver ? 'b' : 'a';
    const runtime = current.battle.snapshotFor(observerId).self.effectRuntime!;
    expect(runtime.runtimeValues.battle['coverage.triggerCount']).toBe(1);
    expect(runtime.abilities[1]?.triggersUsed).toBe(1);
    if (opponentObserver) expect(current.battle.snapshotFor('a').self.effectRuntime?.runtimeValues.battle['coverage.triggerCount']).toBeUndefined();
    current.battle.forfeit('a');
  });
});
