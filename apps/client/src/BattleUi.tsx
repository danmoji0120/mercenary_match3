import { useEffect, useMemo, useState } from 'react';
import type { AbilityRuntimeSnapshot, BattleLoadoutSnapshot, BattleResult, BattleSnapshot, BattleStats, EffectRuntimeSnapshot, PublicParticipant, StatusSnapshot } from '@mercenary/shared';
import type { BattlePresentationEvent, FeedbackOwner } from './battle-presentation';

export function ResourceBar({ value, max, kind, label }: { value: number; max: number; kind: 'hp' | 'shield' | 'mana'; label: string }) {
  const percent = Math.max(0, Math.min(100, value / max * 100));
  return <div className={`resource ${kind}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} / ${max}`}><i style={{ width: `${percent}%` }} /></div>;
}

function useClock(interval: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(timer) }, [interval]);
  return now;
}

export function SupportAbilityIcon({ portrait, name, runtime, cooldownMs, active }: { portrait: string; name: string; runtime?: AbilityRuntimeSnapshot; cooldownMs: number; active: boolean }) {
  const now = useClock(1_000), remaining = Math.max(0, Math.ceil(((runtime?.cooldownEndsAt ?? 0) - now) / 1_000));
  const completed = Boolean(runtime?.usedThisBattle && cooldownMs === 0);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }; addEventListener('keydown', close); return () => removeEventListener('keydown', close) }, [open]);
  return <span className="support-anchor"><button type="button" className={`support-icon ${active ? 'triggered' : ''} ${completed ? 'completed' : ''}`} aria-label={`${name}${remaining ? `, ${remaining}초 쿨다운` : completed ? ', 사용 완료' : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}><img src={portrait} alt=""/>{remaining > 0 && <b>{remaining}</b>}{completed && <b aria-hidden="true">✓</b>}</button>{open && <span className="icon-popover" role="tooltip"><strong>{name}</strong>{remaining > 0 ? `${remaining}초 후 준비` : completed ? '이 전투에서 사용 완료' : '발동 준비'}</span>}</span>;
}

function StatusIcon({ status, selfId }: { status: StatusSnapshot; selfId: string }) {
  const now = useClock(1_000), seconds = Math.max(0, Math.ceil((status.expiresAt - now) / 1_000));
  const positive = status.sourceParticipantId === status.targetParticipantId, [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }; addEventListener('keydown', close); return () => removeEventListener('keydown', close) }, [open]);
  const owner = status.targetParticipantId === selfId ? '나' : '상대';
  return <span className="status-anchor"><button className={`status-icon ${positive ? 'positive' : 'negative'}`} aria-label={`${owner} ${status.name}, ${positive ? '이로운' : '해로운'} 상태, ${seconds}초`} aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">{positive ? '▲' : '▼'}</span><b>{seconds}</b>{status.stackCount > 1 && <em>×{status.stackCount}</em>}</button>{open && <span className="icon-popover" role="tooltip"><strong>{status.name}</strong>{seconds}초 남음{status.stackCount > 1 ? ` · ${status.stackCount}중첩` : ''}</span>}</span>;
}

export function StatusIconList({ runtime, selfId }: { runtime?: EffectRuntimeSnapshot; selfId: string }) {
  const statuses = runtime?.statuses.filter((item) => item.visible) ?? [];
  return <div className="status-icons" aria-label="활성 상태 효과">{statuses.slice(0, 5).map((status) => <StatusIcon key={status.id} status={status} selfId={selfId}/>)}</div>;
}

export function CombatantHeader({ participant, selfId, side, activeAbilityId }: { participant: PublicParticipant; selfId: string; side: 'self' | 'opponent'; activeAbilityId: string }) {
  const main = participant.loadout.combatant, runtime = participant.effectRuntime;
  return <section className={`combatant-header ${side}`} aria-label={`${participant.name} 전투 정보`}>
    <img className="combatant-portrait" src={main.portraitAsset} alt={`${main.name} 초상화`}/>
    <div className="combatant-main"><div className="combatant-title"><strong>{main.name}</strong><span>{main.rarity}</span><small>{participant.name}</small></div><div className="hp-line"><b data-testid={`${side}-hp`}>HP {participant.hp} / 1000</b>{participant.hp <= 250 && <em>위험</em>}</div><ResourceBar value={participant.hp} max={1000} kind="hp" label={`${side === 'self' ? '내' : '상대'} HP`}/>{participant.shield > 0 && <div className="shield-line" data-testid={`${side}-shield`}><span>◇ {participant.shield}</span><ResourceBar value={participant.shield} max={500} kind="shield" label={`${side === 'self' ? '내' : '상대'} 보호막`}/></div>}</div>
    <div className="combatant-effects"><div className="support-icons" data-testid={`${side}-supports`}>{participant.loadout.supports.map((support, index) => <SupportAbilityIcon key={support.characterId} portrait={support.portraitAsset} name={runtime?.supportAbilities[index]?.name ?? support.name} runtime={runtime?.abilities[index + 1]} cooldownMs={runtime?.supportAbilities[index]?.cooldownMs ?? 0} active={activeAbilityId === runtime?.supportAbilities[index]?.id}/>)}</div><StatusIconList runtime={runtime} selfId={selfId}/></div>
  </section>;
}

export function BattleTimer({ snapshot, clockOffset }: { snapshot: BattleSnapshot; clockOffset: number }) {
  const now = useClock(200), countdown = Math.max(0, Math.ceil((snapshot.startsAt - now - clockOffset) / 1_000)), remaining = Math.max(0, Math.ceil((snapshot.endsAt - now - clockOffset) / 1_000));
  return <div className="battle-timer" aria-live="polite"><strong data-testid="battle-timer">{snapshot.phase === 'COUNTDOWN' ? countdown : remaining}<small>s</small></strong>{snapshot.frenzy.isFrenzy && <span data-testid="frenzy-badge">⚔ 격전</span>}</div>;
}

export function CombatFeedbackLayer({ events }: { events: BattlePresentationEvent[] }) {
  const render = (owner: FeedbackOwner) => <div className={`feedback-stack ${owner}`} data-testid={`feedback-${owner}`} aria-live="polite">{events.filter((event) => event.owner === owner).map((event) => <output key={event.id} className={`feedback ${event.category}`}><span aria-hidden="true">{event.icon}</span><b>{event.label}</b>{typeof event.amount === 'number' && <strong>{event.amount > 0 ? '+' : ''}{event.amount}</strong>}</output>)}</div>;
  return <div className="feedback-layer">{render('opponent')}{render('common')}{render('self')}</div>;
}

export function ActiveSkillControl({ snapshot, connected, pending, onUse }: { snapshot: BattleSnapshot; connected: boolean; pending: boolean; onUse(): void }) {
  const ability = snapshot.self.effectRuntime?.activeAbility, cost = ability?.cost ?? 100;
  const reason = !connected ? '연결 끊김' : snapshot.phase === 'FINISHED' ? '경기 종료' : snapshot.phase !== 'PLAYING' ? '준비 중' : pending ? '요청 중' : snapshot.self.gauge < cost ? `마력 ${snapshot.self.gauge}/${cost}` : '사용 가능';
  const disabled = !connected || snapshot.phase !== 'PLAYING' || pending || snapshot.self.gauge < cost;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }; addEventListener('keydown', close); return () => removeEventListener('keydown', close) }, [open]);
  return <section className="skill-control"><div className="mana-readout"><span>◆ 마력</span><b>{snapshot.self.gauge} / 100</b><ResourceBar value={snapshot.self.gauge} max={100} kind="mana" label="내 마력"/></div><button data-testid="skill" className={disabled ? '' : 'ready'} disabled={disabled} aria-label={`${ability?.name ?? '액티브 스킬'}, ${reason}`} onClick={onUse}><strong>{pending ? '요청 중...' : ability?.name ?? '액티브 스킬'}</strong><span>{reason}</span></button><button className="skill-info" aria-label="스킬 정보" aria-expanded={open} onClick={() => setOpen((value) => !value)}>i</button>{open && <div className="skill-popover" role="dialog" aria-label="스킬 정보"><strong>{ability?.name}</strong><p>{ability?.shortDescription}</p><small>마력 {cost}</small></div>}</section>;
}

type NumericBattleStatKey = { [Key in keyof BattleStats]: BattleStats[Key] extends number ? Key : never }[keyof BattleStats];
const detailRows: Array<[string, NumericBattleStatKey]> = [['가한 총 피해', 'totalDamageGenerated'], ['HP 피해', 'hpDamageDealt'], ['보호막 피해', 'shieldDamageDealt'], ['획득 보호막', 'shieldGained'], ['회복량', 'healingDone'], ['마력 획득', 'manaGained'], ['최대 연쇄', 'maxChain'], ['보호막 파괴', 'shieldBreakCount'], ['완전 방어', 'attacksFullyBlocked'], ['보호막 무시', 'directHpDamageBypass'], ['회복 차단', 'healingPrevented'], ['피해 감소', 'damageReduced']];
function StatsRows({ rows, self, opponent }: { rows: Array<[string, NumericBattleStatKey]>; self: BattleStats; opponent: BattleStats }) { return <div className="stats-grid">{rows.map(([label, key]) => <div className="stats-row" data-stat={key} key={key}><span>{label}</span><b data-side="self">{self[key]}</b><b data-side="opponent">{opponent[key]}</b></div>)}</div> }
function reasonLabel(reason: BattleResult['reason']) { return reason === 'HP_ZERO' ? 'HP 0' : reason === 'TIMEOUT' ? '시간 종료' : reason === 'FORFEIT' ? '기권' : reason === 'DISCONNECT' ? '연결 종료' : '서버 종료' }

export function ResultSummary({ snapshot, opponentExit, rematchPending, lobbyPending, onRematch, onLobby }: { snapshot: BattleSnapshot; opponentExit: boolean; rematchPending: boolean; lobbyPending: boolean; onRematch(): void; onLobby(): void }) {
  const result = snapshot.result!, self = result.stats[snapshot.selfId]!, opponent = result.stats[snapshot.opponent.id]!;
  const title = result.winnerId === null ? '무승부' : result.winnerId === snapshot.selfId ? '승리' : '패배';
  const supportTriggers = Object.values(self.supportEffectTriggersById).reduce((sum, value) => sum + value, 0);
  const summary = [['HP 피해', self.hpDamageDealt], ['막은 피해', self.damageBlockedByShield], ['회복', self.healingDone], ['액티브', self.skillUseCount], ['지원 발동', supportTriggers]] as const;
  return <div className="result" data-testid="result"><section className="result-card" role="dialog" aria-modal="true" aria-label="경기 결과"><p className="result-kicker">경기 결과</p><h2>{title}</h2><p data-testid="end-reason">{reasonLabel(result.reason)} · {Math.ceil(result.matchDurationMs / 1_000)}초</p>{opponentExit && <p className="result-notice" data-testid="opponent-left">상대가 로비로 돌아갔습니다.</p>}<div className="result-summary" data-testid="result-stats">{summary.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><div className="result-actions"><button data-testid="rematch" disabled={opponentExit || rematchPending || lobbyPending} onClick={onRematch}>{rematchPending ? '상대 대기 중...' : '재대전'}</button><button className="secondary" data-testid="return-lobby" disabled={lobbyPending} onClick={onLobby}>{lobbyPending ? '로비 복귀 중...' : '로비로 돌아가기'}</button></div><details className="result-details"><summary>상세 통계 펼치기</summary><div className="stats-head"><span>항목</span><b>나</b><b>상대</b></div><StatsRows rows={detailRows} self={self} opponent={opponent}/></details></section></div>;
}

export function LoadoutSummary({ loadout }: { loadout: BattleLoadoutSnapshot }) {
  return <div className="loadout-summary" aria-label="현재 편성">{[loadout.combatant, ...loadout.supports].map((character, index) => <figure key={character.characterId}><img src={character.portraitAsset} alt=""/><figcaption><small>{index === 0 ? '전투원' : `지원 ${index}`}</small><b>{character.name}</b><span>{character.rarity}</span></figcaption></figure>)}</div>;
}

export function abilityRuntimeFor(runtime: EffectRuntimeSnapshot | undefined, index: number) { return runtime?.abilities[index] }
export function activeAbilityNames(runtime: EffectRuntimeSnapshot | undefined) { return useMemo(() => new Map(runtime ? [runtime.activeAbility, ...runtime.supportAbilities].map((ability) => [ability.id, ability.name]) : []), [runtime]) }
