// AUTO-GENERATED FILE. DO NOT EDIT.
import type { CharacterDefinition } from '@mercenary/shared';
import type { AbilityDefinition } from '../effect-types.js';

export const generatedCharacterDefinitions = [
  {
    "id": "clarice_heavy_shield",
    "name": "중갑 방패기사 클라리스",
    "shortName": "클라리스",
    "rarity": "SR",
    "race": "HUMAN",
    "tags": [
      "HUMAN",
      "SHIELD",
      "DEFENSE",
      "HEAVY"
    ],
    "description": "거대한 방패로 버티는 기사",
    "enabled": true,
    "starter": true,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "/characters/clarice_heavy_shield.svg",
    "stats": {
      "maxHp": 1000,
      "swordEffectPct": 100,
      "shieldEffectPct": 100,
      "healEffectPct": 100,
      "manaGainPct": 100
    },
    "defaultSlots": [
      "bot_combatant"
    ],
    "combatant": {
      "skillId": "clarice_fortress_stance"
    },
    "support": {
      "effectId": "clarice_heavy_guard"
    }
  },
  {
    "id": "eda_curse_appraiser",
    "name": "저주 감정사 에다",
    "shortName": "에다",
    "rarity": "SR",
    "race": "HUMAN",
    "tags": [
      "HUMAN",
      "CURSE",
      "SUPPORT",
      "DISRUPTION"
    ],
    "description": "저주의 흐름을 읽는 감정사",
    "enabled": true,
    "starter": true,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "support",
    "portraitAsset": "/characters/eda_curse_appraiser.svg",
    "stats": {
      "maxHp": 1000,
      "swordEffectPct": 100,
      "shieldEffectPct": 100,
      "healEffectPct": 100,
      "manaGainPct": 100
    },
    "defaultSlots": [
      "bot_support_2"
    ],
    "combatant": {
      "skillId": "eda_curse_verdict"
    },
    "support": {
      "effectId": "eda_exposed_flaw"
    }
  },
  {
    "id": "evelyn_trauma_stitcher",
    "name": "외상 봉합사 이브린",
    "shortName": "이브린",
    "rarity": "SR",
    "race": "HUMAN",
    "tags": [
      "HUMAN",
      "HEAL",
      "SUPPORT",
      "MEDIC"
    ],
    "description": "빠른 봉합으로 아군을 돕는 의무병",
    "enabled": true,
    "starter": true,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "support",
    "portraitAsset": "/characters/evelyn_trauma_stitcher.svg",
    "stats": {
      "maxHp": 1000,
      "swordEffectPct": 100,
      "shieldEffectPct": 100,
      "healEffectPct": 100,
      "manaGainPct": 100
    },
    "defaultSlots": [
      "account_support_2"
    ],
    "combatant": {
      "skillId": "evelyn_field_surgery"
    },
    "support": {
      "effectId": "evelyn_emergency_stitch"
    }
  },
  {
    "id": "marta_guard_captain",
    "name": "방패 경비반장 마르타",
    "shortName": "마르타",
    "rarity": "SR",
    "race": "HUMAN",
    "tags": [
      "HUMAN",
      "SHIELD",
      "SUPPORT",
      "GUARD"
    ],
    "description": "대오를 지키는 경비반장",
    "enabled": true,
    "starter": true,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "support",
    "portraitAsset": "/characters/marta_guard_captain.svg",
    "stats": {
      "maxHp": 1000,
      "swordEffectPct": 100,
      "shieldEffectPct": 100,
      "healEffectPct": 100,
      "manaGainPct": 100
    },
    "defaultSlots": [
      "account_support_1",
      "bot_support_1"
    ],
    "combatant": {
      "skillId": "marta_guard_command"
    },
    "support": {
      "effectId": "marta_intercept_order"
    }
  },
  {
    "id": "yuria_counter_sword",
    "name": "반격검사 유리아",
    "shortName": "유리아",
    "rarity": "SR",
    "race": "HUMAN",
    "tags": [
      "HUMAN",
      "SWORD",
      "COUNTER",
      "OFFENSE"
    ],
    "description": "반격을 노리는 검사",
    "enabled": true,
    "starter": true,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "/characters/yuria_counter_sword.svg",
    "stats": {
      "maxHp": 1000,
      "swordEffectPct": 100,
      "shieldEffectPct": 100,
      "healEffectPct": 100,
      "manaGainPct": 100
    },
    "defaultSlots": [
      "account_combatant"
    ],
    "combatant": {
      "skillId": "yuria_counter_break"
    },
    "support": {
      "effectId": "yuria_revenge_edge"
    }
  }
] as CharacterDefinition[];
export const generatedAbilityDefinitions = [
  {
    "id": "clarice_fortress_stance",
    "kind": "active",
    "name": "철벽 태세",
    "shortDescription": "보호막 230 · 받는 피해 25% 감소",
    "fullDescription": "보호막을 얻고 4초 동안 받는 피해를 감소시킵니다.",
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
        "type": "gain_shield",
        "target": "self",
        "amount": 230
      },
      {
        "type": "apply_status",
        "target": "self",
        "statusId": "damage_reduction"
      }
    ],
    "tags": [
      "defense",
      "shield"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "clarice_heavy_guard",
    "kind": "support",
    "name": "중갑 방호",
    "shortDescription": "방패 4+ 매치 시 추가 보호막",
    "fullDescription": "큰 방패 매치로 연쇄 단계당 최대 80의 추가 보호막을 얻습니다.",
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
        "type": "tile_type_is",
        "tileType": "SHIELD"
      }
    ],
    "effects": [
      {
        "type": "conditional",
        "conditions": [
          {
            "type": "matched_tile_count",
            "operator": "gte",
            "value": 6
          }
        ],
        "effects": [
          {
            "type": "gain_shield",
            "target": "self",
            "amount": 60,
            "scope": "chain_step",
            "cap": 80
          }
        ]
      },
      {
        "type": "conditional",
        "conditions": [
          {
            "type": "all",
            "conditions": [
              {
                "type": "matched_tile_count",
                "operator": "gte",
                "value": 4
              },
              {
                "type": "matched_tile_count",
                "operator": "lt",
                "value": 6
              }
            ]
          }
        ],
        "effects": [
          {
            "type": "gain_shield",
            "target": "self",
            "amount": 35,
            "scope": "chain_step",
            "cap": 80
          }
        ]
      }
    ],
    "tags": [
      "defense",
      "shield"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "eda_curse_verdict",
    "kind": "active",
    "name": "회복 봉인 감정",
    "shortDescription": "피해 155 · 회복량 45% 감소",
    "fullDescription": "적에게 피해를 주고 7초 동안 회복 효율을 감소시킵니다.",
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
        "type": "deal_damage",
        "target": "opponent",
        "amount": 155,
        "travelMs": 650,
        "tags": [
          "active_skill",
          "disruption"
        ]
      },
      {
        "type": "schedule_effects",
        "delayMs": 650,
        "effects": [
          {
            "type": "apply_status",
            "target": "opponent",
            "statusId": "healing_reduction"
          }
        ]
      }
    ],
    "tags": [
      "offense",
      "disruption"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "eda_exposed_flaw",
    "kind": "support",
    "name": "약점 감정",
    "shortDescription": "마력 4+ 매치 후 보호막 무시 30%",
    "fullDescription": "큰 마력 매치 후 다음 피해 공격 일부가 보호막을 무시합니다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "MANA"
          },
          {
            "type": "matched_tile_count",
            "operator": "gte",
            "value": 4
          }
        ]
      }
    ],
    "effects": [
      {
        "type": "apply_status",
        "target": "self",
        "statusId": "exposed_flaw_charge"
      }
    ],
    "tags": [
      "disruption"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "evelyn_field_surgery",
    "kind": "active",
    "name": "전장 봉합",
    "shortDescription": "회복 210 · 초과 회복을 보호막 전환",
    "fullDescription": "체력을 회복하고 초과 회복량의 절반을 보호막으로 전환합니다.",
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
        "type": "heal",
        "key": "primaryHeal",
        "target": "self",
        "amount": 210
      },
      {
        "type": "convert_overheal_to_shield",
        "target": "self",
        "conditions": [
          {
            "type": "effect_result_compare",
            "effectKey": "primaryHeal",
            "field": "overhealing",
            "operator": "gt",
            "value": 0
          }
        ],
        "ratio": 0.5,
        "maximum": 70
      }
    ],
    "tags": [
      "heal",
      "shield"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "evelyn_emergency_stitch",
    "kind": "support",
    "name": "응급 봉합",
    "shortDescription": "HP 25% 이하 진입 시 회복 150",
    "fullDescription": "체력이 위험 수준으로 내려가면 경기당 한 번 응급 회복합니다.",
    "trigger": {
      "type": "hp_threshold_crossed"
    },
    "cost": 0,
    "cooldownMs": 0,
    "oncePerBattle": true,
    "maxTriggersPerBattle": 1,
    "chainLimit": null,
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "hp_threshold_crossed",
            "operator": "eq",
            "value": 25,
            "direction": "downward"
          },
          {
            "type": "self_hp_ratio",
            "operator": "gt",
            "value": 0
          }
        ]
      }
    ],
    "effects": [
      {
        "type": "schedule_effects",
        "delayMs": 0,
        "effects": [
          {
            "type": "heal",
            "target": "self",
            "amount": 150
          }
        ]
      }
    ],
    "tags": [
      "heal"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "marta_guard_command",
    "kind": "active",
    "name": "긴급 방어 명령",
    "shortDescription": "보호막 120 · 다음 공격 피해 45% 감소",
    "fullDescription": "보호막을 얻고 다음 한 번의 적 공격 피해를 크게 줄입니다.",
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
        "type": "gain_shield",
        "target": "self",
        "amount": 120
      },
      {
        "type": "apply_status",
        "target": "self",
        "statusId": "emergency_guard"
      }
    ],
    "tags": [
      "defense",
      "shield"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "marta_intercept_order",
    "kind": "support",
    "name": "선제 엄호",
    "shortDescription": "강한 공격 직전 보호막 75",
    "fullDescription": "강한 공격이 도착하기 직전 부족한 보호막을 보충합니다.",
    "trigger": {
      "type": "before_attack_impact",
      "leadTimeMs": 150
    },
    "cost": 0,
    "cooldownMs": 10000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "any",
            "conditions": [
              {
                "type": "incoming_damage",
                "operator": "gte",
                "value": 150
              },
              {
                "type": "source_has_tag",
                "tag": "active_skill"
              }
            ]
          },
          {
            "type": "self_shield_amount",
            "operator": "lt",
            "value": 100
          }
        ]
      }
    ],
    "effects": [
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 75
      }
    ],
    "tags": [
      "defense",
      "shield"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "yuria_counter_break",
    "kind": "active",
    "name": "반격 파쇄",
    "shortDescription": "피해 180 · 보호막 무시 30%",
    "fullDescription": "적에게 피해를 주고 보호막을 파괴하면 추가 참격을 가합니다.",
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
        "type": "deal_damage",
        "key": "primaryAttack",
        "target": "opponent",
        "amount": 180,
        "travelMs": 550,
        "shieldBypassRatio": 0.3,
        "tags": [
          "active_skill",
          "offense"
        ]
      },
      {
        "type": "conditional",
        "conditions": [
          {
            "type": "effect_result_compare",
            "effectKey": "primaryAttack",
            "field": "shieldBroken",
            "operator": "eq",
            "value": true
          }
        ],
        "effects": [
          {
            "type": "schedule_effects",
            "delayMs": 250,
            "effects": [
              {
                "type": "deal_damage",
                "target": "opponent",
                "amount": 65,
                "travelMs": 0,
                "tags": [
                  "followup",
                  "offense"
                ]
              }
            ]
          }
        ]
      }
    ],
    "tags": [
      "offense"
    ],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "yuria_revenge_edge",
    "kind": "support",
    "name": "복수의 칼날",
    "shortDescription": "보호막 파괴 시 피해 75 · 재사용 9초",
    "fullDescription": "적의 공격으로 아군 보호막이 파괴되면 반격합니다.",
    "trigger": {
      "type": "shield_broken"
    },
    "cost": 0,
    "cooldownMs": 9000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [
      {
        "type": "source_type_is",
        "value": "enemy_attack"
      }
    ],
    "effects": [
      {
        "type": "schedule_effects",
        "delayMs": 0,
        "effects": [
          {
            "type": "deal_damage",
            "target": "opponent",
            "amount": 75,
            "travelMs": 0,
            "tags": [
              "counter",
              "offense"
            ]
          }
        ]
      }
    ],
    "tags": [
      "offense"
    ],
    "contentVersion": 1,
    "enabled": true
  }
] as AbilityDefinition[];
export const generatedCharacterStats = {
  "clarice_heavy_shield": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  },
  "eda_curse_appraiser": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  },
  "evelyn_trauma_stitcher": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  },
  "marta_guard_captain": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  },
  "yuria_counter_sword": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  }
} as const;
export const generatedPresentation = {
  "yuria_counter_sword": {
    "abilityPresentation": {
      "yuria_counter_break": {
        "animationKey": "counter_break",
        "soundKey": "sword_heavy",
        "resultLabel": "반격 파쇄"
      }
    }
  }
} as const;
