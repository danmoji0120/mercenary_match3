import { describe, expect, it } from 'vitest';
import { BATTLE_CONFIG, activeSkillDamage, effectFor } from '../src/index';

describe('frenzy calculations', () => {
  it('keeps normal values before frenzy', () => { expect(effectFor('SWORD', 3, 1)).toBe(70); expect(effectFor('SHIELD', 3, 1)).toBe(65); expect(effectFor('HEAL', 3, 1)).toBe(35); expect(effectFor('MANA', 3, 1)).toBe(20) });
  it('applies attack multiplier and rounds once', () => { expect(effectFor('SWORD', 3, 1, true)).toBe(95); expect(activeSkillDamage(true)).toBe(257) });
  it('applies shield, healing, and unchanged mana multipliers', () => { expect(effectFor('SHIELD', 3, 1, true)).toBe(52); expect(effectFor('HEAL', 3, 1, true)).toBe(18); expect(effectFor('MANA', 3, 1, true)).toBe(20) });
  it('applies chain then frenzy before final rounding', () => { expect(effectFor('SHIELD', 3, 2, true)).toBe(57) });
  it('replaces rather than stacks the old final-30-second healing rule', () => { expect(BATTLE_CONFIG.frenzyHealMultiplier).toBe(0.5); expect(effectFor('HEAL', 4, 1, true)).toBe(28); expect('healReductionMultiplier' in BATTLE_CONFIG).toBe(false) });
});
