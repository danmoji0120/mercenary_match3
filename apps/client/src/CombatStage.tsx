import type { CSSProperties } from 'react';
import type { BattleSnapshot, PendingAttack, PublicParticipant } from '@mercenary/shared';
import { BattleTimer, CombatFeedbackLayer, ResourceBar, StatusIconList, SupportAbilityIcon } from './BattleUi';
import type { BattlePresentationEvent, FeedbackCategory, FeedbackOwner } from './battle-presentation';
import { CharacterPortrait } from './CharacterPortrait';

type Side = 'self' | 'opponent';

function CombatantSummary({ participant, selfId, side, activeAbilityId }: { participant: PublicParticipant; selfId: string; side: Side; activeAbilityId: string }) {
  const main = participant.loadout.combatant;
  const runtime = participant.effectRuntime;
  const sideLabel = side === 'self' ? '나' : '상대';
  return <section className={`combat-summary ${side}`} aria-label={`${participant.name} 전투 정보`}>
    <header><span>{side === 'self' ? 'MY PARTY' : 'ENEMY'}</span><strong>{main.name}</strong><small>{participant.name}</small></header>
    <div className="combat-summary-hp"><b data-testid={`${side}-hp`}>HP {participant.hp}</b><span>/ {participant.maxHp}</span>{participant.hp <= participant.maxHp * .25 && <em>위험</em>}</div>
    <ResourceBar value={participant.hp} max={participant.maxHp} kind="hp" label={`${sideLabel} HP`}/>
    <div className={`combat-summary-shield ${participant.shield <= 0 ? 'empty' : ''}`} data-testid={participant.shield > 0 ? `${side}-shield` : undefined}>
      <span>◇ {participant.shield}</span><ResourceBar value={participant.shield} max={500} kind="shield" label={`${sideLabel} 보호막`}/>
    </div>
    <div className="combat-summary-effects">
      <div className="support-icons" data-testid={`${side}-supports`}>{participant.loadout.supports.map((support, index) => <SupportAbilityIcon key={support.characterId} portrait={support.portraitAsset} name={runtime?.supportAbilities[index]?.name ?? support.name} runtime={runtime?.abilities[index + 1]} cooldownMs={runtime?.supportAbilities[index]?.cooldownMs ?? 0} active={activeAbilityId === runtime?.supportAbilities[index]?.id}/>)}</div>
      <StatusIconList runtime={runtime} selfId={selfId}/>
    </div>
  </section>;
}

export function CombatComparisonHud({ snapshot, clockOffset, activeAbilityId }: { snapshot: BattleSnapshot; clockOffset: number; activeAbilityId: string }) {
  return <section className="comparison-hud" aria-label="양측 전투 정보 비교">
    <CombatantSummary participant={snapshot.self} selfId={snapshot.selfId} side="self" activeAbilityId={activeAbilityId}/>
    <div className="comparison-center"><BattleTimer snapshot={snapshot} clockOffset={clockOffset}/><span>VS</span></div>
    <CombatantSummary participant={snapshot.opponent} selfId={snapshot.selfId} side="opponent" activeAbilityId={activeAbilityId}/>
  </section>;
}

function latestEvent(events: BattlePresentationEvent[], owner: FeedbackOwner) {
  return events.filter((event) => event.owner === owner).sort((a, b) => b.createdAt - a.createdAt)[0];
}

function reactionClass(category?: FeedbackCategory) {
  if (!category) return '';
  if (category === 'attack_queued') return 'is-attacking';
  if (category === 'damage' || category === 'direct_hp_damage' || category === 'shield_damage' || category === 'shield_broken') return 'is-hit';
  if (category === 'heal') return 'is-healed';
  if (category === 'shield_gain') return 'is-guarding';
  if (category === 'support_trigger' || category === 'status_applied') return 'is-casting';
  return '';
}

function CharacterFighter({ participant, side, event, activeAbilityId }: { participant: PublicParticipant; side: Side; event?: BattlePresentationEvent; activeAbilityId: string }) {
  const main = participant.loadout.combatant;
  const active = participant.effectRuntime?.abilities.some((ability) => ability.abilityId === activeAbilityId);
  return <figure key={`${side}:${event?.id ?? 'idle'}:${activeAbilityId}`} className={`stage-fighter ${side} ${reactionClass(event?.category)} ${active ? 'is-casting' : ''}`}>
    <div className="fighter-aura" aria-hidden="true"/>
    <CharacterPortrait src={main.portraitAsset} alt={`${main.name} 전투 캐릭터`} eager variant="combat" characterId={main.characterId} shortName={main.name} rarity={main.rarity}/>
    <figcaption><strong>{main.name}</strong><span>{participant.hp <= 250 ? '위기' : participant.shield > 0 ? `보호막 ${participant.shield}` : '전투 중'}</span></figcaption>
  </figure>;
}

function AttackProjectile({ attack, selfId, clockOffset }: { attack: PendingAttack; selfId: string; clockOffset: number }) {
  const duration = Math.max(1, attack.arrivesAt - attack.createdAt);
  const elapsed = Math.max(0, Date.now() + clockOffset - attack.createdAt);
  const style = { '--travel-duration': `${duration}ms`, '--travel-delay': `${-elapsed}ms` } as CSSProperties;
  return <i className={`attack-projectile ${attack.kind.toLowerCase()} ${attack.sourceId === selfId ? 'outgoing' : 'incoming'}`} style={style} aria-hidden="true"><span>{attack.kind === 'SKILL' ? '✦' : '⚔'}</span></i>;
}

function AttackLane({ attacks, selfId, clockOffset }: { attacks: PendingAttack[]; selfId: string; clockOffset: number }) {
  const incoming = attacks.filter((attack) => attack.targetId === selfId);
  return <div className="attack-lane" data-testid="attack-warning" aria-label="접근 중인 공격">
    <span className="sr-only">{incoming.map((attack) => `${attack.kind} ${attack.damage}`).join(', ')}</span>
    {attacks.slice(0, 4).map((attack) => <AttackProjectile key={attack.id} attack={attack} selfId={selfId} clockOffset={clockOffset}/>)}
    {incoming.length > 0 && <div className="incoming-readout"><span>접근 중</span><b>{incoming[0]!.damage}</b>{incoming.length > 1 && <small>+{incoming.length - 1}</small>}</div>}
  </div>;
}

export function CharacterCombatStage({ snapshot, events, attacks, activeAbilityId, clockOffset, reducedMotion }: { snapshot: BattleSnapshot; events: BattlePresentationEvent[]; attacks: PendingAttack[]; activeAbilityId: string; clockOffset: number; reducedMotion: boolean }) {
  return <section className={`character-stage ${reducedMotion ? 'reduced-motion' : ''}`} data-testid="combat-stage" aria-label="캐릭터 전투 무대">
    <div className="stage-backdrop" aria-hidden="true"><i/><i/><i/></div>
    <CharacterFighter participant={snapshot.self} side="self" event={latestEvent(events, 'self')} activeAbilityId={activeAbilityId}/>
    <div className="stage-center" aria-hidden="true"><span>VS</span><i/></div>
    <CharacterFighter participant={snapshot.opponent} side="opponent" event={latestEvent(events, 'opponent')} activeAbilityId={activeAbilityId}/>
    <AttackLane attacks={attacks} selfId={snapshot.selfId} clockOffset={clockOffset}/>
    <CombatFeedbackLayer events={events}/>
  </section>;
}
