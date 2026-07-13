import { LEGACY_DEFAULT_COMBATANT_STATS, resolveCombatantStats } from './character-stats.js';
import type { BattleLoadoutSnapshot, LoadoutCharacterSnapshot } from './types.js';

export interface LegacyBattleLoadoutSnapshot {
  readonly schemaVersion?: 1;
  readonly combatant: LoadoutCharacterSnapshot & { combatStats?: never };
  readonly supports: [LoadoutCharacterSnapshot, LoadoutCharacterSnapshot];
}

/** Migrates only historical neutral battle stats; it never consults the live registry. */
export function migrateBattleLoadoutSnapshot(value: BattleLoadoutSnapshot | LegacyBattleLoadoutSnapshot): BattleLoadoutSnapshot {
  const version = value.schemaVersion ?? 1;
  if (version !== 1 && version !== 2) throw new Error(`UNSUPPORTED_BATTLE_LOADOUT_SNAPSHOT_VERSION:${String(version)}`);
  const combatStats = version === 1 ? LEGACY_DEFAULT_COMBATANT_STATS : resolveCombatantStats(value.combatant.combatStats);
  return {
    schemaVersion: 2,
    combatant: Object.freeze({ ...value.combatant, combatStats: Object.freeze({ ...combatStats }) }),
    supports: [Object.freeze({ ...value.supports[0] }), Object.freeze({ ...value.supports[1] })],
  };
}
