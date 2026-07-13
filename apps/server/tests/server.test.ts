import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@mercenary/shared';
import { createMercenaryServer, parsePort, SERVER_HOST } from '../src/server';

const roots: string[] = [], services: Array<ReturnType<typeof createMercenaryServer>> = [];
afterEach(async () => { for (const service of services.splice(0)) await service.shutdown(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) });

function clientBuild() {
  const root = mkdtempSync(path.join(tmpdir(), 'mercenary-client-')); roots.push(root); mkdirSync(path.join(root, 'assets'));
  writeFileSync(path.join(root, 'index.html'), '<!doctype html><div id="root">production-client</div><script src="/assets/app-abc123.js"></script>');
  writeFileSync(path.join(root, 'assets/app-abc123.js'), 'console.log("asset")'); return root;
}
async function listen(service: ReturnType<typeof createMercenaryServer>) { await new Promise<void>((resolve) => service.httpServer.listen(0, SERVER_HOST, resolve)); const address = service.httpServer.address(); return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}` }
function event<T>(socket: Socket<ServerToClientEvents, ClientToServerEvents>, name: keyof ServerToClientEvents, timeout = 2_000): Promise<T> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out: ${name}`)), timeout); socket.once(name as any, (value: T) => { clearTimeout(timer); resolve(value) }) }) }

describe('production HTTP and Socket.IO server', () => {
  it('validates PORT and binds on the Render-compatible host', () => { expect(parsePort('10000')).toBe(10_000); expect(parsePort(undefined)).toBe(3_001); expect(() => parsePort('bad')).toThrow(/PORT/); expect(SERVER_HOST).toBe('0.0.0.0') });
  it('fails production startup when the client build is missing', () => { expect(() => createMercenaryServer({ environment: 'production', clientDistPath: path.join(tmpdir(), 'definitely-missing-client') })).toThrow(/client build is missing/) });
  it('serves health, index, hashed assets, SPA routes, and real asset 404s', async () => {
    const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild() }); services.push(service); const url = await listen(service);
    const health = await fetch(`${url}/health`); expect(health.status).toBe(200); expect(await health.json()).toMatchObject({ status: 'ok', service: 'mercenary-match3', clientReady: true });
    const index = await fetch(`${url}/`); expect(await index.text()).toContain('production-client'); expect(index.headers.get('cache-control')).toBe('no-store');
    const asset = await fetch(`${url}/assets/app-abc123.js`); expect(asset.status).toBe(200); expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await fetch(`${url}/battle/example`)).status).toBe(200); expect((await fetch(`${url}/assets/missing.js`)).status).toBe(404);
  });
  it('uses the same HTTP server for Socket.IO and blocks production debug commands', async () => {
    const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild(), queueBotDelayMs: 0 }); services.push(service); const url = await listen(service);
    const socket = connect(url); await event(socket, 'session'); const snapshotPromise = event<any>(socket, 'stateSnapshot'); socket.emit('queueJoin', { immediateBot: true }); const snapshot = await snapshotPromise;
    expect(snapshot.opponent.isBot).toBe(true); socket.emit('debugCommand', { action: 'win' }); await new Promise((resolve) => setTimeout(resolve, 100)); expect(service.game.battles.get(snapshot.battleId)?.phase).not.toBe('FINISHED'); socket.close();
  });
  it('returns the same shutdown promise and clears active battle timers', async () => {
    const service = createMercenaryServer({ environment: 'production', clientDistPath: clientBuild(), queueBotDelayMs: 0 }); services.push(service); const url = await listen(service);
    const socket = connect(url); await event(socket, 'session'); const found = event<any>(socket, 'stateSnapshot'); socket.emit('queueJoin', { immediateBot: true }); const snapshot = await found;
    const first = service.shutdown(), second = service.shutdown(); expect(first).toBe(second); await first; expect(service.game.battles.get(snapshot.battleId)?.phase).toBe('FINISHED'); expect(service.game.battles.get(snapshot.battleId)?.result?.reason).toBe('SERVER_ABORT'); socket.close();
  });
});
