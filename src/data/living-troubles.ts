import type { TroublePool, TroubleSaveKind, TroubleUnitRole } from "@/types/living";

export interface TroubleDef {
  id: string;
  name: string;
  pool: TroublePool;
  save: TroubleSaveKind;
  requiredRole: TroubleUnitRole;
  description: string;
  canPromoteToState: boolean;
  stateLairId?: string;
  stateForm?: string;
}

export const UNIT_ROLE_POOLS: Record<TroubleUnitRole, TroublePool> = {
  guardsmen: "m",
  military: "m",
  merchant: "w",
  sage: "w",
  prophet: "s",
  magistrate: "s"
};

export const UNIT_ROLE_LABELS: Record<TroubleUnitRole, string> = {
  guardsmen: "Guardsmen",
  military: "Military Unit",
  merchant: "Merchant",
  sage: "Sage",
  prophet: "Prophet",
  magistrate: "Magistrate"
};

export const SAVE_KIND_LABELS: Record<TroubleSaveKind, string> = {
  disorder: "Disorder",
  uprising: "Uprising",
  poverty: "Poverty",
  ignorance: "Ignorance",
  despair: "Despair",
  corruption: "Corruption"
};

export const TROUBLE_CATALOG: Record<string, TroubleDef> = {
  ancient_curse: {
    id: "ancient_curse",
    name: "Ancient Curse",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "A lingering sorcerous blight poisons luck, crops, and labor across the area.",
    canPromoteToState: false
  },
  angry_dead: {
    id: "angry_dead",
    name: "Angry Dead",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "Vengeful spirits and unburied corpses rise to slaughter travelers and settlers.",
    canPromoteToState: false
  },
  leyline_blight: {
    id: "leyline_blight",
    name: "Leyline Blight",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "Crossed geomantic currents bring inexplicable misfortune, strange rot, and sudden fever.",
    canPromoteToState: false
  },
  bad_reputation: {
    id: "bad_reputation",
    name: "Bad Reputation",
    pool: "s",
    save: "corruption",
    requiredRole: "magistrate",
    description: "A notoriety for thievery, bad faith, and rapacious officials strangles legitimate trade.",
    canPromoteToState: true,
    stateLairId: "thieves_stronghold",
    stateForm: "Smuggler Free-Port"
  },
  barren_surroundings: {
    id: "barren_surroundings",
    name: "Barren Surroundings",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Rocky, arid, infertile soil forces locals into a desperate struggle for bare survival.",
    canPromoteToState: false
  },
  class_hatred: {
    id: "class_hatred",
    name: "Class Hatred",
    pool: "s",
    save: "despair",
    requiredRole: "prophet",
    description: "Bitter hatred between social orders paralyzes civic life with savage score-settling.",
    canPromoteToState: true,
    stateLairId: "splinter_group",
    stateForm: "Peasant Commonwealth"
  },
  conquering_heirs: {
    id: "conquering_heirs",
    name: "Conquering Heirs",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "Militant remnants of an ancient faction plot to bring nearby communities under their iron yoke.",
    canPromoteToState: true,
    stateLairId: "ancient_fort",
    stateForm: "Irredentist Principality"
  },
  contaminated_land: {
    id: "contaminated_land",
    name: "Contaminated Land",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Poisoned soil, saline runoffs, or toxic springs leave the population sick and crops sparse.",
    canPromoteToState: false
  },
  corrupt_leadership: {
    id: "corrupt_leadership",
    name: "Corrupt Leadership",
    pool: "s",
    save: "corruption",
    requiredRole: "magistrate",
    description: "Local administrators care only for bribes, embezzlement, and unchecked venality.",
    canPromoteToState: true,
    stateLairId: "renegade_outpost",
    stateForm: "Breakaway Satrapy"
  },
  covetous_polity: {
    id: "covetous_polity",
    name: "Covetous Neighbors",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Aggressive neighboring reavers and border poachers continually plunder the site.",
    canPromoteToState: true,
    stateLairId: "aspiring_warlord",
    stateForm: "Borderland Warband"
  },
  crushed_spirits: {
    id: "crushed_spirits",
    name: "Crushed Spirits",
    pool: "s",
    save: "despair",
    requiredRole: "prophet",
    description: "Endless privation and oppression have stamped out all hope, initiative, and morale.",
    canPromoteToState: false
  },
  dark_wizards: {
    id: "dark_wizards",
    name: "Dark Wizards",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description:
      "A cabal of rogue necromancers or blood-sorcerers terrorizes the countryside with arcane abominations.",
    canPromoteToState: false
  },
  demagogue: {
    id: "demagogue",
    name: "Zealous Demagogue",
    pool: "s",
    save: "despair",
    requiredRole: "prophet",
    description: "A radical agitator whips up hysteria, hostile boycotts, and civic strife.",
    canPromoteToState: true,
    stateLairId: "splinter_group",
    stateForm: "Revolutionary Tribune"
  },
  destructive_customs: {
    id: "destructive_customs",
    name: "Destructive Customs",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "Entrenched ruinous traditions and superstitious taboos waste labor and cripple commerce.",
    canPromoteToState: false
  },
  disputed_possession: {
    id: "disputed_possession",
    name: "Disputed Possession",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "Rival claimants contest ownership with subsidized bushwhackers and armed raiding parties.",
    canPromoteToState: true,
    stateLairId: "aspiring_warlord",
    stateForm: "Claimant Marches"
  },
  disunity: {
    id: "disunity",
    name: "Factional Disunity",
    pool: "s",
    save: "despair",
    requiredRole: "prophet",
    description: "Suspicious rival clans and splinter factions refuse to cooperate, sabotaging civic progress.",
    canPromoteToState: true,
    stateLairId: "splinter_group",
    stateForm: "Splinter Clan-State"
  },
  cultural_feuding: {
    id: "cultural_feuding",
    name: "Cultural Feuding",
    pool: "s",
    save: "despair",
    requiredRole: "prophet",
    description: "Ancient ethnic blood-feuds erupt in cycles of revenge, boycott, and localized riots.",
    canPromoteToState: true,
    stateLairId: "malevolent_creed",
    stateForm: "Kinship Enclave"
  },
  exceptional_poverty: {
    id: "exceptional_poverty",
    name: "Exceptional Poverty",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Crippling destitution and worn-out tools leave the region unable to provide for its basic needs.",
    canPromoteToState: false
  },
  exiled_lord: {
    id: "exiled_lord",
    name: "Exiled Lord",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "A banished noble gathers mercenaries and disaffected partisans to reclaim rule by blood.",
    canPromoteToState: true,
    stateLairId: "aspiring_warlord",
    stateForm: "Pretender Barony"
  },
  failed_settlement: {
    id: "failed_settlement",
    name: "Failed Settlement",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "An abandoned ghost town needs seed capital, basic tools, and resettlement logistics.",
    canPromoteToState: false
  },
  flooding: {
    id: "flooding",
    name: "Seasonal Flooding",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Uncontrolled river surges and torrents repeatedly destroy earthworks and drown arable fields.",
    canPromoteToState: false
  },
  harsh_conditions: {
    id: "harsh_conditions",
    name: "Harsh Conditions",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Ferocious weather, mountain slides, or toxic marsh fogs render daily labor punishingly grim.",
    canPromoteToState: false
  },
  hazardous_resource: {
    id: "hazardous_resource",
    name: "Hazardous Extraction",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description:
      "Unstable deep tunnels, noxious vapors, or volatile minerals kill harvesters without specialized engineering.",
    canPromoteToState: false
  },
  brigand_raiders: {
    id: "brigand_raiders",
    name: "Brigand Reavers",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Entrenched highwaymen and bandit gangs prey upon unprotected caravans and rural hamlets.",
    canPromoteToState: true,
    stateLairId: "bandit_camp",
    stateForm: "Outlaw Barony"
  },
  inaccessible: {
    id: "inaccessible",
    name: "Inaccessible Terrain",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Treacherous cliffs, trackless mires, or lack of graded routes cut the region off from outside trade.",
    canPromoteToState: false
  },
  mercenary_populace: {
    id: "mercenary_populace",
    name: "Mercenary Populace",
    pool: "s",
    save: "corruption",
    requiredRole: "magistrate",
    description: "Locals flout oaths and agreements the moment a richer bribe or treacherous turncoat offer appears.",
    canPromoteToState: true,
    stateLairId: "renegade_outpost",
    stateForm: "Free Company"
  },
  monsters: {
    id: "monsters",
    name: "Prowling Monsters",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Savage beasts and man-eating predators creep out of the brush to cull herds and ambushed travelers.",
    canPromoteToState: false
  },
  murderous_heirs: {
    id: "murderous_heirs",
    name: "Feral Heritors",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "Feral, degenerated descendants of ancient denizens wage vicious guerrilla war from the ruins.",
    canPromoteToState: false
  },
  no_workers: {
    id: "no_workers",
    name: "Labor Shortage",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Rich timber, ores, or fields sit idle for total lack of a willing or able workforce.",
    canPromoteToState: false
  },
  pervasive_hunger: {
    id: "pervasive_hunger",
    name: "Pervasive Hunger",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "Chronic malnutrition and barren harvests leave the populace emaciated and weary.",
    canPromoteToState: false
  },
  recalcitrant_locals: {
    id: "recalcitrant_locals",
    name: "Recalcitrant Locals",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Sullen defiance, covert sabotage, and non-compliance obstruct royal decrees and tax collectors.",
    canPromoteToState: true,
    stateLairId: "splinter_group",
    stateForm: "Free Cantons"
  },
  recurrent_sickness: {
    id: "recurrent_sickness",
    name: "Recurrent Sickness",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description:
      "Plague vapors, bad water, or foul miasmas periodically afflict the populace with fever and pestilence.",
    canPromoteToState: false
  },
  relic_golems: {
    id: "relic_golems",
    name: "Relic Automatons",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "Mindless ancient war-constructs and enchanted stone guardians slay anyone approaching the old works.",
    canPromoteToState: false
  },
  riotous_thugs: {
    id: "riotous_thugs",
    name: "Riotous Thugs",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Unruly gangs, rowdy street brawlers, and armed mobs terrorize public squares and defy the law.",
    canPromoteToState: true,
    stateLairId: "bandit_camp",
    stateForm: "Ganglord Despotate"
  },
  secret_society: {
    id: "secret_society",
    name: "Secret Society",
    pool: "s",
    save: "corruption",
    requiredRole: "magistrate",
    description:
      "A hidden brotherhood pulls the puppet strings of local grandees through extortion and assassinations.",
    canPromoteToState: true,
    stateLairId: "thieves_stronghold",
    stateForm: "Shadow Directorate"
  },
  severe_damage: {
    id: "severe_damage",
    name: "Severe Ruination",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description:
      "Tumbled arches, burnt foundations, and flooded delvings block all access until cleared by heavy engineering.",
    canPromoteToState: false
  },
  outland_raiders: {
    id: "outland_raiders",
    name: "Outland Raiders",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "Fierce barbarian warbands and nomad raiders sweep in from the wild frontiers to torch and plunder.",
    canPromoteToState: true,
    stateLairId: "marauder_warcamp",
    stateForm: "Outland Horde"
  },
  sinister_cult: {
    id: "sinister_cult",
    name: "Sinister Cult",
    pool: "s",
    save: "corruption",
    requiredRole: "magistrate",
    description: "A dark sect devoted to malevolent entities exerts shadowy influence and performs blood sacrifices.",
    canPromoteToState: true,
    stateLairId: "cult_shrine",
    stateForm: "Dark Theocracy"
  },
  taboo_land: {
    id: "taboo_land",
    name: "Taboo Land",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "Dread prophecies and religious bans terrify laborers, who refuse to set foot on the accursed ground.",
    canPromoteToState: false
  },
  things_from_below: {
    id: "things_from_below",
    name: "Things From Below",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Subterranean horrors crawl up through sinkholes and abandoned cellars to snatch livestock and folk.",
    canPromoteToState: false
  },
  doomsday_cult: {
    id: "doomsday_cult",
    name: "Doomsday Cult",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Fanatical apocalyptic heretics seek to summon eldritch calamity and slaughter the unfaithful.",
    canPromoteToState: true,
    stateLairId: "demonic_master",
    stateForm: "Apocalyptic Covenant"
  },
  blight_spawn: {
    id: "blight_spawn",
    name: "Blight Spawn",
    pool: "m",
    save: "uprising",
    requiredRole: "military",
    description: "Horrific otherworldly monstrosities have broken through a dimensional rift or ancient crypt.",
    canPromoteToState: false
  },
  toxic_process: {
    id: "toxic_process",
    name: "Toxic Process",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "Smelting fumes or caustic alchemy poison the workers and foul the downstream waters.",
    canPromoteToState: false
  },
  undeveloped: {
    id: "undeveloped",
    name: "Undeveloped Hinterland",
    pool: "w",
    save: "poverty",
    requiredRole: "merchant",
    description: "A remote site lacks mills, carts, docks, and basic infrastructure to harvest its natural bounty.",
    canPromoteToState: false
  },
  wasted_production: {
    id: "wasted_production",
    name: "Wasted Production",
    pool: "w",
    save: "ignorance",
    requiredRole: "sage",
    description: "Pests, improper storage, or superstitious destruction waste the vast majority of extracted goods.",
    canPromoteToState: false
  },
  xenophobia: {
    id: "xenophobia",
    name: "Insular Xenophobia",
    pool: "m",
    save: "disorder",
    requiredRole: "guardsmen",
    description: "Fierce hostility toward outsiders drives off foreign merchants and violently rejects outside rule.",
    canPromoteToState: true,
    stateLairId: "malevolent_creed",
    stateForm: "Nativist Dominion"
  }
};

/** 19 state-promotable Trouble IDs */
export const STATE_PROMOTABLE_TROUBLE_IDS: readonly string[] = [
  "exiled_lord",
  "conquering_heirs",
  "disputed_possession",
  "corrupt_leadership",
  "mercenary_populace",
  "demagogue",
  "class_hatred",
  "recalcitrant_locals",
  "disunity",
  "cultural_feuding",
  "xenophobia",
  "secret_society",
  "bad_reputation",
  "riotous_thugs",
  "brigand_raiders",
  "covetous_polity",
  "outland_raiders",
  "sinister_cult",
  "doomsday_cult"
];

export function isTroubleStatePromotable(id: string): boolean {
  return TROUBLE_CATALOG[id]?.canPromoteToState ?? false;
}

/** 20-entry table for Burg / Province Civic troubles */
export const BURG_TROUBLE_IDS: readonly string[] = [
  "bad_reputation",
  "class_hatred",
  "contaminated_land",
  "corrupt_leadership",
  "crushed_spirits",
  "demagogue",
  "destructive_customs",
  "disunity",
  "cultural_feuding",
  "exceptional_poverty",
  "flooding",
  "mercenary_populace",
  "monsters",
  "pervasive_hunger",
  "recurrent_sickness",
  "riotous_thugs",
  "secret_society",
  "outland_raiders",
  "doomsday_cult",
  "xenophobia"
];

/** 20-entry table for Ruin / Site troubles */
export const RUIN_TROUBLE_IDS: readonly string[] = [
  "ancient_curse",
  "angry_dead",
  "barren_surroundings",
  "conquering_heirs",
  "dark_wizards",
  "destructive_customs",
  "disputed_possession",
  "exiled_lord",
  "brigand_raiders",
  "inaccessible",
  "monsters",
  "murderous_heirs",
  "relic_golems",
  "severe_damage",
  "outland_raiders",
  "sinister_cult",
  "taboo_land",
  "things_from_below",
  "doomsday_cult",
  "blight_spawn"
];

/** 20-entry table for Resource / Extraction troubles */
export const RESOURCE_TROUBLE_IDS: readonly string[] = [
  "leyline_blight",
  "bad_reputation",
  "contaminated_land",
  "covetous_polity",
  "failed_settlement",
  "flooding",
  "harsh_conditions",
  "hazardous_resource",
  "brigand_raiders",
  "inaccessible",
  "monsters",
  "no_workers",
  "recalcitrant_locals",
  "recurrent_sickness",
  "relic_golems",
  "outland_raiders",
  "taboo_land",
  "toxic_process",
  "undeveloped",
  "wasted_production"
];

export function getTroubleDef(id: string): TroubleDef {
  return TROUBLE_CATALOG[id] ?? TROUBLE_CATALOG.monsters;
}

/** Returns 1 for exact specialist match, 2 for same-pool mismatch, 3 for wrong-pool mismatch */
export function troubleUnitMatchMultiplier(
  trouble: { pool: TroublePool; requiredRole: TroubleUnitRole },
  unitRole?: TroubleUnitRole
): number {
  if (!unitRole) return 3;
  if (unitRole === trouble.requiredRole) return 1;
  const unitPool = UNIT_ROLE_POOLS[unitRole];
  if (unitPool === trouble.pool) return 2;
  return 3;
}
