import { useEffect, useState } from 'react';
import type { AccountStage } from './account';
import type { UserAccountState } from '@mercenary/shared';
import { mercenaryDetailPath, mercenaryRouteForPath, type AppTab } from './app-navigation';
import { GachaScreen, ForgeScreen, InventoryScreen, LobbyScreen } from './AppScreens';
import { ConnectionStatusBanner } from './LobbyUi';
import { LoadoutEditorScreen, MercenaryCollectionScreen } from './MercenaryUi';
import { AccountScreen } from './AuthUi';
import type { AccountAuthState } from './auth-state';

type NavigationState = { from?: string; focusId?: string; modalFrom?: string };
type NavigateBlocker = (targetPath: string) => boolean;

const tabs: Array<{ id: AppTab; label: string; icon: string; locked?: boolean }> = [
  { id: 'gacha', label: '가챠', icon: '✦' },
  { id: 'mercenaries', label: '용병', icon: '♞' },
  { id: 'lobby', label: '로비', icon: '⚔' },
  { id: 'inventory', label: '인벤토리', icon: '▣' },
  { id: 'forge', label: '대장간', icon: '♜', locked: true },
];

const titles: Record<AppTab, string> = { gacha: '용병 모집', mercenaries: '용병 보관함', lobby: '작전 로비', inventory: '인벤토리', forge: '봉인된 대장간' };

function AppHeader({ tab, name, auth, onAccount }: { tab: AppTab; name: string; auth: AccountAuthState; onAccount(): void }) {
  return <header className="app-header" data-testid="app-header">
    <div className="app-brand" aria-hidden="true"><span>7×7</span></div>
    <div><small>자급용병단 MATCH</small><h1>{titles[tab]}</h1></div>
    <button type="button" className="commander-chip" aria-label={`계정 관리, ${auth.status === 'permanent' ? '이메일 계정' : '게스트 계정'}`} onClick={onAccount}><span aria-hidden="true">♟</span><b data-testid="lobby-ready">{name}</b>{auth.status !== 'permanent' && <em>게스트</em>}</button>
  </header>;
}

function BottomNavigation({ active, onNavigate }: { active: AppTab; onNavigate(tab: AppTab): void }) {
  return <nav className="bottom-navigation" aria-label="주요 메뉴" data-testid="bottom-navigation">
    {tabs.map((tab) => <button type="button" key={tab.id} className={`${tab.id === 'lobby' ? 'primary-tab' : ''} ${active === tab.id ? 'selected' : ''}`} aria-current={active === tab.id ? 'page' : undefined} aria-label={`${tab.label}${tab.locked ? ', 잠김' : ''}`} data-tab={tab.id} onClick={() => onNavigate(tab.id)}>
      <span className="tab-icon" aria-hidden="true">{tab.icon}{tab.locked && <i>⌁</i>}</span><b>{tab.label}</b>
    </button>)}
  </nav>;
}

export interface AppShellProps {
  activeTab: AppTab;
  currentPath: string;
  account: UserAccountState | null;
  accountStage: AccountStage;
  accountError: string;
  accessToken: string;
  connected: boolean;
  connectionFailed: boolean;
  name: string;
  queuedAt: number | null;
  muted: boolean;
  auth: AccountAuthState;
  onNavigate(tab: AppTab): void;
  onNavigatePath(path: string, options?: { replace?: boolean; state?: NavigationState }): void;
  registerNavigationBlocker(blocker: NavigateBlocker | null): void;
  onRetryConnection(): void;
  onRetryAccount(): void;
  onQueue(immediateBot: boolean): void;
  onLeaveQueue(): void;
  onToggleMute(): void;
  onAccountSaved(value: UserAccountState): void;
  onLinkEmail(email: string): Promise<void>;
  onCheckLink(): Promise<void>;
  onSignOut(): Promise<void>;
}

export function AppShell(props: AppShellProps) {
  const [loadoutSaved, setLoadoutSaved] = useState(false);
  useEffect(() => { if (!loadoutSaved) return; const timer = setTimeout(() => setLoadoutSaved(false), 2_400); return () => clearTimeout(timer) }, [loadoutSaved]);
  const accountBusy = props.accountStage !== 'READY' && props.accountStage !== 'RETRYABLE_ERROR' && props.accountStage !== 'FATAL_ERROR';
  const matchReady = props.connected && props.accountStage === 'READY' && Boolean(props.account?.accountReady);
  const mercenaryRoute = mercenaryRouteForPath(props.currentPath);
  const navigationState = (history.state ?? {}) as NavigationState;
  const exitOverlay = (fallback: string) => {
    if (navigationState.from || navigationState.modalFrom) history.back();
    else props.onNavigatePath(fallback, { replace: true });
  };

  if (mercenaryRoute?.kind === 'loadout' && props.account) {
    return <LoadoutEditorScreen account={props.account} token={props.accessToken} initialCharacterId={navigationState.focusId} onSaved={(value) => { props.onAccountSaved(value); setLoadoutSaved(true) }} onExit={() => exitOverlay('/mercenaries')} registerBlocker={props.registerNavigationBlocker}/>;
  }

  const detailId = mercenaryRoute?.kind === 'detail' ? mercenaryRoute.characterId : undefined, accountRoute = props.currentPath === '/account';
  const closeAccount = () => { if (navigationState.from) history.back(); else props.onNavigatePath('/lobby', { replace: true }) };
  return <main className="shell app-shell" data-testid="app-shell">
    <ConnectionStatusBanner connected={props.connected} failed={props.connectionFailed} accountBusy={accountBusy} onRetry={props.onRetryConnection}/>
    <AppHeader tab={props.activeTab} name={props.name} auth={props.auth} onAccount={() => props.onNavigatePath('/account', { state: { from: props.currentPath } })}/>
    <div className="app-content" data-testid={`screen-${props.activeTab}`}>
      {loadoutSaved && <output className="loadout-saved-toast" role="status">출전 편성을 저장했습니다.</output>}
      {(props.accountStage === 'RETRYABLE_ERROR' || props.accountStage === 'FATAL_ERROR') && <div className="account-error" role="alert" data-testid="account-status"><p>{props.accountStage === 'FATAL_ERROR' ? '계정 설정을 확인하세요.' : '용병단 기록을 불러오지 못했습니다.'}</p>{props.accountError && props.accountStage !== 'FATAL_ERROR' && <button onClick={props.onRetryAccount}>다시 시도</button>}</div>}
      {accountRoute && <AccountScreen auth={props.auth} displayName={props.name} blocked={Boolean(props.queuedAt)} onBack={closeAccount} onLink={props.onLinkEmail} onCheck={props.onCheckLink} onSignOut={props.onSignOut}/>}
      {!accountRoute && props.activeTab === 'gacha' && <GachaScreen/>}
      {!accountRoute && props.activeTab === 'mercenaries' && <MercenaryCollectionScreen account={props.account} token={props.accessToken} detailId={detailId} onOpenDetail={(id) => props.onNavigatePath(mercenaryDetailPath(id), { state: { modalFrom: '/mercenaries' } })} onCloseDetail={() => exitOverlay('/mercenaries')} onOpenLoadout={(focusId) => props.onNavigatePath('/mercenaries/loadout', { state: { from: props.currentPath, focusId } })} onInvalidDetail={() => props.onNavigatePath('/mercenaries', { replace: true })} onRetry={props.onRetryAccount} onAccountSaved={props.onAccountSaved}/>}
      {!accountRoute && props.activeTab === 'lobby' && <LobbyScreen account={props.account} name={props.name} ready={matchReady} connected={props.connected} queuedAt={props.queuedAt} muted={props.muted} onQueue={props.onQueue} onLeaveQueue={props.onLeaveQueue} onEdit={() => props.onNavigatePath('/mercenaries/loadout', { state: { from: '/lobby' } })} onToggleMute={props.onToggleMute}/>}
      {!accountRoute && props.activeTab === 'inventory' && <InventoryScreen/>}
      {!accountRoute && props.activeTab === 'forge' && <ForgeScreen/>}
    </div>
    <BottomNavigation active={props.activeTab} onNavigate={props.onNavigate}/>
  </main>;
}
