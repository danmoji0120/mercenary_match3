import { describe, expect, it } from 'vitest';
import { InMemoryAccountRepository, InMemoryAuthVerifier } from '../src/account';
import { CharacterRegistry, DEFAULT_LOADOUT, loadCharacterRegistry } from '../src/character-registry';
import { R_BATCH_0_5_1_CHARACTER_IDS, R_BATCH_0_5_2_CHARACTER_IDS, REPRESENTATIVE_0_4_CHARACTER_IDS, resolveDevelopmentCharacterGroup } from '../src/development-character-grants';
import { DEFAULT_CURRENCY_BALANCES } from '@mercenary/shared';

describe('character registry and account foundation', () => {
  it('loads five immutable starter characters and both loadouts', () => {
    const registry = loadCharacterRegistry(); expect(registry.all).toHaveLength(79); expect(registry.enabled).toHaveLength(79); expect(registry.starters).toHaveLength(5); expect(resolveDevelopmentCharacterGroup(registry, 'representative-0.4')).toEqual([...REPRESENTATIVE_0_4_CHARACTER_IDS]); expect(resolveDevelopmentCharacterGroup(registry, 'r-batch-0.5.1')).toEqual([...R_BATCH_0_5_1_CHARACTER_IDS]); expect(resolveDevelopmentCharacterGroup(registry, 'r-batch-0.5.2')).toEqual([...R_BATCH_0_5_2_CHARACTER_IDS]); expect(resolveDevelopmentCharacterGroup(registry, 'all-enabled')).toHaveLength(79); expect(Object.isFrozen(registry.all)).toBe(true); expect(() => registry.validateLoadout(DEFAULT_LOADOUT, new Set(registry.starters.map((item) => item.id)))).not.toThrow();
  });
  it('rejects duplicate ids, invalid rarity, and unavailable default characters', () => {
    const values = loadCharacterRegistry().all.map((item) => ({ ...item, tags: [...item.tags], allowedSlots: [...item.allowedSlots] }));
    expect(() => new CharacterRegistry([...values, values[0]!])).toThrow(/Duplicate/);
    expect(() => new CharacterRegistry(values.map((item, index) => index ? item : { ...item, rarity: 'UR' as any }))).toThrow();
    expect(() => new CharacterRegistry(values.map((item) => item.id === DEFAULT_LOADOUT.combatantCharacterId ? { ...item, enabled: false } : item))).toThrow();
  });
  it('bootstraps idempotently, repairs starter ownership, and preserves profile and loadout', async () => {
    const repository = new InMemoryAccountRepository(), starters = loadCharacterRegistry().starters.map((item) => item.id);
    const first = await repository.bootstrap('user-a', 'First', starters, DEFAULT_LOADOUT); first.ownedCharacterIds.pop(); repository.accounts.set('user-a', first);
    const second = await repository.bootstrap('user-a', 'Changed', starters, DEFAULT_LOADOUT); expect(second.profile.displayName).toBe('First'); expect(second.ownedCharacterIds).toHaveLength(5); expect(second.loadout).toEqual(DEFAULT_LOADOUT);
    expect(second.currencies).toEqual(DEFAULT_CURRENCY_BALANCES);
  });
  it('applies atomic, idempotent currency transactions without touching loadout or ownership', async () => {
    const repository = new InMemoryAccountRepository(), registry = loadCharacterRegistry(), starters = registry.starters.map((item) => item.id);
    const before = await repository.bootstrap('currency-user', 'Currency', starters, DEFAULT_LOADOUT);
    const granted = await repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'grant:1', reason: 'test:grant', changes: [{ currencyId: 'gold', delta: 100 }, { currencyId: 'recruit_token', delta: 10 }] });
    expect(granted).toMatchObject({ applied: true, balances: { gold: 100, recruit_token: 10 } });
    const repeated = await repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'grant:1', reason: 'test:grant', changes: [{ currencyId: 'gold', delta: 100 }, { currencyId: 'recruit_token', delta: 10 }] });
    expect(repeated).toMatchObject({ applied: false, balances: { gold: 100, recruit_token: 10 } });
    const spent = await repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'spend:1', reason: 'test:spend', changes: [{ currencyId: 'gold', delta: -40 }, { currencyId: 'recruit_token', delta: -3 }] });
    expect(spent.balances).toMatchObject({ gold: 60, recruit_token: 7 });
    await expect(repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'spend:rollback', reason: 'test:rollback', changes: [{ currencyId: 'gold', delta: 10 }, { currencyId: 'recruit_token', delta: -100 }] })).rejects.toThrow('INSUFFICIENT_CURRENCY');
    const after = await repository.get('currency-user');
    expect(after?.currencies).toMatchObject({ gold: 60, recruit_token: 7 });
    expect(after?.loadout).toEqual(before.loadout); expect(after?.ownedCharacterIds).toEqual(before.ownedCharacterIds);
  });
  it('rejects invalid currency requests and prevents concurrent overdrafts', async () => {
    const repository = new InMemoryAccountRepository(), starters = loadCharacterRegistry().starters.map((item) => item.id);
    await repository.bootstrap('currency-user', 'Currency', starters, DEFAULT_LOADOUT);
    await repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'seed', reason: 'test:seed', changes: [{ currencyId: 'gold', delta: 10 }] });
    await expect(repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'seed', reason: 'changed', changes: [{ currencyId: 'gold', delta: 10 }] })).rejects.toThrow('CURRENCY_REQUEST_CONFLICT');
    await expect(repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'fraction', reason: 'test', changes: [{ currencyId: 'gold', delta: 0.5 }] })).rejects.toThrow('INVALID_CURRENCY_DELTA');
    const concurrent = await Promise.allSettled([
      repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'concurrent:1', reason: 'test', changes: [{ currencyId: 'gold', delta: -8 }] }),
      repository.applyCurrencyTransaction({ userId: 'currency-user', requestKey: 'concurrent:2', reason: 'test', changes: [{ currencyId: 'gold', delta: -8 }] }),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await repository.get('currency-user'))?.currencies.gold).toBe(2);
  });
  it('supports deterministic fake auth and rejects forged tokens', async () => {
    const verifier = new InMemoryAuthVerifier(), token = verifier.issue('user-a', 'valid'); expect(await verifier.verify(token)).toMatchObject({ userId: 'user-a' }); await expect(verifier.verify('forged')).rejects.toThrow('INVALID_TOKEN');
  });
  it('grants representative characters idempotently without changing the saved loadout', async () => {
    const registry = loadCharacterRegistry(), repository = new InMemoryAccountRepository(), starters = registry.starters.map((item) => item.id);
    const before = await repository.bootstrap('user-a', 'A', starters, DEFAULT_LOADOUT), savedLoadout = structuredClone(before.loadout);
    const first = await repository.grantCharacters('user-a', resolveDevelopmentCharacterGroup(registry, 'representative-0.4'), 'development:representative-0.4');
    expect(first).toMatchObject({ addedCharacterIds: expect.arrayContaining([...REPRESENTATIVE_0_4_CHARACTER_IDS]), existingCharacterIds: [], failedCharacterIds: [] });
    expect((await repository.get('user-a'))?.ownedCharacterIds).toHaveLength(19); expect((await repository.get('user-a'))?.loadout).toEqual(savedLoadout);
    const second = await repository.grantCharacters('user-a', resolveDevelopmentCharacterGroup(registry, 'representative-0.4'), 'development:representative-0.4');
    expect(second).toMatchObject({ addedCharacterIds: [], existingCharacterIds: expect.arrayContaining([...REPRESENTATIVE_0_4_CHARACTER_IDS]), failedCharacterIds: [] });
    expect((await repository.get('user-a'))?.ownedCharacterIds).toHaveLength(19); expect((await repository.get('user-a'))?.loadout).toEqual(savedLoadout);
    const batch = await repository.grantCharacters('user-a', resolveDevelopmentCharacterGroup(registry, 'r-batch-0.5.1'), 'development:r-batch-0.5.1');
    expect(batch).toMatchObject({ addedCharacterIds: expect.arrayContaining([...R_BATCH_0_5_1_CHARACTER_IDS]), existingCharacterIds: [], failedCharacterIds: [] });
    expect((await repository.get('user-a'))?.ownedCharacterIds).toHaveLength(49); expect((await repository.get('user-a'))?.loadout).toEqual(savedLoadout);
    const repeated = await repository.grantCharacters('user-a', resolveDevelopmentCharacterGroup(registry, 'r-batch-0.5.1'), 'development:r-batch-0.5.1');
    expect(repeated.addedCharacterIds).toEqual([]); expect(repeated.existingCharacterIds).toHaveLength(30); expect((await repository.get('user-a'))?.ownedCharacterIds).toHaveLength(49);
    const nextBatch = await repository.grantCharacters('user-a', resolveDevelopmentCharacterGroup(registry, 'r-batch-0.5.2'), 'development:r-batch-0.5.2');
    expect(nextBatch).toMatchObject({ addedCharacterIds: expect.arrayContaining([...R_BATCH_0_5_2_CHARACTER_IDS]), existingCharacterIds: [], failedCharacterIds: [] });
    expect((await repository.get('user-a'))?.ownedCharacterIds).toHaveLength(79); expect((await repository.get('user-a'))?.loadout).toEqual(savedLoadout);
    const repeatedNextBatch = await repository.grantCharacters('user-a', resolveDevelopmentCharacterGroup(registry, 'r-batch-0.5.2'), 'development:r-batch-0.5.2');
    expect(repeatedNextBatch.addedCharacterIds).toEqual([]); expect(repeatedNextBatch.existingCharacterIds).toHaveLength(30); expect((await repository.get('user-a'))?.ownedCharacterIds).toHaveLength(79); expect((await repository.get('user-a'))?.loadout).toEqual(savedLoadout);
  });
  it('validates ownership, duplicate slots, and optimistic loadout versions', async () => {
    const registry = loadCharacterRegistry(), repository = new InMemoryAccountRepository(), starters = registry.starters.map((item) => item.id); await repository.bootstrap('user-a', 'A', starters, DEFAULT_LOADOUT);
    expect(() => registry.validateLoadout({ ...DEFAULT_LOADOUT, supportCharacterId1: DEFAULT_LOADOUT.combatantCharacterId }, new Set(starters))).toThrow(/multiple/);
    expect(() => registry.validateLoadout({ ...DEFAULT_LOADOUT, supportCharacterId1: 'missing' }, new Set(starters))).toThrow(/unavailable/);
    await expect(repository.saveLoadout('user-a', { ...DEFAULT_LOADOUT, expectedVersion: 99 })).rejects.toThrow('VERSION_CONFLICT');
  });
});
