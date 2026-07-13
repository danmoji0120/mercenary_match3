import { describe, expect, it } from 'vitest';
import type { UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant } from '../src/battle.js';
import { CharacterRegistry, loadCharacterRegistry } from '../src/character-registry.js';
import { ContentRegistry } from '../src/content-registry.js';
import { assertJsonValue, CustomCommandBuilder, CustomHandlerRegistry, type CharacterServerModule, type CustomAbilityHandler } from '../src/custom-ability.js';
import { childOrigin, MAX_EFFECT_GENERATION_DEPTH, supportMayTrigger } from '../src/effect-origin.js';
import { evaluateNumber } from '../src/value-expression.js';
import { generatedAbilityDefinitions, generatedCharacterDefinitions } from './fixtures/generated/character-registry.generated.js';
import { generatedCharacterServerModules } from './fixtures/generated/custom-handler-registry.generated.js';

const hooks = { snapshot: () => undefined, event: () => undefined, ended: () => undefined };
function customRegistry() {
  const production = loadCharacterRegistry();
  const content = new ContentRegistry([...production.content.abilities.values(), ...generatedAbilityDefinitions], [...production.content.statuses.values()]);
  return new CharacterRegistry([...production.all, ...generatedCharacterDefinitions], content, new CustomHandlerRegistry(generatedCharacterServerModules));
}
function loadout(): UserLoadout { return { combatantCharacterId: 'custom_test_character', supportCharacterId1: 'marta_guard_captain', supportCharacterId2: 'evelyn_trauma_stitcher', loadoutVersion: 1 } }

describe('character package runtime extensions', () => {
  it('executes a stateless trusted handler through engine commands and snapshots JSON custom state', () => {
    const registry = customRegistry(), a = createParticipant('a', 'a', 'A', false, 11, registry.snapshot(loadout())), b = createParticipant('b', 'b', 'B', false, 12, registry.snapshot({ ...loadout(), combatantCharacterId: 'yuria_counter_sword' }));
    const battle = new Battle([a, b], hooks, 1_000, 0, 99, registry); battle.tick(battle.startsAt); a.gauge = 100;
    expect(battle.useSkill('a', 'custom-fixture')).toBe(true);
    expect(a.shield).toBe(10); expect(a.gauge).toBe(0);
    expect(battle.snapshotFor('a').self.effectRuntime?.customState).toEqual({ 'custom_test_character.counter': 1 });
    expect(battle.snapshotFor('a').self.effectRuntime?.scheduledEffects[0]?.origin).toMatchObject({ rootEventId: expect.any(String), originType: 'SCHEDULED', generationDepth: 2 });
    const serialized = battle.serializeEffectState();
    const restoredA = createParticipant('a', 'a', 'A', false, 11, registry.snapshot(loadout())), restoredB = createParticipant('b', 'b', 'B', false, 12, registry.snapshot({ ...loadout(), combatantCharacterId: 'yuria_counter_sword' }));
    const restored = new Battle([restoredA, restoredB], hooks, 1_000, 0, 99, registry); restored.restoreEffectState(serialized);
    expect(restored.snapshotFor('a').self.effectRuntime).toEqual(battle.snapshotFor('a').self.effectRuntime);
    const production = loadCharacterRegistry(), incompatible = new Battle([createParticipant('a', 'a', 'A', false, 1, production.snapshot({ ...loadout(), combatantCharacterId: 'yuria_counter_sword' })), createParticipant('b', 'b', 'B', false, 2, production.snapshot({ ...loadout(), combatantCharacterId: 'yuria_counter_sword' }))], hooks, 1_000, 0, 99, production);
    expect(() => incompatible.restoreEffectState(serialized)).toThrow('EFFECT_STATE_CONTENT_MISSING:custom_test_active');
    battle.tick(Date.now() + 1); restored.tick(Date.now() + 1);
    expect(a.gauge).toBe(5); expect(restoredA.gauge).toBe(5);
    battle.forfeit('a'); restored.forfeit('a'); incompatible.forfeit('a');
  });

  it('restores status, cooldown, once flags, and runtime flags without recomputing content', () => {
    const registry = loadCharacterRegistry(), currentLoadout = { ...loadout(), combatantCharacterId: 'clarice_heavy_shield' };
    const a = createParticipant('a', 'a', 'A', false, 1, registry.snapshot(currentLoadout)), b = createParticipant('b', 'b', 'B', false, 2, registry.snapshot({ ...currentLoadout, combatantCharacterId: 'yuria_counter_sword' }));
    const battle = new Battle([a, b], hooks, 2_000, 0, 22, registry); battle.tick(battle.startsAt); a.gauge = 100; battle.useSkill('a', 'clarice');
    const state = battle.serializeEffectState(), support = state.abilities.find(([id]) => id === 'a')?.[1][1];
    if (!support) throw new Error('Fixture support runtime missing');
    support.cooldownEndsAt = 12_345; support.usedThisBattle = true; support.triggersUsed = 1;
    state.flags.find(([id]) => id === 'a')?.[1].push(['fixture.flag', true]);
    const restoredA = createParticipant('a', 'a', 'A', false, 1, registry.snapshot(currentLoadout)), restoredB = createParticipant('b', 'b', 'B', false, 2, registry.snapshot({ ...currentLoadout, combatantCharacterId: 'yuria_counter_sword' }));
    const restored = new Battle([restoredA, restoredB], hooks, 2_000, 0, 22, registry); restored.restoreEffectState(state);
    const snapshot = restored.snapshotFor('a').self.effectRuntime!;
    expect(snapshot.statuses.map((item) => item.id)).toContain('damage_reduction');
    expect(snapshot.abilities[1]).toMatchObject({ cooldownEndsAt: 12_345, usedThisBattle: true, triggersUsed: 1 });
    expect(snapshot.runtimeFlags).toEqual({ 'fixture.flag': true });
    battle.forfeit('a'); restored.forfeit('a');
  });

  it('evaluates structured values deterministically and fails on a runtime zero divisor', () => {
    const self = createParticipant('a', 'a', 'A', false, 1), enemy = createParticipant('b', 'b', 'B', false, 2); self.shield = 20;
    const context = { self, enemy, event: { battleId: 'b', sourceParticipantId: 'a', targetParticipantId: 'b', effectResults: { spent: { consumedAmount: 20 } }, serverTime: 100 } };
    expect(evaluateNumber({ type: 'ADD', values: [{ type: 'CONSTANT', value: 150 }, { type: 'MULTIPLY', values: [{ type: 'RESULT_VALUE', resultKey: 'spent', path: 'consumedAmount' }, { type: 'CONSTANT', value: 1.2 }] }] }, context)).toBe(174);
    expect(evaluateNumber({ type: 'RESOURCE', target: 'SELF', resource: 'HP_RATIO' }, context)).toBe(self.hp / self.maxHp);
    expect(() => evaluateNumber({ type: 'DIVIDE', values: [{ type: 'CONSTANT', value: 1 }, { type: 'RESOURCE', target: 'SELF', resource: 'MANA' }] }, context)).toThrow('VALUE_DIVIDE_BY_ZERO');
  });

  it('rejects duplicate or foreign handlers, promise-like results, and non-JSON state', () => {
    const handler: CustomAbilityHandler = { id: 'fixture.safe', execute: () => ({ commands: [] }) };
    const module: CharacterServerModule = { characterId: 'fixture', handlers: [handler] };
    expect(() => new CustomHandlerRegistry([module, module])).toThrow('CUSTOM_HANDLER_DUPLICATE');
    expect(() => new CustomHandlerRegistry([{ characterId: 'other', handlers: [handler] }])).toThrow('CUSTOM_HANDLER_NAMESPACE');
    const promiseLike: CustomAbilityHandler = { id: 'fixture.async', execute: () => Object.assign({ commands: [] }, { then() { return undefined } }) };
    const registry = new CustomHandlerRegistry([{ characterId: 'fixture', handlers: [promiseLike] }]);
    const actor = createParticipant('a', 'a', 'A'), enemy = createParticipant('b', 'b', 'B');
    expect(() => registry.execute('fixture.async', { actor, enemy, triggeringEvent: { battleId: 'b', sourceParticipantId: 'a', targetParticipantId: 'b', effectResults: {}, serverTime: 1 }, results: {}, runtimeFlags: {}, customState: {}, rng: { next: () => 0, integer: () => 0 }, command: new CustomCommandBuilder() }, null)).toThrow('CUSTOM_HANDLER_ASYNC');
    expect(() => assertJsonValue(new Date())).toThrow('CUSTOM_STATE_NOT_PLAIN');
  });

  it('preserves root metadata while blocking recopy, reconversion, self support, and excess depth', () => {
    const root = { eventId: 'e1', rootEventId: 'e1', sourceCharacterId: 'fixture', sourceAbilityId: 'fixture.support', originType: 'SUPPORT_ABILITY' as const, generationDepth: 0, canTriggerSupport: true, canBeCopied: true, canBeConverted: true };
    expect(supportMayTrigger(root, 'fixture.support')).toBe(false);
    const copied = childOrigin(root, 'e2', 'COPIED'); expect(copied.rootEventId).toBe('e1'); expect(copied.canBeCopied).toBe(false);
    expect(() => childOrigin(copied, 'e3', 'COPIED')).toThrow('EFFECT_RECOPY_BLOCKED');
    const converted = childOrigin(root, 'e4', 'CONVERTED'); expect(() => childOrigin(converted, 'e5', 'CONVERTED')).toThrow('EFFECT_RECONVERT_BLOCKED');
    expect(() => childOrigin({ ...root, generationDepth: MAX_EFFECT_GENERATION_DEPTH }, 'e6', 'SCHEDULED')).toThrow('EFFECT_GENERATION_DEPTH');
  });
});
