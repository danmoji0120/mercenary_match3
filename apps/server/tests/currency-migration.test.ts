import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../supabase/migrations/20260714120000_account_currency_foundation_0_6_0.sql', import.meta.url), 'utf8');

describe('account currency migration', () => {
  it('defines balances, idempotency ledger, atomic RPC, and bootstrap backfill', () => {
    expect(migration).toContain('create table if not exists public.match3_user_currencies');
    expect(migration).toContain('create table if not exists public.match3_currency_transactions');
    expect(migration).toContain('primary key (user_id, request_key)');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('INSUFFICIENT_CURRENCY');
    expect(migration).toContain('match3_apply_currency_transaction');
    expect(migration.match(/match3_user_currencies[\s\S]*on conflict do nothing/g)?.length).toBeGreaterThanOrEqual(1);
    expect(migration).toContain('revoke all on function public.match3_apply_currency_transaction');
  });
});
