import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameServer } from '../src/game-server';

class FakeSocket {
  id: string; handshake: any; data: any = {}; handlers = new Map<string, (...args: any[]) => void>(); sent: Array<{ name: string; value: any }> = [];
  constructor(id: string, token?: string) { this.id = id; this.handshake = { auth: { sessionToken: token } } }
  on(name: string, fn: (...args: any[]) => void) { this.handlers.set(name, fn); return this }
  emit(name: string, value: any) { this.sent.push({ name, value }); return true }
  trigger(name: string, ...args: any[]) { this.handlers.get(name)?.(...args) }
  last(name: string) { return [...this.sent].reverse().find((item) => item.name === name)?.value }
}
class FakeIo { sockets = { sockets: new Map<string, FakeSocket>() } }
const servers: GameServer[] = [];
const setup = (botDelay = 60_000, grace = 10_000) => { const io = new FakeIo(); const game = new GameServer(io as any, botDelay, grace); servers.push(game); const connect = (id: string, token?: string) => { const socket = new FakeSocket(id, token); io.sockets.sockets.set(id, socket); game.attach(socket as any); return socket }; return { io, game, connect } };

beforeEach(() => { process.env.COUNTDOWN_MS = '0'; vi.useFakeTimers() });
afterEach(() => { vi.useRealTimers(); for (const game of servers.splice(0)) for (const battle of game.battles.values()) if (battle.phase !== 'FINISHED') battle.forfeit(battle.players[0].id) });

describe('game server', () => {
  it('FIFO matches two players and prevents duplicate battles', () => { const { game, connect } = setup(); const a = connect('a'), b = connect('b'); a.trigger('queueJoin', {}); b.trigger('queueJoin', {}); expect(game.battles.size).toBe(1); a.trigger('queueJoin', {}); expect(game.battles.size).toBe(1); expect(a.last('matchFound').battleId).toBe(b.last('matchFound').battleId) });
  it('assigns a real-board bot after 60 seconds', () => { const { game, connect } = setup(60_000); const a = connect('a'); a.trigger('queueJoin', {}); vi.advanceTimersByTime(60_001); expect(game.battles.size).toBe(1); const battle = [...game.battles.values()][0]!; expect(battle.players.some((p) => p.isBot && p.board.tiles.length === 49)).toBe(true) });
  it('reconnects by session token during grace', () => { const { game, connect } = setup(); const a = connect('a'), b = connect('b'); a.trigger('queueJoin', {}); b.trigger('queueJoin', {}); const token = a.last('session').sessionToken; a.trigger('disconnect'); const replacement = connect('a2', token); expect(replacement.last('stateSnapshot').battleId).toBe(a.last('matchFound').battleId); expect([...game.battles.values()][0]!.player(replacement.last('session').playerId)?.connected).toBe(true) });
  it('awards loss when reconnect grace expires', () => { const { game, connect } = setup(60_000, 10_000); const a = connect('a'), b = connect('b'); a.trigger('queueJoin', {}); b.trigger('queueJoin', {}); a.trigger('disconnect'); vi.advanceTimersByTime(10_001); expect([...game.battles.values()][0]!.result?.reason).toBe('DISCONNECT') });
  it('rejects malformed, non-adjacent, and forged swap packets', () => { const { connect } = setup(); const a = connect('a'), b = connect('b'); a.trigger('queueJoin', {}); b.trigger('queueJoin', {}); vi.advanceTimersByTime(1); a.trigger('swapRequest', { from: { row: 0, col: 0 }, to: { row: 0, col: 2 }, requestId: 'bad', damage: 9999 }); expect(a.last('swapRejected').reason).toBe('Invalid request') });
  it('returns to the lobby idempotently, cancels rematch, and invalidates the old battle token', () => { const { game, connect } = setup(); const a = connect('a'), b = connect('b'); a.trigger('queueJoin', {}); b.trigger('queueJoin', {}); const battle = [...game.battles.values()][0]!, oldToken = a.last('session').sessionToken; battle.finish({ winnerId: null, reason: 'TIMEOUT', endedAt: Date.now() }); a.trigger('rematchRequest'); expect(battle.rematchReady.has(a.last('session').playerId)).toBe(true); a.trigger('returnToLobbyRequest'); expect(a.sent.some((item) => item.name === 'returnToLobbyAccepted')).toBe(true); expect(b.sent.some((item) => item.name === 'opponentReturnedToLobby')).toBe(true); expect(battle.rematchReady.size).toBe(0); expect(game.sessions.has(oldToken)).toBe(false); const count = battle.exitedPlayers.size; a.trigger('returnToLobbyRequest'); expect(battle.exitedPlayers.size).toBe(count); const replacement = connect('old-token-reconnect', oldToken); expect(replacement.last('stateSnapshot')).toBeUndefined() });
});
