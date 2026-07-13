import type { TileType } from './types.js';

/** Percent fields use 100 as the neutral multiplier. */
export interface ResolvedCombatantStats {
  readonly maxHp: number;
  readonly swordEffectPct: number;
  readonly shieldEffectPct: number;
  readonly healEffectPct: number;
  readonly manaGainPct: number;
}

export const LEGACY_DEFAULT_COMBATANT_STATS: Readonly<ResolvedCombatantStats> = Object.freeze({
  maxHp: 1_000,
  swordEffectPct: 100,
  shieldEffectPct: 100,
  healEffectPct: 100,
  manaGainPct: 100,
});

const fields = ['maxHp', 'swordEffectPct', 'shieldEffectPct', 'healEffectPct', 'manaGainPct'] as const;

export function resolveCombatantStats(value: unknown): Readonly<ResolvedCombatantStats> {
  if (!value || typeof value !== 'object') throw new Error('INVALID_COMBATANT_STATS: expected an object');
  const record = value as Record<string, unknown>;
  for (const field of fields) {
    const current = record[field];
    if (!Number.isSafeInteger(current) || (field === 'maxHp' ? Number(current) <= 0 : Number(current) < 0)) {
      throw new Error(`INVALID_COMBATANT_STATS: ${field} must be ${field === 'maxHp' ? 'a positive' : 'a non-negative'} safe integer`);
    }
  }
  return Object.freeze({
    maxHp: Number(record.maxHp),
    swordEffectPct: Number(record.swordEffectPct),
    shieldEffectPct: Number(record.shieldEffectPct),
    healEffectPct: Number(record.healEffectPct),
    manaGainPct: Number(record.manaGainPct),
  });
}

/** Applies one percentage at the board-effect boundary and rounds non-negative values once. */
export function applyPercentage(baseAmount: number, percentage: number): number {
  if (!Number.isSafeInteger(baseAmount) || baseAmount < 0) throw new Error('INVALID_BASE_AMOUNT: expected a non-negative safe integer');
  if (!Number.isSafeInteger(percentage) || percentage < 0) throw new Error('INVALID_PERCENTAGE: expected a non-negative safe integer');
  const whole = Math.floor(baseAmount / 100) * percentage;
  const fractional = Math.round(((baseAmount % 100) * percentage) / 100);
  const result = whole + fractional;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error('COMBAT_AMOUNT_OUT_OF_RANGE: scaled amount is not a non-negative safe integer');
  return result;
}

export function tileEffectPercentage(stats: ResolvedCombatantStats, type: TileType): number {
  if (type === 'SWORD') return stats.swordEffectPct;
  if (type === 'SHIELD') return stats.shieldEffectPct;
  if (type === 'HEAL') return stats.healEffectPct;
  return stats.manaGainPct;
}
