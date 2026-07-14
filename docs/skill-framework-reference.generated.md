<!-- AUTO-GENERATED FILE. DO NOT EDIT. Run npm run content:docs. -->
# Skill Framework Capability Reference

This reference is generated from the current compiler allowlists, runtime registry, executor branches, trigger dispatch calls, status data, and custom command builder. It is descriptive output and is not a combat authority source.

## 1. Content package overview

Required files: `manifest.json`, `character.json`, `active.json`, `support.json`. Optional files: `presentation.json`, `server.ts`. Package pattern: `^[a-z][a-z0-9_]*$`. Schema/API versions: 1/1.

## 2. character.json

| JSON path | Type | Required | Validation | Runtime use |
| --- | --- | --- | --- | --- |
| $.activeAbilityId | string | yes | must equal active.json id | combatant ability lookup |
| $.allowedSlots | array<combatant\|support> | yes | all entries must be combatant or support | loadout validation |
| $.assets.portrait | relative PNG/JPEG/WebP path | no | package-local, <= 8 MiB, signature checked | compiled to hashed portrait URL only |
| $.combatStyle | non-empty string ID | yes | normalization-required; no dedicated compiler check | metadata only |
| $.description.details | string | yes | normalization-required; no dedicated compiler check | presentation metadata |
| $.description.summary | string | yes | normalization-required; no dedicated compiler check | CharacterDefinition.description |
| $.displayName | string | yes | normalization-required; runtime registry rejects missing name | display name |
| $.id | package ID | yes | must equal manifest and folder id | stable character ID |
| $.race | non-empty string | yes | explicit | metadata and tags |
| $.rarity | enum | yes | explicit | metadata only |
| $.role | enum | yes | explicit | content metadata |
| $.shortName | string | yes | normalization-required; runtime registry rejects missing shortName | compact display name |
| $.stats.healEffectPct | non-negative safe integer | yes | 100 is neutral | base HEAL tile only |
| $.stats.manaGainPct | non-negative safe integer | yes | 100 is neutral | base MANA tile only |
| $.stats.maxHp | positive safe integer | yes | explicit | combatant starting and maximum HP |
| $.stats.shieldEffectPct | non-negative safe integer | yes | 100 is neutral | base SHIELD tile only |
| $.stats.swordEffectPct | non-negative safe integer | yes | 100 is neutral | base SWORD tile only |
| $.supportAbilityId | string | yes | must equal support.json id | support ability lookup |
| $.tags | string[] | yes | normalization-required; runtime registry requires a non-empty array | metadata and HAS_TAG source tags where supplied |

Stats are taken only from the combatant slot. Percentage 100 is neutral. Board tile calculation is match size -> chain -> frenzy -> rounding -> character percentage -> existing modifiers. Ability fixed values are not automatically scaled.

## 3. active.json

| Field | Type | Required | Default/note |
| --- | --- | --- | --- |
| activationCondition | ConditionExpression | no |  |
| contentVersion | positive integer | no | 1 |
| copyPolicy | DENY_COPIED | no |  |
| displayName | string | yes |  |
| effects | EffectDefinition[] | yes |  |
| enabled | boolean | no | true |
| fullDescription | string | yes |  |
| id | stable lowercase identifier | yes |  |
| kind | ACTIVE\|SUPPORT | yes |  |
| manaCost | integer 0..100 | yes |  |
| presentationKey | string | no | Not explicitly rejected, but the current normalizer drops it; presentation integration is unavailable. |
| recursionPolicy | SAFE_DEFAULT | no |  |
| shortDescription | string | yes |  |
| tags | AbilityTag[] | no |  |


## 4. support.json

| Field | Type | Required | Default/note |
| --- | --- | --- | --- |
| activationCondition | ConditionExpression | no |  |
| battleLimit | null\|positive integer | yes |  |
| chainLimit | null\|{maxTriggers: positive integer} | yes |  |
| contentVersion | positive integer | no | 1 |
| cooldownMs | null\|non-negative integer | yes | 0 |
| copyPolicy | DENY_COPIED | no |  |
| displayName | string | yes |  |
| effects | EffectDefinition[] | yes |  |
| enabled | boolean | no | true |
| fullDescription | string | yes |  |
| id | stable lowercase identifier | yes |  |
| kind | ACTIVE\|SUPPORT | yes |  |
| presentationKey | string | no | Not explicitly rejected, but the current normalizer drops it; presentation integration is unavailable. |
| recursionPolicy | SAFE_DEFAULT | no |  |
| shortDescription | string | yes |  |
| tags | AbilityTag[] | no |  |
| trigger | TriggerDefinition | yes |  |


## 5. ValueExpression

| Name | Required fields | Returns | Runtime errors |
| --- | --- | --- | --- |
| ABS | `value` | number | none |
| ADD | `values` | number | none |
| CEIL | `value` | integer | none |
| CLAMP | `value`, `min`, `max` | number | none |
| CONSTANT | `value` | number\|boolean\|string | none |
| DIVIDE | `values` | number | `VALUE_DIVIDE_BY_ZERO`, `VALUE_NON_FINITE` |
| EVENT_VALUE | `path` | number\|boolean\|string | none |
| FLOOR | `value` | integer | none |
| MAX | `values` | number | none |
| MIN | `values` | number | none |
| MULTIPLY | `values` | number | none |
| RESOURCE | `target`, `resource` | number | none |
| RESULT_VALUE | `resultKey`, `path` | number\|boolean | none |
| ROUND | `value` | integer | none |
| RUNTIME_VALUE | `defaultValue`, `key`, `scope`, `target` | number | none |
| STAT | `target`, `stat` | number | none |
| SUBTRACT | `values` | number | none |

Division by zero throws `VALUE_DIVIDE_BY_ZERO`. Non-finite results throw. RESULT_VALUE keys must be declared earlier in the current effect scope. EVENT_VALUE availability is event-specific.

Runtime value keys match `^[a-z][a-zA-Z0-9_.-]{0,63}$`. Scopes: `ABILITY`, `BATTLE`, `CHAIN`, `STATUS`. Operations: `ADD`, `CLAMP`, `CLEAR`, `MAX`, `MIN`, `SET`, `SUBTRACT`. Missing reads require an explicit default expression. Battle/ability values live for the battle, status values are cleared after removal dispatch, and chain values are cleared when the chain completes. The store is part of the deterministic effect snapshot.

#### ABS

```json
{
  "type": "ABS",
  "value": {
    "type": "CONSTANT",
    "value": 2.4
  }
}
```

#### ADD

```json
{
  "type": "ADD",
  "values": [
    {
      "type": "CONSTANT",
      "value": 6
    },
    {
      "type": "CONSTANT",
      "value": 2
    }
  ]
}
```

#### CEIL

```json
{
  "type": "CEIL",
  "value": {
    "type": "CONSTANT",
    "value": 2.4
  }
}
```

#### CLAMP

```json
{
  "max": {
    "type": "CONSTANT",
    "value": 10
  },
  "min": {
    "type": "CONSTANT",
    "value": 0
  },
  "type": "CLAMP",
  "value": {
    "type": "CONSTANT",
    "value": 5
  }
}
```

#### CONSTANT

```json
{
  "type": "CONSTANT",
  "value": 180
}
```

#### DIVIDE

```json
{
  "type": "DIVIDE",
  "values": [
    {
      "type": "CONSTANT",
      "value": 6
    },
    {
      "type": "CONSTANT",
      "value": 2
    }
  ]
}
```

#### EVENT_VALUE

```json
{
  "path": "match.count",
  "type": "EVENT_VALUE"
}
```

#### FLOOR

```json
{
  "type": "FLOOR",
  "value": {
    "type": "CONSTANT",
    "value": 2.4
  }
}
```

#### MAX

```json
{
  "type": "MAX",
  "values": [
    {
      "type": "CONSTANT",
      "value": 6
    },
    {
      "type": "CONSTANT",
      "value": 2
    }
  ]
}
```

#### MIN

```json
{
  "type": "MIN",
  "values": [
    {
      "type": "CONSTANT",
      "value": 6
    },
    {
      "type": "CONSTANT",
      "value": 2
    }
  ]
}
```

#### MULTIPLY

```json
{
  "type": "MULTIPLY",
  "values": [
    {
      "type": "CONSTANT",
      "value": 6
    },
    {
      "type": "CONSTANT",
      "value": 2
    }
  ]
}
```

#### RESOURCE

```json
{
  "resource": "HP_RATIO",
  "target": "SELF",
  "type": "RESOURCE"
}
```

#### RESULT_VALUE

```json
{
  "path": "finalAmount",
  "resultKey": "previous",
  "type": "RESULT_VALUE"
}
```

#### ROUND

```json
{
  "type": "ROUND",
  "value": {
    "type": "CONSTANT",
    "value": 2.4
  }
}
```

#### RUNTIME_VALUE

```json
{
  "defaultValue": {
    "type": "CONSTANT",
    "value": 0
  },
  "key": "example.counter",
  "scope": "BATTLE",
  "target": "SELF",
  "type": "RUNTIME_VALUE"
}
```

#### STAT

```json
{
  "stat": "MAX_HP",
  "target": "SELF",
  "type": "STAT"
}
```

#### SUBTRACT

```json
{
  "type": "SUBTRACT",
  "values": [
    {
      "type": "CONSTANT",
      "value": 6
    },
    {
      "type": "CONSTANT",
      "value": 2
    }
  ]
}
```

## 6. ConditionExpression

| Name | Required fields | Optional fields | Failure policy |
| --- | --- | --- | --- |
| AND | `conditions` | none | Compiler validation errors are explicit. |
| COMPARE | `left`, `operator`, `right` | none | Compiler validation errors are explicit. |
| EVENT_SOURCE | `source` | none | Compiler validation errors are explicit. |
| EVENT_TYPE | `event` | none | Compiler validation errors are explicit. |
| FALSE | none | none | Compiler validation errors are explicit. |
| HAS_STATUS | `target`, `statusId` | `negated` | Compiler validation errors are explicit. |
| HAS_TAG | `source`, `tag` | none | Compiler validation errors are explicit. |
| NOT | `condition` | none | Compiler validation errors are explicit. |
| OR | `conditions` | none | Compiler validation errors are explicit. |
| RESULT_COMPARE | `resultKey`, `path`, `operator`, `value` | none | Compiler validation errors are explicit. |
| TRUE | none | none | Compiler validation errors are explicit. |

Operators: `EQ`, `GTE`, `GT`, `LTE`, `LT`, `NE`.

#### AND

```json
{
  "conditions": [
    {
      "type": "TRUE"
    },
    {
      "type": "FALSE"
    }
  ],
  "type": "AND"
}
```

#### COMPARE

```json
{
  "left": {
    "resource": "HP_RATIO",
    "target": "SELF",
    "type": "RESOURCE"
  },
  "operator": "LTE",
  "right": {
    "type": "CONSTANT",
    "value": 0.3
  },
  "type": "COMPARE"
}
```

#### EVENT_SOURCE

```json
{
  "source": "enemy_attack",
  "type": "EVENT_SOURCE"
}
```

#### EVENT_TYPE

```json
{
  "event": "BATTLE_STARTED",
  "type": "EVENT_TYPE"
}
```

#### FALSE

```json
{
  "type": "FALSE"
}
```

#### HAS_STATUS

```json
{
  "statusId": "damage_reduction",
  "target": "ENEMY",
  "type": "HAS_STATUS"
}
```

#### HAS_TAG

```json
{
  "source": "EVENT_SOURCE",
  "tag": "offense",
  "type": "HAS_TAG"
}
```

#### NOT

```json
{
  "condition": {
    "type": "FALSE"
  },
  "type": "NOT"
}
```

#### OR

```json
{
  "conditions": [
    {
      "type": "TRUE"
    },
    {
      "type": "FALSE"
    }
  ],
  "type": "OR"
}
```

#### RESULT_COMPARE

```json
{
  "operator": "EQ",
  "path": "shieldBroken",
  "resultKey": "previous",
  "type": "RESULT_COMPARE",
  "value": true
}
```

#### TRUE

```json
{
  "type": "TRUE"
}
```

## 7. Effect list

| Name | Support status | Required fields | Optional fields | Result paths | Notes |
| --- | --- | --- | --- | --- | --- |
| ADD_SHIELD | SUPPORTED | `amount` | `cap`, `condition`, `resultKey`, `scope`, `target` | `actualShieldGain`, `finalAmount`, `overcapAmount`, `requestedAmount`, `shieldAfter`, `shieldBefore` | scope currently normalizes only to chain_step. |
| APPLY_STATUS | SUPPORTED | `statusId` | `condition`, `durationMs`, `resultKey`, `target` | `currentStacks`, `previousStacks`, `statusApplied`, `statusId`, `statusRefreshed` |  |
| CLEAR_RUNTIME_FLAG | SUPPORTED | `flag` | `condition`, `resultKey` | `changed`, `existed`, `key`, `previousValue` |  |
| CONSUME_RESOURCE | SUPPORTED | `amount`, `resource` | `allowPartial`, `canReduceHpBelowOne`, `condition`, `resultKey`, `target` | `consumedAmount`, `finalAmount`, `remainingAmount`, `requestedAmount`, `resource`, `wasPartial` |  |
| CONVERT_OVERHEAL_TO_SHIELD | SUPPORTED | `ratio` | `condition`, `maximum`, `resultKey`, `target` | `actualShieldGain`, `finalAmount`, `requestedAmount` |  |
| CUSTOM | SUPPORTED | `handlerId` | `condition`, `parameters` | none |  |
| DAMAGE | SUPPORTED | `amount` | `condition`, `resultKey`, `shieldBypassPct`, `tags`, `target`, `travelMs` | `finalAmount`, `hpDamage`, `requestedAmount`, `shieldBroken`, `shieldDamage`, `targetDefeated` |  |
| HEAL | SUPPORTED | `amount` | `condition`, `resultKey`, `target` | `actualHealing`, `finalAmount`, `hpAfter`, `hpBefore`, `overhealing`, `requestedAmount` |  |
| IF | SUPPORTED | `condition`, `then` | `else` | none |  |
| MODIFY_EVENT | SUPPORTED | `operation`, `path`, `value` | `condition`, `resultKey` | `finalAmount`, `requestedAmount` |  |
| MODIFY_MANA | SUPPORTED | `amount` | `condition`, `resultKey`, `target` | `finalAmount`, `manaAfter`, `manaBefore`, `overflowAmount`, `requestedAmount` |  |
| REMOVE_STATUS | SUPPORTED | `statusId or filter` | `condition`, `maxCount`, `resultKey`, `selection`, `target` | `removedCount`, `removedStatusIds`, `removalReason` |  |
| SCHEDULE | SUPPORTED | `delayMs`, `effects` | `condition`, `target` | none |  |
| SET_RUNTIME_FLAG | SUPPORTED | `flag`, `value` | `condition`, `resultKey` | `changed`, `currentValue`, `existed`, `key`, `previousValue` |  |
| STORE_VALUE | SUPPORTED | `key`, `operation`, `scope` | `condition`, `maximum`, `minimum`, `resultKey`, `statusId`, `target`, `value` | `cleared`, `existed`, `finalAmount`, `key`, `nextValue`, `previousValue`, `scope` |  |

Only **SUPPORTED** entries have package validation, an executor path, and current production/fixture runtime evidence. **RUNTIME_PATH_PRESENT_UNVERIFIED** entries have validator and executor branches but no current runtime content/fixture evidence. Runtime-internal effects are listed only in the machine manifest.

### ADD_SHIELD

Status: **SUPPORTED**; runtime type: `gain_shield`.

```json
{
  "amount": {
    "type": "CONSTANT",
    "value": 50
  },
  "target": "SELF",
  "type": "ADD_SHIELD"
}
```

### APPLY_STATUS

Status: **SUPPORTED**; runtime type: `apply_status`.

```json
{
  "durationMs": 1000,
  "resultKey": "applied",
  "statusId": "damage_reduction",
  "target": "SELF",
  "type": "APPLY_STATUS"
}
```

### CLEAR_RUNTIME_FLAG

Status: **SUPPORTED**; runtime type: `consume_runtime_flag`.

```json
{
  "flag": "example.flag",
  "resultKey": "clearedFlag",
  "type": "CLEAR_RUNTIME_FLAG"
}
```

### CONSUME_RESOURCE

Status: **SUPPORTED**; runtime type: `consume_resource`.

```json
{
  "allowPartial": true,
  "amount": {
    "type": "CONSTANT",
    "value": 160
  },
  "canReduceHpBelowOne": false,
  "resource": "SHIELD",
  "resultKey": "shieldCost",
  "target": "SELF",
  "type": "CONSUME_RESOURCE"
}
```

### CONVERT_OVERHEAL_TO_SHIELD

Status: **SUPPORTED**; runtime type: `convert_overheal_to_shield`.

```json
{
  "condition": {
    "operator": "GT",
    "path": "overhealing",
    "resultKey": "heal",
    "type": "RESULT_COMPARE",
    "value": 0
  },
  "maximum": 50,
  "ratio": 0.5,
  "target": "SELF",
  "type": "CONVERT_OVERHEAL_TO_SHIELD"
}
```

### CUSTOM

Status: **SUPPORTED**; runtime type: `custom`.

```json
{
  "handlerId": "example_character.handler",
  "parameters": {
    "shield": 10
  },
  "type": "CUSTOM"
}
```

### DAMAGE

Status: **SUPPORTED**; runtime type: `deal_damage`.

```json
{
  "amount": {
    "type": "CONSTANT",
    "value": 180
  },
  "target": "ENEMY",
  "type": "DAMAGE"
}
```

### HEAL

Status: **SUPPORTED**; runtime type: `heal`.

```json
{
  "amount": {
    "type": "CONSTANT",
    "value": 100
  },
  "target": "SELF",
  "type": "HEAL"
}
```

### IF

Status: **SUPPORTED**; runtime type: `conditional`.

```json
{
  "condition": {
    "left": {
      "resource": "HP_RATIO",
      "target": "SELF",
      "type": "RESOURCE"
    },
    "operator": "LTE",
    "right": {
      "type": "CONSTANT",
      "value": 0.3
    },
    "type": "COMPARE"
  },
  "else": [],
  "then": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 120
      },
      "target": "SELF",
      "type": "HEAL"
    }
  ],
  "type": "IF"
}
```

### MODIFY_EVENT

Status: **SUPPORTED**; runtime type: `modify_event_amount`.

```json
{
  "operation": "MULTIPLY",
  "path": "damage.currentAmount",
  "resultKey": "modified",
  "type": "MODIFY_EVENT",
  "value": {
    "type": "CONSTANT",
    "value": 0.8
  }
}
```

### MODIFY_MANA

Status: **SUPPORTED**; runtime type: `gain_mana`.

```json
{
  "amount": {
    "type": "CONSTANT",
    "value": 10
  },
  "resultKey": "manaGain",
  "target": "SELF",
  "type": "MODIFY_MANA"
}
```

### REMOVE_STATUS

Status: **SUPPORTED**; runtime type: `remove_status`.

```json
{
  "statusId": "damage_reduction",
  "target": "SELF",
  "type": "REMOVE_STATUS"
}
```

### SCHEDULE

Status: **SUPPORTED**; runtime type: `schedule_effects`.

```json
{
  "delayMs": 250,
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 50
      },
      "target": "ENEMY",
      "type": "DAMAGE"
    }
  ],
  "type": "SCHEDULE"
}
```

### SET_RUNTIME_FLAG

Status: **SUPPORTED**; runtime type: `set_runtime_flag`.

```json
{
  "flag": "example.flag",
  "resultKey": "setFlag",
  "type": "SET_RUNTIME_FLAG",
  "value": true
}
```

### STORE_VALUE

Status: **SUPPORTED**; runtime type: `store_value`.

```json
{
  "key": "example.stored",
  "operation": "SET",
  "resultKey": "stored",
  "scope": "BATTLE",
  "type": "STORE_VALUE",
  "value": {
    "type": "CONSTANT",
    "value": 42
  }
}
```

## 8. Trigger events

| Event | Status | Runtime type | Available EVENT_VALUE paths |
| --- | --- | --- | --- |
| ACTIVE_USED | EMITTED_AND_SUPPORTED | active_requested | `ability.id`, `ability.kind`, `ability.manaCost`, `ability.manaSpent` |
| AFTER_DAMAGE | EMITTED_AND_SUPPORTED | after_damage | `damage.shieldBroken` |
| ATTACK_CREATED | TYPE_DEFINED_NOT_EMITTED | attack_created | none |
| BATTLE_STARTED | EMITTED_AND_SUPPORTED | battle_started | none |
| BEFORE_ATTACK_IMPACT | EMITTED_AND_SUPPORTED | before_attack_impact | `damage.currentAmount` |
| BEFORE_DAMAGE | TYPE_DEFINED_NOT_EMITTED | before_damage | none |
| CHAIN_STEP_RESOLVED | EMITTED_AND_SUPPORTED | chain_step_resolved | `chain.id`, `chain.isFinalStep`, `chain.matchCount`, `chain.stepIndex`, `chain.totalMatchedTiles` |
| DEFEATED | EMITTED_AND_SUPPORTED | battle_finished | none |
| HEALED | EMITTED_AND_SUPPORTED | after_heal | `heal.actualAmount`, `heal.hpAfter`, `heal.hpBefore`, `heal.overhealAmount`, `heal.requestedAmount` |
| HP_THRESHOLD_CROSSED | EMITTED_AND_SUPPORTED | hp_threshold_crossed | `hp.threshold` |
| SHIELD_BROKEN | EMITTED_AND_SUPPORTED | shield_broken | `damage.shieldBroken` |
| SHIELD_GAINED | EMITTED_AND_SUPPORTED | after_shield_gain | `shield.actualAmount`, `shield.after`, `shield.before`, `shield.overcapAmount`, `shield.requestedAmount` |
| STATUS_APPLIED | EMITTED_AND_SUPPORTED | status_applied | `status.applied`, `status.currentStacks`, `status.durationMs`, `status.id`, `status.previousStacks`, `status.refreshed` |
| STATUS_REMOVED | EMITTED_AND_SUPPORTED | status_expired | `status.id`, `status.previousStacks`, `status.removalReason`, `status.wasExpired` |
| TILE_MATCH_RESOLVED | EMITTED_AND_SUPPORTED | match_group_resolved | `chain.depth`, `match.count`, `match.tileType` |

`TYPE_DEFINED_NOT_EMITTED` events pass the current package validator but are not normal support-authoring capabilities because battle runtime does not dispatch them.

### ACTIVE_USED

Status: **EMITTED_AND_SUPPORTED**. Timing: after an active ability is accepted. Actor: active ability owner. Target: opponent.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "ACTIVE_USED"
  }
}
```

### AFTER_DAMAGE

Status: **EMITTED_AND_SUPPORTED**. Timing: after. Actor: attacker. Target: damaged participant.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "AFTER_DAMAGE"
  }
}
```

### ATTACK_CREATED

Status: **TYPE_DEFINED_NOT_EMITTED**. Timing: See canonical trigger emitter registry.. Actor: support owner. Target: event counterpart.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "ATTACK_CREATED"
  }
}
```

### BATTLE_STARTED

Status: **EMITTED_AND_SUPPORTED**. Timing: after countdown. Actor: each participant. Target: opponent.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "BATTLE_STARTED"
  }
}
```

### BEFORE_ATTACK_IMPACT

Status: **EMITTED_AND_SUPPORTED**. Timing: before impact (within 150ms). Actor: defender/support owner. Target: attacker.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "BEFORE_ATTACK_IMPACT"
  }
}
```

### BEFORE_DAMAGE

Status: **TYPE_DEFINED_NOT_EMITTED**. Timing: See canonical trigger emitter registry.. Actor: support owner. Target: event counterpart.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "BEFORE_DAMAGE"
  }
}
```

### CHAIN_STEP_RESOLVED

Status: **EMITTED_AND_SUPPORTED**. Timing: See canonical trigger emitter registry.. Actor: support owner. Target: event counterpart.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "CHAIN_STEP_RESOLVED"
  }
}
```

### DEFEATED

Status: **EMITTED_AND_SUPPORTED**. Timing: after result decided. Actor: each participant. Target: opponent.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "DEFEATED"
  }
}
```

### HEALED

Status: **EMITTED_AND_SUPPORTED**. Timing: See canonical trigger emitter registry.. Actor: support owner. Target: event counterpart.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "HEALED"
  }
}
```

### HP_THRESHOLD_CROSSED

Status: **EMITTED_AND_SUPPORTED**. Timing: after damage. Actor: damaged participant. Target: attacker.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "HP_THRESHOLD_CROSSED"
  }
}
```

### SHIELD_BROKEN

Status: **EMITTED_AND_SUPPORTED**. Timing: after damage. Actor: damaged participant. Target: attacker.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "SHIELD_BROKEN"
  }
}
```

### SHIELD_GAINED

Status: **EMITTED_AND_SUPPORTED**. Timing: after enemy actual shield gain is known. Actor: opposing support owner. Target: shield recipient.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "SHIELD_GAINED"
  }
}
```

### STATUS_APPLIED

Status: **EMITTED_AND_SUPPORTED**. Timing: See canonical trigger emitter registry.. Actor: support owner. Target: event counterpart.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "STATUS_APPLIED"
  }
}
```

### STATUS_REMOVED

Status: **EMITTED_AND_SUPPORTED**. Timing: after removal and before status runtime-value cleanup. Actor: both support owners. Target: status owner or counterpart.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "STATUS_REMOVED"
  }
}
```

### TILE_MATCH_RESOLVED

Status: **EMITTED_AND_SUPPORTED**. Timing: after base tile effects are applied. Actor: board owner. Target: opponent.

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "contentVersion": 1,
  "cooldownMs": 0,
  "copyPolicy": "DENY_COPIED",
  "displayName": "Example SUPPORT",
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "enabled": true,
  "fullDescription": "Validated by the current content compiler.",
  "id": "example_support",
  "kind": "SUPPORT",
  "recursionPolicy": "SAFE_DEFAULT",
  "shortDescription": "Generated valid example.",
  "tags": [
    "defense"
  ],
  "trigger": {
    "event": "TILE_MATCH_RESOLVED"
  }
}
```

## 9. Event payload paths

| Path | Type | Available emitted events | Note |
| --- | --- | --- | --- |
| ability.id | string | `ACTIVE_USED` |  |
| ability.kind | AbilityKind | `ACTIVE_USED` |  |
| ability.manaCost | integer | `ACTIVE_USED` |  |
| ability.manaSpent | integer | `ACTIVE_USED` |  |
| chain.depth | integer | `TILE_MATCH_RESOLVED` |  |
| chain.id | string | `CHAIN_STEP_RESOLVED` |  |
| chain.isFinalStep | boolean | `CHAIN_STEP_RESOLVED` |  |
| chain.matchCount | integer | `CHAIN_STEP_RESOLVED` |  |
| chain.stepIndex | integer | `CHAIN_STEP_RESOLVED` |  |
| chain.totalMatchedTiles | integer | `CHAIN_STEP_RESOLVED` |  |
| damage.currentAmount | number | `BEFORE_ATTACK_IMPACT` |  |
| damage.finalAmount | number | none | Validator accepts this path, but no emitted support trigger currently supplies finalAmount. |
| damage.shieldBroken | boolean | `AFTER_DAMAGE`, `SHIELD_BROKEN` |  |
| heal.actualAmount | number | `HEALED` |  |
| heal.hpAfter | number | `HEALED` |  |
| heal.hpBefore | number | `HEALED` |  |
| heal.overhealAmount | number | `HEALED` |  |
| heal.requestedAmount | number | `HEALED` |  |
| hp.threshold | number | `HP_THRESHOLD_CROSSED` |  |
| match.count | integer | `TILE_MATCH_RESOLVED` |  |
| match.tileType | TileType | `TILE_MATCH_RESOLVED` |  |
| shield.actualAmount | number | `SHIELD_GAINED` |  |
| shield.after | number | `SHIELD_GAINED` |  |
| shield.before | number | `SHIELD_GAINED` |  |
| shield.overcapAmount | number | `SHIELD_GAINED` |  |
| shield.requestedAmount | number | `SHIELD_GAINED` |  |
| status.applied | boolean | `STATUS_APPLIED` |  |
| status.currentStacks | integer | `STATUS_APPLIED` |  |
| status.durationMs | integer | `STATUS_APPLIED` |  |
| status.id | string | `STATUS_APPLIED`, `STATUS_REMOVED` |  |
| status.previousStacks | integer | `STATUS_APPLIED`, `STATUS_REMOVED` |  |
| status.refreshed | boolean | `STATUS_APPLIED` |  |
| status.removalReason | string enum | `STATUS_REMOVED` |  |
| status.wasExpired | boolean | `STATUS_REMOVED` |  |


## 10. Effect result paths

| Effect | Paths |
| --- | --- |
| ADD_SHIELD | `actualShieldGain`, `finalAmount`, `overcapAmount`, `requestedAmount`, `shieldAfter`, `shieldBefore` |
| APPLY_STATUS | `currentStacks`, `previousStacks`, `statusApplied`, `statusId`, `statusRefreshed` |
| CLEAR_RUNTIME_FLAG | `changed`, `existed`, `key`, `previousValue` |
| CONSUME_RESOURCE | `consumedAmount`, `finalAmount`, `remainingAmount`, `requestedAmount`, `resource`, `wasPartial` |
| CONVERT_OVERHEAL_TO_SHIELD | `actualShieldGain`, `finalAmount`, `requestedAmount` |
| DAMAGE | `finalAmount`, `hpDamage`, `requestedAmount`, `shieldBroken`, `shieldDamage`, `targetDefeated` |
| HEAL | `actualHealing`, `finalAmount`, `hpAfter`, `hpBefore`, `overhealing`, `requestedAmount` |
| MODIFY_EVENT | `finalAmount`, `requestedAmount` |
| MODIFY_MANA | `finalAmount`, `manaAfter`, `manaBefore`, `overflowAmount`, `requestedAmount` |
| REMOVE_STATUS | `removedCount`, `removedStatusIds`, `removalReason` |
| SET_RUNTIME_FLAG | `changed`, `currentValue`, `existed`, `key`, `previousValue` |
| STORE_VALUE | `cleared`, `existed`, `finalAmount`, `key`, `nextValue`, `previousValue`, `scope` |

Asynchronous DAMAGE results are available to deferred result conditions after impact. Result keys are lexical to the compiled effect tree; SCHEDULE receives a copied result store, while independent ability activations do not share result stores.

## 11. Target, Resource, Stat, and TileType

Targets: `ENEMY`, `SELF`. Tile types: `HEAL`, `MANA`, `SHIELD`, `SWORD`. Runtime stats: `MAX_HP`.

| Resource | Readable | Modifiable | Consumable |
| --- | --- | --- | --- |
| HP | true | true | true |
| HP_RATIO | true | false | false |
| MANA | true | true | true |
| SHIELD | true | true | true |


## 12. Status

| ID | Duration ms | Refresh | Max stacks | Modifiers |
| --- | --- | --- | --- | --- |
| damage_reduction | 4000 | refresh | 1 | incoming_damage_multiplier:0.75 |
| emergency_guard | 5000 | refresh | 1 | incoming_damage_multiplier:0.55 |
| exposed_flaw_charge | 6000 | refresh | 1 | shield_bypass_bonus:0.3 |
| healing_reduction | 7000 | refresh | 1 | healing_received_multiplier:0.55 |
| noael_aftereffect | 5000 | refresh | 1 | healing_received_multiplier:0.8 |
| r_damage_reduction_20 | 4000 | refresh | 1 | incoming_damage_multiplier:0.8 |
| r_healing_reduction_25 | 5000 | refresh | 1 | healing_received_multiplier:0.75 |
| r_next_incoming_damage_reduction_30 | 5000 | refresh | 1 | incoming_damage_multiplier:0.7 |

Statuses are serialized with source/target, stack count, and expiration. Status definition triggers exist in the runtime type but current status files contain no trigger-driven executor path of their own.

## 13. Custom handler

Available command builder methods: `addShield`, `applyStatus`, `clearRuntimeFlag`, `consumeResource`, `dealDamage`, `heal`, `modifyMana`, `removeStatus`, `schedule`, `setRuntimeFlag`, `storeValue`. Handlers are synchronous, receive readonly cloned battle views and seeded RNG, return commands, and may return JSON-only namespaced state patches. This is trusted internal build-time code, not a sandbox. Direct mutation, async work, timers, filesystem, network, database, and environment access are forbidden by contract. The return type declares presentationEvents, but the current executor ignores that field.

## 14. Recursion prevention

Origin fields: `eventId`, `rootEventId`, `parentEventId`, `sourceCharacterId`, `sourceAbilityId`, `originType`, `generationDepth`, `canTriggerSupport`, `canBeCopied`, `canBeConverted`. Maximum depth: 8. Copy/conversion metadata exists, but package copy/conversion primitives do not.

## 15. Snapshot rules

Scheduled origin, statuses, cooldowns, once/battle counts, chain counts, runtime flags, custom JSON state, combat stats, and RNG state are serialized. Restoration uses snapshot combat stats and does not re-read current registry stats.

## 16. Valid examples

### consumedShieldDamage

Validator: **PASSED**

```json
{
  "effects": [
    {
      "allowPartial": true,
      "amount": {
        "type": "CONSTANT",
        "value": 160
      },
      "canReduceHpBelowOne": false,
      "resource": "SHIELD",
      "resultKey": "shieldCost",
      "target": "SELF",
      "type": "CONSUME_RESOURCE"
    },
    {
      "amount": {
        "type": "ADD",
        "values": [
          {
            "type": "CONSTANT",
            "value": 150
          },
          {
            "type": "MULTIPLY",
            "values": [
              {
                "path": "consumedAmount",
                "resultKey": "shieldCost",
                "type": "RESULT_VALUE"
              },
              {
                "type": "CONSTANT",
                "value": 1.2
              }
            ]
          }
        ]
      },
      "target": "ENEMY",
      "type": "DAMAGE"
    }
  ],
  "manaCost": 100
}
```

### customHandler

Validator: **PASSED**

```json
{
  "effects": [
    {
      "handlerId": "example_character.handler",
      "parameters": {
        "shield": 10
      },
      "type": "CUSTOM"
    }
  ],
  "manaCost": 100
}
```

### eventModification

Validator: **PASSED**

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "cooldownMs": 0,
  "effects": [
    {
      "operation": "MULTIPLY",
      "path": "damage.currentAmount",
      "resultKey": "modified",
      "type": "MODIFY_EVENT",
      "value": {
        "type": "CONSTANT",
        "value": 0.8
      }
    }
  ],
  "trigger": {
    "event": "BEFORE_ATTACK_IMPACT"
  }
}
```

### healAndShield

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 100
      },
      "target": "SELF",
      "type": "HEAL"
    },
    {
      "amount": {
        "type": "CONSTANT",
        "value": 50
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "manaCost": 100
}
```

### hpConditional

Validator: **PASSED**

```json
{
  "effects": [
    {
      "condition": {
        "left": {
          "resource": "HP_RATIO",
          "target": "SELF",
          "type": "RESOURCE"
        },
        "operator": "LTE",
        "right": {
          "type": "CONSTANT",
          "value": 0.3
        },
        "type": "COMPARE"
      },
      "else": [],
      "then": [
        {
          "amount": {
            "type": "CONSTANT",
            "value": 120
          },
          "target": "SELF",
          "type": "HEAL"
        }
      ],
      "type": "IF"
    }
  ],
  "manaCost": 100
}
```

### manaModification

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 10
      },
      "resultKey": "manaGain",
      "target": "SELF",
      "type": "MODIFY_MANA"
    }
  ],
  "manaCost": 0
}
```

### overhealConversion

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 100
      },
      "resultKey": "heal",
      "target": "SELF",
      "type": "HEAL"
    },
    {
      "condition": {
        "operator": "GT",
        "path": "overhealing",
        "resultKey": "heal",
        "type": "RESULT_COMPARE",
        "value": 0
      },
      "maximum": 50,
      "ratio": 0.5,
      "target": "SELF",
      "type": "CONVERT_OVERHEAL_TO_SHIELD"
    }
  ],
  "manaCost": 100
}
```

### runtimeFlags

Validator: **PASSED**

```json
{
  "effects": [
    {
      "flag": "example.flag",
      "resultKey": "setFlag",
      "type": "SET_RUNTIME_FLAG",
      "value": true
    },
    {
      "flag": "example.flag",
      "resultKey": "clearedFlag",
      "type": "CLEAR_RUNTIME_FLAG"
    }
  ],
  "manaCost": 100
}
```

### scheduledFollowup

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 100
      },
      "target": "ENEMY",
      "type": "DAMAGE"
    },
    {
      "delayMs": 250,
      "effects": [
        {
          "amount": {
            "type": "CONSTANT",
            "value": 50
          },
          "target": "ENEMY",
          "type": "DAMAGE"
        }
      ],
      "type": "SCHEDULE"
    }
  ],
  "manaCost": 100
}
```

### shieldBrokenResult

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 180
      },
      "resultKey": "mainHit",
      "target": "ENEMY",
      "type": "DAMAGE"
    },
    {
      "condition": {
        "operator": "EQ",
        "path": "shieldBroken",
        "resultKey": "mainHit",
        "type": "RESULT_COMPARE",
        "value": true
      },
      "else": [],
      "then": [
        {
          "amount": {
            "type": "CONSTANT",
            "value": 50
          },
          "target": "SELF",
          "type": "ADD_SHIELD"
        }
      ],
      "type": "IF"
    }
  ],
  "manaCost": 100
}
```

### shieldBrokenSupport

Validator: **PASSED**

```json
{
  "battleLimit": null,
  "chainLimit": null,
  "cooldownMs": 9000,
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 75
      },
      "target": "ENEMY",
      "type": "DAMAGE"
    }
  ],
  "trigger": {
    "event": "SHIELD_BROKEN"
  }
}
```

### shieldBypassAttack

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 180
      },
      "resultKey": "hit",
      "shieldBypassPct": {
        "type": "CONSTANT",
        "value": 30
      },
      "target": "ENEMY",
      "type": "DAMAGE"
    }
  ],
  "manaCost": 100
}
```

### simpleActiveDamage

Validator: **PASSED**

```json
{
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 180
      },
      "target": "ENEMY",
      "type": "DAMAGE"
    }
  ],
  "manaCost": 100
}
```

### statusApplyAndRemove

Validator: **PASSED**

```json
{
  "effects": [
    {
      "durationMs": 1000,
      "resultKey": "applied",
      "statusId": "damage_reduction",
      "target": "SELF",
      "type": "APPLY_STATUS"
    },
    {
      "statusId": "damage_reduction",
      "target": "SELF",
      "type": "REMOVE_STATUS"
    }
  ],
  "manaCost": 100
}
```

### storedValue

Validator: **PASSED**

```json
{
  "effects": [
    {
      "key": "example.stored",
      "operation": "SET",
      "resultKey": "stored",
      "scope": "BATTLE",
      "type": "STORE_VALUE",
      "value": {
        "type": "CONSTANT",
        "value": 42
      }
    },
    {
      "amount": {
        "defaultValue": {
          "type": "CONSTANT",
          "value": 0
        },
        "key": "example.stored",
        "scope": "BATTLE",
        "target": "SELF",
        "type": "RUNTIME_VALUE"
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "manaCost": 100
}
```

### swordFourSupport

Validator: **PASSED**

```json
{
  "battleLimit": null,
  "chainLimit": {
    "maxTriggers": 1
  },
  "cooldownMs": 0,
  "effects": [
    {
      "amount": {
        "type": "CONSTANT",
        "value": 40
      },
      "target": "SELF",
      "type": "ADD_SHIELD"
    }
  ],
  "trigger": {
    "event": "TILE_MATCH_RESOLVED",
    "filter": {
      "conditions": [
        {
          "left": {
            "path": "match.tileType",
            "type": "EVENT_VALUE"
          },
          "operator": "EQ",
          "right": {
            "type": "CONSTANT",
            "value": "SWORD"
          },
          "type": "COMPARE"
        },
        {
          "left": {
            "path": "match.count",
            "type": "EVENT_VALUE"
          },
          "operator": "GTE",
          "right": {
            "type": "CONSTANT",
            "value": 4
          },
          "type": "COMPARE"
        }
      ],
      "type": "AND"
    }
  }
}
```

## 17. Currently unsupported

| Feature | Status | Required/missing |
| --- | --- | --- |
| Active/support automatic stat scaling | UNSUPPORTED_SCHEMA | none |
| BEFORE_DEFEAT and preventDefeat | ENGINE_EVENT_REQUIRED | none |
| Time rewind | ENGINE_PRIMITIVE_REQUIRED | none |
| Active or tile-effect copy primitive | METADATA_ONLY_NO_PRIMITIVE | none |
| Damage/heal event conversion | METADATA_ONLY_NO_PRIMITIVE | none |
| Excess shield persistence | UNSUPPORTED_SCHEMA | none |
| External user TypeScript or Lua/QuickJS/WASM | FORBIDDEN | none |
| Arbitrary loops or dynamic function execution | FORBIDDEN | none |
| Custom handler file system, network, database, or environment access | FORBIDDEN | none |
| Recent tile history in custom state | CUSTOM_HANDLER_POSSIBLE | `TILE_MATCH_RESOLVED` |


## 18. New character checklist

1. Create a package folder whose name matches manifest.id.
2. Add manifest.json, character.json, active.json, and support.json.
3. Add presentation.json or trusted server.ts only when required.
4. Run `npm run content:generate` and `npm run content:docs`.
5. Run `npm run content:check` and the test suite before build.
