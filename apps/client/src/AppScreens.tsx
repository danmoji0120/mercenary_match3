import { useEffect, useState } from 'react';
import type { UserAccountState } from '@mercenary/shared';
import { LobbyLoadout, accountLoadoutSnapshot } from './LobbyUi';

function QueueTimer({ since }: { since: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const update = () => setSeconds(Math.floor((Date.now() - since) / 1_000)); update(); const timer = setInterval(update, 1_000); return () => clearInterval(timer) }, [since]);
  return <div className="queue-time" aria-live="polite">대기 중 {seconds}s</div>;
}

export function GachaScreen() {
  return <section className="app-screen gacha-screen" aria-labelledby="gacha-title">
    <div className="feature-banner gacha-banner"><span className="banner-sigil" aria-hidden="true">◇</span><small>DIMENSIONAL CONTRACT</small><h2 id="gacha-title">신규 용병 모집 준비 중</h2><p>사무소의 차원 통신망을 조율하고 있습니다.<br/>계약 전단이 확보되면 새로운 용병을 만날 수 있습니다.</p><em>준비 중</em></div>
    <div className="recruit-actions" aria-label="준비 중인 모집 메뉴"><button disabled><span>1회 모집</span><small>준비 중</small></button><button disabled><span>10회 모집</span><small>준비 중</small></button></div>
    <p className="feature-footnote">실제 모집 기능은 향후 콘텐츠와 함께 개방됩니다.</p>
  </section>;
}

function LobbyCharacterDisplay({ account }: { account: UserAccountState }) {
  const loadout = accountLoadoutSnapshot(account);
  return <section className="lobby-character-display" aria-label="현재 출전 용병">
    <div className="lobby-glow" aria-hidden="true"/>
    <figure className="lobby-lead"><img src={loadout.combatant.portraitAsset} alt=""/><figcaption><small>전투원</small><strong>{loadout.combatant.name}</strong><span>{loadout.combatant.rarity}</span></figcaption></figure>
    {loadout.supports.map((support, index) => <figure className={`lobby-support support-${index + 1}`} key={support.characterId}><img src={support.portraitAsset} alt=""/><figcaption><small>지원 {index + 1}</small><strong>{support.name}</strong></figcaption></figure>)}
  </section>;
}

export function LobbyScreen({ account, name, ready, connected, queuedAt, muted, onQueue, onLeaveQueue, onEdit, onToggleMute }: { account: UserAccountState | null; name: string; ready: boolean; connected: boolean; queuedAt: number | null; muted: boolean; onQueue(immediateBot: boolean): void; onLeaveQueue(): void; onEdit(): void; onToggleMute(): void }) {
  const disabledReason = !connected ? '서버 재연결 중' : !ready ? '계정 준비 중' : '';
  return <section className="app-screen home-screen" aria-labelledby="lobby-title">
    <header className="home-welcome"><small>어서 오세요, 단장님</small><h2 id="lobby-title">{name}</h2><p>오늘의 출전 용병을 확인하고 작전을 시작하세요.</p></header>
    {account ? <LobbyCharacterDisplay account={account}/> : <div className="lobby-character-placeholder" aria-hidden="true">용병단 집결 중…</div>}
    <div className="home-notice"><span aria-hidden="true">!</span><p><b>사무소 공지</b><small>차원 균열 모의전이 상시 개방되어 있습니다.</small></p></div>
    <div className="lobby-actions home-actions">
      {queuedAt ? <><QueueTimer since={queuedAt}/><button onClick={onLeaveQueue}>대기 취소</button></> : <><button data-testid="normal-match" disabled={!ready} title={disabledReason} onClick={() => onQueue(false)}>일반전<small>실시간 대전</small></button><button className="secondary" data-testid="bot-match" aria-label="봇 대전 · 봇과 즉시 대전" disabled={!ready} title={disabledReason} onClick={() => onQueue(true)}>봇 대전<small>즉시 훈련</small></button></>}
    </div>
    <div className="home-secondary-actions"><button className="secondary edit-loadout" data-testid="edit-loadout" disabled={!account || Boolean(queuedAt)} onClick={onEdit}>용병 편성 변경</button><button className="quiet-button" onClick={onToggleMute} aria-label={`음소거 ${muted ? '켜짐' : '꺼짐'}`}>음소거 {muted ? 'OFF' : 'ON'}</button></div>
    {account && <div className="home-loadout-summary"><LobbyLoadout account={account}/></div>}
  </section>;
}

const inventoryCategories = ['전체', '장비', '소모품', '재료', '기타'] as const;
export function InventoryScreen() {
  const [category, setCategory] = useState<(typeof inventoryCategories)[number]>('전체');
  return <section className="app-screen inventory-screen" aria-labelledby="inventory-title">
    <header className="screen-heading"><small>STORAGE</small><h2 id="inventory-title">인벤토리</h2><p>용병단이 확보한 물품을 보관하는 공간입니다.</p></header>
    <div className="inventory-filters" role="tablist" aria-label="물품 분류">{inventoryCategories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'selected' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="empty-state" data-testid="inventory-empty"><span aria-hidden="true">□</span><h3>{category} 보관함이 비어 있습니다</h3><p>아직 보관된 물품이 없습니다.<br/>인벤토리는 이후 콘텐츠와 함께 확장됩니다.</p><small>0 / 0</small></div>
  </section>;
}

export function ForgeScreen() {
  return <section className="app-screen forge-screen" aria-labelledby="forge-title">
    <header className="screen-heading"><small>SEALED WORKSHOP</small><h2 id="forge-title">대장간</h2></header>
    <div className="sealed-forge" data-testid="forge-locked"><div className="forge-emblem" aria-hidden="true"><i/><span>⚒</span><b>⌁</b></div><small>봉인된 차원 화로</small><h3>희미한 열기만 남아 있습니다</h3><p>대장장이가 돌아오면<br/>장비 제작과 강화 기능이 개방됩니다.</p><em>개방 준비 중</em></div>
    <p className="feature-footnote">해금 조건과 일정은 아직 정해지지 않았습니다.</p>
  </section>;
}
