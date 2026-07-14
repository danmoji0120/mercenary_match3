import { CURRENCY_IDS, type CurrencyBalances, type CurrencyChange } from '@mercenary/shared';

export const DEVELOPMENT_CURRENCY_PRESETS = Object.freeze({
  'ui-preview': [
    { currencyId: 'gold', delta: 10_000 },
    { currencyId: 'recruit_token', delta: 100 },
    { currencyId: 'rarity_shard_r', delta: 100 },
    { currencyId: 'rarity_shard_sr', delta: 100 },
    { currencyId: 'rarity_shard_ssr', delta: 100 },
    { currencyId: 'rarity_shard_ex', delta: 100 },
  ],
  'recruitment-test': [{ currencyId: 'recruit_token', delta: 100 }],
  'reset-currencies': null,
} satisfies Record<string, readonly CurrencyChange[] | null>);

export type DevelopmentCurrencyPreset = keyof typeof DEVELOPMENT_CURRENCY_PRESETS;

export function resolveDevelopmentCurrencyPreset(preset: DevelopmentCurrencyPreset, balances: CurrencyBalances): CurrencyChange[] {
  if (preset === 'reset-currencies') return CURRENCY_IDS.map((currencyId) => ({ currencyId, delta: -balances[currencyId] }));
  return DEVELOPMENT_CURRENCY_PRESETS[preset].map((change) => ({ ...change }));
}
