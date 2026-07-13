import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mercenary/shared';
import { resolveSocketUrl } from './socket-config';

const sessionToken = sessionStorage.getItem('mercenary-session') ?? undefined;
const socketUrl = resolveSocketUrl({ explicitUrl: import.meta.env.VITE_SERVER_URL, isDevelopment: import.meta.env.DEV });
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
  auth: { sessionToken }, reconnection: true, autoConnect: false,
});

export function connectAuthenticated(accessToken: string) {
  socket.auth = { sessionToken: sessionStorage.getItem('mercenary-session') ?? undefined, accessToken };
  if (socket.connected) socket.disconnect();
  socket.connect();
}
