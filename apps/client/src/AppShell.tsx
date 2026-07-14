import { useEffect, useState } from 'react';
import type { UserAccountState } from '@mercenary/shared';
import type { AccountStage } from './account';
import { mercenaryDetailPath, mercenaryRouteForPath, type AppTab } from './app-navigation';
import { LobbyScreen } from './AppScreens';
import { ConnectionStatusBanner } from './LobbyUi';
import { LoadoutEditorScreen, MercenaryCollectionScreen } from './MercenaryUi';
import { AccountScreen } from './AuthUi';
import type { AccountAuthState } from './auth-state';
import { GameIcon, TopResourceBar } from './GameUi';

type NavigationState = { from?: string; focusId?: string; modalFrom?: string };
type NavigateBlocker = (targetPath: string) => boolean;
const navigationItems = [
  { id: 'lobby', label: '로비', path: '/lobby', icon: 'home' },
  { id: 'mercenaries', label: '용병', path: '/mercenaries', icon: 'roster' },
  { id: 'loadout', label: '편성', path: '/mercenaries/loadout', icon: 'formation' },
] as const;

function BottomNavigation({
  activePath,
  onNavigate,
}: {
  activePath: string;
  onNavigate(path: string): void;
}) {
  return (
    <nav
      className="bottom-navigation unified-navigation"
      aria-label="주요 메뉴"
      data-testid="bottom-navigation"
    >
      {navigationItems.map((item) => {
        const selected =
          item.id === 'loadout'
            ? activePath === item.path
            : activePath === item.path ||
              (item.id === 'mercenaries' &&
                activePath.startsWith('/mercenaries/') &&
                activePath !== '/mercenaries/loadout');
        return (
          <button
            type="button"
            key={item.id}
            className={selected ? 'selected' : ''}
            aria-current={selected ? 'page' : undefined}
            data-tab={item.id}
            onClick={() => onNavigate(item.path)}
          >
            <span className="tab-icon">
              <GameIcon name={item.icon} />
            </span>
            <b>{item.label}</b>
          </button>
        );
      })}
    </nav>
  );
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
  useEffect(() => {
    if (!loadoutSaved) return;
    const timer = setTimeout(() => setLoadoutSaved(false), 2_400);
    return () => clearTimeout(timer);
  }, [loadoutSaved]);
  const accountBusy =
    props.accountStage !== 'READY' &&
    props.accountStage !== 'RETRYABLE_ERROR' &&
    props.accountStage !== 'FATAL_ERROR';
  const matchReady =
    props.connected && props.accountStage === 'READY' && Boolean(props.account?.accountReady);
  const mercenaryRoute = mercenaryRouteForPath(props.currentPath),
    navigationState = (history.state ?? {}) as NavigationState;
  const exitOverlay = (fallback: string) => {
    if (navigationState.from || navigationState.modalFrom) history.back();
    else props.onNavigatePath(fallback, { replace: true });
  };
  const accountButton = () =>
    props.onNavigatePath('/account', { state: { from: props.currentPath } });
  const resourceBar = (
    <TopResourceBar
      account={props.account}
      name={props.name}
      guest={props.auth.status !== 'permanent'}
      token={props.accessToken}
      onAccount={accountButton}
      onAccountSaved={props.onAccountSaved}
    />
  );

  if (mercenaryRoute?.kind === 'loadout' && props.account)
    return (
      <main className="shell app-shell" data-testid="app-shell">
        {resourceBar}
        <div className="app-content loadout-shell-content">
          <LoadoutEditorScreen
            account={props.account}
            token={props.accessToken}
            initialCharacterId={navigationState.focusId}
            onSaved={(value) => {
              props.onAccountSaved(value);
              setLoadoutSaved(true);
            }}
            onExit={() => exitOverlay('/mercenaries')}
            registerBlocker={props.registerNavigationBlocker}
          />
        </div>
        <BottomNavigation activePath={props.currentPath} onNavigate={props.onNavigatePath} />
      </main>
    );

  const detailId = mercenaryRoute?.kind === 'detail' ? mercenaryRoute.characterId : undefined,
    accountRoute = props.currentPath === '/account';
  const closeAccount = () => {
    if (navigationState.from) history.back();
    else props.onNavigatePath('/lobby', { replace: true });
  };
  return (
    <main className="shell app-shell" data-testid="app-shell">
      <ConnectionStatusBanner
        connected={props.connected}
        failed={props.connectionFailed}
        accountBusy={accountBusy}
        onRetry={props.onRetryConnection}
      />
      {resourceBar}
      <div className="app-content" data-testid={`screen-${props.activeTab}`}>
        {loadoutSaved && (
          <output className="loadout-saved-toast" role="status">
            출전 편성을 저장했습니다.
          </output>
        )}
        {(props.accountStage === 'RETRYABLE_ERROR' || props.accountStage === 'FATAL_ERROR') && (
          <div className="account-error" role="alert">
            <p>
              {props.accountStage === 'FATAL_ERROR'
                ? '계정 설정을 확인해 주세요.'
                : '계정 기록을 불러오지 못했습니다.'}
            </p>
            {props.accountError && props.accountStage !== 'FATAL_ERROR' && (
              <button onClick={props.onRetryAccount}>다시 시도</button>
            )}
          </div>
        )}
        {accountRoute && (
          <AccountScreen
            auth={props.auth}
            displayName={props.name}
            blocked={Boolean(props.queuedAt)}
            onBack={closeAccount}
            onLink={props.onLinkEmail}
            onCheck={props.onCheckLink}
            onSignOut={props.onSignOut}
          />
        )}
        {!accountRoute && props.activeTab === 'mercenaries' && (
          <MercenaryCollectionScreen
            account={props.account}
            detailId={detailId}
            onOpenDetail={(id) =>
              props.onNavigatePath(mercenaryDetailPath(id), {
                state: { modalFrom: '/mercenaries' },
              })
            }
            onCloseDetail={() => exitOverlay('/mercenaries')}
            onOpenLoadout={(focusId) =>
              props.onNavigatePath('/mercenaries/loadout', {
                state: { from: props.currentPath, focusId },
              })
            }
            onInvalidDetail={() => props.onNavigatePath('/mercenaries', { replace: true })}
            onRetry={props.onRetryAccount}
          />
        )}
        {!accountRoute && props.activeTab === 'lobby' && (
          <LobbyScreen
            account={props.account}
            name={props.name}
            ready={matchReady}
            connected={props.connected}
            queuedAt={props.queuedAt}
            muted={props.muted}
            onQueue={props.onQueue}
            onLeaveQueue={props.onLeaveQueue}
            onEdit={() =>
              props.onNavigatePath('/mercenaries/loadout', { state: { from: '/lobby' } })
            }
            onToggleMute={props.onToggleMute}
          />
        )}
      </div>
      <BottomNavigation activePath={props.currentPath} onNavigate={props.onNavigatePath} />
    </main>
  );
}
