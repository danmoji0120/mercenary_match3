export interface BoardAnimationConfig {
  swapDurationMs: number;
  matchHighlightDurationMs: number;
  removeDurationMs: number;
  fallDurationMs: number;
  spawnDurationMs: number;
  chainPauseDurationMs: number;
  resultTextDurationMs: number;
}

export const BOARD_ANIMATION_CONFIG: BoardAnimationConfig = {
  swapDurationMs: 150,
  matchHighlightDurationMs: 220,
  removeDurationMs: 160,
  fallDurationMs: 280,
  spawnDurationMs: 120,
  chainPauseDurationMs: 120,
  resultTextDurationMs: 700,
};

export function animationDuration(value: number, reducedMotion: boolean): number {
  return reducedMotion ? Math.min(50, value) : value;
}
