import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { areAdjacent, swapTiles, type BoardState, type CombatEffect, type MatchGroup, type MatchResolution, type Position, type SwapRequest, type TileType } from '@mercenary/shared';
import { animationDuration, BOARD_ANIMATION_CONFIG as timing } from './board-animation-config';
import { effectsForStep, ResolutionQueue } from './presentation';
import { sound } from './audio';

const colors: Record<TileType, number> = { SWORD: 0xc84b50, SHIELD: 0x3182a8, HEAL: 0x47a56c, MANA: 0x8b65c2 };
const names: Record<TileType, string> = { SWORD: 'sword', SHIELD: 'shield', HEAL: 'heal', MANA: 'mana' };
const labels: Record<TileType, { tile: string; effect: string }> = {
  SWORD: { tile: '\uAC80', effect: '\uD53C\uD574' },
  SHIELD: { tile: '\uBC29\uD328', effect: '\uBCF4\uD638\uB9C9' },
  HEAL: { tile: '\uD68C\uBCF5', effect: 'HP' },
  MANA: { tile: '\uB9C8\uB825', effect: '\uAC8C\uC774\uC9C0' },
};

class BoardScene extends Phaser.Scene {
  board: BoardState;
  send: (request: SwapRequest) => void;
  sprites: Array<Phaser.GameObjects.Container | null> = [];
  start: Position | null = null;
  down = { x: 0, y: 0 };
  locked = false;
  ready = false;
  enabled = true;
  presenting = false;
  swapping = false;
  pendingBoard: BoardState | null = null;
  queue = new ResolutionQueue<MatchResolution>();
  generation = 0;
  activeResolvers = new Set<() => void>();
  overlays = new Set<Phaser.GameObjects.GameObject>();
  seenRequests = new Set<string>();
  reducedMotion = false;

  constructor(board: BoardState, send: (request: SwapRequest) => void) { super('board'); this.board = board; this.send = send }
  preload() { for (const type of Object.keys(names) as TileType[]) this.load.svg(names[type], `/icons/${names[type]}.svg`, { width: 44, height: 44 }) }
  create() {
    this.ready = true; this.render();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.pointerDown(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.pointerUp(pointer));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cancelPresentation());
  }

  private isBusy() { return this.presenting || this.swapping || this.queue.length > 0 }
  updateBoard(board: BoardState) {
    if (this.isBusy()) { this.pendingBoard = board; return }
    this.board = board; this.locked = !this.enabled || board.processing; if (this.ready) this.render();
  }
  setEnabled(enabled: boolean) {
    if (enabled && !this.enabled) this.queue = new ResolutionQueue<MatchResolution>();
    this.enabled = enabled;
    if (!enabled && this.isBusy()) this.cancelPresentation();
    else this.locked = !enabled || this.board.processing;
  }
  enqueueResolution(resolution: MatchResolution, reducedMotion: boolean) {
    if (this.seenRequests.has(resolution.requestId)) return;
    this.reducedMotion = reducedMotion; this.seenRequests.add(resolution.requestId); this.queue.enqueue(resolution); void this.pump(reducedMotion);
  }

  private async pump(reducedMotion: boolean) {
    if (!this.ready || this.presenting || this.swapping || !this.enabled) return;
    const resolution = this.queue.shift(); if (!resolution) return;
    this.presenting = true; this.locked = true; const generation = this.generation;
    for (const step of resolution.steps) {
      if (generation !== this.generation) return;
      const effects = effectsForStep(resolution, step);
      if (step.chain > 1) this.showChain(step.chain);
      this.showResults(step.groups, effects);
      await this.highlight(step.groups, reducedMotion);
      if (generation !== this.generation) return;
      await this.remove(step.groups, step.boardAfterRemoval, reducedMotion);
      if (generation !== this.generation) return;
      await this.fall(step.boardAfterFill, reducedMotion);
      if (generation !== this.generation) return;
      await this.spawn(reducedMotion);
      await this.wait(animationDuration(timing.chainPauseDurationMs, reducedMotion));
    }
    if (generation !== this.generation) return;
    this.board = this.pendingBoard ?? { ...this.board, tiles: resolution.finalBoard, processing: false };
    this.pendingBoard = null; this.presenting = false; this.locked = !this.enabled || this.board.processing; this.render(); sound('match');
    void this.pump(reducedMotion);
  }

  private matchedIndexes(groups: MatchGroup[]) { return new Set(groups.flatMap((group) => group.cells.map((cell) => cell.row * 7 + cell.col))) }
  private async highlight(groups: MatchGroup[], reducedMotion: boolean) {
    const matched = this.matchedIndexes(groups);
    for (const [index, sprite] of this.sprites.entries()) if (sprite) {
      if (matched.has(index)) { const size = groups.some((group) => group.cells.length >= 5 && group.cells.some((cell) => cell.row * 7 + cell.col === index)) ? 1.15 : 1.1; sprite.setScale(size); sprite.setAlpha(1); const background = sprite.first as Phaser.GameObjects.Rectangle; background.setStrokeStyle(5, 0xfff1a8, 1) }
      else sprite.setAlpha(0.62);
    }
    const targets = this.sprites.filter((sprite, index): sprite is Phaser.GameObjects.Container => Boolean(sprite && matched.has(index)));
    await this.tween({ targets, scaleX: '+=0.035', scaleY: '+=0.035', yoyo: true, repeat: 1, duration: animationDuration(timing.matchHighlightDurationMs / 4, reducedMotion) });
  }
  private async remove(groups: MatchGroup[], removed: (TileType | null)[], reducedMotion: boolean) {
    const matched = this.matchedIndexes(groups);
    const targets = this.sprites.filter((sprite, index): sprite is Phaser.GameObjects.Container => Boolean(sprite && matched.has(index)));
    await this.tween({ targets, scale: 0.05, alpha: 0, angle: 8, duration: animationDuration(timing.removeDurationMs, reducedMotion), ease: 'Quad.easeIn' });
    this.render(removed);
  }
  private async fall(filled: TileType[], reducedMotion: boolean) {
    this.board = { ...this.board, tiles: filled, processing: true }; this.render();
    for (const sprite of this.sprites) if (sprite) { sprite.y -= 42; sprite.alpha = 0.75 }
    await this.tween({ targets: this.sprites.filter(Boolean), y: '+=42', alpha: 1, duration: animationDuration(timing.fallDurationMs, reducedMotion), ease: 'Cubic.easeOut' });
  }
  private async spawn(reducedMotion: boolean) {
    const targets = this.sprites.filter(Boolean); for (const sprite of targets) (sprite as Phaser.GameObjects.Container).setScale(0.92);
    await this.tween({ targets, scale: 1, duration: animationDuration(timing.spawnDurationMs, reducedMotion), ease: 'Back.easeOut' });
  }

  private showChain(chain: number) {
    const label = this.add.text(238, 182, `CHAIN ${chain}`, { fontFamily: 'Georgia', fontSize: `${38 + Math.min(12, chain * 2)}px`, color: '#ffe28a', stroke: '#48231f', strokeThickness: 7 }).setOrigin(0.5).setDepth(30);
    this.overlays.add(label); void this.tween({ targets: label, y: 156, alpha: 0, delay: timing.matchHighlightDurationMs, duration: 220 }).then(() => { this.overlays.delete(label); label.destroy() });
  }
  private showResults(groups: MatchGroup[], effects: CombatEffect[]) {
    groups.forEach((group, index) => {
      const effect = effects[index] ?? effects.find((candidate) => candidate.type === group.type && candidate.matched === group.cells.length);
      if (!effect) return;
      const center = group.cells.reduce((value, cell) => ({ row: value.row + cell.row / group.cells.length, col: value.col + cell.col / group.cells.length }), { row: 0, col: 0 });
      const prefix = group.type === 'SWORD' ? '' : '+';
      const text = this.add.text(22, 0, `${labels[group.type].tile} \u00D7${group.cells.length}  ${prefix}${effect.amount} ${labels[group.type].effect}`, { fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: '#ffffff', stroke: '#10131f', strokeThickness: 5 }).setOrigin(0.5);
      const icon = this.add.image(-92, 0, names[group.type]).setDisplaySize(28, 28);
      const panel = this.add.rectangle(0, 0, 238, 38, 0x10131f, 0.88).setStrokeStyle(2, colors[group.type], 1);
      const container = this.add.container(Math.max(122, Math.min(354, center.col * 68 + 34)), Math.max(34, center.row * 68 + 16), [panel, icon, text]).setDepth(25);
      this.overlays.add(container); void this.tween({ targets: container, y: '-=24', alpha: 0, delay: timing.resultTextDurationMs, duration: 180 }).then(() => { this.overlays.delete(container); container.destroy() });
    });
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    if (!this.scene?.isActive()) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => { this.activeResolvers.delete(done); resolve() };
      this.activeResolvers.add(done); this.tweens.add({ ...config, onComplete: done, onStop: done });
    });
  }
  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => { const done = () => { this.activeResolvers.delete(done); resolve() }; this.activeResolvers.add(done); this.time.delayedCall(ms, done) });
  }
  cancelPresentation() {
    this.generation++; this.queue.cancel(); this.tweens?.killAll(); this.time?.removeAllEvents();
    for (const resolve of [...this.activeResolvers]) resolve(); this.activeResolvers.clear();
    for (const overlay of this.overlays) overlay.destroy(); this.overlays.clear();
    this.presenting = false; this.swapping = false; this.pendingBoard = null; this.locked = true;
  }

  render(tiles: Array<TileType | null> = this.board.tiles) {
    for (const sprite of this.sprites) sprite?.destroy(); this.sprites = Array(49).fill(null);
    const cell = 68;
    tiles.forEach((type, i) => {
      if (!type) return; const row = Math.floor(i / 7), col = i % 7;
      const bg = this.add.rectangle(0, 0, 60, 60, colors[type], 0.94).setStrokeStyle(2, 0xffffff, 0.14);
      const icon = this.add.image(0, 0, names[type]).setDisplaySize(39, 39);
      this.sprites[i] = this.add.container(col * cell + cell / 2, row * cell + cell / 2, [bg, icon]);
    });
  }
  position(pointer: Phaser.Input.Pointer): Position { return { row: Math.max(0, Math.min(6, Math.floor(pointer.y / 68))), col: Math.max(0, Math.min(6, Math.floor(pointer.x / 68))) } }
  pointerDown(pointer: Phaser.Input.Pointer) { if (this.locked || !this.enabled) return; this.start = this.position(pointer); this.down = { x: pointer.x, y: pointer.y }; sound('select') }
  pointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.start || this.locked || !this.enabled) return;
    const from = this.start, dx = pointer.x - this.down.x, dy = pointer.y - this.down.y; let to: Position;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 12) to = Math.abs(dx) > Math.abs(dy) ? { row: from.row, col: from.col + Math.sign(dx) } : { row: from.row + Math.sign(dy), col: from.col };
    else to = this.position(pointer);
    this.start = null; if (!areAdjacent(from, to)) return;
    const request = { from, to, requestId: crypto.randomUUID() }; this.locked = true; this.swapping = true; this.send(request);
    const a = this.sprites[from.row * 7 + from.col], b = this.sprites[to.row * 7 + to.col];
    if (!a || !b) { this.finishSwap(from, to, false); return }
    const ax = a.x, ay = a.y, bx = b.x, by = b.y;
    void Promise.all([this.tween({ targets: a, x: bx, y: by, duration: timing.swapDurationMs, ease: 'Quad.easeInOut' }), this.tween({ targets: b, x: ax, y: ay, duration: timing.swapDurationMs, ease: 'Quad.easeInOut' })]).then(() => this.finishSwap(from, to, true));
  }
  private finishSwap(from: Position, to: Position, animate: boolean) {
    if (!this.swapping) return; this.board = { ...this.board, tiles: swapTiles(this.board.tiles, from, to), processing: true }; this.swapping = false;
    if (animate) this.render();
    if (this.queue.length) void this.pump(this.reducedMotion);
    else if (this.pendingBoard) { this.board = this.pendingBoard; this.pendingBoard = null; this.locked = !this.enabled || this.board.processing; this.render() }
  }
}

export function Board({ board, resolution, onSwap, reducedMotion, active }: { board: BoardState; resolution: MatchResolution | null; onSwap: (request: SwapRequest) => void; reducedMotion: boolean; active: boolean }) {
  const host = useRef<HTMLDivElement>(null), scene = useRef<BoardScene | null>(null);
  useEffect(() => {
    if (!host.current) return; const boardScene = new BoardScene(board, onSwap); scene.current = boardScene;
    const game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 476, height: 476, transparent: true, antialias: true, scene: boardScene, input: { touch: { capture: true } }, fps: { target: reducedMotion ? 30 : 60 } });
    return () => { boardScene.cancelPresentation(); scene.current = null; game.destroy(true) };
  }, []);
  useEffect(() => { if (resolution) scene.current?.enqueueResolution(resolution, reducedMotion) }, [resolution]);
  useEffect(() => { scene.current?.updateBoard(board) }, [board]);
  useEffect(() => { scene.current?.setEnabled(active) }, [active]);
  return <div className="board" ref={host} data-board-version={board.version} data-input-locked={!active || board.processing} />;
}
