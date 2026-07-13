import { createClient, type AuthChangeEvent, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AccountAuthSession } from './auth-state';

export type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
export type AuthListener = (event: AuthEvent, session: AccountAuthSession | null) => void;

export interface AccountAuthClient {
  getSession(): Promise<AccountAuthSession | null>;
  signInAnonymously(): Promise<AccountAuthSession>;
  updateUserEmail(email: string): Promise<AccountAuthSession>;
  signInWithEmail(email: string): Promise<void>;
  consumeCallback(url: URL): Promise<AccountAuthSession>;
  refreshUser(): Promise<AccountAuthSession | null>;
  signOut(): Promise<void>;
  subscribe(listener: AuthListener): () => void;
}

const testMode = import.meta.env.DEV && import.meta.env.VITE_ACCOUNT_TEST_MODE === 'true';
const apiOrigin = import.meta.env.DEV && import.meta.env.VITE_SERVER_URL ? String(import.meta.env.VITE_SERVER_URL).replace(/\/$/, '') : '';
const fakeStorageKey = 'mercenary-test-auth-session';
const fakeCallbackKey = 'mercenary-test-callback';

function redirectUrl() {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  try {
    const origin = configured ? new URL(configured).origin : location.origin;
    return new URL('/auth/callback', origin).toString();
  } catch { return new URL('/auth/callback', location.origin).toString() }
}

function normalizeUser(user: User, accessToken: string): AccountAuthSession {
  return { userId: user.id, accessToken, isAnonymous: user.is_anonymous === true, email: user.email, pendingEmail: typeof user.new_email === 'string' ? user.new_email : undefined };
}

class SupabaseAccountAuthClient implements AccountAuthClient {
  constructor(private readonly client: SupabaseClient) {}

  private async validated(session: Session | null) {
    if (!session) return null;
    const result = await this.client.auth.getUser(session.access_token);
    if (result.error || !result.data.user) throw new Error('AUTH_SESSION_INVALID');
    return normalizeUser(result.data.user, session.access_token);
  }

  async getSession() {
    const result = await this.client.auth.getSession();
    if (result.error) throw result.error;
    return this.validated(result.data.session);
  }

  async signInAnonymously() {
    const result = await this.client.auth.signInAnonymously();
    if (result.error || !result.data.session || !result.data.user) throw result.error ?? new Error('AUTH_GUEST_FAILED');
    return normalizeUser(result.data.user, result.data.session.access_token);
  }

  async updateUserEmail(email: string) {
    const result = await this.client.auth.updateUser({ email }, { emailRedirectTo: redirectUrl() });
    if (result.error) throw result.error;
    const session = await this.getSession();
    if (!session) throw new Error('AUTH_SESSION_INVALID');
    return { ...session, pendingEmail: result.data.user.new_email ?? email };
  }

  async signInWithEmail(email: string) {
    const result = await this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectUrl() } });
    if (result.error) throw result.error;
  }

  async consumeCallback(url: URL) {
    const code = url.searchParams.get('code');
    if (code) {
      const exchanged = await this.client.auth.exchangeCodeForSession(code);
      if (exchanged.error) throw exchanged.error;
    } else {
      const hash = new URLSearchParams(url.hash.replace(/^#/, '')), accessToken = hash.get('access_token'), refreshToken = hash.get('refresh_token');
      if (accessToken && refreshToken) { const restored = await this.client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }); if (restored.error) throw restored.error }
    }
    const session = await this.getSession();
    if (!session) throw new Error('AUTH_CALLBACK_SESSION_MISSING');
    return session;
  }

  refreshUser() { return this.getSession() }
  async signOut() { const result = await this.client.auth.signOut(); if (result.error) throw result.error }
  subscribe(listener: AuthListener) {
    const result = this.client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) return;
      queueMicrotask(() => listener(event as AuthEvent, session ? normalizeUser(session.user, session.access_token) : null));
    });
    return () => result.data.subscription.unsubscribe();
  }
}

class FakeAccountAuthClient implements AccountAuthClient {
  private readonly listeners = new Set<AuthListener>();
  private read() { try { return JSON.parse(localStorage.getItem(fakeStorageKey) ?? 'null') as AccountAuthSession | null } catch { return null } }
  private write(session: AccountAuthSession | null) { if (session) localStorage.setItem(fakeStorageKey, JSON.stringify(session)); else localStorage.removeItem(fakeStorageKey) }
  private emit(event: AuthEvent, session: AccountAuthSession | null) { for (const listener of this.listeners) queueMicrotask(() => listener(event, session)) }
  private async request<T>(path: string, body?: object) {
    const response = await fetch(`${apiOrigin}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
    if (!response.ok) throw new Error(response.status === 400 ? 'INVALID_LINK' : response.status === 409 ? 'EMAIL_CONFLICT' : 'NETWORK_ERROR');
    return response.json() as Promise<T>;
  }

  async getSession() { return this.read() }
  async signInAnonymously() {
    const session = await this.request<AccountAuthSession>('/api/test-auth/guest');
    this.write(session); this.emit('SIGNED_IN', session); return session;
  }
  async updateUserEmail(email: string) {
    const current = this.read(); if (!current?.isAnonymous) throw new Error('NOT_GUEST');
    const result = await this.request<{ callbackUrl: string }>('/api/test-auth/link', { userId: current.userId, email });
    sessionStorage.setItem(fakeCallbackKey, result.callbackUrl);
    const pending = { ...current, pendingEmail: email }; this.write(pending); this.emit('USER_UPDATED', pending); return pending;
  }
  async signInWithEmail(email: string) {
    const result = await this.request<{ callbackUrl: string | null }>('/api/test-auth/signin', { email });
    if (result.callbackUrl) sessionStorage.setItem(fakeCallbackKey, result.callbackUrl); else sessionStorage.removeItem(fakeCallbackKey);
  }
  async consumeCallback(url: URL) {
    const code = url.searchParams.get('test_code'); if (!code) throw new Error('INVALID_LINK');
    const session = await this.request<AccountAuthSession>('/api/test-auth/callback', { code });
    this.write(session); sessionStorage.removeItem(fakeCallbackKey); this.emit('SIGNED_IN', session); return session;
  }
  refreshUser() { return this.getSession() }
  async signOut() { this.write(null); sessionStorage.removeItem(fakeCallbackKey); this.emit('SIGNED_OUT', null) }
  subscribe(listener: AuthListener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
}

let singleton: AccountAuthClient | null = null;
export function accountAuthClient() {
  if (singleton) return singleton;
  if (testMode) singleton = new FakeAccountAuthClient();
  else {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim(), key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) throw new Error('VITE_SUPABASE_CONFIGURATION_MISSING');
    singleton = new SupabaseAccountAuthClient(createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }));
  }
  return singleton;
}

export function testCallbackUrl() { return sessionStorage.getItem(fakeCallbackKey) }
