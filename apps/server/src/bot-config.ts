export interface BotConfig {
  initialThinkDelayMinMs: number;
  initialThinkDelayMaxMs: number;
  actionDelayMinMs: number;
  actionDelayMaxMs: number;
  skillReactionMinMs: number;
  skillReactionMaxMs: number;
  defenseReactionMinMs: number;
  defenseReactionMaxMs: number;
  boardResolutionSettleMs: number;
  bestMoveChance: number;
  topMoveChance: number;
  randomMoveChance: number;
  fourMatchMissChance: number;
  fiveMatchMissChance: number;
  strongAttackDefenseAwarenessChance: number;
  lowHpHealAwarenessChance: number;
  criticalHpHealAwarenessChance: number;
  skillUseChance: number;
  repeatedHealPenalty: number;
  doubleHealPenalty: number;
  repeatedShieldPenalty: number;
  doubleShieldPenalty: number;
  emergencyHpThreshold: number;
}

export const BOT_CONFIG: BotConfig = {
  initialThinkDelayMinMs: 2_200,
  initialThinkDelayMaxMs: 3_400,
  actionDelayMinMs: 1_800,
  actionDelayMaxMs: 2_900,
  skillReactionMinMs: 1_000,
  skillReactionMaxMs: 1_800,
  defenseReactionMinMs: 900,
  defenseReactionMaxMs: 1_600,
  boardResolutionSettleMs: 900,
  bestMoveChance: 0.3,
  topMoveChance: 0.3,
  randomMoveChance: 0.4,
  fourMatchMissChance: 0.45,
  fiveMatchMissChance: 0.35,
  strongAttackDefenseAwarenessChance: 0.4,
  lowHpHealAwarenessChance: 0.6,
  criticalHpHealAwarenessChance: 0.7,
  skillUseChance: 0.65,
  repeatedHealPenalty: 10,
  doubleHealPenalty: 26,
  repeatedShieldPenalty: 8,
  doubleShieldPenalty: 22,
  emergencyHpThreshold: 0.15,
};

const probabilityKeys: Array<keyof BotConfig> = ['bestMoveChance', 'topMoveChance', 'randomMoveChance', 'fourMatchMissChance', 'fiveMatchMissChance', 'strongAttackDefenseAwarenessChance', 'lowHpHealAwarenessChance', 'criticalHpHealAwarenessChance', 'skillUseChance', 'emergencyHpThreshold'];
const ranges: Array<[keyof BotConfig, keyof BotConfig]> = [['initialThinkDelayMinMs', 'initialThinkDelayMaxMs'], ['actionDelayMinMs', 'actionDelayMaxMs'], ['skillReactionMinMs', 'skillReactionMaxMs'], ['defenseReactionMinMs', 'defenseReactionMaxMs']];

export function validateBotConfig(config: BotConfig): BotConfig {
  for (const key of probabilityKeys) if (config[key] < 0 || config[key] > 1) throw new Error(`Invalid bot probability: ${key}`);
  const total = config.bestMoveChance + config.topMoveChance + config.randomMoveChance;
  if (Math.abs(total - 1) > 0.000_001) throw new Error('Bot move probabilities must total 1');
  for (const [minKey, maxKey] of ranges) if (config[minKey] > config[maxKey]) throw new Error(`Invalid bot delay range: ${minKey}`);
  return config;
}

validateBotConfig(BOT_CONFIG);

export function randomDelay(minMs: number, maxMs: number, random = Math.random): number {
  return minMs + Math.floor(random() * (maxMs - minMs + 1));
}

export function botActionDelay(firstAction: boolean, random = Math.random, config = BOT_CONFIG): number {
  return firstAction ? randomDelay(config.initialThinkDelayMinMs, config.initialThinkDelayMaxMs, random) : randomDelay(config.actionDelayMinMs, config.actionDelayMaxMs, random);
}
export function botSkillDelay(random = Math.random, config = BOT_CONFIG): number { return randomDelay(config.skillReactionMinMs, config.skillReactionMaxMs, random) }
export function botDefenseDelay(random = Math.random, config = BOT_CONFIG): number { return randomDelay(config.defenseReactionMinMs, config.defenseReactionMaxMs, random) }
