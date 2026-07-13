import { describe, expect, it } from 'vitest';
import { LEGACY_DEFAULT_COMBATANT_STATS, applyPercentage, migrateBattleLoadoutSnapshot, resolveCombatantStats } from '../src/index';

describe('character stats runtime', () => {
  it.each([[100, 100, 100], [100, 150, 150], [100, 80, 80], [75, 125, 94], [23, 115, 26], [1, 50, 1], [1, 0, 0]])(
    'applies %i at %i percent as %i',
    (base, percentage, expected) => expect(applyPercentage(base, percentage)).toBe(expected),
  );

  it('rejects invalid and unsafe combat amounts', () => {
    expect(applyPercentage(Number.MAX_SAFE_INTEGER, 1)).toBe(90_071_992_547_410);
    expect(() => applyPercentage(Number.NaN, 100)).toThrow('INVALID_BASE_AMOUNT');
    expect(() => applyPercentage(100, Number.POSITIVE_INFINITY)).toThrow('INVALID_PERCENTAGE');
    expect(() => applyPercentage(Number.MAX_SAFE_INTEGER, 200)).toThrow('COMBAT_AMOUNT_OUT_OF_RANGE');
    expect(() => resolveCombatantStats({ ...LEGACY_DEFAULT_COMBATANT_STATS, maxHp: 0 })).toThrow('INVALID_COMBATANT_STATS');
  });

  it('migrates a legacy loadout with neutral stats without using a registry', () => {
    const legacy = {
      combatant: { characterId: 'legacy', name: 'Legacy', portraitAsset: '/legacy.svg', rarity: 'R' as const },
      supports: [
        { characterId: 'support-a', name: 'A', portraitAsset: '/a.svg', rarity: 'R' as const },
        { characterId: 'support-b', name: 'B', portraitAsset: '/b.svg', rarity: 'R' as const },
      ] as const,
    };
    const migrated = migrateBattleLoadoutSnapshot({ ...legacy, supports: [...legacy.supports] });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.combatant.combatStats).toEqual(LEGACY_DEFAULT_COMBATANT_STATS);
    expect(migrateBattleLoadoutSnapshot(migrated)).toEqual(migrated);
  });

  it('rejects unsupported snapshot versions', () => {
    expect(() => migrateBattleLoadoutSnapshot({ schemaVersion: 99 } as never)).toThrow('UNSUPPORTED_BATTLE_LOADOUT_SNAPSHOT_VERSION');
  });
});
