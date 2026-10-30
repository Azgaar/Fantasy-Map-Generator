// Two-choice Guild petition dilemmas anchored to active map crises (slice 4).
// See docs/plans/living-idle-guild.md sections 3.2 and 7 (slice 4).
export type PetitionAnchorKind = "trouble" | "lair" | "unrest" | "state" | "cursedRelic";

/** World outcomes a petition choice can trigger; the generator applies them to the popup's anchor */
export type PetitionEffect =
  | { kind: "quellTrouble" }
  | { kind: "promoteTrouble" }
  | { kind: "purgeLair" }
  | { kind: "pacifyBurg" }
  | { kind: "unrest"; amount: number }
  | { kind: "unravel"; amount: number }
  | { kind: "smiteRuler" }
  | { kind: "destroyRelic" }
  | { kind: "setPatron" };

export interface PetitionChoice {
  label: string;
  tooltip: string;
  /** guild gold delta (negative = the Guild pays) */
  gold: number;
  renown: number;
  effects?: PetitionEffect[];
}

export interface PetitionDef {
  id: string;
  anchor: PetitionAnchorKind;
  /** coup petitions only anchor to state-promotable troubles */
  promotableOnly?: boolean;
  /** {burg} {province} {state} {lair} {ruler} {trouble} {relic} placeholders */
  title: string;
  text: string;
  choices: readonly [PetitionChoice, PetitionChoice];
}

export const PETITION_CATALOG: Record<string, PetitionDef> = {
  desperate_siege: {
    id: "desperate_siege",
    anchor: "lair",
    title: "The Desperate Siege",
    text: "{burg} is besieged by raiders from {lair}! The burgesses offer their ancient vault key if the Guild holds the walls.",
    choices: [
      {
        label: "Deploy Emergency Vanguard",
        tooltip: "-40 gold, +15 renown: the Guild storms the lair before it strikes",
        gold: -40,
        renown: 15,
        effects: [{ kind: "purgeLair" }]
      },
      {
        label: "Demand Profiteering Tolls",
        tooltip: "+60 gold, -10 renown: the Guild sells its swords to the highest bidder",
        gold: 60,
        renown: -10,
        effects: [{ kind: "unrest", amount: 20 }]
      }
    ]
  },
  pretenders_bribe: {
    id: "pretenders_bribe",
    anchor: "trouble",
    promotableOnly: true,
    title: "The Pretender's Bribe",
    text: "An exiled lord in {province} seeks Guild recognition to stage a coup against {state}.",
    choices: [
      {
        label: "Back the Coup",
        tooltip: "-50 gold, +10 renown: the trouble rises into a Guild-allied state",
        gold: -50,
        renown: 10,
        effects: [{ kind: "promoteTrouble" }]
      },
      {
        label: "Betray to the Crown",
        tooltip: "+50 gold, +5 renown: the coup collapses and the trouble is quelled",
        gold: 50,
        renown: 5,
        effects: [{ kind: "quellTrouble" }]
      }
    ]
  },
  harsh_levy: {
    id: "harsh_levy",
    anchor: "trouble",
    title: "The Harsh Levy",
    text: "{state} begs the Guild to put down {trouble} in {province} before the tax wagons stop rolling.",
    choices: [
      {
        label: "Fund the Militia",
        tooltip: "-30 gold, +8 renown: Guild coin arms the local levy and the trouble is quelled",
        gold: -30,
        renown: 8,
        effects: [{ kind: "quellTrouble" }]
      },
      {
        label: "Let Them Squabble",
        tooltip: "+10 gold, -4 renown: the Guild pockets the escrow and walks away",
        gold: 10,
        renown: -4
      }
    ]
  },
  succession_oath: {
    id: "succession_oath",
    anchor: "state",
    title: "The Succession Oath",
    text: "The court of {state} asks the Guild to publicly bless {ruler} and calm the whispering factions.",
    choices: [
      {
        label: "Bless the Heir",
        tooltip: "-45 gold, +10 renown: the realm stabilizes around its ruler",
        gold: -45,
        renown: 10,
        effects: [{ kind: "unravel", amount: -10 }]
      },
      {
        label: "Sell the Archives",
        tooltip: "+40 gold, -8 renown: Guild secrets on {state} fetch a fine price elsewhere",
        gold: 40,
        renown: -8,
        effects: [{ kind: "unravel", amount: 10 }]
      }
    ]
  },
  palace_coup: {
    id: "palace_coup",
    anchor: "state",
    title: "The Palace Coup",
    text: "Disgruntled officers in {state} ask the Guild to look away while they remove {ruler} by dawn.",
    choices: [
      {
        label: "Protect the Ruler",
        tooltip: "-40 gold, +8 renown: Guild veterans secure the palace for the rightful crown",
        gold: -40,
        renown: 8,
        effects: [{ kind: "unravel", amount: -5 }]
      },
      {
        label: "Look Away",
        tooltip: "+60 gold, -10 renown: by morning {state} will need a new ruler",
        gold: 60,
        renown: -10,
        effects: [{ kind: "smiteRuler" }]
      }
    ]
  },
  cursed_idol: {
    id: "cursed_idol",
    anchor: "cursedRelic",
    title: "The Cursed Relic",
    text: "Terrified priests beg the Guild to surrender {relic} to sanctified fire.",
    choices: [
      {
        label: "Banish the Relic",
        tooltip: "0 gold, +12 renown: the cursed relic is destroyed for the world's good",
        gold: 0,
        renown: 12,
        effects: [{ kind: "destroyRelic" }]
      },
      {
        label: "Sell It Dark",
        tooltip: "+80 gold, -15 renown: the relic finds a buyer of questionable faith",
        gold: 80,
        renown: -15
      }
    ]
  },
  restive_quarter: {
    id: "restive_quarter",
    anchor: "unrest",
    title: "The Restive Quarter",
    text: "{burg} simmers against {state}; the watch begs the Guild for medics and grain.",
    choices: [
      {
        label: "Send Medics",
        tooltip: "-35 gold, +8 renown: the Guild calms the quarter and its unrest",
        gold: -35,
        renown: 8,
        effects: [{ kind: "pacifyBurg" }]
      },
      {
        label: "Quarantine the Quarter",
        tooltip: "+15 gold, -5 renown: the Guild sells the watch a list of 'ringleaders'",
        gold: 15,
        renown: -5,
        effects: [{ kind: "unrest", amount: 10 }]
      }
    ]
  },
  lawless_roads: {
    id: "lawless_roads",
    anchor: "unrest",
    title: "Lawless Roads",
    text: "Caravans now avoid {burg} entirely; the merchants' council asks the Guild to guard the roads.",
    choices: [
      {
        label: "Guard the Roads",
        tooltip: "-25 gold, +10 renown: Guild patrols make the roads safe again",
        gold: -25,
        renown: 10,
        effects: [{ kind: "unrest", amount: -10 }]
      },
      {
        label: "Tax the Caravans",
        tooltip: "+30 gold, -5 renown: the Guild sells 'safe conduct' seals of dubious value",
        gold: 30,
        renown: -5,
        effects: [{ kind: "unrest", amount: 5 }]
      }
    ]
  },
  dark_tithe: {
    id: "dark_tithe",
    anchor: "lair",
    title: "The Dark Tithe",
    text: "{lair} offers to spare {province} — if the Guild swears to look away for a season.",
    choices: [
      {
        label: "Refuse the Tribute",
        tooltip: "-20 gold, +12 renown: the Guild falls on the lair instead",
        gold: -20,
        renown: 12,
        effects: [{ kind: "purgeLair" }]
      },
      {
        label: "Take the Tithe",
        tooltip: "+70 gold, -12 renown: the lair's hoard buys the Guild's silence",
        gold: 70,
        renown: -12,
        effects: [{ kind: "unrest", amount: 10 }]
      }
    ]
  },
  war_broker: {
    id: "war_broker",
    anchor: "state",
    title: "The War Broker",
    text: "Envoys crowd the Guild hall: {state} will pay handsomely for friends — or for quiet enemies.",
    choices: [
      {
        label: "Broker Peace",
        tooltip: "-50 gold, +10 renown: Guild envoys pull {state} back from the brink",
        gold: -50,
        renown: 10,
        effects: [{ kind: "unravel", amount: -15 }]
      },
      {
        label: "Sell Blades to Both Sides",
        tooltip: "+70 gold, -12 renown: the Guild arms every banner that can pay",
        gold: 70,
        renown: -12,
        effects: [{ kind: "unravel", amount: 10 }]
      }
    ]
  },
  heretic_preacher: {
    id: "heretic_preacher",
    anchor: "trouble",
    title: "The Heretic Preacher",
    text: "A firebrand rails against {state} in {province}; the magistrates ask the Guild to out-argue them.",
    choices: [
      {
        label: "Win the Disputation",
        tooltip: "-30 gold, +6 renown: a Guild sage wins the crowd and the trouble is quelled",
        gold: -30,
        renown: 6,
        effects: [{ kind: "quellTrouble" }]
      },
      {
        label: "Fund the Schism",
        tooltip: "+45 gold, -8 renown: the Guild launders the preacher's donations",
        gold: 45,
        renown: -8,
        effects: [{ kind: "unravel", amount: 10 }]
      }
    ]
  },
  royal_warrant: {
    id: "royal_warrant",
    anchor: "state",
    title: "The Royal Warrant",
    text: "{state} offers a royal charter binding the Guild to its throne — with a standing retainer.",
    choices: [
      {
        label: "Accept the Warrant",
        tooltip: "0 gold, +20 renown: {state} becomes the Guild's patron",
        gold: 0,
        renown: 20,
        effects: [{ kind: "setPatron" }]
      },
      {
        label: "Stay Independent",
        tooltip: "+15 gold, 0 renown: the Guild keeps its freedom and pockets the signing gift",
        gold: 15,
        renown: 0
      }
    ]
  },
  smugglers_cut: {
    id: "smugglers_cut",
    anchor: "unrest",
    title: "The Smugglers' Cut",
    text: "Smugglers offer the Guild a share to look past the warehouses of {burg}.",
    choices: [
      {
        label: "Crack Down",
        tooltip: "-10 gold, +8 renown: the Guild burns the smuggling ledgers",
        gold: -10,
        renown: 8,
        effects: [{ kind: "unrest", amount: -5 }]
      },
      {
        label: "Take a Cut",
        tooltip: "+35 gold, -6 renown: the Guild's seal now covers certain crates",
        gold: 35,
        renown: -6,
        effects: [{ kind: "unrest", amount: 5 }]
      }
    ]
  },
  old_debt: {
    id: "old_debt",
    anchor: "state",
    title: "The Old Debt",
    text: "{state} asks yet again for more time on its debt to the Guild vault.",
    choices: [
      {
        label: "Forgive the Debt",
        tooltip: "-25 gold, +10 renown: the crown remembers its friends",
        gold: -25,
        renown: 10,
        effects: [{ kind: "unravel", amount: -10 }]
      },
      {
        label: "Collect in Full",
        tooltip: "+55 gold, -8 renown: Guild bailiffs strip the treasury",
        gold: 55,
        renown: -8,
        effects: [{ kind: "unravel", amount: 10 }]
      }
    ]
  }
};

export const getPetitionDef = (id: string | undefined): PetitionDef | undefined =>
  id === undefined ? undefined : PETITION_CATALOG[id];

export const petitionsForAnchor = (anchor: PetitionAnchorKind): PetitionDef[] =>
  Object.values(PETITION_CATALOG).filter(def => def.anchor === anchor);

export interface PetitionContext {
  burg?: string;
  province?: string;
  state?: string;
  lair?: string;
  ruler?: string;
  trouble?: string;
  relic?: string;
}

const PETITION_FALLBACKS: Record<keyof PetitionContext, string> = {
  burg: "the town",
  province: "the province",
  state: "the realm",
  lair: "the raiders",
  ruler: "the ruler",
  trouble: "the trouble",
  relic: "a nameless relic"
};

/** Fill {tokens} in a petition title/text, falling back to generic phrasing */
export function formatPetitionText(template: string, context: PetitionContext): string {
  let text = template;
  for (const key of Object.keys(PETITION_FALLBACKS) as Array<keyof PetitionContext>) {
    text = text.replaceAll(`{${key}}`, context[key] ?? PETITION_FALLBACKS[key]);
  }
  return text;
}
