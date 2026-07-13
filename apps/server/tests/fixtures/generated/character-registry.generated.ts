// AUTO-GENERATED FILE. DO NOT EDIT.
import type { CharacterDefinition } from '@mercenary/shared';
import type { AbilityDefinition } from '../../../src/effect-types.js';

export const generatedCharacterDefinitions = [
  {
    "id": "custom_test_character",
    "name": "Custom Test Character",
    "shortName": "Custom",
    "rarity": "R",
    "race": "TEST",
    "tags": [
      "TEST"
    ],
    "description": "Test only",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "support",
    "portraitAsset": "/characters/test.svg",
    "stats": {
      "maxHp": 1234,
      "swordEffectPct": 150,
      "shieldEffectPct": 80,
      "healEffectPct": 125,
      "manaGainPct": 60
    },
    "combatant": {
      "skillId": "custom_test_active"
    },
    "support": {
      "effectId": "custom_test_support"
    }
  }
] as CharacterDefinition[];
export const generatedAbilityDefinitions = [
  {
    "id": "custom_test_active",
    "kind": "active",
    "name": "Fixture Command",
    "shortDescription": "Returns shield and mana commands.",
    "fullDescription": "Test-only trusted custom handler.",
    "trigger": {
      "type": "active_requested"
    },
    "cost": 100,
    "cooldownMs": 0,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [],
    "effects": [
      {
        "type": "custom",
        "handlerId": "custom_test_character.commandPair",
        "parameters": {
          "shield": 10,
          "mana": 5
        }
      }
    ],
    "tags": [
      "defense"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "custom_test_support",
    "kind": "support",
    "name": "Fixture Support",
    "shortDescription": "Disabled by an impossible fixture condition.",
    "fullDescription": "Exists only to complete the package.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 0,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [
      {
        "type": "not",
        "condition": {
          "type": "all",
          "conditions": []
        }
      }
    ],
    "effects": [
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 1
      }
    ],
    "tags": [
      "defense"
    ],
    "contentVersion": 1,
    "enabled": true
  }
] as AbilityDefinition[];
export const generatedCharacterStats = {
  "custom_test_character": {
    "maxHp": 1234,
    "swordEffectPct": 150,
    "shieldEffectPct": 80,
    "healEffectPct": 125,
    "manaGainPct": 60
  }
} as const;
export const generatedPresentation = {} as const;
