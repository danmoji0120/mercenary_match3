import { describe, expect, it } from 'vitest';
import { formatCompactBalance } from '../src/GameUi';

describe('resource balance presentation', () => {
  it('compacts display values without changing source balances', () => {
    expect(formatCompactBalance(999)).toBe('999'); expect(formatCompactBalance(1_000)).toBe('1K'); expect(formatCompactBalance(1_250)).toBe('1.3K'); expect(formatCompactBalance(1_200_000)).toBe('1.2M');
  });
});
