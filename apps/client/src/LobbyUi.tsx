import { useEffect, useMemo, useState } from 'react';
import type { BattleLoadoutSnapshot, CharacterDefinition, UpdateLoadoutRequest, UserAccountState } from '@mercenary/shared';
import { saveLoadout } from './account';
import { LoadoutSummary } from './BattleUi';

export function accountLoadoutSnapshot(account: UserAccountState): BattleLoadoutSnapshot {
  const convert = (id: string) => { const item = account.characters.find((character) => character.id === id)!; return { characterId: item.id, name: item.name, portraitAsset: item.portraitAsset, rarity: item.rarity } };
  return { combatant: convert(account.loadout.combatantCharacterId), supports: [convert(account.loadout.supportCharacterId1), convert(account.loadout.supportCharacterId2)] };
}

export function ConnectionStatusBanner({ connected, failed, accountBusy, onRetry }: { connected: boolean; failed: boolean; accountBusy: boolean; onRetry(): void }) {
  if (connected && !accountBusy) return null;
  const text = accountBusy ? '계정 세션을 복구하는 중...' : failed ? '연결이 끊겼습니다.' : '재연결 중...';
  return <aside className={`connection-banner ${failed ? 'error' : ''}`} role={failed ? 'alert' : 'status'} data-testid="connection-banner"><span aria-hidden="true">{failed ? '!' : '…'}</span>{text}{failed && <button onClick={onRetry}>재시도</button>}</aside>;
}

function CharacterCard({ character, placed, disabled, selected, onClick }: { character: CharacterDefinition; placed: string; disabled: boolean; selected: boolean; onClick(): void }) {
  return <button className={`character-card ${selected ? 'selected' : ''}`} disabled={disabled} aria-pressed={selected} aria-label={`${character.name}${disabled ? `, ${placed}에 배치됨` : ''}`} title={disabled ? `${placed}에 이미 배치됨` : undefined} onClick={onClick}><img src={character.portraitAsset} alt=""/><span><b>{character.name}</b><small>{character.rarity} · {character.recommendedRole === 'combatant' ? '전투원 추천' : '지원 추천'}</small><em>⚔ {character.combatant.ability?.name ?? '-'}</em><em>✦ {character.support.ability?.name ?? '-'}</em>{placed && <strong>{placed}</strong>}</span></button>;
}

function CharacterDetailPanel({ character, slot, onAssign, disabled }: { character: CharacterDefinition; slot: string; onAssign(): void; disabled: boolean }) {
  return <section className="character-detail" data-testid="character-detail"><div><img src={character.portraitAsset} alt=""/><span><small>{character.rarity} · {character.recommendedRole === 'combatant' ? '전투원 추천' : '지원 추천'}</small><h3>{character.name}</h3></span></div><p>{character.description}</p><dl><div><dt>액티브 · {character.combatant.ability?.name}</dt><dd>{character.combatant.ability?.shortDescription}</dd></div><div><dt>지원 · {character.support.ability?.name}</dt><dd>{character.support.ability?.shortDescription}</dd></div></dl><button disabled={disabled} onClick={onAssign}>{disabled ? '다른 슬롯에 배치됨' : `${slot}에 배치`}</button></section>;
}

type SlotKey = 'combatantCharacterId' | 'supportCharacterId1' | 'supportCharacterId2';
const slots: Array<[SlotKey, string]> = [['combatantCharacterId', '전투원'], ['supportCharacterId1', '지원 1'], ['supportCharacterId2', '지원 2']];

export function LoadoutEditor({ account, token, onClose, onSaved }: { account: UserAccountState; token: string; onClose(): void; onSaved(value: UserAccountState): void }) {
  const original = account.loadout;
  const [draft, setDraft] = useState<UpdateLoadoutRequest>({ combatantCharacterId: original.combatantCharacterId, supportCharacterId1: original.supportCharacterId1, supportCharacterId2: original.supportCharacterId2, expectedVersion: original.loadoutVersion });
  const [slot, setSlot] = useState<SlotKey>('combatantCharacterId'), [selectedId, setSelectedId] = useState(original.combatantCharacterId), [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  const selected = account.characters.find((item) => item.id === selectedId) ?? account.characters[0]!;
  const dirty = draft.combatantCharacterId !== original.combatantCharacterId || draft.supportCharacterId1 !== original.supportCharacterId1 || draft.supportCharacterId2 !== original.supportCharacterId2;
  const placed = useMemo(() => new Map(slots.map(([key, label]) => [draft[key], label])), [draft]);
  const selectedDisabled = Boolean(placed.get(selected.id) && draft[slot] !== selected.id);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }; addEventListener('keydown', close); return () => removeEventListener('keydown', close) }, [onClose, saving]);
  const save = async () => { setSaving(true); setMessage(''); try { const result = await saveLoadout(token, draft); onSaved({ ...account, loadout: result.loadout }) } catch { setMessage('편성을 저장하지 못했습니다. 기존 편성을 유지합니다.') } finally { setSaving(false) } };
  return <div className="loadout-modal"><section className="loadout-card" role="dialog" aria-modal="true" aria-label="용병 편성"><header><div><small>현재 편성</small><h2>용병 편성</h2></div><button className="close-button" aria-label="편성 닫기" onClick={onClose}>×</button></header><div className="loadout-slots">{slots.map(([key, label]) => { const character = account.characters.find((item) => item.id === draft[key])!; return <button className={slot === key ? 'selected' : ''} key={key} aria-pressed={slot === key} onClick={() => { setSlot(key); setSelectedId(draft[key]) }}><img src={character.portraitAsset} alt=""/><span><small>{label}</small><b>{character.shortName}</b></span></button> })}</div><p className="editor-hint">{slots.find(([key]) => key === slot)![1]} 슬롯을 선택했습니다. 용병을 비교하세요.</p><div className="editor-content"><div className="roster" aria-label="보유 캐릭터">{account.characters.filter((item) => account.ownedCharacterIds.includes(item.id)).map((character) => <CharacterCard key={character.id} character={character} placed={placed.get(character.id) ?? ''} disabled={Boolean(placed.get(character.id) && draft[slot] !== character.id)} selected={selected.id === character.id} onClick={() => setSelectedId(character.id)}/>)}</div><CharacterDetailPanel character={selected} slot={slots.find(([key]) => key === slot)![1]} disabled={selectedDisabled} onAssign={() => setDraft((value) => ({ ...value, [slot]: selected.id }))}/></div>{message && <output className="save-error" role="alert">{message}</output>}<footer className="loadout-actions"><span>{dirty ? '저장하지 않은 변경' : '서버 편성과 일치'}</span><button className="secondary" disabled={saving} onClick={onClose}>취소</button><button disabled={saving || !dirty} onClick={save}>{saving ? '저장 중...' : '편성 적용'}</button></footer></section></div>;
}

export function LobbyLoadout({ account }: { account: UserAccountState }) { return <LoadoutSummary loadout={accountLoadoutSnapshot(account)}/> }
