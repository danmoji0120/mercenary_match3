import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { ClientToServerEvents, ServerToClientEvents, SwapRequest } from '@mercenary/shared';
import { Battle, createParticipant } from './battle.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
interface Session { token: string; playerId: string; name: string; socketId: string | null; battleId: string | null; disconnectTimer?: NodeJS.Timeout }
interface QueueEntry { playerId: string; joinedAt: number; botTimer: NodeJS.Timeout }

const position = z.object({ row: z.number().int().min(0).max(6), col: z.number().int().min(0).max(6) });
const swapSchema = z.object({ from: position, to: position, requestId: z.string().min(1).max(80) }).strict();
const skillSchema = z.object({ requestId: z.string().min(1).max(80) }).strict();
const names = ['Rookie', 'Scrapper', 'Recruit', 'Mercenary'];

export class GameServer {
  readonly sessions = new Map<string, Session>();
  readonly playerTokens = new Map<string, string>();
  readonly battles = new Map<string, Battle>();
  readonly queue: QueueEntry[] = [];
  constructor(private io: TypedServer, private queueBotDelayMs = Number(process.env.QUEUE_BOT_DELAY_MS ?? 60_000), private reconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS ?? 10_000)) {}

  attach(socket: TypedSocket) {
    const supplied = typeof socket.handshake.auth.sessionToken === 'string' ? socket.handshake.auth.sessionToken : '';
    let session = this.sessions.get(supplied);
    if (!session) {
      const token = randomUUID(), playerId = randomUUID();
      session = { token, playerId, name: `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(100 + Math.random() * 900)}`, socketId: socket.id, battleId: null };
      this.sessions.set(token, session); this.playerTokens.set(playerId, token);
    } else {
      if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
      session.socketId = socket.id;
      const battle = session.battleId ? this.battles.get(session.battleId) : undefined;
      if (battle) { battle.setConnected(session.playerId, true); socket.emit('stateSnapshot', battle.snapshotFor(session.playerId)) }
    }
    socket.data.playerId = session.playerId;
    socket.emit('session', { sessionToken: session.token, playerId: session.playerId, name: session.name });
    socket.on('queueJoin', (payload) => this.joinQueue(session!.playerId, Boolean(payload?.immediateBot)));
    socket.on('queueLeave', () => this.leaveQueue(session!.playerId));
    socket.on('swapRequest', (raw) => this.handleSwap(session!.playerId, raw));
    socket.on('useSkillRequest', (raw) => { const parsed = skillSchema.safeParse(raw); const battle = this.battleFor(session!.playerId); if (!parsed.success || !battle?.useSkill(session!.playerId, parsed.data.requestId)) socket.emit('errorMessage', { message: 'Skill request rejected' }) });
    socket.on('rematchRequest', () => this.rematch(session!.playerId));
    socket.on('forfeitRequest', () => this.battleFor(session!.playerId)?.forfeit(session!.playerId));
    socket.on('pingRequest', (_sentAt, callback) => callback(Date.now()));
    socket.on('debugCommand', (payload) => { if (payload && ['deterministicBoard', 'swordMove', 'shieldMove', 'healMove', 'manaMove', 'time35', 'time5', 'win', 'lose'].includes(payload.action)) this.battleFor(session!.playerId)?.debug(session!.playerId, payload.action) });
    socket.on('disconnect', () => this.disconnect(session!.playerId));
  }

  private socketFor(playerId: string) { const token = this.playerTokens.get(playerId); const sid = token ? this.sessions.get(token)?.socketId : null; return sid ? this.io.sockets.sockets.get(sid) : undefined }
  private emit(playerId: string, name: keyof ServerToClientEvents, value: any) { (this.socketFor(playerId)?.emit as any)?.(name, value) }
  private battleFor(playerId: string) { const token = this.playerTokens.get(playerId); const bid = token ? this.sessions.get(token)?.battleId : null; return bid ? this.battles.get(bid) : undefined }

  joinQueue(playerId: string, immediateBot = false) {
    const session = this.sessions.get(this.playerTokens.get(playerId)!);
    if (!session || session.battleId || this.queue.some((entry) => entry.playerId === playerId)) return;
    const opponent = immediateBot ? undefined : this.queue.shift();
    if (opponent) { clearTimeout(opponent.botTimer); this.createBattle(playerId, opponent.playerId) }
    else {
      const joinedAt = Date.now(); const botTimer = setTimeout(() => { this.leaveQueue(playerId, false); this.createBattle(playerId) }, immediateBot ? 0 : this.queueBotDelayMs);
      botTimer.unref?.(); this.queue.push({ playerId, joinedAt, botTimer }); this.emit(playerId, 'queueStatus', { queued: true, joinedAt });
    }
  }

  leaveQueue(playerId: string, notify = true) { const i = this.queue.findIndex((entry) => entry.playerId === playerId); if (i < 0) return; const [entry] = this.queue.splice(i, 1); clearTimeout(entry!.botTimer); if (notify) this.emit(playerId, 'queueStatus', { queued: false }) }

  createBattle(firstId: string, secondId?: string) {
    const first = this.sessions.get(this.playerTokens.get(firstId)!); if (!first || first.battleId) return;
    const second = secondId ? this.sessions.get(this.playerTokens.get(secondId)!) : undefined;
    if (secondId && (!second || second.battleId)) return;
    const participants = [createParticipant(first.playerId, first.token, first.name, false), second ? createParticipant(second.playerId, second.token, second.name, false) : createParticipant(`bot-${randomUUID()}`, 'bot', 'Training Bot', true)] as const;
    const battle = new Battle([...participants], { snapshot: (id, value) => this.emit(id, 'stateSnapshot', value), event: (id, name, value) => this.emit(id, name as keyof ServerToClientEvents, value), ended: () => undefined });
    this.battles.set(battle.id, battle); first.battleId = battle.id; if (second) second.battleId = battle.id;
    for (const player of participants) if (!player.isBot) { this.emit(player.id, 'matchFound', { battleId: battle.id, startsAt: battle.startsAt }); this.emit(player.id, 'stateSnapshot', battle.snapshotFor(player.id)) }
  }

  handleSwap(playerId: string, raw: unknown) {
    const socket = this.socketFor(playerId); const parsed = swapSchema.safeParse(raw); const battle = this.battleFor(playerId);
    if (!parsed.success || !battle) { socket?.emit('swapRejected', { requestId: (raw as any)?.requestId ?? '', reason: 'Invalid request' }); return }
    const result = battle.swap(playerId, parsed.data as SwapRequest);
    if (result) socket?.emit('swapAccepted', { requestId: result.requestId });
    else socket?.emit('swapRejected', { requestId: parsed.data.requestId, reason: 'Illegal move', snapshot: battle.snapshotFor(playerId) });
  }

  disconnect(playerId: string) {
    this.leaveQueue(playerId, false); const session = this.sessions.get(this.playerTokens.get(playerId)!); if (!session) return; session.socketId = null;
    const battle = this.battleFor(playerId); if (!battle || battle.phase === 'FINISHED') return;
    battle.setConnected(playerId, false); this.emit(battle.other(playerId).id, 'opponentDisconnected', { deadline: Date.now() + this.reconnectGraceMs });
    session.disconnectTimer = setTimeout(() => { if (!session.socketId && battle.phase !== 'FINISHED') battle.forfeit(playerId, 'DISCONNECT') }, this.reconnectGraceMs); session.disconnectTimer.unref?.();
  }

  rematch(playerId: string) {
    const battle = this.battleFor(playerId); if (!battle || !battle.rematch(playerId)) return;
    const humans = battle.players.filter((player) => !player.isBot); for (const player of humans) { const session = this.sessions.get(this.playerTokens.get(player.id)!); if (session) session.battleId = null }
    if (humans.length === 1) this.createBattle(humans[0]!.id); else this.createBattle(humans[0]!.id, humans[1]!.id);
  }
}
