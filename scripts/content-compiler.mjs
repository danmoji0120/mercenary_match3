import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABILITY_ID, CONDITION_TYPES as CONDITION_TYPE_VALUES, EFFECT_TYPES as EFFECT_TYPE_VALUES, EVENT_PATHS as EVENT_PATH_VALUES, OPERATORS as OPERATOR_VALUES, PACKAGE_ID, RARITIES as RARITY_VALUES, RESULT_PATHS as RESULT_PATH_VALUES, ROLES as ROLE_VALUES, RUNTIME_VALUE_KEY, RUNTIME_VALUE_OPERATIONS, RUNTIME_VALUE_SCOPES, SUPPORTED_ENGINE_API_VERSION, SUPPORTED_SCHEMA_VERSION, TARGETS as TARGET_VALUES, TRIGGER_MAP, VALUE_TYPES as VALUE_TYPE_VALUES } from './content-schema-metadata.mjs';

export { ABILITY_ID, PACKAGE_ID, SUPPORTED_ENGINE_API_VERSION, SUPPORTED_SCHEMA_VERSION, TRIGGER_MAP } from './content-schema-metadata.mjs';
const RARITIES = new Set(RARITY_VALUES), ROLES = new Set(ROLE_VALUES), TARGETS = new Set(TARGET_VALUES), OPERATORS = new Set(OPERATOR_VALUES);
const EFFECTS = new Set(EFFECT_TYPE_VALUES), RESULT_PATHS = new Set(RESULT_PATH_VALUES), EVENT_PATHS = new Set(EVENT_PATH_VALUES), VALUE_TYPES = new Set(VALUE_TYPE_VALUES), CONDITION_TYPES = new Set(CONDITION_TYPE_VALUES);
const RUNTIME_SCOPES = new Set(RUNTIME_VALUE_SCOPES), RUNTIME_OPERATIONS = new Set(RUNTIME_VALUE_OPERATIONS), PORTRAIT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
export const MAX_PORTRAIT_BYTES = 8 * 1024 * 1024;

const posix = (value) => value.split(path.sep).join('/');
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stringify = (value) => `${JSON.stringify(stable(value), null, 2)}\n`;
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
function relativeFiles(root) { if (!existsSync(root)) return []; const result = []; for (const entry of readdirSync(root, { withFileTypes: true })) { const file = path.join(root, entry.name); if (entry.isDirectory()) result.push(...relativeFiles(file).map((child) => `${entry.name}/${child}`)); else result.push(entry.name) } return result.sort() }

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

function portraitAsset(value, packageDir, packageId, characterFile, report) {
  const declared = value?.assets?.portrait;
  if (declared === undefined) return null;
  if (typeof declared !== 'string' || !declared || /^(?:https?:|data:)/i.test(declared) || path.isAbsolute(declared) || declared.split(/[\\/]/).includes('..')) { report.add('CONTENT_PORTRAIT_PATH', packageId, characterFile, '$.assets.portrait', 'Portrait must be a package-local relative path.', declared); return null }
  const source = path.resolve(packageDir, declared), relative = path.relative(packageDir, source), extension = path.extname(source).toLowerCase();
  if (relative.startsWith('..') || path.isAbsolute(relative)) { report.add('CONTENT_PORTRAIT_ESCAPE', packageId, characterFile, '$.assets.portrait', 'Portrait path escapes the character package.', declared); return null }
  if (!PORTRAIT_EXTENSIONS.has(extension)) { report.add('CONTENT_PORTRAIT_EXTENSION', packageId, characterFile, '$.assets.portrait', 'Portrait must be PNG, JPEG, or WebP.', extension); return null }
  if (!existsSync(source)) { report.add('CONTENT_PORTRAIT_MISSING', packageId, characterFile, '$.assets.portrait', 'Portrait file does not exist.', declared); return null }
  const packageReal = realpathSync(packageDir), sourceReal = realpathSync(source), realRelative = path.relative(packageReal, sourceReal);
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative) || lstatSync(source).isSymbolicLink()) { report.add('CONTENT_PORTRAIT_SYMLINK_ESCAPE', packageId, characterFile, '$.assets.portrait', 'Portrait symlinks and paths outside the package are forbidden.', declared); return null }
  const size = statSync(source).size;
  if (size > MAX_PORTRAIT_BYTES) { report.add('CONTENT_PORTRAIT_SIZE', packageId, characterFile, '$.assets.portrait', `Portrait exceeds ${MAX_PORTRAIT_BYTES} bytes.`, size); return null }
  const bytes = readFileSync(source), validSignature = extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) : extension === '.jpg' || extension === '.jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!validSignature) { report.add('CONTENT_PORTRAIT_SIGNATURE', packageId, characterFile, '$.assets.portrait', 'Portrait signature does not match its extension.', declared); return null }
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12), outputRelative = `${packageId}/portrait.${hash}${extension}`;
  return { source, outputRelative, portraitUrl: `/generated/characters/${outputRelative}`, portraitHash: hash };
}

function validateValue(value, state, file, jsonPath, report, allowRuntimeValue = true) {
  if (!isObject(value) || !VALUE_TYPES.has(value.type)) { report.add('CONTENT_VALUE_TYPE', state.packageId, file, `${jsonPath}.type`, 'Unsupported ValueExpression type.', value?.type); return }
  if (value.type === 'CONSTANT') { if ((typeof value.value !== 'number' && typeof value.value !== 'string' && typeof value.value !== 'boolean') || (typeof value.value === 'number' && !Number.isFinite(value.value))) report.add('CONTENT_VALUE_CONSTANT', state.packageId, file, `${jsonPath}.value`, 'Constant must be a finite number, string, or boolean.', value.value); return }
  if (value.type === 'EVENT_VALUE') { if (!EVENT_PATHS.has(value.path)) report.add('CONTENT_EVENT_PATH', state.packageId, file, `${jsonPath}.path`, 'Unsupported event value path.', value.path); return }
  if (value.type === 'RESULT_VALUE') { if (!state.keys.has(value.resultKey)) report.add('CONTENT_RESULT_REFERENCE_ORDER', state.packageId, file, `${jsonPath}.resultKey`, 'Result key must be declared by an earlier effect.', value.resultKey); if (!RESULT_PATHS.has(value.path)) report.add('CONTENT_RESULT_PATH', state.packageId, file, `${jsonPath}.path`, 'Unsupported result path.', value.path); return }
  if (value.type === 'RUNTIME_VALUE') { if (!allowRuntimeValue) report.add('CONTENT_RUNTIME_DEFAULT_RECURSION', state.packageId, file, jsonPath, 'RUNTIME_VALUE defaultValue cannot contain another RUNTIME_VALUE.'); if (!RUNTIME_SCOPES.has(value.scope)) report.add('CONTENT_RUNTIME_SCOPE', state.packageId, file, `${jsonPath}.scope`, 'Unsupported runtime value scope.', value.scope); if (!TARGETS.has(value.target)) report.add('CONTENT_EFFECT_TARGET', state.packageId, file, `${jsonPath}.target`, 'Target must be SELF or ENEMY.', value.target); if (!RUNTIME_VALUE_KEY.test(value.key ?? '')) report.add('CONTENT_RUNTIME_KEY', state.packageId, file, `${jsonPath}.key`, 'Runtime value key is invalid.', value.key); if (value.scope === 'STATUS' && (typeof value.statusId !== 'string' || !value.statusId)) report.add('CONTENT_RUNTIME_STATUS', state.packageId, file, `${jsonPath}.statusId`, 'STATUS runtime values require statusId.', value.statusId); if (value.defaultValue === undefined) report.add('CONTENT_RUNTIME_DEFAULT', state.packageId, file, `${jsonPath}.defaultValue`, 'RUNTIME_VALUE requires an explicit defaultValue.'); else validateValue(value.defaultValue, state, file, `${jsonPath}.defaultValue`, report, false); return }
  if (value.type === 'STAT') { if (!['SELF', 'ENEMY'].includes(value.target) || !['MAX_HP'].includes(value.stat)) report.add('CONTENT_STAT_VALUE', state.packageId, file, jsonPath, 'Unsupported stat expression.', value); return }
  if (value.type === 'RESOURCE') { if (!TARGETS.has(value.target) || !['HP', 'HP_RATIO', 'SHIELD', 'MANA'].includes(value.resource)) report.add('CONTENT_RESOURCE_VALUE', state.packageId, file, jsonPath, 'Unsupported resource expression.', value); return }
  if (['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'MIN', 'MAX'].includes(value.type)) {
    if (!Array.isArray(value.values) || value.values.length < 2) report.add('CONTENT_VALUE_OPERANDS', state.packageId, file, `${jsonPath}.values`, 'At least two operands are required.', value.values);
    else value.values.forEach((item, index) => validateValue(item, state, file, `${jsonPath}.values[${index}]`, report, allowRuntimeValue));
    if (value.type === 'DIVIDE' && value.values?.slice(1).some((item) => item?.type === 'CONSTANT' && item.value === 0)) report.add('CONTENT_DIVIDE_BY_ZERO', state.packageId, file, `${jsonPath}.values`, 'A constant zero divisor is forbidden. Runtime zero divisors fail explicitly.', value.values);
    return;
  }
  if (value.type === 'CLAMP') { validateValue(value.value, state, file, `${jsonPath}.value`, report, allowRuntimeValue); validateValue(value.min, state, file, `${jsonPath}.min`, report, allowRuntimeValue); validateValue(value.max, state, file, `${jsonPath}.max`, report, allowRuntimeValue); return }
  validateValue(value.value, state, file, `${jsonPath}.value`, report, allowRuntimeValue);
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
    for (const field of ['value', 'minimum', 'maximum']) if (isObject(effect[field]) && effect[field].type) validateValue(effect[field], state, file, `${at}.${field}`, report);
    if (effect.type === 'IF') { validateCondition(effect.condition, state, file, `${at}.condition`, report); validateEffects(effect.then ?? [], { ...state, keys: new Set(state.keys) }, file, `${at}.then`, report, depth + 1); validateEffects(effect.else ?? [], { ...state, keys: new Set(state.keys) }, file, `${at}.else`, report, depth + 1) }
    if (effect.type === 'SCHEDULE') { if (!Number.isInteger(effect.delayMs) || effect.delayMs < 0) report.add('CONTENT_SCHEDULE_DELAY', state.packageId, file, `${at}.delayMs`, 'delayMs must be a non-negative integer.', effect.delayMs); validateEffects(effect.effects ?? [], { ...state, keys: new Set(state.keys) }, file, `${at}.effects`, report, depth + 1) }
    if (effect.type === 'CUSTOM') { if (typeof effect.handlerId !== 'string' || !effect.handlerId.startsWith(`${state.packageId}.`)) report.add('CONTENT_CUSTOM_NAMESPACE', state.packageId, file, `${at}.handlerId`, 'Custom handler ID must use the package namespace.', effect.handlerId); state.customHandlers.add(effect.handlerId) }
    if (effect.type === 'CONSUME_RESOURCE') { if (!['HP', 'SHIELD', 'MANA'].includes(effect.resource)) report.add('CONTENT_CONSUME_RESOURCE', state.packageId, file, `${at}.resource`, 'CONSUME_RESOURCE supports HP, SHIELD, or MANA.', effect.resource); if (effect.amount === undefined) report.add('CONTENT_EFFECT_AMOUNT', state.packageId, file, `${at}.amount`, 'CONSUME_RESOURCE requires amount.') }
    if (effect.type === 'REMOVE_STATUS') { const hasStatus = typeof effect.statusId === 'string' && Boolean(effect.statusId), hasFilter = effect.filter?.tag === 'BUFF' || effect.filter?.tag === 'DEBUFF'; if (hasStatus === hasFilter) report.add('CONTENT_REMOVE_STATUS_SELECTOR', state.packageId, file, at, 'Specify exactly one of statusId or filter.tag.'); if (effect.maxCount !== undefined && (!Number.isInteger(effect.maxCount) || effect.maxCount <= 0)) report.add('CONTENT_REMOVE_STATUS_COUNT', state.packageId, file, `${at}.maxCount`, 'maxCount must be a positive integer.', effect.maxCount); if (effect.selection !== undefined && !['OLDEST_FIRST', 'NEWEST_FIRST'].includes(effect.selection)) report.add('CONTENT_REMOVE_STATUS_SELECTION', state.packageId, file, `${at}.selection`, 'Unsupported deterministic status selection.', effect.selection) }
    if (effect.type === 'MODIFY_EVENT') { if (effect.path !== 'damage.currentAmount') report.add('CONTENT_MODIFY_EVENT_PATH', state.packageId, file, `${at}.path`, 'MODIFY_EVENT currently supports damage.currentAmount only.', effect.path); if (!['SET', 'ADD', 'MULTIPLY'].includes(effect.operation)) report.add('CONTENT_MODIFY_EVENT_OPERATION', state.packageId, file, `${at}.operation`, 'MODIFY_EVENT supports SET, ADD, or MULTIPLY.', effect.operation); if (effect.value === undefined) report.add('CONTENT_MODIFY_EVENT_VALUE', state.packageId, file, `${at}.value`, 'MODIFY_EVENT requires value.') }
    if (effect.type === 'SET_RUNTIME_FLAG' || effect.type === 'CLEAR_RUNTIME_FLAG') { if (!RUNTIME_VALUE_KEY.test(effect.flag ?? '')) report.add('CONTENT_RUNTIME_FLAG_KEY', state.packageId, file, `${at}.flag`, 'Runtime flag key is invalid.', effect.flag) }
    if (effect.type === 'STORE_VALUE') { if (!RUNTIME_SCOPES.has(effect.scope)) report.add('CONTENT_RUNTIME_SCOPE', state.packageId, file, `${at}.scope`, 'Unsupported runtime value scope.', effect.scope); if (!RUNTIME_VALUE_KEY.test(effect.key ?? '')) report.add('CONTENT_RUNTIME_KEY', state.packageId, file, `${at}.key`, 'Runtime value key is invalid.', effect.key); if (!RUNTIME_OPERATIONS.has(effect.operation)) report.add('CONTENT_RUNTIME_OPERATION', state.packageId, file, `${at}.operation`, 'Unsupported STORE_VALUE operation.', effect.operation); if (effect.scope === 'STATUS' && (typeof effect.statusId !== 'string' || !effect.statusId)) report.add('CONTENT_RUNTIME_STATUS', state.packageId, file, `${at}.statusId`, 'STATUS runtime values require statusId.', effect.statusId); if (['CLEAR', 'CLAMP'].includes(effect.operation) && effect.value !== undefined) report.add('CONTENT_RUNTIME_VALUE_FORBIDDEN', state.packageId, file, `${at}.value`, `${effect.operation} does not accept value.`, effect.value); if (!['CLEAR', 'CLAMP'].includes(effect.operation) && effect.value === undefined) report.add('CONTENT_RUNTIME_VALUE_REQUIRED', state.packageId, file, `${at}.value`, `${effect.operation} requires value.`); const min = effect.minimum?.type === 'CONSTANT' ? effect.minimum.value : undefined, max = effect.maximum?.type === 'CONSTANT' ? effect.maximum.value : undefined; if (typeof min === 'number' && typeof max === 'number' && min > max) report.add('CONTENT_RUNTIME_BOUNDS', state.packageId, file, at, 'minimum cannot exceed maximum.') }
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
  if (effect.type === 'REMOVE_STATUS') return { type: 'remove_status', ...common, ...(effect.statusId ? { statusId: effect.statusId } : {}), ...(effect.filter ? { filter: effect.filter } : {}), ...(effect.maxCount !== undefined ? { maxCount: effect.maxCount } : {}), ...(effect.selection ? { selection: effect.selection } : {}) };
  if (effect.type === 'IF') return { type: 'conditional', conditions: [conditionToRuntime(effect.condition)], effects: effect.then.map(effectToRuntime), ...(effect.else?.length ? { elseEffects: effect.else.map(effectToRuntime) } : {}) };
  if (effect.type === 'SCHEDULE') return { type: 'schedule_effects', ...common, delayMs: effect.delayMs, effects: effect.effects.map(effectToRuntime) };
  if (effect.type === 'SET_RUNTIME_FLAG') return { type: 'set_runtime_flag', ...common, flag: effect.flag, value: effect.value };
  if (effect.type === 'CLEAR_RUNTIME_FLAG') return { type: 'consume_runtime_flag', ...common, flag: effect.flag };
  if (effect.type === 'CONVERT_OVERHEAL_TO_SHIELD') return { type: 'convert_overheal_to_shield', ...common, ratio: effect.ratio, maximum: effect.maximum };
  if (effect.type === 'CUSTOM') return { type: 'custom', ...common, handlerId: effect.handlerId, parameters: effect.parameters ?? {} };
  if (effect.type === 'CONSUME_RESOURCE') return { type: 'consume_resource', ...common, resource: effect.resource, amount: valueToRuntime(effect.amount), allowPartial: effect.allowPartial ?? false, canReduceHpBelowOne: effect.canReduceHpBelowOne ?? false };
  if (effect.type === 'STORE_VALUE') return { type: 'store_value', ...common, scope: effect.scope, runtimeKey: effect.key, operation: effect.operation, ...(effect.statusId ? { statusId: effect.statusId } : {}), ...(effect.value !== undefined ? { value: valueToRuntime(effect.value) } : {}), ...(effect.minimum !== undefined ? { minimum: valueToRuntime(effect.minimum) } : {}), ...(effect.maximum !== undefined ? { maximum: valueToRuntime(effect.maximum) } : {}) };
  if (effect.type === 'MODIFY_EVENT') return { type: 'modify_event_amount', ...common, path: effect.path, operation: effect.operation, value: valueToRuntime(effect.value) };
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

function normalizeCharacter(value, asset) {
  const assets = asset ? { portraitUrl: asset.portraitUrl, portraitHash: asset.portraitHash } : {};
  return { id: value.id, name: value.displayName, shortName: value.shortName, rarity: value.rarity, race: value.race, tags: value.tags, description: value.description.summary, enabled: value.enabled ?? true, starter: value.starter ?? false, contentVersion: value.contentVersion ?? 1, allowedSlots: value.allowedSlots, recommendedRole: value.recommendedRole, portraitAsset: asset?.portraitUrl ?? '', assets, stats: value.stats, ...(value.defaultSlots ? { defaultSlots: value.defaultSlots } : {}), combatant: { skillId: value.activeAbilityId }, support: { effectId: value.supportAbilityId } };
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

export function compileContent({ root = path.resolve('content/characters'), generatedDir = path.resolve('apps/server/src/generated'), importBaseDir = generatedDir, assetOutputDir = path.resolve('apps/client/public/generated/characters'), write = true } = {}) {
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
    const customHandlers = new Set(), asset = portraitAsset(character, packageDir, packageId, characterFile, report);
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
    if (report.issues.length === packageIssueStart) packages.push({ id: packageId, character: normalizeCharacter(character, asset), stats: character.stats, active: normalizeAbility(active), support: normalizeAbility(support), presentation: presentation ?? null, asset });
  }
  if (report.issues.length) throw new ContentCompilationError(report.issues);
  packages.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const normalized = { _generated: 'AUTO-GENERATED FILE. DO NOT EDIT.', schemaVersion: 1, engineApiVersion: 1, packages: packages.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'asset'))) };
  const contentReport = { _generated: 'AUTO-GENERATED FILE. DO NOT EDIT.', packageCount: packages.length, characterCount: packages.length, abilityCount: packages.length * 2, customModuleCount: serverModules.length, packageIds: packages.map((item) => item.id), portraitCount: packages.filter((item) => item.asset).length, missingPortraitPackageIds: packages.filter((item) => !item.asset).map((item) => item.id) };
  if (write) {
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(path.join(generatedDir, 'normalized-content.generated.json'), stringify(normalized), 'utf8');
    writeFileSync(path.join(generatedDir, 'content-report.generated.json'), stringify(contentReport), 'utf8');
    const banner = '// AUTO-GENERATED FILE. DO NOT EDIT.\n';
    const effectTypesImport = posix(path.relative(importBaseDir, path.resolve('apps/server/src/effect-types.ts'))).replace(/^([^./])/, './$1').replace(/\.ts$/, '.js');
    writeFileSync(path.join(generatedDir, 'character-registry.generated.ts'), `${banner}import type { CharacterDefinition } from '@mercenary/shared';\nimport type { AbilityDefinition } from '${effectTypesImport}';\n\nexport const generatedCharacterDefinitions = ${JSON.stringify(packages.map((item) => item.character), null, 2)} as CharacterDefinition[];\nexport const generatedAbilityDefinitions = ${JSON.stringify(packages.flatMap((item) => [item.active, item.support]), null, 2)} as AbilityDefinition[];\nexport const generatedCharacterStats = ${JSON.stringify(Object.fromEntries(packages.map((item) => [item.id, item.stats])), null, 2)} as const;\nexport const generatedPresentation = ${JSON.stringify(Object.fromEntries(packages.filter((item) => item.presentation).map((item) => [item.id, item.presentation])), null, 2)} as const;\n`, 'utf8');
    const imports = serverModules.map((item, index) => `import { characterServerModule as module${index} } from '${posix(path.relative(importBaseDir, item.file)).replace(/^([^./])/, './$1').replace(/\.ts$/, '.js')}';`).join('\n');
    writeFileSync(path.join(generatedDir, 'custom-handler-registry.generated.ts'), `${banner}${imports}${imports ? '\n\n' : ''}export const generatedCharacterServerModules = [${serverModules.map((_item, index) => `module${index}`).join(', ')}] as const;\n`, 'utf8');
    rmSync(assetOutputDir, { recursive: true, force: true });
    for (const item of packages) if (item.asset) { const output = path.join(assetOutputDir, item.asset.outputRelative); mkdirSync(path.dirname(output), { recursive: true }); copyFileSync(item.asset.source, output) }
  }
  return { normalized, contentReport, serverModules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const validateOnly = process.argv.includes('--validate'), check = process.argv.includes('--check');
    let result;
    if (check) {
      const temporary = mkdtempSync(path.join(tmpdir(), 'mercenary-generated-'));
      const expectedDir = path.resolve('apps/server/src/generated'), expectedAssets = path.resolve('apps/client/public/generated/characters'), generated = path.join(temporary, 'server'), assets = path.join(temporary, 'assets');
      try { result = compileContent({ generatedDir: generated, importBaseDir: expectedDir, assetOutputDir: assets }); for (const file of ['character-registry.generated.ts', 'custom-handler-registry.generated.ts', 'normalized-content.generated.json', 'content-report.generated.json']) { const expected = path.join(expectedDir, file), actual = path.join(generated, file); if (!existsSync(expected) || readFileSync(expected, 'utf8') !== readFileSync(actual, 'utf8')) throw new Error(`CONTENT_GENERATED_STALE:${file}`) } const expectedFiles = relativeFiles(expectedAssets), actualFiles = relativeFiles(assets); if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) throw new Error('CONTENT_GENERATED_ASSETS_STALE:file-list'); for (const file of actualFiles) if (!readFileSync(path.join(expectedAssets, file)).equals(readFileSync(path.join(assets, file)))) throw new Error(`CONTENT_GENERATED_ASSETS_STALE:${file}`) } finally { rmSync(temporary, { recursive: true, force: true }) }
    } else result = compileContent({ write: !validateOnly });
    console.log(`Validated ${result.contentReport.packageCount} character package(s) and ${result.contentReport.abilityCount} abilities.`);
  }
  catch (error) { console.error(error instanceof ContentCompilationError ? error.message : error); process.exitCode = 1 }
}
