import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterDefinition, MatchResolution, TileType, UserLoadout } from '@mercenary/shared';
import { Battle, createParticipant } from '../src/battle';
import { CharacterRegistry, DEFAULT_LOADOUT, loadCharacterRegistry } from '../src/character-registry';
import { ContentRegistry } from '../src/content-registry';
import type { AbilityDefinition } from '../src/effect-types';

const fixture = <T>(name: string) => JSON.parse(readFileSync(path.resolve('apps/server/tests/fixtures', name), 'utf8')) as T;
function registryWithFixture() { const production = loadCharacterRegistry(); const content = new ContentRegistry([...production.content.abilities.values(), fixture<AbilityDefinition>('test_generic_strike.ability.json'), fixture<AbilityDefinition>('test_generic_mana_support.ability.json')], [...production.content.statuses.values()]); return new CharacterRegistry([...production.all, fixture<CharacterDefinition>('test_generic_squire.character.json')], content) }
const hooks = { snapshot: () => undefined, event: () => undefined, ended: () => undefined };
const loadout = (combatantCharacterId: string, supportCharacterId1: string, supportCharacterId2: string): UserLoadout => ({ combatantCharacterId, supportCharacterId1, supportCharacterId2, loadoutVersion: 1 });
function resolution(type: TileType, count: number, chain = 1): MatchResolution { const cells = Array.from({ length: count }, (_, col) => ({ row: 0, col })); return { requestId: 'fixture', steps: [{ chain, groups: [{ type, cells }], boardAfterRemoval: Array(49).fill(null), boardAfterFill: Array<TileType>(49).fill('MANA') }], finalBoard: Array<TileType>(49).fill('MANA'), effects: [{ type, amount: 0, matched: count, chain }], shuffled: false } }

describe('generic character effect architecture', () => {
  it('loads all official abilities and keeps all five starter stats neutral', () => { const registry = loadCharacterRegistry(), starters = registry.all.filter((character) => character.starter); expect(registry.all).toHaveLength(79); expect(registry.content.abilities.size).toBe(158); expect(starters).toHaveLength(5); for (const character of starters) { expect(character.combatant.skillId).not.toContain('placeholder'); expect(character.support.effectId).not.toContain('placeholder'); expect(character.combatant.ability?.name).toBeTruthy(); expect(character.support.ability?.name).toBeTruthy(); expect(character.stats).toEqual({ maxHp: 1000, swordEffectPct: 100, shieldEffectPct: 100, healEffectPct: 100, manaGainPct: 100 }) } });
  it('keeps official character and ability ids out of production combat dispatchers', () => { const source = ['battle.ts','effect-engine.ts','game-server.ts'].map((file) => readFileSync(path.resolve('apps/server/src',file),'utf8')).join('\n'); expect(source).not.toMatch(/(?:yuria|clarice|marta|evelyn|eda)_[a-z_]+/); expect(source).not.toMatch(/switch\s*\(\s*(?:characterId|skillId|abilityId)/) });
  it('runs a JSON-only active character without applying tile stats to its fixed effects', () => { const registry = registryWithFixture(); const a = createParticipant('a','a','A',false,1,registry.snapshot(loadout('test_generic_squire','marta_guard_captain','evelyn_trauma_stitcher'))), b = createParticipant('b','b','B',false,2,registry.snapshot(DEFAULT_LOADOUT)); const battle = new Battle([a,b],hooks,Date.now(),0,3,registry); battle.tick(battle.startsAt); a.gauge=100; expect(battle.useSkill('a','fixture-active')).toBe(true); expect(a.shield).toBe(50); expect(battle.pendingAttacks[0]?.damage).toBe(100); battle.tick(battle.pendingAttacks[0]!.arrivesAt); expect(b.hp).toBe(900); battle.forfeit('a') });
  it('runs a JSON-only support trigger while ignoring support-slot stats for tile scaling', () => { const registry = registryWithFixture(); const a = createParticipant('a','a','A',false,1,registry.snapshot(loadout('yuria_counter_sword','test_generic_squire','evelyn_trauma_stitcher'))), b = createParticipant('b','b','B',false,2,registry.snapshot(DEFAULT_LOADOUT)); const battle = new Battle([a,b],hooks,Date.now(),0,3,registry); battle.tick(battle.startsAt); battle.finalizeResolution(a,resolution('SWORD',4)); expect(a.gauge).toBe(10); expect(battle.pendingAttacks[0]?.damage).toBe(115); expect(battle.snapshotFor('a').self.effectRuntime?.supportAbilities[0].id).toBe('test_generic_mana_support'); battle.forfeit('a') });
  it('applies main-character stats exactly once to base tile effects and max HP', () => {
    const registry = registryWithFixture();
    const a = createParticipant('a','a','A',false,1,registry.snapshot(loadout('test_generic_squire','marta_guard_captain','evelyn_trauma_stitcher')));
    const b = createParticipant('b','b','B',false,2,registry.snapshot(DEFAULT_LOADOUT));
    const battle = new Battle([a,b],hooks,Date.now(),0,3,registry); battle.tick(battle.startsAt);
    expect({ hp: a.hp, maxHp: a.maxHp, stats: a.combatStats }).toEqual({ hp: 1234, maxHp: 1234, stats: { maxHp: 1234, swordEffectPct: 150, shieldEffectPct: 80, healEffectPct: 125, manaGainPct: 60 } });
    battle.finalizeResolution(a,resolution('SWORD',3)); expect(battle.pendingAttacks.at(-1)?.damage).toBe(105);
    battle.finalizeResolution(a,resolution('SWORD',4)); expect(battle.pendingAttacks.at(-1)?.damage).toBe(173);
    battle.finalizeResolution(a,resolution('SWORD',5)); expect(battle.pendingAttacks.at(-1)?.damage).toBe(255);
    battle.finalizeResolution(a,resolution('SWORD',3,2)); expect(battle.pendingAttacks.at(-1)?.damage).toBe(116);
    battle.isFrenzy = true; battle.finalizeResolution(a,resolution('SWORD',3)); expect(battle.pendingAttacks.at(-1)?.damage).toBe(143); battle.isFrenzy = false;
    battle.finalizeResolution(a,resolution('SHIELD',3)); expect(a.shield).toBe(52);
    a.hp = 1200; battle.finalizeResolution(a,resolution('HEAL',3)); expect(a.hp).toBe(1234);
    battle.finalizeResolution(a,resolution('MANA',3)); expect(a.gauge).toBe(12);
    expect(battle.snapshotFor('a').self).toMatchObject({ hp: 1234, maxHp: 1234, combatStats: a.combatStats, loadout: { schemaVersion: 2, combatant: { combatStats: a.combatStats } } });
    battle.forfeit('a');
  });
  it('applies existing incoming and healing modifiers after tile stat scaling', () => {
    const registry = registryWithFixture();
    const source = createParticipant('a','a','A',false,1,registry.snapshot(loadout('test_generic_squire','marta_guard_captain','evelyn_trauma_stitcher')));
    const target = createParticipant('b','b','B',false,2,registry.snapshot(loadout('clarice_heavy_shield','marta_guard_captain','evelyn_trauma_stitcher')));
    const battle = new Battle([source,target],hooks,Date.now(),0,3,registry); battle.tick(battle.startsAt);
    target.gauge = 100; battle.useSkill(target.id, 'clarice-defense');
    battle.finalizeResolution(source, resolution('SWORD',3));
    const attack = battle.pendingAttacks.at(-1)!; expect(attack.damage).toBe(105);
    battle.tick(attack.arrivesAt); expect(target.shield).toBe(151); expect(target.hp).toBe(1000);
    battle.forfeit('a');

    const healer = createParticipant('c','c','C',false,4,registry.snapshot(loadout('test_generic_squire','marta_guard_captain','evelyn_trauma_stitcher')));
    const curser = createParticipant('d','d','D',false,5,registry.snapshot(loadout('eda_curse_appraiser','marta_guard_captain','evelyn_trauma_stitcher')));
    const healingBattle = new Battle([healer,curser],hooks,Date.now(),0,6,registry); healingBattle.tick(healingBattle.startsAt);
    curser.gauge = 100; healingBattle.useSkill(curser.id, 'eda-curse'); const curse = healingBattle.pendingAttacks[0]!; healingBattle.tick(curse.arrivesAt);
    healer.hp = 1000; healingBattle.finalizeResolution(healer, resolution('HEAL',3)); expect(healer.hp).toBe(1024);
    healingBattle.forfeit('c');
  });
  it('rejects unknown primitives, bad status references, and forward result references', () => { const registry = loadCharacterRegistry(), sample = structuredClone(registry.content.ability('yuria_counter_break')); expect(() => new ContentRegistry([{ ...sample, id:'bad_effect', effects:[{type:'character_specific_magic'}] }], [...registry.content.statuses.values()])).toThrow(/Unknown effect/); expect(() => new ContentRegistry([{ ...sample, id:'bad_condition', conditions:[{type:'character_specific_condition'}] }], [...registry.content.statuses.values()])).toThrow(/Unknown condition/); expect(() => new ContentRegistry([{ ...sample, id:'bad_status', effects:[{type:'apply_status',statusId:'missing'}] }], [...registry.content.statuses.values()])).toThrow(/Unknown status/); expect(() => new ContentRegistry([{ ...sample, id:'bad_reference', effects:[{type:'conditional',conditions:[{type:'effect_result_compare',effectKey:'later',field:'hpDamage',operator:'gt',value:0}],effects:[]},{type:'deal_damage',key:'later',amount:1}] }], [...registry.content.statuses.values()])).toThrow(/non-earlier/) });
  it('executes Yuria shield bypass and one delayed follow-up from effect results', () => { const registry=loadCharacterRegistry(), a=createParticipant('a','a','A',false,1,registry.snapshot(DEFAULT_LOADOUT)), b=createParticipant('b','b','B',false,2,registry.snapshot(loadout('yuria_counter_sword','clarice_heavy_shield','evelyn_trauma_stitcher'))), battle=new Battle([a,b],hooks,Date.now(),0,3,registry); battle.tick(battle.startsAt); b.shield=126; a.gauge=100; battle.useSkill('a','yuria'); const primary=battle.pendingAttacks[0]!; expect((battle as any).effects.deferred.get(primary.id)).toHaveLength(1); battle.tick(primary.arrivesAt); expect(b.hp).toBe(946); expect(b.shield).toBe(0); expect(battle.snapshotFor('a').self.effectRuntime?.scheduledEffects).toHaveLength(1); battle.tick(primary.arrivesAt+250); expect(b.hp).toBe(881); expect(battle.stats.a.damageByAbilityId.yuria_counter_break).toBe(245); battle.tick(primary.arrivesAt+500); expect(b.hp).toBe(881); battle.forfeit('a') });
  it('executes Clarice, Marta, Evelyn, and Eda active definitions', () => { const registry=loadCharacterRegistry(); const run=(combatant:string,seed:number)=>{ const a=createParticipant('a','a','A',false,seed,registry.snapshot(loadout(combatant,'marta_guard_captain','evelyn_trauma_stitcher'))), b=createParticipant('b','b','B',false,seed+1,registry.snapshot(DEFAULT_LOADOUT)), battle=new Battle([a,b],hooks,Date.now(),0,seed+2,registry); battle.tick(battle.startsAt); a.gauge=100; expect(battle.useSkill('a',`skill-${seed}`)).toBe(true); return {a,b,battle} }; const clarice=run('clarice_heavy_shield',10); expect(clarice.a.shield).toBe(230); expect(clarice.battle.snapshotFor('a').self.effectRuntime?.statuses.map((item)=>item.id)).toContain('damage_reduction'); clarice.battle.forfeit('a'); const marta=run('marta_guard_captain',20); expect(marta.a.shield).toBe(120); expect(marta.battle.snapshotFor('a').self.effectRuntime?.statuses.map((item)=>item.id)).toContain('emergency_guard'); marta.battle.forfeit('a'); const evelyn=run('evelyn_trauma_stitcher',30); expect(evelyn.a.hp).toBe(1000); expect(evelyn.a.shield).toBe(70); evelyn.battle.forfeit('a'); const eda=run('eda_curse_appraiser',50); const curse=eda.battle.pendingAttacks[0]!; eda.battle.tick(curse.arrivesAt); expect(eda.b.hp).toBe(920); expect(eda.battle.snapshotFor('b').self.effectRuntime?.statuses.map((item)=>item.id)).toContain('healing_reduction'); eda.battle.forfeit('a') });
});
