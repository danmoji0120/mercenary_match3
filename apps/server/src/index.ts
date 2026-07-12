import 'dotenv/config';
import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@mercenary/shared';
import { GameServer } from './game-server.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? true, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.get('/health', (_request, response) => response.json({ ok: true, now: Date.now() }));

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, { cors: { origin: process.env.CLIENT_ORIGIN?.split(',') ?? true, credentials: true }, maxHttpBufferSize: 16_384 });
const game = new GameServer(io);
io.on('connection', (socket) => game.attach(socket));

const port = Number(process.env.PORT ?? 3001);
server.listen(port, '0.0.0.0', () => console.log(`Mercenary Match server listening on http://localhost:${port}`));
