export const TILE_TYPES = ['SWORD', 'SHIELD', 'HEAL', 'MANA'] as const;
export type TileType = (typeof TILE_TYPES)[number];

export type BattlePhase =
  | 'LOBBY'
  | 'QUEUED'
  | 'MATCH_FOUND'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'RECONNECTING'
  | 'FINISHED';

export interface Position { row: number; col: number }
export interface BoardState { tiles: TileType[]; version: number; processing: boolean }
export interface SwapRequest { from: Position; to: Position; requestId: string }
export interface MatchGroup { type: TileType; cells: Position[] }
export interface MatchStep { chain: number; groups: MatchGroup[]; boardAfterRemoval: (TileType | null)[]; boardAfterFill: TileType[] }
export interface MatchResolution { requestId: string; steps: MatchStep[]; finalBoard: TileType[]; effects: CombatEffect[]; shuffled: boolean }
export interface CombatEffect { type: TileType; amount: number; matched: number; chain: number }

export interface BattleConfig {
  boardSize: number;
  durationMs: number;
  maxHp: number;
  maxShield: number;
  maxGauge: number;
  frenzyStartRemainingMs: number;
  frenzyAttackMultiplier: number;
  frenzyShieldMultiplier: number;
  frenzyHealMultiplier: number;
  frenzyManaMultiplier: number;
  chainStep: number;
  maxChainMultiplier: number;
  skillDamage: number;
  skillGaugeCost: number;
  skillTravelMs: number;
  reconnectGraceMs: number;
}

export interface BattleStats {
  totalDamageGenerated: number;
  hpDamageDealt: number;
  shieldDamageDealt: number;
  totalDamageReceived: number;
  hpDamageReceived: number;
  damageBlockedByShield: number;
  shieldGained: number;
  healingDone: number;
  manaGained: number;
  swordMatchCount: number;
  shieldMatchCount: number;
  healMatchCount: number;
  manaMatchCount: number;
  swordTilesMatched: number;
  shieldTilesMatched: number;
  healTilesMatched: number;
  manaTilesMatched: number;
  maxChain: number;
  skillUseCount: number;
  attacksQueued: number;
  attacksFullyBlocked: number;
  shieldBreakCount: number;
}

export interface BotDiagnostics {
  swapActionCount: number;
  resolvedMatchGroupCount: number;
  healDecisionCount: number;
  shieldDecisionCount: number;
  manaDecisionCount: number;
  swordDecisionCount: number;
  skillDecisionCount: number;
  skillUseCount: number;
  optimalMovePickCount: number;
  topMovePickCount: number;
  randomMovePickCount: number;
  recentActions: TileType[];
}

export type BattleEndReason = 'HP_ZERO' | 'TIMEOUT' | 'FORFEIT' | 'DISCONNECT' | 'SERVER_ABORT';
export interface BattleDecision { winnerId: string | null; reason: BattleEndReason; endedAt: number }
export interface BattleResult extends BattleDecision {
  matchDurationMs: number;
  endedByHpZero: boolean;
  endedByTimeout: boolean;
  endedByForfeit: boolean;
  endedByDisconnect: boolean;
  frenzyStarted: boolean;
  frenzyDurationMs: number;
  stats: Record<string, BattleStats>;
}

export interface FrenzyState {
  isFrenzy: boolean;
  frenzyStartedAt: number | null;
  remainingMs: number;
  attackMultiplier: number;
  shieldMultiplier: number;
  healMultiplier: number;
  manaMultiplier: number;
}

export interface LoadoutDefinition { id: string; displayName: string; activeSkillName: string }
export interface BattleParticipant {
  id: string;
  sessionToken: string;
  name: string;
  isBot: boolean;
  connected: boolean;
  hp: number;
  shield: number;
  gauge: number;
  board: BoardState;
  loadout: LoadoutDefinition;
}

export interface PendingAttack {
  id: string;
  sourceId: string;
  targetId: string;
  damage: number;
  kind: 'SWORD' | 'SKILL';
  createdAt: number;
  arrivesAt: number;
}

export type CombatEvent =
  | { type: 'ATTACK_QUEUED'; at: number; attack: PendingAttack }
  | { type: 'ATTACK_RESOLVED'; at: number; attackId: string; absorbed: number; hpDamage: number; shieldBroken: boolean }
  | { type: 'SHIELD_GAINED'; at: number; participantId: string; amount: number }
  | { type: 'HEALED'; at: number; participantId: string; amount: number }
  | { type: 'GAUGE_GAINED'; at: number; participantId: string; amount: number };

export interface PublicParticipant { id: string; name: string; isBot: boolean; connected: boolean; hp: number; shield: number; gauge: number }
export interface BattleSnapshot {
  battleId: string;
  phase: BattlePhase;
  serverNow: number;
  startsAt: number;
  endsAt: number;
  selfId: string;
  self: PublicParticipant;
  opponent: PublicParticipant;
  board: BoardState;
  pendingAttacks: PendingAttack[];
  result: BattleResult | null;
  frenzy: FrenzyState;
  stats: Record<string, BattleStats>;
  botDiagnostics?: BotDiagnostics;
  rematchReady: string[];
}

export interface ClientToServerEvents {
  queueJoin: (payload?: { immediateBot?: boolean }) => void;
  queueLeave: () => void;
  swapRequest: (payload: SwapRequest) => void;
  useSkillRequest: (payload: { requestId: string }) => void;
  rematchRequest: () => void;
  forfeitRequest: () => void;
  pingRequest: (sentAt: number, callback: (serverNow: number) => void) => void;
  debugCommand: (payload: { action: 'deterministicBoard' | 'swordMove' | 'shieldMove' | 'healMove' | 'manaMove' | 'time35' | 'time5' | 'win' | 'lose' }) => void;
}
export interface ServerToClientEvents {
  session: (payload: { sessionToken: string; playerId: string; name: string }) => void;
  queueStatus: (payload: { queued: boolean; joinedAt?: number }) => void;
  matchFound: (payload: { battleId: string; startsAt: number }) => void;
  stateSnapshot: (snapshot: BattleSnapshot) => void;
  swapAccepted: (payload: { requestId: string }) => void;
  swapRejected: (payload: { requestId: string; reason: string; snapshot?: BattleSnapshot }) => void;
  boardResolved: (payload: MatchResolution) => void;
  combatEvent: (event: CombatEvent) => void;
  battleEnded: (result: BattleResult) => void;
  frenzyStarted: (state: FrenzyState) => void;
  opponentDisconnected: (payload: { deadline: number }) => void;
  errorMessage: (payload: { message: string }) => void;
}
