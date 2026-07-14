import { describe, expect, it } from 'vitest';
import { CURRENCY_IDS, DEFAULT_CURRENCY_BALANCES, normalizeCurrencyBalances, normalizeCurrencyChanges } from '../src/currency';

describe('currency contract', () => {
  it('defines six deterministic zero balances and repairs missing legacy values', () => {
    expect(CURRENCY_IDS).toHaveLength(6);
    expect(DEFAULT_CURRENCY_BALANCES).toEqual({ gold: 0, recruit_token: 0, rarity_shard_r: 0, rarity_shard_sr: 0, rarity_shard_ssr: 0, rarity_shard_ex: 0 });
    expect(normalizeCurrencyBalances({ gold: 45 })).toEqual({ ...DEFAULT_CURRENCY_BALANCES, gold: 45 });
  });

  it('aggregates duplicate changes and rejects fractions, unknown ids, and unsafe values', () => {
    expect(normalizeCurrencyChanges([{ currencyId: 'gold', delta: 5 }, { currencyId: 'gold', delta: -2 }, { currencyId: 'recruit_token', delta: 0 }])).toEqual([{ currencyId: 'gold', delta: 3 }]);
    expect(() => normalizeCurrencyChanges([{ currencyId: 'gold', delta: 0.5 }])).toThrow('INVALID_CURRENCY_DELTA');
    expect(() => normalizeCurrencyChanges([{ currencyId: 'unknown' as 'gold', delta: 1 }])).toThrow('INVALID_CURRENCY_ID');
    expect(() => normalizeCurrencyBalances({ gold: Number.MAX_SAFE_INTEGER + 1 })).toThrow('INVALID_CURRENCY_BALANCE');
  });
});
