import type { BattleSnapshot, CombatEvent, PendingAttack } from '@mercenary/shared';

export type FeedbackOwner = 'self' | 'opponent' | 'common';
export type FeedbackCategory = 'attack_queued' | 'damage' | 'direct_hp_damage' | 'shield_damage' | 'shield_gain' | 'heal' | 'mana_gain' | 'support_trigger' | 'status_applied' | 'status_expired' | 'shield_broken' | 'frenzy' | 'message';
export interface BattlePresentationEvent {
  id: string;
  category: FeedbackCategory;
  owner: FeedbackOwner;
  sourceName: string;
  label: string;
  amount?: number;
  icon: string;
  priority: number;
  createdAt: number;
  durationMs: number;
}

function ownerFor(participantId: string, snapshot: BattleSnapshot): FeedbackOwner {
  return participantId === snapshot.selfId ? 'self' : 'opponent';
}

export function eventToPresentation(event: CombatEvent, snapshot: BattleSnapshot, attacks: ReadonlyMap<string, PendingAttack>): BattlePresentationEvent | null {
  const base = { id: `${event.type}:${event.at}:${'attackId' in event ? event.attackId : 'participantId' in event ? event.participantId : ''}`, createdAt: event.at, durationMs: 1_450 };
  if (event.type === 'ATTACK_QUEUED') return { ...base, owner: ownerFor(event.attack.sourceId, snapshot), category: 'attack_queued', sourceName: '', label: event.attack.kind === 'SKILL' ? '스킬 공격' : '공격', amount: event.attack.damage, icon: event.attack.kind === 'SKILL' ? '✦' : '⚔', priority: 60, durationMs: Math.min(1_200, Math.max(650, event.attack.arrivesAt - event.attack.createdAt)) };
  if (event.type === 'ATTACK_RESOLVED') {
    const attack = attacks.get(event.attackId);
    if (!attack) return null;
    const owner = ownerFor(attack.targetId, snapshot);
    if (event.shieldBroken) return { ...base, owner, category: 'shield_broken', sourceName: '', label: '보호막 파괴', icon: '◇', priority: 95 };
    if (event.hpDamage > 0) return { ...base, owner, category: attack.shieldBypassRatio ? 'direct_hp_damage' : 'damage', sourceName: '', label: attack.shieldBypassRatio ? 'HP 직격' : '피해', amount: -event.hpDamage, icon: '♥', priority: 90 };
    if (event.absorbed > 0) return { ...base, owner, category: 'shield_damage', sourceName: '', label: '보호막', amount: -event.absorbed, icon: '◇', priority: 80 };
    return null;
  }
  if (event.type === 'SHIELD_GAINED') return { ...base, owner: ownerFor(event.participantId, snapshot), category: 'shield_gain', sourceName: '', label: '보호막', amount: event.amount, icon: '◇', priority: 72 };
  if (event.type === 'HEALED') return { ...base, owner: ownerFor(event.participantId, snapshot), category: 'heal', sourceName: '', label: '회복', amount: event.amount, icon: '+', priority: 70 };
  if (event.type === 'GAUGE_GAINED') return { ...base, owner: ownerFor(event.participantId, snapshot), category: 'mana_gain', sourceName: '', label: '마력', amount: event.amount, icon: '◆', priority: 35, durationMs: 950 };
  if (event.type === 'ABILITY_TRIGGERED') return { ...base, owner: ownerFor(event.participantId, snapshot), category: 'support_trigger', sourceName: event.abilityName, label: event.abilityName, icon: event.kind === 'active' ? '★' : '✦', priority: event.kind === 'active' ? 92 : 82 };
  if (event.type === 'STATUS_CHANGED') {
    const participant = event.participantId === snapshot.selfId ? snapshot.self : snapshot.opponent;
    const status = participant.effectRuntime?.statuses.find((item) => item.id === event.statusId);
    return { ...base, owner: ownerFor(event.participantId, snapshot), category: event.active ? 'status_applied' : 'status_expired', sourceName: status?.name ?? '', label: status?.name ?? (event.active ? '상태 적용' : '상태 종료'), icon: event.active ? '▲' : '▽', priority: 65 };
  }
  if (event.type === 'BATTLE_MESSAGE') return { ...base, owner: ownerFor(event.participantId, snapshot), category: 'message', sourceName: '', label: event.message.slice(0, 24), icon: '•', priority: 45 };
  return null;
}

export function appendFeedback(events: BattlePresentationEvent[], next: BattlePresentationEvent, now = Date.now()): BattlePresentationEvent[] {
  const alive = events.filter((item) => now - item.createdAt < item.durationMs && item.id !== next.id);
  const same = alive.find((item) => item.owner === next.owner && item.category === next.category && now - item.createdAt < 220 && typeof item.amount === 'number' && typeof next.amount === 'number');
  const combined = same ? [...alive.filter((item) => item !== same), { ...next, id: `${same.id}+${next.id}`, amount: same.amount! + next.amount! }] : [...alive, next];
  const select = (owner: FeedbackOwner, limit: number) => combined.filter((item) => item.owner === owner).sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt).slice(0, limit);
  return [...select('self', 3), ...select('opponent', 3), ...select('common', 1)];
}

export function pruneFeedback(events: BattlePresentationEvent[], now = Date.now()): BattlePresentationEvent[] {
  return events.filter((item) => now - item.createdAt < item.durationMs);
}
