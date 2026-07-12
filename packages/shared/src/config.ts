import type { BattleConfig, LoadoutDefinition, TileType } from './types.js';

export const BATTLE_CONFIG: BattleConfig = {
  boardSize: 7,
  durationMs: 120_000,
  maxHp: 1_000,
  maxShield: 500,
  maxGauge: 100,
  frenzyStartRemainingMs: 30_000,
  frenzyAttackMultiplier: 1.35,
  frenzyShieldMultiplier: 0.8,
  frenzyHealMultiplier: 0.5,
  frenzyManaMultiplier: 1,
  chainStep: 0.1,
  maxChainMultiplier: 1.6,
  skillDamage: 190,
  skillGaugeCost: 100,
  skillTravelMs: 700,
  reconnectGraceMs: 10_000,
};

export const BASE_EFFECTS: Record<TileType, [number, number, number]> = {
  SWORD: [70, 115, 170],
  SHIELD: [65, 105, 155],
  HEAL: [35, 55, 80],
  MANA: [20, 32, 48],
};

export const DEFAULT_LOADOUT: LoadoutDefinition = {
  id: 'rookie-vanguard',
  displayName: 'Rookie Vanguard',
  activeSkillName: 'Focused Barrage',
};

export function chainMultiplier(chain: number): number {
  return Math.min(BATTLE_CONFIG.maxChainMultiplier, 1 + (chain - 1) * BATTLE_CONFIG.chainStep);
}

export function effectFor(type: TileType, matched: number, chain: number, frenzy = false): number {
  const values = BASE_EFFECTS[type];
  const base = matched === 3 ? values[0] : matched === 4 ? values[1] : values[2] + (type === 'SWORD' ? Math.max(0, matched - 5) * 35 : 0);
  const frenzyMultiplier = !frenzy ? 1 : type === 'SWORD' ? BATTLE_CONFIG.frenzyAttackMultiplier : type === 'SHIELD' ? BATTLE_CONFIG.frenzyShieldMultiplier : type === 'HEAL' ? BATTLE_CONFIG.frenzyHealMultiplier : BATTLE_CONFIG.frenzyManaMultiplier;
  return Math.round(base * chainMultiplier(chain) * frenzyMultiplier);
}

export function activeSkillDamage(frenzy = false): number {
  return Math.round(BATTLE_CONFIG.skillDamage * (frenzy ? BATTLE_CONFIG.frenzyAttackMultiplier : 1));
}

export function swordTravelMs(matched: number): number {
  return matched >= 5 ? 550 : matched === 4 ? 400 : 300;
}
