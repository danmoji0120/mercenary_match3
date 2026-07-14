import { useEffect, useState } from 'react';
import type { UserAccountState } from '@mercenary/shared';
import { LobbyLoadout, accountLoadoutSnapshot } from './LobbyUi';
import { CharacterPortrait } from './CharacterPortrait';
import { GamePanel, ScreenHeader } from './GameUi';

function QueueTimer({ since }: { since: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(Math.floor((Date.now() - since) / 1_000));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [since]);
  return (
    <div className="queue-time" aria-live="polite">
      대기 중 {seconds}초
    </div>
  );
}

function LobbyCharacterDisplay({ account }: { account: UserAccountState }) {
  const loadout = accountLoadoutSnapshot(account);
  return (
    <section className="lobby-character-display lobby-visual-slot" aria-label="현재 출전 용병">
      <div className="lobby-glow" aria-hidden="true" />
      <figure className="lobby-lead">
        <CharacterPortrait src={loadout.combatant.portraitAsset} alt="" />
        <figcaption>
          <small>전투원</small>
          <strong>{loadout.combatant.name}</strong>
          <span>{loadout.combatant.rarity}</span>
        </figcaption>
      </figure>
      {loadout.supports.map((support, index) => (
        <figure className={`lobby-support support-${index + 1}`} key={support.characterId}>
          <CharacterPortrait src={support.portraitAsset} alt="" />
          <figcaption>
            <small>지원 {index + 1}</small>
            <strong>{support.name}</strong>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

export function LobbyScreen({
  account,
  name,
  ready,
  connected,
  queuedAt,
  muted,
  onQueue,
  onLeaveQueue,
  onEdit,
  onToggleMute,
}: {
  account: UserAccountState | null;
  name: string;
  ready: boolean;
  connected: boolean;
  queuedAt: number | null;
  muted: boolean;
  onQueue(immediateBot: boolean): void;
  onLeaveQueue(): void;
  onEdit(): void;
  onToggleMute(): void;
}) {
  const disabledReason = !connected ? '서버 재연결 중' : !ready ? '계정 준비 중' : '';
  return (
    <section className="app-screen home-screen" aria-labelledby="lobby-title">
      <ScreenHeader
        eyebrow="MERCENARY COMPANY"
        title={name}
        description="현재 편성을 확인하고 전장에 진입하세요."
      />
      {account ? (
        <LobbyCharacterDisplay account={account} />
      ) : (
        <div className="lobby-character-placeholder" aria-hidden="true">
          용병단 집결 중…
        </div>
      )}
      <GamePanel className="lobby-deployment-panel">
        <div className="lobby-actions home-actions">
          {queuedAt ? (
            <>
              <QueueTimer since={queuedAt} />
              <button onClick={onLeaveQueue}>대기 취소</button>
            </>
          ) : (
            <>
              <button
                data-testid="normal-match"
                disabled={!ready}
                title={disabledReason}
                onClick={() => onQueue(false)}
              >
                일반전<small>실시간 대전</small>
              </button>
              <button
                className="secondary"
                data-testid="bot-match"
                aria-label="봇 대전, 봇과 즉시 대전"
                disabled={!ready}
                title={disabledReason}
                onClick={() => onQueue(true)}
              >
                봇 대전<small>즉시 연습</small>
              </button>
            </>
          )}
        </div>
        <div className="home-secondary-actions">
          <button
            className="secondary edit-loadout"
            data-testid="edit-loadout"
            disabled={!account || Boolean(queuedAt)}
            onClick={onEdit}
          >
            출전 편성 변경
          </button>
          <button
            className="quiet-button"
            onClick={onToggleMute}
            aria-label={`효과음 ${muted ? '켜기' : '끄기'}`}
          >
            효과음 {muted ? 'OFF' : 'ON'}
          </button>
        </div>
      </GamePanel>
      {account && (
        <div className="home-loadout-summary">
          <LobbyLoadout account={account} />
        </div>
      )}
    </section>
  );
}
