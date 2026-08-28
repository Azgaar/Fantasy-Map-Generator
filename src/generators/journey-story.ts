import type { JouneySegment, Journey, JourneyPoint, TransportDomain, TransportType } from "@/types/Journey";
import { getAdjective, P, ra, rand, rw } from "@/utils";
import { cellEndpointLabel } from "@/utils/cell-labels";
import type { Burg } from "./burgs-generator";
import type { PathfindingResult } from "./journeys-generator";

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
const CARGO = ["Salt", "Amber", "Silk", "Spice", "Wool", "Iron", "Wine", "Furs", "Ivory", "Glass", "Pearl", "Tin"];
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

const tavernName = (): string => `The ${ra(TAVERN_QUALIFIERS)} ${ra(TAVERN_SUBJECTS)}`;

interface TitleContext {
  origin: string;
  destination: string;
  destinationAdjective: string;
  wild: string;
}

interface Archetype {
  /** Chance a land leg leaves the road network (and travels at the off-road penalty). */
  offRoad: number;
  /** Chance a leg between two ports is sailed rather than walked. */
  sea: number;
  /** Chance the party stops over at an intermediate burg. */
  rest: number;
  /** Chance a long leg is broken by a camp in the wild. */
  camp: number;
  /** Preferred transport by name, weighted; resolved against pack.transportTypes. */
  land: Record<string, number>;
  water: Record<string, number>;
  title: (context: TitleContext) => string;
  /** Name for a night spent in a burg. */
  stopover: (place: string) => string;
  /** Name for a night spent in the open. */
  bivouac: (wild: string) => string;
}

type StoryKind = "caravan" | "embassy" | "pilgrimage" | "expedition" | "exiles" | "smugglers";

const ARCHETYPE_WEIGHTS: Record<StoryKind, number> = {
  caravan: 6,
  embassy: 4,
  pilgrimage: 4,
  expedition: 3,
  exiles: 2,
  smugglers: 2
};

function buildArchetypes(): Record<StoryKind, Archetype> {
  return {
    caravan: {
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
      stopover: place => ra([`Wagon yard at ${tavernName()}`, `A night at ${tavernName()}`, `Market day in ${place}`]),
      bivouac: wild => ra([`Wagons circled in the ${wild}`, `Night halt in the ${wild}`, `Cold camp in the ${wild}`])
    },

    embassy: {
      offRoad: 0.05,
      sea: 0.4,
      rest: 0.9,
      camp: 0.25,
      land: { Horse: 4, Carriage: 4, "On Foot": 1 },
      water: { Ship: 5, Boat: 1 },
      title: ({ destination, destinationAdjective }) =>
        ra([
          `Embassy to ${destination}`,
          `The ${destinationAdjective} Mission`,
          `The ${ra(COMPANY_ADJECTIVES)} Envoy`,
          `Errand to the court of ${destination}`
        ]),
      stopover: place => ra([`Guested at ${tavernName()}`, `Audience in ${place}`, `Two nights in ${place}`]),
      bivouac: wild => ra([`Escort camp in the ${wild}`, `Night under guard in the ${wild}`])
    },

    pilgrimage: {
      offRoad: 0.35,
      sea: 0.2,
      rest: 0.7,
      camp: 0.6,
      land: { "On Foot": 1 },
      water: { Boat: 3, Ship: 2 },
      title: ({ destination }) =>
        ra([
          `Pilgrimage to ${destination}`,
          `The ${ra(COMPANY_ADJECTIVES)} Pilgrims`,
          `The ${getAdjective(origin)} Pilgrims`,
          `Penance to ${destination}`
        ]),
      stopover: place => ra([`Alms and rest at ${tavernName()}`, `Vigil in ${place}`, `Shelter in ${place}`]),
      bivouac: wild => ra([`Vigil in the ${wild}`, `Night prayer in the ${wild}`, `Sleeping rough in the ${wild}`])
    },

    expedition: {
      offRoad: 0.7,
      sea: 0.3,
      rest: 0.5,
      camp: 0.8,
      land: { "On Foot": 4, Horse: 3 },
      water: { Boat: 3, Ship: 2 },
      title: ({ wild, destination }) =>
        ra([
          `Expedition to the ${wild}`,
          `The ${ra(COMPANY_ADJECTIVES)} Expedition`,
          `Survey of the ${wild}`,
          `Reckoning the road to ${destination}`
        ]),
      stopover: place =>
        ra([`Resupply in ${place}`, `Notes and repairs at ${tavernName()}`, `Hired guides in ${place}`]),
      bivouac: wild => ra([`Base camp in the ${wild}`, `Survey camp in the ${wild}`, `Weathered in on the ${wild}`])
    },

    exiles: {
      offRoad: 0.6,
      sea: 0.6,
      rest: 0.4,
      camp: 0.7,
      land: { "On Foot": 5, Carriage: 2, Horse: 2 },
      water: { Boat: 3, Ship: 3 },
      title: ({ origin, destination }) =>
        ra([
          `Flight from ${origin}`,
          `The ${ra(COMPANY_ADJECTIVES)} Exiles`,
          `Exodus from ${origin}`,
          `The road out of ${origin} to ${destination}`
        ]),
      stopover: place =>
        ra([`Hidden a night in ${place}`, `Begging bread in ${place}`, `Back room of ${tavernName()}`]),
      bivouac: wild => ra([`Fireless camp in the ${wild}`, `Hiding in the ${wild}`, `A cold night in the ${wild}`])
    },

    smugglers: {
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
      stopover: place =>
        ra([`Lying low at ${tavernName()}`, `Unloading quietly in ${place}`, `Palms greased in ${place}`]),
      bivouac: wild =>
        ra([`Cache dug in the ${wild}`, `No fire, no names — ${wild}`, `Waiting out the patrol in the ${wild}`])
    }
  };
}

interface PlannedLeg {
  from: Burg;
  to: Burg;
  domain: "land" | "water";
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

  const archetype = buildArchetypes()[rw(ARCHETYPE_WEIGHTS) as StoryKind];
  // an origin can turn out to be a dead end — a lone burg on an island nothing sails to
  for (let attempt = 0; attempt < ORIGIN_RETRIES; attempt++) {
    const legs = planLegs(pathfinder, archetype, burgs);
    if (!legs.length) continue;

    const segments = buildSegments(pathfinder, archetype, legs);
    if (segments.length) return { name: titleFor(archetype, legs), visible: true, segments };
  }

  return null;
}

/** Chain burg to burg for as long as the pathfinder keeps finding honest routes. */
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

/** The party sets out from somewhere that matters: a capital, a large burg, a busy port. */
function pickOrigin(burgs: Burg[], archetype: Archetype): Burg {
  const neighbours = countBurgsPerLandmass(burgs);

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

const countBurgsPerLandmass = (burgs: Burg[]): Record<number, number> => {
  const counts: Record<number, number> = {};
  for (const burg of burgs) {
    const landmass = pack.cells.f[burg.cell];
    counts[landmass] = (counts[landmass] ?? 0) + 1;
  }
  return counts;
};

/**
 * Next stops worth trying, best first. A good stop is a comfortable leg away,
 * notable in its own right, and ideally over a border — a route that crosses
 * states tells more of a story than one that circles a single province.
 */
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

/**
 * Route one leg, trying the party's preferred way of travelling first. An
 * off-road party still takes the road rather than not travelling at all, and a
 * pair of ports falls back to sea when no land connects them.
 */
function buildLeg(pathfinder: JourneyPathfinder, archetype: Archetype, from: Burg, to: Burg): PlannedLeg | null {
  const bothPorts = Boolean(from.port && to.port);
  const preferSea = bothPorts && P(archetype.sea);

  type Attempt = { domain: "land" | "water"; avoidRoads: boolean };
  const attempts: Attempt[] = [];
  const landAttempts: Attempt[] = P(archetype.offRoad)
    ? [
        { domain: "land", avoidRoads: true },
        { domain: "land", avoidRoads: false }
      ]
    : [{ domain: "land", avoidRoads: false }];

  if (preferSea) attempts.push({ domain: "water", avoidRoads: false }, ...landAttempts);
  else attempts.push(...landAttempts);
  if (bothPorts && !preferSea) attempts.push({ domain: "water", avoidRoads: false });

  for (const { domain, avoidRoads } of attempts) {
    const transport = resolveTransport(domain === "land" ? archetype.land : archetype.water, domain);
    if (!transport) continue;

    const { points, distance, errorCode } = pathfinder.findPath(from.cell, to.cell, domain, { avoidRoads });
    if (errorCode || points.length < 2 || !pathfinder.isValidPath(points, domain)) continue;

    return { from, to, domain, transport, avoidRoads, points, distance };
  }

  return null;
}

/** The named type if the map still has it, otherwise any type that can travel this domain. */
function resolveTransport(weights: Record<string, number>, domain: TransportDomain): TransportType | undefined {
  const types: TransportType[] = pack.transportTypes ?? [];
  const preferred = rw(weights);
  return (
    types.find(type => type.name === preferred && type.domain === domain) ?? types.find(type => type.domain === domain)
  );
}

interface LegPlan {
  leg: PlannedLeg;
  harborWait: boolean;
  camp: boolean;
  rest: boolean;
}

/** Turn planned legs into the segment list: travel, rests, and the camps between them. */
function buildSegments(pathfinder: JourneyPathfinder, archetype: Archetype, legs: PlannedLeg[]): JouneySegment[] {
  const stayType = (pack.transportTypes ?? []).find((type: TransportType) => type.domain === "stay");

  const plans: LegPlan[] = legs.map((leg, index) => ({
    leg,
    harborWait: Boolean(stayType) && leg.domain === "water" && P(HARBOR_WAIT_CHANCE),
    // a party already off the road is far likelier to sleep beside it
    camp: Boolean(stayType) && canSplit(leg) && P(leg.avoidRoads ? archetype.camp : archetype.camp / 2),
    rest: Boolean(stayType) && index < legs.length - 1 && P(archetype.rest)
  }));

  let muster = Boolean(stayType) && P(MUSTER_CHANCE);
  // A journey without a single pause is exactly the journey this generator exists to replace
  if (stayType && !muster && !plans.some(plan => plan.harborWait || plan.camp || plan.rest)) {
    const splittable = plans.find(plan => canSplit(plan.leg));
    if (splittable) splittable.camp = true;
    else if (plans.length > 1) plans[0].rest = true;
    else muster = true;
  }

  const segments: JouneySegment[] = [];

  /** A leg goes in whole or not at all, so a truncated route still ends at a stop. */
  const commit = (group: JouneySegment[]): boolean => {
    if (segments.length + group.length > MAX_SEGMENTS) return false;
    for (const segment of group) segments.push({ ...segment, id: segments.length });
    return true;
  };

  if (muster) commit([makeStay(stayType!, legs[0].from.cell, musterName(burgName(legs[0].from)), rand(6, 24))]);

  for (const [index, plan] of plans.entries()) {
    const { leg } = plan;
    const isFirst = index === 0;
    const isLast = index === plans.length - 1;
    const from = burgName(leg.from);
    const to = burgName(leg.to);
    const group: JouneySegment[] = [];

    if (plan.harborWait) group.push(makeStay(stayType!, leg.from.cell, harborWaitName(from), rand(6, 30)));

    const split = plan.camp ? splitLeg(pathfinder, leg) : null;
    if (split) {
      const wild = describeWild(split.campCell);
      // a night broken into a sea leg is spent at anchor, not in a camp
      const halt = leg.domain === "water" ? anchorName(leg, split.campCell) : campName(archetype, split.campCell, wild);
      group.push(makeTravel(leg, split.first, nameTravel({ leg, from, to, wild, isFirst, isLast, part: "first" })));
      group.push(makeStay(stayType!, split.campCell, halt, rand(6, 12)));
      group.push(makeTravel(leg, split.second, nameTravel({ leg, from, to, wild, isFirst, isLast, part: "second" })));
    } else {
      const wild = describeWild(leg.points[Math.floor(leg.points.length / 2)][2]);
      group.push(makeTravel(leg, leg, nameTravel({ leg, from, to, wild, isFirst, isLast, part: "whole" })));
    }

    if (plan.rest) group.push(makeStay(stayType!, leg.to.cell, archetype.stopover(to), 12 * rand(1, 3)));

    if (!commit(group)) break;
  }

  return segments;
}

const canSplit = (leg: PlannedLeg): boolean => leg.points.length >= MIN_SPLIT_POINTS;

/** Break a leg in two around a point somewhere in its middle third, for a camp. */
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
    visible: true,
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
    visible: true,
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
    origin: burgName(origin),
    destination: burgName(destination),
    destinationAdjective: getAdjective(stateName(destination) || burgName(destination)),
    // titles supply their own article ("to the ..."), so drop the one describeWater adds
    wild: namedLeg.domain === "land" ? describeWild(middle) : describeWater(namedLeg).replace(/^the /, "")
  });
}

function nameTravel({
  leg,
  from,
  to,
  wild,
  isFirst,
  isLast,
  part
}: {
  leg: PlannedLeg;
  from: string;
  to: string;
  wild: string;
  isFirst: boolean;
  isLast: boolean;
  part: "whole" | "first" | "second";
}): string {
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
  return ra([`${from} to ${to}`, `On to ${to}`, `The ${wild} road`]);
}

const musterName = (place: string): string =>
  ra([`Mustering in ${place}`, `Provisioning in ${place}`, `Last night in ${place}`, `Gathering at ${tavernName()}`]);

const harborWaitName = (place: string): string =>
  ra([`Waiting on the tide at ${place}`, `Held up in ${place} harbour`, `Buying a passage in ${place}`]);

function campName(archetype: Archetype, cellId: number, wild: string): string {
  const label = cellEndpointLabel(cellId);
  if (label.startsWith("near ")) return ra([`Camp ${label}`, `A night ${label}`, archetype.bivouac(wild)]);
  return archetype.bivouac(wild);
}

/** A night broken into a sea crossing: hove to, at anchor, or waiting out the dark in sight of a coast. */
function anchorName(leg: PlannedLeg, cellId: number): string {
  const label = cellEndpointLabel(cellId);
  if (label.startsWith("near ")) return ra([`Anchored ${label}`, `A night at anchor ${label}`, `Lying to ${label}`]);
  return ra([`Night at anchor`, `Becalmed in ${describeWater(leg)}`, `Hove to till dawn`]);
}

const burgName = (burg: Burg): string => burg.name || `Burg ${burg.i}`;

const stateName = (burg: Burg): string => (burg.state ? pack.states?.[burg.state]?.name || "" : "");

/** What the country underfoot is called, in the words a traveller would use. */
function describeWild(cellId: number): string {
  const height = pack.cells.h[cellId];
  if (height >= 70) return ra(["mountains", "high passes", "peaks"]);
  if (height >= 50) return ra(["hills", "uplands"]);

  const biome = pack.biomes?.[pack.cells.biome?.[cellId] ?? 0];
  if (!biome?.name) return "wilds";
  return BIOME_TERMS[biome.name] ?? biome.name.toLowerCase();
}

/** The named water a sea leg crosses, or a generic for the unnamed open sea. */
function describeWater(leg: PlannedLeg): string {
  const middle = leg.points[Math.floor(leg.points.length / 2)][2];
  const feature = pack.features?.[pack.cells.f[middle]];
  if (feature?.name) return feature.name; // lakes are named; oceans and seas usually are not
  return feature?.type === "lake" ? "the open water" : "the open sea";
}
