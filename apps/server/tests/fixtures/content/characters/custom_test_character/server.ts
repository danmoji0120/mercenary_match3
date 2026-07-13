import type { CharacterServerModule, CustomAbilityHandler } from '../../../../../src/custom-ability.js';

const commandPair: CustomAbilityHandler = {
  id: 'custom_test_character.commandPair',
  execute(context, parameters) {
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('FIXTURE_PARAMETERS');
    const shield = Number(parameters.shield), mana = Number(parameters.mana);
    const previous = Number(context.customState['custom_test_character.counter'] ?? 0);
    const deterministicBonus = context.rng.integer(1);
    return {
      commands: [context.command.addShield(shield + deterministicBonus), context.command.schedule(0, [context.command.modifyMana(mana)])],
      statePatch: { 'custom_test_character.counter': previous + 1 },
    };
  },
};

export const characterServerModule: CharacterServerModule = { characterId: 'custom_test_character', handlers: [commandPair] };
