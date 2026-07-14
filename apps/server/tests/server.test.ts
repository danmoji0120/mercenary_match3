import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@mercenary/shared';
import { createMercenaryServer, parsePort, SERVER_HOST } from '../src/server';
import { InMemoryAccountRepository, InMemoryAuthVerifier } from '../src/account';
import { loadCharacterRegistry } from '../src/character-registry';

const roots: string[] = [], services: Array<ReturnType<typeof createMercenaryServer>> = [];
afterEach(async () => { for (const service of services.splice(0)) await service.shutdown(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) });

function clientBuild() {
  const root = mkdtempSync(path.join(tmpdir(), 'mercenary-client-')); roots.push(root); mkdirSync(path.join(root, 'assets'));
  writeFileSync(path.join(root, 'index.html'), '<!doctype html><div id="root">production-client</div><script src="/assets/app-abc123.js"></script>');
  writeFileSync(path.join(root, 'assets/app-abc123.js'), 'console.log("asset")'); return root;
}
async function listen(service: ReturnType<typeof createMercenaryServer>) { await new Promise<void>((resolve) => service.httpServer.listen(0, SERVER_HOST, resolve)); const address = service.httpServer.address(); return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}` }
function event<T>(socket: Socket<ServerToClientEvents, ClientToServerEvents>, name: keyof ServerToClientEvents, timeout = 2_000): Promise<T> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out: ${name}`)), timeout); socket.once(name as any, (value: T) => { clearTimeout(timer); resolve(value) }) }) }
function accountServices() { const auth = new InMemoryAuthVerifier(), token = auth.issue('unit-user'); return { token, services: { auth, accounts: new InMemoryAccountRepository(), registry: loadCharacterRegistry() } } }

describe('production HTTP and Socket.IO server', () => {
  it('validates PORT and binds on the Render-compatible host', () => { expect(parsePort('10000')).toBe(10_000); expect(parsePort(undefined)).toBe(3_001); expect(() => parsePort('bad')).toThrow(/PORT/); expect(SERVER_HOST).toBe('0.0.0.0') });
  it('fails production startup when the client build is missing', () => { expect(() => createMercenaryServer({ environment: 'production', clientDistPath: path.join(tmpdir(), 'definitely-missing-client') })).toThrow(/client build is missing/) });
  it('serves health, index, hashed assets, SPA routes, and real asset 404s', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild(), accountServices: auth.services }); services.push(service); const url = await listen(service);
    const health = await fetch(`${url}/health`); expect(health.status).toBe(200); expect(await health.json()).toMatchObject({ status: 'ok', service: 'mercenary-match3', clientReady: true });
    const index = await fetch(`${url}/`); expect(await index.text()).toContain('production-client'); expect(index.headers.get('cache-control')).toBe('no-store');
    const asset = await fetch(`${url}/assets/app-abc123.js`); expect(asset.status).toBe(200); expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await fetch(`${url}/battle/example`)).status).toBe(200); expect((await fetch(`${url}/assets/missing.js`)).status).toBe(404);
  });
  it('uses the same HTTP server for Socket.IO and blocks production debug commands', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild(), queueBotDelayMs: 0, accountServices: auth.services }); services.push(service); const url = await listen(service);
    const socket = connect(url, { auth: { accessToken: auth.token } }); await event(socket, 'session'); const snapshotPromise = event<any>(socket, 'stateSnapshot'); socket.emit('queueJoin', { immediateBot: true }); const snapshot = await snapshotPromise;
    expect(snapshot.opponent.isBot).toBe(true); expect(snapshot.self.loadout.combatant.characterId).toBe('yuria_counter_sword'); expect(snapshot.self.loadout.supports).toHaveLength(2); expect(snapshot.opponent.loadout.supports).toHaveLength(2); socket.emit('debugCommand', { action: 'win' }); await new Promise((resolve) => setTimeout(resolve, 100)); expect(service.game.battles.get(snapshot.battleId)?.phase).not.toBe('FINISHED'); socket.close();
  });
  it('bootstraps the account API, saves a valid loadout, and rejects unauthenticated access', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ accountServices: auth.services }); services.push(service); const url = await listen(service);
    expect((await fetch(`${url}/api/account/me`)).status).toBe(401);
    const headers = { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' };
    const first = await fetch(`${url}/api/account/bootstrap`, { method: 'POST', headers }); expect(first.status).toBe(200); const account = await first.json(); expect(account.ownedCharacterIds).toHaveLength(5); expect(account.accountReady).toBe(true);
    const saved = await fetch(`${url}/api/account/loadout`, { method: 'PUT', headers, body: JSON.stringify({ combatantCharacterId: 'clarice_heavy_shield', supportCharacterId1: 'marta_guard_captain', supportCharacterId2: 'eda_curse_appraiser', expectedVersion: account.loadout.loadoutVersion }) }); expect(saved.status).toBe(200); expect((await saved.json()).loadout).toMatchObject({ combatantCharacterId: 'clarice_heavy_shield', loadoutVersion: 2 });
    const conflict = await fetch(`${url}/api/account/loadout`, { method: 'PUT', headers, body: JSON.stringify({ combatantCharacterId: account.loadout.combatantCharacterId, supportCharacterId1: account.loadout.supportCharacterId1, supportCharacterId2: account.loadout.supportCharacterId2, expectedVersion: 1 }) }); expect(conflict.status).toBe(409);
  });
  it('grants the representative group only outside production and preserves loadout/version', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ environment: 'development', accountServices: auth.services, queueBotDelayMs: 0 }); services.push(service); const url = await listen(service);
    const headers = { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' };
    const before = await (await fetch(`${url}/api/account/bootstrap`, { method: 'POST', headers })).json(); expect(before.ownedCharacterIds).toHaveLength(5);
    const firstResponse = await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers, body: JSON.stringify({ group: 'representative-0.4' }) }); expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json(); expect(first.account.ownedCharacterIds).toHaveLength(19); expect(first.account.loadout).toEqual(before.loadout); expect(first.grant.addedCharacterIds).toHaveLength(14); expect(first.grant.failedCharacterIds).toEqual([]);
    const second = await (await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers, body: JSON.stringify({ group: 'representative-0.4' }) })).json(); expect(second.account.ownedCharacterIds).toHaveLength(19); expect(second.grant.addedCharacterIds).toEqual([]); expect(second.grant.existingCharacterIds).toHaveLength(14);
    const batch = await (await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers, body: JSON.stringify({ group: 'r-batch-0.5.1' }) })).json(); expect(batch.account.ownedCharacterIds).toHaveLength(49); expect(batch.account.loadout).toEqual(before.loadout); expect(batch.grant.addedCharacterIds).toHaveLength(30); expect(batch.grant.failedCharacterIds).toEqual([]);
    const repeated = await (await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers, body: JSON.stringify({ group: 'r-batch-0.5.1' }) })).json(); expect(repeated.account.ownedCharacterIds).toHaveLength(49); expect(repeated.grant.addedCharacterIds).toEqual([]); expect(repeated.grant.existingCharacterIds).toHaveLength(30);
    const nextBatch = await (await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers, body: JSON.stringify({ group: 'r-batch-0.5.2' }) })).json(); expect(nextBatch.account.ownedCharacterIds).toHaveLength(79); expect(nextBatch.account.loadout).toEqual(before.loadout); expect(nextBatch.grant.addedCharacterIds).toHaveLength(30); expect(nextBatch.grant.failedCharacterIds).toEqual([]);
    const repeatedNextBatch = await (await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers, body: JSON.stringify({ group: 'r-batch-0.5.2' }) })).json(); expect(repeatedNextBatch.account.ownedCharacterIds).toHaveLength(79); expect(repeatedNextBatch.grant.addedCharacterIds).toEqual([]); expect(repeatedNextBatch.grant.existingCharacterIds).toHaveLength(30); expect(repeatedNextBatch.account.loadout).toEqual(before.loadout);
    const savedResponse = await fetch(`${url}/api/account/loadout`, { method: 'PUT', headers, body: JSON.stringify({ combatantCharacterId: 'fortress_breaker_camilla', supportCharacterId1: 'void_cleaner_nox', supportCharacterId2: 'failed_saint_noael', expectedVersion: before.loadout.loadoutVersion }) }); expect(savedResponse.status).toBe(200);
    const saved = (await savedResponse.json()).loadout; expect(saved).toMatchObject({ combatantCharacterId: 'fortress_breaker_camilla', supportCharacterId1: 'void_cleaner_nox', supportCharacterId2: 'failed_saint_noael', loadoutVersion: before.loadout.loadoutVersion + 1 });
    const socket = connect(url, { auth: { accessToken: auth.token } }); await event(socket, 'session'); const snapshotPromise = event<any>(socket, 'stateSnapshot'); socket.emit('queueJoin', { immediateBot: true }); const snapshot = await snapshotPromise; expect(snapshot.self.loadout.combatant.characterId).toBe('fortress_breaker_camilla'); expect(snapshot.opponent.isBot).toBe(true); socket.close();
  });
  it('does not install the development grant endpoint in production', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild(), accountServices: auth.services }); services.push(service); const url = await listen(service);
    const response = await fetch(`${url}/api/dev/account/grant-characters`, { method: 'POST', headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ group: 'representative-0.4' }) });
    expect(response.status).toBe(404);
  });
  it('rejects Socket.IO connections without a valid access token', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ accountServices: auth.services }); services.push(service); const url = await listen(service);
    const socket = connect(url, { auth: { accessToken: 'forged' }, reconnection: false }); const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve)); expect(error.message).toMatch(/authentication/i); expect(socket.connected).toBe(false); socket.close();
  });
  it('returns the same shutdown promise and clears active battle timers', async () => {
    const auth = accountServices(); const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild(), queueBotDelayMs: 0, accountServices: auth.services }); services.push(service); const url = await listen(service);
    const socket = connect(url, { auth: { accessToken: auth.token } }); await event(socket, 'session'); const found = event<any>(socket, 'stateSnapshot'); socket.emit('queueJoin', { immediateBot: true }); const snapshot = await found;
    const first = service.shutdown(), second = service.shutdown(); expect(first).toBe(second); await first; expect(service.game.battles.get(snapshot.battleId)?.phase).toBe('FINISHED'); expect(service.game.battles.get(snapshot.battleId)?.result?.reason).toBe('SERVER_ABORT'); socket.close();
  });
});
