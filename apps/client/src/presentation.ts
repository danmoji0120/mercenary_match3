import type { CombatEffect, MatchResolution, MatchStep } from '@mercenary/shared';

export type PresentationStageType = 'CHAIN' | 'HIGHLIGHT' | 'RESULTS' | 'REMOVE' | 'FALL' | 'SPAWN' | 'PAUSE';
export interface PresentationStage { type: PresentationStageType; chain: number; step: MatchStep; effects: CombatEffect[] }

export function effectsForStep(resolution: MatchResolution, step: MatchStep): CombatEffect[] {
  return resolution.effects.filter((effect) => effect.chain === step.chain);
}

export function buildPresentationQueue(resolution: MatchResolution): PresentationStage[] {
  return resolution.steps.flatMap((step) => {
    const effects = effectsForStep(resolution, step);
    const stages: PresentationStage[] = [];
    if (step.chain > 1) stages.push({ type: 'CHAIN', chain: step.chain, step, effects });
    for (const type of ['HIGHLIGHT', 'RESULTS', 'REMOVE', 'FALL', 'SPAWN', 'PAUSE'] as const) stages.push({ type, chain: step.chain, step, effects });
    return stages;
  });
}

export class ResolutionQueue<T> {
  private values: T[] = [];
  private cancelled = false;
  enqueue(value: T) { if (!this.cancelled) this.values.push(value) }
  shift(): T | undefined { return this.cancelled ? undefined : this.values.shift() }
  clear() { this.values = [] }
  cancel() { this.cancelled = true; this.clear() }
  get length() { return this.values.length }
}
