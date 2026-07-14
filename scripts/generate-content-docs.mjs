import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileContent } from './content-compiler.mjs';
import * as schema from './content-schema-metadata.mjs';

const root = path.resolve('.');
const outputJson = path.resolve('apps/server/src/generated/content-capabilities.generated.json');
const outputMarkdown = path.resolve('docs/skill-framework-reference.generated.md');
const read = (file) => readFileSync(path.resolve(file), 'utf8');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const json = (value) => `${JSON.stringify(stable(value), null, 2)}\n`;
const sorted = (values) => [...new Set(values)].sort();

function quotedValues(source, pattern) { return sorted([...source.matchAll(pattern)].map((match) => match[1])); }
function runtimeEvidence() {
  const registrySource = read('apps/server/src/content-registry.ts'), engineSource = read('apps/server/src/effect-engine.ts');
  const battleSource = read('apps/server/src/battle.ts'), typeSource = read('apps/server/src/effect-types.ts'), builderSource = read('apps/server/src/custom-ability.ts'), emitterSource = read('apps/server/src/trigger-emitters.ts');
  const registryEffectsBlock = registrySource.match(/const EFFECT_TYPES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  const registryConditionsBlock = registrySource.match(/const CONDITION_TYPES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  const triggerBlock = typeSource.match(/TRIGGER_TYPES = \[([\s\S]*?)\] as const/)?.[1] ?? '';
  const originBlock = typeSource.match(/export type EffectOriginType = ([^;]+);/)?.[1] ?? '';
  const builderBlock = builderSource.match(/export class CustomCommandBuilder \{([\s\S]*?)\n\}/)?.[1] ?? '';
  const production = JSON.parse(read('apps/server/src/generated/normalized-content.generated.json'));
  const fixture = JSON.parse(read('apps/server/tests/fixtures/generated/normalized-content.generated.json'));
  const used = new Set(); const collect = (effects) => { for (const effect of effects ?? []) { used.add(effect.type); collect(effect.effects); collect(effect.elseEffects) } };
  for (const document of [production, fixture]) for (const item of document.packages ?? []) { collect(item.active.effects); collect(item.support.effects) }
  const testEvidence = recursiveText(path.resolve('apps/server/tests')), coverageBlock = testEvidence.match(/RUNTIME_EFFECT_FIXTURE_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const/)?.[1] ?? '';
  const publicEmitterCall = /(?:emitPublic|emitOpponentPublic|emitPublicForBoth)\('([^']+)'/g;
  const emittedEvents = sorted([...battleSource.matchAll(publicEmitterCall), ...engineSource.matchAll(publicEmitterCall)].map((match) => match[1]));
  return {
    allowedRuntimeEffects: quotedValues(registryEffectsBlock, /'([^']+)'/g),
    allowedRuntimeConditions: quotedValues(registryConditionsBlock, /'([^']+)'/g),
    executorEffects: quotedValues(engineSource, /effect\.type === '([^']+)'/g),
    triggerTypes: quotedValues(triggerBlock, /'([^']+)'/g),
    emittedEvents,
    emittedTriggers: sorted(emittedEvents.map((event) => schema.TRIGGER_MAP[event]).filter(Boolean)),
    canonicalEmitterEvents: sorted([...emitterSource.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1])),
    originTypes: quotedValues(originBlock, /'([^']+)'/g),
    customCommands: sorted([...builderBlock.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\(/gm)].map((match) => match[1])),
    verifiedRuntimeEffects: sorted([...used, ...quotedValues(coverageBlock, /'([a-z_]+)'/g)]),
  };
}

function recursiveText(directory) { return readdirSync(directory, { withFileTypes: true }).map((entry) => entry.isDirectory() ? recursiveText(path.join(directory, entry.name)) : /\.(?:json|ts)$/.test(entry.name) ? readFileSync(path.join(directory, entry.name), 'utf8') : '').join('\n') }

const constant = (value) => ({ type: 'CONSTANT', value });
const examples = Object.freeze({
  simpleActiveDamage: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(180) }] } },
  shieldBypassAttack: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(180), shieldBypassPct: constant(30), resultKey: 'hit' }] } },
  healAndShield: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'HEAL', target: 'SELF', amount: constant(100) }, { type: 'ADD_SHIELD', target: 'SELF', amount: constant(50) }] } },
  hpConditional: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'IF', condition: { type: 'COMPARE', left: { type: 'RESOURCE', target: 'SELF', resource: 'HP_RATIO' }, operator: 'LTE', right: constant(0.3) }, then: [{ type: 'HEAL', target: 'SELF', amount: constant(120) }], else: [] }] } },
  consumedShieldDamage: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'CONSUME_RESOURCE', target: 'SELF', resource: 'SHIELD', amount: constant(160), allowPartial: true, canReduceHpBelowOne: false, resultKey: 'shieldCost' }, { type: 'DAMAGE', target: 'ENEMY', amount: { type: 'ADD', values: [constant(150), { type: 'MULTIPLY', values: [{ type: 'RESULT_VALUE', resultKey: 'shieldCost', path: 'consumedAmount' }, constant(1.2)] }] } }] } },
  scheduledFollowup: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(100) }, { type: 'SCHEDULE', delayMs: 250, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(50) }] }] } },
  swordFourSupport: { kind: 'SUPPORT', ability: { trigger: { event: 'TILE_MATCH_RESOLVED', filter: { type: 'AND', conditions: [{ type: 'COMPARE', left: { type: 'EVENT_VALUE', path: 'match.tileType' }, operator: 'EQ', right: constant('SWORD') }, { type: 'COMPARE', left: { type: 'EVENT_VALUE', path: 'match.count' }, operator: 'GTE', right: constant(4) }] } }, cooldownMs: 0, battleLimit: null, chainLimit: { maxTriggers: 1 }, effects: [{ type: 'ADD_SHIELD', target: 'SELF', amount: constant(40) }] } },
  shieldBrokenSupport: { kind: 'SUPPORT', ability: { trigger: { event: 'SHIELD_BROKEN' }, cooldownMs: 9000, battleLimit: null, chainLimit: null, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(75) }] } },
  shieldBrokenResult: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(180), resultKey: 'mainHit' }, { type: 'IF', condition: { type: 'RESULT_COMPARE', resultKey: 'mainHit', path: 'shieldBroken', operator: 'EQ', value: true }, then: [{ type: 'ADD_SHIELD', target: 'SELF', amount: constant(50) }], else: [] }] } },
  customHandler: { kind: 'ACTIVE', custom: true, ability: { manaCost: 100, effects: [{ type: 'CUSTOM', handlerId: 'example_character.handler', parameters: { shield: 10 } }] } },
  manaModification: { kind: 'ACTIVE', ability: { manaCost: 0, effects: [{ type: 'MODIFY_MANA', target: 'SELF', amount: constant(10), resultKey: 'manaGain' }] } },
  statusApplyAndRemove: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'APPLY_STATUS', target: 'SELF', statusId: 'damage_reduction', durationMs: 1000, resultKey: 'applied' }, { type: 'REMOVE_STATUS', target: 'SELF', statusId: 'damage_reduction' }] } },
  runtimeFlags: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'SET_RUNTIME_FLAG', flag: 'example.flag', value: true, resultKey: 'setFlag' }, { type: 'CLEAR_RUNTIME_FLAG', flag: 'example.flag', resultKey: 'clearedFlag' }] } },
  storedValue: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'STORE_VALUE', scope: 'BATTLE', key: 'example.stored', operation: 'SET', value: constant(42), resultKey: 'stored' }, { type: 'ADD_SHIELD', target: 'SELF', amount: { type: 'RUNTIME_VALUE', scope: 'BATTLE', target: 'SELF', key: 'example.stored', defaultValue: constant(0) } }] } },
  eventModification: { kind: 'SUPPORT', ability: { trigger: { event: 'BEFORE_ATTACK_IMPACT' }, cooldownMs: 0, battleLimit: null, chainLimit: null, effects: [{ type: 'MODIFY_EVENT', path: 'damage.currentAmount', operation: 'MULTIPLY', value: constant(0.8), resultKey: 'modified' }] } },
  overhealConversion: { kind: 'ACTIVE', ability: { manaCost: 100, effects: [{ type: 'HEAL', target: 'SELF', amount: constant(100), resultKey: 'heal' }, { type: 'CONVERT_OVERHEAL_TO_SHIELD', target: 'SELF', condition: { type: 'RESULT_COMPARE', resultKey: 'heal', path: 'overhealing', operator: 'GT', value: 0 }, ratio: 0.5, maximum: 50 }] } },
});

function completeAbility(kind, id, partial) {
  return { id, kind, displayName: `Example ${kind}`, shortDescription: 'Generated valid example.', fullDescription: 'Validated by the current content compiler.', ...partial, tags: partial.tags ?? ['defense'], copyPolicy: 'DENY_COPIED', recursionPolicy: 'SAFE_DEFAULT', contentVersion: 1, enabled: true };
}

function validateExamples() {
  const temporary = mkdtempSync(path.join(tmpdir(), 'mercenary-capability-examples-'));
  try {
    const validationCases = [...Object.entries(examples), ...Object.keys(schema.TRIGGER_MAP).map((event) => [`trigger_${event.toLowerCase()}`, { kind: 'SUPPORT', ability: triggerExample(event) }])];
    for (const [index, [name, example]] of validationCases.entries()) {
      const packageId = `docs_example_${String(index + 1).padStart(2, '0')}`, packageDir = path.join(temporary, packageId); mkdirSync(packageDir, { recursive: true });
      const replaceHandler = (value) => JSON.parse(JSON.stringify(value).replaceAll('example_character.handler', `${packageId}.handler`));
      const exampleAbility = replaceHandler(example.ability); delete exampleAbility.id;
      const active = example.kind === 'ACTIVE' ? completeAbility('ACTIVE', `${packageId}_active`, exampleAbility) : completeAbility('ACTIVE', `${packageId}_active`, { manaCost: 100, effects: [{ type: 'DAMAGE', target: 'ENEMY', amount: constant(1) }] });
      const support = example.kind === 'SUPPORT' ? completeAbility('SUPPORT', `${packageId}_support`, exampleAbility) : completeAbility('SUPPORT', `${packageId}_support`, { trigger: { event: 'BATTLE_STARTED' }, cooldownMs: 0, battleLimit: null, chainLimit: null, effects: [{ type: 'ADD_SHIELD', target: 'SELF', amount: constant(1) }] });
      const manifest = { id: packageId, schemaVersion: 1, engineApiVersion: 1, characterFile: './character.json', activeFile: './active.json', supportFile: './support.json', ...(example.custom ? { serverModule: './server.ts' } : {}) };
      const character = { id: packageId, displayName: name, shortName: name, rarity: 'R', race: 'TEST', role: 'SUPPORT', combatStyle: 'TEST', stats: { maxHp: 1000, swordEffectPct: 100, shieldEffectPct: 100, healEffectPct: 100, manaGainPct: 100 }, activeAbilityId: active.id, supportAbilityId: support.id, tags: ['TEST'], description: { summary: name, details: name }, enabled: true, starter: false, contentVersion: 1, allowedSlots: ['combatant', 'support'], recommendedRole: 'support', assets: {} };
      for (const [file, value] of [['manifest.json', manifest], ['character.json', character], ['active.json', active], ['support.json', support]]) writeFileSync(path.join(packageDir, file), json(value), 'utf8');
      if (example.custom) writeFileSync(path.join(packageDir, 'server.ts'), `export const characterServerModule = { characterId: '${packageId}', handlers: [{ id: '${packageId}.handler', execute() { return { commands: [] }; } }] };\n`, 'utf8');
      compileContent({ root: temporary, write: false });
      rmSync(packageDir, { recursive: true, force: true });
    }
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}

function exampleForEffect(type) {
  const find = (effects) => { for (const effect of effects ?? []) { if (effect.type === type) return effect; const nested = find(effect.then) ?? find(effect.else) ?? find(effect.effects); if (nested) return nested } };
  for (const example of Object.values(examples)) { const found = find(example.ability.effects); if (found) return found }
  throw new Error(`CONTENT_DOCS_EFFECT_EXAMPLE_MISSING:${type}`);
}

function valueExample(type) {
  const unary = { type, value: constant(2.4) }, values = { type, values: [constant(6), constant(2)] };
  if (type === 'CONSTANT') return constant(180);
  if (type === 'STAT') return { type, target: 'SELF', stat: 'MAX_HP' };
  if (type === 'RESOURCE') return { type, target: 'SELF', resource: 'HP_RATIO' };
  if (type === 'EVENT_VALUE') return { type, path: 'match.count' };
  if (type === 'RESULT_VALUE') return { type, resultKey: 'previous', path: 'finalAmount' };
  if (type === 'RUNTIME_VALUE') return { type, scope: 'BATTLE', target: 'SELF', key: 'example.counter', defaultValue: constant(0) };
  if (['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'MIN', 'MAX'].includes(type)) return values;
  if (type === 'CLAMP') return { type, value: constant(5), min: constant(0), max: constant(10) };
  return unary;
}

function conditionExample(type) {
  if (type === 'TRUE' || type === 'FALSE') return { type };
  if (type === 'COMPARE') return { type, left: { type: 'RESOURCE', target: 'SELF', resource: 'HP_RATIO' }, operator: 'LTE', right: constant(0.3) };
  if (type === 'AND' || type === 'OR') return { type, conditions: [{ type: 'TRUE' }, { type: 'FALSE' }] };
  if (type === 'NOT') return { type, condition: { type: 'FALSE' } };
  if (type === 'HAS_STATUS') return { type, target: 'ENEMY', statusId: 'damage_reduction' };
  if (type === 'HAS_TAG') return { type, source: 'EVENT_SOURCE', tag: 'offense' };
  if (type === 'EVENT_TYPE') return { type, event: 'BATTLE_STARTED' };
  if (type === 'EVENT_SOURCE') return { type, source: 'enemy_attack' };
  return { type, resultKey: 'previous', path: 'shieldBroken', operator: 'EQ', value: true };
}

function triggerExample(event) {
  return completeAbility('SUPPORT', 'example_support', { trigger: { event }, cooldownMs: 0, battleLimit: null, chainLimit: null, effects: [{ type: 'ADD_SHIELD', target: 'SELF', amount: constant(10) }] });
}

const triggerDescriptions = Object.freeze({
  ACTIVE_USED: { timing: 'after an active ability is accepted', actor: 'active ability owner', target: 'opponent', payload: ['skillId', 'serverTime'] },
  AFTER_DAMAGE: { timing: 'after', actor: 'attacker', target: 'damaged participant', payload: ['shieldBefore', 'shieldAfter', 'hpBefore', 'hpAfter', 'shieldBroken'] },
  BATTLE_STARTED: { timing: 'after countdown', actor: 'each participant', target: 'opponent', payload: ['serverTime'] },
  BEFORE_ATTACK_IMPACT: { timing: 'before impact (within 150ms)', actor: 'defender/support owner', target: 'attacker', payload: ['attackId', 'currentAmount', 'sourceType', 'sourceTags'] },
  DEFEATED: { timing: 'after result decided', actor: 'each participant', target: 'opponent', payload: ['serverTime'] },
  HP_THRESHOLD_CROSSED: { timing: 'after damage', actor: 'damaged participant', target: 'attacker', payload: ['hpThresholdCrossed'] },
  SHIELD_GAINED: { timing: 'after enemy actual shield gain is known', actor: 'opposing support owner', target: 'shield recipient', payload: ['shieldRequestedAmount', 'shieldActualAmount', 'shieldOvercapAmount', 'shieldBefore', 'shieldAfter'] },
  SHIELD_BROKEN: { timing: 'after damage', actor: 'damaged participant', target: 'attacker', payload: ['shieldBroken', 'shieldBefore', 'shieldAfter'] },
  STATUS_REMOVED: { timing: 'after removal and before status runtime-value cleanup', actor: 'both support owners', target: 'status owner or counterpart', payload: ['statusId', 'statusPreviousStacks', 'statusRemovalReason', 'statusWasExpired'] },
  TILE_MATCH_RESOLVED: { timing: 'after base tile effects are applied', actor: 'board owner', target: 'opponent', payload: ['tileType', 'matchedTileCount', 'chainLevel', 'scopeKey'] },
});

function statusCapabilities() {
  const directory = path.resolve('content/core/statuses');
  return Object.fromEntries(readFileNames(directory).map((file) => { const value = JSON.parse(readFileSync(path.join(directory, file), 'utf8')); return [value.id, { name: value.name, durationMs: value.durationMs, stacking: value.stacking, maxStacks: value.maxStacks, refreshPolicy: value.refreshPolicy, consumePolicy: value.consumePolicy, modifiers: value.modifiers, triggers: value.triggers, snapshot: 'statusId, source/target participant, stackCount, expiresAt' }] }));
}
function readFileNames(directory) { return existsSync(directory) ? readdirSync(directory).filter((file) => file.endsWith('.json')).sort() : [] }

function buildManifest() {
  validateExamples();
  const evidence = runtimeEvidence(), emitted = new Set(evidence.emittedTriggers), executors = new Set(evidence.executorEffects), allowedRuntime = new Set(evidence.allowedRuntimeEffects);
  const verified = new Set(evidence.verifiedRuntimeEffects);
  const effects = Object.fromEntries(schema.EFFECT_TYPES.map((type) => { const runtimeType = schema.EFFECT_RUNTIME_MAP[type], fields = schema.EFFECT_FIELDS[type], executable = runtimeType && allowedRuntime.has(runtimeType) && executors.has(runtimeType); return [type, { supportStatus: executable && verified.has(runtimeType) ? 'SUPPORTED' : executable ? 'RUNTIME_PATH_PRESENT_UNVERIFIED' : runtimeType && allowedRuntime.has(runtimeType) ? 'VALIDATION_ONLY_UNSUPPORTED_RUNTIME' : 'UNSUPPORTED', runtimeType, requiredFields: fields.required, optionalFields: fields.optional, targetValues: [...fields.required, ...fields.optional].includes('target') ? schema.TARGETS : [], amountType: fields.required.includes('amount') || fields.optional.includes('amount') ? 'ValueExpression' : null, conditionSupported: [...fields.required, ...fields.optional].includes('condition'), resultKeySupported: fields.optional.includes('resultKey'), resultSchema: fields.returns ? schema.RESULT_SCHEMAS[fields.returns] ?? [] : [], exampleValidatorStatus: 'PASSED', example: exampleForEffect(type), note: fields.note ?? null }] }));
  const triggers = Object.fromEntries(Object.entries(schema.TRIGGER_MAP).sort(([a], [b]) => a.localeCompare(b)).map(([event, runtimeType]) => [event, { runtimeType, supportStatus: emitted.has(runtimeType) && evidence.canonicalEmitterEvents.includes(event) ? 'EMITTED_AND_SUPPORTED' : evidence.triggerTypes.includes(runtimeType) ? 'TYPE_DEFINED_NOT_EMITTED' : 'UNSUPPORTED', eventPaths: Object.entries(schema.EVENT_PATH_CAPABILITIES).filter(([, detail]) => detail.availableEvents.includes(event)).map(([pathName]) => pathName).sort(), ...(triggerDescriptions[event] ?? { timing: 'See canonical trigger emitter registry.', actor: 'support owner', target: 'event counterpart', payload: [] }), originType: 'Inherited from the triggering effect when present', exampleValidatorStatus: 'PASSED', example: triggerExample(event) }]));
  const resources = Object.fromEntries(schema.RESOURCES.map((resource) => [resource, { readable: true, modifiable: resource !== 'HP_RATIO', consumable: schema.CONSUMABLE_RESOURCES.includes(resource) }]));
  const runtimeInternalEffects = evidence.allowedRuntimeEffects.filter((type) => !Object.values(schema.EFFECT_RUNTIME_MAP).includes(type)).map((type) => ({ type, supportStatus: executors.has(type) ? 'RUNTIME_INTERNAL_ONLY' : 'VALIDATION_ONLY_UNSUPPORTED_RUNTIME' }));
  return stable({
    formatVersion: 1, schemaVersion: schema.SUPPORTED_SCHEMA_VERSION, engineApiVersion: schema.SUPPORTED_ENGINE_API_VERSION,
    generatedWarning: 'AUTO-GENERATED FILE. DO NOT EDIT.',
    sources: ['scripts/content-schema-metadata.mjs', 'scripts/content-compiler.mjs', 'apps/server/src/content-registry.ts', 'apps/server/src/effect-engine.ts', 'apps/server/src/effect-types.ts', 'apps/server/src/custom-ability.ts'],
    idRules: { packageIdPattern: schema.PACKAGE_ID.source, characterId: 'must equal package and folder ID', abilityIdPattern: schema.ABILITY_ID.source, customHandlerNamespaceRequired: true, requiredFiles: ['manifest.json', 'character.json', 'active.json', 'support.json'], optionalFiles: ['presentation.json', 'server.ts'], pathTraversalForbidden: true, globalDuplicatesRejected: ['characterId', 'abilityId', 'customHandlerId'] },
    character: { fields: schema.CHARACTER_FIELDS, portraitPolicy: { optional: true, acceptedFormats: ['PNG', 'JPEG', 'WebP'], maximumBytes: 8388608, source: 'package-local path only', output: '/generated/characters/<characterId>/portrait.<sha256-12>.<ext>', fallback: 'shared CSS portrait fallback when omitted or load fails', svgPackageAssets: 'unsupported' }, statsPolicy: { boardOwner: 'combatant slot only', neutralPercentage: 100, rounding: 'Math.round after match-size, chain, and frenzy calculation', appliesTo: ['base SWORD tile damage', 'base SHIELD tile shield', 'base HEAL tile healing', 'base MANA tile gain'], doesNotApplyTo: ['active effects', 'support effects', 'status effects', 'scheduled effects', 'custom commands'] } },
    abilities: { fields: schema.ABILITY_FIELDS, cooldownUnit: 'milliseconds', battleLimit: 'null or positive integer', chainLimit: 'null or {maxTriggers: positive integer}; enforced per runtimeKey and scopeKey' },
    targets: schema.TARGETS, tileTypes: parseSharedTileTypes(), resources, stats: schema.STATS, roles: schema.ROLES, rarities: schema.RARITIES,
    runtimeValues: { keyPattern: schema.RUNTIME_VALUE_KEY.source, scopes: schema.RUNTIME_VALUE_SCOPES, operations: schema.RUNTIME_VALUE_OPERATIONS, explicitDefaultRequired: true, valueType: 'finite number', lifecycle: { BATTLE: 'cleared when battle runtime finishes', ABILITY: 'namespaced by the executing ability and cleared with battle runtime', STATUS: 'readable during STATUS_REMOVED dispatch, then cleared with the status', CHAIN: 'cleared when the current chain completes' }, snapshot: 'deterministically sorted and restored; missing legacy field becomes an empty store' },
    operators: { comparison: schema.OPERATORS }, valueExpressions: Object.fromEntries(schema.VALUE_TYPES.map((type) => [type, { ...schema.VALUE_FIELDS[type], example: valueExample(type) }])), conditions: Object.fromEntries(schema.CONDITION_TYPES.map((type) => [type, { ...schema.CONDITION_FIELDS[type], example: conditionExample(type) }])),
    effects, runtimeInternalEffects, triggers, eventPaths: schema.EVENT_PATH_CAPABILITIES, resultSchemas: schema.RESULT_SCHEMAS, resultPathAllowlist: schema.RESULT_PATHS,
    statuses: { idPattern: '^[a-z0-9_]+$', durationUnit: 'milliseconds', refreshPolicies: ['extend', 'ignore', 'refresh', 'replace', 'stack'], definitions: statusCapabilities(), snapshot: 'StatusSnapshot stores id, source/target, stackCount, expiresAt and visibility.' },
    customHandlers: { serverModule: '{ characterId, handlers[] }', trustedInternalOnly: true, runtimeSandbox: false, commands: schema.CUSTOM_COMMANDS, detectedBuilderCommands: evidence.customCommands, context: ['actor', 'enemy', 'triggeringEvent', 'results', 'runtimeFlags', 'customState', 'rng', 'command'], result: ['commands', 'statePatch?', 'presentationEvents?'], presentationEvents: 'Type field exists, but BattleEffectEngine currently ignores returned presentationEvents.', constraints: ['synchronous only', 'commands only; no direct battle mutation', 'JSON-only namespaced statePatch', 'seeded context.rng only', 'file system/network/database/environment/timers are forbidden by trusted-code contract, not sandbox enforcement'] },
    policies: { copy: schema.COPY_POLICIES, copyPolicyRuntimeUse: 'validated then dropped by the normalizer; no copy primitive currently exists', recursion: schema.RECURSION_POLICIES, recursionPolicyRuntimeUse: 'validated then dropped; hard engine safety rules apply', originTypes: evidence.originTypes, maximumGenerationDepth: 8, copiedEffectsCanBeCopiedAgain: false, convertedEffectsCanBeConvertedAgain: false, sameSupportSelfRetriggerBlocked: true, scheduledRootEventPreserved: true, customRootEventPreserved: true, copyAndConversionPrimitives: 'metadata only; no package Effect primitive' },
    examples: Object.fromEntries(Object.entries(examples).map(([name, value]) => [name, { kind: value.kind, ability: value.ability, validatorStatus: 'PASSED' }])),
    unsupportedFeatures: schema.UNSUPPORTED_FEATURES,
    evidence: { runtimeTriggerTypes: evidence.triggerTypes, canonicalEmitterEvents: evidence.canonicalEmitterEvents, emittedPublicEvents: evidence.emittedEvents, emittedRuntimeTriggers: evidence.emittedTriggers, runtimeAllowedEffects: evidence.allowedRuntimeEffects, runtimeExecutorEffects: evidence.executorEffects, runtimeVerifiedEffects: evidence.verifiedRuntimeEffects, runtimeConditions: evidence.allowedRuntimeConditions },
  });
}

function parseSharedTileTypes() { return quotedValues(read('packages/shared/src/types.ts').match(/TILE_TYPES = \[([^\]]+)\]/)?.[1] ?? '', /'([^']+)'/g) }
const list = (values) => values.length ? values.map((value) => `\`${value}\``).join(', ') : 'none';
const cell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
const table = (headers, rows) => `| ${headers.map(cell).join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n')}\n`;
function markdown(manifest) {
  const effectRows = Object.entries(manifest.effects).map(([name, item]) => [name, item.supportStatus, list(item.requiredFields), list(item.optionalFields), list(item.resultSchema), item.note ?? '']);
  const triggerRows = Object.entries(manifest.triggers).map(([name, item]) => [name, item.supportStatus, item.runtimeType, list(item.eventPaths)]);
  const valueRows = Object.entries(manifest.valueExpressions).map(([name, item]) => [name, list(item.required), item.returns ?? 'number', list(item.errors ?? [])]);
  const conditionRows = Object.entries(manifest.conditions).map(([name, item]) => [name, list(item.required), list(item.optional ?? []), 'Compiler validation errors are explicit.']);
  const fieldRows = Object.entries(manifest.character.fields).map(([name, item]) => [name, item.type, item.required ? 'yes' : 'no', item.validation, item.runtime]);
  const statusRows = Object.entries(manifest.statuses.definitions).map(([id, item]) => [id, item.durationMs, item.refreshPolicy, item.maxStacks, item.modifiers.map((value) => `${value.type}:${value.value}`).join(', ') || '—']);
  const exampleSections = Object.entries(manifest.examples).map(([name, item]) => `### ${name}\n\nValidator: **${item.validatorStatus}**\n\n\`\`\`json\n${JSON.stringify(item.ability, null, 2)}\n\`\`\``).join('\n\n');
  const valueExamples = Object.entries(manifest.valueExpressions).map(([name, item]) => `#### ${name}\n\n\`\`\`json\n${JSON.stringify(item.example, null, 2)}\n\`\`\``).join('\n\n');
  const conditionExamples = Object.entries(manifest.conditions).map(([name, item]) => `#### ${name}\n\n\`\`\`json\n${JSON.stringify(item.example, null, 2)}\n\`\`\``).join('\n\n');
  const effectExamples = Object.entries(manifest.effects).map(([name, item]) => `### ${name}\n\nStatus: **${item.supportStatus}**; runtime type: \`${item.runtimeType}\`.\n\n\`\`\`json\n${JSON.stringify(item.example, null, 2)}\n\`\`\``).join('\n\n');
  const triggerExamples = Object.entries(manifest.triggers).map(([name, item]) => `### ${name}\n\nStatus: **${item.supportStatus}**. Timing: ${item.timing}. Actor: ${item.actor}. Target: ${item.target}.\n\n\`\`\`json\n${JSON.stringify(item.example, null, 2)}\n\`\`\``).join('\n\n');
  return `<!-- AUTO-GENERATED FILE. DO NOT EDIT. Run npm run content:docs. -->
# Skill Framework Capability Reference

This reference is generated from the current compiler allowlists, runtime registry, executor branches, trigger dispatch calls, status data, and custom command builder. It is descriptive output and is not a combat authority source.

## 1. Content package overview

Required files: ${list(manifest.idRules.requiredFiles)}. Optional files: ${list(manifest.idRules.optionalFiles)}. Package pattern: \`${manifest.idRules.packageIdPattern}\`. Schema/API versions: ${manifest.schemaVersion}/${manifest.engineApiVersion}.

## 2. character.json

${table(['JSON path', 'Type', 'Required', 'Validation', 'Runtime use'], fieldRows)}
Stats are taken only from the combatant slot. Percentage 100 is neutral. Board tile calculation is match size -> chain -> frenzy -> rounding -> character percentage -> existing modifiers. Ability fixed values are not automatically scaled.

## 3. active.json

${table(['Field', 'Type', 'Required', 'Default/note'], Object.entries(manifest.abilities.fields.ACTIVE).map(([name, item]) => [name, item.type, item.required ? 'yes' : 'no', String(item.default ?? item.note ?? '')]))}

## 4. support.json

${table(['Field', 'Type', 'Required', 'Default/note'], Object.entries(manifest.abilities.fields.SUPPORT).map(([name, item]) => [name, item.type, item.required ? 'yes' : 'no', String(item.default ?? item.runtimeDefaultWhenNull ?? item.note ?? '')]))}

## 5. ValueExpression

${table(['Name', 'Required fields', 'Returns', 'Runtime errors'], valueRows)}
Division by zero throws \`VALUE_DIVIDE_BY_ZERO\`. Non-finite results throw. RESULT_VALUE keys must be declared earlier in the current effect scope. EVENT_VALUE availability is event-specific.

Runtime value keys match \`${manifest.runtimeValues.keyPattern}\`. Scopes: ${list(manifest.runtimeValues.scopes)}. Operations: ${list(manifest.runtimeValues.operations)}. Missing reads require an explicit default expression. Battle/ability values live for the battle, status values are cleared after removal dispatch, and chain values are cleared when the chain completes. The store is part of the deterministic effect snapshot.

${valueExamples}

## 6. ConditionExpression

${table(['Name', 'Required fields', 'Optional fields', 'Failure policy'], conditionRows)}
Operators: ${list(manifest.operators.comparison)}.

${conditionExamples}

## 7. Effect list

${table(['Name', 'Support status', 'Required fields', 'Optional fields', 'Result paths', 'Notes'], effectRows)}
Only **SUPPORTED** entries have package validation, an executor path, and current production/fixture runtime evidence. **RUNTIME_PATH_PRESENT_UNVERIFIED** entries have validator and executor branches but no current runtime content/fixture evidence. Runtime-internal effects are listed only in the machine manifest.

${effectExamples}

## 8. Trigger events

${table(['Event', 'Status', 'Runtime type', 'Available EVENT_VALUE paths'], triggerRows)}
\`TYPE_DEFINED_NOT_EMITTED\` events pass the current package validator but are not normal support-authoring capabilities because battle runtime does not dispatch them.

${triggerExamples}

## 9. Event payload paths

${table(['Path', 'Type', 'Available emitted events', 'Note'], Object.entries(manifest.eventPaths).map(([name, item]) => [name, item.type, list(item.availableEvents), item.note ?? '']))}

## 10. Effect result paths

${table(['Effect', 'Paths'], Object.entries(manifest.resultSchemas).map(([name, paths]) => [name, list(paths)]))}
Asynchronous DAMAGE results are available to deferred result conditions after impact. Result keys are lexical to the compiled effect tree; SCHEDULE receives a copied result store, while independent ability activations do not share result stores.

## 11. Target, Resource, Stat, and TileType

Targets: ${list(manifest.targets)}. Tile types: ${list(manifest.tileTypes)}. Runtime stats: ${list(manifest.stats)}.

${table(['Resource', 'Readable', 'Modifiable', 'Consumable'], Object.entries(manifest.resources).map(([name, item]) => [name, item.readable, item.modifiable, item.consumable]))}

## 12. Status

${table(['ID', 'Duration ms', 'Refresh', 'Max stacks', 'Modifiers'], statusRows)}
Statuses are serialized with source/target, stack count, and expiration. Status definition triggers exist in the runtime type but current status files contain no trigger-driven executor path of their own.

## 13. Custom handler

Available command builder methods: ${list(Object.keys(manifest.customHandlers.commands))}. Handlers are synchronous, receive readonly cloned battle views and seeded RNG, return commands, and may return JSON-only namespaced state patches. This is trusted internal build-time code, not a sandbox. Direct mutation, async work, timers, filesystem, network, database, and environment access are forbidden by contract. The return type declares presentationEvents, but the current executor ignores that field.

## 14. Recursion prevention

Origin fields: \`eventId\`, \`rootEventId\`, \`parentEventId\`, \`sourceCharacterId\`, \`sourceAbilityId\`, \`originType\`, \`generationDepth\`, \`canTriggerSupport\`, \`canBeCopied\`, \`canBeConverted\`. Maximum depth: ${manifest.policies.maximumGenerationDepth}. Copy/conversion metadata exists, but package copy/conversion primitives do not.

## 15. Snapshot rules

Scheduled origin, statuses, cooldowns, once/battle counts, chain counts, runtime flags, custom JSON state, combat stats, and RNG state are serialized. Restoration uses snapshot combat stats and does not re-read current registry stats.

## 16. Valid examples

${exampleSections}

## 17. Currently unsupported

${table(['Feature', 'Status', 'Required/missing'], manifest.unsupportedFeatures.map((item) => [item.feature, item.status, list(item.requiredEvents ?? [])]))}

## 18. New character checklist

1. Create a package folder whose name matches manifest.id.
2. Add manifest.json, character.json, active.json, and support.json.
3. Add presentation.json or trusted server.ts only when required.
4. Run \`npm run content:generate\` and \`npm run content:docs\`.
5. Run \`npm run content:check\` and the test suite before build.
`;
}

export function generateContentDocs({ write = true } = {}) {
  const manifest = buildManifest(), jsonText = json(manifest), markdownText = markdown(manifest);
  if (write) { mkdirSync(path.dirname(outputJson), { recursive: true }); mkdirSync(path.dirname(outputMarkdown), { recursive: true }); writeFileSync(outputJson, jsonText, 'utf8'); writeFileSync(outputMarkdown, markdownText, 'utf8') }
  return { manifest, jsonText, markdownText };
}

export function checkContentDocs() {
  const generated = generateContentDocs({ write: false });
  for (const [file, expected] of [[outputJson, generated.jsonText], [outputMarkdown, generated.markdownText]]) if (!existsSync(file) || readFileSync(file, 'utf8') !== expected) throw new Error(`CONTENT_DOCS_STALE:${path.relative(root, file)}. Run npm run content:docs.`);
  return generated;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const result = process.argv.includes('--check') ? checkContentDocs() : generateContentDocs(); console.log(`Generated capability reference for ${Object.keys(result.manifest.effects).length} effects and ${Object.keys(result.manifest.triggers).length} triggers.`) }
  catch (error) { console.error(error); process.exitCode = 1 }
}
