import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mercenary/shared';

const sessionToken = sessionStorage.getItem('mercenary-session') ?? undefined;
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001', {
  auth: { sessionToken }, transports: ['websocket', 'polling'], reconnection: true,
});
