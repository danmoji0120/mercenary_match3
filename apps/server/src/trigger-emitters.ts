import type { TriggerType } from './effect-types.js';

export const TRIGGER_EMITTERS = {
  ACTIVE_USED: { runtimeType: 'active_requested', timing: 'after active effects are executed or scheduled', eventPaths: ['ability.id', 'ability.kind', 'ability.manaCost', 'ability.manaSpent'] },
  AFTER_DAMAGE: { runtimeType: 'after_damage', timing: 'after damage resolution', eventPaths: ['damage.finalAmount', 'damage.shieldBroken'] },
  BATTLE_STARTED: { runtimeType: 'battle_started', timing: 'after countdown', eventPaths: [] },
  BEFORE_ATTACK_IMPACT: { runtimeType: 'before_attack_impact', timing: 'before attack impact', eventPaths: ['damage.currentAmount'] },
  CHAIN_STEP_RESOLVED: { runtimeType: 'chain_step_resolved', timing: 'after all match groups in one chain step', eventPaths: ['chain.id', 'chain.depth', 'chain.stepIndex', 'chain.matchCount', 'chain.totalMatchedTiles', 'chain.isFinalStep'] },
  DEFEATED: { runtimeType: 'battle_finished', timing: 'after battle result is decided', eventPaths: [] },
  HEALED: { runtimeType: 'after_heal', timing: 'after actual healing and overheal are known', eventPaths: ['heal.requestedAmount', 'heal.actualAmount', 'heal.overhealAmount', 'heal.hpBefore', 'heal.hpAfter'] },
  HP_THRESHOLD_CROSSED: { runtimeType: 'hp_threshold_crossed', timing: 'after downward HP threshold crossing', eventPaths: ['hp.threshold'] },
  SHIELD_BROKEN: { runtimeType: 'shield_broken', timing: 'after damage breaks shield', eventPaths: ['damage.shieldBroken'] },
  SHIELD_GAINED: { runtimeType: 'after_shield_gain', timing: 'after enemy actual shield gain is known; routed to opponent-side supports only', eventPaths: ['shield.requestedAmount', 'shield.actualAmount', 'shield.overcapAmount', 'shield.before', 'shield.after'] },
  STATUS_APPLIED: { runtimeType: 'status_applied', timing: 'after status add, refresh, or stack change', eventPaths: ['status.id', 'status.applied', 'status.refreshed', 'status.previousStacks', 'status.currentStacks', 'status.durationMs'] },
  STATUS_REMOVED: { runtimeType: 'status_expired', timing: 'after status removal, routed to both support owners, and before STATUS runtime-value cleanup', eventPaths: ['status.id', 'status.previousStacks', 'status.removalReason', 'status.wasExpired'] },
  TILE_MATCH_RESOLVED: { runtimeType: 'match_group_resolved', timing: 'after one match group base effect', eventPaths: ['match.count', 'match.tileType', 'chain.depth'] },
} as const satisfies Record<string, { runtimeType: TriggerType; timing: string; eventPaths: readonly string[] }>;

export type PublicTriggerEvent = keyof typeof TRIGGER_EMITTERS;
export function runtimeTrigger(event: PublicTriggerEvent): TriggerType { return TRIGGER_EMITTERS[event].runtimeType }
