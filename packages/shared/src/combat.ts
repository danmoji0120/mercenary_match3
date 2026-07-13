import { BATTLE_CONFIG } from './config.js';
import type { BattleDecision, BattleParticipant, BattleStats, PendingAttack } from './types.js';

export function createBattleStats(): BattleStats {
  return { totalDamageGenerated: 0, hpDamageDealt: 0, shieldDamageDealt: 0, totalDamageReceived: 0, hpDamageReceived: 0, damageBlockedByShield: 0, shieldGained: 0, healingDone: 0, manaGained: 0, swordMatchCount: 0, shieldMatchCount: 0, healMatchCount: 0, manaMatchCount: 0, swordTilesMatched: 0, shieldTilesMatched: 0, healTilesMatched: 0, manaTilesMatched: 0, maxChain: 0, skillUseCount: 0, attacksQueued: 0, attacksFullyBlocked: 0, shieldBreakCount: 0, activeSkillUsesById: {}, supportEffectTriggersById: {}, damageByAbilityId: {}, healingByAbilityId: {}, shieldByAbilityId: {}, directHpDamageBypass: 0, healingPrevented: 0, damageReduced: 0, bonusShieldFromEffects: 0, emergencyHealsTriggered: 0, countersTriggered: 0 };
}

export function applyShield(player: BattleParticipant, amount: number): number {
  const previous = player.shield;
  player.shield = Math.min(BATTLE_CONFIG.maxShield, player.shield + amount);
  return player.shield - previous;
}
export function applyHeal(player: BattleParticipant, amount: number): number {
  const previous = player.hp;
  player.hp = Math.min(BATTLE_CONFIG.maxHp, player.hp + amount);
  return player.hp - previous;
}
export function applyGauge(player: BattleParticipant, amount: number): number {
  const previous = player.gauge;
  player.gauge = Math.min(BATTLE_CONFIG.maxGauge, player.gauge + amount);
  return player.gauge - previous;
}
export function resolveAttack(target: BattleParticipant, attack: PendingAttack): { absorbed: number; hpDamage: number; shieldBroken: boolean } {
  const shieldBefore = target.shield;
  const bypassDamage = Math.min(target.hp, Math.round(attack.damage * Math.min(.5, Math.max(0, attack.shieldBypassRatio ?? 0))));
  const normalDamage = attack.damage - bypassDamage;
  const absorbed = Math.min(target.shield, normalDamage);
  target.shield -= absorbed;
  const hpDamage = Math.min(target.hp, bypassDamage + normalDamage - absorbed);
  target.hp -= hpDamage;
  return { absorbed, hpDamage, shieldBroken: shieldBefore > 0 && target.shield === 0 };
}
export function timeResult(a: BattleParticipant, b: BattleParticipant, at: number): BattleDecision {
  const winnerId = a.hp !== b.hp ? (a.hp > b.hp ? a.id : b.id) : a.shield !== b.shield ? (a.shield > b.shield ? a.id : b.id) : null;
  return { winnerId, reason: 'TIMEOUT', endedAt: at };
}
