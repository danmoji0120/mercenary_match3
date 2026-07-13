import { describe, expect, it } from 'vitest';
import { TestAuthMailbox } from '../src/test-auth-api.js';

describe('test auth mailbox', () => {
  it('keeps the guest user id when confirming an email link', () => {
    const mailbox = new TestAuthMailbox(), guest = mailbox.issueGuest();
    const link = mailbox.requestLink(guest.userId, 'linked@example.com'), code = new URL(link, 'http://local').searchParams.get('test_code')!;
    const permanent = mailbox.consume(code)!;
    expect(permanent.userId).toBe(guest.userId);
    expect(permanent.isAnonymous).toBe(false);
    expect(mailbox.consume(code)).toBeNull();
  });

  it('does not issue a sign-in link before an address is confirmed', () => {
    const mailbox = new TestAuthMailbox();
    expect(mailbox.requestSignIn('missing@example.com')).toBeNull();
    const guest = mailbox.issueGuest(), link = mailbox.requestLink(guest.userId, 'saved@example.com');
    mailbox.consume(new URL(link, 'http://local').searchParams.get('test_code')!);
    expect(mailbox.requestSignIn('saved@example.com')).toMatch(/^\/auth\/callback\?test_code=/);
  });

  it('does not move a confirmed email identity to another guest', () => {
    const mailbox = new TestAuthMailbox(), first = mailbox.issueGuest(), second = mailbox.issueGuest();
    const link = mailbox.requestLink(first.userId, 'owned@example.com');
    mailbox.consume(new URL(link, 'http://local').searchParams.get('test_code')!);
    expect(() => mailbox.requestLink(second.userId, 'owned@example.com')).toThrow('EMAIL_IN_USE');
  });
});
