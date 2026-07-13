import { randomInt } from 'node:crypto';
import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import type { UpdateLoadoutRequest } from '@mercenary/shared';
import type { AccountServices, AuthIdentity } from './account.js';
import { accountState, type StoredAccount } from './account.js';
import { DEFAULT_LOADOUT } from './character-registry.js';

declare global {
  // Express exposes request augmentation through its namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { authIdentity?: AuthIdentity } }
}
const loadoutSchema = z.object({ combatantCharacterId: z.string().regex(/^[a-z0-9_]{3,64}$/), supportCharacterId1: z.string().regex(/^[a-z0-9_]{3,64}$/), supportCharacterId2: z.string().regex(/^[a-z0-9_]{3,64}$/), expectedVersion: z.number().int().positive().optional() }).strict();
const displayPrefixes = ['\uD3D0\uAE09\uC6A9\uBCD1', '\uC2E0\uC785\uB2E8\uC6D0', '\uC784\uC2DC\uACE0\uC6A9'];
export const makeDisplayName = () => `${displayPrefixes[randomInt(displayPrefixes.length)]} ${randomInt(1000, 10000)}`;

function bearer(request: Request) { const value = request.header('authorization'); const match = value?.match(/^Bearer ([^\s]+)$/); return match?.[1] }
export function requireAuth(services: AccountServices) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const token = bearer(request); if (!token) { response.status(401).json({ error: 'Authentication required' }); return }
    try { request.authIdentity = await services.auth.verify(token); next() } catch (error) { response.status(error instanceof Error && error.message === 'AUTH_UNAVAILABLE' ? 503 : 401).json({ error: error instanceof Error && error.message === 'AUTH_UNAVAILABLE' ? 'Authentication service unavailable' : 'Invalid authentication' }) }
  };
}
export async function ensureAccount(services: AccountServices, userId: string): Promise<StoredAccount> {
  const account = await services.accounts.get(userId);
  if (account) return services.accounts.bootstrap(userId, account.profile.displayName, services.registry.starters.map((item) => item.id), DEFAULT_LOADOUT);
  return services.accounts.bootstrap(userId, makeDisplayName(), services.registry.starters.map((item) => item.id), DEFAULT_LOADOUT);
}
export function installAccountApi(router: Router, services: AccountServices) {
  const auth = requireAuth(services);
  router.get('/api/characters', (_request, response) => response.json({ characters: services.registry.enabled }));
  router.post('/api/account/bootstrap', auth, async (request, response) => { try { response.json(accountState(await ensureAccount(services, request.authIdentity!.userId), services.registry.enabled)) } catch { response.status(503).json({ error: 'Account service unavailable' }) } });
  router.get('/api/account/me', auth, async (request, response) => { try { response.json(accountState(await ensureAccount(services, request.authIdentity!.userId), services.registry.enabled)) } catch { response.status(503).json({ error: 'Account service unavailable' }) } });
  router.put('/api/account/loadout', auth, async (request, response) => {
    const parsed = loadoutSchema.safeParse(request.body); if (!parsed.success) { response.status(400).json({ error: 'Invalid loadout' }); return }
    try { const account = await ensureAccount(services, request.authIdentity!.userId); services.registry.validateLoadout(accountLoadout(parsed.data), new Set(account.ownedCharacterIds)); const loadout = await services.accounts.saveLoadout(request.authIdentity!.userId, parsed.data); response.json({ loadout }) }
    catch (error) { const code = error instanceof Error && error.message === 'VERSION_CONFLICT' ? 409 : 400; response.status(code).json({ error: code === 409 ? 'Loadout changed elsewhere' : 'Loadout is not available' }) }
  });
}
function accountLoadout(value: UpdateLoadoutRequest) { return { ...value, loadoutVersion: value.expectedVersion ?? 1 } }
