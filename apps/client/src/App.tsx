import { useCallback, useEffect, useRef, useState } from 'react';
import type { BattleResult, BattleSnapshot, CombatEvent, FrenzyState, MatchResolution, PendingAttack, SwapRequest, UserAccountState } from '@mercenary/shared';
import { bootstrapAccount, resetAccountBootstrapForRetry, type AccountStage } from './account';
import { Board } from './Board';
import { AppShell } from './AppShell';
import { ActiveSkillControl, ResultSummary } from './BattleUi';
import { CharacterCombatStage, CombatComparisonHud } from './CombatStage';
import { ConnectionStatusBanner } from './LobbyUi';
import { pathForTab, tabForPath, type AppTab } from './app-navigation';
import { appendFeedback, eventToPresentation, pruneFeedback, type BattlePresentationEvent } from './battle-presentation';
import { setMuted, sound } from './audio';
import { connectAuthenticated, socket } from './socket';

export default function App() {
  const [connected, setConnected] = useState(socket.connected), [name, setName] = useState('Guest'), [queuedAt, setQueuedAt] = useState<number | null>(null), [snapshot, setSnapshot] = useState<BattleSnapshot | null>(null);
  const [muted, setMute] = useState(false), [reducedMotion, setReducedMotion] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches), [ping, setPing] = useState(0), [clockOffset, setClockOffset] = useState(0), [resolution, setResolution] = useState<MatchResolution | null>(null);
  const [connectionFailed, setConnectionFailed] = useState(false), [accountStage, setAccountStage] = useState<AccountStage>('INITIALIZING'), [account, setAccount] = useState<UserAccountState | null>(null), [accessToken, setAccessToken] = useState(''), [accountError, setAccountError] = useState('');
  const initialPath = tabForPath(location.pathname) ? (location.pathname === '/' ? '/lobby' : location.pathname) : '/lobby';
  if (location.pathname !== initialPath) history.replaceState(null, '', initialPath);
  const [activeTab, setActiveTab] = useState<AppTab>(() => tabForPath(initialPath) ?? 'lobby'), [currentPath, setCurrentPath] = useState(initialPath);
  const [feedback, setFeedback] = useState<BattlePresentationEvent[]>([]), [activeAbilityId, setActiveAbilityId] = useState(''), [skillPending, setSkillPending] = useState(false), [opponentExit, setOpponentExit] = useState(false), [rematchPending, setRematchPending] = useState(false), [lobbyPending, setLobbyPending] = useState(false);
  const [visualAttacks, setVisualAttacks] = useState<PendingAttack[]>([]);
  const battleId = useRef<string | null>(null), selfId = useRef<string | null>(null), snapshotRef = useRef<BattleSnapshot | null>(null), attacks = useRef(new Map<string, PendingAttack>()), connectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null), abilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null), gaugeAtRequest = useRef(0);
  const currentPathRef = useRef(initialPath), currentHistoryStateRef = useRef(history.state), navigationBlocker = useRef<((targetPath: string) => boolean) | null>(null);
  const registerNavigationBlocker = useCallback((blocker: ((targetPath: string) => boolean) | null) => { navigationBlocker.current = blocker }, []);
  const navigatePath = useCallback((path: string, options?: { replace?: boolean; state?: object }) => {
    if (snapshotRef.current) { history.replaceState(null, '', '/battle'); return }
    if (navigationBlocker.current?.(path)) return;
    if (options?.replace) history.replaceState(options.state ?? null, '', path);
    else if (location.pathname !== path || options?.state) history.pushState(options?.state ?? null, '', path);
    currentHistoryStateRef.current = options?.state ?? null;
    currentPathRef.current = path; setCurrentPath(path); setActiveTab(tabForPath(path) ?? 'lobby');
  }, []);

  useEffect(() => {
    let active = true, unsubscribe = () => {};
    const start = async () => { setAccountStage('CHECKING_SESSION'); setAccountError(''); try { const result = await bootstrapAccount((token) => { if (!active) return; if (token) { setAccessToken(token); connectAuthenticated(token) } else { setAccessToken(''); setAccount(null); setAccountStage('RETRYABLE_ERROR'); socket.disconnect() } }); if (!active) { result.unsubscribe(); return } unsubscribe = result.unsubscribe; setAccessToken(result.accessToken); setAccount(result.account); setName(result.account.profile.displayName); setAccountStage('READY'); connectAuthenticated(result.accessToken) } catch (error) { if (!active) return; setAccountStage(error instanceof Error && error.message.includes('VITE_SUPABASE') ? 'FATAL_ERROR' : 'RETRYABLE_ERROR'); setAccountError(error instanceof Error ? error.message : 'ACCOUNT_ERROR') } };
    void start(); return () => { active = false; unsubscribe() };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (snapshotRef.current) { history.replaceState(null, '', '/battle'); return }
      if (navigationBlocker.current?.(location.pathname)) { history.pushState(currentHistoryStateRef.current, '', currentPathRef.current); return }
      const tab = tabForPath(location.pathname);
      if (!tab) { history.replaceState(null, '', '/lobby'); currentPathRef.current = '/lobby'; setCurrentPath('/lobby'); setActiveTab('lobby'); return }
      currentPathRef.current = location.pathname; currentHistoryStateRef.current = history.state; setCurrentPath(location.pathname); setActiveTab(tab);
    };
    addEventListener('popstate', onPopState);
    return () => removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const scheduleWarning = () => { if (connectionTimer.current) clearTimeout(connectionTimer.current); connectionTimer.current = setTimeout(() => setConnectionFailed(true), 8_000) };
    const onConnect = () => { if (connectionTimer.current) clearTimeout(connectionTimer.current); setConnectionFailed(false); setConnected(true) };
    const onDisconnect = () => { setConnected(false); scheduleWarning() };
    const onConnectError = () => { setConnected(false); scheduleWarning() };
    if (!socket.connected) scheduleWarning();
    const onSession = (data: { sessionToken: string; name: string }) => { sessionStorage.setItem('mercenary-session', data.sessionToken); setName(data.name) };
    const onQueue = (data: { queued: boolean; joinedAt?: number }) => setQueuedAt(data.queued ? data.joinedAt ?? Date.now() : null);
    const onSnapshot = (data: BattleSnapshot) => { if (battleId.current !== data.battleId) { battleId.current = data.battleId; attacks.current.clear(); setFeedback([]); setVisualAttacks(data.pendingAttacks); setResolution(null); setOpponentExit(false); setRematchPending(false); setLobbyPending(false) } selfId.current = data.selfId; snapshotRef.current = data; if (location.pathname !== '/battle') history.pushState(null, '', '/battle'); currentPathRef.current = '/battle'; currentHistoryStateRef.current = null; setCurrentPath('/battle'); setSnapshot(data); if (skillPending && (data.self.gauge < gaugeAtRequest.current || data.phase !== 'PLAYING')) setSkillPending(false) };
    const onEvent = (event: CombatEvent) => {
      const current = snapshotRef.current;
      if (event.type === 'ATTACK_QUEUED') { attacks.current.set(event.attack.id, event.attack); setVisualAttacks((value) => [...value.filter((attack) => attack.id !== event.attack.id), event.attack]); sound('attack') }
      else if (event.type === 'SHIELD_GAINED') sound('shield'); else if (event.type === 'HEALED') sound('heal'); else if (event.type === 'ATTACK_RESOLVED' && event.shieldBroken) sound('break');
      if (current) { const item = eventToPresentation(event, current, attacks.current); if (item) setFeedback((value) => appendFeedback(value, item)); }
      if (event.type === 'ATTACK_RESOLVED') { attacks.current.delete(event.attackId); setVisualAttacks((value) => value.filter((attack) => attack.id !== event.attackId)) }
      if (event.type === 'ABILITY_TRIGGERED') { setActiveAbilityId(event.abilityId); if (event.participantId === selfId.current && event.kind === 'active') setSkillPending(false); if (abilityTimer.current) clearTimeout(abilityTimer.current); abilityTimer.current = setTimeout(() => setActiveAbilityId(''), reducedMotion ? 550 : 850) }
    };
    const onEnd = (result: BattleResult) => { setFeedback([]); setSkillPending(false); sound(result.winnerId === null ? 'match' : result.winnerId === selfId.current ? 'win' : 'lose') };
    const onFrenzy = (_state: FrenzyState) => setFeedback((value) => appendFeedback(value, { id: `frenzy:${Date.now()}`, category: 'frenzy', owner: 'common', sourceName: '', label: '격전 돌입', icon: '⚔', priority: 100, createdAt: Date.now(), durationMs: reducedMotion ? 900 : 1_250 }));
    const onLobbyAccepted = () => { battleId.current = null; selfId.current = null; snapshotRef.current = null; attacks.current.clear(); setSnapshot(null); setResolution(null); setQueuedAt(null); setOpponentExit(false); setFeedback([]); setVisualAttacks([]); setLobbyPending(false); setRematchPending(false); setActiveTab('lobby'); currentPathRef.current = '/lobby'; currentHistoryStateRef.current = null; setCurrentPath('/lobby'); history.replaceState(null, '', '/lobby') };
    const onOpponentExit = () => { setOpponentExit(true); setRematchPending(false) };
    const onError = () => { setSkillPending(false); setLobbyPending(false); setRematchPending(false) };
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('connect_error', onConnectError); socket.on('session', onSession); socket.on('queueStatus', onQueue); socket.on('stateSnapshot', onSnapshot); socket.on('boardResolved', setResolution); socket.on('combatEvent', onEvent); socket.on('frenzyStarted', onFrenzy); socket.on('battleEnded', onEnd); socket.on('returnToLobbyAccepted', onLobbyAccepted); socket.on('opponentReturnedToLobby', onOpponentExit); socket.on('errorMessage', onError);
    const pingTimer = setInterval(() => { const sent = Date.now(); socket.emit('pingRequest', sent, (serverNow) => { const received = Date.now(); setPing(received - sent); setClockOffset(serverNow - (sent + received) / 2) }) }, 2_000);
    const feedbackTimer = setInterval(() => setFeedback((value) => pruneFeedback(value)), 300);
    return () => { clearInterval(pingTimer); clearInterval(feedbackTimer); if (connectionTimer.current) clearTimeout(connectionTimer.current); if (abilityTimer.current) clearTimeout(abilityTimer.current); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('connect_error', onConnectError); socket.off('session', onSession); socket.off('queueStatus', onQueue); socket.off('stateSnapshot', onSnapshot); socket.off('boardResolved', setResolution); socket.off('combatEvent', onEvent); socket.off('frenzyStarted', onFrenzy); socket.off('battleEnded', onEnd); socket.off('returnToLobbyAccepted', onLobbyAccepted); socket.off('opponentReturnedToLobby', onOpponentExit); socket.off('errorMessage', onError) };
  }, [reducedMotion, skillPending]);

  const toggleMute = () => { setMute((value) => { setMuted(!value); return !value }) };
  const reconnect = () => { setConnectionFailed(false); connectAuthenticated(accessToken) };
  const navigateTab = (tab: AppTab) => navigatePath(pathForTab(tab));
  if (!snapshot) return <AppShell activeTab={activeTab} currentPath={currentPath} account={account} accountStage={accountStage} accountError={accountError} accessToken={accessToken} connected={connected} connectionFailed={connectionFailed} name={name} queuedAt={queuedAt} muted={muted} onNavigate={navigateTab} onNavigatePath={navigatePath} registerNavigationBlocker={registerNavigationBlocker} onRetryConnection={reconnect} onRetryAccount={() => { resetAccountBootstrapForRetry(); location.reload() }} onQueue={(immediateBot) => socket.emit('queueJoin', immediateBot ? { immediateBot: true } : {})} onLeaveQueue={() => socket.emit('queueLeave')} onToggleMute={toggleMute} onAccountSaved={setAccount}/>;

  const useSkill = () => { if (skillPending) return; gaugeAtRequest.current = snapshot.self.gauge; setSkillPending(true); socket.emit('useSkillRequest', { requestId: crypto.randomUUID() }); setTimeout(() => setSkillPending(false), 3_000) };
  return <main className="shell battle-screen"><ConnectionStatusBanner connected={connected} failed={connectionFailed} accountBusy={false} onRetry={reconnect}/><CombatComparisonHud snapshot={snapshot} clockOffset={clockOffset} activeAbilityId={activeAbilityId}/><CharacterCombatStage snapshot={snapshot} events={feedback} attacks={visualAttacks} activeAbilityId={activeAbilityId} clockOffset={clockOffset} reducedMotion={reducedMotion}/><section className="board-wrap" aria-label="7×7 전투 보드"><Board key={snapshot.battleId} board={snapshot.board} resolution={resolution} reducedMotion={reducedMotion} active={snapshot.phase === 'PLAYING' && connected} onSwap={(request: SwapRequest) => socket.emit('swapRequest', request)}/>{snapshot.phase === 'COUNTDOWN' && <div className="overlay">전투 준비</div>}</section><ActiveSkillControl snapshot={snapshot} connected={connected} pending={skillPending} onUse={useSkill}/><nav className="battle-utilities" aria-label="보조 설정"><button onClick={() => socket.emit('forfeitRequest')}>기권</button><button onClick={toggleMute}>음소거 {muted ? 'OFF' : 'ON'}</button><label><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)}/>연출 감소</label></nav>{snapshot.phase === 'FINISHED' && snapshot.result && <ResultSummary snapshot={snapshot} opponentExit={opponentExit} rematchPending={rematchPending || snapshot.rematchReady.includes(snapshot.selfId)} lobbyPending={lobbyPending} onRematch={() => { if (!rematchPending) { setRematchPending(true); socket.emit('rematchRequest') } }} onLobby={() => { if (!lobbyPending) { setLobbyPending(true); socket.emit('returnToLobbyRequest') } }}/>} {import.meta.env.DEV && <details className="debug"><summary>DEV</summary><code data-testid="debug-stats">{snapshot.battleId}<br/>socket {connected ? 'on' : 'off'} · ping {ping}ms · offset {Math.round(clockOffset)}ms<br/>HP {snapshot.self.hp}/{snapshot.opponent.hp} SH {snapshot.self.shield}/{snapshot.opponent.shield}<br/>gauge {snapshot.self.gauge} · board v{snapshot.board.version}<br/>frenzy {String(snapshot.frenzy.isFrenzy)} · ATK {snapshot.frenzy.attackMultiplier} SH {snapshot.frenzy.shieldMultiplier} HP {snapshot.frenzy.healMultiplier}<br/>generated {snapshot.stats[snapshot.selfId]?.totalDamageGenerated}/{snapshot.stats[snapshot.opponent.id]?.totalDamageGenerated} hpDamage {snapshot.stats[snapshot.selfId]?.hpDamageDealt}/{snapshot.stats[snapshot.opponent.id]?.hpDamageDealt}</code><div><button onClick={() => socket.emit('debugCommand', { action: 'deterministicBoard' })}>Test board</button><button data-testid="debug-sword" onClick={() => socket.emit('debugCommand', { action: 'swordMove' })}>Sword move</button><button data-testid="debug-shield" onClick={() => socket.emit('debugCommand', { action: 'shieldMove' })}>Shield move</button><button data-testid="debug-heal" onClick={() => socket.emit('debugCommand', { action: 'healMove' })}>Heal move</button><button data-testid="debug-mana" onClick={() => socket.emit('debugCommand', { action: 'manaMove' })}>Mana move</button><button data-testid="debug-time35" onClick={() => socket.emit('debugCommand', { action: 'time35' })}>35s</button><button data-testid="debug-time5" onClick={() => socket.emit('debugCommand', { action: 'time5' })}>5s</button><button data-testid="debug-win" onClick={() => socket.emit('debugCommand', { action: 'win' })}>Win</button><button onClick={() => socket.emit('debugCommand', { action: 'lose' })}>Lose</button></div></details>}</main>;
}
