import type {
  CharacterDefinition,
  CharacterRole,
  UpdateLoadoutRequest,
  UserAccountState,
  UserLoadout,
} from '@mercenary/shared';

export type LoadoutSlotKey = 'combatantCharacterId' | 'supportCharacterId1' | 'supportCharacterId2';
export type CollectionRole = 'all' | CharacterRole;
export type CollectionSort = 'recent' | 'name' | 'rarity';

export const LOADOUT_SLOTS: Array<{
  key: LoadoutSlotKey;
  label: string;
  role: 'combatant' | 'support';
}> = [
  { key: 'combatantCharacterId', label: '전투원', role: 'combatant' },
  { key: 'supportCharacterId1', label: '지원 1', role: 'support' },
  { key: 'supportCharacterId2', label: '지원 2', role: 'support' },
];

export function loadoutDraft(loadout: UserLoadout): UpdateLoadoutRequest {
  return {
    combatantCharacterId: loadout.combatantCharacterId,
    supportCharacterId1: loadout.supportCharacterId1,
    supportCharacterId2: loadout.supportCharacterId2,
    expectedVersion: loadout.loadoutVersion,
  };
}

export function isLoadoutDirty(draft: UpdateLoadoutRequest, loadout: UserLoadout) {
  return LOADOUT_SLOTS.some(({ key }) => draft[key] !== loadout[key]);
}

export function placementFor(loadout: Pick<UserLoadout, LoadoutSlotKey>) {
  return new Map(LOADOUT_SLOTS.map(({ key, label }) => [loadout[key], label]));
}

export function ownedMercenaries(account: UserAccountState) {
  const byId = new Map(account.characters.map((character) => [character.id, character]));
  return account.ownedCharacterIds
    .map((id) => byId.get(id))
    .filter((character): character is CharacterDefinition => Boolean(character?.enabled));
}

const rarityRank: Record<CharacterDefinition['rarity'], number> = { EX: 4, SSR: 3, SR: 2, R: 1 };

export function filterMercenaries(
  characters: CharacterDefinition[],
  query: string,
  rarity: string,
  role: CollectionRole,
  sort: CollectionSort,
) {
  const term = query.trim().toLocaleLowerCase('ko-KR');
  const result = characters.filter((character) => {
    const searchable = [
      character.name,
      character.shortName,
      character.description,
      ...character.tags,
    ]
      .join(' ')
      .toLocaleLowerCase('ko-KR');
    return (
      (!term || searchable.includes(term)) &&
      (rarity === 'all' || character.rarity === rarity) &&
      (role === 'all' || character.role === role)
    );
  });
  if (sort === 'name')
    return [...result].sort((a, b) => a.shortName.localeCompare(b.shortName, 'ko-KR'));
  if (sort === 'rarity')
    return [...result].sort(
      (a, b) =>
        rarityRank[b.rarity] - rarityRank[a.rarity] ||
        a.shortName.localeCompare(b.shortName, 'ko-KR'),
    );
  return [...result].reverse();
}

export function recommendedRoleLabel(character: CharacterDefinition) {
  if (character.allowedSlots.includes('combatant') && character.allowedSlots.includes('support'))
    return character.recommendedRole === 'combatant' ? '전투원 추천' : '지원 추천';
  return character.allowedSlots.includes('combatant') ? '전투원 전용' : '지원 전용';
}
