import { describe, expect, it } from 'vitest';
import { formatCompactBalance } from '../src/GameUi';
import { stablePortraitVariant } from '../src/CharacterPortrait';

describe('resource balance presentation', () => {
  it('compacts display values without changing source balances', () => {
    expect(formatCompactBalance(999)).toBe('999'); expect(formatCompactBalance(1_000)).toBe('1K'); expect(formatCompactBalance(1_250)).toBe('1.3K'); expect(formatCompactBalance(1_200_000)).toBe('1.2M');
  });
});

describe('portrait fallback presentation', () => {
  it('keeps decoration deterministic and bounded', () => {
    expect(stablePortraitVariant('wagon_escort_colin')).toBe(stablePortraitVariant('wagon_escort_colin'));
    expect(stablePortraitVariant('wagon_escort_colin')).toBeGreaterThanOrEqual(0);
    expect(stablePortraitVariant('wagon_escort_colin')).toBeLessThan(4);
    expect(new Set(['a', 'b', 'c', 'd'].map(stablePortraitVariant)).size).toBeGreaterThan(1);
  });
});
