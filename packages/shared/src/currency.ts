export const CURRENCY_IDS = ['gold', 'recruit_token', 'rarity_shard_r', 'rarity_shard_sr', 'rarity_shard_ssr', 'rarity_shard_ex'] as const;
export type CurrencyId = (typeof CURRENCY_IDS)[number];
export type CurrencyBalances = Record<CurrencyId, number>;

export interface CurrencyMetadata {
  id: CurrencyId;
  displayName: string;
  iconKey: string;
  sortOrder: number;
}

export const CURRENCY_METADATA: readonly CurrencyMetadata[] = Object.freeze([
  { id: 'gold', displayName: '골드', iconKey: 'coin', sortOrder: 10 },
  { id: 'recruit_token', displayName: '계약석', iconKey: 'contract', sortOrder: 20 },
  { id: 'rarity_shard_r', displayName: 'R 조각', iconKey: 'shard-r', sortOrder: 30 },
  { id: 'rarity_shard_sr', displayName: 'SR 조각', iconKey: 'shard-sr', sortOrder: 40 },
  { id: 'rarity_shard_ssr', displayName: 'SSR 조각', iconKey: 'shard-ssr', sortOrder: 50 },
  { id: 'rarity_shard_ex', displayName: 'EX 조각', iconKey: 'shard-ex', sortOrder: 60 },
]);

export const DEFAULT_CURRENCY_BALANCES: Readonly<CurrencyBalances> = Object.freeze({
  gold: 0,
  recruit_token: 0,
  rarity_shard_r: 0,
  rarity_shard_sr: 0,
  rarity_shard_ssr: 0,
  rarity_shard_ex: 0,
});

export interface CurrencyChange { currencyId: CurrencyId; delta: number }
export interface CurrencyTransactionRequest { userId: string; requestKey: string; reason: string; changes: CurrencyChange[] }
export interface CurrencyTransactionResult { requestKey: string; balances: CurrencyBalances; applied: boolean }

export function normalizeCurrencyBalances(value?: Partial<Record<CurrencyId, number>> | null): CurrencyBalances {
  const balances = { ...DEFAULT_CURRENCY_BALANCES };
  if (!value) return balances;
  for (const id of CURRENCY_IDS) {
    const balance = value[id];
    if (balance !== undefined) {
      if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('INVALID_CURRENCY_BALANCE');
      balances[id] = balance;
    }
  }
  return balances;
}

export function assertCurrencyBalances(value: CurrencyBalances): void {
  for (const id of CURRENCY_IDS) {
    const balance = value[id];
    if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('INVALID_CURRENCY_BALANCE');
  }
}

export function normalizeCurrencyChanges(changes: readonly CurrencyChange[]): CurrencyChange[] {
  const totals = new Map<CurrencyId, number>();
  for (const change of changes) {
    if (!CURRENCY_IDS.includes(change.currencyId)) throw new Error('INVALID_CURRENCY_ID');
    if (!Number.isSafeInteger(change.delta)) throw new Error('INVALID_CURRENCY_DELTA');
    const total = (totals.get(change.currencyId) ?? 0) + change.delta;
    if (!Number.isSafeInteger(total)) throw new Error('INVALID_CURRENCY_DELTA');
    totals.set(change.currencyId, total);
  }
  return CURRENCY_IDS.filter((id) => totals.has(id) && totals.get(id) !== 0).map((currencyId) => ({ currencyId, delta: totals.get(currencyId)! }));
}
