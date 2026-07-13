import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { AbilitySummary } from '@mercenary/shared';
import { TRIGGER_TYPES, type AbilityDefinition, type ConditionDefinition, type EffectDefinition, type StatusDefinition } from './effect-types.js';

const trigger = z.object({ type: z.enum(TRIGGER_TYPES), leadTimeMs: z.number().int().nonnegative().optional() }).strict();
const condition: z.ZodType<ConditionDefinition> = z.lazy(() => z.object({ type: z.string().min(1), operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']).optional(), value: z.union([z.number(), z.boolean(), z.string()]).optional(), field: z.string().optional(), tag: z.string().optional(), statusId: z.string().optional(), tileType: z.enum(['SWORD', 'SHIELD', 'HEAL', 'MANA']).optional(), effectKey: z.string().optional(), direction: z.enum(['upward', 'downward']).optional(), conditions: z.array(condition).optional(), condition: condition.optional() }).strict());
const effect: z.ZodType<EffectDefinition> = z.lazy(() => z.object({ type: z.string().min(1), key: z.string().optional(), target: z.enum(['self', 'opponent']).optional(), amount: z.number().optional(), ratio: z.number().optional(), maximum: z.number().optional(), durationMs: z.number().int().nonnegative().optional(), statusId: z.string().optional(), delayMs: z.number().int().nonnegative().optional(), effects: z.array(effect).optional(), conditions: z.array(condition).optional(), message: z.string().optional(), scope: z.literal('chain_step').optional(), cap: z.number().optional(), tags: z.array(z.string()).optional(), travelMs: z.number().int().nonnegative().optional(), shieldBypassRatio: z.number().min(0).max(0.5).optional(), initialCharges: z.number().int().nonnegative().optional(), flag: z.string().optional(), value: z.union([z.number(), z.boolean(), z.string()]).optional() }).strict());
const abilitySchema = z.object({ id: z.string().regex(/^[a-z0-9_]+$/), kind: z.enum(['active', 'support']), name: z.string().min(1), shortDescription: z.string().min(1), fullDescription: z.string().min(1), trigger, cost: z.number().int().min(0).max(100), cooldownMs: z.number().int().nonnegative(), oncePerBattle: z.boolean(), maxTriggersPerBattle: z.number().int().positive().nullable(), conditions: z.array(condition), effects: z.array(effect).min(1), tags: z.array(z.enum(['offense', 'defense', 'heal', 'disruption', 'shield', 'execute'])), contentVersion: z.number().int().positive(), enabled: z.boolean() }).strict();
const statusSchema = z.object({ id: z.string().regex(/^[a-z0-9_]+$/), name: z.string().min(1), description: z.string().min(1), durationMs: z.number().int().positive(), stacking: z.enum(['replace', 'refresh', 'extend', 'stack', 'ignore']), maxStacks: z.number().int().positive(), refreshPolicy: z.enum(['replace', 'refresh', 'extend', 'stack', 'ignore']), consumePolicy: z.object({ type: z.enum(['on_next_outgoing_damage', 'on_next_incoming_attack']), consumeAfter: z.enum(['damage_created', 'attack_arrived']) }).strict().nullable(), modifiers: z.array(z.object({ type: z.enum(['incoming_damage_multiplier', 'outgoing_damage_multiplier', 'healing_received_multiplier', 'shield_gain_multiplier', 'shield_bypass_bonus']), value: z.number().nonnegative() }).strict()), triggers: z.array(trigger), visibleToOwner: z.boolean(), visibleToOpponent: z.boolean(), contentVersion: z.number().int().positive() }).strict();
const EFFECT_TYPES = new Set(['deal_damage', 'gain_shield', 'heal', 'gain_mana', 'apply_status', 'remove_status', 'refresh_status', 'modify_event_amount', 'set_shield_bypass_ratio', 'grant_charge', 'consume_charge', 'schedule_effects', 'conditional', 'convert_overheal_to_shield', 'emit_battle_message', 'cap_value', 'set_runtime_flag', 'consume_runtime_flag', 'cancel_current_effect']);
const CONDITION_TYPES = new Set(['compare_number', 'compare_ratio', 'tile_type_is', 'matched_tile_count', 'source_type_is', 'source_has_tag', 'target_has_status', 'target_lacks_status', 'self_hp_ratio', 'self_shield_amount', 'opponent_hp_ratio', 'opponent_shield_amount', 'incoming_damage', 'shield_was_broken', 'hp_threshold_crossed', 'cooldown_ready', 'charge_available', 'once_per_battle_available', 'effect_result_compare', 'any', 'all', 'not']);

function jsonFiles(root: string) { if (!readdirSync(root, { withFileTypes: true }).length) return []; const result: string[] = []; for (const entry of readdirSync(root, { withFileTypes: true })) { const file = path.join(root, entry.name); if (entry.isDirectory()) result.push(...jsonFiles(file)); else if (entry.name.endsWith('.json')) result.push(file) } return result }
function walkEffects(effects: EffectDefinition[], visit: (effect: EffectDefinition, earlierKeys: Set<string>) => void, earlier = new Set<string>(), depth = 0) { if (depth > 8) throw new Error('Scheduled or conditional effects exceed maximum nesting'); for (const item of effects) { visit(item, earlier); if (item.key) { if (earlier.has(item.key)) throw new Error(`Duplicate effect key: ${item.key}`); earlier.add(item.key) } if (item.effects) walkEffects(item.effects, visit, new Set(earlier), depth + 1) } }
function walkConditions(values: ConditionDefinition[], visit: (condition: ConditionDefinition) => void) { for (const value of values) { visit(value); if (value.conditions) walkConditions(value.conditions, visit); if (value.condition) walkConditions([value.condition], visit) } }

export class ContentRegistry {
  readonly abilities: ReadonlyMap<string, AbilityDefinition>;
  readonly statuses: ReadonlyMap<string, StatusDefinition>;
  constructor(abilities: AbilityDefinition[], statuses: StatusDefinition[]) {
    const parsedAbilities = abilities.map((value) => abilitySchema.parse(value) as AbilityDefinition), parsedStatuses = statuses.map((value) => statusSchema.parse(value) as StatusDefinition);
    this.abilities = new Map(parsedAbilities.map((value) => [value.id, Object.freeze(value)])); this.statuses = new Map(parsedStatuses.map((value) => [value.id, Object.freeze(value)]));
    if (this.abilities.size !== parsedAbilities.length) throw new Error('Duplicate ability id'); if (this.statuses.size !== parsedStatuses.length) throw new Error('Duplicate status id');
    for (const ability of parsedAbilities) {
      walkConditions(ability.conditions, (item) => { if (!CONDITION_TYPES.has(item.type)) throw new Error(`Unknown condition type: ${item.type}`); if (item.statusId && !this.statuses.has(item.statusId)) throw new Error(`Unknown status: ${item.statusId}`) });
      walkEffects(ability.effects, (item, keys) => { if (!EFFECT_TYPES.has(item.type)) throw new Error(`Unknown effect type: ${item.type}`); if (item.statusId && !this.statuses.has(item.statusId)) throw new Error(`Unknown status: ${item.statusId}`); if (item.conditions) walkConditions(item.conditions, (value) => { if (!CONDITION_TYPES.has(value.type)) throw new Error(`Unknown condition type: ${value.type}`); if (value.effectKey && !keys.has(value.effectKey)) throw new Error(`Effect result references a non-earlier key: ${value.effectKey}`) }) });
    }
  }
  ability(id: string) { const value = this.abilities.get(id); if (!value?.enabled) throw new Error(`Unknown enabled ability: ${id}`); return value }
  status(id: string) { const value = this.statuses.get(id); if (!value) throw new Error(`Unknown status: ${id}`); return value }
  summary(id: string): AbilitySummary { const value = this.ability(id); return { id: value.id, kind: value.kind, name: value.name, shortDescription: value.shortDescription, fullDescription: value.fullDescription, cost: value.cost, cooldownMs: value.cooldownMs, tags: [...value.tags] } }
}

export function loadContentRegistry(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../content/core')) {
  const abilities = jsonFiles(path.join(root, 'abilities')).map((file) => JSON.parse(readFileSync(file, 'utf8')) as AbilityDefinition);
  const statuses = jsonFiles(path.join(root, 'statuses')).map((file) => JSON.parse(readFileSync(file, 'utf8')) as StatusDefinition);
  return new ContentRegistry(abilities, statuses);
}
