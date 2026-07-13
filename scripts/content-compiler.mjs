import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABILITY_ID, CONDITION_TYPES as CONDITION_TYPE_VALUES, EFFECT_TYPES as EFFECT_TYPE_VALUES, EVENT_PATHS as EVENT_PATH_VALUES, OPERATORS as OPERATOR_VALUES, PACKAGE_ID, RARITIES as RARITY_VALUES, RESULT_PATHS as RESULT_PATH_VALUES, ROLES as ROLE_VALUES, SUPPORTED_ENGINE_API_VERSION, SUPPORTED_SCHEMA_VERSION, TARGETS as TARGET_VALUES, TRIGGER_MAP, VALUE_TYPES as VALUE_TYPE_VALUES } from './content-schema-metadata.mjs';

export { ABILITY_ID, PACKAGE_ID, SUPPORTED_ENGINE_API_VERSION, SUPPORTED_SCHEMA_VERSION, TRIGGER_MAP } from './content-schema-metadata.mjs';
const RARITIES = new Set(RARITY_VALUES), ROLES = new Set(ROLE_VALUES), TARGETS = new Set(TARGET_VALUES), OPERATORS = new Set(OPERATOR_VALUES);
const EFFECTS = new Set(EFFECT_TYPE_VALUES), RESULT_PATHS = new Set(RESULT_PATH_VALUES), EVENT_PATHS = new Set(EVENT_PATH_VALUES), VALUE_TYPES = new Set(VALUE_TYPE_VALUES), CONDITION_TYPES = new Set(CONDITION_TYPE_VALUES);

const posix = (value) => value.split(path.sep).join('/');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stringify = (value) => `${JSON.stringify(stable(value), null, 2)}\n`;
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export class ContentCompilationError extends Error {
  constructor(issues) { super(`${issues.length} content issue(s)\n${issues.map(formatIssue).join('\n')}`); this.name = 'ContentCompilationError'; this.issues = issues }
}
export function formatIssue(issue) { return `[${issue.code}]\npackage: ${issue.packageId}\nfile: ${issue.file}\npath: ${issue.path}\n${issue.value === undefined ? '' : `value: ${JSON.stringify(issue.value)}\n`}message: ${issue.message}` }

function collector(root) {
  const issues = [];
  return {
    issues,
    add(code, packageId, file, jsonPath, message, value) { issues.push({ code, packageId, file: posix(path.relative(root, file || root)), path: jsonPath, message, value }) },
  };
}

function safeDeclaredFile(packageDir, declared, packageId, manifestFile, field, report) {
  if (typeof declared !== 'string' || !declared) { report.add('CONTENT_REQUIRED_FILE', packageId, manifestFile, `$.${field}`, 'A relative file path is required.', declared); return null }
  if (path.isAbsolute(declared) || declared.split(/[\\/]/).includes('..')) { report.add('CONTENT_PATH_ESCAPE', packageId, manifestFile, `$.${field}`, 'Declared files must stay inside the character package.', declared); return null }
  const resolved = path.resolve(packageDir, declared), relative = path.relative(packageDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) { report.add('CONTENT_PATH_ESCAPE', packageId, manifestFile, `$.${field}`, 'Declared files must stay inside the character package.', declared); return null }
  if (!existsSync(resolved)) { report.add('CONTENT_FILE_MISSING', packageId, manifestFile, `$.${field}`, `Declared file does not exist: ${declared}`, declared); return null }
  return resolved;
}

function validateValue(value, state, file, jsonPath, report) {
  if (!isObject(value) || !VALUE_TYPES.has(value.type)) { report.add('CONTENT_VALUE_TYPE', state.packageId, file, `${jsonPath}.type`, 'Unsupported ValueExpression type.', value?.type); return }
  if (value.type === 'CONSTANT') { if ((typeof value.value !== 'number' && typeof value.value !== 'string' && typeof value.value !== 'boolean') || (typeof value.value === 'number' && !Number.isFinite(value.value))) report.add('CONTENT_VALUE_CONSTANT', state.packageId, file, `${jsonPath}.value`, 'Constant must be a finite number, string, or boolean.', value.value); return }
  if (value.type === 'EVENT_VALUE') { if (!EVENT_PATHS.has(value.path)) report.add('CONTENT_EVENT_PATH', state.packageId, file, `${jsonPath}.path`, 'Unsupported event value path.', value.path); return }
  if (value.type === 'RESULT_VALUE') { if (!state.keys.has(value.resultKey)) report.add('CONTENT_RESULT_REFERENCE_ORDER', state.packageId, file, `${jsonPath}.resultKey`, 'Result key must be declared by an earlier effect.', value.resultKey); if (!RESULT_PATHS.has(value.path)) report.add('CONTENT_RESULT_PATH', state.packageId, file, `${jsonPath}.path`, 'Unsupported result path.', value.path); return }
  if (value.type === 'STAT') { if (!['SELF', 'ENEMY'].includes(value.target) || !['MAX_HP'].includes(value.stat)) report.add('CONTENT_STAT_VALUE', state.packageId, file, jsonPath, 'Unsupported stat expression.', value); return }
  if (value.type === 'RESOURCE') { if (!TARGETS.has(value.target) || !['HP', 'HP_RATIO', 'SHIELD', 'MANA'].includes(value.resource)) report.add('CONTENT_RESOURCE_VALUE', state.packageId, file, jsonPath, 'Unsupported resource expression.', value); return }
  if (['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'MIN', 'MAX'].includes(value.type)) {
    if (!Array.isArray(value.values) || value.values.length < 2) report.add('CONTENT_VALUE_OPERANDS', state.packageId, file, `${jsonPath}.values`, 'At least two operands are required.', value.values);
    else value.values.forEach((item, index) => validateValue(item, state, file, `${jsonPath}.values[${index}]`, report));
    if (value.type === 'DIVIDE' && value.values?.slice(1).some((item) => item?.type === 'CONSTANT' && item.value === 0)) report.add('CONTENT_DIVIDE_BY_ZERO', state.packageId, file, `${jsonPath}.values`, 'A constant zero divisor is forbidden. Runtime zero divisors fail explicitly.', value.values);
    return;
  }
  if (value.type === 'CLAMP') { validateValue(value.value, state, file, `${jsonPath}.value`, report); validateValue(value.min, state, file, `${jsonPath}.min`, report); validateValue(value.max, state, file, `${jsonPath}.max`, report); return }
  validateValue(value.value, state, file, `${jsonPath}.value`, report);
}

function validateCondition(value, state, file, jsonPath, report) {
  if (!isObject(value) || !CONDITION_TYPES.has(value.type)) { report.add('CONTENT_CONDITION_TYPE', state.packageId, file, `${jsonPath}.type`, 'Unsupported ConditionExpression type.', value?.type); return }
  if (value.type === 'COMPARE') { validateValue(value.left, state, file, `${jsonPath}.left`, report); validateValue(value.right, state, file, `${jsonPath}.right`, report); if (!OPERATORS.has(value.operator)) report.add('CONTENT_COMPARE_OPERATOR', state.packageId, file, `${jsonPath}.operator`, 'Unsupported comparison operator.', value.operator) }
  else if (value.type === 'AND' || value.type === 'OR') { if (!Array.isArray(value.conditions) || !value.conditions.length) report.add('CONTENT_CONDITION_CHILDREN', state.packageId, file, `${jsonPath}.conditions`, 'Logical conditions require children.', value.conditions); else value.conditions.forEach((item, index) => validateCondition(item, state, file, `${jsonPath}.conditions[${index}]`, report)) }
  else if (value.type === 'NOT') validateCondition(value.condition, state, file, `${jsonPath}.condition`, report);
  else if (value.type === 'RESULT_COMPARE') { if (!state.keys.has(value.resultKey)) report.add('CONTENT_RESULT_REFERENCE_ORDER', state.packageId, file, `${jsonPath}.resultKey`, 'Result key must be declared by an earlier effect.', value.resultKey); if (!RESULT_PATHS.has(value.path)) report.add('CONTENT_RESULT_PATH', state.packageId, file, `${jsonPath}.path`, 'Unsupported result path.', value.path); if (!OPERATORS.has(value.operator)) report.add('CONTENT_COMPARE_OPERATOR', state.packageId, file, `${jsonPath}.operator`, 'Unsupported comparison operator.', value.operator) }
  else if (value.type === 'EVENT_TYPE' && !Object.hasOwn(TRIGGER_MAP, value.event)) report.add('CONTENT_TRIGGER_EVENT', state.packageId, file, `${jsonPath}.event`, 'Unsupported canonical event.', value.event);
  else if (value.type === 'HAS_STATUS' && (typeof value.statusId !== 'string' || !value.statusId)) report.add('CONTENT_STATUS_ID', state.packageId, file, `${jsonPath}.statusId`, 'Status ID is required.', value.statusId);
  else if (value.type === 'HAS_TAG' && (typeof value.tag !== 'string' || !value.tag)) report.add('CONTENT_TAG', state.packageId, file, `${jsonPath}.tag`, 'Tag is required.', value.tag);
}

function validateEffects(effects, state, file, jsonPath, report, depth = 0) {
  if (!Array.isArray(effects)) { report.add('CONTENT_EFFECTS_REQUIRED', state.packageId, file, jsonPath, 'Effects must be an array.', effects); return }
  if (depth > 8) { report.add('CONTENT_EFFECT_DEPTH', state.packageId, file, jsonPath, 'Effects exceed the maximum nesting depth of 8.'); return }
  for (const [index, effect] of effects.entries()) {
    const at = `${jsonPath}[${index}]`;
    if (!isObject(effect) || !EFFECTS.has(effect.type)) { report.add('CONTENT_EFFECT_TYPE', state.packageId, file, `${at}.type`, 'Unsupported effect type.', effect?.type); continue }
    if (effect.target !== undefined && !TARGETS.has(effect.target)) report.add('CONTENT_EFFECT_TARGET', state.packageId, file, `${at}.target`, 'Target must be SELF or ENEMY.', effect.target);
    if (effect.condition) validateCondition(effect.condition, state, file, `${at}.condition`, report);
    for (const field of ['amount', 'shieldBypassPct']) if (effect[field] !== undefined) validateValue(effect[field], state, file, `${at}.${field}`, report);
    if (effect.type === 'IF') { validateCondition(effect.condition, state, file, `${at}.condition`, report); validateEffects(effect.then ?? [], { ...state, keys: new Set(state.keys) }, file, `${at}.then`, report, depth + 1); validateEffects(effect.else ?? [], { ...state, keys: new Set(state.keys) }, file, `${at}.else`, report, depth + 1) }
    if (effect.type === 'SCHEDULE') { if (!Number.isInteger(effect.delayMs) || effect.delayMs < 0) report.add('CONTENT_SCHEDULE_DELAY', state.packageId, file, `${at}.delayMs`, 'delayMs must be a non-negative integer.', effect.delayMs); validateEffects(effect.effects ?? [], { ...state, keys: new Set(state.keys) }, file, `${at}.effects`, report, depth + 1) }
    if (effect.type === 'CUSTOM') { if (typeof effect.handlerId !== 'string' || !effect.handlerId.startsWith(`${state.packageId}.`)) report.add('CONTENT_CUSTOM_NAMESPACE', state.packageId, file, `${at}.handlerId`, 'Custom handler ID must use the package namespace.', effect.handlerId); state.customHandlers.add(effect.handlerId) }
    if (effect.resultKey !== undefined) { if (state.keys.has(effect.resultKey)) report.add('CONTENT_DUPLICATE_RESULT_KEY', state.packageId, file, `${at}.resultKey`, 'Result key is already declared.', effect.resultKey); else state.keys.add(effect.resultKey) }
  }
}

function operator(value) { return ({ EQ: 'eq', NE: 'neq', GT: 'gt', GTE: 'gte', LT: 'lt', LTE: 'lte' })[value] }
function target(value) { return value === 'ENEMY' ? 'opponent' : 'self' }
function valueToRuntime(value) { return value?.type === 'CONSTANT' ? value.value : value }
function conditionToRuntime(value) {
  if (value.type === 'TRUE') return { type: 'all', conditions: [] };
  if (value.type === 'FALSE') return { type: 'not', condition: { type: 'all', conditions: [] } };
  if (value.type === 'AND' || value.type === 'OR') return { type: value.type === 'AND' ? 'all' : 'any', conditions: value.conditions.map(conditionToRuntime) };
  if (value.type === 'NOT') return { type: 'not', condition: conditionToRuntime(value.condition) };
  if (value.type === 'RESULT_COMPARE') return { type: 'effect_result_compare', effectKey: value.resultKey, field: value.path, operator: operator(value.operator), value: value.value };
  if (value.type === 'EVENT_SOURCE') return { type: 'source_type_is', value: value.source };
  if (value.type === 'HAS_TAG') return { type: 'source_has_tag', tag: value.tag };
  if (value.type === 'HAS_STATUS') return { type: value.negated ? 'target_lacks_status' : 'target_has_status', statusId: value.statusId };
  if (value.type === 'EVENT_TYPE') return { type: 'event_type_is', value: TRIGGER_MAP[value.event] };
  if (value.type === 'COMPARE') {
    const left = value.left, right = value.right, base = { operator: operator(value.operator), value: valueToRuntime(right) };
    if (left.type === 'EVENT_VALUE') return left.path === 'match.count' ? { type: 'matched_tile_count', ...base } : left.path === 'match.tileType' ? { type: 'tile_type_is', tileType: right.value } : left.path === 'damage.currentAmount' ? { type: 'incoming_damage', ...base } : left.path === 'damage.shieldBroken' ? { type: 'shield_was_broken', ...base } : left.path === 'hp.threshold' ? { type: 'hp_threshold_crossed', ...base, direction: 'downward' } : { type: 'expression_compare', left, right, operator: operator(value.operator) };
    if (left.type === 'RESOURCE') { const prefix = left.target === 'SELF' ? 'self' : 'opponent'; return left.resource === 'HP_RATIO' ? { type: `${prefix}_hp_ratio`, ...base } : left.resource === 'SHIELD' ? { type: `${prefix}_shield_amount`, ...base } : { type: 'expression_compare', left, right, operator: operator(value.operator) } }
    return { type: 'expression_compare', left, right, operator: operator(value.operator) };
  }
  return value;
}

function effectToRuntime(effect) {
  const common = { ...(effect.resultKey ? { key: effect.resultKey } : {}), ...(effect.target ? { target: target(effect.target) } : {}), ...(effect.condition ? { conditions: [conditionToRuntime(effect.condition)] } : {}) };
  if (effect.type === 'DAMAGE') return { type: 'deal_damage', ...common, amount: valueToRuntime(effect.amount), ...(effect.travelMs !== undefined ? { travelMs: effect.travelMs } : {}), ...(effect.shieldBypassPct ? { shieldBypassRatio: effect.shieldBypassPct.type === 'CONSTANT' ? effect.shieldBypassPct.value / 100 : { type: 'DIVIDE', values: [effect.shieldBypassPct, { type: 'CONSTANT', value: 100 }] } } : {}), ...(effect.tags ? { tags: effect.tags } : {}) };
  if (effect.type === 'HEAL') return { type: 'heal', ...common, amount: valueToRuntime(effect.amount) };
  if (effect.type === 'ADD_SHIELD') return { type: 'gain_shield', ...common, amount: valueToRuntime(effect.amount), ...(effect.scope ? { scope: 'chain_step' } : {}), ...(effect.cap !== undefined ? { cap: effect.cap } : {}) };
  if (effect.type === 'MODIFY_MANA') return { type: 'gain_mana', ...common, amount: valueToRuntime(effect.amount) };
  if (effect.type === 'APPLY_STATUS') return { type: 'apply_status', ...common, statusId: effect.statusId, ...(effect.durationMs !== undefined ? { durationMs: effect.durationMs } : {}) };
  if (effect.type === 'REMOVE_STATUS') return { type: 'remove_status', ...common, statusId: effect.statusId };
  if (effect.type === 'IF') return { type: 'conditional', conditions: [conditionToRuntime(effect.condition)], effects: effect.then.map(effectToRuntime), ...(effect.else?.length ? { elseEffects: effect.else.map(effectToRuntime) } : {}) };
  if (effect.type === 'SCHEDULE') return { type: 'schedule_effects', ...common, delayMs: effect.delayMs, effects: effect.effects.map(effectToRuntime) };
  if (effect.type === 'SET_RUNTIME_FLAG') return { type: 'set_runtime_flag', ...common, flag: effect.flag, value: effect.value };
  if (effect.type === 'CLEAR_RUNTIME_FLAG') return { type: 'consume_runtime_flag', ...common, flag: effect.flag };
  if (effect.type === 'CONVERT_OVERHEAL_TO_SHIELD') return { type: 'convert_overheal_to_shield', ...common, ratio: effect.ratio, maximum: effect.maximum };
  if (effect.type === 'CUSTOM') return { type: 'custom', ...common, handlerId: effect.handlerId, parameters: effect.parameters ?? {} };
  if (effect.type === 'CONSUME_RESOURCE') return { type: 'consume_resource', ...common, resource: effect.resource, amount: valueToRuntime(effect.amount), allowPartial: effect.allowPartial ?? false, canReduceHpBelowOne: effect.canReduceHpBelowOne ?? false };
  if (effect.type === 'STORE_VALUE') return { type: 'store_value', ...common, amount: valueToRuntime(effect.value) };
  if (effect.type === 'MODIFY_EVENT') return { type: 'modify_event_amount', ...common, amount: valueToRuntime(effect.amount), ratio: effect.ratio ?? 1 };
  throw new Error(`Unsupported normalized effect ${effect.type}`);
}

function normalizeAbility(value) {
  const conditions = value.activationCondition ? [conditionToRuntime(value.activationCondition)] : [];
  const triggerFilter = value.kind === 'SUPPORT' && value.trigger?.filter ? [conditionToRuntime(value.trigger.filter)] : [];
  return {
    id: value.id, kind: value.kind.toLowerCase(), name: value.displayName, shortDescription: value.shortDescription, fullDescription: value.fullDescription,
    trigger: { type: value.kind === 'ACTIVE' ? 'active_requested' : TRIGGER_MAP[value.trigger.event], ...(value.trigger?.leadTimeMs !== undefined ? { leadTimeMs: value.trigger.leadTimeMs } : {}) },
    cost: value.kind === 'ACTIVE' ? value.manaCost : 0, cooldownMs: value.kind === 'SUPPORT' ? value.cooldownMs ?? 0 : 0,
    oncePerBattle: value.kind === 'SUPPORT' && value.battleLimit === 1, maxTriggersPerBattle: value.kind === 'SUPPORT' ? value.battleLimit ?? null : null, chainLimit: value.kind === 'SUPPORT' ? value.chainLimit ?? null : null,
    conditions: [...triggerFilter, ...conditions], effects: value.effects.map(effectToRuntime), tags: value.tags ?? [], contentVersion: value.contentVersion ?? 1, enabled: value.enabled ?? true,
  };
}

function normalizeCharacter(value) {
  return { id: value.id, name: value.displayName, shortName: value.shortName, rarity: value.rarity, race: value.race, tags: value.tags, description: value.description.summary, enabled: value.enabled ?? true, starter: value.starter ?? false, contentVersion: value.contentVersion ?? 1, allowedSlots: value.allowedSlots, recommendedRole: value.recommendedRole, portraitAsset: value.portraitAsset, stats: value.stats, ...(value.defaultSlots ? { defaultSlots: value.defaultSlots } : {}), combatant: { skillId: value.activeAbilityId }, support: { effectId: value.supportAbilityId } };
}

function validateAbility(value, expectedKind, packageId, file, report, customHandlers) {
  if (!isObject(value)) { report.add('CONTENT_ABILITY_OBJECT', packageId, file, '$', 'Ability must be an object.', value); return null }
  if (!ABILITY_ID.test(value.id ?? '')) report.add('CONTENT_ABILITY_ID', packageId, file, '$.id', 'Ability ID must be stable lowercase identifier.', value.id);
  if (value.kind !== expectedKind) report.add('CONTENT_ABILITY_KIND', packageId, file, '$.kind', `Expected ${expectedKind}.`, value.kind);
  if (typeof value.displayName !== 'string' || !value.displayName) report.add('CONTENT_DISPLAY_NAME', packageId, file, '$.displayName', 'Ability displayName is required.', value.displayName);
  if (typeof value.shortDescription !== 'string' || typeof value.fullDescription !== 'string') report.add('CONTENT_ABILITY_DESCRIPTION', packageId, file, '$', 'Short and full descriptions are required.');
  if (value.copyPolicy !== undefined && value.copyPolicy !== 'DENY_COPIED') report.add('CONTENT_COPY_POLICY', packageId, file, '$.copyPolicy', 'Engine API 1 supports DENY_COPIED only.', value.copyPolicy);
  if (value.recursionPolicy !== undefined && value.recursionPolicy !== 'SAFE_DEFAULT') report.add('CONTENT_RECURSION_POLICY', packageId, file, '$.recursionPolicy', 'Engine API 1 supports SAFE_DEFAULT only.', value.recursionPolicy);
  if (expectedKind === 'ACTIVE' && (!Number.isInteger(value.manaCost) || value.manaCost < 0 || value.manaCost > 100)) report.add('CONTENT_MANA_COST', packageId, file, '$.manaCost', 'manaCost must be an integer from 0 to 100.', value.manaCost);
  if (expectedKind === 'SUPPORT') {
    if (!isObject(value.trigger) || !Object.hasOwn(TRIGGER_MAP, value.trigger.event)) report.add('CONTENT_TRIGGER_EVENT', packageId, file, '$.trigger.event', 'Unsupported canonical trigger event.', value.trigger?.event);
    if (value.trigger?.filter) validateCondition(value.trigger.filter, { packageId, keys: new Set() }, file, '$.trigger.filter', report);
    if (value.cooldownMs !== null && (!Number.isInteger(value.cooldownMs) || value.cooldownMs < 0)) report.add('CONTENT_COOLDOWN', packageId, file, '$.cooldownMs', 'cooldownMs must be null or a non-negative integer.', value.cooldownMs);
    if (value.battleLimit !== null && (!Number.isInteger(value.battleLimit) || value.battleLimit <= 0)) report.add('CONTENT_BATTLE_LIMIT', packageId, file, '$.battleLimit', 'battleLimit must be null or a positive integer.', value.battleLimit);
    if (value.chainLimit !== null && (!isObject(value.chainLimit) || !Number.isInteger(value.chainLimit.maxTriggers) || value.chainLimit.maxTriggers <= 0)) report.add('CONTENT_CHAIN_LIMIT', packageId, file, '$.chainLimit', 'chainLimit must be null or { maxTriggers: positive integer }.', value.chainLimit);
  }
  const state = { packageId, keys: new Set(), customHandlers };
  if (value.activationCondition) validateCondition(value.activationCondition, state, file, '$.activationCondition', report);
  validateEffects(value.effects, state, file, '$.effects', report);
  return value;
}

function validateCharacter(value, packageId, file, report) {
  if (!isObject(value)) { report.add('CONTENT_CHARACTER_OBJECT', packageId, file, '$', 'Character must be an object.', value); return null }
  if (value.id !== packageId) report.add('CONTENT_CHARACTER_ID', packageId, file, '$.id', 'Character ID must match manifest ID.', value.id);
  if (!RARITIES.has(value.rarity)) report.add('CONTENT_RARITY', packageId, file, '$.rarity', 'Rarity must be R, SR, SSR, or EX.', value.rarity);
  if (!ROLES.has(value.role)) report.add('CONTENT_ROLE', packageId, file, '$.role', 'Unsupported character role.', value.role);
  if (typeof value.race !== 'string' || !value.race.trim()) report.add('CONTENT_RACE', packageId, file, '$.race', 'race must be a non-empty string.', value.race);
  if (!isObject(value.stats) || !Number.isSafeInteger(value.stats.maxHp) || value.stats.maxHp <= 0) report.add('CONTENT_MAX_HP', packageId, file, '$.stats.maxHp', 'maxHp must be a positive safe integer.', value.stats?.maxHp);
  for (const field of ['swordEffectPct', 'shieldEffectPct', 'healEffectPct', 'manaGainPct']) if (!Number.isSafeInteger(value.stats?.[field]) || value.stats[field] < 0) report.add('CONTENT_STAT_PERCENT', packageId, file, `$.stats.${field}`, 'Percentage stats use non-negative safe integer 100 as the neutral multiplier.', value.stats?.[field]);
  if (!Array.isArray(value.allowedSlots) || !value.allowedSlots.every((slot) => ['combatant', 'support'].includes(slot))) report.add('CONTENT_ALLOWED_SLOTS', packageId, file, '$.allowedSlots', 'allowedSlots contains an unsupported slot.', value.allowedSlots);
  return value;
}

function validatePresentation(value, packageId, file, report, jsonPath = '$') {
  const forbidden = new Set(['damage', 'damageAmount', 'heal', 'healAmount', 'condition', 'effects', 'rng', 'winner', 'shieldAmount']);
  if (Array.isArray(value)) value.forEach((item, index) => validatePresentation(item, packageId, file, report, `${jsonPath}[${index}]`));
  else if (isObject(value)) for (const [key, item] of Object.entries(value)) { if (forbidden.has(key)) report.add('CONTENT_PRESENTATION_COMBAT_FIELD', packageId, file, `${jsonPath}.${key}`, 'presentation.json may contain presentation keys only.', key); else validatePresentation(item, packageId, file, report, `${jsonPath}.${key}`) }
}

export function compileContent({ root = path.resolve('content/characters'), generatedDir = path.resolve('apps/server/src/generated'), importBaseDir = generatedDir, write = true } = {}) {
  const report = collector(path.resolve('.')), packages = [], seenCharacters = new Map(), seenAbilities = new Map(), seenHandlers = new Map(), serverModules = [];
  if (!existsSync(root)) throw new ContentCompilationError([{ code: 'CONTENT_ROOT_MISSING', packageId: '(root)', file: posix(root), path: '$', message: 'Character content root does not exist.' }]);
  const directories = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const folder of directories) {
    const packageIssueStart = report.issues.length;
    const packageDir = path.join(root, folder), manifestFile = path.join(packageDir, 'manifest.json');
    if (!existsSync(manifestFile)) { report.add('CONTENT_MANIFEST_MISSING', folder, manifestFile, '$', 'Every character package requires manifest.json.'); continue }
    let manifest;
    try { manifest = readJson(manifestFile) } catch (error) { report.add('CONTENT_JSON_PARSE', folder, manifestFile, '$', `Cannot parse JSON: ${error.message}`); continue }
    const packageId = typeof manifest.id === 'string' ? manifest.id : folder;
    if (!PACKAGE_ID.test(packageId)) report.add('CONTENT_PACKAGE_ID', packageId, manifestFile, '$.id', 'Package ID must match ^[a-z][a-z0-9_]*$.', manifest.id);
    if (manifest.id !== folder) report.add('CONTENT_FOLDER_ID_MISMATCH', packageId, manifestFile, '$.id', 'Folder name and manifest ID must match.', manifest.id);
    if (manifest.schemaVersion !== SUPPORTED_SCHEMA_VERSION) report.add('CONTENT_SCHEMA_VERSION', packageId, manifestFile, '$.schemaVersion', `Supported schemaVersion is ${SUPPORTED_SCHEMA_VERSION}.`, manifest.schemaVersion);
    if (manifest.engineApiVersion !== SUPPORTED_ENGINE_API_VERSION) report.add('CONTENT_ENGINE_API_VERSION', packageId, manifestFile, '$.engineApiVersion', `Supported engineApiVersion is ${SUPPORTED_ENGINE_API_VERSION}.`, manifest.engineApiVersion);
    const characterFile = safeDeclaredFile(packageDir, manifest.characterFile, packageId, manifestFile, 'characterFile', report), activeFile = safeDeclaredFile(packageDir, manifest.activeFile, packageId, manifestFile, 'activeFile', report), supportFile = safeDeclaredFile(packageDir, manifest.supportFile, packageId, manifestFile, 'supportFile', report);
    const presentationFile = manifest.presentationFile ? safeDeclaredFile(packageDir, manifest.presentationFile, packageId, manifestFile, 'presentationFile', report) : null;
    const serverFile = manifest.serverModule ? safeDeclaredFile(packageDir, manifest.serverModule, packageId, manifestFile, 'serverModule', report) : null;
    if (!characterFile || !activeFile || !supportFile) continue;
    let character, active, support, presentation;
    try { character = readJson(characterFile) } catch (error) { report.add('CONTENT_JSON_PARSE', packageId, characterFile, '$', `Cannot parse JSON: ${error.message}`); continue }
    try { active = readJson(activeFile) } catch (error) { report.add('CONTENT_JSON_PARSE', packageId, activeFile, '$', `Cannot parse JSON: ${error.message}`); continue }
    try { support = readJson(supportFile) } catch (error) { report.add('CONTENT_JSON_PARSE', packageId, supportFile, '$', `Cannot parse JSON: ${error.message}`); continue }
    if (presentationFile) { try { presentation = readJson(presentationFile) } catch (error) { report.add('CONTENT_JSON_PARSE', packageId, presentationFile, '$', `Cannot parse JSON: ${error.message}`) } }
    if (presentationFile && presentation) validatePresentation(presentation, packageId, presentationFile, report);
    const customHandlers = new Set();
    validateCharacter(character, packageId, characterFile, report); validateAbility(active, 'ACTIVE', packageId, activeFile, report, customHandlers); validateAbility(support, 'SUPPORT', packageId, supportFile, report, customHandlers);
    if (character.activeAbilityId !== active.id) report.add('CONTENT_ACTIVE_REFERENCE', packageId, characterFile, '$.activeAbilityId', 'activeAbilityId must match active.json.', character.activeAbilityId);
    if (character.supportAbilityId !== support.id) report.add('CONTENT_SUPPORT_REFERENCE', packageId, characterFile, '$.supportAbilityId', 'supportAbilityId must match support.json.', character.supportAbilityId);
    if (seenCharacters.has(character.id)) report.add('CONTENT_DUPLICATE_CHARACTER_ID', packageId, characterFile, '$.id', `Character ID is already defined by ${seenCharacters.get(character.id)}.`, character.id); else seenCharacters.set(character.id, packageId);
    for (const [ability, file] of [[active, activeFile], [support, supportFile]]) { if (seenAbilities.has(ability.id)) report.add('CONTENT_DUPLICATE_ABILITY_ID', packageId, file, '$.id', `Ability ID is already defined by ${seenAbilities.get(ability.id)}.`, ability.id); else seenAbilities.set(ability.id, packageId) }
    if (customHandlers.size && !serverFile) report.add('CONTENT_CUSTOM_MODULE_REQUIRED', packageId, manifestFile, '$.serverModule', 'CUSTOM effects require a declared trusted server module.');
    if (serverFile) {
      const source = readFileSync(serverFile, 'utf8'), declaredHandlers = [...source.matchAll(/\bid\s*:\s*['"]([a-z][A-Za-z0-9_.]*)['"]/g)].map((match) => match[1]);
      for (const handlerId of declaredHandlers) { if (!handlerId.startsWith(`${packageId}.`)) report.add('CONTENT_CUSTOM_NAMESPACE', packageId, serverFile, '$.handlers', 'Handler ID must use the package namespace.', handlerId); if (seenHandlers.has(handlerId)) report.add('CONTENT_DUPLICATE_HANDLER_ID', packageId, serverFile, '$.handlers', `Handler ID is already defined by ${seenHandlers.get(handlerId)}.`, handlerId); else seenHandlers.set(handlerId, packageId) }
      for (const handlerId of customHandlers) if (!declaredHandlers.includes(handlerId)) report.add('CONTENT_CUSTOM_HANDLER_MISSING', packageId, serverFile, '$.handlers', 'CUSTOM handlerId is not exported by the declared module.', handlerId);
      serverModules.push({ packageId, file: serverFile, handlers: declaredHandlers.sort() });
    }
    if (report.issues.length === packageIssueStart) packages.push({ id: packageId, character: normalizeCharacter(character), stats: character.stats, active: normalizeAbility(active), support: normalizeAbility(support), presentation: presentation ?? null });
  }
  if (report.issues.length) throw new ContentCompilationError(report.issues);
  const normalized = { _generated: 'AUTO-GENERATED FILE. DO NOT EDIT.', schemaVersion: 1, engineApiVersion: 1, packages: packages.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
  const contentReport = { _generated: 'AUTO-GENERATED FILE. DO NOT EDIT.', packageCount: packages.length, characterCount: packages.length, abilityCount: packages.length * 2, customModuleCount: serverModules.length, packageIds: packages.map((item) => item.id) };
  if (write) {
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(path.join(generatedDir, 'normalized-content.generated.json'), stringify(normalized), 'utf8');
    writeFileSync(path.join(generatedDir, 'content-report.generated.json'), stringify(contentReport), 'utf8');
    const banner = '// AUTO-GENERATED FILE. DO NOT EDIT.\n';
    const effectTypesImport = posix(path.relative(importBaseDir, path.resolve('apps/server/src/effect-types.ts'))).replace(/^([^./])/, './$1').replace(/\.ts$/, '.js');
    writeFileSync(path.join(generatedDir, 'character-registry.generated.ts'), `${banner}import type { CharacterDefinition } from '@mercenary/shared';\nimport type { AbilityDefinition } from '${effectTypesImport}';\n\nexport const generatedCharacterDefinitions = ${JSON.stringify(packages.map((item) => item.character), null, 2)} as CharacterDefinition[];\nexport const generatedAbilityDefinitions = ${JSON.stringify(packages.flatMap((item) => [item.active, item.support]), null, 2)} as AbilityDefinition[];\nexport const generatedCharacterStats = ${JSON.stringify(Object.fromEntries(packages.map((item) => [item.id, item.stats])), null, 2)} as const;\nexport const generatedPresentation = ${JSON.stringify(Object.fromEntries(packages.filter((item) => item.presentation).map((item) => [item.id, item.presentation])), null, 2)} as const;\n`, 'utf8');
    const imports = serverModules.map((item, index) => `import { characterServerModule as module${index} } from '${posix(path.relative(importBaseDir, item.file)).replace(/^([^./])/, './$1').replace(/\.ts$/, '.js')}';`).join('\n');
    writeFileSync(path.join(generatedDir, 'custom-handler-registry.generated.ts'), `${banner}${imports}${imports ? '\n\n' : ''}export const generatedCharacterServerModules = [${serverModules.map((_item, index) => `module${index}`).join(', ')}] as const;\n`, 'utf8');
  }
  return { normalized, contentReport, serverModules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const validateOnly = process.argv.includes('--validate'), check = process.argv.includes('--check');
    let result;
    if (check) {
      const temporary = mkdtempSync(path.join(tmpdir(), 'mercenary-generated-'));
      const expectedDir = path.resolve('apps/server/src/generated');
      try { result = compileContent({ generatedDir: temporary, importBaseDir: expectedDir }); for (const file of ['character-registry.generated.ts', 'custom-handler-registry.generated.ts', 'normalized-content.generated.json', 'content-report.generated.json']) { const expected = path.join(expectedDir, file), actual = path.join(temporary, file); if (!existsSync(expected) || readFileSync(expected, 'utf8') !== readFileSync(actual, 'utf8')) throw new Error(`CONTENT_GENERATED_STALE:${file}`) } } finally { rmSync(temporary, { recursive: true, force: true }) }
    } else result = compileContent({ write: !validateOnly });
    console.log(`Validated ${result.contentReport.packageCount} character package(s) and ${result.contentReport.abilityCount} abilities.`);
  }
  catch (error) { console.error(error instanceof ContentCompilationError ? error.message : error); process.exitCode = 1 }
}
