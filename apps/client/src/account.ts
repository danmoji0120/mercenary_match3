import { createClient, type AuthChangeEvent, type Session } from '@supabase/supabase-js';
import type { AccountMeResponse, UpdateLoadoutRequest, UpdateLoadoutResponse } from '@mercenary/shared';

export type AccountStage = 'INITIALIZING' | 'CHECKING_SESSION' | 'SIGNING_IN_ANONYMOUSLY' | 'BOOTSTRAPPING_ACCOUNT' | 'READY' | 'RETRYABLE_ERROR' | 'FATAL_ERROR';
export interface AccountBootstrap { account: AccountMeResponse; accessToken: string; unsubscribe(): void }
let pending: Promise<AccountBootstrap> | null = null;
const testMode = import.meta.env.DEV && import.meta.env.VITE_ACCOUNT_TEST_MODE === 'true';
const apiOrigin = import.meta.env.DEV && import.meta.env.VITE_SERVER_URL ? String(import.meta.env.VITE_SERVER_URL).replace(/\/$/, '') : '';

function configuration() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim(), key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required'); return { url, key };
}
async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiOrigin}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) throw new Error(response.status === 401 ? 'AUTH_EXPIRED' : 'ACCOUNT_REQUEST_FAILED'); return response.json() as Promise<T>;
}
function testToken() { let userId = localStorage.getItem('mercenary-test-user'); if (!userId) { userId = crypto.randomUUID(); localStorage.setItem('mercenary-test-user', userId) } return `test-user-${userId}` }

export function bootstrapAccount(onToken?: (token: string | null) => void): Promise<AccountBootstrap> {
  if (pending) return pending;
  pending = (async () => {
    if (testMode) { const accessToken = testToken(); const account = await api<AccountMeResponse>('/api/account/bootstrap', accessToken, { method: 'POST' }); onToken?.(accessToken); return { account, accessToken, unsubscribe() {} } }
    const { url, key } = configuration(); const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const sessionResult = await supabase.auth.getSession(); let session = sessionResult.data.session; if (sessionResult.error) throw new Error('AUTH_SESSION_FAILED');
    if (!session) { const signed = await supabase.auth.signInAnonymously(); if (signed.error || !signed.data.session) throw new Error('AUTH_SIGN_IN_FAILED'); session = signed.data.session }
    const accessToken = session.access_token; const account = await api<AccountMeResponse>('/api/account/bootstrap', accessToken, { method: 'POST' }); onToken?.(accessToken);
    const { data: subscription } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, next: Session | null) => onToken?.(next?.access_token ?? null));
    return { account, accessToken, unsubscribe: () => subscription.subscription.unsubscribe() };
  })().catch((error) => { pending = null; throw error });
  return pending;
}
export function resetAccountBootstrapForRetry() { pending = null }
export async function saveLoadout(token: string, request: UpdateLoadoutRequest) { return api<UpdateLoadoutResponse>('/api/account/loadout', token, { method: 'PUT', body: JSON.stringify(request) }) }
