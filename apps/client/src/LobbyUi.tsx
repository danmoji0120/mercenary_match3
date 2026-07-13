import type { BattleLoadoutSnapshot, UserAccountState } from '@mercenary/shared';
import { LoadoutSummary } from './BattleUi';

export function accountLoadoutSnapshot(account: UserAccountState): BattleLoadoutSnapshot {
  const convert = (id: string) => { const item = account.characters.find((character) => character.id === id)!; return { characterId: item.id, name: item.name, portraitAsset: item.portraitAsset, rarity: item.rarity } };
  const combatant = account.characters.find((character) => character.id === account.loadout.combatantCharacterId)!;
  return { schemaVersion: 2, combatant: { ...convert(combatant.id), combatStats: { ...combatant.stats } }, supports: [convert(account.loadout.supportCharacterId1), convert(account.loadout.supportCharacterId2)] };
}

export function ConnectionStatusBanner({ connected, failed, accountBusy, onRetry }: { connected: boolean; failed: boolean; accountBusy: boolean; onRetry(): void }) {
  if (connected && !accountBusy) return null;
  const text = accountBusy ? '계정 세션을 복구하는 중...' : failed ? '연결이 끊겼습니다.' : '재연결 중...';
  return <aside className={`connection-banner ${failed ? 'error' : ''}`} role={failed ? 'alert' : 'status'} data-testid="connection-banner"><span aria-hidden="true">{failed ? '!' : '…'}</span>{text}{failed && <button onClick={onRetry}>재시도</button>}</aside>;
}

export function LobbyLoadout({ account }: { account: UserAccountState }) { return <LoadoutSummary loadout={accountLoadoutSnapshot(account)}/> }
