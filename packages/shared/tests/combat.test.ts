import { describe, expect, it } from 'vitest';
import { BATTLE_CONFIG, applyGauge, applyHeal, applyShield, chainMultiplier, effectFor, resolveAttack, timeResult, type BattleParticipant, type PendingAttack } from '../src/index';

const player = (id = 'p'): BattleParticipant => ({ id, sessionToken: id, name: id, isBot: false, connected: true, hp: 1_000, shield: 0, gauge: 0, board: { tiles: [], version: 1, processing: false }, loadout: { id: 'x', displayName: 'x', activeSkillName: 'x' } });
const attack = (damage: number): PendingAttack => ({ id: 'a', sourceId: 's', targetId: 't', damage, kind: 'SWORD', createdAt: 0, arrivesAt: 1 });

describe('combat rules', () => {
  it('calculates sword damage tiers and overflow', () => { expect(effectFor('SWORD', 3, 1)).toBe(70); expect(effectFor('SWORD', 4, 1)).toBe(115); expect(effectFor('SWORD', 5, 1)).toBe(170); expect(effectFor('SWORD', 6, 1)).toBe(205) });
  it('applies chain multipliers up to 1.6', () => { expect(chainMultiplier(3)).toBeCloseTo(1.2); expect(chainMultiplier(99)).toBe(1.6); expect(effectFor('SHIELD', 3, 2)).toBe(72) });
  it('absorbs damage with shield first and sends overflow to HP', () => { const target = player(); applyShield(target, 100); expect(resolveAttack(target, attack(70))).toEqual({ absorbed: 70, hpDamage: 0, shieldBroken: false }); expect(resolveAttack(target, attack(80))).toEqual({ absorbed: 30, hpDamage: 50, shieldBroken: true }); expect(target.hp).toBe(950) });
  it('uses shield present at arrival without undoing prior damage', () => { const target = player(); applyShield(target, 65); resolveAttack(target, attack(70)); expect(target.hp).toBe(995); applyShield(target, 65); expect(target.hp).toBe(995) });
  it('caps healing without applying a duplicate time-window multiplier', () => { const target = player(); target.hp = 990; expect(applyHeal(target, 80)).toBe(10); target.hp = 900; expect(applyHeal(target, 40)).toBe(40); expect(target.hp).toBe(940) });
  it('caps gauge', () => { const target = player(); target.gauge = 90; expect(applyGauge(target, 48)).toBe(10); expect(target.gauge).toBe(BATTLE_CONFIG.maxGauge) });
  it('marks HP zero immediately', () => { const target = player(); resolveAttack(target, attack(2_000)); expect(target.hp).toBe(0) });
  it('decides timeout by HP, then shield, then draw', () => { const a = player('a'), b = player('b'); b.hp = 900; expect(timeResult(a, b, 1).winnerId).toBe('a'); b.hp = 1_000; b.shield = 2; expect(timeResult(a, b, 1).winnerId).toBe('b'); a.shield = 2; expect(timeResult(a, b, 1).winnerId).toBeNull() });
});
