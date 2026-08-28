/**
 * Story-driven journey generation.
 *
 * A journey is built party-first: an archetype is picked — a caravan, an embassy,
 * a band of exiles — and it decides how the route is planned (roads or wilderness,
 * ship or hoof or airship, how often they stop) and supplies every name the
 * itinerary shows. The geometry is real: every leg comes out of the same pathfinder
 * the editor uses, so the result is an itinerary the user can open and edit.
 *
 * Add a party to buildArchetypes and it starts appearing on new maps.
 */

import type { JouneySegment, Journey, JourneyPoint, TransportDomain, TransportType } from "@/types/Journey";
import { getAdjective, P, ra, rand, rw } from "@/utils";
import { cellEndpointLabel } from "@/utils/cell-labels";
import type { Burg } from "./burgs-generator";
import type { PathfindingResult } from "./journeys-generator";

// ---- tuning -------------------------------------------------------------

const ORIGIN_POOL_SIZE = 8;
const ORIGIN_RETRIES = 3;
const CANDIDATE_POOL_SIZE = 5;
const MIN_STOPS = 3;
const MAX_STOPS = 5;

const LEG_MIN_FACTOR = 0.08;
const LEG_MAX_FACTOR = 0.4;
const MAX_PATH_ATTEMPTS = 24;
const MIN_SPLIT_POINTS = 9;
const SPLIT_BAND: [number, number] = [0.35, 0.65];
const HARBOR_WAIT_CHANCE = 0.45;
const MUSTER_CHANCE = 0.25;
const MAX_SEGMENTS = 12;

// ---- lore ---------------------------------------------------------------

const COMPANY_ADJECTIVES = [
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

const BANNERS = [
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

const CARGO = ["Salt", "Amber", "Silk", "Spice", "Wool", "Iron", "Wine", "Furs", "Ivory", "Glass", "Pearl", "Tin"];

const RELICS = ["Crown", "Chalice", "Codex", "Shard", "Seal", "Blade", "Ring", "Mask", "Horn", "Tome", "Sceptre"];

const BEASTS = [
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

const TITLES = ["Ser", "Dame", "Captain", "Brother", "Sister", "Master", "Mistress", "Old"];

const TAVERN_QUALIFIERS = [
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

const TAVERN_SUBJECTS = [
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

/** Stand-ins for maps generated without cultures, so a party always has a name */
const NAMELESS = ["Aldric", "Marek", "Ysolde", "Corvin", "Nadia", "Halvar", "Ilona", "Tarrin", "Sable", "Ostrik"];

const tavernName = (): string => `The ${ra(TAVERN_QUALIFIERS)} ${ra(TAVERN_SUBJECTS)}`;

function personName(burg: Burg): string {
  const culture = burg.culture;
  if (culture === undefined || !pack.cultures?.[culture]) return ra(NAMELESS);
  return Names.getCultureShort(culture) || ra(NAMELESS);
}

// ---- party archetypes ---------------------------------------------------

interface TitleContext {
  /** Named traveller out of the origin burg — the party's hero, envoy or captain */
  hero: string;
  origin: string;
  destination: string;
  destinationAdjective: string;
  /** The country the route crosses, in a traveller's words: "pinewoods", "high passes" */
  wild: string;
}

interface Archetype {
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
  title: (context: TitleContext) => string;
  /** Name for a land leg, in the party's own voice; falls back to the shared pool */
  leg?: (to: string, wild: string) => string;
  /** Name for a night spent in a burg */
  stopover: (place: string) => string;
  /** Name for a night spent in the open */
  bivouac: (wild: string) => string;
}

/** Built fresh each call, so nothing is shared between journeys */
function buildArchetypes(): Record<string, Archetype> {
  return {
    heroes: {
      type: "Quest",
      weight: 10,
      offRoad: 0.45,
      sea: 0.3,
      rest: 0.7,
      camp: 0.7,
      land: { "On Foot": 4, Horse: 4, Carriage: 1 },
      water: { Boat: 3, Ship: 2 },
      title: ({ hero, destination, wild }) =>
        ra([
          `${ra(TITLES)} ${hero} and the Company of the ${ra(COMPANY_ADJECTIVES)} ${ra(BANNERS)}`,
          `The Quest of ${ra(TITLES)} ${hero}`,
          `${hero}'s Company`,
          `The ${ra(COMPANY_ADJECTIVES)} ${ra(BANNERS)} rides to ${destination}`,
          `${hero} and the road through the ${wild}`
        ]),
      leg: (to, wild) => ra([`The road to ${to}`, `Through the ${wild}`, `Riding for ${to}`]),
      stopover: place => ra([`A night at ${tavernName()}`, `Rumours in ${place}`, `Resupply in ${place}`]),
      bivouac: wild => ra([`Camp in the ${wild}`, `Watches kept in the ${wild}`, `A fire in the ${wild}`])
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
      title: ({ hero, origin, destination }) =>
        ra([
          `${ra(TITLES)} ${hero} of ${origin}`,
          `The Long Road of ${hero}`,
          `${hero} walks to ${destination}`,
          `The ${ra(COMPANY_ADJECTIVES)} Wanderer`
        ]),
      leg: to => ra([`Walking to ${to}`, `Alone to ${to}`, `The road to ${to}`]),
      stopover: place => ra([`A bed at ${tavernName()}`, `Working for board in ${place}`, `A night in ${place}`]),
      bivouac: wild => ra([`Sleeping rough in the ${wild}`, `A cold night in the ${wild}`, `Alone in the ${wild}`])
    },

    caravan: {
      type: "Trade caravan",
      weight: 6,
      offRoad: 0.1,
      sea: 0.35,
      rest: 0.8,
      camp: 0.4,
      land: { Carriage: 5, Horse: 3, "On Foot": 1 },
      water: { Ship: 4, Boat: 1 },
      title: ({ origin, destination }) =>
        ra([
          `The ${ra(COMPANY_ADJECTIVES)} Caravan`,
          `${ra(CARGO)} Road to ${destination}`,
          `The ${origin} Caravan`,
          `${ra(CARGO)} out of ${origin}`
        ]),
      leg: to => ra([`Hauling to ${to}`, `The road to ${to}`, `Toll road to ${to}`]),
      stopover: place => ra([`Wagon yard at ${tavernName()}`, `A night at ${tavernName()}`, `Market day in ${place}`]),
      bivouac: wild => ra([`Wagons circled in the ${wild}`, `Night halt in the ${wild}`, `Cold camp in the ${wild}`])
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
      title: ({ destination, destinationAdjective, hero }) =>
        ra([
          `The March on ${destination}`,
          `${ra(TITLES)} ${hero}'s Host`,
          `The ${destinationAdjective} Campaign`,
          `The ${ra(COMPANY_ADJECTIVES)} Host`
        ]),
      leg: (to, wild) => ra([`March on ${to}`, `The column crosses the ${wild}`, `Forced march to ${to}`]),
      stopover: place => ra([`Billeted in ${place}`, `Requisitions in ${place}`, `${place} opens its gates`]),
      bivouac: wild => ra([`War camp in the ${wild}`, `Pickets set in the ${wild}`, `Night muster in the ${wild}`])
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
      title: ({ destination, destinationAdjective, hero }) =>
        ra([
          `Embassy to ${destination}`,
          `The ${destinationAdjective} Mission`,
          `${ra(TITLES)} ${hero} goes to ${destination}`,
          `Errand to the court of ${destination}`
        ]),
      stopover: place => ra([`Guested at ${tavernName()}`, `Audience in ${place}`, `Two nights in ${place}`]),
      bivouac: wild => ra([`Escort camp in the ${wild}`, `Night under guard in the ${wild}`])
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
      title: ({ destination, hero }) =>
        ra([
          `Pilgrimage to ${destination}`,
          `The ${ra(COMPANY_ADJECTIVES)} Pilgrims`,
          `The Long Walk to ${destination}`,
          `${ra(TITLES)} ${hero} walks to ${destination}`
        ]),
      leg: to => ra([`Barefoot to ${to}`, `On to ${to}`, `The pilgrim road to ${to}`]),
      stopover: place => ra([`Alms and rest at ${tavernName()}`, `Vigil in ${place}`, `Shelter in ${place}`]),
      bivouac: wild => ra([`Vigil in the ${wild}`, `Night prayer in the ${wild}`, `Sleeping rough in the ${wild}`])
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
      title: ({ hero, destination }) =>
        ra([
          `The ${ra(COMPANY_ADJECTIVES)} Blades`,
          `${hero}'s Free Company`,
          `Contract to ${destination}`,
          `The ${ra(COMPANY_ADJECTIVES)} ${ra(BANNERS)} takes coin in ${destination}`
        ]),
      leg: to => ra([`Riding for ${to}`, `Paid road to ${to}`, `On to ${to}`]),
      stopover: place =>
        ra([`Drinking the advance at ${tavernName()}`, `Recruiting in ${place}`, `Paid off in ${place}`]),
      bivouac: wild => ra([`Camp in the ${wild}`, `Cold camp in the ${wild}`, `Dice and watches in the ${wild}`])
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
      title: ({ origin, destination, hero }) =>
        ra([
          `The Ride to ${destination}`,
          `News out of ${origin}`,
          `${hero} carries word to ${destination}`,
          `The ${ra(COMPANY_ADJECTIVES)} Post`
        ]),
      leg: to => ra([`Hard riding to ${to}`, `Fast road to ${to}`, `Post road to ${to}`]),
      stopover: place =>
        ra([`Change of horses in ${place}`, `Three hours at ${tavernName()}`, `Fresh mount in ${place}`]),
      bivouac: wild => ra([`Snatched sleep in the ${wild}`, `Horse rested in the ${wild}`])
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
      title: ({ wild, destination, hero }) =>
        ra([
          `Expedition to the ${wild}`,
          `The ${ra(COMPANY_ADJECTIVES)} Expedition`,
          `Survey of the ${wild}`,
          `${ra(TITLES)} ${hero}'s survey of the road to ${destination}`
        ]),
      leg: (to, wild) => ra([`Mapping the ${wild}`, `Into the ${wild}`, `Traverse to ${to}`]),
      stopover: place =>
        ra([`Resupply in ${place}`, `Notes and repairs at ${tavernName()}`, `Hired guides in ${place}`]),
      bivouac: wild => ra([`Base camp in the ${wild}`, `Survey camp in the ${wild}`, `Weathered in on the ${wild}`])
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
      title: ({ origin, destination }) =>
        ra([
          `The Road out of ${origin}`,
          `${origin} on the Move`,
          `The ${ra(COMPANY_ADJECTIVES)} Column`,
          `Seeking shelter in ${destination}`
        ]),
      leg: to => ra([`Trudging to ${to}`, `The long walk to ${to}`, `On to ${to}`]),
      stopover: place =>
        ra([`Turned away at ${place}`, `Bread and straw in ${place}`, `Counting the missing in ${place}`]),
      bivouac: wild => ra([`Camp in the ${wild}`, `A hungry night in the ${wild}`, `Burying the dead in the ${wild}`])
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
      title: ({ hero, wild }) => {
        const relic = `${ra(COMPANY_ADJECTIVES)} ${ra(RELICS)}`;
        return ra([
          `The Search for the ${relic}`,
          `${hero} and the ${relic}`,
          `The ${relic} lies in the ${wild}`,
          `Digging for the ${relic}`
        ]);
      },
      leg: (to, wild) => ra([`Following the map into the ${wild}`, `On to ${to}`, `Old roads to ${to}`]),
      stopover: place =>
        ra([`Buying rumours at ${tavernName()}`, `Bribing a clerk in ${place}`, `Lying low in ${place}`]),
      bivouac: wild => ra([`Camp in the ${wild}`, `Reading the map in the ${wild}`, `A watchful night in the ${wild}`])
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
      title: ({ hero, wild, destination }) => {
        const beast = ra(BEASTS);
        return ra([
          `The Hunt for the ${wild} ${beast}`,
          `${ra(TITLES)} ${hero} hunts the ${beast}`,
          `The ${beast} of ${destination}`,
          `Bounty on the ${beast}`
        ]);
      },
      leg: (to, wild) => ra([`Following the trail into the ${wild}`, `The kills lead to ${to}`, `Tracking to ${to}`]),
      stopover: place =>
        ra([`Questioning the locals in ${place}`, `Bounty posted in ${place}`, `A night at ${tavernName()}`]),
      bivouac: wild => ra([`Blind camp in the ${wild}`, `Bait set in the ${wild}`, `No fire tonight — ${wild}`])
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
      title: ({ origin, destination, hero }) =>
        ra([
          `Flight from ${origin}`,
          `The ${ra(COMPANY_ADJECTIVES)} Exiles`,
          `Exodus from ${origin}`,
          `${hero} is banished to ${destination}`
        ]),
      stopover: place =>
        ra([`Hidden a night in ${place}`, `Begging bread in ${place}`, `Back room of ${tavernName()}`]),
      bivouac: wild => ra([`Fireless camp in the ${wild}`, `Hiding in the ${wild}`, `A cold night in the ${wild}`])
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
      title: ({ destination }) =>
        ra([
          `The ${ra(COMPANY_ADJECTIVES)} Run`,
          `Smugglers' road to ${destination}`,
          `The ${ra(CARGO)} Run`,
          `Untaxed to ${destination}`
        ]),
      leg: to => ra([`Quiet road to ${to}`, `Around the tollgates to ${to}`, `Night haul to ${to}`]),
      stopover: place =>
        ra([`Lying low at ${tavernName()}`, `Unloading quietly in ${place}`, `Palms greased in ${place}`]),
      bivouac: wild =>
        ra([`Cache dug in the ${wild}`, `No fire, no names — ${wild}`, `Waiting out the patrol in the ${wild}`])
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
      title: ({ hero, destination, origin }) =>
        ra([
          `The ${ra(COMPANY_ADJECTIVES)} Reavers`,
          `${hero}'s Raid`,
          `Raid on ${destination}`,
          `The ${origin} Keels`
        ]),
      leg: to => ra([`Falling on ${to}`, `Overland to ${to}`, `Driving the herd to ${to}`]),
      stopover: place =>
        ra([`Dividing the take in ${place}`, `Selling the plunder in ${place}`, `Drinking ${place} dry`]),
      bivouac: wild =>
        ra([`Beach camp in the ${wild}`, `Keel hauled up in the ${wild}`, `A watchful night in the ${wild}`])
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
      title: ({ hero, destinationAdjective, origin }) =>
        ra([
          `The Progress of ${ra(TITLES)} ${hero}`,
          `The ${destinationAdjective} Progress`,
          `The Crown rides out of ${origin}`,
          `The ${ra(COMPANY_ADJECTIVES)} Progress`
        ]),
      leg: to => ra([`The royal road to ${to}`, `Received at ${to}`, `Procession to ${to}`]),
      stopover: place => ra([`Feasted in ${place}`, `Court held in ${place}`, `Three nights in ${place}`]),
      bivouac: wild => ra([`Pavilions raised in the ${wild}`, `The hunt camps in the ${wild}`])
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
      title: ({ hero, destination, origin }) =>
        ra([
          `The ${ra(COMPANY_ADJECTIVES)} Airship`,
          `${hero} sails over ${origin}`,
          `Skyroad to ${destination}`,
          `The ${ra(BANNERS)} takes to the air`
        ]),
      leg: (to, wild) => ra([`Over the ${wild} to ${to}`, `Above the ${wild}`, `Sky lane to ${to}`]),
      stopover: place => ra([`Moored over ${place}`, `Gas and ballast in ${place}`, `A night at ${tavernName()}`]),
      bivouac: wild => ra([`Grounded in the ${wild}`, `Repairs in the ${wild}`, `Anchored above the ${wild}`])
    }
  };
}

/** Journeys with no story behind them: a plain trip from A to B */
export const DEFAULT_JOURNEY_TYPE = "Travel";

/** Type labels the generator uses, offered as suggestions when a journey is edited by hand */
export function getJourneyTypes(): string[] {
  const types = Object.values(buildArchetypes()).map(archetype => archetype.type);
  return [...new Set([DEFAULT_JOURNEY_TYPE, ...types])].sort();
}

/** Pick a party for a new journey, weighted so heroes take the road most often */
function pickArchetype(): Archetype {
  const archetypes = buildArchetypes();
  const weights: Record<string, number> = {};
  for (const [key, archetype] of Object.entries(archetypes)) weights[key] = archetype.weight;
  return archetypes[rw(weights)];
}

// ---- planning -----------------------------------------------------------

interface PlannedLeg {
  from: Burg;
  to: Burg;
  domain: "land" | "water" | "air";
  transport: TransportType;
  avoidRoads: boolean;
  points: JourneyPoint[];
  distance: number;
}

export interface JourneyPathfinder {
  findPath(
    from: number,
    to: number,
    domain: TransportDomain,
    options?: {
      avoidRoads?: boolean;
    }
  ): PathfindingResult;
  isValidPath(points: JourneyPoint[], domain: TransportDomain): boolean;
  getPathLength(points: JourneyPoint[]): number;
}

/** Invent a party and plot their route; null when the map cannot carry one. */
export function generateStoryJourney(pathfinder: JourneyPathfinder): Omit<Journey, "i" | "color"> | null {
  const burgs = (pack.burgs ?? []).filter((burg: Burg) => burg?.i && !burg.removed && burg.cell !== undefined);
  if (burgs.length < 2) return null;

  const archetype = pickArchetype();
  // an origin can turn out to be a dead end — a lone burg on an island nothing sails to
  for (let attempt = 0; attempt < ORIGIN_RETRIES; attempt++) {
    const legs = planLegs(pathfinder, archetype, burgs);
    if (!legs.length) continue;

    const segments = buildSegments(pathfinder, archetype, legs);
    if (segments.length) return { name: titleFor(archetype, legs), type: archetype.type, segments };
  }

  return null;
}

function planLegs(pathfinder: JourneyPathfinder, archetype: Archetype, burgs: Burg[]): PlannedLeg[] {
  const diagonal = Math.hypot(graphWidth, graphHeight) || 1;
  const band: [number, number] = [diagonal * LEG_MIN_FACTOR, diagonal * LEG_MAX_FACTOR];

  const origin = pickOrigin(burgs, archetype);
  const visited = new Set<number>([origin.i]);
  const legs: PlannedLeg[] = [];

  let current = origin;
  let attempts = 0;
  const legCount = rand(MIN_STOPS, MAX_STOPS) - 1;

  while (legs.length < legCount && attempts < MAX_PATH_ATTEMPTS) {
    const candidates = rankCandidates(current, burgs, visited, band, archetype);
    if (!candidates.length) break;

    let leg: PlannedLeg | null = null;
    for (const candidate of candidates) {
      if (attempts++ >= MAX_PATH_ATTEMPTS) break;
      visited.add(candidate.i); // a candidate that fails is not worth retrying later either
      leg = buildLeg(pathfinder, archetype, current, candidate);
      if (leg) break;
    }

    if (leg) {
      legs.push(leg);
      current = leg.to;
    } else if (legs.length) break; // stuck mid-route: the journey simply ends at this stop
    // else: still looking for the first leg — the failed candidates are burnt, try the next batch
  }

  return legs;
}

function pickOrigin(burgs: Burg[], archetype: Archetype): Burg {
  const neighbours: Record<number, number> = {};
  for (const burg of burgs) neighbours[pack.cells.f[burg.cell]] = (neighbours[pack.cells.f[burg.cell]] ?? 0) + 1;

  const scored = burgs
    .map(burg => {
      let score = (burg.population ?? 1) + 1;
      if (burg.capital) score *= 2.5;
      if (burg.port) score *= 1 + archetype.sea;
      // a burg alone on its island has nowhere overland to go
      score *= Math.min(1, (neighbours[pack.cells.f[burg.cell]] ?? 1) / 3);
      return { burg, score: score * (0.5 + Math.random()) };
    })
    .sort((a, b) => b.score - a.score);

  return ra(scored.slice(0, ORIGIN_POOL_SIZE)).burg;
}

/** Next stops worth trying, best first: a comfortable leg away, notable, and ideally over a border */
function rankCandidates(
  current: Burg,
  burgs: Burg[],
  visited: Set<number>,
  band: [number, number],
  archetype: Archetype
): Burg[] {
  const [minLeg, maxLeg] = band;
  const bandMid = (minLeg + maxLeg) / 2;

  const inBand: { burg: Burg; score: number }[] = [];
  const outOfBand: { burg: Burg; score: number }[] = [];

  for (const burg of burgs) {
    if (visited.has(burg.i)) continue;

    let score = 1 + Math.log10(1 + (burg.population ?? 0));
    if (burg.capital) score += 0.8;
    if (burg.state !== current.state) score += 0.8;
    if (burg.port && current.port) score += archetype.sea * 2;
    score *= 0.5 + Math.random();

    const distance = Math.hypot(burg.x - current.x, burg.y - current.y);
    if (distance >= minLeg && distance <= maxLeg) inBand.push({ burg, score });
    else outOfBand.push({ burg, score: -Math.abs(distance - bandMid) }); // closest to the ideal leg first
  }

  const pool = inBand.length ? inBand : outOfBand;
  return pool
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATE_POOL_SIZE)
    .map(candidate => candidate.burg);
}

/** Route one leg the party's preferred way, falling back to whatever the terrain does allow */
function buildLeg(pathfinder: JourneyPathfinder, archetype: Archetype, from: Burg, to: Burg): PlannedLeg | null {
  const bothPorts = Boolean(from.port && to.port);
  const preferSea = bothPorts && P(archetype.sea);

  type Attempt = { domain: PlannedLeg["domain"]; avoidRoads: boolean };
  const attempts: Attempt[] = [];
  const landAttempts: Attempt[] = P(archetype.offRoad)
    ? [
        { domain: "land", avoidRoads: true },
        { domain: "land", avoidRoads: false }
      ]
    : [{ domain: "land", avoidRoads: false }];

  // a party that can fly goes over everything — terrain never refuses an air path
  if (archetype.air && P(archetype.air)) attempts.push({ domain: "air", avoidRoads: false });
  if (preferSea) attempts.push({ domain: "water", avoidRoads: false }, ...landAttempts);
  else attempts.push(...landAttempts);
  if (bothPorts && !preferSea) attempts.push({ domain: "water", avoidRoads: false });

  for (const { domain, avoidRoads } of attempts) {
    const weights = domain === "water" ? archetype.water : domain === "air" ? (archetype.sky ?? {}) : archetype.land;
    const transport = resolveTransport(weights, domain);
    if (!transport) continue;

    const { points, distance, errorCode } = pathfinder.findPath(from.cell, to.cell, domain, { avoidRoads });
    if (errorCode || points.length < 2 || !pathfinder.isValidPath(points, domain)) continue;

    return { from, to, domain, transport, avoidRoads, points, distance };
  }

  return null;
}

/** The preferred type if the map still has it, otherwise any type of this domain */
function resolveTransport(weights: Record<string, number>, domain: TransportDomain): TransportType | undefined {
  const types: TransportType[] = pack.transportTypes ?? [];
  const preferred = rw(weights);
  return (
    types.find(type => type.name === preferred && type.domain === domain) ?? types.find(type => type.domain === domain)
  );
}

// ---- segment assembly ---------------------------------------------------

function buildSegments(pathfinder: JourneyPathfinder, archetype: Archetype, legs: PlannedLeg[]): JouneySegment[] {
  const stayType = (pack.transportTypes ?? []).find((type: TransportType) => type.domain === "stay");

  const plans = legs.map((leg, index) => ({
    leg,
    harborWait: Boolean(stayType) && leg.domain === "water" && P(HARBOR_WAIT_CHANCE),
    // a party already off the road is far likelier to sleep beside it
    camp:
      Boolean(stayType) &&
      leg.points.length >= MIN_SPLIT_POINTS &&
      P(leg.avoidRoads ? archetype.camp : archetype.camp / 2),
    rest: Boolean(stayType) && index < legs.length - 1 && P(archetype.rest)
  }));

  let muster = Boolean(stayType) && P(MUSTER_CHANCE);
  // a journey without a single pause is the bare A→B line this generator exists to replace
  if (stayType && !muster && !plans.some(plan => plan.harborWait || plan.camp || plan.rest)) {
    const splittable = plans.find(plan => plan.leg.points.length >= MIN_SPLIT_POINTS);
    if (splittable) splittable.camp = true;
    else if (plans.length > 1) plans[0].rest = true;
    else muster = true;
  }

  const segments: JouneySegment[] = [];

  /** A leg goes in whole or not at all, so a truncated route still ends at a stop */
  const commit = (group: JouneySegment[]): boolean => {
    if (segments.length + group.length > MAX_SEGMENTS) return false;
    for (const segment of group) segments.push({ ...segment, id: segments.length });
    return true;
  };

  if (muster) {
    const place = burgName(legs[0].from);
    const name = ra([`Mustering in ${place}`, `Provisioning in ${place}`, `Gathering at ${tavernName()}`]);
    commit([makeStay(stayType!, legs[0].from.cell, name, rand(6, 24))]);
  }

  for (const [index, plan] of plans.entries()) {
    const { leg } = plan;
    const isFirst = index === 0;
    const isLast = index === plans.length - 1;
    const from = burgName(leg.from);
    const to = burgName(leg.to);
    const group: JouneySegment[] = [];

    if (plan.harborWait) {
      const name = ra([`Waiting on the tide at ${from}`, `Held up in ${from} harbour`, `Buying a passage in ${from}`]);
      group.push(makeStay(stayType!, leg.from.cell, name, rand(6, 30)));
    }

    const split = plan.camp ? splitLeg(pathfinder, leg) : null;
    const wild = describeWild(split?.campCell ?? leg.points[Math.floor(leg.points.length / 2)][2]);
    const naming = { archetype, leg, from, to, wild, isFirst, isLast };

    if (split) {
      group.push(makeTravel(leg, split.first, nameTravel({ ...naming, part: "first" })));
      group.push(makeStay(stayType!, split.campCell, nameHalt(archetype, leg, split.campCell, wild), rand(6, 12)));
      group.push(makeTravel(leg, split.second, nameTravel({ ...naming, part: "second" })));
    } else {
      group.push(makeTravel(leg, leg, nameTravel({ ...naming, part: "whole" })));
    }

    if (plan.rest) group.push(makeStay(stayType!, leg.to.cell, archetype.stopover(to), 12 * rand(1, 3)));

    if (!commit(group)) break;
  }

  return segments;
}

function splitLeg(
  pathfinder: JourneyPathfinder,
  leg: PlannedLeg
): { first: PathSlice; second: PathSlice; campCell: number } | null {
  const count = leg.points.length;
  const index = rand(Math.floor(count * SPLIT_BAND[0]), Math.floor(count * SPLIT_BAND[1]));
  if (index < 1 || index > count - 2) return null;

  const first = leg.points.slice(0, index + 1);
  const second = leg.points.slice(index);
  return {
    first: { points: first, distance: pathfinder.getPathLength(first) },
    second: { points: second, distance: pathfinder.getPathLength(second) },
    campCell: leg.points[index][2]
  };
}

interface PathSlice {
  points: JourneyPoint[];
  distance: number;
}

function makeTravel(leg: PlannedLeg, slice: PathSlice, name: string): JouneySegment {
  const segment: JouneySegment = {
    id: 0, // reassigned on push, so the ids stay sequential
    name,
    from: slice.points[0][2],
    to: slice.points[slice.points.length - 1][2],
    transportType: leg.transport.name,
    speed: leg.transport.speed,
    distance: slice.distance,
    points: slice.points
  };
  if (leg.avoidRoads) segment.avoidRoads = true;
  return segment;
}

function makeStay(stayType: TransportType, cellId: number, name: string, duration: number): JouneySegment {
  const [x, y] = pack.cells.p[cellId];
  return {
    id: 0,
    name,
    from: cellId,
    to: cellId,
    transportType: stayType.name,
    speed: 0,
    distance: 0,
    points: [[x, y, cellId]],
    duration
  };
}

// ---- naming -------------------------------------------------------------

function titleFor(archetype: Archetype, legs: PlannedLeg[]): string {
  const origin = legs[0].from;
  const destination = legs[legs.length - 1].to;
  // a title that names the country crossed wants land: "Survey of the open water" says nothing
  const namedLeg = legs.find(leg => leg.domain === "land") ?? legs[Math.floor(legs.length / 2)];
  const middle = namedLeg.points[Math.floor(namedLeg.points.length / 2)][2];

  return archetype.title({
    hero: personName(origin),
    origin: burgName(origin),
    destination: burgName(destination),
    destinationAdjective: getAdjective(pack.states?.[destination.state ?? 0]?.name || burgName(destination)),
    // titles supply their own article ("to the ..."), so drop the one describeWater adds
    wild: namedLeg.domain === "land" ? describeWild(middle) : describeWater(namedLeg).replace(/^the /, "")
  });
}

interface TravelNaming {
  archetype: Archetype;
  leg: PlannedLeg;
  from: string;
  to: string;
  wild: string;
  isFirst: boolean;
  isLast: boolean;
  /** A leg split by a camp is named in two halves */
  part: "whole" | "first" | "second";
}

function nameTravel({ archetype, leg, from, to, wild, isFirst, isLast, part }: TravelNaming): string {
  if (leg.domain === "air") {
    if (part === "second") return ra([`Down to ${to}`, `Mooring at ${to}`, `Descent on ${to}`]);
    if (part === "first") return ra([`Aloft from ${from}`, `Rising over the ${wild}`, `Cast off from ${from}`]);
    return ra([`Over the ${wild} to ${to}`, `Flight to ${to}`, `${from} to ${to} by air`, `Above the ${wild}`]);
  }

  if (leg.domain === "water") {
    const water = describeWater(leg);
    if (part === "second") return ra([`Landfall at ${to}`, `Into the roads of ${to}`, `Last watch to ${to}`]);
    if (part === "first")
      return ra([`Out of ${from} harbour`, `Standing out into ${water}`, `Under sail from ${from}`]);
    return ra([`Passage to ${to}`, `Crossing ${water}`, `By sea to ${to}`, `${from} to ${to} by water`]);
  }

  if (part === "first")
    return ra([
      `Into the ${wild}`,
      `Out of ${from} into the ${wild}`,
      `Up the ${wild} track`,
      `${from} to the ${wild}`
    ]);
  if (part === "second") return ra([`On to ${to}`, `Down out of the ${wild} to ${to}`, `Last stretch to ${to}`]);

  if (leg.avoidRoads) {
    // the closing leg names where the party ends up, however it got there
    if (isLast) return ra([`Cross-country to ${to}`, `Down out of the ${wild} to ${to}`, `Into ${to} by back ways`]);
    return ra([`Cross-country to ${to}`, `Through the ${wild}`, `Trackless ${wild}`, `Around the road to ${to}`]);
  }
  if (isFirst) return ra([`Out of ${from}`, `The road from ${from}`, `${from} to ${to}`, `Setting out for ${to}`]);
  if (isLast) return ra([`Last miles to ${to}`, `Down to ${to}`, `The road into ${to}`]);
  // half the time the party names the leg in its own voice, if it has one
  if (archetype.leg && P(0.5)) return archetype.leg(to, wild);
  return ra([`${from} to ${to}`, `On to ${to}`, `The ${wild} road`]);
}

/** A night broken into a leg: at anchor at sea, in a camp on land */
function nameHalt(archetype: Archetype, leg: PlannedLeg, cellId: number, wild: string): string {
  const label = cellEndpointLabel(cellId);
  const nearby = label.startsWith("near ");

  if (leg.domain === "water") {
    if (nearby) return ra([`Anchored ${label}`, `A night at anchor ${label}`, `Lying to ${label}`]);
    return ra(["Night at anchor", `Becalmed in ${describeWater(leg)}`, "Hove to till dawn"]);
  }

  if (nearby) return ra([`Camp ${label}`, `A night ${label}`, archetype.bivouac(wild)]);
  return archetype.bivouac(wild);
}

const burgName = (burg: Burg): string => burg.name || `Burg ${burg.i}`;

const BIOME_TERMS: Record<string, string> = {
  Marine: "open water",
  "Hot desert": "dunes",
  "Cold desert": "stony waste",
  Savanna: "savanna",
  Grassland: "grasslands",
  "Tropical seasonal forest": "jungle",
  "Temperate deciduous forest": "greenwood",
  "Tropical rainforest": "rainforest",
  "Temperate rainforest": "rainforest",
  Taiga: "pinewoods",
  Tundra: "tundra",
  Glacier: "ice",
  Wetland: "marshes"
};

function describeWild(cellId: number): string {
  const height = pack.cells.h[cellId];
  if (height >= 70) return ra(["mountains", "high passes", "peaks"]);
  if (height >= 50) return ra(["hills", "uplands"]);

  const biome = pack.biomes?.[pack.cells.biome?.[cellId] ?? 0];
  if (!biome?.name) return "wilds";
  return BIOME_TERMS[biome.name] ?? biome.name.toLowerCase();
}

function describeWater(leg: PlannedLeg): string {
  const middle = leg.points[Math.floor(leg.points.length / 2)][2];
  const feature = pack.features?.[pack.cells.f[middle]];
  if (feature?.name) return feature.name; // lakes are named; oceans and seas usually are not
  return feature?.type === "lake" ? "the open water" : "the open sea";
}
