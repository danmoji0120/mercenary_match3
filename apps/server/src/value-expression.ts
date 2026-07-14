import type { BattleParticipant } from '@mercenary/shared';
import type { EffectResult, TriggerContext, ValueExpression } from './effect-types.js';

export interface ValueEvaluationContext {
  self: Readonly<BattleParticipant>;
  enemy: Readonly<BattleParticipant>;
  event: Readonly<TriggerContext>;
  runtimeValue?: (expression: Extract<ValueExpression, { type: 'RUNTIME_VALUE' }>) => number;
}

function eventValue(path: string, event: TriggerContext): number | boolean | string {
  const values: Record<string, number | boolean | string | undefined> = {
    'match.count': event.matchedTileCount,
    'match.tileType': event.tileType,
    'chain.depth': event.chainLevel,
    'damage.currentAmount': event.currentAmount,
    'damage.finalAmount': event.finalAmount,
    'damage.shieldBroken': event.shieldBroken,
    'hp.threshold': event.hpThresholdCrossed,
    'ability.id': event.abilityId,
    'ability.kind': event.abilityKind,
    'ability.manaCost': event.abilityManaCost,
    'ability.manaSpent': event.abilityManaSpent,
    'chain.id': event.chainId,
    'chain.stepIndex': event.chainStepIndex,
    'chain.matchCount': event.chainMatchCount,
    'chain.totalMatchedTiles': event.chainTotalMatchedTiles,
    'chain.isFinalStep': event.chainIsFinalStep,
    'shield.requestedAmount': event.shieldRequestedAmount,
    'shield.actualAmount': event.shieldActualAmount,
    'shield.overcapAmount': event.shieldOvercapAmount,
    'shield.before': event.shieldBefore,
    'shield.after': event.shieldAfter,
    'heal.requestedAmount': event.healRequestedAmount,
    'heal.actualAmount': event.healActualAmount,
    'heal.overhealAmount': event.healOverhealAmount,
    'heal.hpBefore': event.hpBefore,
    'heal.hpAfter': event.hpAfter,
    'status.id': event.statusId,
    'status.applied': event.statusApplied,
    'status.refreshed': event.statusRefreshed,
    'status.previousStacks': event.statusPreviousStacks,
    'status.currentStacks': event.statusCurrentStacks,
    'status.durationMs': event.statusDurationMs,
    'status.removalReason': event.statusRemovalReason,
    'status.wasExpired': event.statusWasExpired,
  };
  const value = values[path];
  if (value === undefined) throw new Error(`VALUE_EVENT_PATH_UNAVAILABLE:${path}`);
  return value;
}

function resultValue(result: EffectResult | undefined, path: string): number | boolean | string {
  if (!result) throw new Error('VALUE_RESULT_UNAVAILABLE');
  const value = result[path as keyof EffectResult];
  if (typeof value !== 'number' && typeof value !== 'boolean' && typeof value !== 'string') throw new Error(`VALUE_RESULT_PATH_UNAVAILABLE:${path}`);
  return value;
}

function finite(value: number, type: string) { if (!Number.isFinite(value)) throw new Error(`VALUE_NON_FINITE:${type}`); return value }
function numeric(value: number | boolean | string, type: string) { const result = Number(value); return finite(result, type) }

export function evaluateValue(expression: number | ValueExpression, context: ValueEvaluationContext): number | boolean | string {
  if (typeof expression === 'number') return finite(expression, 'NUMBER');
  if (expression.type === 'CONSTANT') return expression.value;
  if (expression.type === 'STAT') return (expression.target === 'SELF' ? context.self : context.enemy).maxHp;
  if (expression.type === 'RESOURCE') { const actor = expression.target === 'SELF' ? context.self : context.enemy; return expression.resource === 'HP' ? actor.hp : expression.resource === 'HP_RATIO' ? actor.hp / actor.maxHp : expression.resource === 'SHIELD' ? actor.shield : actor.gauge }
  if (expression.type === 'EVENT_VALUE') return eventValue(expression.path, context.event);
  if (expression.type === 'RESULT_VALUE') return resultValue(context.event.effectResults[expression.resultKey], expression.path);
  if (expression.type === 'RUNTIME_VALUE') {
    if (!context.runtimeValue) throw new Error('VALUE_RUNTIME_CONTEXT_UNAVAILABLE');
    return finite(context.runtimeValue(expression), 'RUNTIME_VALUE');
  }
  if (expression.type === 'CLAMP') { const value = numeric(evaluateValue(expression.value, context), expression.type), min = numeric(evaluateValue(expression.min, context), expression.type), max = numeric(evaluateValue(expression.max, context), expression.type); return finite(Math.min(max, Math.max(min, value)), expression.type) }
  if (expression.type === 'ABS' || expression.type === 'FLOOR' || expression.type === 'CEIL' || expression.type === 'ROUND') { const value = numeric(evaluateValue(expression.value, context), expression.type); return expression.type === 'ABS' ? Math.abs(value) : expression.type === 'FLOOR' ? Math.floor(value) : expression.type === 'CEIL' ? Math.ceil(value) : Math.round(value) }
  if (!('values' in expression)) throw new Error(`VALUE_EXPRESSION_UNSUPPORTED:${expression.type}`);
  const values = expression.values.map((item) => numeric(evaluateValue(item, context), expression.type));
  if (expression.type === 'ADD') return finite(values.reduce((sum, value) => sum + value, 0), expression.type);
  if (expression.type === 'SUBTRACT') return finite(values.slice(1).reduce((result, value) => result - value, values[0]!), expression.type);
  if (expression.type === 'MULTIPLY') return finite(values.reduce((result, value) => result * value, 1), expression.type);
  if (expression.type === 'DIVIDE') return finite(values.slice(1).reduce((result, value) => { if (value === 0) throw new Error('VALUE_DIVIDE_BY_ZERO'); return result / value }, values[0]!), expression.type);
  if (expression.type === 'MIN') return Math.min(...values);
  return Math.max(...values);
}

export function evaluateNumber(expression: number | ValueExpression | undefined, context: ValueEvaluationContext, fallback = 0) {
  if (expression === undefined) return fallback;
  return numeric(evaluateValue(expression, context), 'NUMBER_RESULT');
}
