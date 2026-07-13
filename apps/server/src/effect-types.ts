import type { AbilityKind, AbilityTag, TileType } from '@mercenary/shared';

export const TRIGGER_TYPES = ['active_requested', 'battle_started', 'match_group_resolved', 'chain_step_resolved', 'attack_created', 'before_attack_impact', 'before_damage', 'after_damage', 'shield_broken', 'hp_threshold_crossed', 'after_heal', 'after_shield_gain', 'status_applied', 'status_expired', 'battle_finished'] as const;
export type TriggerType = typeof TRIGGER_TYPES[number];
export type CompareOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ValueExpression =
  | { type: 'CONSTANT'; value: number | boolean | string }
  | { type: 'STAT'; target: 'SELF' | 'ENEMY'; stat: 'MAX_HP' }
  | { type: 'RESOURCE'; target: 'SELF' | 'ENEMY'; resource: 'HP' | 'HP_RATIO' | 'SHIELD' | 'MANA' }
  | { type: 'EVENT_VALUE'; path: string }
  | { type: 'RESULT_VALUE'; resultKey: string; path: string }
  | { type: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE' | 'MIN' | 'MAX'; values: ValueExpression[] }
  | { type: 'CLAMP'; value: ValueExpression; min: ValueExpression; max: ValueExpression }
  | { type: 'ABS' | 'FLOOR' | 'CEIL' | 'ROUND'; value: ValueExpression };
export interface TriggerDefinition { type: TriggerType; leadTimeMs?: number }
export interface ConditionDefinition { type: string; operator?: CompareOperator; value?: number | boolean | string; field?: string; tag?: string; statusId?: string; tileType?: TileType; effectKey?: string; direction?: 'upward' | 'downward'; conditions?: ConditionDefinition[]; condition?: ConditionDefinition; left?: ValueExpression; right?: ValueExpression }
export interface EffectDefinition { type: string; key?: string; target?: 'self' | 'opponent'; amount?: number | ValueExpression; ratio?: number | ValueExpression; maximum?: number; durationMs?: number; statusId?: string; delayMs?: number; effects?: EffectDefinition[]; elseEffects?: EffectDefinition[]; conditions?: ConditionDefinition[]; message?: string; scope?: 'chain_step'; cap?: number; tags?: string[]; travelMs?: number; shieldBypassRatio?: number | ValueExpression; initialCharges?: number; flag?: string; value?: number | boolean | string; resource?: 'HP' | 'SHIELD' | 'MANA'; allowPartial?: boolean; canReduceHpBelowOne?: boolean; handlerId?: string; parameters?: JsonValue }
export interface AbilityDefinition { id: string; kind: AbilityKind; name: string; shortDescription: string; fullDescription: string; trigger: TriggerDefinition; cost: number; cooldownMs: number; oncePerBattle: boolean; maxTriggersPerBattle: number | null; chainLimit: { maxTriggers: number } | null; conditions: ConditionDefinition[]; effects: EffectDefinition[]; tags: AbilityTag[]; contentVersion: number; enabled: boolean }
export interface StatusModifier { type: 'incoming_damage_multiplier' | 'outgoing_damage_multiplier' | 'healing_received_multiplier' | 'shield_gain_multiplier' | 'shield_bypass_bonus'; value: number }
export interface ConsumePolicy { type: 'on_next_outgoing_damage' | 'on_next_incoming_attack'; consumeAfter: 'damage_created' | 'attack_arrived' }
export interface StatusDefinition { id: string; name: string; description: string; durationMs: number; stacking: 'replace' | 'refresh' | 'extend' | 'stack' | 'ignore'; maxStacks: number; refreshPolicy: 'replace' | 'refresh' | 'extend' | 'stack' | 'ignore'; consumePolicy: ConsumePolicy | null; modifiers: StatusModifier[]; triggers: TriggerDefinition[]; visibleToOwner: boolean; visibleToOpponent: boolean; contentVersion: number }
export interface EffectResult { requestedAmount?: number; finalAmount?: number; shieldDamage?: number; hpDamage?: number; actualHealing?: number; overhealing?: number; actualShieldGain?: number; shieldBroken?: boolean; targetDefeated?: boolean; statusApplied?: boolean; chargeConsumed?: boolean; consumedAmount?: number }
export type EffectOriginType = 'TILE_MATCH' | 'ACTIVE_ABILITY' | 'SUPPORT_ABILITY' | 'STATUS' | 'SCHEDULED' | 'COPIED' | 'CONVERTED' | 'CUSTOM';
export interface EffectOriginMetadata { eventId: string; rootEventId: string; parentEventId?: string; sourceCharacterId: string; sourceAbilityId: string; originType: EffectOriginType; generationDepth: number; canTriggerSupport: boolean; canBeCopied: boolean; canBeConverted: boolean }
export interface TriggerContext { battleId: string; sourceParticipantId: string; targetParticipantId: string; sourceType?: string; attackId?: string; skillId?: string; supportEffectId?: string; tileType?: TileType; matchedTileCount?: number; chainLevel?: number; baseAmount?: number; currentAmount?: number; finalAmount?: number; shieldBefore?: number; shieldAfter?: number; hpBefore?: number; hpAfter?: number; shieldBroken?: boolean; hpThresholdCrossed?: number; sourceTags?: string[]; effectResults: Record<string, EffectResult>; serverTime: number; scopeKey?: string; origin?: EffectOriginMetadata }
