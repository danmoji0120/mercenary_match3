import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CharacterDefinition,
  UpdateLoadoutRequest,
  UserAccountState,
} from '@mercenary/shared';
import { saveLoadout } from './account';
import { CharacterPortrait } from './CharacterPortrait';
import { EmptyState, GameIcon, RarityBadge, RoleBadge, TileTypeIcon } from './GameUi';
import {
  filterMercenaries,
  isLoadoutDirty,
  LOADOUT_SLOTS,
  loadoutDraft,
  ownedMercenaries,
  placementFor,
  recommendedRoleLabel,
  type CollectionRole,
  type CollectionSort,
  type LoadoutSlotKey,
} from './mercenary-model';

type NavigateBlocker = (targetPath: string) => boolean;
const raceLabels: Record<string, string> = { HUMAN: '인간', human: '인간' };
const roleOptions: Array<{ value: CollectionRole; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'ATTACK', label: '공격' },
  { value: 'DEFENSE', label: '방어' },
  { value: 'DISRUPT', label: '방해' },
  { value: 'HEAL', label: '회복' },
  { value: 'SUPPORT', label: '지원' },
];

function AbilityPanel({
  type,
  ability,
}: {
  type: 'active' | 'support';
  ability: CharacterDefinition['combatant']['ability'];
}) {
  return (
    <section className={`mercenary-ability ${type}`}>
      <header>
        <div>
          <small>{type === 'active' ? '전투원 액티브' : '지원 효과'}</small>
          <h3>{ability?.name ?? '등록된 능력 없음'}</h3>
        </div>
      </header>
      {ability ? (
        <>
          <p>{ability.fullDescription || ability.shortDescription}</p>
          <div className="ability-meta">
            <span>
              {type === 'active'
                ? `마력 ${ability.cost}`
                : ability.cooldownMs > 0
                  ? `재사용 ${Math.ceil(ability.cooldownMs / 1_000)}초`
                  : '조건 충족 시 발동'}
            </span>
            {ability.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </>
      ) : (
        <p>현재 표시할 능력 정보가 없습니다.</p>
      )}
    </section>
  );
}

function MercenaryDetailDialog({
  character,
  placement,
  onClose,
  onOpenLoadout,
}: {
  character: CharacterDefinition;
  placement?: string;
  onClose(): void;
  onOpenLoadout(): void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<'info' | 'active' | 'support'>('info');
  useEffect(() => {
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button,[href],input,select,[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => !node.hasAttribute('disabled'));
      const first = focusable[0],
        last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  }, [onClose]);
  const stats = character.stats;
  return (
    <div
      className="mercenary-detail-backdrop"
      onPointerDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialog}
        className="mercenary-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mercenary-detail-title"
        data-testid="mercenary-detail"
      >
        <div className="sheet-handle" aria-hidden="true" />
        <button ref={close} className="detail-close" aria-label="용병 상세 닫기" onClick={onClose}>
          <GameIcon name="close" />
        </button>
        <div className="detail-hero">
          <CharacterPortrait
            src={character.portraitAsset}
            alt={`${character.shortName} 초상화`}
            eager
            variant="detail"
            characterId={character.id}
            shortName={character.shortName}
            rarity={character.rarity}
            role={character.role}
          />
          <div>
            <RarityBadge rarity={character.rarity} />
            <RoleBadge role={character.role} />
            <small>{raceLabels[character.race] ?? character.race}</small>
            <h2 id="mercenary-detail-title">{character.name}</h2>
            <b>
              {character.shortName} · {recommendedRoleLabel(character)}
            </b>
            {placement && <em>현재 {placement}</em>}
          </div>
        </div>
        <div className="detail-tabs" role="tablist" aria-label="용병 정보">
          <button role="tab" aria-selected={tab === 'info'} onClick={() => setTab('info')}>
            <GameIcon name="info" /> 정보
          </button>
          <button role="tab" aria-selected={tab === 'active'} onClick={() => setTab('active')}>
            <GameIcon name="active" /> 액티브
          </button>
          <button role="tab" aria-selected={tab === 'support'} onClick={() => setTab('support')}>
            <GameIcon name="support" /> 지원
          </button>
        </div>
        <div className="detail-scroll">
          {tab === 'info' && (
            <>
              <p className="mercenary-lore">{character.description}</p>
              <dl className="character-stat-grid">
                <div>
                  <dt><GameIcon name="hp" />최대 HP</dt>
                  <dd>{stats.maxHp.toLocaleString('ko-KR')}</dd>
                </div>
                <div>
                  <dt><TileTypeIcon type="SWORD" />검 효과</dt>
                  <dd>{stats.swordEffectPct}%</dd>
                </div>
                <div>
                  <dt><TileTypeIcon type="SHIELD" />방패 효과</dt>
                  <dd>{stats.shieldEffectPct}%</dd>
                </div>
                <div>
                  <dt><TileTypeIcon type="HEAL" />회복 효과</dt>
                  <dd>{stats.healEffectPct}%</dd>
                </div>
                <div>
                  <dt><TileTypeIcon type="MANA" />마력 획득</dt>
                  <dd>{stats.manaGainPct}%</dd>
                </div>
              </dl>
            </>
          )}
          {tab === 'active' && <AbilityPanel type="active" ability={character.combatant.ability} />}
          {tab === 'support' && <AbilityPanel type="support" ability={character.support.ability} />}
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            닫기
          </button>
          <button onClick={onOpenLoadout}>편성에서 보기</button>
        </footer>
      </section>
    </div>
  );
}

export function MercenaryCollectionScreen({
  account,
  detailId,
  onOpenDetail,
  onCloseDetail,
  onOpenLoadout,
  onInvalidDetail,
  onRetry,
}: {
  account: UserAccountState | null;
  detailId?: string;
  onOpenDetail(id: string): void;
  onCloseDetail(): void;
  onOpenLoadout(characterId?: string): void;
  onInvalidDetail(): void;
  onRetry(): void;
}) {
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState('all');
  const [role, setRole] = useState<CollectionRole>('all');
  const [sort, setSort] = useState<CollectionSort>('recent');
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastOpened = useRef<string | undefined>(undefined);
  const characters = useMemo(() => (account ? ownedMercenaries(account) : []), [account]);
  const placements = useMemo(
    () => (account ? placementFor(account.loadout) : new Map<string, string>()),
    [account],
  );
  const rarities = useMemo(
    () => [...new Set(characters.map((character) => character.rarity))],
    [characters],
  );
  const filtered = useMemo(
    () => filterMercenaries(characters, query, rarity, role, sort),
    [characters, query, rarity, role, sort],
  );
  const selected = characters.find((character) => character.id === detailId);
  const reset = () => {
    setQuery('');
    setRarity('all');
    setRole('all');
    setSort('recent');
  };
  useEffect(() => {
    if (detailId && account && !selected) onInvalidDetail();
  }, [account, detailId, onInvalidDetail, selected]);
  useEffect(() => {
    if (!detailId && lastOpened.current) cardRefs.current.get(lastOpened.current)?.focus();
  }, [detailId]);
  if (!account)
    return (
      <section className="app-screen pending-screen">
        <h2>용병 명부 확인 중</h2>
        <p>저장된 보유 용병을 불러오고 있습니다.</p>
      </section>
    );
  return (
    <section className="app-screen collection-screen" aria-labelledby="collection-title">
      <header className="collection-header">
        <div>
          <small>보유 {characters.length}명</small>
          <h2 id="collection-title">용병 보관함</h2>
          <p>보유한 용병을 검색하고 능력을 확인하세요.</p>
        </div>
        <button data-testid="open-loadout" onClick={() => onOpenLoadout()}>
          출전 편성
        </button>
      </header>
      <div className="collection-controls">
        <label className="mercenary-search">
          <span className="sr-only">용병 검색</span>
          <GameIcon name="search" />
          <input
            value={query}
            type="search"
            placeholder="이름·설명·태그 검색"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="collection-selects">
          <label>
            <span>등급</span>
            <select
              aria-label="등급 필터"
              value={rarity}
              onChange={(event) => setRarity(event.target.value)}
            >
              <option value="all">전체</option>
              {rarities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>역할</span>
            <select
              aria-label="역할 필터"
              value={role}
              onChange={(event) => setRole(event.target.value as CollectionRole)}
            >
              {roleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select
              aria-label="정렬"
              value={sort}
              onChange={(event) => setSort(event.target.value as CollectionSort)}
            >
              <option value="recent">최근 획득</option>
              <option value="rarity">등급</option>
              <option value="name">이름</option>
            </select>
          </label>
        </div>
        <div className="collection-result-row">
          <span>결과 {filtered.length}명</span>
          <button type="button" className="text-button" onClick={reset}>
            <GameIcon name="reset" /> 필터 초기화
          </button>
        </div>
      </div>
      {filtered.length ? (
        <div className="collection-grid" aria-label="보유 용병">
          {filtered.map((character) => {
            const currentPlacement = placements.get(character.id);
            return (
              <button
                ref={(node) => {
                  if (node) cardRefs.current.set(character.id, node);
                  else cardRefs.current.delete(character.id);
                }}
                key={character.id}
                type="button"
                className="collection-card"
                data-testid="mercenary-card"
                aria-label={`${character.shortName}, ${character.rarity}, ${character.role}${currentPlacement ? `, 현재 ${currentPlacement}` : ', 미편성'}`}
                onClick={() => {
                  lastOpened.current = character.id;
                  onOpenDetail(character.id);
                }}
              >
                <span className="collection-portrait">
                  <CharacterPortrait
                    src={character.portraitAsset}
                    alt=""
                    variant="card"
                    characterId={character.id}
                    shortName={character.shortName}
                    rarity={character.rarity}
                    role={character.role}
                  />
                  {currentPlacement && <em>{currentPlacement}</em>}
                </span>
                <span className="collection-card-copy">
                  <strong title={character.name}>{character.shortName}</strong>
                  <RarityBadge rarity={character.rarity} />
                  <RoleBadge role={character.role} />
                  <i>{currentPlacement ?? '미편성'}</i>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 용병이 없습니다."
          description="검색어나 필터 조건을 변경해 보세요."
          action={
            <button
              type="button"
              className="secondary"
              onClick={characters.length ? reset : onRetry}
            >
              {characters.length ? '필터 초기화' : '다시 불러오기'}
            </button>
          }
        />
      )}
      <aside className="collection-loadout-summary">
        <span>현재 출전</span>
        <b>
          {LOADOUT_SLOTS.map(
            ({ key }) =>
              account.characters.find((item) => item.id === account.loadout[key])?.shortName,
          )
            .filter(Boolean)
            .join(' · ')}
        </b>
      </aside>
      {selected && (
        <MercenaryDetailDialog
          character={selected}
          placement={placements.get(selected.id)}
          onClose={onCloseDetail}
          onOpenLoadout={() => onOpenLoadout(selected.id)}
        />
      )}
    </section>
  );
}

function LoadoutSlotCard({
  character,
  slot,
  selected,
  changed,
  onSelect,
}: {
  character: CharacterDefinition;
  slot: (typeof LOADOUT_SLOTS)[number];
  selected: boolean;
  changed: boolean;
  onSelect(): void;
}) {
  const ability =
    slot.role === 'combatant' ? character.combatant.ability : character.support.ability;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`loadout-slot-card loadout-slot-${slot.role} ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <span className="slot-check" aria-hidden="true">
        {selected ? <GameIcon name="check" /> : null}
      </span>
      <small>
        {slot.label}
        {changed && <em>변경</em>}
      </small>
      <CharacterPortrait src={character.portraitAsset} alt="" variant={slot.role === 'combatant' ? 'combat' : 'support'} characterId={character.id} shortName={character.shortName} rarity={character.rarity} role={character.role} />
      <strong>{character.shortName}</strong>
      <b>{ability?.name ?? '능력 정보 없음'}</b>
    </button>
  );
}

function CandidateCard({
  character,
  slot,
  placement,
  selected,
  focused,
  disabled,
  reason,
  onSelect,
}: {
  character: CharacterDefinition;
  slot: (typeof LOADOUT_SLOTS)[number];
  placement?: string;
  selected: boolean;
  focused: boolean;
  disabled: boolean;
  reason?: string;
  onSelect(): void;
}) {
  const ability =
    slot.role === 'combatant' ? character.combatant.ability : character.support.ability;
  return (
    <button
      type="button"
      className={`loadout-candidate ${selected ? 'selected' : ''} ${focused && !selected ? 'detail-focused' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      title={reason}
      onClick={onSelect}
    >
      <CharacterPortrait src={character.portraitAsset} alt="" variant="card" characterId={character.id} shortName={character.shortName} rarity={character.rarity} role={character.role} />
      <span>
        <strong>
          {character.shortName}
          <small>{character.rarity}</small>
        </strong>
        <b>{ability?.name ?? '능력 정보 없음'}</b>
        <em>{reason ?? ability?.shortDescription ?? ''}</em>
      </span>
      {placement && <i>{placement}</i>}
    </button>
  );
}

function UnsavedChangesDialog({
  onContinue,
  onDiscard,
}: {
  onContinue(): void;
  onDiscard(): void;
}) {
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    continueButton.current?.focus();
  }, []);
  return (
    <div className="unsaved-backdrop">
      <section
        className="unsaved-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <GameIcon name="warning" />
        <h2 id="unsaved-title">편성 변경을 저장하지 않고 나가시겠습니까?</h2>
        <p>변경한 출전 슬롯은 저장되지 않습니다.</p>
        <div>
          <button ref={continueButton} className="secondary" onClick={onContinue}>
            계속 편집
          </button>
          <button onClick={onDiscard}>변경 폐기</button>
        </div>
      </section>
    </div>
  );
}

export function LoadoutEditorScreen({
  account,
  token,
  initialCharacterId,
  onSaved,
  onExit,
  registerBlocker,
}: {
  account: UserAccountState;
  token: string;
  initialCharacterId?: string;
  onSaved(value: UserAccountState): void;
  onExit(): void;
  registerBlocker(blocker: NavigateBlocker | null): void;
}) {
  const [draft, setDraft] = useState<UpdateLoadoutRequest>(() => loadoutDraft(account.loadout));
  const [slotKey, setSlotKey] = useState<LoadoutSlotKey>('combatantCharacterId');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmMode, setConfirmMode] = useState<'button' | 'history' | null>(null);
  const allowNextPop = useRef(false);
  const candidates = useMemo(() => ownedMercenaries(account), [account]);
  const placement = useMemo(
    () => placementFor(draft as Required<Pick<UpdateLoadoutRequest, LoadoutSlotKey>>),
    [draft],
  );
  const dirty = isLoadoutDirty(draft, account.loadout),
    selectedSlot = LOADOUT_SLOTS.find((slot) => slot.key === slotKey)!;
  const blocker = useCallback(() => {
    if (allowNextPop.current) {
      allowNextPop.current = false;
      return false;
    }
    if (!dirty) return false;
    setConfirmMode('history');
    return true;
  }, [dirty]);
  useEffect(() => {
    registerBlocker(blocker);
    return () => registerBlocker(null);
  }, [blocker, registerBlocker]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    addEventListener('beforeunload', beforeUnload);
    return () => removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => {
    if (!initialCharacterId) return;
    const character = candidates.find((item) => item.id === initialCharacterId);
    if (!character) return;
    const placedSlot = LOADOUT_SLOTS.find((slot) => account.loadout[slot.key] === character.id);
    setSlotKey(
      placedSlot?.key ??
        (character.allowedSlots.includes('combatant')
          ? 'combatantCharacterId'
          : 'supportCharacterId1'),
    );
  }, [account.loadout, candidates, initialCharacterId]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmMode) {
        event.preventDefault();
        if (dirty) setConfirmMode('button');
        else onExit();
      }
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  }, [confirmMode, dirty, onExit]);
  const requestExit = () => {
    if (dirty) setConfirmMode('button');
    else onExit();
  };
  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const result = await saveLoadout(token, draft);
      allowNextPop.current = true;
      onSaved({ ...account, loadout: result.loadout });
      onExit();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'ACCOUNT_VERSION_CONFLICT'
          ? '다른 화면에서 편성이 변경되었습니다. 최신 편성을 확인해 주세요.'
          : '편성을 저장하지 못했습니다. 변경 내용은 이 화면에 유지됩니다.',
      );
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    const mode = confirmMode;
    setConfirmMode(null);
    allowNextPop.current = true;
    if (mode === 'history') history.back();
    else onExit();
  };
  return (
    <section
      className="loadout-editor-screen"
      aria-busy={saving}
      data-testid="loadout-editor-screen"
    >
      <header className="loadout-screen-header">
        <button className="loadout-back" aria-label="출전 편성 닫기" onClick={requestExit}>
          <GameIcon name="back" />
        </button>
        <div>
          <small>DEPLOYMENT</small>
          <h1>출전 편성</h1>
        </div>
        <span className={dirty ? 'dirty' : ''}>
          {dirty ? '저장하지 않은 변경' : '서버 편성과 일치'}
        </span>
      </header>
      <div className="loadout-screen-content">
        <section className="deployment-slots" role="tablist" aria-label="출전 슬롯">
          {LOADOUT_SLOTS.map((slot) => {
            const character = account.characters.find((item) => item.id === draft[slot.key])!;
            return (
              <LoadoutSlotCard
                key={slot.key}
                character={character}
                slot={slot}
                selected={slotKey === slot.key}
                changed={draft[slot.key] !== account.loadout[slot.key]}
                onSelect={() => setSlotKey(slot.key)}
              />
            );
          })}
        </section>
        <p className="slot-instruction">
          <b>{selectedSlot.label}</b>에 배치할 용병을 선택하세요.
        </p>
        <section className="candidate-section">
          <header>
            <h2>후보 용병</h2>
            <small>
              {selectedSlot.role === 'combatant' ? '액티브 능력 기준' : '지원 효과 기준'}
            </small>
          </header>
          <div className="candidate-grid">
            {candidates.map((character) => {
              const currentPlacement = placement.get(character.id),
                alreadyElsewhere = Boolean(currentPlacement && draft[slotKey] !== character.id),
                allowed = character.allowedSlots.includes(selectedSlot.role);
              const reason = alreadyElsewhere
                ? `${currentPlacement}에 배치됨`
                : !allowed
                  ? `${selectedSlot.label} 배치 불가`
                  : undefined;
              return (
                <CandidateCard
                  key={character.id}
                  character={character}
                  slot={selectedSlot}
                  placement={currentPlacement}
                  selected={draft[slotKey] === character.id}
                  focused={initialCharacterId === character.id}
                  disabled={Boolean(reason)}
                  reason={reason}
                  onSelect={() => setDraft((value) => ({ ...value, [slotKey]: character.id }))}
                />
              );
            })}
          </div>
        </section>
        {message && (
          <output className="loadout-error" role="alert">
            {message}
          </output>
        )}
      </div>
      <footer className="loadout-screen-actions">
        <button className="secondary" disabled={saving} onClick={requestExit}>
          취소
        </button>
        <button data-testid="save-loadout" disabled={!dirty || saving} onClick={save}>
          {saving ? '저장 중…' : '편성 저장'}
        </button>
      </footer>
      {confirmMode && (
        <UnsavedChangesDialog onContinue={() => setConfirmMode(null)} onDiscard={discard} />
      )}
    </section>
  );
}
