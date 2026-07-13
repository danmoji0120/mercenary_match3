import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@mercenary/shared';
import { GameServer } from './game-server.js';
import { InMemoryAccountRepository, InMemoryAuthVerifier, createSupabaseServices, type AccountServices } from './account.js';
import { ensureAccount, installAccountApi } from './account-api.js';
import { readSupabaseServerEnvironment } from './environment.js';
import { loadCharacterRegistry } from './character-registry.js';

export const SERVER_HOST = '0.0.0.0';
export const DEFAULT_PORT = 3001;
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CLIENT_DIST = path.resolve(moduleDirectory, '../../client/dist');

export interface ServerOptions {
  environment?: string;
  clientDistPath?: string;
  clientOrigins?: string[];
  queueBotDelayMs?: number;
  reconnectGraceMs?: number;
  accountServices?: AccountServices;
}

export function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('PORT must be an integer between 0 and 65535');
  return port;
}

export function configuredOrigins(environment: string, raw = process.env.CLIENT_ORIGIN): string[] {
  if (raw) return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  return environment === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
}

export function createMercenaryServer(options: ServerOptions = {}) {
  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
  const production = environment === 'production';
  const clientDistPath = path.resolve(options.clientDistPath ?? DEFAULT_CLIENT_DIST);
  const indexPath = path.join(clientDistPath, 'index.html');
  const clientReady = existsSync(indexPath);
  if (production && !clientReady) throw new Error('Production client build is missing. Run npm run build before starting the server.');

  const app = express();
  app.set('trust proxy', production ? 1 : false);
  app.disable('x-powered-by');
  const origins = options.clientOrigins ?? configuredOrigins(environment);
  if (!production || origins.length) app.use(cors({ origin: origins, credentials: true }));
  app.use(express.json({ limit: '16kb' }));
  const registry = options.accountServices?.registry ?? loadCharacterRegistry();
  const supabaseEnvironment = options.accountServices ? null : readSupabaseServerEnvironment(environment);
  const accountServices = options.accountServices ?? (supabaseEnvironment ? createSupabaseServices(supabaseEnvironment.url, supabaseEnvironment.secretKey, registry) : { auth: new InMemoryAuthVerifier(new Map(), true), accounts: new InMemoryAccountRepository(), registry });
  app.get('/health', (_request, response) => response.status(200).json({ status: 'ok', service: 'mercenary-match3', uptimeSeconds: Math.floor(process.uptime()), clientReady }));
  installAccountApi(app, accountServices);

  if (clientReady) {
    app.use(express.static(clientDistPath, {
      index: false,
      setHeaders(response, filename) {
        const normalized = filename.replaceAll('\\', '/');
        if (path.basename(filename) === 'index.html') response.setHeader('Cache-Control', 'no-store');
        else if (normalized.includes('/assets/')) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else response.setHeader('Cache-Control', 'public, max-age=3600');
      },
    }));
    app.get(/^(?!\/health(?:\/|$)|\/api(?:\/|$)|\/socket\.io(?:\/|$)).*/, (request, response) => {
      if (path.extname(request.path)) { response.status(404).json({ error: 'Not found' }); return }
      response.setHeader('Cache-Control', 'no-store');
      response.sendFile(indexPath);
    });
  }

  app.use((_request, response) => response.status(404).json({ error: 'Not found' }));
  app.use((_error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => response.status(500).json({ error: 'Internal server error' }));

  const httpServer = http.createServer(app);
  const socketOptions = origins.length ? { cors: { origin: origins, credentials: true }, maxHttpBufferSize: 16_384 } : { maxHttpBufferSize: 16_384 };
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, socketOptions);
  const game = new GameServer(io, options.queueBotDelayMs, options.reconnectGraceMs, !production, registry, (userId) => ensureAccount(accountServices, userId));
  io.use(async (socket, next) => {
    const accessToken = typeof socket.handshake.auth.accessToken === 'string' ? socket.handshake.auth.accessToken : '';
    if (!accessToken) { next(new Error('Authentication required')); return }
    try { const identity = await accountServices.auth.verify(accessToken); const account = await ensureAccount(accountServices, identity.userId); registry.validateLoadout(account.loadout, new Set(account.ownedCharacterIds)); (socket.data as any).userId = identity.userId; (socket.data as any).account = account; next() }
    catch { next(new Error('Account authentication failed')) }
  });
  io.on('connection', (socket) => game.attach(socket));

  let shutdownPromise: Promise<void> | null = null;
  function shutdown(): Promise<void> {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = new Promise((resolve) => {
      game.shutdown(); io.disconnectSockets(true); io.close();
      if (!httpServer.listening) { resolve(); return }
      const fallback = setTimeout(() => { httpServer.closeAllConnections(); resolve() }, 5_000); fallback.unref?.();
      httpServer.close(() => { clearTimeout(fallback); resolve() });
    });
    return shutdownPromise;
  }

  return { app, httpServer, io, game, accountServices, environment, production, clientDistPath, clientReady, shutdown };
}
