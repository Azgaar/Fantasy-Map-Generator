export interface JourneyArchetype {
  /** What kind of travel this is, shown as the journey's type: "Quest", "Raid" */
  type: string;
  /** How often this party turns up, relative to the others */
  weight: number;
  /** Chance a land leg leaves the road network (and travels at the off-road penalty) */
  offRoad: number;
  /** Chance a leg between two ports is sailed rather than walked */
  sea: number;
  /** Chance a leg is flown instead — reserved for parties that can */
  air?: number;
  /** Chance the party stops over at an intermediate burg */
  rest: number;
  /** Chance a long leg is broken by a camp in the wild */
  camp: number;
  /** Preferred transport by name, weighted; resolved against pack.transportTypes */
  land: Record<string, number>;
  water: Record<string, number>;
  /** Air-domain transport, for the parties that fly */
  sky?: Record<string, number>;
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
  "Patient"
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
  "Key"
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
  "Tin"
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
  "Sceptre"
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
  "wendigo"
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
  "Merry"
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
  "Gate"
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
  harborWait: ["Waiting for a ship in {from}", "Held up in {from} port", "Booking passage in {from}"],
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
    offRoad: 0.45,
    sea: 0.3,
    rest: 0.7,
    camp: 0.7,
    land: { "On Foot": 4, Horse: 4, Carriage: 1 },
    water: { Boat: 3, Ship: 2 },
    title: [
      "{rank} {hero} and the Company of the {company} {banner}",
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
    weight: 6,
    offRoad: 0.5,
    sea: 0.25,
    rest: 0.6,
    camp: 0.7,
    land: { "On Foot": 4, Horse: 3 },
    water: { Boat: 4, Ship: 1 },
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
    weight: 6,
    offRoad: 0.1,
    sea: 0.35,
    rest: 0.8,
    camp: 0.4,
    land: { Carriage: 5, Horse: 3, "On Foot": 1 },
    water: { Ship: 4, Boat: 1 },
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
    offRoad: 0.25,
    sea: 0.3,
    rest: 0.5,
    camp: 0.8,
    land: { "On Foot": 5, Horse: 3, Carriage: 1 },
    water: { Ship: 5, Boat: 1 },
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
    weight: 4,
    offRoad: 0.05,
    sea: 0.4,
    rest: 0.9,
    camp: 0.25,
    land: { Horse: 4, Carriage: 4, "On Foot": 1 },
    water: { Ship: 5, Boat: 1 },
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
    offRoad: 0.35,
    sea: 0.2,
    rest: 0.7,
    camp: 0.6,
    land: { "On Foot": 6, Horse: 1 },
    water: { Boat: 3, Ship: 2 },
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
    offRoad: 0.3,
    sea: 0.35,
    rest: 0.6,
    camp: 0.6,
    land: { Horse: 5, "On Foot": 3, Carriage: 1 },
    water: { Ship: 4, Boat: 2 },
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
    offRoad: 0.15,
    sea: 0.3,
    rest: 0.5,
    camp: 0.3,
    land: { Horse: 8, Carriage: 1 },
    water: { Boat: 3, Ship: 3 },
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
    offRoad: 0.7,
    sea: 0.3,
    rest: 0.5,
    camp: 0.8,
    land: { "On Foot": 4, Horse: 3 },
    water: { Boat: 3, Ship: 2 },
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
    offRoad: 0.4,
    sea: 0.35,
    rest: 0.5,
    camp: 0.8,
    land: { "On Foot": 7, Carriage: 2 },
    water: { Boat: 4, Ship: 2 },
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
    offRoad: 0.6,
    sea: 0.3,
    rest: 0.6,
    camp: 0.7,
    land: { "On Foot": 4, Horse: 3 },
    water: { Boat: 3, Ship: 2 },
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
    offRoad: 0.65,
    sea: 0.2,
    rest: 0.6,
    camp: 0.7,
    land: { Horse: 4, "On Foot": 4 },
    water: { Boat: 3, Ship: 1 },
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
    offRoad: 0.6,
    sea: 0.6,
    rest: 0.4,
    camp: 0.7,
    land: { "On Foot": 5, Carriage: 2, Horse: 2 },
    water: { Boat: 3, Ship: 3 },
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
    offRoad: 0.8,
    sea: 0.7,
    rest: 0.35,
    camp: 0.6,
    land: { "On Foot": 3, Horse: 3, Carriage: 1 },
    water: { Boat: 5, Ship: 2 },
    title: ["The {company} Run", "Smugglers' road to {destination}", "The {cargo} Run", "Untaxed to {destination}"],
    leg: ["Quiet road to {to}", "Around the tollgates to {to}", "Night haul to {to}"],
    stopover: ["Lying low at {tavern}", "Unloading quietly in {place}", "Palms greased in {place}"],
    bivouac: ["Cache dug in the {wild}", "No fire, no names — {wild}", "Waiting out the patrol in the {wild}"]
  },

  raiders: {
    type: "Raid",
    weight: 2,
    offRoad: 0.6,
    sea: 0.85,
    rest: 0.3,
    camp: 0.6,
    land: { "On Foot": 4, Horse: 2 },
    water: { Ship: 4, Boat: 4 },
    title: ["The {company} Reavers", "{hero}'s Raid", "Raid on {destination}", "The {origin} Keels"],
    leg: ["Falling on {to}", "Overland to {to}", "Driving the herd to {to}"],
    stopover: ["Dividing the take in {place}", "Selling the plunder in {place}", "Drinking {place} dry"],
    bivouac: ["Beach camp in the {wild}", "Keel hauled up in the {wild}", "A watchful night in the {wild}"]
  },

  progress: {
    type: "Royal progress",
    weight: 2,
    offRoad: 0.02,
    sea: 0.3,
    rest: 0.95,
    camp: 0.1,
    land: { Carriage: 8, Horse: 3 },
    water: { Ship: 6, Boat: 1 },
    title: [
      "The Progress of {rank} {hero}",
      "The {destinationAdjective} Progress",
      "The Crown rides out of {origin}",
      "The {company} Progress"
    ],
    leg: ["The royal road to {to}", "Received at {to}", "Procession to {to}"],
    stopover: ["Feasted in {place}", "Court held in {place}", "Three nights in {place}"],
    bivouac: ["Pavilions raised in the {wild}", "The hunt camps in the {wild}"]
  },

  skyfarers: {
    type: "Airship voyage",
    weight: 2,
    offRoad: 0.3,
    sea: 0.2,
    air: 0.65,
    rest: 0.6,
    camp: 0.4,
    land: { Horse: 3, "On Foot": 2 },
    water: { Boat: 2, Ship: 2 },
    sky: { Airship: 5 },
    title: [
      "The {company} Airship",
      "{hero} sails over {origin}",
      "Skyroad to {destination}",
      "The {banner} takes to the air"
    ],
    leg: ["Over the {wild} to {to}", "Above the {wild}", "Sky lane to {to}"],
    stopover: ["Moored over {place}", "Gas and ballast in {place}", "A night at {tavern}"],
    bivouac: ["Grounded in the {wild}", "Repairs in the {wild}", "Anchored above the {wild}"]
  }
};
