import type { BattleParticipant } from '@mercenary/shared';
import type { EffectDefinition, JsonValue, TriggerContext } from './effect-types.js';

export interface ValidationIssue { code: string; path: string; message: string }
export type BattleCommand = EffectDefinition;
export interface DeterministicRng { next(): number; integer(maxExclusive: number): number }
export interface CustomAbilityExecutionContext {
  actor: Readonly<BattleParticipant>;
  enemy: Readonly<BattleParticipant>;
  triggeringEvent: Readonly<TriggerContext>;
  results: Readonly<Record<string, Readonly<object>>>;
  runtimeFlags: Readonly<Record<string, number | boolean | string>>;
  customState: Readonly<Record<string, JsonValue>>;
  rng: DeterministicRng;
  command: CustomCommandBuilder;
}
export interface CustomAbilityExecutionResult { commands: BattleCommand[]; statePatch?: Record<string, JsonValue>; presentationEvents?: Array<{ key: string; label?: string }> }
export interface CustomAbilityHandler {
  readonly id: string;
  validateDefinition?(parameters: JsonValue): ValidationIssue[];
  execute(context: Readonly<CustomAbilityExecutionContext>, parameters: JsonValue): CustomAbilityExecutionResult;
}
export interface CharacterServerModule { characterId: string; handlers: readonly CustomAbilityHandler[] }

export class CustomCommandBuilder {
  dealDamage(amount: number, target: 'self' | 'opponent' = 'opponent'): BattleCommand { return { type: 'deal_damage', target, amount } }
  heal(amount: number): BattleCommand { return { type: 'heal', target: 'self', amount } }
  addShield(amount: number): BattleCommand { return { type: 'gain_shield', target: 'self', amount } }
  modifyMana(amount: number): BattleCommand { return { type: 'gain_mana', target: 'self', amount } }
  consumeResource(resource: 'HP' | 'SHIELD' | 'MANA', amount: number, allowPartial = false): BattleCommand { return { type: 'consume_resource', target: 'self', resource, amount, allowPartial } }
  applyStatus(statusId: string, target: 'self' | 'opponent' = 'self'): BattleCommand { return { type: 'apply_status', target, statusId } }
  removeStatus(statusId: string, target: 'self' | 'opponent' = 'self'): BattleCommand { return { type: 'remove_status', target, statusId } }
  schedule(delayMs: number, effects: BattleCommand[]): BattleCommand { return { type: 'schedule_effects', delayMs, effects } }
  setRuntimeFlag(flag: string, value: number | boolean | string): BattleCommand { return { type: 'set_runtime_flag', flag, value } }
  clearRuntimeFlag(flag: string): BattleCommand { return { type: 'consume_runtime_flag', flag } }
  storeValue(key: string, value: number): BattleCommand { return { type: 'store_value', key, amount: value } }
}

function deepFreeze<T>(value: T): T { if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value)) deepFreeze(item) } return value }
export function assertJsonValue(value: unknown, path = '$', seen = new Set<object>()): asserts value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error(`CUSTOM_STATE_NON_FINITE:${path}`); return }
  if (typeof value !== 'object') throw new Error(`CUSTOM_STATE_NOT_JSON:${path}`);
  if (seen.has(value)) throw new Error(`CUSTOM_STATE_CYCLE:${path}`); seen.add(value);
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) throw new Error(`CUSTOM_STATE_NOT_PLAIN:${path}`);
  if (Array.isArray(value)) value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, seen)); else for (const [key, item] of Object.entries(value)) assertJsonValue(item, `${path}.${key}`, seen);
  seen.delete(value);
}

export class CustomHandlerRegistry {
  private readonly handlers = new Map<string, CustomAbilityHandler>();
  constructor(modules: readonly CharacterServerModule[] = []) {
    for (const module of modules) for (const handler of module.handlers) {
      if (!handler.id.startsWith(`${module.characterId}.`)) throw new Error(`CUSTOM_HANDLER_NAMESPACE:${handler.id}`);
      if (this.handlers.has(handler.id)) throw new Error(`CUSTOM_HANDLER_DUPLICATE:${handler.id}`);
      this.handlers.set(handler.id, Object.freeze(handler));
    }
  }
  has(id: string) { return this.handlers.has(id) }
  execute(id: string, context: CustomAbilityExecutionContext, parameters: JsonValue) {
    const handler = this.handlers.get(id); if (!handler) throw new Error(`CUSTOM_HANDLER_UNKNOWN:${id}`);
    const issues = handler.validateDefinition?.(parameters) ?? []; if (issues.length) throw new Error(`CUSTOM_HANDLER_DEFINITION:${id}:${issues[0]!.message}`);
    const result = handler.execute(deepFreeze(context), parameters);
    if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error(`CUSTOM_HANDLER_ASYNC:${id}`);
    if (!result || !Array.isArray(result.commands)) throw new Error(`CUSTOM_HANDLER_RESULT:${id}`);
    if (result.statePatch) { for (const [key, value] of Object.entries(result.statePatch)) { if (!key.startsWith(`${id.split('.')[0]}.`)) throw new Error(`CUSTOM_STATE_NAMESPACE:${key}`); assertJsonValue(value, key) } }
    return result;
  }
}

export function seededCustomRng(seed: number): DeterministicRng {
  let state = seed >>> 0;
  return { next() { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x1_0000_0000 }, integer(maxExclusive) { if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new Error('CUSTOM_RNG_RANGE'); return Math.floor(this.next() * maxExclusive) } };
}
