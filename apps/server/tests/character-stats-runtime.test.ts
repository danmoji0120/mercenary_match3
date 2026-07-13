import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CharacterDefinition, LegacyBattleLoadoutSnapshot, MatchResolution, TileType, UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant, type LegacyBattleRuntimeState } from '../src/battle';
import { CharacterRegistry, DEFAULT_LOADOUT, loadCharacterRegistry } from '../src/character-registry';
import { ContentRegistry } from '../src/content-registry';
import type { AbilityDefinition } from '../src/effect-types';

const fixture = <T>(name: string) => JSON.parse(readFileSync(path.resolve('apps/server/tests/fixtures', name), 'utf8')) as T;
const hooks = { snapshot: () => undefined, event: () => undefined, ended: () => undefined };
const battles: Battle[] = [];
const loadout = (combatantCharacterId: string): UserLoadout => ({ combatantCharacterId, supportCharacterId1: 'marta_guard_captain', supportCharacterId2: 'evelyn_trauma_stitcher', loadoutVersion: 1 });
const resolution = (type: TileType): MatchResolution => ({ requestId: 'stats', steps: [{ chain: 1, groups: [{ type, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] }], boardAfterRemoval: Array(49).fill(null), boardAfterFill: Array<TileType>(49).fill('MANA') }], finalBoard: Array<TileType>(49).fill('MANA'), effects: [{ type, amount: 0, matched: 3, chain: 1 }], shuffled: false });

function registryWithFixture(): CharacterRegistry {
  const production = loadCharacterRegistry();
  return new CharacterRegistry([...production.all, fixture<CharacterDefinition>('test_generic_squire.character.json')], new ContentRegistry([...production.content.abilities.values(), fixture<AbilityDefinition>('test_generic_strike.ability.json'), fixture<AbilityDefinition>('test_generic_mana_support.ability.json')], [...production.content.statuses.values()]));
}

function createFixtureBattle(registry: CharacterRegistry, battleId?: string): Battle {
  const battle = new Battle([
    createParticipant('a', 'a', 'A', false, 1, registry.snapshot(loadout('test_generic_squire'))),
    createParticipant('b', 'b', 'B', false, 2, registry.snapshot(DEFAULT_LOADOUT)),
  ], hooks, 1_000, 0, 9, registry, battleId);
  battle.tick(battle.startsAt); battles.push(battle); return battle;
}

afterEach(() => { for (const battle of battles.splice(0)) if (battle.phase !== 'FINISHED') battle.forfeit('a') });

describe('battle combat stat snapshots', () => {
  it('restores non-neutral stats, effect state and RNG without consulting changed registry stats', () => {
    const registry = registryWithFixture(), original = createFixtureBattle(registry);
    original.finalizeResolution(original.player('a')!, resolution('SHIELD'));
    original.finalizeResolution(original.player('a')!, resolution('MANA'));
    const saved = original.serializeRuntimeState();
    const changedDefinitions = registry.all.map((character) => character.id === 'test_generic_squire' ? { ...character, stats: { maxHp: 9999, swordEffectPct: 999, shieldEffectPct: 999, healEffectPct: 999, manaGainPct: 999 } } : character);
    const changedRegistry = new CharacterRegistry(changedDefinitions, registry.content);
    const restored = createFixtureBattle(changedRegistry, saved.battleId);
    restored.restoreRuntimeState(saved);
    expect(restored.player('a')).toMatchObject({ hp: 1234, maxHp: 1234, shield: 52, gauge: 12, combatStats: { maxHp: 1234, swordEffectPct: 150, shieldEffectPct: 80, healEffectPct: 125, manaGainPct: 60 } });
    original.finalizeResolution(original.player('a')!, resolution('SHIELD'));
    restored.finalizeResolution(restored.player('a')!, resolution('SHIELD'));
    expect(restored.serializeRuntimeState()).toEqual(original.serializeRuntimeState());
  });

  it('migrates a version-one runtime snapshot to neutral stats instead of current registry stats', () => {
    const registry = registryWithFixture(), source = createFixtureBattle(registry), saved = source.serializeRuntimeState();
    const players = saved.players.map((player) => {
      const current = player.battleLoadout.combatant;
      const combatant = { characterId: current.characterId, name: current.name, portraitAsset: current.portraitAsset, rarity: current.rarity };
      const battleLoadout: LegacyBattleLoadoutSnapshot = { combatant, supports: player.battleLoadout.supports };
      return { id: player.id, hp: Math.min(1_000, player.hp), shield: player.shield, gauge: player.gauge, board: player.board, battleLoadout };
    });
    const legacy: LegacyBattleRuntimeState = { ...saved, schemaVersion: 1, players };
    const restoredPlayers = players.map((player, index) => createParticipant(player.id, player.id, player.id.toUpperCase(), false, index + 10, player.battleLoadout)) as [ReturnType<typeof createParticipant>, ReturnType<typeof createParticipant>];
    const restored = new Battle(restoredPlayers, hooks, 1_000, 0, 9, registry, saved.battleId); battles.push(restored);
    restored.restoreRuntimeState(legacy);
    expect(restored.player('a')).toMatchObject({ hp: 1000, maxHp: 1000, combatStats: { maxHp: 1000, swordEffectPct: 100, shieldEffectPct: 100, healEffectPct: 100, manaGainPct: 100 } });
    expect(restored.serializeRuntimeState().players[0]?.battleLoadout.schemaVersion).toBe(2);
  });
});
