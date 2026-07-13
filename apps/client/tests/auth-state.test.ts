import { describe, expect, it } from 'vitest';
import { maskEmail, statusForSession, type AccountAuthSession } from '../src/auth-state';

const session = (value: Partial<AccountAuthSession> = {}): AccountAuthSession => ({ userId: 'user-1', accessToken: 'token', isAnonymous: true, ...value });

describe('account auth state', () => {
  it('distinguishes signed out, guest, pending, and permanent sessions', () => {
    expect(statusForSession(null)).toBe('signed_out');
    expect(statusForSession(session())).toBe('guest');
    expect(statusForSession(session({ pendingEmail: 'user@example.com' }))).toBe('link_pending');
    expect(statusForSession(session({ isAnonymous: false, email: 'user@example.com' }))).toBe('permanent');
  });

  it('masks normal and short email local parts without leaking invalid input', () => {
    expect(maskEmail('sample@example.com')).toBe('s*****@example.com');
    expect(maskEmail('a@example.com')).toBe('a*@example.com');
    expect(maskEmail('invalid')).toBe('이메일 정보 없음');
    expect(maskEmail(undefined)).toBe('이메일 정보 없음');
  });
});
