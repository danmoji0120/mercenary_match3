import { describe, expect, it } from 'vitest';
import { InMemoryAccountRepository, InMemoryAuthVerifier } from '../src/account';
import { CharacterRegistry, DEFAULT_LOADOUT, loadCharacterRegistry } from '../src/character-registry';

describe('character registry and account foundation', () => {
  it('loads five immutable starter characters and both loadouts', () => {
    const registry = loadCharacterRegistry(); expect(registry.starters).toHaveLength(5); expect(Object.isFrozen(registry.all)).toBe(true); expect(() => registry.validateLoadout(DEFAULT_LOADOUT, new Set(registry.starters.map((item) => item.id)))).not.toThrow();
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
  });
  it('supports deterministic fake auth and rejects forged tokens', async () => {
    const verifier = new InMemoryAuthVerifier(), token = verifier.issue('user-a', 'valid'); expect(await verifier.verify(token)).toMatchObject({ userId: 'user-a' }); await expect(verifier.verify('forged')).rejects.toThrow('INVALID_TOKEN');
  });
  it('validates ownership, duplicate slots, and optimistic loadout versions', async () => {
    const registry = loadCharacterRegistry(), repository = new InMemoryAccountRepository(), starters = registry.starters.map((item) => item.id); await repository.bootstrap('user-a', 'A', starters, DEFAULT_LOADOUT);
    expect(() => registry.validateLoadout({ ...DEFAULT_LOADOUT, supportCharacterId1: DEFAULT_LOADOUT.combatantCharacterId }, new Set(starters))).toThrow(/multiple/);
    expect(() => registry.validateLoadout({ ...DEFAULT_LOADOUT, supportCharacterId1: 'missing' }, new Set(starters))).toThrow(/unavailable/);
    await expect(repository.saveLoadout('user-a', { ...DEFAULT_LOADOUT, expectedVersion: 99 })).rejects.toThrow('VERSION_CONFLICT');
  });
});
