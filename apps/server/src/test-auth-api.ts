import { randomUUID } from 'node:crypto';
import type { Router } from 'express';
import { z } from 'zod';

type PendingLink = { kind: 'link' | 'signin'; userId: string; email: string };
const emailSchema = z.string().trim().email().max(254);

export class TestAuthMailbox {
  private readonly confirmedEmails = new Map<string, string>();
  private readonly links = new Map<string, PendingLink>();

  issueGuest() {
    const userId = randomUUID();
    return { userId, accessToken: `test-user-${userId}`, isAnonymous: true };
  }

  requestLink(userId: string, email: string) {
    const owner = this.confirmedEmails.get(email);
    if (owner && owner !== userId) throw new Error('EMAIL_IN_USE');
    const code = randomUUID();
    this.links.set(code, { kind: 'link', userId, email });
    return `/auth/callback?test_code=${encodeURIComponent(code)}`;
  }

  requestSignIn(email: string) {
    const userId = this.confirmedEmails.get(email);
    if (!userId) return null;
    const code = randomUUID();
    this.links.set(code, { kind: 'signin', userId, email });
    return `/auth/callback?test_code=${encodeURIComponent(code)}`;
  }

  consume(code: string) {
    const value = this.links.get(code);
    if (!value) return null;
    this.links.delete(code);
    if (value.kind === 'link') this.confirmedEmails.set(value.email, value.userId);
    return { userId: value.userId, accessToken: `test-user-${value.userId}`, isAnonymous: false, email: value.email };
  }
}

export function installTestAuthApi(router: Router, mailbox = new TestAuthMailbox()) {
  router.post('/api/test-auth/guest', (_request, response) => response.json(mailbox.issueGuest()));
  router.post('/api/test-auth/link', (request, response) => {
    const userId = z.string().uuid().safeParse(request.body?.userId), email = emailSchema.safeParse(request.body?.email);
    if (!userId.success || !email.success) { response.status(400).json({ error: 'Invalid request' }); return }
    try { response.json({ callbackUrl: mailbox.requestLink(userId.data, email.data.toLowerCase()) }) }
    catch { response.status(409).json({ error: 'Email unavailable' }) }
  });
  router.post('/api/test-auth/signin', (request, response) => {
    const email = emailSchema.safeParse(request.body?.email);
    if (!email.success) { response.status(400).json({ error: 'Invalid request' }); return }
    response.json({ callbackUrl: mailbox.requestSignIn(email.data.toLowerCase()) });
  });
  router.post('/api/test-auth/callback', (request, response) => {
    const code = z.string().uuid().safeParse(request.body?.code), session = code.success ? mailbox.consume(code.data) : null;
    if (!session) { response.status(400).json({ error: 'Invalid or expired link' }); return }
    response.json(session);
  });
  return mailbox;
}
