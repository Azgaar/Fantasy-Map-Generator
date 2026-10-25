// The anomalies reading: every marker type as the sector chart calls it. Presentation only — the
// marker keeps its fantasy type in state. See docs/plans/astral-anomalies.md

export interface MarkerReading {
  /** the astral name of the anomaly kind */
  reading: string;
  /** the emoji drawn in the pin while Astral is on */
  icon: string;
}

/** One reading per default marker config type: a phenomenon of space or of interstellar scale */
export const MARKER_READINGS: Record<string, MarkerReading> = {
  volcanoes: { reading: "nova remnants", icon: "💥" },
  "hot-springs": { reading: "plasma plumes", icon: "♨️" },
  "water-sources": { reading: "ice claims", icon: "🧊" },
  mines: { reading: "mines", icon: "⛏️" },
  bridges: { reading: "lane spans", icon: "🌉" },
  inns: { reading: "way stations", icon: "🛎️" },
  lighthouses: { reading: "beacon relays", icon: "🚨" },
  waterfalls: { reading: "plasma falls", icon: "⚡" },
  battlefields: { reading: "wreck fields", icon: "⚔️" },
  dungeons: { reading: "derelicts", icon: "🛰️" },
  "lake-monsters": { reading: "drift leviathans", icon: "🐋" },
  "sea-monsters": { reading: "void krakens", icon: "🦑" },
  "hill-monsters": { reading: "swarm fronts", icon: "🐜" },
  "sacred-mountains": { reading: "shrine worlds", icon: "🛕" },
  "sacred-forests": { reading: "garden worlds", icon: "🌳" },
  "sacred-pineries": { reading: "preserve worlds", icon: "🌲" },
  "sacred-palm-groves": { reading: "oasis worlds", icon: "🌴" },
  brigands: { reading: "lane raiders", icon: "💰" },
  pirates: { reading: "void pirates", icon: "🏴‍☠️" },
  statues: { reading: "precursor idols", icon: "🗿" },
  ruins: { reading: "ruins", icon: "🏺" },
  libraries: { reading: "data archives", icon: "📚" },
  circuses: { reading: "spectacle stations", icon: "🎪" },
  jousts: { reading: "tournaments", icon: "🤺" },
  fairs: { reading: "trade fairs", icon: "🎠" },
  canoes: { reading: "courier shuttles", icon: "🛶" },
  migration: { reading: "void migrations", icon: "🐗" },
  dances: { reading: "festivals", icon: "💃🏽" },
  mirage: { reading: "sensor mirages", icon: "💦" },
  caves: { reading: "hollows", icon: "🦇" },
  portals: { reading: "wormholes", icon: "🌀" },
  rifts: { reading: "rifts", icon: "🎆" },
  "disturbed-burials": { reading: "grave fields", icon: "💀" },
  necropolises: { reading: "necropolises", icon: "🪦" },
  encounters: { reading: "encounters", icon: "🛸" },
  party: { reading: "party", icon: "🚩" }
};

/** The anomaly a marker type reads as; a user-typed kind reads as itself */
export function readingOf(type: string | undefined): MarkerReading | undefined {
  return type ? MARKER_READINGS[type] : undefined;
}

/** Marks a converted legend: the original text is kept below it, and its presence is the idempotency check */
export const ANOMALY_DIVIDER = "<hr>";

/** The anomaly family a type's legend is written from */
export const ANOMALY_FAMILIES: Record<string, string> = {
  volcanoes: "remnants",
  "hot-springs": "plumes",
  "water-sources": "resources",
  mines: "resources",
  bridges: "lanes",
  lighthouses: "lanes",
  inns: "stations",
  circuses: "stations",
  jousts: "stations",
  fairs: "stations",
  canoes: "stations",
  dances: "stations",
  dungeons: "derelicts",
  "lake-monsters": "voidlife",
  "sea-monsters": "voidlife",
  "hill-monsters": "voidlife",
  migration: "voidlife",
  "sacred-mountains": "worlds",
  "sacred-forests": "worlds",
  "sacred-pineries": "worlds",
  "sacred-palm-groves": "worlds",
  brigands: "raiders",
  pirates: "raiders",
  statues: "relics",
  ruins: "relics",
  libraries: "relics",
  waterfalls: "phenomena",
  mirage: "phenomena",
  caves: "phenomena",
  portals: "phenomena",
  rifts: "phenomena",
  battlefields: "wrecks",
  "disturbed-burials": "burials",
  necropolises: "burials",
  encounters: "encounters",
  party: "encounters"
};

/** Two seeded picks form a legend: a lead line and a coda, so kinds differ but each marker stays stable */
const ANOMALY_LEGENDS: Record<string, { leads: string[]; codas: string[] }> = {
  remnants: {
    leads: [
      "The star died here, and its shell still glows.",
      "A dead star's shell drifts across the lane, hot to the sensors.",
      "The remnant of a nova turns slowly at the chart's edge."
    ],
    codas: [
      "Its wake strips shields and seeds the dark with iron.",
      "Salvagers work the shell when the radiation falls.",
      "Whoever plots a lane through it pays in hull."
    ]
  },
  plumes: {
    leads: [
      "A column of plasma climbs out of the dark.",
      "Vents of ionized gas streak the void.",
      "A plume of charged gas rises where nothing should be."
    ],
    codas: [
      "It blinds sensors for a dozen systems.",
      "The currents bend around it, and the lanes with them.",
      "Fleets cross it only under full shielding."
    ]
  },
  resources: {
    leads: [
      "A field of comet ice hangs here, unclaimed.",
      "The belt is rich and worked.",
      "Ice, water and fuel, enough for a fleet."
    ],
    codas: [
      "Every empire in reach has a claim and a garrison.",
      "The miners sell to whoever holds the lane.",
      "Its contracts are worth more than its ore."
    ]
  },
  lanes: {
    leads: [
      "A span crosses the current, held by toll.",
      "The beacons stand in a line across the dark.",
      "A chain of lights marks the safe passage."
    ],
    codas: [
      "Cut it and a sector goes dark.",
      "The keepers answer to no single empire.",
      "Its tolls pay for the fleet that holds it."
    ]
  },
  stations: {
    leads: [
      "A station hangs at the lane's junction.",
      "Crowds come from every system for the season.",
      "Small craft run the current with post and cargo."
    ],
    codas: [
      "Every fleet stops, and every fleet pays.",
      "Politics is done here off the record.",
      "The docks are never quiet."
    ]
  },
  derelicts: {
    leads: [
      "A dead station tumbles here, dark and open.",
      "The hulk has drifted since the fall.",
      "A derelict hangs in the void, its reactors cold."
    ],
    codas: [
      "Its corridors are open to anyone with a suit.",
      "Salvagers strip it a hold at a time.",
      "Something aboard still draws power."
    ]
  },
  voidlife: {
    leads: [
      "Something vast moves in the dark.",
      "The herd crosses the system in a slow tide.",
      "A swarm has stripped this region and moved on."
    ],
    codas: [
      "The lane reroutes around it.",
      "Hunters follow, and the hunters' hunters.",
      "Nothing here grows back quickly."
    ]
  },
  worlds: {
    leads: [
      "A world kept whole by treaty.",
      "Pilgrims cross a dozen systems to reach it.",
      "The last green for a long way in any direction."
    ],
    codas: [
      "Harm it and the empires answer together.",
      "Its keepers speak for the biosphere, not the polity.",
      "Its chart entry is a promise, not a claim."
    ]
  },
  raiders: {
    leads: [
      "Raiders work the current from a hidden base.",
      "A pirate fleet holds this stretch of lane.",
      "Ships vanish here with their cargo."
    ],
    codas: [
      "No empire claims it and every empire suffers it.",
      "The bounty is high and the hunters wary.",
      "Trade reroutes until someone clears it."
    ]
  },
  relics: {
    leads: [
      "The precursors left something here.",
      "A dead civilisation's works lie open to the void.",
      "An archive older than any empire sits here."
    ],
    codas: [
      "Its keepers decide who may read it.",
      "Every polity wants the claim and none will share it.",
      "The past is the only thing on the chart worth more than the future."
    ]
  },
  phenomena: {
    leads: [
      "The void does something here that it should not.",
      "A tear in space hangs open, steady as a star.",
      "Readings lie here; trust the charts, not the sensors."
    ],
    codas: [
      "It is studied, avoided, and worth a war.",
      "Both ends are held by different empires.",
      "Fleets that enter are not always the fleets that leave."
    ]
  },
  wrecks: {
    leads: [
      "The debris of a fleet battle drifts here.",
      "Wrecks lie thick where two empires met.",
      "A battlefield's bones still turn in the dark."
    ],
    codas: [
      "Salvage crews work it under arms.",
      "The victors never collected their dead.",
      "It is a graveyard and a marketplace."
    ]
  },
  burials: {
    leads: [
      "Tomb-ships hold orbit here, silent and sealed.",
      "A necropolis world turns without a single light.",
      "The dead were given the void, and the void kept them."
    ],
    codas: [
      "Disturbing it is taboo, and profitable.",
      "Pilgrims come; looters come after.",
      "The keepers do not answer hails."
    ]
  },
  encounters: {
    leads: [
      "A signal comes out of the dark.",
      "A distress call repeats on every band.",
      "The expedition's marker: here, now."
    ],
    codas: [
      "First contact is never twice the same.",
      "Whoever answers first sets the terms.",
      "The log will remember this place."
    ]
  }
};

/** The astral legend for a marker type, stable for its seed; undefined for a kind without a reading */
export function astralLegend(type: string, seed: string): string | undefined {
  const family = ANOMALY_FAMILIES[type];
  const legend = family ? ANOMALY_LEGENDS[family] : undefined;
  if (!legend) return undefined;
  return `${pick(legend.leads, seed)} ${pick(legend.codas, `${seed}|coda`)}`;
}

/** A stable pick from a list, seeded by a string (the same hash as the polity words) */
function pick(words: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return words[hash % words.length];
}
