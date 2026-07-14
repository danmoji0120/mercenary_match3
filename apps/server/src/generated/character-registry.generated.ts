// AUTO-GENERATED FILE. DO NOT EDIT.
import type { CharacterDefinition } from '@mercenary/shared';
import type { AbilityDefinition } from '../effect-types.js';

export const generatedCharacterDefinitions = [
  {
    "id": "acid_javelin_nasika",
    "name": "산성투창 나시카",
    "shortName": "나시카",
    "rarity": "SR",
    "race": "LIZARD_BEASTKIN",
    "tags": [
      "LIZARD_BEASTKIN",
      "ATTACK",
      "SHIELD_BYPASS",
      "SHIELD_BREAK"
    ],
    "description": "맞힌 뒤에 녹는지 확인하겠다고 너무 가까이 가는 산성 투창병",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 940,
      "swordEffectPct": 120,
      "shieldEffectPct": 90,
      "healEffectPct": 95,
      "manaGainPct": 105
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "acid_javelin_nasika_active"
    },
    "support": {
      "effectId": "acid_javelin_nasika_support"
    }
  },
  {
    "id": "apothecary_assistant_brixa",
    "name": "약제조수 브릭사",
    "shortName": "브릭사",
    "rarity": "R",
    "race": "DWARF",
    "tags": [
      "DWARF",
      "HEAL",
      "CLEANSE",
      "HEAL_MATCH"
    ],
    "description": "약 냄새로 사람 상태를 구분한다고 우기는 드워프 약제 담당",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 980,
      "swordEffectPct": 90,
      "shieldEffectPct": 95,
      "healEffectPct": 120,
      "manaGainPct": 105
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "apothecary_assistant_brixa_active"
    },
    "support": {
      "effectId": "apothecary_assistant_brixa_support"
    }
  },
  {
    "id": "apprentice_shieldbearer_riel",
    "name": "견습방패병 리엘",
    "shortName": "견습 리엘",
    "rarity": "R",
    "race": "ANGEL",
    "tags": [
      "ANGEL",
      "DEFENSE",
      "SHIELD",
      "BATTLE_START"
    ],
    "description": "성실하지만 성역 유지비 계산을 못 해서 매번 혼나는 견습 천사",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1120,
      "swordEffectPct": 90,
      "shieldEffectPct": 120,
      "healEffectPct": 90,
      "manaGainPct": 90
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "apprentice_shieldbearer_riel_active"
    },
    "support": {
      "effectId": "apprentice_shieldbearer_riel_support"
    }
  },
  {
    "id": "axe_soldier_karna",
    "name": "도끼병 카르나",
    "shortName": "도끼 카르나",
    "rarity": "R",
    "race": "DEMONKIN",
    "tags": [
      "DEMONKIN",
      "ATTACK",
      "SHIELD",
      "SWORD_MATCH"
    ],
    "description": "도끼질은 성실하지만 사과는 도끼등으로 하는 마족 전열병",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 920,
      "swordEffectPct": 115,
      "shieldEffectPct": 90,
      "healEffectPct": 90,
      "manaGainPct": 105
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "axe_soldier_karna_active"
    },
    "support": {
      "effectId": "axe_soldier_karna_support"
    }
  },
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
    "portraitAsset": "",
    "assets": {},
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
    "id": "convoy_captain_graka",
    "name": "호송대장 그라카",
    "shortName": "그라카",
    "rarity": "SR",
    "race": "ORC",
    "tags": [
      "ORC",
      "DEFENSE",
      "ESCORT",
      "BATTLE_START"
    ],
    "description": "의뢰인은 무조건 목적지까지 데려가지만 풍경은 전부 부서져 있음",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1150,
      "swordEffectPct": 90,
      "shieldEffectPct": 125,
      "healEffectPct": 90,
      "manaGainPct": 90
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "convoy_captain_graka_active"
    },
    "support": {
      "effectId": "convoy_captain_graka_support"
    }
  },
  {
    "id": "dagger_minha",
    "name": "단검꾼 미냐",
    "shortName": "미냐",
    "rarity": "R",
    "race": "CAT_BEASTKIN",
    "tags": [
      "CAT_BEASTKIN",
      "ATTACK",
      "SPEED",
      "SHIELD_BYPASS"
    ],
    "description": "강한 적은 피하고 약한 적은 끝까지 쫓는 얄미운 단검꾼",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 900,
      "swordEffectPct": 110,
      "shieldEffectPct": 90,
      "healEffectPct": 95,
      "manaGainPct": 115
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "dagger_minha_active"
    },
    "support": {
      "effectId": "dagger_minha_support"
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
    "portraitAsset": "",
    "assets": {},
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
    "portraitAsset": "",
    "assets": {},
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
    "id": "failed_saint_noael",
    "name": "실패작 성녀 노아엘",
    "shortName": "노아엘",
    "rarity": "SSR",
    "race": "ARTIFICIAL_ANGEL",
    "tags": [
      "ARTIFICIAL_ANGEL",
      "HEAL",
      "OVERHEAL",
      "CLEANSE"
    ],
    "description": "기도보다 임상기록이 익숙함",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1080,
      "swordEffectPct": 92,
      "shieldEffectPct": 102,
      "healEffectPct": 138,
      "manaGainPct": 112
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "failed_saint_noael_active"
    },
    "support": {
      "effectId": "failed_saint_noael_support"
    }
  },
  {
    "id": "fallen_legion_commander_morvain",
    "name": "몰락 군단장 모르베인",
    "shortName": "모르베인",
    "rarity": "SSR",
    "race": "DEMONKIN",
    "tags": [
      "DEMONKIN",
      "ATTACK",
      "MULTI_HIT",
      "SCHEDULED"
    ],
    "description": "군단을 잃고 사무소 공대를 얻음",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1120,
      "swordEffectPct": 118,
      "shieldEffectPct": 118,
      "healEffectPct": 108,
      "manaGainPct": 108
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "fallen_legion_commander_morvain_active"
    },
    "support": {
      "effectId": "fallen_legion_commander_morvain_support"
    }
  },
  {
    "id": "fortress_breaker_camilla",
    "name": "요새파괴 포격장교 카밀라",
    "shortName": "카밀라",
    "rarity": "SSR",
    "race": "DWARF",
    "tags": [
      "DWARF",
      "ATTACK",
      "ANTI_FORTRESS",
      "SHIELD_DESTROY"
    ],
    "description": "요새는 잘 부수지만 주변 민가도 지도에서 지워버리는 포격장교",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 940,
      "swordEffectPct": 132,
      "shieldEffectPct": 92,
      "healEffectPct": 96,
      "manaGainPct": 112
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "fortress_breaker_camilla_active"
    },
    "support": {
      "effectId": "fortress_breaker_camilla_support"
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
    "portraitAsset": "",
    "assets": {},
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
    "id": "mountain_gunner_berka",
    "name": "산악포수 베르카",
    "shortName": "베르카",
    "rarity": "R",
    "race": "BEAR_BEASTKIN",
    "tags": [
      "BEAR_BEASTKIN",
      "ATTACK",
      "SNIPER",
      "CHAIN"
    ],
    "description": "조준은 느리지만 한 번 맞히면 산적도 바위도 똑같이 눕힘",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 880,
      "swordEffectPct": 120,
      "shieldEffectPct": 85,
      "healEffectPct": 90,
      "manaGainPct": 110
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "mountain_gunner_berka_active"
    },
    "support": {
      "effectId": "mountain_gunner_berka_support"
    }
  },
  {
    "id": "reality_leak_knight_morgan",
    "name": "현실누수 처리기사 모르간",
    "shortName": "모르간",
    "rarity": "SR",
    "race": "UNDEAD",
    "tags": [
      "UNDEAD",
      "ATTACK",
      "SCHEDULED",
      "ACTIVE_LINK"
    ],
    "description": "새는 현실을 막는 데 익숙하지만 본인 기억도 가끔 새어 나감",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1040,
      "swordEffectPct": 105,
      "shieldEffectPct": 105,
      "healEffectPct": 105,
      "manaGainPct": 105
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "reality_leak_knight_morgan_active"
    },
    "support": {
      "effectId": "reality_leak_knight_morgan_support"
    }
  },
  {
    "id": "rogue_assault_akane",
    "name": "불량 돌격병 아카네",
    "shortName": "아카네",
    "rarity": "SR",
    "race": "ONI",
    "tags": [
      "ONI",
      "ATTACK",
      "HP_COST",
      "SWORD_MATCH"
    ],
    "description": "곤봉 들고 사고 치는 돌격조장",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 850,
      "swordEffectPct": 135,
      "shieldEffectPct": 80,
      "healEffectPct": 85,
      "manaGainPct": 115
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "rogue_assault_akane_active"
    },
    "support": {
      "effectId": "rogue_assault_akane_support"
    }
  },
  {
    "id": "siege_cook_borga",
    "name": "공성취사장 보르가",
    "shortName": "보르가",
    "rarity": "SR",
    "race": "ORC",
    "tags": [
      "ORC",
      "HEAL",
      "SHIELD",
      "HEAL_MATCH"
    ],
    "description": "국자가 무기고 냄비가 방패",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1040,
      "swordEffectPct": 105,
      "shieldEffectPct": 105,
      "healEffectPct": 105,
      "manaGainPct": 105
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "siege_cook_borga_active"
    },
    "support": {
      "effectId": "siege_cook_borga_support"
    }
  },
  {
    "id": "void_cleaner_nox",
    "name": "청소반장 녹스",
    "shortName": "녹스",
    "rarity": "SSR",
    "race": "VOIDKIN",
    "tags": [
      "VOIDKIN",
      "DISRUPT",
      "STATUS_PURGE",
      "DISPEL"
    ],
    "description": "쓰레기와 차원을 함께 빨아들임",
    "enabled": true,
    "starter": false,
    "contentVersion": 1,
    "allowedSlots": [
      "combatant",
      "support"
    ],
    "recommendedRole": "combatant",
    "portraitAsset": "",
    "assets": {},
    "stats": {
      "maxHp": 1010,
      "swordEffectPct": 118,
      "shieldEffectPct": 96,
      "healEffectPct": 100,
      "manaGainPct": 122
    },
    "defaultSlots": [],
    "combatant": {
      "skillId": "void_cleaner_nox_active"
    },
    "support": {
      "effectId": "void_cleaner_nox_support"
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
    "portraitAsset": "/generated/characters/yuria_counter_sword/portrait.cc5b73371bbf.webp",
    "assets": {
      "portraitUrl": "/generated/characters/yuria_counter_sword/portrait.cc5b73371bbf.webp",
      "portraitHash": "cc5b73371bbf"
    },
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
    "id": "acid_javelin_nasika_active",
    "kind": "active",
    "name": "용해 투창",
    "shortDescription": "적에게 200 피해를 주며 보호막의 22%를 무시한다. 보호막을 파괴하면 자신은 보호막 65를 얻는다.",
    "fullDescription": "적에게 200 피해를 주며 보호막의 22%를 무시한다. 보호막을 파괴하면 자신은 보호막 65를 얻는다.",
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
        "amount": 200,
        "travelMs": 500,
        "shieldBypassRatio": 0.22
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
            "type": "gain_shield",
            "target": "self",
            "amount": 65
          }
        ]
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "acid_javelin_nasika_support",
    "kind": "support",
    "name": "후속 투창",
    "shortDescription": "검을 5개 이상 맞추면 적에게 추가로 48 피해를 준다.",
    "fullDescription": "검을 5개 이상 맞추면 적에게 추가로 48 피해를 준다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "SWORD"
          },
          {
            "type": "matched_tile_count",
            "operator": "gte",
            "value": 5
          }
        ]
      }
    ],
    "effects": [
      {
        "type": "deal_damage",
        "target": "opponent",
        "amount": 48
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "apothecary_assistant_brixa_active",
    "kind": "active",
    "name": "응급 해독제",
    "shortDescription": "HP를 125 회복하고 해로운 상태 1개를 제거한다.",
    "fullDescription": "HP를 125 회복하고 해로운 상태 1개를 제거한다.",
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
        "target": "self",
        "amount": 125
      },
      {
        "type": "remove_status",
        "key": "removedDebuff",
        "target": "self",
        "filter": {
          "tag": "DEBUFF"
        },
        "maxCount": 1,
        "selection": "OLDEST_FIRST"
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "apothecary_assistant_brixa_support",
    "kind": "support",
    "name": "약향 감별",
    "shortDescription": "회복을 4개 이상 맞추면 HP를 28 추가로 회복한다.",
    "fullDescription": "회복을 4개 이상 맞추면 HP를 28 추가로 회복한다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 6000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "HEAL"
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
        "type": "heal",
        "target": "self",
        "amount": 28
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "apprentice_shieldbearer_riel_active",
    "kind": "active",
    "name": "견습 성역",
    "shortDescription": "보호막 170을 얻는다.",
    "fullDescription": "보호막 170을 얻는다.",
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
        "amount": 170
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "apprentice_shieldbearer_riel_support",
    "kind": "support",
    "name": "수호의 첫걸음",
    "shortDescription": "전투 시작 시 보호막 55를 얻는다.",
    "fullDescription": "전투 시작 시 보호막 55를 얻는다.",
    "trigger": {
      "type": "battle_started"
    },
    "cost": 0,
    "cooldownMs": 0,
    "oncePerBattle": true,
    "maxTriggersPerBattle": 1,
    "chainLimit": null,
    "conditions": [],
    "effects": [
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 55
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "axe_soldier_karna_active",
    "kind": "active",
    "name": "도끼등 돌파",
    "shortDescription": "적에게 120 피해를 주고 자신은 보호막 55를 얻는다.",
    "fullDescription": "적에게 120 피해를 주고 자신은 보호막 55를 얻는다.",
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
        "amount": 120
      },
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 55
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "axe_soldier_karna_support",
    "kind": "support",
    "name": "성실한 도끼질",
    "shortDescription": "검을 4개 이상 맞추면 적에게 추가로 28 피해를 준다.",
    "fullDescription": "검을 4개 이상 맞추면 적에게 추가로 28 피해를 준다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 7000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "SWORD"
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
        "type": "deal_damage",
        "target": "opponent",
        "amount": 28
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
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
    "id": "convoy_captain_graka_active",
    "kind": "active",
    "name": "목적지까지 생존",
    "shortDescription": "보호막 200을 얻고 HP를 65 회복한다.",
    "fullDescription": "보호막 200을 얻고 HP를 65 회복한다.",
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
        "amount": 200
      },
      {
        "type": "heal",
        "target": "self",
        "amount": 65
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "convoy_captain_graka_support",
    "kind": "support",
    "name": "출발 전 적재",
    "shortDescription": "전투 시작 시 보호막 72를 얻는다.",
    "fullDescription": "전투 시작 시 보호막 72를 얻는다.",
    "trigger": {
      "type": "battle_started"
    },
    "cost": 0,
    "cooldownMs": 0,
    "oncePerBattle": true,
    "maxTriggersPerBattle": 1,
    "chainLimit": null,
    "conditions": [],
    "effects": [
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 72
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "dagger_minha_active",
    "kind": "active",
    "name": "틈새 베기",
    "shortDescription": "적에게 145 피해를 주며 보호막의 15%를 무시한다.",
    "fullDescription": "적에게 145 피해를 주며 보호막의 15%를 무시한다.",
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
        "amount": 145,
        "travelMs": 400,
        "shieldBypassRatio": 0.15
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "dagger_minha_support",
    "kind": "support",
    "name": "약점 추격",
    "shortDescription": "검을 4개 이상 맞추면 적에게 추가로 28 피해를 준다.",
    "fullDescription": "검을 4개 이상 맞추면 적에게 추가로 28 피해를 준다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 7000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "SWORD"
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
        "type": "deal_damage",
        "target": "opponent",
        "amount": 28
      }
    ],
    "tags": [],
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
    "id": "failed_saint_noael_active",
    "kind": "active",
    "name": "불완전 기적 임상",
    "shortDescription": "HP를 265 회복하고 초과 회복량 전부를 최대 130의 보호막으로 전환하며 해로운 상태 1개를 제거한다.",
    "fullDescription": "HP를 265 회복하고 초과 회복량 전부를 최대 130의 보호막으로 전환하며 해로운 상태 1개를 제거한다.",
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
        "key": "miracleHeal",
        "target": "self",
        "amount": 265
      },
      {
        "type": "convert_overheal_to_shield",
        "key": "miracleShield",
        "target": "self",
        "conditions": [
          {
            "type": "effect_result_compare",
            "effectKey": "miracleHeal",
            "field": "overhealing",
            "operator": "gt",
            "value": 0
          }
        ],
        "ratio": 1,
        "maximum": 130
      },
      {
        "type": "remove_status",
        "key": "removedDebuff",
        "target": "self",
        "filter": {
          "tag": "DEBUFF"
        },
        "maxCount": 1,
        "selection": "OLDEST_FIRST"
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "failed_saint_noael_support",
    "kind": "support",
    "name": "부작용은 나중에",
    "shortDescription": "HP가 처음으로 25% 이하가 되면 HP를 175 회복하지만 5초 동안 받는 회복량이 20% 감소한다.",
    "fullDescription": "HP가 처음으로 25% 이하가 되면 HP를 175 회복하지만 5초 동안 받는 회복량이 20% 감소한다.",
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
        "type": "hp_threshold_crossed",
        "operator": "eq",
        "value": 25,
        "direction": "downward"
      }
    ],
    "effects": [
      {
        "type": "heal",
        "target": "self",
        "amount": 175
      },
      {
        "type": "apply_status",
        "target": "self",
        "statusId": "noael_aftereffect",
        "durationMs": 5000
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "fallen_legion_commander_morvain_active",
    "kind": "active",
    "name": "잔존 군단 총공세",
    "shortDescription": "보호막 100을 얻고 잔존 군단을 소환해 적에게 0.4초 간격으로 90 피해를 3회 준다.",
    "fullDescription": "보호막 100을 얻고 잔존 군단을 소환해 적에게 0.4초 간격으로 90 피해를 3회 준다.",
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
        "amount": 100
      },
      {
        "type": "deal_damage",
        "target": "opponent",
        "amount": 90
      },
      {
        "type": "schedule_effects",
        "delayMs": 400,
        "effects": [
          {
            "type": "deal_damage",
            "target": "opponent",
            "amount": 90
          }
        ]
      },
      {
        "type": "schedule_effects",
        "delayMs": 800,
        "effects": [
          {
            "type": "deal_damage",
            "target": "opponent",
            "amount": 90
          }
        ]
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "fallen_legion_commander_morvain_support",
    "kind": "support",
    "name": "후속대 투입",
    "shortDescription": "액티브 스킬을 사용한 뒤 1초 후 적에게 48 피해를 준다.",
    "fullDescription": "액티브 스킬을 사용한 뒤 1초 후 적에게 48 피해를 준다.",
    "trigger": {
      "type": "active_requested"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [],
    "effects": [
      {
        "type": "schedule_effects",
        "delayMs": 1000,
        "effects": [
          {
            "type": "deal_damage",
            "target": "opponent",
            "amount": 48
          }
        ]
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "fortress_breaker_camilla_active",
    "kind": "active",
    "name": "요새 삭제 포격",
    "shortDescription": "적의 보호막을 최대 180까지 직접 파괴한 뒤 155에 파괴한 보호막의 60%를 더한 피해를 준다.",
    "fullDescription": "적의 보호막을 최대 180까지 직접 파괴한 뒤 155에 파괴한 보호막의 60%를 더한 피해를 준다.",
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
        "type": "consume_resource",
        "key": "destroyedShield",
        "target": "opponent",
        "resource": "SHIELD",
        "amount": 180,
        "allowPartial": true,
        "canReduceHpBelowOne": false
      },
      {
        "type": "deal_damage",
        "target": "opponent",
        "amount": {
          "type": "ADD",
          "values": [
            {
              "type": "CONSTANT",
              "value": 155
            },
            {
              "type": "MULTIPLY",
              "values": [
                {
                  "type": "RESULT_VALUE",
                  "resultKey": "destroyedShield",
                  "path": "consumedAmount"
                },
                {
                  "type": "CONSTANT",
                  "value": 0.6
                }
              ]
            }
          ]
        }
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "fortress_breaker_camilla_support",
    "kind": "support",
    "name": "신축 요새 재철거",
    "shortDescription": "적이 한 번에 보호막을 80 이상 얻으면 그 보호막에 55 피해를 준다.",
    "fullDescription": "적이 한 번에 보호막을 80 이상 얻으면 그 보호막에 55 피해를 준다.",
    "trigger": {
      "type": "after_shield_gain"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [
      {
        "type": "expression_compare",
        "left": {
          "type": "EVENT_VALUE",
          "path": "shield.actualAmount"
        },
        "right": {
          "type": "CONSTANT",
          "value": 80
        },
        "operator": "gte"
      }
    ],
    "effects": [
      {
        "type": "consume_resource",
        "key": "supportShieldDamage",
        "target": "opponent",
        "resource": "SHIELD",
        "amount": 55,
        "allowPartial": true,
        "canReduceHpBelowOne": false
      }
    ],
    "tags": [],
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
    "id": "mountain_gunner_berka_active",
    "kind": "active",
    "name": "산악 관통탄",
    "shortDescription": "적에게 175 피해를 준다.",
    "fullDescription": "적에게 175 피해를 준다.",
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
        "amount": 175,
        "travelMs": 650
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "mountain_gunner_berka_support",
    "kind": "support",
    "name": "고지 사격",
    "shortDescription": "검 매치를 포함한 연쇄 3 이상 달성 시 적에게 32 피해를 준다.",
    "fullDescription": "검 매치를 포함한 연쇄 3 이상 달성 시 적에게 32 피해를 준다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "SWORD"
          },
          {
            "type": "expression_compare",
            "left": {
              "type": "EVENT_VALUE",
              "path": "chain.depth"
            },
            "right": {
              "type": "CONSTANT",
              "value": 3
            },
            "operator": "gte"
          }
        ]
      }
    ],
    "effects": [
      {
        "type": "deal_damage",
        "target": "opponent",
        "amount": 32
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "reality_leak_knight_morgan_active",
    "kind": "active",
    "name": "균열 봉합 실패",
    "shortDescription": "적에게 185 피해를 주고 2초 뒤 현실 균열이 65 피해를 추가로 준다.",
    "fullDescription": "적에게 185 피해를 주고 2초 뒤 현실 균열이 65 피해를 추가로 준다.",
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
        "amount": 185
      },
      {
        "type": "schedule_effects",
        "delayMs": 2000,
        "effects": [
          {
            "type": "deal_damage",
            "target": "opponent",
            "amount": 65
          }
        ]
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "reality_leak_knight_morgan_support",
    "kind": "support",
    "name": "누수 잔여막",
    "shortDescription": "액티브 스킬을 사용한 뒤 보호막 48을 얻는다.",
    "fullDescription": "액티브 스킬을 사용한 뒤 보호막 48을 얻는다.",
    "trigger": {
      "type": "active_requested"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [],
    "effects": [
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 48
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "rogue_assault_akane_active",
    "kind": "active",
    "name": "곤봉으로 해결",
    "shortDescription": "자신의 HP 50을 소모하고 적에게 238 피해를 준다.",
    "fullDescription": "자신의 HP 50을 소모하고 적에게 238 피해를 준다.",
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
        "type": "consume_resource",
        "key": "hpCost",
        "target": "self",
        "resource": "HP",
        "amount": 50,
        "allowPartial": false,
        "canReduceHpBelowOne": false
      },
      {
        "type": "deal_damage",
        "target": "opponent",
        "amount": 238,
        "travelMs": 500
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "rogue_assault_akane_support",
    "kind": "support",
    "name": "한 대 더",
    "shortDescription": "검을 4개 이상 맞추면 적에게 추가로 42 피해를 준다.",
    "fullDescription": "검을 4개 이상 맞추면 적에게 추가로 42 피해를 준다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 7000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "SWORD"
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
        "type": "deal_damage",
        "target": "opponent",
        "amount": 42
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "siege_cook_borga_active",
    "kind": "active",
    "name": "전투식 대용량 배식",
    "shortDescription": "HP를 165 회복하고 보호막 115를 얻는다.",
    "fullDescription": "HP를 165 회복하고 보호막 115를 얻는다.",
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
        "target": "self",
        "amount": 165
      },
      {
        "type": "gain_shield",
        "target": "self",
        "amount": 115
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "siege_cook_borga_support",
    "kind": "support",
    "name": "냄비뚜껑 엄호",
    "shortDescription": "회복을 4개 이상 맞추면 보호막 52를 얻는다.",
    "fullDescription": "회복을 4개 이상 맞추면 보호막 52를 얻는다.",
    "trigger": {
      "type": "match_group_resolved"
    },
    "cost": 0,
    "cooldownMs": 8000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": {
      "maxTriggers": 1
    },
    "conditions": [
      {
        "type": "all",
        "conditions": [
          {
            "type": "tile_type_is",
            "tileType": "HEAL"
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
        "type": "gain_shield",
        "target": "self",
        "amount": 52
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "void_cleaner_nox_active",
    "kind": "active",
    "name": "전면 차원청소",
    "shortDescription": "적의 강화 상태를 최대 2개, 자신의 약화 상태를 최대 1개 제거하고 적에게 95에 제거한 상태 하나당 60을 더한 피해를 준다.",
    "fullDescription": "적의 강화 상태를 최대 2개, 자신의 약화 상태를 최대 1개 제거하고 적에게 95에 제거한 상태 하나당 60을 더한 피해를 준다.",
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
        "type": "remove_status",
        "key": "enemyBuffs",
        "target": "opponent",
        "filter": {
          "tag": "BUFF"
        },
        "maxCount": 2,
        "selection": "OLDEST_FIRST"
      },
      {
        "type": "remove_status",
        "key": "selfDebuffs",
        "target": "self",
        "filter": {
          "tag": "DEBUFF"
        },
        "maxCount": 1,
        "selection": "OLDEST_FIRST"
      },
      {
        "type": "deal_damage",
        "target": "opponent",
        "amount": {
          "type": "ADD",
          "values": [
            {
              "type": "CONSTANT",
              "value": 95
            },
            {
              "type": "MULTIPLY",
              "values": [
                {
                  "type": "ADD",
                  "values": [
                    {
                      "type": "RESULT_VALUE",
                      "resultKey": "enemyBuffs",
                      "path": "removedCount"
                    },
                    {
                      "type": "RESULT_VALUE",
                      "resultKey": "selfDebuffs",
                      "path": "removedCount"
                    }
                  ]
                },
                {
                  "type": "CONSTANT",
                  "value": 60
                }
              ]
            }
          ]
        }
      }
    ],
    "tags": [],
    "contentVersion": 1,
    "enabled": true
  },
  {
    "id": "void_cleaner_nox_support",
    "kind": "support",
    "name": "잔여물 압축",
    "shortDescription": "자신 또는 적의 상태 효과가 제거될 때 마력 9를 얻는다.",
    "fullDescription": "자신 또는 적의 상태 효과가 제거될 때 마력 9를 얻는다.",
    "trigger": {
      "type": "status_expired"
    },
    "cost": 0,
    "cooldownMs": 5000,
    "oncePerBattle": false,
    "maxTriggersPerBattle": null,
    "chainLimit": null,
    "conditions": [],
    "effects": [
      {
        "type": "gain_mana",
        "target": "self",
        "amount": 9
      }
    ],
    "tags": [],
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
  "acid_javelin_nasika": {
    "maxHp": 940,
    "swordEffectPct": 120,
    "shieldEffectPct": 90,
    "healEffectPct": 95,
    "manaGainPct": 105
  },
  "apothecary_assistant_brixa": {
    "maxHp": 980,
    "swordEffectPct": 90,
    "shieldEffectPct": 95,
    "healEffectPct": 120,
    "manaGainPct": 105
  },
  "apprentice_shieldbearer_riel": {
    "maxHp": 1120,
    "swordEffectPct": 90,
    "shieldEffectPct": 120,
    "healEffectPct": 90,
    "manaGainPct": 90
  },
  "axe_soldier_karna": {
    "maxHp": 920,
    "swordEffectPct": 115,
    "shieldEffectPct": 90,
    "healEffectPct": 90,
    "manaGainPct": 105
  },
  "clarice_heavy_shield": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  },
  "convoy_captain_graka": {
    "maxHp": 1150,
    "swordEffectPct": 90,
    "shieldEffectPct": 125,
    "healEffectPct": 90,
    "manaGainPct": 90
  },
  "dagger_minha": {
    "maxHp": 900,
    "swordEffectPct": 110,
    "shieldEffectPct": 90,
    "healEffectPct": 95,
    "manaGainPct": 115
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
  "failed_saint_noael": {
    "maxHp": 1080,
    "swordEffectPct": 92,
    "shieldEffectPct": 102,
    "healEffectPct": 138,
    "manaGainPct": 112
  },
  "fallen_legion_commander_morvain": {
    "maxHp": 1120,
    "swordEffectPct": 118,
    "shieldEffectPct": 118,
    "healEffectPct": 108,
    "manaGainPct": 108
  },
  "fortress_breaker_camilla": {
    "maxHp": 940,
    "swordEffectPct": 132,
    "shieldEffectPct": 92,
    "healEffectPct": 96,
    "manaGainPct": 112
  },
  "marta_guard_captain": {
    "maxHp": 1000,
    "swordEffectPct": 100,
    "shieldEffectPct": 100,
    "healEffectPct": 100,
    "manaGainPct": 100
  },
  "mountain_gunner_berka": {
    "maxHp": 880,
    "swordEffectPct": 120,
    "shieldEffectPct": 85,
    "healEffectPct": 90,
    "manaGainPct": 110
  },
  "reality_leak_knight_morgan": {
    "maxHp": 1040,
    "swordEffectPct": 105,
    "shieldEffectPct": 105,
    "healEffectPct": 105,
    "manaGainPct": 105
  },
  "rogue_assault_akane": {
    "maxHp": 850,
    "swordEffectPct": 135,
    "shieldEffectPct": 80,
    "healEffectPct": 85,
    "manaGainPct": 115
  },
  "siege_cook_borga": {
    "maxHp": 1040,
    "swordEffectPct": 105,
    "shieldEffectPct": 105,
    "healEffectPct": 105,
    "manaGainPct": 105
  },
  "void_cleaner_nox": {
    "maxHp": 1010,
    "swordEffectPct": 118,
    "shieldEffectPct": 96,
    "healEffectPct": 100,
    "manaGainPct": 122
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
