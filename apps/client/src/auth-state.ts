export type AccountAuthStatus = 'loading' | 'signed_out' | 'guest' | 'link_pending' | 'permanent' | 'auth_error';

export interface AccountAuthSession {
  userId: string;
  accessToken: string;
  isAnonymous: boolean;
  email?: string;
  pendingEmail?: string;
}

export interface AccountAuthState {
  status: AccountAuthStatus;
  session: AccountAuthSession | null;
  error: string;
}

export function statusForSession(session: AccountAuthSession | null): AccountAuthStatus {
  if (!session) return 'signed_out';
  if (!session.isAnonymous) return 'permanent';
  return session.pendingEmail ? 'link_pending' : 'guest';
}

export function maskEmail(value: string | undefined) {
  if (!value) return '이메일 정보 없음';
  const match = value.trim().match(/^([^@]+)@([^@]+)$/);
  if (!match) return '이메일 정보 없음';
  const local = match[1]!, domain = match[2]!;
  return `${local[0]}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}
