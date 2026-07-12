import { BATTLE_CONFIG, effectFor } from './config.js';
import type { RandomSource } from './random.js';
import { SeededRandom } from './random.js';
import { TILE_TYPES, type BoardState, type MatchGroup, type MatchResolution, type Position, type SwapRequest, type TileType } from './types.js';

const size = BATTLE_CONFIG.boardSize;
const index = (row: number, col: number) => row * size + col;
const key = (p: Position) => `${p.row}:${p.col}`;
export const inBounds = (p: Position) => p.row >= 0 && p.col >= 0 && p.row < size && p.col < size;
export const areAdjacent = (a: Position, b: Position) => inBounds(a) && inBounds(b) && Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

export function swapTiles(board: TileType[], a: Position, b: Position): TileType[] {
  const copy = [...board];
  const ai = index(a.row, a.col), bi = index(b.row, b.col);
  [copy[ai], copy[bi]] = [copy[bi]!, copy[ai]!];
  return copy;
}

export function findMatches(board: TileType[]): MatchGroup[] {
  const runs: MatchGroup[] = [];
  for (let row = 0; row < size; row++) {
    let start = 0;
    for (let col = 1; col <= size; col++) {
      if (col === size || board[index(row, col)] !== board[index(row, start)]) {
        if (col - start >= 3) runs.push({ type: board[index(row, start)]!, cells: Array.from({ length: col - start }, (_, i) => ({ row, col: start + i })) });
        start = col;
      }
    }
  }
  for (let col = 0; col < size; col++) {
    let start = 0;
    for (let row = 1; row <= size; row++) {
      if (row === size || board[index(row, col)] !== board[index(start, col)]) {
        if (row - start >= 3) runs.push({ type: board[index(start, col)]!, cells: Array.from({ length: row - start }, (_, i) => ({ row: start + i, col })) });
        start = row;
      }
    }
  }
  const groups: MatchGroup[] = [];
  for (const run of runs) {
    const touching = groups.filter((group) => group.type === run.type && group.cells.some((cell) => run.cells.some((other) => key(cell) === key(other))));
    const cells = new Map(run.cells.map((cell) => [key(cell), cell]));
    for (const group of touching) for (const cell of group.cells) cells.set(key(cell), cell);
    for (const group of touching) groups.splice(groups.indexOf(group), 1);
    groups.push({ type: run.type, cells: [...cells.values()] });
  }
  return groups;
}

export function listLegalSwaps(board: TileType[]): Array<[Position, Position]> {
  const moves: Array<[Position, Position]> = [];
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const from = { row, col };
    for (const to of [{ row: row + 1, col }, { row, col: col + 1 }]) {
      if (inBounds(to) && findMatches(swapTiles(board, from, to)).length > 0) moves.push([from, to]);
    }
  }
  return moves;
}

function randomTile(rng: RandomSource): TileType { return TILE_TYPES[Math.floor(rng.next() * TILE_TYPES.length)]! }

export function generateBoard(rng: RandomSource = new SeededRandom()): TileType[] {
  for (let attempt = 0; attempt < 2_000; attempt++) {
    const board: TileType[] = [];
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const choices = TILE_TYPES.filter((type) => !(col >= 2 && board[index(row, col - 1)] === type && board[index(row, col - 2)] === type) && !(row >= 2 && board[index(row - 1, col)] === type && board[index(row - 2, col)] === type));
      board.push(choices[Math.floor(rng.next() * choices.length)]!);
    }
    if (listLegalSwaps(board).length > 0) return board;
  }
  throw new Error('Unable to generate playable board');
}

export function shuffleBoard(board: TileType[], rng: RandomSource): TileType[] {
  for (let attempt = 0; attempt < 1_000; attempt++) {
    const result = [...board];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    if (findMatches(result).length === 0 && listLegalSwaps(result).length > 0) return result;
  }
  return generateBoard(rng);
}

function collapseAndFill(board: (TileType | null)[], rng: RandomSource): TileType[] {
  const result = [...board];
  for (let col = 0; col < size; col++) {
    const values: TileType[] = [];
    for (let row = size - 1; row >= 0; row--) { const value = result[index(row, col)]; if (value) values.push(value) }
    for (let row = size - 1, i = 0; row >= 0; row--, i++) result[index(row, col)] = values[i] ?? randomTile(rng);
  }
  return result as TileType[];
}

export function resolveSwap(state: BoardState, request: SwapRequest, rng: RandomSource = new SeededRandom()): MatchResolution | null {
  if (state.processing || !areAdjacent(request.from, request.to)) return null;
  let board = swapTiles(state.tiles, request.from, request.to);
  let groups = findMatches(board);
  if (!groups.length) return null;
  const steps: MatchResolution['steps'] = [], effects: MatchResolution['effects'] = [];
  let chain = 1;
  while (groups.length && chain <= 30) {
    const removed: (TileType | null)[] = [...board];
    for (const group of groups) {
      for (const cell of group.cells) removed[index(cell.row, cell.col)] = null;
      effects.push({ type: group.type, amount: effectFor(group.type, group.cells.length, chain), matched: group.cells.length, chain });
    }
    const filled = collapseAndFill(removed, rng);
    steps.push({ chain, groups, boardAfterRemoval: removed, boardAfterFill: filled });
    board = filled; groups = findMatches(board); chain++;
  }
  const needsShuffle = listLegalSwaps(board).length === 0;
  if (needsShuffle) board = shuffleBoard(board, rng);
  return { requestId: request.requestId, steps, effects, finalBoard: board, shuffled: needsShuffle };
}
