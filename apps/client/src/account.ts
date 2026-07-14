import type { AccountMeResponse, UpdateLoadoutRequest, UpdateLoadoutResponse, UserAccountState } from '@mercenary/shared';

export type AccountStage = 'INITIALIZING' | 'CHECKING_SESSION' | 'SIGNING_IN_ANONYMOUSLY' | 'BOOTSTRAPPING_ACCOUNT' | 'READY' | 'RETRYABLE_ERROR' | 'FATAL_ERROR';
const apiOrigin = import.meta.env.DEV && import.meta.env.VITE_SERVER_URL ? String(import.meta.env.VITE_SERVER_URL).replace(/\/$/, '') : '';
let pending: { token: string; promise: Promise<AccountMeResponse> } | null = null;

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) throw new Error(response.status === 401 ? 'AUTH_EXPIRED' : response.status === 409 ? 'ACCOUNT_VERSION_CONFLICT' : 'ACCOUNT_REQUEST_FAILED');
  return response.json() as Promise<T>;
}

export function bootstrapGameAccount(accessToken: string) {
  if (pending?.token === accessToken) return pending.promise;
  const promise = api<AccountMeResponse>('/api/account/bootstrap', accessToken, { method: 'POST' }).catch((error) => { if (pending?.promise === promise) pending = null; throw error });
  pending = { token: accessToken, promise };
  return promise;
}

export function refreshGameAccount(accessToken: string) { return api<AccountMeResponse>('/api/account/me', accessToken) }
export function resetAccountBootstrapForRetry() { pending = null }
export async function saveLoadout(token: string, request: UpdateLoadoutRequest) { return api<UpdateLoadoutResponse>('/api/account/loadout', token, { method: 'PUT', body: JSON.stringify(request) }) }
export interface DevelopmentCharacterGrantResponse {
  account: UserAccountState;
  grant: { addedCharacterIds: string[]; existingCharacterIds: string[]; failedCharacterIds: string[] };
}
export function grantDevelopmentCharacters(token: string, group = 'all-enabled') {
  return api<DevelopmentCharacterGrantResponse>('/api/dev/account/grant-characters', token, { method: 'POST', body: JSON.stringify({ group }) });
}
export type DevelopmentCurrencyPreset = 'ui-preview' | 'recruitment-test' | 'reset-currencies';
export function applyDevelopmentCurrencyPreset(token: string, preset: DevelopmentCurrencyPreset, requestKey = crypto.randomUUID()) {
  return api<{ account: UserAccountState; transaction: { requestKey: string; applied: boolean } }>('/api/dev/account/currency-preset', token, { method: 'POST', body: JSON.stringify({ preset, requestKey }) });
}
