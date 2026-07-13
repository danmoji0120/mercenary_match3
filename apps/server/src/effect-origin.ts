import type { EffectOriginMetadata, EffectOriginType } from './effect-types.js';

export const MAX_EFFECT_GENERATION_DEPTH = 8;
export function childOrigin(parent: EffectOriginMetadata, eventId: string, originType: EffectOriginType): EffectOriginMetadata {
  const generationDepth = parent.generationDepth + 1;
  if (generationDepth > MAX_EFFECT_GENERATION_DEPTH) throw new Error(`EFFECT_GENERATION_DEPTH:${generationDepth}`);
  if (originType === 'COPIED' && !parent.canBeCopied) throw new Error('EFFECT_RECOPY_BLOCKED');
  if (originType === 'CONVERTED' && !parent.canBeConverted) throw new Error('EFFECT_RECONVERT_BLOCKED');
  return { ...parent, eventId, parentEventId: parent.eventId, originType, generationDepth, canBeCopied: originType === 'COPIED' ? false : parent.canBeCopied, canBeConverted: originType === 'CONVERTED' ? false : parent.canBeConverted };
}

export function supportMayTrigger(origin: EffectOriginMetadata | undefined, abilityId: string) {
  return !origin || (origin.canTriggerSupport && origin.sourceAbilityId !== abilityId);
}
