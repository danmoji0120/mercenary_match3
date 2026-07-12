import { describe, expect, it } from 'vitest';
import type { MatchResolution, MatchStep, TileType } from '@mercenary/shared';
import { BOARD_ANIMATION_CONFIG } from '../src/board-animation-config';
import { buildPresentationQueue, ResolutionQueue } from '../src/presentation';

const tiles = Array<TileType>(49).fill('SWORD');
const step = (chain: number): MatchStep => ({ chain, groups: [{ type: chain === 1 ? 'SWORD' : 'SHIELD', cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }] }], boardAfterRemoval: tiles.map((tile, index) => index < 3 ? null : tile), boardAfterFill: [...tiles] });
const resolution: MatchResolution = { requestId: 'r', steps: [step(1), step(2)], finalBoard: tiles, effects: [{ type: 'SWORD', amount: 70, matched: 3, chain: 1 }, { type: 'SHIELD', amount: 72, matched: 3, chain: 2 }], shuffled: false };

describe('board presentation queue', () => {
  it('preserves server chain order and inserts CHAIN only from step two', () => {
    const stages = buildPresentationQueue(resolution);
    expect(stages.map((stage) => `${stage.chain}:${stage.type}`)).toEqual(['1:HIGHLIGHT', '1:RESULTS', '1:REMOVE', '1:FALL', '1:SPAWN', '1:PAUSE', '2:CHAIN', '2:HIGHLIGHT', '2:RESULTS', '2:REMOVE', '2:FALL', '2:SPAWN', '2:PAUSE']);
    expect(stages.find((stage) => stage.chain === 2 && stage.type === 'RESULTS')?.effects[0]?.amount).toBe(72);
  });
  it('does not schedule removal before highlight and results', () => { const first = buildPresentationQueue(resolution).filter((stage) => stage.chain === 1); expect(first.findIndex((stage) => stage.type === 'REMOVE')).toBeGreaterThan(first.findIndex((stage) => stage.type === 'RESULTS')) });
  it('clears queued work for battle end, rematch, or unmount', () => { const queue = new ResolutionQueue<MatchResolution>(); queue.enqueue(resolution); queue.cancel(); expect(queue.length).toBe(0); expect(queue.shift()).toBeUndefined(); queue.enqueue(resolution); expect(queue.length).toBe(0) });
  it('uses readable timings without delaying server resolution', () => { expect(BOARD_ANIMATION_CONFIG).toEqual({ swapDurationMs: 150, matchHighlightDurationMs: 220, removeDurationMs: 160, fallDurationMs: 280, spawnDurationMs: 120, chainPauseDurationMs: 120, resultTextDurationMs: 700 }); const basicDuration = BOARD_ANIMATION_CONFIG.matchHighlightDurationMs + BOARD_ANIMATION_CONFIG.removeDurationMs + BOARD_ANIMATION_CONFIG.fallDurationMs + BOARD_ANIMATION_CONFIG.spawnDurationMs + BOARD_ANIMATION_CONFIG.chainPauseDurationMs; expect(basicDuration).toBe(900) });
});
