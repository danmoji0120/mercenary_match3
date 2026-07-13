# Character Package & Skill Framework 0.2

## 목적과 권위 경계

캐릭터 콘텐츠의 원본은 `content/characters/<package-id>` 아래의 구조화된 JSON이다. 설명문은 표시 전용이며 판정에 사용하지 않는다. 콘텐츠 컴파일러가 JSON을 검증하고 기존 서버 권위 `ContentRegistry`와 `BattleEffectEngine`이 소비하는 정규화 정의를 생성한다. 클라이언트는 계정 응답과 전투 이벤트의 메타데이터 및 연출 키만 사용하며 피해, 회복, 상태, 승패를 결정하지 않는다.

기존 Trigger dispatch, condition evaluation, effect executor, status/cooldown runtime, scheduled queue, effect result 참조 및 Snapshot 구조를 유지한다. 새 스키마는 이 런타임 정의로 변환되는 앞단 계약이지 두 번째 전투 엔진이 아니다.

## 패키지 구조

```text
content/characters/yuria_counter_sword/
├─ manifest.json
├─ character.json
├─ active.json
├─ support.json
├─ presentation.json  # 선택 사항
└─ server.ts          # 신뢰된 내부 모듈만 선택 사항
```

`manifest.json`의 `id`와 폴더명은 같아야 하며 `^[a-z][a-z0-9_]*$`를 따른다. `schemaVersion`과 `engineApiVersion`은 현재 모두 `1`이다. 선언 경로는 패키지 내부 상대 경로만 허용하며 절대 경로와 `..`는 거부한다. 선언하지 않은 실행 파일은 로드하지 않는다.

필수 manifest 필드는 `id`, `schemaVersion`, `engineApiVersion`, `characterFile`, `activeFile`, `supportFile`이다. `presentationFile`과 `serverModule`은 선택 사항이다.

## character.json

안정적인 `id`는 표시 이름과 분리한다. `displayName`, `shortName`, `rarity`, `race`, `role`, `combatStyle`, `stats`, `activeAbilityId`, `supportAbilityId`, `tags`, `description`을 정의한다. 계정 및 편성 호환 필드인 `enabled`, `starter`, `contentVersion`, `allowedSlots`, `recommendedRole`, `portraitAsset`, `defaultSlots`도 함께 정규화된다.

- rarity: `R | SR | SSR | EX`
- role: `ATTACK | DEFENSE | HEAL | DISRUPT | SUPPORT`
- `maxHp`: 양의 정수
- `swordEffectPct`, `shieldEffectPct`, `healEffectPct`, `manaGainPct`: 정수이며 `100`이 중립 배율
- race와 combatStyle: 비어 있지 않은 확장 가능한 문자열 ID

0.2의 스타터는 기존 전역 전투 수치를 보존하기 위해 모두 HP 1000과 중립 배율 100으로 이관됐다. 0.3부터 정규화된 `CharacterDefinition.stats`가 메인 전투원의 시작 HP와 기본 타일 효과에 적용되며, 스타터 5명의 중립 수치는 기존 결과를 그대로 유지한다.

## 액티브와 지원 능력

공통 필드는 `id`, `kind`, `displayName`, `shortDescription`, `fullDescription`, `effects`, 선택적 `tags`, `presentationKey`, `copyPolicy`, `recursionPolicy`이다.

- 액티브: `kind: ACTIVE`, 정수 `manaCost`
- 지원: `kind: SUPPORT`, 구조화된 `trigger`, `cooldownMs`, `battleLimit`, `chainLimit`
- cooldown은 `null` 또는 0 이상 정수, battleLimit은 `null` 또는 양의 정수
- 지원 filter와 activationCondition은 ConditionExpression이다.

현재 canonical trigger는 `ACTIVE_USED`, `BATTLE_STARTED`, `TILE_MATCH_RESOLVED`, `CHAIN_STEP_RESOLVED`, `ATTACK_CREATED`, `BEFORE_ATTACK_IMPACT`, `BEFORE_DAMAGE`, `AFTER_DAMAGE`, `SHIELD_GAINED`, `SHIELD_BROKEN`, `HEALED`, `HP_THRESHOLD_CROSSED`, `STATUS_APPLIED`, `STATUS_REMOVED`, `DEFEATED`이다. 컴파일러는 실제 기존 TriggerType으로 명시적으로 변환한다.

## ValueExpression

지원 타입은 다음과 같다.

- `CONSTANT`
- `STAT` (`MAX_HP`)
- `RESOURCE` (`HP`, `HP_RATIO`, `SHIELD`, `MANA`)
- `EVENT_VALUE`
- `RESULT_VALUE`
- `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `MIN`, `MAX`
- `CLAMP`, `ABS`, `FLOOR`, `CEIL`, `ROUND`

resultKey는 앞에서 실행된 효과만 참조할 수 있다. 컴파일러가 상수 0 나눗셈, 알려지지 않은 event/result path, 선언 전 resultKey를 거부한다. 런타임 분모가 0이 되면 `VALUE_DIVIDE_BY_ZERO`로 명시적으로 실패하며 NaN과 Infinity도 거부한다. 표현식의 `FLOOR`, `CEIL`, `ROUND`만 중간 반올림을 수행한다. 피해·회복·보호막의 최종 반올림은 기존 executor의 규칙을 유지한다.

## ConditionExpression

지원 타입은 `TRUE`, `FALSE`, `COMPARE`, `AND`, `OR`, `NOT`, `HAS_STATUS`, `HAS_TAG`, `EVENT_TYPE`, `EVENT_SOURCE`, `RESULT_COMPARE`이다. 비교 연산자는 `EQ`, `NE`, `GT`, `GTE`, `LT`, `LTE`이다. 조건 경로나 타입 오류는 조용히 false가 되지 않으며 컴파일 또는 명시적 런타임 오류가 된다.

## EffectDefinition

0.2에서 지원하는 canonical 효과는 다음과 같다.

- `DAMAGE`, `HEAL`, `ADD_SHIELD`, `MODIFY_MANA`
- `APPLY_STATUS`, `REMOVE_STATUS`
- `IF`, `SCHEDULE`
- `SET_RUNTIME_FLAG`, `CLEAR_RUNTIME_FLAG`
- `CONSUME_RESOURCE`, `STORE_VALUE`, `MODIFY_EVENT`
- `CONVERT_OVERHEAL_TO_SHIELD`
- `CUSTOM`

이들은 각각 기존 `deal_damage`, `heal`, `gain_shield`, `gain_mana`, 상태, conditional, scheduled effect, runtime flag 및 result store executor에 연결된다. 상태 refresh, cooldown, once-per-battle, battle cap, chain scope cap, charge, 초과 회복 전환과 보호막 무시는 기존 primitive를 계속 사용한다.

## resultKey

효과의 `resultKey`는 해당 효과 결과를 저장한다. 이후 `RESULT_VALUE`와 `RESULT_COMPARE`가 `shieldDamage`, `hpDamage`, `actualHealing`, `overhealing`, `actualShieldGain`, `shieldBroken`, `consumedAmount` 같은 허용 경로를 참조할 수 있다. 같은 키 중복과 앞선 선언이 없는 참조는 빌드 전에 실패한다.

## 커스텀 서버 모듈

`server.ts`는 저장소에 포함되고 빌드되는 신뢰된 내부 캐릭터만 사용할 수 있다. 외부 업로드, 런타임 경로 import, eval, vm, 스크립트 문자열 실행은 없다. 컴파일러가 `custom-handler-registry.generated.ts`에 정적 import를 만든다.

모듈은 `CharacterServerModule`을 export하고 각 `CustomAbilityHandler`는 동기 `execute`로 `BattleCommand[]`와 선택적 JSON `statePatch`만 반환한다. command builder는 damage, heal, shield, mana, resource consumption, status, schedule, runtime flag, value store를 기존 executor 정의로 생성한다. 핸들러는 전투 객체를 받지 않고 동결된 actor/enemy read view, trigger, result, flag, custom state, seeded RNG와 command builder만 받는다.

금지 API 및 상태:

- Promise/async 반환
- 전투 상태 직접 mutation
- `Math.random`, `Date.now`, timer 기반 판정
- 파일, DB, HTTP, 환경 변수 또는 전역 mutable state 접근
- 함수, Date, Map, Set, class instance, Promise, 순환 참조, NaN/Infinity statePatch

custom state 키는 반드시 캐릭터 namespace를 사용한다. 상태는 `EffectRuntimeSnapshot.customState` 및 내부 `EffectEngineState` 직렬화에 포함되며 복원 시 JSON 호환성을 다시 검사한다.

## 이벤트 출처와 재귀 안전성

생성 효과는 `eventId`, `rootEventId`, `parentEventId`, `sourceCharacterId`, `sourceAbilityId`, `originType`, `generationDepth`, `canTriggerSupport`, `canBeCopied`, `canBeConverted`를 가진다. 최대 깊이는 `MAX_EFFECT_GENERATION_DEPTH` 8이다.

- copied 효과는 기본적으로 다시 copy할 수 없다.
- converted 효과는 기본적으로 다시 convert할 수 없다.
- 같은 source ability는 자신의 root chain에서 지원 발동할 수 없다.
- scheduled/custom child는 rootEventId를 유지한다.
- 초과 깊이와 금지된 재생성은 구조화된 서버 오류로 거부한다.
- scheduled Snapshot과 내부 상태 직렬화가 origin metadata를 보존한다.

## presentation.json

animation, sound, cut-in, result label, screen effect, icon 키만 둔다. damage/heal/condition/effects/RNG/winner 같은 판정 필드는 컴파일러가 거부한다. 파일이 없으면 기존 공통 연출과 능력 이름을 사용한다.

## 생성 파일 정책

생성 위치는 `apps/server/src/generated`이며 다음 파일을 Git에 포함한다.

- `character-registry.generated.ts`
- `custom-handler-registry.generated.ts`
- `normalized-content.generated.json`
- `content-report.generated.json`

폴더명 정렬, 안정적인 object key 정렬, 고정 포맷을 사용하며 시간, 절대 경로, 랜덤 값을 기록하지 않는다. 개발, typecheck, test, build 전에 `content:generate`가 실행된다. `content:check`는 임시 폴더에 재생성해 저장된 파일과 byte 단위로 비교한다.

## 명령과 새 캐릭터 추가 절차

```bash
npm run content:validate
npm run content:generate
npm run content:check
```

현재 validator와 runtime executor/dispatcher를 대조한 정확한 기능 목록은 [자동 생성 스킬 프레임워크 참조](skill-framework-reference.generated.md)를 확인한다. 콘텐츠 스키마나 실행 경로를 변경한 뒤에는 `npm run content:docs`로 JSON·Markdown 참조를 갱신하고, `npm run content:docs:check` 또는 통합된 `npm run content:check`로 stale 결과를 검사한다. 생성 문서는 설명용 산출물이며 전투 판정의 입력으로 사용하지 않는다.

## Character Stats Runtime 0.3

`character.json.stats` is normalized into `CharacterDefinition.stats`. The combatant slot is the only board owner in the current one-combatant loadout. Support-slot stats are preserved as character metadata but do not contribute to HP or board effects.

- `maxHp` sets both starting HP and the healing cap.
- `swordEffectPct` scales damage produced by sword tile matches.
- `shieldEffectPct` scales shield produced by shield tile matches.
- `healEffectPct` scales healing produced by heal tile matches.
- `manaGainPct` scales mana produced by mana tile matches.
- Percentage value `100` is exactly neutral. Values are non-negative safe integers.

The calculation order is the existing match-size formula, chain multiplier, frenzy multiplier, one integer rounding in `effectFor`, then `applyPercentage(rawTileAmount, statPercentage)`. Existing outgoing/incoming damage, shield gain, healing received, caps, statuses, logs, and presentation processing run after that boundary. `applyPercentage` uses `Math.round(baseAmount * percentage / 100)` and rejects negative, non-finite, or unsafe results.

Character stat percentages affect only the base effects produced by board tile matches. Ability effects use their declared values unless an ability explicitly defines scaling in a future schema. Active, support, status, scheduled, counter, copied, converted, and custom-command effects therefore receive no automatic character-stat multiplier.

At battle creation, `CharacterRegistry.snapshot` copies the combatant stats into `BattleLoadoutSnapshot` schema version 2. `BattleParticipant.combatStats` is an immutable numeric copy. Reconnect and server runtime restoration use the snapshot copy and never re-read current registry stats. Version-one loadout/runtime snapshots without combat stats migrate to `LEGACY_DEFAULT_COMBATANT_STATS` (HP 1000 and all percentages 100); unsupported or invalid snapshots fail explicitly. A restored version-two snapshot must have matching `maxHp` and valid HP bounds.

The non-neutral stats fixtures under `apps/server/tests/fixtures` are test-only and are not generated into the production character registry. Explicit ability scaling, equipment, levels, support-stat aggregation, and team synergy remain outside this milestone.

1. `content/characters` 아래에 ID와 같은 폴더를 만든다.
2. manifest를 작성한다.
3. character를 작성한다.
4. active와 support를 작성한다.
5. 필요할 때만 presentation을 작성한다.
6. 범용 primitive로 불가능한 신뢰된 내부 콘텐츠만 server module을 작성한다.
7. `npm run content:check`, 테스트, 빌드를 실행한다.

향후 엑셀 변환기는 이 canonical JSON 패키지를 출력하고 같은 compiler API를 호출해야 한다. 엑셀 자체를 전투 런타임 입력으로 사용하지 않는다.

## 현재 미지원 범위

221명 자동 변환, 외부 사용자 모드, 업로드 TypeScript, 범용 스크립트 언어, BB 패배 유예, 액티브 복제, 시간 되감기, 피해·회복 변환, 가챠, 성장, 장비는 구현하지 않았다. 테스트 fixture의 custom character는 운영 generated registry와 계정 캐릭터 목록에 포함되지 않는다.
