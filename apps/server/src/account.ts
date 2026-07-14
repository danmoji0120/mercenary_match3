import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertCurrencyBalances, DEFAULT_CURRENCY_BALANCES, normalizeCurrencyBalances, normalizeCurrencyChanges, type AccountMeResponse, type CharacterDefinition, type CurrencyBalances, type CurrencyTransactionRequest, type CurrencyTransactionResult, type Database, type UpdateLoadoutRequest, type UserLoadout, type UserProfile } from '@mercenary/shared';
import { CharacterRegistry, DEFAULT_LOADOUT } from './character-registry.js';

export interface AuthIdentity { userId: string; anonymous: boolean }
export interface AuthVerifier { verify(accessToken: string): Promise<AuthIdentity> }
export interface StoredAccount { profile: UserProfile; ownedCharacterIds: string[]; loadout: UserLoadout; currencies: CurrencyBalances }
export interface CharacterGrantResult { addedCharacterIds: string[]; existingCharacterIds: string[]; failedCharacterIds: string[] }
export interface AccountRepository {
  bootstrap(userId: string, displayName: string, starterIds: string[], defaultLoadout: UserLoadout): Promise<StoredAccount>;
  get(userId: string): Promise<StoredAccount | null>;
  saveLoadout(userId: string, loadout: UpdateLoadoutRequest): Promise<UserLoadout>;
  grantCharacters(userId: string, characterIds: readonly string[], acquisitionSource: string): Promise<CharacterGrantResult>;
  applyCurrencyTransaction(request: CurrencyTransactionRequest): Promise<CurrencyTransactionResult>;
}

export function accountState(account: StoredAccount, characters: readonly CharacterDefinition[]): AccountMeResponse {
  return { ...account, characters: [...characters], accountReady: true };
}

export class InMemoryAuthVerifier implements AuthVerifier {
  constructor(private tokens = new Map<string, string>(), private acceptTestTokens = false) {}
  issue(userId: string, token = `test-${userId}`) { this.tokens.set(token, userId); return token }
  async verify(token: string) { const userId = this.tokens.get(token) ?? (this.acceptTestTokens && /^test-user-[a-z0-9-]{3,80}$/.test(token) ? token.slice(5) : undefined); if (!userId) throw new Error('INVALID_TOKEN'); return { userId, anonymous: true } }
}

export class InMemoryAccountRepository implements AccountRepository {
  readonly accounts = new Map<string, StoredAccount>();
  readonly currencyTransactions = new Map<string, { signature: string; result: CurrencyTransactionResult }>();
  async bootstrap(userId: string, displayName: string, starterIds: string[], defaultLoadout: UserLoadout) {
    const existing = this.accounts.get(userId);
    if (existing) { existing.ownedCharacterIds = [...new Set([...existing.ownedCharacterIds, ...starterIds])]; existing.currencies = normalizeCurrencyBalances(existing.currencies); return structuredClone(existing) }
    const now = new Date().toISOString(); const created: StoredAccount = { profile: { displayName, createdAt: now, updatedAt: now, lastSeenAt: now }, ownedCharacterIds: [...new Set(starterIds)], loadout: { ...defaultLoadout }, currencies: { ...DEFAULT_CURRENCY_BALANCES } };
    this.accounts.set(userId, created); return structuredClone(created);
  }
  async get(userId: string) { const value = this.accounts.get(userId); return value ? structuredClone(value) : null }
  async saveLoadout(userId: string, request: UpdateLoadoutRequest) {
    const account = this.accounts.get(userId); if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    if (request.expectedVersion !== undefined && request.expectedVersion !== account.loadout.loadoutVersion) throw new Error('VERSION_CONFLICT');
    account.loadout = { combatantCharacterId: request.combatantCharacterId, supportCharacterId1: request.supportCharacterId1, supportCharacterId2: request.supportCharacterId2, loadoutVersion: account.loadout.loadoutVersion + 1 };
    account.profile.updatedAt = new Date().toISOString(); return { ...account.loadout };
  }
  async grantCharacters(userId: string, characterIds: readonly string[], _acquisitionSource: string) {
    const account = this.accounts.get(userId); if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    const requested = [...new Set(characterIds)].sort(), owned = new Set(account.ownedCharacterIds);
    const existingCharacterIds = requested.filter((id) => owned.has(id)), addedCharacterIds = requested.filter((id) => !owned.has(id));
    account.ownedCharacterIds = [...new Set([...account.ownedCharacterIds, ...addedCharacterIds])];
    return { addedCharacterIds, existingCharacterIds, failedCharacterIds: [] };
  }
  async applyCurrencyTransaction(request: CurrencyTransactionRequest) {
    const account = this.accounts.get(request.userId); if (!account) throw new Error('ACCOUNT_NOT_FOUND');
    const changes = normalizeCurrencyChanges(request.changes);
    if (!/^[a-zA-Z0-9:_-]{1,120}$/.test(request.requestKey) || !request.reason.trim() || request.reason.length > 120) throw new Error('INVALID_CURRENCY_TRANSACTION');
    const transactionKey = `${request.userId}:${request.requestKey}`, signature = JSON.stringify({ reason: request.reason, changes });
    const existing = this.currencyTransactions.get(transactionKey);
    if (existing) { if (existing.signature !== signature) throw new Error('CURRENCY_REQUEST_CONFLICT'); return { ...structuredClone(existing.result), applied: false } }
    const balances = normalizeCurrencyBalances(account.currencies);
    for (const { currencyId, delta } of changes) {
      const next = balances[currencyId] + delta;
      if (!Number.isSafeInteger(next)) throw new Error('INVALID_CURRENCY_BALANCE');
      if (next < 0) throw new Error('INSUFFICIENT_CURRENCY');
      balances[currencyId] = next;
    }
    assertCurrencyBalances(balances); account.currencies = balances; account.profile.updatedAt = new Date().toISOString();
    const result = { requestKey: request.requestKey, balances: { ...balances }, applied: true };
    this.currencyTransactions.set(transactionKey, { signature, result: structuredClone(result) }); return result;
  }
}

export class SupabaseAuthVerifier implements AuthVerifier {
  constructor(private client: SupabaseClient<Database>) {}
  async verify(accessToken: string) { const { data, error } = await this.client.auth.getUser(accessToken); if (error || !data.user) throw new Error(error?.status && error.status >= 500 ? 'AUTH_UNAVAILABLE' : 'INVALID_TOKEN'); return { userId: data.user.id, anonymous: data.user.is_anonymous === true } }
}

type RpcAccount = { profile: { display_name: string; created_at: string; updated_at: string; last_seen_at: string }; owned_character_ids: string[]; loadout: { combatant_character_id: string; support_character_id_1: string; support_character_id_2: string; loadout_version: number }; currencies?: Partial<CurrencyBalances> };
const mapAccount = (value: RpcAccount): StoredAccount => ({ profile: { displayName: value.profile.display_name, createdAt: value.profile.created_at, updatedAt: value.profile.updated_at, lastSeenAt: value.profile.last_seen_at }, ownedCharacterIds: value.owned_character_ids, loadout: { combatantCharacterId: value.loadout.combatant_character_id, supportCharacterId1: value.loadout.support_character_id_1, supportCharacterId2: value.loadout.support_character_id_2, loadoutVersion: value.loadout.loadout_version }, currencies: normalizeCurrencyBalances(value.currencies) });

export class SupabaseAccountRepository implements AccountRepository {
  constructor(private client: SupabaseClient<Database>) {}
  async bootstrap(userId: string, displayName: string, starterIds: string[], loadout = DEFAULT_LOADOUT) {
    const { data, error } = await this.client.rpc('match3_bootstrap_user', { p_user_id: userId, p_display_name: displayName, p_character_ids: starterIds, p_combatant_character_id: loadout.combatantCharacterId, p_support_character_id_1: loadout.supportCharacterId1, p_support_character_id_2: loadout.supportCharacterId2 });
    if (error || !data) throw new Error('ACCOUNT_STORAGE_UNAVAILABLE'); return mapAccount(data as RpcAccount);
  }
  async get(userId: string) {
    const [profileResult, ownedResult, loadoutResult, currencyResult] = await Promise.all([
      this.client.from('match3_profiles').select('display_name,created_at,updated_at,last_seen_at').eq('user_id', userId).maybeSingle(),
      this.client.from('match3_user_characters').select('character_id').eq('user_id', userId).order('acquired_at', { ascending: true }),
      this.client.from('match3_user_loadouts').select('combatant_character_id,support_character_id_1,support_character_id_2,loadout_version').eq('user_id', userId).maybeSingle(),
      this.client.from('match3_user_currencies').select('currency_id,balance').eq('user_id', userId),
    ]);
    if (profileResult.error || ownedResult.error || loadoutResult.error || currencyResult.error) throw new Error('ACCOUNT_STORAGE_UNAVAILABLE');
    const profile = profileResult.data, owned = ownedResult.data, loadout = loadoutResult.data;
    if (!profile || !loadout) return null; return mapAccount({ profile, owned_character_ids: (owned ?? []).map((item) => item.character_id), loadout, currencies: Object.fromEntries((currencyResult.data ?? []).map((item) => [item.currency_id, item.balance])) as Partial<CurrencyBalances> });
  }
  async saveLoadout(userId: string, request: UpdateLoadoutRequest) {
    const current = await this.get(userId); if (!current) throw new Error('ACCOUNT_NOT_FOUND'); if (request.expectedVersion !== undefined && request.expectedVersion !== current.loadout.loadoutVersion) throw new Error('VERSION_CONFLICT');
    const nextVersion = current.loadout.loadoutVersion + 1;
    const query = this.client.from('match3_user_loadouts').update({ combatant_character_id: request.combatantCharacterId, support_character_id_1: request.supportCharacterId1, support_character_id_2: request.supportCharacterId2, loadout_version: nextVersion }).eq('user_id', userId).eq('loadout_version', current.loadout.loadoutVersion).select().single();
    const { data, error } = await query; if (error || !data) throw new Error('VERSION_CONFLICT'); return { combatantCharacterId: data.combatant_character_id, supportCharacterId1: data.support_character_id_1, supportCharacterId2: data.support_character_id_2, loadoutVersion: data.loadout_version };
  }
  async grantCharacters(userId: string, characterIds: readonly string[], acquisitionSource: string) {
    const requested = [...new Set(characterIds)].sort();
    const before = await this.client.from('match3_user_characters').select('character_id').eq('user_id', userId).in('character_id', requested);
    if (before.error) throw new Error('ACCOUNT_STORAGE_UNAVAILABLE');
    const existingBefore = new Set((before.data ?? []).map((item) => item.character_id)), missing = requested.filter((id) => !existingBefore.has(id));
    if (missing.length) await this.client.from('match3_user_characters').upsert(missing.map((characterId) => ({ user_id: userId, character_id: characterId, acquisition_source: acquisitionSource })), { onConflict: 'user_id,character_id', ignoreDuplicates: true });
    const after = await this.client.from('match3_user_characters').select('character_id').eq('user_id', userId).in('character_id', requested);
    if (after.error) throw new Error('ACCOUNT_STORAGE_UNAVAILABLE');
    const ownedAfter = new Set((after.data ?? []).map((item) => item.character_id));
    return {
      addedCharacterIds: missing.filter((id) => ownedAfter.has(id)),
      existingCharacterIds: requested.filter((id) => existingBefore.has(id)),
      failedCharacterIds: requested.filter((id) => !ownedAfter.has(id)),
    };
  }
  async applyCurrencyTransaction(request: CurrencyTransactionRequest) {
    const changes = normalizeCurrencyChanges(request.changes);
    if (!/^[a-zA-Z0-9:_-]{1,120}$/.test(request.requestKey) || !request.reason.trim() || request.reason.length > 120) throw new Error('INVALID_CURRENCY_TRANSACTION');
    const { data, error } = await this.client.rpc('match3_apply_currency_transaction', { p_user_id: request.userId, p_request_key: request.requestKey, p_reason: request.reason, p_changes: changes.map(({ currencyId, delta }) => ({ currency_id: currencyId, delta })) });
    if (error || !data) {
      const message = error?.message ?? '';
      if (message.includes('INSUFFICIENT_CURRENCY')) throw new Error('INSUFFICIENT_CURRENCY');
      if (message.includes('CURRENCY_REQUEST_CONFLICT')) throw new Error('CURRENCY_REQUEST_CONFLICT');
      throw new Error('ACCOUNT_STORAGE_UNAVAILABLE');
    }
    const result = data as { request_key: string; balances: Partial<CurrencyBalances>; applied: boolean };
    const balances = normalizeCurrencyBalances(result.balances); assertCurrencyBalances(balances);
    return { requestKey: result.request_key, balances, applied: result.applied };
  }
}

export interface AccountServices { auth: AuthVerifier; accounts: AccountRepository; registry: CharacterRegistry }
export function createSupabaseServices(url: string, secret: string, registry: CharacterRegistry): AccountServices {
  const client = createClient<Database>(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { auth: new SupabaseAuthVerifier(client), accounts: new SupabaseAccountRepository(client), registry };
}
