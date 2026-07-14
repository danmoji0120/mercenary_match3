import type { EffectDefinition } from '../../src/effect-types.js';

export const RUNTIME_EFFECT_FIXTURE_TYPES = [
  'consume_resource',
  'modify_event_amount',
  'remove_status',
  'gain_mana',
  'set_runtime_flag',
  'consume_runtime_flag',
  'store_value',
] as const;

export const runtimeEffectFixture: readonly EffectDefinition[] = [
  { type: 'set_runtime_flag', flag: 'coverage.flag', value: true, key: 'setFlag' },
  { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.flagSet', operation: 'SET', value: { type: 'RESULT_VALUE', resultKey: 'setFlag', path: 'changed' } },
  { type: 'consume_runtime_flag', flag: 'coverage.flag', key: 'clearFlag' },
  { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.flagCleared', operation: 'SET', value: { type: 'RESULT_VALUE', resultKey: 'clearFlag', path: 'existed' } },
  { type: 'consume_resource', target: 'self', resource: 'SHIELD', amount: 12, allowPartial: true, canReduceHpBelowOne: false, key: 'consume' },
  { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.consumed', operation: 'SET', value: { type: 'RESULT_VALUE', resultKey: 'consume', path: 'consumedAmount' }, key: 'stored' },
  { type: 'apply_status', target: 'self', statusId: 'damage_reduction', durationMs: 5_000 },
  { type: 'remove_status', target: 'self', statusId: 'damage_reduction', maxCount: 1, selection: 'OLDEST_FIRST', key: 'removed' },
  { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.removed', operation: 'SET', value: { type: 'RESULT_VALUE', resultKey: 'removed', path: 'removedCount' } },
  { type: 'gain_mana', target: 'self', amount: 9, key: 'mana' },
  { type: 'store_value', target: 'self', scope: 'BATTLE', runtimeKey: 'coverage.mana', operation: 'SET', value: { type: 'RESULT_VALUE', resultKey: 'mana', path: 'finalAmount' } },
];
