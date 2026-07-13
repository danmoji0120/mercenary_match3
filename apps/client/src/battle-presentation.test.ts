import { describe, expect, it } from 'vitest';
import type { BattleSnapshot, PendingAttack } from '@mercenary/shared';
import { appendFeedback, eventToPresentation, pruneFeedback, type BattlePresentationEvent } from './battle-presentation';

const snapshot = { selfId: 'self', self: { id: 'self', effectRuntime: { statuses: [{ id: 'guard', name: '철벽 태세' }] } }, opponent: { id: 'enemy', effectRuntime: { statuses: [] } } } as unknown as BattleSnapshot;
const attack: PendingAttack = { id: 'attack-1', sourceId: 'enemy', targetId: 'self', damage: 120, kind: 'SWORD', createdAt: 10, arrivesAt: 20 };

describe('battle presentation model', () => {
  it('maps server events to short owner-aware feedback without internal ids', () => {
    const attacks = new Map([[attack.id, attack]]);
    const queued = eventToPresentation({ type: 'ATTACK_QUEUED', at: 10, attack }, snapshot, attacks)!;
    const damage = eventToPresentation({ type: 'ATTACK_RESOLVED', at: 30, attackId: attack.id, absorbed: 0, hpDamage: 120, shieldBroken: false }, snapshot, attacks)!;
    const status = eventToPresentation({ type: 'STATUS_CHANGED', at: 31, participantId: 'self', statusId: 'guard', active: true }, snapshot, attacks)!;
    expect(queued).toMatchObject({ owner: 'opponent', category: 'attack_queued', amount: 120 });
    expect(damage).toMatchObject({ owner: 'self', category: 'damage', amount: -120 });
    expect(status.label).toBe('철벽 태세');
    expect(JSON.stringify([damage, status])).not.toContain('guard');
  });

  it('deduplicates event ids, combines bursts, and caps each side at three', () => {
    const make = (id: string, priority: number, amount = 1): BattlePresentationEvent => ({ id, owner: 'self', category: 'heal', sourceName: '', label: '회복', amount, icon: '+', priority, createdAt: 1_000, durationMs: 2_000 });
    let events: BattlePresentationEvent[] = [];
    events = appendFeedback(events, make('a', 1), 1_000);
    events = appendFeedback(events, make('a', 1), 1_000);
    expect(events).toHaveLength(1);
    events = appendFeedback(events, { ...make('b', 2), category: 'shield_gain' }, 1_300);
    events = appendFeedback(events, { ...make('c', 3), category: 'damage' }, 1_300);
    events = appendFeedback(events, { ...make('d', 4), category: 'mana_gain' }, 1_300);
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.id)).toContain('d');
  });

  it('removes expired feedback at battle boundaries', () => {
    const event: BattlePresentationEvent = { id: 'old', owner: 'common', category: 'frenzy', sourceName: '', label: '격전', icon: '*', priority: 1, createdAt: 100, durationMs: 500 };
    expect(pruneFeedback([event], 601)).toEqual([]);
  });
});
