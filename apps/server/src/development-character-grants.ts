import type { CharacterRegistry } from './character-registry.js';

export const REPRESENTATIVE_0_4_CHARACTER_IDS = Object.freeze([
  'acid_javelin_nasika',
  'apothecary_assistant_brixa',
  'apprentice_shieldbearer_riel',
  'axe_soldier_karna',
  'convoy_captain_graka',
  'dagger_minha',
  'failed_saint_noael',
  'fallen_legion_commander_morvain',
  'fortress_breaker_camilla',
  'mountain_gunner_berka',
  'reality_leak_knight_morgan',
  'rogue_assault_akane',
  'siege_cook_borga',
  'void_cleaner_nox',
] as const);

export const R_BATCH_0_5_1_CHARACTER_IDS = Object.freeze([
  'apology_receptionist_nell',
  'armor_mender_tilda',
  'assault_soldier_braka',
  'defense_module_eira',
  'demolition_foreman_doyle',
  'dungeon_surveyor_mappo',
  'feather_sniper_erika',
  'forest_shield_rania',
  'fragment_soldier_7',
  'gatekeeper_brom',
  'heavy_gunner_greta',
  'illusion_swordswoman_kohane',
  'lancer_ravia',
  'maintenance_foreman_bron',
  'mounted_archer_seira',
  'odd_job_captain_gribit',
  'receptionist_maren',
  'repair_core_12',
  'sales_broker_oscar',
  'shield_assistant_uniel',
  'shield_fist_rinka',
  'shield_girl_taura',
  'shield_soldier_nadia',
  'sniper_isila',
  'spear_rider_kyrie',
  'spear_shield_soldier_rina',
  'spy_nyara',
  'tactical_operator_corta',
  'tail_lancer_serna',
  'trap_thrower_poppo',
] as const);

export const R_BATCH_0_5_2_CHARACTER_IDS = Object.freeze([
  'bandage_inspector_michaela',
  'black_ledger_clerk_griselda',
  'bound_shield_mirena',
  'broom_bomber_elma',
  'duelist_camille',
  'emergency_courier_ropi',
  'evidence_guard_verno',
  'hauling_foreman_jellico',
  'herb_appraiser_serina',
  'ice_lancer_yukira',
  'infirmary_leader_molly',
  'jelly_shield_melty',
  'night_accountant_vivian',
  'overtime_receptionist_ines',
  'poison_treatment_shez',
  'pursuer_lena',
  'recovery_team_paco',
  'rift_shield_voidrin',
  'rooftop_scout_neria',
  'scale_shield_zara',
  'scout_leader_raka',
  'sealing_cord_carrier_darmel',
  'shield_shepherd_meira',
  'shield_soldier_matilda',
  'slime_cleanup_lumia',
  'smoke_thief_tami',
  'spear_assault_fiona',
  'streetlamp_gatekeeper_orkan',
  'thread_shield_neria',
  'wagon_escort_colin',
] as const);

export const DEVELOPMENT_CHARACTER_GROUPS = Object.freeze({
  'representative-0.4': REPRESENTATIVE_0_4_CHARACTER_IDS,
  'r-batch-0.5.1': R_BATCH_0_5_1_CHARACTER_IDS,
  'r-batch-0.5.2': R_BATCH_0_5_2_CHARACTER_IDS,
  'all-enabled': null,
});

export type DevelopmentCharacterGroup = keyof typeof DEVELOPMENT_CHARACTER_GROUPS;

export function resolveDevelopmentCharacterGroup(registry: CharacterRegistry, group: DevelopmentCharacterGroup): string[] {
  if (group === 'all-enabled') return registry.enabled.map((character) => character.id).sort();
  const enabled = new Set(registry.enabled.map((character) => character.id));
  const ids = [...DEVELOPMENT_CHARACTER_GROUPS[group]];
  const unavailable = ids.filter((id) => !enabled.has(id));
  if (unavailable.length) throw new Error(`DEVELOPMENT_CHARACTER_GROUP_INVALID:${unavailable.join(',')}`);
  return ids;
}
