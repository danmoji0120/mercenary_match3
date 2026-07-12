import { afterEach, describe, expect, it } from 'vitest';
import { applyShield, listLegalSwaps } from '@mercenary/shared';
import { Battle, createParticipant } from '../src/battle';

const battles: Battle[] = [];
const make = () => {
  const events: Array<{ id: string; name: string; value: any }> = [];
  const battle = new Battle([createParticipant('a', 'a', 'A', false, 1), createParticipant('b', 'b', 'B', false, 2)], { snapshot: () => undefined, event: (id, name, value) => events.push({ id, name, value }), ended: () => undefined }, Date.now(), 0, 5);
  battle.tick(battle.startsAt); battles.push(battle); return { battle, events };
};
afterEach(() => { for (const battle of battles.splice(0)) if (battle.phase !== 'FINISHED') battle.forfeit('a') });

describe('authoritative battle', () => {
  it('rejects skill without gauge and prevents duplicate activation', () => { const { battle } = make(); expect(battle.useSkill('a', 'same')).toBe(false); battle.player('a')!.gauge = 100; expect(battle.useSkill('a', 'same')).toBe(true); battle.player('a')!.gauge = 100; expect(battle.useSkill('a', 'same')).toBe(false); expect(battle.pendingAttacks).toHaveLength(1) });
  it('lets shield created before arrival absorb queued damage', () => { const { battle } = make(); battle.player('a')!.gauge = 100; battle.useSkill('a', 'skill'); const attack = battle.pendingAttacks[0]!; applyShield(battle.player('b')!, 200); battle.tick(attack.arrivesAt); expect(battle.player('b')!.hp).toBe(1_000); expect(battle.player('b')!.shield).toBe(10) });
  it('does not apply events after finish', () => { const { battle } = make(); battle.player('a')!.gauge = 100; battle.useSkill('a', 'skill'); battle.forfeit('a'); const hp = battle.player('b')!.hp; battle.tick(Date.now() + 10_000); expect(battle.player('b')!.hp).toBe(hp); expect(battle.pendingAttacks).toHaveLength(0) });
  it('updates the actual board for a valid swap', () => { const { battle } = make(); const player = battle.player('a')!, move = listLegalSwaps(player.board.tiles)[0]!; const version = player.board.version; const result = battle.swap('a', { from: move[0], to: move[1], requestId: 'move' }); expect(result).not.toBeNull(); expect(player.board.version).toBe(version + 1); expect(player.board.processing).toBe(false) });
  it('ends immediately on lethal attack', () => { const { battle } = make(); battle.player('b')!.hp = 100; battle.player('a')!.gauge = 100; battle.useSkill('a', 'kill'); const attack = battle.pendingAttacks[0]!; battle.tick(attack.arrivesAt); expect(battle.phase).toBe('FINISHED'); expect(battle.result?.winnerId).toBe('a'); expect(battle.result?.reason).toBe('HP_ZERO') });
});
