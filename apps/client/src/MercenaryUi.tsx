import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterDefinition, UpdateLoadoutRequest, UserAccountState } from '@mercenary/shared';
import { saveLoadout } from './account';
import { filterMercenaries, isLoadoutDirty, LOADOUT_SLOTS, loadoutDraft, ownedMercenaries, placementFor, recommendedRoleLabel, type CollectionRole, type CollectionSort, type LoadoutSlotKey } from './mercenary-model';
import { CharacterPortrait } from './CharacterPortrait';

type NavigateBlocker = (targetPath: string) => boolean;
const raceLabels: Record<string, string> = { human: '인간' };

function EmptyCollection({ filtered, onReset, onRetry }: { filtered: boolean; onReset(): void; onRetry(): void }) {
  return <div className="mercenary-empty" data-testid="mercenary-empty"><span aria-hidden="true">♞</span><h3>{filtered ? '조건에 맞는 용병이 없습니다.' : '보유한 용병이 없습니다.'}</h3><p>{filtered ? '검색어나 필터를 변경해 보세요.' : '계정 정보를 다시 불러와 주세요.'}</p><button className="secondary" onClick={filtered ? onReset : onRetry}>{filtered ? '필터 초기화' : '다시 불러오기'}</button></div>;
}

function MercenaryCard({ character, placement, onOpen, buttonRef }: { character: CharacterDefinition; placement?: string; onOpen(): void; buttonRef(node: HTMLButtonElement | null): void }) {
  return <button ref={buttonRef} type="button" className="collection-card" data-testid="mercenary-card" aria-label={`${character.shortName}, ${character.rarity}, ${recommendedRoleLabel(character)}${placement ? `, 현재 ${placement}` : ', 미편성'}`} onClick={onOpen}>
    <span className="collection-portrait"><CharacterPortrait src={character.portraitAsset} alt={character.name}/>{placement && <em>{placement}</em>}</span>
    <span className="collection-card-copy"><strong>{character.shortName}</strong><small>{character.rarity}</small><b>{recommendedRoleLabel(character)}</b><i>{placement ?? '미편성'}</i></span>
  </button>;
}

function AbilityPanel({ type, ability }: { type: 'active' | 'support'; ability: CharacterDefinition['combatant']['ability'] }) {
  const tags: Record<string, string> = { offense: '공격', defense: '방어', heal: '회복', disruption: '방해', shield: '보호막', execute: '결정타' };
  return <section className={`mercenary-ability ${type}`}><header><span aria-hidden="true">{type === 'active' ? '⚔' : '✦'}</span><div><small>{type === 'active' ? '전투원 액티브' : '지원 효과'}</small><h3>{ability?.name ?? '등록된 능력 없음'}</h3></div></header>{ability ? <><p>{ability.shortDescription}</p><div className="ability-meta"><span>{type === 'active' ? `마력 ${ability.cost}` : ability.cooldownMs > 0 ? `재사용 ${Math.ceil(ability.cooldownMs / 1_000)}초` : '조건 충족 시 발동'}</span>{ability.tags.map((tag) => <span key={tag}>{tags[tag] ?? tag}</span>)}</div></> : <p>현재 표시할 능력 정보가 없습니다.</p>}</section>;
}

function MercenaryDetailDialog({ character, placement, onClose, onOpenLoadout }: { character: CharacterDefinition; placement?: string; onClose(): void; onOpenLoadout(): void }) {
  const dialog = useRef<HTMLElement>(null), close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button,[href],input,select,[tabindex]:not([tabindex="-1"])')].filter((node) => !node.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0]!, last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    };
    addEventListener('keydown', keydown);
    return () => removeEventListener('keydown', keydown);
  }, [onClose]);
  return <div className="mercenary-detail-backdrop" onPointerDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section ref={dialog} className="mercenary-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="mercenary-detail-title" data-testid="mercenary-detail">
      <div className="sheet-handle" aria-hidden="true"/><button ref={close} className="detail-close" aria-label="용병 상세 닫기" onClick={onClose}>×</button>
      <div className="detail-hero"><div className="detail-aura" aria-hidden="true"/><CharacterPortrait src={character.portraitAsset} alt={`${character.shortName} 초상화`}/><div><span>{character.rarity}</span><small>{raceLabels[character.race] ?? character.race}</small><h2 id="mercenary-detail-title">{character.name}</h2><b>{character.shortName} · {recommendedRoleLabel(character)}</b>{placement && <em>현재 {placement}</em>}</div></div>
      <div className="detail-scroll"><p className="mercenary-lore">{character.description}</p><AbilityPanel type="active" ability={character.combatant.ability}/><AbilityPanel type="support" ability={character.support.ability}/></div>
      <footer><button className="secondary" onClick={onClose}>닫기</button><button onClick={onOpenLoadout}>편성에서 보기</button></footer>
    </section>
  </div>;
}

export function MercenaryCollectionScreen({ account, detailId, onOpenDetail, onCloseDetail, onOpenLoadout, onInvalidDetail, onRetry }: { account: UserAccountState | null; detailId?: string; onOpenDetail(id: string): void; onCloseDetail(): void; onOpenLoadout(characterId?: string): void; onInvalidDetail(): void; onRetry(): void }) {
  const [query, setQuery] = useState(''), [rarity, setRarity] = useState('all'), [role, setRole] = useState<CollectionRole>('all'), [sort, setSort] = useState<CollectionSort>('default');
  const cardRefs = useRef(new Map<string, HTMLButtonElement>()), lastOpened = useRef<string | undefined>(undefined);
  const characters = useMemo(() => account ? ownedMercenaries(account) : [], [account]);
  const placement = useMemo(() => account ? placementFor(account.loadout) : new Map<string, string>(), [account]);
  const rarities = useMemo(() => [...new Set(characters.map((character) => character.rarity))], [characters]);
  const filtered = useMemo(() => filterMercenaries(characters, query, rarity, role, sort), [characters, query, rarity, role, sort]);
  const selected = characters.find((character) => character.id === detailId);
  const reset = () => { setQuery(''); setRarity('all'); setRole('all'); setSort('default') };
  useEffect(() => { if (detailId && account && !selected) onInvalidDetail() }, [account, detailId, onInvalidDetail, selected]);
  useEffect(() => { if (!detailId && lastOpened.current) cardRefs.current.get(lastOpened.current)?.focus() }, [detailId]);
  if (!account) return <section className="app-screen pending-screen"><span aria-hidden="true">…</span><h2>용병 명부 확인 중</h2><p>저장된 보관함을 불러오고 있습니다.</p></section>;
  return <section className="app-screen collection-screen" aria-labelledby="collection-title">
    <header className="collection-header"><div><small>보유 {characters.length}명</small><h2 id="collection-title">용병 보관함</h2><p>보유한 용병의 기록과 능력을 살펴보세요.</p></div><button data-testid="open-loadout" onClick={() => onOpenLoadout()}>출전 편성</button></header>
    <div className="collection-controls"><label className="mercenary-search"><span className="sr-only">용병 검색</span><input value={query} type="search" placeholder="이름·설명·태그 검색" onChange={(event) => setQuery(event.target.value)}/></label><div className="collection-selects"><label><span>등급</span><select aria-label="등급 필터" value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">전체</option>{rarities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span>역할</span><select aria-label="역할 필터" value={role} onChange={(event) => setRole(event.target.value as CollectionRole)}><option value="all">전체</option><option value="combatant">전투원 추천</option><option value="support">지원 추천</option><option value="versatile">양쪽 가능</option></select></label><label><span>정렬</span><select aria-label="정렬" value={sort} onChange={(event) => setSort(event.target.value as CollectionSort)}><option value="default">기본</option><option value="name">이름</option><option value="rarity">등급</option></select></label></div></div>
    {filtered.length ? <div className="collection-grid" aria-label="보유 용병">{filtered.map((character) => <MercenaryCard key={character.id} character={character} placement={placement.get(character.id)} buttonRef={(node) => { if (node) cardRefs.current.set(character.id, node); else cardRefs.current.delete(character.id) }} onOpen={() => { lastOpened.current = character.id; onOpenDetail(character.id) }}/>)}</div> : <EmptyCollection filtered={Boolean(query || rarity !== 'all' || role !== 'all')} onReset={reset} onRetry={onRetry}/>} 
    <aside className="collection-loadout-summary"><span>현재 출전</span><b>{LOADOUT_SLOTS.map(({ key }) => account.characters.find((item) => item.id === account.loadout[key])?.shortName).filter(Boolean).join(' · ')}</b></aside>
    {selected && <MercenaryDetailDialog character={selected} placement={placement.get(selected.id)} onClose={onCloseDetail} onOpenLoadout={() => onOpenLoadout(selected.id)}/>} 
  </section>;
}

function LoadoutSlotCard({ character, slot, selected, changed, onSelect }: { character: CharacterDefinition; slot: (typeof LOADOUT_SLOTS)[number]; selected: boolean; changed: boolean; onSelect(): void }) {
  const ability = slot.role === 'combatant' ? character.combatant.ability : character.support.ability;
  return <button type="button" role="tab" aria-selected={selected} className={`loadout-slot-card ${selected ? 'selected' : ''}`} onClick={onSelect}><span className="slot-check" aria-hidden="true">{selected ? '✓' : ''}</span><small>{slot.label}{changed && <em>변경</em>}</small><CharacterPortrait src={character.portraitAsset} alt=""/><strong>{character.shortName}</strong><b>{ability?.name ?? '능력 정보 없음'}</b></button>;
}

function CandidateCard({ character, slot, placement, selected, focused, disabled, reason, onSelect }: { character: CharacterDefinition; slot: (typeof LOADOUT_SLOTS)[number]; placement?: string; selected: boolean; focused: boolean; disabled: boolean; reason?: string; onSelect(): void }) {
  const ability = slot.role === 'combatant' ? character.combatant.ability : character.support.ability;
  return <button type="button" className={`loadout-candidate ${selected ? 'selected' : ''} ${focused && !selected ? 'detail-focused' : ''}`} aria-pressed={selected} disabled={disabled} title={reason} aria-label={`${character.shortName}, ${character.rarity}, ${ability?.name ?? '능력 없음'}${focused ? ', 상세에서 선택한 용병' : ''}${reason ? `, ${reason}` : ''}`} onClick={onSelect}><CharacterPortrait src={character.portraitAsset} alt=""/><span><strong>{character.shortName}<small>{character.rarity}</small></strong><b>{ability?.name ?? '능력 정보 없음'}</b><em>{reason ?? ability?.shortDescription ?? ''}</em></span>{placement && <i>{placement}</i>}</button>;
}

function UnsavedChangesDialog({ onContinue, onDiscard }: { onContinue(): void; onDiscard(): void }) {
  const dialog = useRef<HTMLElement>(null), continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    continueButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onContinue(); return }
      if (event.key !== 'Tab' || !dialog.current) return;
      const buttons = [...dialog.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    };
    addEventListener('keydown', keydown); return () => removeEventListener('keydown', keydown);
  }, [onContinue]);
  return <div className="unsaved-backdrop"><section ref={dialog} className="unsaved-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title"><span aria-hidden="true">!</span><h2 id="unsaved-title">편성 변경을 저장하지 않고 나가시겠습니까?</h2><p>변경한 출전 슬롯은 저장되지 않습니다.</p><div><button ref={continueButton} className="secondary" onClick={onContinue}>계속 편집</button><button onClick={onDiscard}>변경 폐기</button></div></section></div>;
}

export function LoadoutEditorScreen({ account, token, initialCharacterId, onSaved, onExit, registerBlocker }: { account: UserAccountState; token: string; initialCharacterId?: string; onSaved(value: UserAccountState): void; onExit(): void; registerBlocker(blocker: NavigateBlocker | null): void }) {
  const [draft, setDraft] = useState<UpdateLoadoutRequest>(() => loadoutDraft(account.loadout));
  const [slotKey, setSlotKey] = useState<LoadoutSlotKey>('combatantCharacterId'), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [confirmMode, setConfirmMode] = useState<'button' | 'history' | null>(null);
  const allowNextPop = useRef(false), candidates = useMemo(() => ownedMercenaries(account), [account]), placement = useMemo(() => placementFor(draft as Required<Pick<UpdateLoadoutRequest, LoadoutSlotKey>>), [draft]);
  const dirty = isLoadoutDirty(draft, account.loadout), selectedSlot = LOADOUT_SLOTS.find((slot) => slot.key === slotKey)!;
  const blocker = useCallback((_targetPath: string) => { if (allowNextPop.current) { allowNextPop.current = false; return false } if (!dirty) return false; setConfirmMode('history'); return true }, [dirty]);
  useEffect(() => { registerBlocker(blocker); return () => registerBlocker(null) }, [blocker, registerBlocker]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }; addEventListener('beforeunload', beforeUnload); return () => removeEventListener('beforeunload', beforeUnload) }, [dirty]);
  useEffect(() => { if (!initialCharacterId) return; const character = candidates.find((item) => item.id === initialCharacterId); if (!character) return; const placedSlot = LOADOUT_SLOTS.find((slot) => account.loadout[slot.key] === character.id); const preferred = placedSlot?.key ?? (character.recommendedRole === 'combatant' && character.allowedSlots.includes('combatant') ? 'combatantCharacterId' : 'supportCharacterId1'); setSlotKey(preferred) }, [account.loadout, candidates, initialCharacterId]);
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !confirmMode) { event.preventDefault(); if (dirty) setConfirmMode('button'); else onExit() } }; addEventListener('keydown', keydown); return () => removeEventListener('keydown', keydown) }, [confirmMode, dirty, onExit]);
  const requestExit = () => { if (dirty) setConfirmMode('button'); else onExit() };
  const save = async () => { if (!dirty || saving) return; setSaving(true); setMessage(''); try { const result = await saveLoadout(token, draft); allowNextPop.current = true; onSaved({ ...account, loadout: result.loadout }); onExit() } catch (error) { setMessage(error instanceof Error && error.message === 'ACCOUNT_VERSION_CONFLICT' ? '다른 화면에서 편성이 변경되었습니다. 보관함으로 돌아가 최신 편성을 확인하세요.' : '편성을 저장하지 못했습니다. 변경 내용은 이 화면에 유지됩니다.') } finally { setSaving(false) } };
  const discard = () => { const mode = confirmMode; setConfirmMode(null); allowNextPop.current = true; if (mode === 'history') history.back(); else onExit() };
  return <main className="shell loadout-editor-screen" aria-busy={saving} data-testid="loadout-editor-screen">
    <header className="loadout-screen-header"><button className="loadout-back" aria-label="출전 편성 닫기" onClick={requestExit}>←</button><div><small>DEPLOYMENT</small><h1>출전 편성</h1></div><span className={dirty ? 'dirty' : ''}>{dirty ? '저장하지 않은 변경' : '서버 편성과 일치'}</span></header>
    <div className="loadout-screen-content"><section className="deployment-slots" role="tablist" aria-label="출전 슬롯">{LOADOUT_SLOTS.map((slot) => { const character = account.characters.find((item) => item.id === draft[slot.key])!; return <LoadoutSlotCard key={slot.key} character={character} slot={slot} selected={slotKey === slot.key} changed={draft[slot.key] !== account.loadout[slot.key]} onSelect={() => setSlotKey(slot.key)}/> })}</section><p className="slot-instruction"><b>{selectedSlot.label}</b>에 배치할 용병을 선택하세요.</p><section className="candidate-section"><header><h2>후보 용병</h2><small>{selectedSlot.role === 'combatant' ? '액티브 능력 기준' : '지원 효과 기준'}</small></header><div className="candidate-grid">{candidates.map((character) => { const currentPlacement = placement.get(character.id), alreadyElsewhere = Boolean(currentPlacement && draft[slotKey] !== character.id), allowed = character.allowedSlots.includes(selectedSlot.role); const reason = alreadyElsewhere ? `${currentPlacement}에 배치됨` : !allowed ? `${selectedSlot.label} 배치 불가` : undefined; return <CandidateCard key={character.id} character={character} slot={selectedSlot} placement={currentPlacement} selected={draft[slotKey] === character.id} focused={initialCharacterId === character.id} disabled={Boolean(reason)} reason={reason} onSelect={() => setDraft((value) => ({ ...value, [slotKey]: character.id }))}/> })}</div></section>{message && <output className="loadout-error" role="alert">{message}</output>}</div>
    <footer className="loadout-screen-actions"><button className="secondary" disabled={saving} onClick={requestExit}>취소</button><button data-testid="save-loadout" disabled={!dirty || saving} onClick={save}>{saving ? '저장 중…' : '편성 저장'}</button></footer>
    {confirmMode && <UnsavedChangesDialog onContinue={() => setConfirmMode(null)} onDiscard={discard}/>} 
  </main>;
}
