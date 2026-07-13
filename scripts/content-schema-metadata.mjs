export const PACKAGE_ID = /^[a-z][a-z0-9_]*$/;
export const ABILITY_ID = /^[a-z][a-z0-9_.]*$/;
export const SUPPORTED_SCHEMA_VERSION = 1;
export const SUPPORTED_ENGINE_API_VERSION = 1;
export const RARITIES = Object.freeze(['EX', 'R', 'SR', 'SSR']);
export const ROLES = Object.freeze(['ATTACK', 'DEFENSE', 'DISRUPT', 'HEAL', 'SUPPORT']);
export const TARGETS = Object.freeze(['ENEMY', 'SELF']);
export const OPERATORS = Object.freeze(['EQ', 'GTE', 'GT', 'LTE', 'LT', 'NE']);
export const RESOURCES = Object.freeze(['HP', 'HP_RATIO', 'MANA', 'SHIELD']);
export const CONSUMABLE_RESOURCES = Object.freeze(['HP', 'MANA', 'SHIELD']);
export const STATS = Object.freeze(['MAX_HP']);
export const VALUE_TYPES = Object.freeze(['ABS', 'ADD', 'CEIL', 'CLAMP', 'CONSTANT', 'DIVIDE', 'EVENT_VALUE', 'FLOOR', 'MAX', 'MIN', 'MULTIPLY', 'RESOURCE', 'RESULT_VALUE', 'ROUND', 'STAT', 'SUBTRACT']);
export const CONDITION_TYPES = Object.freeze(['AND', 'COMPARE', 'EVENT_SOURCE', 'EVENT_TYPE', 'FALSE', 'HAS_STATUS', 'HAS_TAG', 'NOT', 'OR', 'RESULT_COMPARE', 'TRUE']);
export const EFFECT_TYPES = Object.freeze(['ADD_SHIELD', 'APPLY_STATUS', 'CLEAR_RUNTIME_FLAG', 'CONSUME_RESOURCE', 'CONVERT_OVERHEAL_TO_SHIELD', 'CUSTOM', 'DAMAGE', 'HEAL', 'IF', 'MODIFY_EVENT', 'MODIFY_MANA', 'REMOVE_STATUS', 'SCHEDULE', 'SET_RUNTIME_FLAG', 'STORE_VALUE']);
export const RESULT_PATHS = Object.freeze(['actualHealing', 'actualShieldGain', 'chargeConsumed', 'consumedAmount', 'finalAmount', 'hpDamage', 'overhealing', 'requestedAmount', 'shieldBroken', 'shieldDamage', 'statusApplied', 'targetDefeated']);
export const EVENT_PATHS = Object.freeze(['chain.depth', 'damage.currentAmount', 'damage.finalAmount', 'damage.shieldBroken', 'hp.threshold', 'match.count', 'match.tileType']);
export const COPY_POLICIES = Object.freeze(['DENY_COPIED']);
export const RECURSION_POLICIES = Object.freeze(['SAFE_DEFAULT']);

export const TRIGGER_MAP = Object.freeze({
  ACTIVE_USED: 'active_requested', AFTER_DAMAGE: 'after_damage', ATTACK_CREATED: 'attack_created', BATTLE_STARTED: 'battle_started',
  BEFORE_ATTACK_IMPACT: 'before_attack_impact', BEFORE_DAMAGE: 'before_damage', CHAIN_STEP_RESOLVED: 'chain_step_resolved', DEFEATED: 'battle_finished',
  HEALED: 'after_heal', HP_THRESHOLD_CROSSED: 'hp_threshold_crossed', SHIELD_BROKEN: 'shield_broken', SHIELD_GAINED: 'after_shield_gain',
  STATUS_APPLIED: 'status_applied', STATUS_REMOVED: 'status_expired', TILE_MATCH_RESOLVED: 'match_group_resolved',
});

export const EFFECT_RUNTIME_MAP = Object.freeze({
  ADD_SHIELD: 'gain_shield', APPLY_STATUS: 'apply_status', CLEAR_RUNTIME_FLAG: 'consume_runtime_flag', CONSUME_RESOURCE: 'consume_resource',
  CONVERT_OVERHEAL_TO_SHIELD: 'convert_overheal_to_shield', CUSTOM: 'custom', DAMAGE: 'deal_damage', HEAL: 'heal', IF: 'conditional',
  MODIFY_EVENT: 'modify_event_amount', MODIFY_MANA: 'gain_mana', REMOVE_STATUS: 'remove_status', SCHEDULE: 'schedule_effects',
  SET_RUNTIME_FLAG: 'set_runtime_flag', STORE_VALUE: 'store_value',
});

export const EMITTED_RUNTIME_TRIGGERS = Object.freeze([
  'after_damage', 'battle_finished', 'battle_started', 'before_attack_impact', 'hp_threshold_crossed', 'match_group_resolved', 'shield_broken',
]);

export const EVENT_PATH_CAPABILITIES = Object.freeze({
  'chain.depth': { type: 'integer', availableEvents: ['TILE_MATCH_RESOLVED'], example: 2 },
  'damage.currentAmount': { type: 'number', availableEvents: ['BEFORE_ATTACK_IMPACT'], example: 180 },
  'damage.finalAmount': { type: 'number', availableEvents: [], example: 135, note: 'Validator accepts this path, but no emitted support trigger currently supplies finalAmount.' },
  'damage.shieldBroken': { type: 'boolean', availableEvents: ['AFTER_DAMAGE', 'SHIELD_BROKEN'], example: true },
  'hp.threshold': { type: 'number', availableEvents: ['HP_THRESHOLD_CROSSED'], example: 25 },
  'match.count': { type: 'integer', availableEvents: ['TILE_MATCH_RESOLVED'], example: 4 },
  'match.tileType': { type: 'TileType', availableEvents: ['TILE_MATCH_RESOLVED'], example: 'SWORD' },
});

export const RESULT_SCHEMAS = Object.freeze({
  ADD_SHIELD: ['actualShieldGain', 'finalAmount', 'requestedAmount'],
  APPLY_STATUS: ['statusApplied'],
  CONSUME_RESOURCE: ['consumedAmount', 'finalAmount', 'requestedAmount'],
  CONVERT_OVERHEAL_TO_SHIELD: ['actualShieldGain', 'finalAmount', 'requestedAmount'],
  DAMAGE: ['finalAmount', 'hpDamage', 'requestedAmount', 'shieldBroken', 'shieldDamage', 'targetDefeated'],
  HEAL: ['actualHealing', 'finalAmount', 'overhealing', 'requestedAmount'],
  MODIFY_EVENT: ['finalAmount', 'requestedAmount'],
  MODIFY_MANA: ['finalAmount', 'requestedAmount'],
  STORE_VALUE: ['finalAmount'],
});

export const CHARACTER_FIELDS = Object.freeze({
  '$.activeAbilityId': { type: 'string', required: true, validation: 'must equal active.json id', runtime: 'combatant ability lookup', example: 'sample_active' },
  '$.allowedSlots': { type: 'array<combatant|support>', required: true, validation: 'all entries must be combatant or support', runtime: 'loadout validation', example: ['combatant', 'support'] },
  '$.combatStyle': { type: 'non-empty string ID', required: true, validation: 'normalization-required; no dedicated compiler check', runtime: 'metadata only', example: 'SWORD' },
  '$.description.details': { type: 'string', required: true, validation: 'normalization-required; no dedicated compiler check', runtime: 'presentation metadata', example: 'Detailed description.' },
  '$.description.summary': { type: 'string', required: true, validation: 'normalization-required; no dedicated compiler check', runtime: 'CharacterDefinition.description', example: 'Short summary.' },
  '$.displayName': { type: 'string', required: true, validation: 'normalization-required; runtime registry rejects missing name', runtime: 'display name', example: 'Sample Mercenary' },
  '$.id': { type: 'package ID', required: true, validation: 'must equal manifest and folder id', runtime: 'stable character ID', example: 'sample_character' },
  '$.race': { type: 'non-empty string', required: true, validation: 'explicit', runtime: 'metadata and tags', example: 'HUMAN' },
  '$.rarity': { type: 'enum', required: true, values: RARITIES, validation: 'explicit', runtime: 'metadata only', example: 'SR' },
  '$.role': { type: 'enum', required: true, values: ROLES, validation: 'explicit', runtime: 'content metadata', example: 'ATTACK' },
  '$.shortName': { type: 'string', required: true, validation: 'normalization-required; runtime registry rejects missing shortName', runtime: 'compact display name', example: 'Sample' },
  '$.stats.healEffectPct': { type: 'non-negative safe integer', required: true, validation: '100 is neutral', runtime: 'base HEAL tile only', example: 100 },
  '$.stats.manaGainPct': { type: 'non-negative safe integer', required: true, validation: '100 is neutral', runtime: 'base MANA tile only', example: 100 },
  '$.stats.maxHp': { type: 'positive safe integer', required: true, validation: 'explicit', runtime: 'combatant starting and maximum HP', example: 1000 },
  '$.stats.shieldEffectPct': { type: 'non-negative safe integer', required: true, validation: '100 is neutral', runtime: 'base SHIELD tile only', example: 100 },
  '$.stats.swordEffectPct': { type: 'non-negative safe integer', required: true, validation: '100 is neutral', runtime: 'base SWORD tile only', example: 100 },
  '$.supportAbilityId': { type: 'string', required: true, validation: 'must equal support.json id', runtime: 'support ability lookup', example: 'sample_support' },
  '$.tags': { type: 'string[]', required: true, validation: 'normalization-required; runtime registry requires a non-empty array', runtime: 'metadata and HAS_TAG source tags where supplied', example: ['ATTACK'] },
});

const commonAbilityFields = {
  id: { type: 'stable lowercase identifier', required: true }, kind: { type: 'ACTIVE|SUPPORT', required: true }, displayName: { type: 'string', required: true },
  shortDescription: { type: 'string', required: true }, fullDescription: { type: 'string', required: true }, effects: { type: 'EffectDefinition[]', required: true },
  activationCondition: { type: 'ConditionExpression', required: false }, presentationKey: { type: 'string', required: false, note: 'Not explicitly rejected, but the current normalizer drops it; presentation integration is unavailable.' },
  tags: { type: 'AbilityTag[]', required: false, default: [] }, copyPolicy: { type: 'DENY_COPIED', required: false }, recursionPolicy: { type: 'SAFE_DEFAULT', required: false },
  contentVersion: { type: 'positive integer', required: false, default: 1 }, enabled: { type: 'boolean', required: false, default: true },
};
export const ABILITY_FIELDS = Object.freeze({
  ACTIVE: { ...commonAbilityFields, manaCost: { type: 'integer 0..100', required: true } },
  SUPPORT: { ...commonAbilityFields, trigger: { type: 'TriggerDefinition', required: true }, cooldownMs: { type: 'null|non-negative integer', required: true, runtimeDefaultWhenNull: 0 }, battleLimit: { type: 'null|positive integer', required: true }, chainLimit: { type: 'null|{maxTriggers: positive integer}', required: true } },
});

export const EFFECT_FIELDS = Object.freeze({
  ADD_SHIELD: { required: ['amount'], optional: ['cap', 'condition', 'resultKey', 'scope', 'target'], returns: 'ADD_SHIELD', note: 'scope currently normalizes only to chain_step.' },
  APPLY_STATUS: { required: ['statusId'], optional: ['condition', 'durationMs', 'resultKey', 'target'], returns: 'APPLY_STATUS' },
  CLEAR_RUNTIME_FLAG: { required: ['flag'], optional: ['condition'], returns: null },
  CONSUME_RESOURCE: { required: ['amount', 'resource'], optional: ['allowPartial', 'canReduceHpBelowOne', 'condition', 'resultKey', 'target'], returns: 'CONSUME_RESOURCE' },
  CONVERT_OVERHEAL_TO_SHIELD: { required: ['ratio'], optional: ['condition', 'maximum', 'resultKey', 'target'], returns: 'CONVERT_OVERHEAL_TO_SHIELD' },
  CUSTOM: { required: ['handlerId'], optional: ['condition', 'parameters'], returns: null },
  DAMAGE: { required: ['amount'], optional: ['condition', 'resultKey', 'shieldBypassPct', 'tags', 'target', 'travelMs'], returns: 'DAMAGE' },
  HEAL: { required: ['amount'], optional: ['condition', 'resultKey', 'target'], returns: 'HEAL' },
  IF: { required: ['condition', 'then'], optional: ['else'], returns: 'child effect results remain in branch scope' },
  MODIFY_EVENT: { required: [], optional: ['amount', 'condition', 'ratio', 'resultKey'], returns: 'MODIFY_EVENT' },
  MODIFY_MANA: { required: ['amount'], optional: ['condition', 'resultKey', 'target'], returns: 'MODIFY_MANA' },
  REMOVE_STATUS: { required: ['statusId'], optional: ['condition', 'target'], returns: null },
  SCHEDULE: { required: ['delayMs', 'effects'], optional: ['condition', 'target'], returns: null },
  SET_RUNTIME_FLAG: { required: ['flag', 'value'], optional: ['condition'], returns: null },
  STORE_VALUE: { required: ['value'], optional: ['condition', 'resultKey'], returns: 'STORE_VALUE' },
});

export const VALUE_FIELDS = Object.freeze({
  ABS: { required: ['value'], returns: 'number' }, ADD: { required: ['values'], returns: 'number' }, CEIL: { required: ['value'], returns: 'integer' },
  CLAMP: { required: ['value', 'min', 'max'], returns: 'number' }, CONSTANT: { required: ['value'], returns: 'number|boolean|string' },
  DIVIDE: { required: ['values'], returns: 'number', errors: ['VALUE_DIVIDE_BY_ZERO', 'VALUE_NON_FINITE'] }, EVENT_VALUE: { required: ['path'], returns: 'number|boolean|string' },
  FLOOR: { required: ['value'], returns: 'integer' }, MAX: { required: ['values'], returns: 'number' }, MIN: { required: ['values'], returns: 'number' },
  MULTIPLY: { required: ['values'], returns: 'number' }, RESOURCE: { required: ['target', 'resource'], returns: 'number' }, RESULT_VALUE: { required: ['resultKey', 'path'], returns: 'number|boolean' },
  ROUND: { required: ['value'], returns: 'integer' }, STAT: { required: ['target', 'stat'], returns: 'number' }, SUBTRACT: { required: ['values'], returns: 'number' },
});

export const CONDITION_FIELDS = Object.freeze({
  AND: { required: ['conditions'] }, COMPARE: { required: ['left', 'operator', 'right'] }, EVENT_SOURCE: { required: ['source'] }, EVENT_TYPE: { required: ['event'] }, FALSE: { required: [] },
  HAS_STATUS: { required: ['target', 'statusId'], optional: ['negated'] }, HAS_TAG: { required: ['source', 'tag'] }, NOT: { required: ['condition'] }, OR: { required: ['conditions'] },
  RESULT_COMPARE: { required: ['resultKey', 'path', 'operator', 'value'] }, TRUE: { required: [] },
});

export const CUSTOM_COMMANDS = Object.freeze({
  addShield: 'addShield(amount)', applyStatus: "applyStatus(statusId, target='self')", clearRuntimeFlag: 'clearRuntimeFlag(flag)', consumeResource: "consumeResource(resource, amount, allowPartial=false)",
  dealDamage: "dealDamage(amount, target='opponent')", heal: 'heal(amount)', modifyMana: 'modifyMana(amount)', removeStatus: "removeStatus(statusId, target='self')",
  schedule: 'schedule(delayMs, effects)', setRuntimeFlag: 'setRuntimeFlag(flag, value)', storeValue: 'storeValue(key, value)',
});

export const UNSUPPORTED_FEATURES = Object.freeze([
  { feature: 'Active/support automatic stat scaling', status: 'UNSUPPORTED_SCHEMA' },
  { feature: 'BEFORE_DEFEAT and preventDefeat', status: 'ENGINE_EVENT_REQUIRED' },
  { feature: 'Time rewind', status: 'ENGINE_PRIMITIVE_REQUIRED' },
  { feature: 'Active or tile-effect copy primitive', status: 'METADATA_ONLY_NO_PRIMITIVE' },
  { feature: 'Damage/heal event conversion', status: 'METADATA_ONLY_NO_PRIMITIVE' },
  { feature: 'Excess shield persistence', status: 'UNSUPPORTED_SCHEMA' },
  { feature: 'External user TypeScript or Lua/QuickJS/WASM', status: 'FORBIDDEN' },
  { feature: 'Arbitrary loops or dynamic function execution', status: 'FORBIDDEN' },
  { feature: 'Custom handler file system, network, database, or environment access', status: 'FORBIDDEN' },
  { feature: 'Recent tile history in custom state', status: 'CUSTOM_HANDLER_POSSIBLE', requiredEvents: ['TILE_MATCH_RESOLVED'] },
]);
