import type { ResolvedCombatantStats } from './character-stats.js';

export const TILE_TYPES = ['SWORD', 'SHIELD', 'HEAL', 'MANA'] as const;
export type TileType = (typeof TILE_TYPES)[number];

export type CharacterId = string;
export type CharacterRarity = 'R' | 'SR' | 'SSR' | 'EX';
export type CharacterSlot = 'combatant' | 'support';
export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  shortName: string;
  rarity: CharacterRarity;
  race: string;
  tags: string[];
  description: string;
  enabled: boolean;
  starter: boolean;
  contentVersion: number;
  allowedSlots: CharacterSlot[];
  recommendedRole: CharacterSlot;
  portraitAsset: string;
  assets?: { portraitUrl?: string; portraitHash?: string };
  stats: ResolvedCombatantStats;
  defaultSlots?: Array<'account_combatant' | 'account_support_1' | 'account_support_2' | 'bot_combatant' | 'bot_support_1' | 'bot_support_2'>;
  combatant: { skillId: string; ability?: AbilitySummary };
  support: { effectId: string; ability?: AbilitySummary };
}
export type AbilityKind = 'active' | 'support';
export type AbilityTag = 'offense' | 'defense' | 'heal' | 'disruption' | 'shield' | 'execute';
export interface AbilitySummary { id: string; kind: AbilityKind; name: string; shortDescription: string; fullDescription: string; cost: number; cooldownMs: number; tags: AbilityTag[] }
export interface StatusSnapshot { id: string; name: string; sourceParticipantId: string; targetParticipantId: string; stackCount: number; expiresAt: number; visible: boolean }
export interface AbilityRuntimeSnapshot { runtimeKey: string; abilityId: string; cooldownEndsAt: number; triggersUsed: number; usedThisBattle: boolean; remainingCharges: number }
export type EffectOriginType = 'TILE_MATCH' | 'ACTIVE_ABILITY' | 'SUPPORT_ABILITY' | 'STATUS' | 'SCHEDULED' | 'COPIED' | 'CONVERTED' | 'CUSTOM';
export interface EffectOriginSnapshot { eventId: string; rootEventId: string; parentEventId?: string; sourceCharacterId: string; sourceAbilityId: string; originType: EffectOriginType; generationDepth: number; canTriggerSupport: boolean; canBeCopied: boolean; canBeConverted: boolean }
export interface ScheduledEffectSnapshot { id: string; executeAt: number; sourceParticipantId: string; targetParticipantId: string; sourceAbilityId: string; sourceAttackId?: string; sequence: number; origin?: EffectOriginSnapshot }
export type RuntimeJsonValue = null | boolean | number | string | RuntimeJsonValue[] | { [key: string]: RuntimeJsonValue };
export type RuntimeValueScope = 'BATTLE' | 'ABILITY' | 'STATUS' | 'CHAIN';
export type RuntimeValueOperation = 'SET' | 'ADD' | 'SUBTRACT' | 'MIN' | 'MAX' | 'CLAMP' | 'CLEAR';
export interface RuntimeValueSnapshot { battle: Record<string, number>; abilities: Record<string, Record<string, number>>; statuses: Record<string, Record<string, number>>; chains: Record<string, Record<string, number>> }
export interface EffectRuntimeSnapshot { activeAbility: AbilitySummary; supportAbilities: [AbilitySummary, AbilitySummary]; statuses: StatusSnapshot[]; abilities: AbilityRuntimeSnapshot[]; scheduledEffects: ScheduledEffectSnapshot[]; runtimeFlags: Record<string, number | boolean | string>; runtimeValues: RuntimeValueSnapshot; customState: Record<string, RuntimeJsonValue>; messages: string[] }
export interface OwnedCharacter { characterId: CharacterId; acquiredAt: string; acquisitionSource: string }
export interface UserProfile { displayName: string; createdAt: string; updatedAt: string; lastSeenAt: string }
export interface UserLoadout {
  combatantCharacterId: CharacterId;
  supportCharacterId1: CharacterId;
  supportCharacterId2: CharacterId;
  loadoutVersion: number;
}
export interface UserAccountState {
  profile: UserProfile;
  ownedCharacterIds: CharacterId[];
  loadout: UserLoadout;
  characters: CharacterDefinition[];
  accountReady: boolean;
}
export type AccountBootstrapResponse = UserAccountState;
export type AccountMeResponse = UserAccountState;
export interface UpdateLoadoutRequest {
  combatantCharacterId: CharacterId;
  supportCharacterId1: CharacterId;
  supportCharacterId2: CharacterId;
  expectedVersion?: number;
}
export interface UpdateLoadoutResponse { loadout: UserLoadout }
export interface LoadoutCharacterSnapshot { characterId: CharacterId; name: string; portraitAsset: string; rarity: CharacterRarity }
export interface CombatantLoadoutSnapshot extends LoadoutCharacterSnapshot { combatStats: ResolvedCombatantStats }
export interface BattleLoadoutSnapshot { schemaVersion: 2; combatant: CombatantLoadoutSnapshot; supports: [LoadoutCharacterSnapshot, LoadoutCharacterSnapshot] }

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
  activeSkillUsesById: Record<string, number>;
  supportEffectTriggersById: Record<string, number>;
  damageByAbilityId: Record<string, number>;
  healingByAbilityId: Record<string, number>;
  shieldByAbilityId: Record<string, number>;
  directHpDamageBypass: number;
  healingPrevented: number;
  damageReduced: number;
  bonusShieldFromEffects: number;
  emergencyHealsTriggered: number;
  countersTriggered: number;
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
  maxHp: number;
  combatStats: ResolvedCombatantStats;
  shield: number;
  gauge: number;
  board: BoardState;
  loadout: LoadoutDefinition;
  battleLoadout?: BattleLoadoutSnapshot;
}

export interface PendingAttack {
  id: string;
  sourceId: string;
  targetId: string;
  damage: number;
  kind: 'SWORD' | 'SKILL';
  createdAt: number;
  arrivesAt: number;
  sourceAbilityId?: string;
  sourceTags?: string[];
  shieldBypassRatio?: number;
  origin?: EffectOriginSnapshot;
}

export type CombatEvent = (
  | { type: 'ATTACK_QUEUED'; at: number; attack: PendingAttack }
  | { type: 'ATTACK_RESOLVED'; at: number; attackId: string; absorbed: number; hpDamage: number; shieldBroken: boolean }
  | { type: 'SHIELD_GAINED'; at: number; participantId: string; amount: number }
  | { type: 'HEALED'; at: number; participantId: string; amount: number }
  | { type: 'GAUGE_GAINED'; at: number; participantId: string; amount: number }
  | { type: 'ABILITY_TRIGGERED'; at: number; participantId: string; abilityId: string; abilityName: string; kind: AbilityKind }
  | { type: 'STATUS_CHANGED'; at: number; participantId: string; statusId: string; active: boolean }
  | { type: 'BATTLE_MESSAGE'; at: number; participantId: string; message: string }) & { origin?: EffectOriginSnapshot };

export interface PublicParticipant { id: string; name: string; isBot: boolean; connected: boolean; hp: number; maxHp: number; shield: number; gauge: number; combatStats: ResolvedCombatantStats; loadout: BattleLoadoutSnapshot; effectRuntime?: EffectRuntimeSnapshot }
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
  returnToLobbyRequest: () => void;
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
  returnToLobbyAccepted: () => void;
  opponentReturnedToLobby: () => void;
  errorMessage: (payload: { message: string }) => void;
}
