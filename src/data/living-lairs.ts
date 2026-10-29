import { currentContent } from "@/conquest/content/store";
import { MEN_PER_BLOCK, type UnitType } from "@/conquest/engine/common/content";
import type { ArmyUnit } from "@/conquest/engine/common/types";
import type { Alignment } from "@/data/culture-traits";
import type { ProvinceLair, TroubleTheme } from "@/types/living";

export interface LairUnitTemplate {
  unitTypeId: string;
  count: number;
  exp?: number;
}

export interface LairDef {
  id: string;
  name: string;
  description: string;
  raidThreshold: number; // 4, 5, or 6 on 1d6
  raidUnits: readonly LairUnitTemplate[];
  defenderUnits: readonly LairUnitTemplate[];
  fortified: boolean;
  markerIcon: string;
  defaultTheme: TroubleTheme;
  canFormState: boolean;
  stateRosterId?: string;
  stateForm?: string;
  defaultAlignment?: Alignment;
}

export const LAIR_CATALOG: Record<string, LairDef> = {
  ancient_evil: {
    id: "ancient_evil",
    name: "Ancient Evil",
    description: "An elder horror or primordial construct slumbering deep in dark subterranean halls.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "dead_legion", count: 1 }],
    defenderUnits: [
      { unitTypeId: "dead_legion", count: 3 },
      { unitTypeId: "gorgon_behemoth", count: 1 },
      { unitTypeId: "necromancer", count: 1 }
    ],
    fortified: false,
    markerIcon: "☠️",
    defaultTheme: "ruin",
    canFormState: true,
    stateRosterId: "tombKingsBase",
    stateForm: "Necropolis",
    defaultAlignment: "evil"
  },
  ancient_fort: {
    id: "ancient_fort",
    name: "Ruined Keep",
    description: "A decayed frontier fortress occupied by ruthless brigands and a self-proclaimed warlord.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "spear", count: 1 }],
    defenderUnits: [
      { unitTypeId: "spear", count: 3 },
      { unitTypeId: "archers", count: 2 },
      { unitTypeId: "balbenGuard", count: 1 }
    ],
    fortified: true,
    markerIcon: "🏰",
    defaultTheme: "ruin",
    canFormState: true,
    stateRosterId: "local",
    stateForm: "Iron Barony",
    defaultAlignment: "lawful"
  },
  aspiring_warlord: {
    id: "aspiring_warlord",
    name: "Aspiring Warlord",
    description: "An ambitious warlord mustering disciplined horsemen, knights, and mercenaries.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "cavalry", count: 1 }],
    defenderUnits: [
      { unitTypeId: "cavalry", count: 2 },
      { unitTypeId: "marauder_horsemen", count: 1 },
      { unitTypeId: "knights_errant", count: 1 },
      { unitTypeId: "pikemen", count: 1 }
    ],
    fortified: false,
    markerIcon: "⚔️",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "local",
    stateForm: "Despotate",
    defaultAlignment: "chaotic"
  },
  bandit_camp: {
    id: "bandit_camp",
    name: "Bandit Camp",
    description: "A fortified woodland camp of ruthless highwaymen plundering local roads and villages.",
    raidThreshold: 4,
    raidUnits: [{ unitTypeId: "north_marauders", count: 1 }],
    defenderUnits: [
      { unitTypeId: "north_marauders", count: 3 },
      { unitTypeId: "archers", count: 1 },
      { unitTypeId: "glade_scouts", count: 2 }
    ],
    fortified: false,
    markerIcon: "🗡️",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "tribalBase",
    stateForm: "Outlaw Confederacy",
    defaultAlignment: "chaotic"
  },
  corrupt_monastery: {
    id: "corrupt_monastery",
    name: "Corrupt Monastery",
    description: "An isolated mountain cloister whose fanatical zealots practice gruesome sacrificial rites.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "battle_pilgrims", count: 1 }],
    defenderUnits: [
      { unitTypeId: "battle_pilgrims", count: 4 },
      { unitTypeId: "collegiate_wizards", count: 1 },
      { unitTypeId: "witch_furies", count: 2 }
    ],
    fortified: false,
    markerIcon: "⛩️",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "chaosBase",
    stateForm: "Dread Cloister",
    defaultAlignment: "evil"
  },
  cult_shrine: {
    id: "cult_shrine",
    name: "Blood-Cult Shrine",
    description: "A subterranean fane of dark rites, zealous thralls, and fanatical warrior-priests.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "cultist_thralls", count: 1 }],
    defenderUnits: [
      { unitTypeId: "cultist_thralls", count: 4 },
      { unitTypeId: "templar_priests", count: 1 },
      { unitTypeId: "sword", count: 2 }
    ],
    fortified: false,
    markerIcon: "🩸",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "chaosBase",
    stateForm: "Blood-Covenant",
    defaultAlignment: "chaotic"
  },
  cursed_earth: {
    id: "cursed_earth",
    name: "Accursed Grove",
    description: "A blighted mire or twisted woodland prowled by undead swarms and predatory warbeasts.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "undead_swarm", count: 1 }],
    defenderUnits: [
      { unitTypeId: "totem_warbeasts", count: 2 },
      { unitTypeId: "beast_outriders", count: 2 }
    ],
    fortified: false,
    markerIcon: "🌑",
    defaultTheme: "resource",
    canFormState: false
  },
  demonic_master: {
    id: "demonic_master",
    name: "Infernal Fane",
    description: "A dread sanctuary consecrated to an archfiend, garrisoned by hellblades and warlocks.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "cultist_thralls", count: 1 }],
    defenderUnits: [
      { unitTypeId: "tiefling_hellblades", count: 1 },
      { unitTypeId: "hellpact_warlocks", count: 1 },
      { unitTypeId: "cultist_thralls", count: 3 }
    ],
    fortified: false,
    markerIcon: "😈",
    defaultTheme: "ruin",
    canFormState: true,
    stateRosterId: "demonBase",
    stateForm: "Infernal Dominion",
    defaultAlignment: "evil"
  },
  dwarven_outcasts: {
    id: "dwarven_outcasts",
    name: "Exiled Clan Hold",
    description: "A subterranean hold of bitter, exiled dwarven outcasts jealously defending their mines.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "dwarf_axe", count: 1 }],
    defenderUnits: [
      { unitTypeId: "dwarf_axe", count: 3 },
      { unitTypeId: "dwarf_crossbow", count: 2 },
      { unitTypeId: "runesmith_anvil", count: 1 }
    ],
    fortified: false,
    markerIcon: "⛏️",
    defaultTheme: "resource",
    canFormState: true,
    stateRosterId: "infernalDwarfBase",
    stateForm: "Outcast Thanehood",
    defaultAlignment: "lawful"
  },
  mad_wizard: {
    id: "mad_wizard",
    name: "Renegade Arcanist's Tower",
    description: "A secluded spire where an exiled archmage breeds unnatural beasts and raises dead.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "totem_warbeasts", count: 1 }],
    defenderUnits: [
      { unitTypeId: "totem_warbeasts", count: 1 },
      { unitTypeId: "necromancer", count: 1 },
      { unitTypeId: "collegiate_wizards", count: 1 },
      { unitTypeId: "dead_legion", count: 2 }
    ],
    fortified: false,
    markerIcon: "🔮",
    defaultTheme: "ruin",
    canFormState: false
  },
  magical_gate: {
    id: "magical_gate",
    name: "Planar Rift",
    description: "A tear in the cosmic veil spewing forth fiendish hunters, warlocks, and restless shades.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "dead_legion", count: 1 }],
    defenderUnits: [
      { unitTypeId: "fiend_stalkers", count: 1 },
      { unitTypeId: "hellpact_warlocks", count: 1 },
      { unitTypeId: "dead_legion", count: 1 }
    ],
    fortified: false,
    markerIcon: "🌀",
    defaultTheme: "ruin",
    canFormState: true,
    stateRosterId: "demonBase",
    stateForm: "Rift-Kingdom",
    defaultAlignment: "chaotic"
  },
  malevolent_creed: {
    id: "malevolent_creed",
    name: "Xenophobic Enclave",
    description: "An entrenched, xenophobic warcamp bent on driving out or slaughtering all neighboring kin.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "dreadspears", count: 1 }],
    defenderUnits: [
      { unitTypeId: "elf_spears", count: 2 },
      { unitTypeId: "elf_archers", count: 2 },
      { unitTypeId: "high_archmage", count: 1 }
    ],
    fortified: false,
    markerIcon: "🏹",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "darkElfBase",
    stateForm: "Purist Dominion",
    defaultAlignment: "evil"
  },
  monster_nest: {
    id: "monster_nest",
    name: "Monster Nest",
    description: "A cavernous labyrinth inhabited by rampaging minotaurs and towering gorgon behemoths.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "minotaur_herd", count: 1 }],
    defenderUnits: [{ unitTypeId: "gorgon_behemoth", count: 2 }],
    fortified: false,
    markerIcon: "🐉",
    defaultTheme: "resource",
    canFormState: false
  },
  renegade_outpost: {
    id: "renegade_outpost",
    name: "Mutinous Garrison",
    description: "A fortified border post whose garrison broke allegiance and turned to extortion.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "spear", count: 1 }],
    defenderUnits: [
      { unitTypeId: "spear", count: 2 },
      { unitTypeId: "archers", count: 1 },
      { unitTypeId: "sword", count: 1 },
      { unitTypeId: "pikemen", count: 1 }
    ],
    fortified: true,
    markerIcon: "🛡️",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "local",
    stateForm: "Renegade Junta",
    defaultAlignment: "chaotic"
  },
  school_of_dark_sorcery: {
    id: "school_of_dark_sorcery",
    name: "Cabal of Dark Sorcery",
    description: "A dark academy of rogue necromancers, ruin-sorcerers, and thrall spearmen.",
    raidThreshold: 6,
    raidUnits: [{ unitTypeId: "dead_legion", count: 1 }],
    defenderUnits: [
      { unitTypeId: "levy_spear", count: 6 },
      { unitTypeId: "ruin_sorcerers", count: 3 },
      { unitTypeId: "collegiate_wizards", count: 2 },
      { unitTypeId: "necromancer", count: 1 }
    ],
    fortified: false,
    markerIcon: "📖",
    defaultTheme: "ruin",
    canFormState: true,
    stateRosterId: "vampireBase",
    stateForm: "Cabal",
    defaultAlignment: "evil"
  },
  marauder_warcamp: {
    id: "marauder_warcamp",
    name: "Marauder Warcamp",
    description: "A stockaded encampment of savage orc marauders, black orcs, and blood-frenzied shamans.",
    raidThreshold: 4,
    raidUnits: [{ unitTypeId: "orc_boyz", count: 1 }],
    defenderUnits: [
      { unitTypeId: "orc_boyz", count: 5 },
      { unitTypeId: "black_orcs", count: 1 },
      { unitTypeId: "waaagh_shaman", count: 1 }
    ],
    fortified: true,
    markerIcon: "🪓",
    defaultTheme: "resource",
    canFormState: true,
    stateRosterId: "orcBase",
    stateForm: "Orc Warcamp",
    defaultAlignment: "chaotic"
  },
  splinter_group: {
    id: "splinter_group",
    name: "Bitter Exiles",
    description: "A rebel encampment of deposed elites, veteran guardsmen, and vengeful partisans.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "spear", count: 1 }],
    defenderUnits: [
      { unitTypeId: "levy_spear", count: 4 },
      { unitTypeId: "spear", count: 1 },
      { unitTypeId: "sword", count: 1 },
      { unitTypeId: "balbenGuard", count: 1 }
    ],
    fortified: false,
    markerIcon: "⛺",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "local",
    stateForm: "Partisan League",
    defaultAlignment: "neutral"
  },
  thieves_stronghold: {
    id: "thieves_stronghold",
    name: "Syndicate Stronghold",
    description: "A fortified underground warren of assassins, marauders, and deadly shadow-scouts.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "north_marauders", count: 1 }],
    defenderUnits: [
      { unitTypeId: "north_marauders", count: 2 },
      { unitTypeId: "waywatchers", count: 2 },
      { unitTypeId: "witch_furies", count: 2 }
    ],
    fortified: false,
    markerIcon: "🗝️",
    defaultTheme: "burg",
    canFormState: true,
    stateRosterId: "skavenBase",
    stateForm: "Shadow Syndicate",
    defaultAlignment: "evil"
  },
  blight_infestation: {
    id: "blight_infestation",
    name: "Eldritch Blight-Hive",
    description: "A twisting underworld hive of ghoul broods, aberrant chuuls, and psychic predators.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "crypt_ghouls", count: 3 }],
    defenderUnits: [
      { unitTypeId: "crypt_ghouls", count: 5 },
      { unitTypeId: "cultist_thralls", count: 3 },
      { unitTypeId: "chuul_aberrations", count: 1 },
      { unitTypeId: "illithid_savants", count: 1 }
    ],
    fortified: false,
    markerIcon: "🕸️",
    defaultTheme: "ruin",
    canFormState: false
  },
  vicious_humanoids: {
    id: "vicious_humanoids",
    name: "Savage Humanoid Warband",
    description: "A nomadic warband of scaled predators and ferocious ogre bulls raiding the countryside.",
    raidThreshold: 5,
    raidUnits: [{ unitTypeId: "saurus_cohorts", count: 1 }],
    defenderUnits: [
      { unitTypeId: "ogre_bulls", count: 1 },
      { unitTypeId: "saurus_cohorts", count: 4 }
    ],
    fortified: false,
    markerIcon: "🦴",
    defaultTheme: "resource",
    canFormState: false
  }
};

/** 20 generic fantasy Lair Nature IDs */
export const LAIR_NATURE_IDS: readonly string[] = [
  "ancient_evil",
  "ancient_fort",
  "aspiring_warlord",
  "bandit_camp",
  "corrupt_monastery",
  "cult_shrine",
  "cursed_earth",
  "demonic_master",
  "dwarven_outcasts",
  "mad_wizard",
  "magical_gate",
  "malevolent_creed",
  "monster_nest",
  "renegade_outpost",
  "school_of_dark_sorcery",
  "marauder_warcamp",
  "splinter_group",
  "thieves_stronghold",
  "blight_infestation",
  "vicious_humanoids"
];

/** 15 state-capable Lair Nature IDs */
export const STATE_CAPABLE_LAIR_IDS: readonly string[] = [
  "ancient_evil",
  "ancient_fort",
  "aspiring_warlord",
  "bandit_camp",
  "corrupt_monastery",
  "cult_shrine",
  "demonic_master",
  "dwarven_outcasts",
  "magical_gate",
  "malevolent_creed",
  "renegade_outpost",
  "school_of_dark_sorcery",
  "marauder_warcamp",
  "splinter_group",
  "thieves_stronghold"
];

export function isLairStateCapable(id: string): boolean {
  return LAIR_CATALOG[id]?.canFormState ?? false;
}

/** Mapping from 37 Trouble archetypes to candidate Lair Natures */
export const TROUBLE_TO_LAIR_MAPPINGS: Record<string, readonly string[]> = {
  ancient_curse: ["ancient_evil", "cursed_earth"],
  angry_dead: ["ancient_evil", "cursed_earth"],
  bad_reputation: ["thieves_stronghold", "splinter_group"],
  barren_surroundings: ["bandit_camp", "vicious_humanoids"],
  blight_cult: ["cult_shrine", "demonic_master"],
  blight_spawn: ["blight_infestation", "ancient_evil"],
  brigand_raiders: ["bandit_camp", "thieves_stronghold"],
  class_hatred: ["splinter_group", "thieves_stronghold"],
  conquering_heirs: ["ancient_fort", "aspiring_warlord"],
  contaminated_land: ["cursed_earth", "blight_infestation"],
  corrupt_leadership: ["thieves_stronghold", "renegade_outpost"],
  covetous_polity: ["splinter_group", "aspiring_warlord"],
  crushed_spirits: ["corrupt_monastery", "cult_shrine"],
  dark_wizards: ["mad_wizard", "school_of_dark_sorcery"],
  demagogue: ["cult_shrine", "splinter_group"],
  destructive_customs: ["corrupt_monastery", "cult_shrine"],
  disputed_possession: ["ancient_fort", "aspiring_warlord"],
  disunity: ["splinter_group", "thieves_stronghold"],
  doomsday_cult: ["cult_shrine", "demonic_master"],
  ethnic_feuding: ["malevolent_creed", "splinter_group"],
  exceptional_poverty: ["thieves_stronghold", "bandit_camp"],
  exiled_lord: ["ancient_fort", "aspiring_warlord"],
  failed_settlement: ["ancient_fort", "bandit_camp"],
  flooding: ["blight_infestation", "monster_nest"],
  harsh_conditions: ["monster_nest", "dwarven_outcasts"],
  hazardous_resource: ["dwarven_outcasts", "monster_nest"],
  inaccessible: ["bandit_camp", "ancient_fort"],
  leyline_blight: ["cursed_earth", "magical_gate"],
  mercenary_populace: ["renegade_outpost", "aspiring_warlord"],
  monsters: ["monster_nest", "vicious_humanoids"],
  murderous_heirs: ["ancient_fort", "aspiring_warlord"],
  no_workers: ["thieves_stronghold", "bandit_camp"],
  outland_raiders: ["marauder_warcamp", "bandit_camp"],
  pervasive_hunger: ["bandit_camp", "thieves_stronghold"],
  recalcitrant_locals: ["splinter_group", "malevolent_creed"],
  recurrent_sickness: ["blight_infestation", "cursed_earth"],
  relic_golems: ["ancient_evil", "dwarven_outcasts"],
  riotous_thugs: ["thieves_stronghold", "bandit_camp"],
  savage_raiders: ["marauder_warcamp", "vicious_humanoids"],
  severe_damage: ["ancient_fort", "bandit_camp"],
  sinister_cult: ["cult_shrine", "demonic_master"],
  taboo_land: ["cursed_earth", "ancient_evil"],
  things_from_below: ["magical_gate", "blight_infestation", "dwarven_outcasts"],
  toxic_process: ["cursed_earth", "blight_infestation"],
  undeveloped: ["bandit_camp", "monster_nest"],
  wasted_production: ["thieves_stronghold", "renegade_outpost"],
  xenophobia: ["malevolent_creed", "splinter_group"]
};

export function getLairDef(id: string): LairDef {
  return LAIR_CATALOG[id] ?? LAIR_CATALOG.ancient_evil!;
}

/** Instantiates full ArmyUnit objects from template definitions */
export function instantiateLairUnits(
  templates: readonly LairUnitTemplate[],
  unitTypes?: Record<string, UnitType>
): ArmyUnit[] {
  const types = unitTypes ?? (typeof currentContent === "function" ? currentContent()?.content?.unitTypes : undefined);
  const units: ArmyUnit[] = [];
  for (const t of templates) {
    const uType = types ? types[t.unitTypeId] : undefined;
    const men = uType?.men ?? (uType?.blocks ? Math.round(uType.blocks * MEN_PER_BLOCK) : 150);
    for (let i = 0; i < t.count; i++) {
      units.push({
        type: t.unitTypeId,
        count: men,
        exp: t.exp ?? 0
      });
    }
  }
  return units;
}

/** Constructs an active ProvinceLair state object from archetype and parameters */
export function createProvinceLair(
  lairId: string,
  cell: number,
  level: number,
  theme?: TroubleTheme,
  burgId?: number,
  unitTypes?: Record<string, UnitType>
): ProvinceLair {
  const def = getLairDef(lairId);
  return {
    id: def.id,
    name: def.name,
    level: Math.max(4, Math.min(10, Math.round(level))),
    theme: theme ?? def.defaultTheme,
    cell,
    burgId,
    raidThreshold: def.raidThreshold,
    raidUnits: instantiateLairUnits(def.raidUnits, unitTypes),
    defenders: instantiateLairUnits(def.defenderUnits, unitTypes),
    fortified: def.fortified,
    raidPending: false,
    seasonsActive: 0
  };
}

/** Selects an appropriate Lair Nature when a Trouble metastasizes */
export function pickLairForTrouble(
  troubleId: string,
  rng?: { d?: (sides: number) => number; choice?: <T>(arr: readonly T[]) => T }
): string {
  const mapped = TROUBLE_TO_LAIR_MAPPINGS[troubleId];
  if (mapped && mapped.length > 0) {
    if (rng?.choice) return rng.choice(mapped);
    return mapped[0]!;
  }
  if (rng?.d) {
    const idx = rng.d(LAIR_NATURE_IDS.length) - 1;
    return LAIR_NATURE_IDS[idx] ?? LAIR_NATURE_IDS[0]!;
  }
  return LAIR_NATURE_IDS[0]!;
}
