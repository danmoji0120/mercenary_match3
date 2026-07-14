import type { RuntimeValueOperation, RuntimeValueScope, RuntimeValueSnapshot } from '@mercenary/shared';

export const RUNTIME_VALUE_KEY_PATTERN = /^[a-z][a-zA-Z0-9_.-]{0,63}$/;

export interface RuntimeValueAddress {
  participantId: string;
  scope: RuntimeValueScope;
  key: string;
  abilityId?: string;
  statusId?: string;
  chainId?: string;
}

export interface RuntimeValueMutation {
  operation: RuntimeValueOperation;
  value?: number;
  minimum?: number;
  maximum?: number;
}

export interface RuntimeValueMutationResult {
  scope: RuntimeValueScope;
  key: string;
  existed: boolean;
  previousValue?: number;
  nextValue: number | null;
  cleared: boolean;
}

export type SerializedRuntimeValues = Array<[string, Array<[string, number]>]>;

function finite(value: number, code: string) {
  if (!Number.isFinite(value)) throw new Error(code);
  return value;
}

function namespace(address: RuntimeValueAddress) {
  if (!RUNTIME_VALUE_KEY_PATTERN.test(address.key)) throw new Error(`RUNTIME_VALUE_KEY_INVALID:${address.key}`);
  if (address.scope === 'ABILITY' && !address.abilityId) throw new Error('RUNTIME_VALUE_ABILITY_REQUIRED');
  if (address.scope === 'STATUS' && !address.statusId) throw new Error('RUNTIME_VALUE_STATUS_REQUIRED');
  if (address.scope === 'CHAIN' && !address.chainId) throw new Error('RUNTIME_VALUE_CHAIN_REQUIRED');
  const owner = address.scope === 'BATTLE' ? '' : address.scope === 'ABILITY' ? address.abilityId! : address.scope === 'STATUS' ? address.statusId! : address.chainId!;
  return `${address.scope}:${owner}:${address.key}`;
}

function parseStorageKey(storageKey: string) {
  const first = storageKey.indexOf(':'), second = storageKey.indexOf(':', first + 1);
  if (first <= 0 || second < 0) throw new Error(`RUNTIME_VALUE_SNAPSHOT_KEY_INVALID:${storageKey}`);
  const scope = storageKey.slice(0, first) as RuntimeValueScope, owner = storageKey.slice(first + 1, second), key = storageKey.slice(second + 1);
  if (!['BATTLE', 'ABILITY', 'STATUS', 'CHAIN'].includes(scope) || !RUNTIME_VALUE_KEY_PATTERN.test(key)) throw new Error(`RUNTIME_VALUE_SNAPSHOT_KEY_INVALID:${storageKey}`);
  if (scope !== 'BATTLE' && !owner) throw new Error(`RUNTIME_VALUE_SNAPSHOT_OWNER_INVALID:${storageKey}`);
  return { scope, owner, key };
}

export class RuntimeValueStore {
  private readonly values = new Map<string, Map<string, number>>();

  constructor(participantIds: readonly string[]) {
    for (const participantId of participantIds) this.values.set(participantId, new Map());
  }

  read(address: RuntimeValueAddress) {
    const participant = this.values.get(address.participantId);
    if (!participant) throw new Error(`RUNTIME_VALUE_PARTICIPANT_UNKNOWN:${address.participantId}`);
    return participant.get(namespace(address));
  }

  mutate(address: RuntimeValueAddress, mutation: RuntimeValueMutation): RuntimeValueMutationResult {
    const participant = this.values.get(address.participantId);
    if (!participant) throw new Error(`RUNTIME_VALUE_PARTICIPANT_UNKNOWN:${address.participantId}`);
    const storageKey = namespace(address), previousValue = participant.get(storageKey), existed = previousValue !== undefined;
    if (mutation.operation === 'CLEAR') {
      participant.delete(storageKey);
      return { scope: address.scope, key: address.key, existed, previousValue, nextValue: null, cleared: existed };
    }
    const operand = mutation.value;
    if (mutation.operation !== 'CLAMP' && operand === undefined) throw new Error(`RUNTIME_VALUE_OPERAND_REQUIRED:${mutation.operation}`);
    if (operand !== undefined) finite(operand, 'RUNTIME_VALUE_NON_FINITE');
    if (mutation.minimum !== undefined) finite(mutation.minimum, 'RUNTIME_VALUE_MIN_NON_FINITE');
    if (mutation.maximum !== undefined) finite(mutation.maximum, 'RUNTIME_VALUE_MAX_NON_FINITE');
    if (mutation.minimum !== undefined && mutation.maximum !== undefined && mutation.minimum > mutation.maximum) throw new Error('RUNTIME_VALUE_BOUNDS_INVALID');
    let nextValue: number;
    if (mutation.operation === 'SET') nextValue = operand!;
    else if (mutation.operation === 'ADD') nextValue = (previousValue ?? 0) + operand!;
    else if (mutation.operation === 'SUBTRACT') nextValue = (previousValue ?? 0) - operand!;
    else if (mutation.operation === 'MIN') nextValue = existed ? Math.min(previousValue, operand!) : operand!;
    else if (mutation.operation === 'MAX') nextValue = existed ? Math.max(previousValue, operand!) : operand!;
    else {
      if (!existed) throw new Error('RUNTIME_VALUE_CLAMP_MISSING');
      nextValue = previousValue;
    }
    if (mutation.minimum !== undefined) nextValue = Math.max(mutation.minimum, nextValue);
    if (mutation.maximum !== undefined) nextValue = Math.min(mutation.maximum, nextValue);
    finite(nextValue, 'RUNTIME_VALUE_NON_FINITE');
    participant.set(storageKey, nextValue);
    return { scope: address.scope, key: address.key, existed, previousValue, nextValue, cleared: false };
  }

  clearStatus(participantId: string, statusId: string) { this.clearPrefix(participantId, `STATUS:${statusId}:`) }
  clearChain(chainId: string) { for (const participantId of this.values.keys()) this.clearPrefix(participantId, `CHAIN:${chainId}:`) }
  clearAll() { for (const values of this.values.values()) values.clear() }

  snapshot(participantId: string): RuntimeValueSnapshot {
    const result: RuntimeValueSnapshot = { battle: {}, abilities: {}, statuses: {}, chains: {} };
    const entries = [...(this.values.get(participantId) ?? [])].sort(([a], [b]) => a.localeCompare(b));
    for (const [storageKey, value] of entries) {
      const { scope, owner, key } = parseStorageKey(storageKey);
      if (scope === 'BATTLE') result.battle[key] = value;
      else {
        const group = scope === 'ABILITY' ? result.abilities : scope === 'STATUS' ? result.statuses : result.chains;
        (group[owner] ??= {})[key] = value;
      }
    }
    return result;
  }

  serialize(): SerializedRuntimeValues {
    return [...this.values].sort(([a], [b]) => a.localeCompare(b)).map(([participantId, values]) => [participantId, [...values].sort(([a], [b]) => a.localeCompare(b))]);
  }

  restore(serialized: SerializedRuntimeValues | undefined) {
    for (const values of this.values.values()) values.clear();
    for (const [participantId, entries] of serialized ?? []) {
      const target = this.values.get(participantId);
      if (!target) throw new Error(`RUNTIME_VALUE_PARTICIPANT_UNKNOWN:${participantId}`);
      for (const [storageKey, value] of entries) { parseStorageKey(storageKey); finite(value, 'RUNTIME_VALUE_SNAPSHOT_NON_FINITE'); target.set(storageKey, value) }
    }
  }

  private clearPrefix(participantId: string, prefix: string) {
    const values = this.values.get(participantId);
    if (!values) return;
    for (const key of values.keys()) if (key.startsWith(prefix)) values.delete(key);
  }
}
