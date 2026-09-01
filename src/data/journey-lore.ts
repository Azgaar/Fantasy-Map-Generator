/** Where a party travels. `stay` is a halt, not a way of moving, so it is not one of these */
export type TravelDomain = "land" | "water" | "air";

export interface JourneyArchetype {
  /** What kind of travel this is, shown as the journey's type: "Quest", "Raid" */
  type: string;
  /** How often this party turns up, relative to the others */
  weight: number;
  /**
   * How the party travels, weighted per domain — the shape of the whole journey.
   * The heaviest domain is what the party *is*: it steers where the journey starts and which
   * stops it heads for, and the lighter ones are the exception it falls back on. A domain left
   * out never happens. A leg still has to be possible: water needs a port at both ends and a
   * sailable path, land needs a land path, air is never refused.
   */
  domains: Partial<Record<TravelDomain, number>>;
  /**
   * Preferred transport by name, weighted, for each domain the party travels.
   * Names are matched against the configured transports, so a party falls back to what
   * the map actually has. Every domain in `domains` should appear here.
   */
  transports: Partial<Record<TravelDomain, Record<string, number>>>;
  /** Chance a land leg leaves the road network (and travels at the off-road penalty) */
  offRoad: number;
  /** Chance the party stops over at an intermediate burg */
  rest: number;
  /** Chance a long leg is broken by a camp in the wild */
  camp: number;
  /** Journey titles; tokens: {hero} {origin} {destination} {destinationAdjective} {wild} */
  title: string[];
  /** Names for a land leg, in the party's own voice; tokens: {to} {wild}. Falls back to the shared pool */
  leg?: string[];
  /** Names for a night spent in a burg; tokens: {place} */
  stopover: string[];
  /** Names for a night spent in the open; tokens: {wild} */
  bivouac: string[];
}

/** Journeys with no story behind them: a plain trip from A to B */
export const DEFAULT_JOURNEY_TYPE = "Travel";

export const COMPANY_ADJECTIVES = [
  "Iron",
  "Gilded",
  "Silent",
  "Crimson",
  "Wandering",
  "Broken",
  "Grey",
  "Long",
  "Salt",
  "Amber",
  "Thorn",
  "Ashen",
  "Hollow",
  "Winter",
  "Last",
  "Patient",
  "Bronze",
  "Copper",
  "Silver",
  "Golden",
  "Leaden",
  "Scarlet",
  "Sable",
  "Russet",
  "Pale",
  "Bright",
  "Bitter",
  "Quiet",
  "Restless",
  "Weary",
  "Ragged",
  "Faithful",
  "Fearless",
  "Stubborn",
  "Solemn",
  "Steadfast",
  "Vigilant",
  "Wayward",
  "Errant",
  "Crooked",
  "Nameless",
  "Lost",
  "Free",
  "Sworn",
  "Bold",
  "Proud",
  "Cold",
  "Frost",
  "Storm",
  "Ember",
  "Cinder",
  "Flint",
  "Stone",
  "Glass",
  "Bramble",
  "Briar",
  "Starless",
  "Sunless",
  "Hidden",
  "Veiled",
  "Hallowed",
  "Weathered"
];

export const BANNERS = [
  "Hart",
  "Rose",
  "Chalice",
  "Tower",
  "Serpent",
  "Star",
  "Lantern",
  "Owl",
  "Wolf",
  "Falcon",
  "Oak",
  "Key",
  "Lion",
  "Bear",
  "Boar",
  "Stag",
  "Ram",
  "Bull",
  "Hound",
  "Fox",
  "Hare",
  "Adder",
  "Raven",
  "Eagle",
  "Hawk",
  "Swan",
  "Heron",
  "Magpie",
  "Pike",
  "Salmon",
  "Griffin",
  "Wyvern",
  "Dragon",
  "Phoenix",
  "Unicorn",
  "Basilisk",
  "Crown",
  "Crescent",
  "Sun",
  "Moon",
  "Comet",
  "Flame",
  "Anchor",
  "Helm",
  "Gauntlet",
  "Sword",
  "Spear",
  "Arrow",
  "Shield",
  "Chain",
  "Bell",
  "Harp",
  "Horn",
  "Sheaf",
  "Wheel",
  "Anvil",
  "Hammer",
  "Gate",
  "Thistle",
  "Ivy",
  "Yew",
  "Lily",
  "Feather",
  "Antler"
];

export const CARGO = [
  "Salt",
  "Amber",
  "Silk",
  "Spice",
  "Wool",
  "Iron",
  "Wine",
  "Furs",
  "Ivory",
  "Glass",
  "Pearl",
  "Tin",
  "Copper",
  "Bronze",
  "Steel",
  "Silver",
  "Gold",
  "Lead",
  "Flint",
  "Marble",
  "Obsidian",
  "Jade",
  "Lapis",
  "Alum",
  "Saltpetre",
  "Quicksilver",
  "Flax",
  "Linen",
  "Cotton",
  "Velvet",
  "Dye",
  "Indigo",
  "Pepper",
  "Cinnamon",
  "Cloves",
  "Saffron",
  "Incense",
  "Myrrh",
  "Sandalwood",
  "Grain",
  "Barley",
  "Olives",
  "Honey",
  "Cheese",
  "Ale",
  "Mead",
  "Vinegar",
  "Sugar",
  "Tea",
  "Fish",
  "Timber",
  "Charcoal",
  "Coal",
  "Pitch",
  "Tar",
  "Hemp",
  "Wax",
  "Oil",
  "Leather",
  "Hides",
  "Horses",
  "Cattle",
  "Tobacco",
  "Parchment",
  "Ink"
];

export const RELICS = [
  "Crown",
  "Chalice",
  "Codex",
  "Shard",
  "Seal",
  "Blade",
  "Ring",
  "Mask",
  "Horn",
  "Tome",
  "Sceptre",
  "Circlet",
  "Diadem",
  "Torc",
  "Amulet",
  "Talisman",
  "Sigil",
  "Cloak",
  "Mantle",
  "Veil",
  "Gauntlet",
  "Orb",
  "Staff",
  "Rod",
  "Crozier",
  "Spear",
  "Dagger",
  "Bow",
  "Shield",
  "Helm",
  "Hammer",
  "Scroll",
  "Tablet",
  "Grimoire",
  "Chronicle",
  "Ledger",
  "Reliquary",
  "Casket",
  "Coffer",
  "Urn",
  "Vial",
  "Flask",
  "Cup",
  "Lantern",
  "Mirror",
  "Hourglass",
  "Bell",
  "Harp",
  "Key",
  "Chain",
  "Coin",
  "Banner",
  "Throne",
  "Wheel",
  "Stone",
  "Heart",
  "Eye",
  "Tear",
  "Feather",
  "Fang",
  "Egg",
  "Thorn"
];

export const BEASTS = [
  "dragon",
  "wyrm",
  "basilisk",
  "griffin",
  "manticore",
  "troll",
  "werewolf",
  "kraken",
  "chimera",
  "serpent",
  "direwolf",
  "wendigo",
  "wyvern",
  "drake",
  "hydra",
  "cockatrice",
  "salamander",
  "leviathan",
  "harpy",
  "gorgon",
  "minotaur",
  "sphinx",
  "roc",
  "ogre",
  "giant",
  "ettin",
  "yeti",
  "behemoth",
  "colossus",
  "golem",
  "gargoyle",
  "homunculus",
  "banshee",
  "wraith",
  "revenant",
  "ghoul",
  "lich",
  "vampire",
  "wight",
  "draugr",
  "shade",
  "nightmare",
  "kelpie",
  "siren",
  "hellhound",
  "barghest",
  "boggart",
  "sabrecat"
];

export const RANKS = ["Ser", "Dame", "Captain", "Brother", "Sister", "Master", "Mistress", "Old"];

export const TAVERN_QUALIFIERS = [
  "Golden",
  "Crooked",
  "Sleeping",
  "Laughing",
  "Drowned",
  "Rusty",
  "Silver",
  "Hungry",
  "Painted",
  "Old",
  "Weeping",
  "Merry",
  "Broken",
  "Bent",
  "Leaning",
  "Battered",
  "Cracked",
  "Tarnished",
  "Hollow",
  "Dancing",
  "Singing",
  "Whistling",
  "Grinning",
  "Jolly",
  "Roaring",
  "Prancing",
  "Galloping",
  "Thirsty",
  "Drunken",
  "Weary",
  "Idle",
  "Restless",
  "Limping",
  "Blind",
  "Toothless",
  "Green",
  "Blue",
  "Black",
  "White",
  "Scarlet",
  "Copper",
  "Brazen",
  "Gilded",
  "Lucky",
  "Lost",
  "Wayward",
  "Wandering",
  "Quiet",
  "Sly",
  "Fat",
  "Bold",
  "Proud",
  "Hidden",
  "Wild",
  "Salty",
  "Smoky",
  "Frosty"
];

export const TAVERN_SUBJECTS = [
  "Stag",
  "Anchor",
  "Boar",
  "Lantern",
  "Kettle",
  "Griffin",
  "Mermaid",
  "Wheel",
  "Crow",
  "Hound",
  "Bell",
  "Otter",
  "Pilgrim",
  "Gate",
  "Barrel",
  "Cask",
  "Tankard",
  "Flagon",
  "Goblet",
  "Jug",
  "Ladle",
  "Hearth",
  "Smith",
  "Miller",
  "Cooper",
  "Drover",
  "Sailor",
  "Widow",
  "Maiden",
  "Monk",
  "Friar",
  "Knight",
  "Squire",
  "Herald",
  "Minstrel",
  "Piper",
  "Fiddler",
  "Jester",
  "Hammer",
  "Anvil",
  "Plough",
  "Cart",
  "Wagon",
  "Saddle",
  "Horseshoe",
  "Compass",
  "Beacon",
  "Goose",
  "Swan",
  "Magpie",
  "Raven",
  "Rook",
  "Wren",
  "Cat",
  "Fox",
  "Badger",
  "Hare",
  "Ram",
  "Bull",
  "Ox",
  "Pony",
  "Mare",
  "Goat",
  "Salmon",
  "Trout",
  "Pike",
  "Eel",
  "Whale",
  "Crab",
  "Dragon",
  "Wyvern",
  "Unicorn",
  "Phoenix",
  "Serpent",
  "Lion",
  "Bear",
  "Wolf",
  "Star",
  "Moon",
  "Sun",
  "Bridge",
  "Ford",
  "Mill",
  "Well",
  "Oak",
  "Willow",
  "Yew",
  "Thorn",
  "Rose",
  "Thistle",
  "Crown",
  "Sword",
  "Shield",
  "Helm",
  "Arrow",
  "Key",
  "Chain",
  "Boot",
  "Glove",
  "Cloak",
  "Purse",
  "Coin"
];

export const NAMELESS = [
  "Aldric",
  "Marek",
  "Ysolde",
  "Corvin",
  "Nadia",
  "Halvar",
  "Ilona",
  "Tarrin",
  "Sable",
  "Ostrik"
];

export const HIGHLAND_TERMS = ["mountains", "mountain passes"];
export const UPLAND_TERMS = ["hills", "highlands"];
export const UNKNOWN_WILD = "wilderness";

export const BIOME_TERMS: Record<string, string> = {
  Marine: "open water",
  "Hot desert": "desert",
  "Cold desert": "cold desert",
  Savanna: "savanna",
  Grassland: "grasslands",
  "Tropical seasonal forest": "jungle",
  "Temperate deciduous forest": "forest",
  "Tropical rainforest": "rainforest",
  "Temperate rainforest": "rainforest",
  Taiga: "pine forest",
  Tundra: "tundra",
  Glacier: "ice",
  Wetland: "marshes"
};

export const LEG_NAMES = {
  air: {
    first: ["Takeoff from {from}", "Up over the {wild}", "Leaving {from} by air"],
    second: ["Landing at {to}", "Down to {to}", "Approach to {to}"],
    whole: ["Flight to {to}", "Over the {wild} to {to}", "{from} to {to} by air", "Air route to {to}"]
  },
  water: {
    first: ["Out of {from} port", "Sailing from {from}", "Leaving {from} by sea"],
    second: ["Landing at {to}", "Into {to} port", "Last stretch to {to}"],
    whole: ["Sailing to {to}", "By sea to {to}", "Across {water} to {to}", "{from} to {to} by sea"]
  },
  land: {
    first: ["Into the {wild}", "Out of {from} into the {wild}", "{from} to the {wild}"],
    second: ["On to {to}", "Out of the {wild} to {to}", "Last stretch to {to}"],
    offRoadLast: ["Off-road to {to}", "Out of the {wild} to {to}", "Into {to} the back way"],
    offRoad: ["Off-road to {to}", "Through the {wild}", "Across the {wild} to {to}", "Around the road to {to}"],
    opening: ["Out of {from}", "{from} to {to}", "The road from {from}", "Setting out for {to}"],
    closing: ["Last miles to {to}", "The road into {to}", "Down to {to}"],
    whole: ["{from} to {to}", "On to {to}", "The road to {to}", "The {wild} road"]
  }
};

/** Names for the stops no archetype speaks for */
export const HALT_NAMES = {
  muster: ["Gathering in {place}", "Getting supplies in {place}", "Meeting at {tavern}"],
  /** A party taking passage on someone else's ship */
  harborWait: ["Waiting for a ship in {from}", "Held up in {from} port", "Booking passage in {from}"],
  /** A party sailing its own: it waits on the tide and the loading, not on a berth */
  castingOff: ["Loading at {from} quay", "Tide and weather in {from}", "Making ready in {from} port"],
  /** A night at sea within reach of a named place, and out of sight of one */
  anchoredNear: ["Anchored {label}", "A night at anchor {label}", "Stopped {label}"],
  anchored: ["Night at anchor", "A night out on {water}", "Anchored till morning"],
  /** A camp within reach of a named place; the party's own bivouac names join these */
  campNear: ["Camp {label}", "A night {label}"]
};

export const JOURNEY_ARCHETYPES: Record<string, JourneyArchetype> = {
  heroes: {
    type: "Quest",
    weight: 10,
    domains: { land: 7, water: 2 },
    transports: {
      land: { "On foot (light)": 4, "Horseback (no spare horse)": 4, Carriage: 1 },
      water: { "Sailing boat": 3, "Sailing Ship": 2, Rowboat: 1 }
    },
    offRoad: 0.4,
    rest: 0.7,
    camp: 0.7,
    title: [
      "The Company of the {company} {banner}",
      "The Quest of {rank} {hero}",
      "{hero}'s Company",
      "The {company} {banner} rides to {destination}",
      "{hero} and the road through the {wild}"
    ],
    leg: ["The road to {to}", "Through the {wild}", "Riding for {to}"],
    stopover: ["A night at {tavern}", "Rumours in {place}", "Resupply in {place}"],
    bivouac: ["Camp in the {wild}", "Watches kept in the {wild}", "A fire in the {wild}"]
  },

  wanderer: {
    type: "Wandering",
    weight: 4,
    domains: { land: 8, water: 2 },
    transports: {
      land: { "On foot (light)": 5, "On foot (laden)": 2, "Horseback (no spare horse)": 1 },
      water: { Rowboat: 3, "Sailing boat": 2, "Sailing Ship": 1 }
    },
    offRoad: 0.5,
    rest: 0.6,
    camp: 0.7,
    title: [
      "{rank} {hero} of {origin}",
      "The Long Road of {hero}",
      "{hero} walks to {destination}",
      "The {company} Wanderer"
    ],
    leg: ["Walking to {to}", "Alone to {to}", "The road to {to}"],
    stopover: ["A bed at {tavern}", "Working for board in {place}", "A night in {place}"],
    bivouac: ["Sleeping rough in the {wild}", "A cold night in the {wild}", "Alone in the {wild}"]
  },

  caravan: {
    type: "Caravan",
    weight: 4,
    domains: { land: 6, water: 3 },
    transports: {
      land: { Carriage: 3, "On foot (laden)": 1 },
      water: { "Sailing Ship": 4, "Sailing boat": 1 }
    },
    offRoad: 0.1,
    rest: 0.8,
    camp: 0.4,
    title: [
      "The {company} Caravan",
      "{cargo} Road to {destination}",
      "The {origin} Caravan",
      "{cargo} out of {origin}"
    ],
    leg: ["Hauling to {to}", "The road to {to}", "Toll road to {to}"],
    stopover: ["Wagon yard at {tavern}", "A night at {tavern}", "Market day in {place}"],
    bivouac: ["Wagons circled in the {wild}", "Night halt in the {wild}", "Cold camp in the {wild}"]
  },

  campaign: {
    type: "Military campaign",
    weight: 4,
    domains: { land: 7, water: 3 },
    transports: {
      land: { "On foot (laden)": 5, "Horseback (no spare horse)": 3, Carriage: 1 },
      water: { "Sailing Ship": 5, "Sailing boat": 1 }
    },
    offRoad: 0.25,
    rest: 0.5,
    camp: 0.8,
    title: [
      "The March on {destination}",
      "{rank} {hero}'s Host",
      "The {destinationAdjective} Campaign",
      "The {company} Host"
    ],
    leg: ["March on {to}", "The column crosses the {wild}", "Forced march to {to}"],
    stopover: ["Billeted in {place}", "Requisitions in {place}", "{place} opens its gates"],
    bivouac: ["War camp in the {wild}", "Pickets set in the {wild}", "Night muster in the {wild}"]
  },

  embassy: {
    type: "Embassy",
    weight: 2,
    domains: { land: 6, water: 4 },
    transports: {
      land: { Carriage: 4, Stagecoach: 3, "Horseback (no spare horse)": 3, "On foot (light)": 1 },
      water: { "Sailing Ship": 5, "Sailing boat": 1 }
    },
    offRoad: 0.05,
    rest: 0.9,
    camp: 0.25,
    title: [
      "Embassy to {destination}",
      "The {destinationAdjective} Mission",
      "{rank} {hero} goes to {destination}",
      "Errand to the court of {destination}"
    ],
    stopover: ["Guested at {tavern}", "Audience in {place}", "Two nights in {place}"],
    bivouac: ["Escort camp in the {wild}", "Night under guard in the {wild}"]
  },

  pilgrimage: {
    type: "Pilgrimage",
    weight: 4,
    domains: { land: 8, water: 2 },
    transports: {
      land: { "On foot (laden)": 4, "On foot (light)": 3, "Horseback (no spare horse)": 1 },
      water: { "Sailing boat": 3, "Sailing Ship": 2, Rowboat: 1 }
    },
    offRoad: 0.35,
    rest: 0.7,
    camp: 0.6,
    title: [
      "Pilgrimage to {destination}",
      "The {company} Pilgrims",
      "The Long Walk to {destination}",
      "{rank} {hero} walks to {destination}"
    ],
    leg: ["Barefoot to {to}", "On to {to}", "The pilgrim road to {to}"],
    stopover: ["Alms and rest at {tavern}", "Vigil in {place}", "Shelter in {place}"],
    bivouac: ["Vigil in the {wild}", "Night prayer in the {wild}", "Sleeping rough in the {wild}"]
  },

  mercenaries: {
    type: "Mercenary contract",
    weight: 3,
    domains: { land: 7, water: 3 },
    transports: {
      land: { "Horseback (no spare horse)": 5, "On foot (laden)": 3, "Horseback (spare horse)": 1, Carriage: 1 },
      water: { "Sailing Ship": 4, "Sailing boat": 2 }
    },
    offRoad: 0.3,
    rest: 0.6,
    camp: 0.6,
    title: [
      "The {company} Blades",
      "{hero}'s Free Company",
      "Contract to {destination}",
      "The {company} {banner} takes coin in {destination}"
    ],
    leg: ["Riding for {to}", "Paid road to {to}", "On to {to}"],
    stopover: ["Drinking the advance at {tavern}", "Recruiting in {place}", "Paid off in {place}"],
    bivouac: ["Camp in the {wild}", "Cold camp in the {wild}", "Dice and watches in the {wild}"]
  },

  courier: {
    type: "Courier ride",
    weight: 3,
    domains: { land: 7, water: 3 },
    transports: {
      land: { "Horseback (spare horse)": 3, Stagecoach: 1, "On foot (light)": 1 },
      water: { "Sailing boat": 3, "Sailing Ship": 3 }
    },
    offRoad: 0.15,
    rest: 0.5,
    camp: 0.3,
    title: [
      "The Ride to {destination}",
      "News out of {origin}",
      "{hero} carries word to {destination}",
      "The {company} Post"
    ],
    leg: ["Hard riding to {to}", "Fast road to {to}", "Post road to {to}"],
    stopover: ["Change of horses in {place}", "Three hours at {tavern}", "Fresh mount in {place}"],
    bivouac: ["Snatched sleep in the {wild}", "Horse rested in the {wild}"]
  },

  expedition: {
    type: "Expedition",
    weight: 3,
    domains: { land: 7, water: 3 },
    transports: {
      land: { "On foot (laden)": 5, "Horseback (no spare horse)": 2, "On foot (light)": 1 },
      water: { "Sailing boat": 3, "Sailing Ship": 2, Rowboat: 1 }
    },
    offRoad: 0.7,
    rest: 0.5,
    camp: 0.8,
    title: [
      "Expedition to the {wild}",
      "The {company} Expedition",
      "Survey of the {wild}",
      "{rank} {hero}'s survey of the road to {destination}"
    ],
    leg: ["Mapping the {wild}", "Into the {wild}", "Traverse to {to}"],
    stopover: ["Resupply in {place}", "Notes and repairs at {tavern}", "Hired guides in {place}"],
    bivouac: ["Base camp in the {wild}", "Survey camp in the {wild}", "Weathered in on the {wild}"]
  },

  refugees: {
    type: "Refugee flight",
    weight: 3,
    domains: { land: 6, water: 3 },
    transports: {
      land: { "On foot (laden)": 7, Carriage: 2, "On foot (light)": 1 },
      water: { Rowboat: 3, "Sailing boat": 2, "Sailing Ship": 1 }
    },
    offRoad: 0.4,
    rest: 0.5,
    camp: 0.8,
    title: [
      "The Road out of {origin}",
      "{origin} on the Move",
      "The {company} Column",
      "Seeking shelter in {destination}"
    ],
    leg: ["Trudging to {to}", "The long walk to {to}", "On to {to}"],
    stopover: ["Turned away at {place}", "Bread and straw in {place}", "Counting the missing in {place}"],
    bivouac: ["Camp in the {wild}", "A hungry night in the {wild}", "Burying the dead in the {wild}"]
  },

  relicseekers: {
    type: "Treasure hunt",
    weight: 3,
    domains: { land: 7, water: 3 },
    transports: {
      land: { "On foot (light)": 4, "Horseback (no spare horse)": 3, "On foot (laden)": 1 },
      water: { "Sailing boat": 3, "Sailing Ship": 2 }
    },
    offRoad: 0.6,
    rest: 0.6,
    camp: 0.7,
    title: [
      "The Search for the {relic}",
      "{hero} and the {relic}",
      "The {relic} lies in the {wild}",
      "Digging for the {relic}"
    ],
    leg: ["Following the map into the {wild}", "On to {to}", "Old roads to {to}"],
    stopover: ["Buying rumours at {tavern}", "Bribing a clerk in {place}", "Lying low in {place}"],
    bivouac: ["Camp in the {wild}", "Reading the map in the {wild}", "A watchful night in the {wild}"]
  },

  monsterhunt: {
    type: "Monster hunt",
    weight: 3,
    domains: { land: 8, water: 2 },
    transports: {
      land: { "Horseback (no spare horse)": 4, "On foot (light)": 4, "On foot (laden)": 1 },
      water: { "Sailing boat": 3, Rowboat: 2, "Sailing Ship": 1 }
    },
    offRoad: 0.65,
    rest: 0.6,
    camp: 0.7,
    title: [
      "The Hunt for the {wild} {beast}",
      "{rank} {hero} hunts the {beast}",
      "The {beast} of {destination}",
      "Bounty on the {beast}"
    ],
    leg: ["Following the trail into the {wild}", "The kills lead to {to}", "Tracking to {to}"],
    stopover: ["Questioning the locals in {place}", "Bounty posted in {place}", "A night at {tavern}"],
    bivouac: ["Blind camp in the {wild}", "Bait set in the {wild}", "No fire tonight — {wild}"]
  },

  exiles: {
    type: "Exile's flight",
    weight: 2,
    domains: { water: 6, land: 4 },
    transports: {
      land: { "On foot (laden)": 5, Carriage: 2, "On foot (light)": 2, "Horseback (no spare horse)": 1 },
      water: { Rowboat: 3, "Sailing boat": 2, "Sailing Ship": 2 }
    },
    offRoad: 0.6,
    rest: 0.4,
    camp: 0.7,
    title: [
      "Flight from {origin}",
      "The {company} Exiles",
      "Exodus from {origin}",
      "{hero} is banished to {destination}"
    ],
    stopover: ["Hidden a night in {place}", "Begging bread in {place}", "Back room of {tavern}"],
    bivouac: ["Fireless camp in the {wild}", "Hiding in the {wild}", "A cold night in the {wild}"]
  },

  smugglers: {
    type: "Smuggling run",
    weight: 2,
    domains: { water: 6, land: 4 },
    transports: {
      land: { "On foot (light)": 3, "Horseback (no spare horse)": 3, "On foot (laden)": 1, Carriage: 1 },
      water: { Rowboat: 4, "Sailing boat": 3, "Sailing Ship": 1 }
    },
    offRoad: 0.8,
    rest: 0.35,
    camp: 0.6,
    title: ["The {company} Run", "Smugglers' road to {destination}", "The {cargo} Run", "Untaxed to {destination}"],
    leg: ["Quiet road to {to}", "Around the tollgates to {to}", "Night haul to {to}"],
    stopover: ["Lying low at {tavern}", "Unloading quietly in {place}", "Palms greased in {place}"],
    bivouac: ["Cache dug in the {wild}", "No fire, no names — {wild}", "Waiting out the patrol in the {wild}"]
  },

  raiders: {
    type: "Raid",
    weight: 2,
    domains: { water: 8, land: 2 },
    transports: {
      land: { "On foot (light)": 4, "Horseback (spare horse)": 3, "Horseback (no spare horse)": 1 },
      water: { "Sailing Ship": 4, "Sailing boat": 3, Rowboat: 1 }
    },
    offRoad: 0.6,
    rest: 0.3,
    camp: 0.6,
    title: ["The {company} Reavers", "{hero}'s Raid", "Raid on {destination}", "The {origin} Keels"],
    leg: ["Falling on {to}", "Overland to {to}", "Driving the herd to {to}"],
    stopover: ["Dividing the take in {place}", "Selling the plunder in {place}", "Drinking {place} dry"],
    bivouac: ["Beach camp in the {wild}", "Keel hauled up in the {wild}", "A watchful night in the {wild}"]
  },

  progress: {
    type: "Royal progress",
    weight: 2,
    domains: { land: 7, water: 3 },
    transports: {
      land: { Carriage: 6, Stagecoach: 3, "Horseback (no spare horse)": 3, "On foot (laden)": 1 },
      water: { "Sailing Ship": 6, "Sailing boat": 1 }
    },
    offRoad: 0.02,
    rest: 0.95,
    camp: 0.1,
    title: [
      "The Progress of {rank} {hero}",
      "The {destinationAdjective} Progress",
      "The Crown rides out of {origin}",
      "The {company} Progress"
    ],
    leg: ["The royal road to {to}", "Received at {to}", "Procession to {to}"],
    stopover: ["Feasted in {place}", "Court held in {place}", "Stay in {place}"],
    bivouac: ["Pavilions raised in the {wild}", "The hunt camps in the {wild}"]
  },

  skyfarers: {
    type: "Airship voyage",
    weight: 2,
    domains: { air: 12, land: 1, water: 1 },
    transports: {
      land: { "Horseback (no spare horse)": 3, "On foot (light)": 2 },
      water: { "Sailing boat": 2, "Sailing Ship": 2 },
      air: { Dirigible: 6, Teleport: 1 }
    },
    offRoad: 0.1,
    rest: 0.2,
    camp: 0.1,
    title: [
      "The {company} Airship",
      "{hero} sails over {origin}",
      "Skyroad to {destination}",
      "The {banner} takes to the air"
    ],
    leg: ["Over the {wild} to {to}", "Above the {wild}", "Sky lane to {to}"],
    stopover: ["Moored over {place}", "Gas and ballast in {place}", "A night at {tavern}"],
    bivouac: ["Grounded in the {wild}", "Repairs in the {wild}", "Anchored above the {wild}"]
  },

  arcanists: {
    type: "Arcane errand",
    weight: 2,
    domains: { land: 4, air: 3, water: 1 },
    transports: {
      land: { "On foot (light)": 3, "Horseback (no spare horse)": 2, Carriage: 1 },
      water: { "Sailing boat": 2, "Sailing Ship": 1 },
      air: { Teleport: 4, Dirigible: 1 }
    },
    offRoad: 0.4,
    rest: 0.5,
    camp: 0.3,
    title: [
      "The {company} Circle",
      "{rank} {hero} carries the {relic}",
      "The {relic} must reach {destination}",
      "{hero} steps out of {origin}",
      "The short road to {destination}"
    ],
    leg: ["Warding the road to {to}", "Through the {wild} unseen", "The long way round to {to}"],
    stopover: ["Reading the signs in {place}", "A sealed room at {tavern}", "A night of study in {place}"],
    bivouac: ["A circle drawn in the {wild}", "Wards set in the {wild}", "A silent camp in the {wild}"]
  }
};
