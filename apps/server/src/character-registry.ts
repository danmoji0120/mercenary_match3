import { z } from 'zod';
import { resolveCombatantStats, type BattleLoadoutSnapshot, type CharacterDefinition, type CharacterId, type UserLoadout } from '@mercenary/shared';
import { ContentRegistry, loadContentRegistry } from './content-registry.js';
import { generatedAbilityDefinitions, generatedCharacterDefinitions } from './generated/character-registry.generated.js';
import { generatedCharacterServerModules } from './generated/custom-handler-registry.generated.js';
import { CustomHandlerRegistry } from './custom-ability.js';
import type { EffectDefinition } from './effect-types.js';

function customHandlerIds(effects: EffectDefinition[]): string[] { const result: string[] = []; for (const effect of effects) { if (effect.type === 'custom' && effect.handlerId) result.push(effect.handlerId); if (effect.effects) result.push(...customHandlerIds(effect.effects)); if (effect.elseEffects) result.push(...customHandlerIds(effect.elseEffects)) } return result }

const schema = z.object({
  id: z.string().regex(/^[a-z0-9_]{3,64}$/), name: z.string().min(1).max(80), shortName: z.string().min(1).max(30),
  rarity: z.enum(['R', 'SR', 'SSR', 'EX']), race: z.string().min(1).max(30), tags: z.array(z.string().min(1)).min(1),
  description: z.string().min(1).max(240), enabled: z.boolean(), starter: z.boolean(), contentVersion: z.number().int().positive(),
  allowedSlots: z.array(z.enum(['combatant', 'support'])).min(1), recommendedRole: z.enum(['combatant', 'support']), portraitAsset: z.union([z.literal(''), z.string().startsWith('/generated/characters/')]), assets: z.object({ portraitUrl: z.string().startsWith('/generated/characters/').optional(), portraitHash: z.string().regex(/^[a-f0-9]{12}$/).optional() }).strict().optional(),
  stats: z.object({ maxHp: z.number().int().positive(), swordEffectPct: z.number().int().nonnegative(), shieldEffectPct: z.number().int().nonnegative(), healEffectPct: z.number().int().nonnegative(), manaGainPct: z.number().int().nonnegative() }).strict(),
  defaultSlots: z.array(z.enum(['account_combatant', 'account_support_1', 'account_support_2', 'bot_combatant', 'bot_support_1', 'bot_support_2'])).optional(),
  combatant: z.object({ skillId: z.string().min(1) }), support: z.object({ effectId: z.string().min(1) }),
}).strict();

function loadoutFromGenerated(prefix: 'account' | 'bot'): UserLoadout { const pick = (slot: string) => { const matches = generatedCharacterDefinitions.filter((item) => item.defaultSlots?.includes(slot as NonNullable<CharacterDefinition['defaultSlots']>[number])); if (matches.length !== 1) throw new Error(`Expected exactly one ${slot} default character`); return matches[0]!.id }; return { combatantCharacterId: pick(`${prefix}_combatant`), supportCharacterId1: pick(`${prefix}_support_1`), supportCharacterId2: pick(`${prefix}_support_2`), loadoutVersion: 1 } }
export const DEFAULT_LOADOUT: UserLoadout = loadoutFromGenerated('account');
export const BOT_LOADOUT: UserLoadout = loadoutFromGenerated('bot');

export class CharacterRegistry {
  readonly all: readonly CharacterDefinition[];
  readonly enabled: readonly CharacterDefinition[];
  readonly starters: readonly CharacterDefinition[];
  private readonly byId: ReadonlyMap<CharacterId, CharacterDefinition>;
  constructor(definitions: CharacterDefinition[], readonly content: ContentRegistry = loadContentRegistry(undefined, generatedAbilityDefinitions), readonly customHandlers: CustomHandlerRegistry = new CustomHandlerRegistry()) {
    const parsed = definitions.map((value) => { const item = schema.parse({ ...value, combatant: { skillId: value.combatant.skillId }, support: { effectId: value.support.effectId } }) as CharacterDefinition; return Object.freeze({ ...item, stats: resolveCombatantStats(item.stats), combatant: Object.freeze({ ...item.combatant, ability: content.summary(item.combatant.skillId) }), support: Object.freeze({ ...item.support, ability: content.summary(item.support.effectId) }) }) });
    const ids = new Set<string>(); for (const item of parsed) { if (ids.has(item.id)) throw new Error(`Duplicate character id: ${item.id}`); ids.add(item.id) }
    this.all = Object.freeze(parsed); this.enabled = Object.freeze(parsed.filter((item) => item.enabled)); this.starters = Object.freeze(this.enabled.filter((item) => item.starter)); this.byId = new Map(parsed.map((item) => [item.id, item]));
    for (const ability of content.abilities.values()) for (const handlerId of customHandlerIds(ability.effects)) if (!customHandlers.has(handlerId)) throw new Error(`Unknown custom handler: ${handlerId}`);
    if (this.starters.length !== 5) throw new Error(`Expected 5 starter characters, received ${this.starters.length}`);
    this.validateLoadout(DEFAULT_LOADOUT, new Set(this.starters.map((item) => item.id)));
    this.validateLoadout(BOT_LOADOUT, new Set(this.enabled.map((item) => item.id)));
  }
  get(id: CharacterId) { return this.byId.get(id) }
  validateLoadout(loadout: UserLoadout, owned: ReadonlySet<CharacterId>): void {
    const slots = [loadout.combatantCharacterId, loadout.supportCharacterId1, loadout.supportCharacterId2];
    if (new Set(slots).size !== 3) throw new Error('A character cannot occupy multiple loadout slots');
    for (const [index, id] of slots.entries()) { const item = this.get(id); if (!item?.enabled) throw new Error('Loadout contains an unavailable character'); if (!owned.has(id)) throw new Error('Loadout contains an unowned character'); const slot = index === 0 ? 'combatant' : 'support'; if (!item.allowedSlots.includes(slot)) throw new Error(`Character is not allowed in ${slot}`) }
  }
  snapshot(loadout: UserLoadout): BattleLoadoutSnapshot {
    const convert = (id: string) => { const item = this.get(id); if (!item) throw new Error('Character not found'); return { characterId: item.id, name: item.name, portraitAsset: item.portraitAsset, rarity: item.rarity } };
    const combatant = this.get(loadout.combatantCharacterId); if (!combatant) throw new Error('Character not found');
    return { schemaVersion: 2, combatant: { ...convert(combatant.id), combatStats: { ...combatant.stats } }, supports: [convert(loadout.supportCharacterId1), convert(loadout.supportCharacterId2)] };
  }
}

let generatedRegistry: CharacterRegistry | null = null;
export function loadCharacterRegistry(): CharacterRegistry {
  generatedRegistry ??= new CharacterRegistry(generatedCharacterDefinitions, loadContentRegistry(undefined, generatedAbilityDefinitions), new CustomHandlerRegistry(generatedCharacterServerModules));
  return generatedRegistry;
}
