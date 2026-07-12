import { describe, expect, it } from 'vitest';
import { SeededRandom, areAdjacent, findMatches, generateBoard, listLegalSwaps, resolveSwap, shuffleBoard, swapTiles, type TileType } from '../src/index';

const pattern = (): TileType[] => Array.from({ length: 49 }, (_, i) => ['SWORD', 'SHIELD', 'HEAL', 'MANA'][(Math.floor(i / 7) + i % 7) % 4] as TileType);
const state = (tiles: TileType[]) => ({ tiles, version: 1, processing: false });

describe('match-3 core', () => {
  it('rejects non-adjacent swaps', () => expect(areAdjacent({ row: 0, col: 0 }, { row: 0, col: 2 })).toBe(false));
  it('rolls back swaps that create no match', () => expect(resolveSwap(state(pattern()), { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, requestId: 'x' }, new SeededRandom(1))).toBeNull());
  it.each([
    ['horizontal 3', [[0, 0], [0, 1], [0, 2]]],
    ['horizontal 4', [[1, 0], [1, 1], [1, 2], [1, 3]]],
    ['horizontal 5', [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]]],
  ])('finds %s', (_name, cells) => { const board = pattern(); for (const [row, col] of cells as number[][]) board[row! * 7 + col!] = 'SWORD'; expect(findMatches(board).some((group) => group.cells.length === cells.length)).toBe(true) });
  it('finds a vertical match', () => { const board = pattern(); for (let row = 0; row < 3; row++) board[row * 7] = 'MANA'; expect(findMatches(board).some((group) => group.type === 'MANA' && group.cells.length >= 3)).toBe(true) });
  it('merges a cross match', () => { const board = pattern(); for (const [r, c] of [[2, 3], [3, 2], [3, 3], [3, 4], [4, 3]]) board[r! * 7 + c!] = 'HEAL'; expect(findMatches(board).some((group) => group.type === 'HEAL' && group.cells.length === 5)).toBe(true) });
  it('finds simultaneous separated groups', () => { const board = pattern(); for (let col = 0; col < 3; col++) { board[col] = 'SWORD'; board[6 * 7 + col] = 'SHIELD' } expect(findMatches(board).length).toBeGreaterThanOrEqual(2) });
  it('resolves a cascading board', () => {
    let found = false;
    for (let seed = 1; seed < 300 && !found; seed++) { const board = generateBoard(new SeededRandom(seed)); for (const [from, to] of listLegalSwaps(board)) { const result = resolveSwap(state(board), { from, to, requestId: 'cascade' }, new SeededRandom(seed + 900)); if (result && result.steps.length >= 2) { found = true; break } } }
    expect(found).toBe(true);
  });
  it('generates boards without initial matches and with a legal move', () => { for (let seed = 1; seed < 30; seed++) { const board = generateBoard(new SeededRandom(seed)); expect(findMatches(board)).toHaveLength(0); expect(listLegalSwaps(board).length).toBeGreaterThan(0) } });
  it('shuffles into a stable playable board', () => { const board = Array<TileType>(49).fill('SWORD'); const shuffled = shuffleBoard(board, new SeededRandom(7)); expect(findMatches(shuffled)).toHaveLength(0); expect(listLegalSwaps(shuffled).length).toBeGreaterThan(0) });
  it('only lists swaps that produce matches', () => { const board = generateBoard(new SeededRandom(55)); for (const [a, b] of listLegalSwaps(board)) expect(findMatches(swapTiles(board, a, b)).length).toBeGreaterThan(0) });
});
