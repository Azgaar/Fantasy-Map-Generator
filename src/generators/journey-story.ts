import {
  BANNERS,
  BEASTS,
  BIOME_TERMS,
  CARGO,
  COMPANY_ADJECTIVES,
  HALT_NAMES,
  HIGHLAND_TERMS,
  JOURNEY_ARCHETYPES,
  type JourneyArchetype,
  LEG_NAMES,
  NAMELESS,
  RANKS,
  RELICS,
  TAVERN_QUALIFIERS,
  TAVERN_SUBJECTS,
  UNKNOWN_WILD,
  UPLAND_TERMS
} from "@/data/journey-lore";
import type { JouneySegment, Journey, JourneyPoint, Transport, TransportDomain } from "@/types/Journey";
import { getAdjective, P, ra, rand, rw } from "@/utils";
import { cellEndpointLabel } from "@/utils/cell-labels";
import type { Burg } from "./burgs-generator";
import type { PathfindingResult } from "./journeys-generator";

const ORIGIN_POOL_SIZE = 8;
const ORIGIN_RETRIES = 3;
const CANDIDATE_POOL_SIZE = 5;
const LEG_COUNT_WEIGHTS: Record<string, number> = { 1: 3, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1 };

const LEG_MIN_FACTOR = 0.08;
const LEG_MAX_FACTOR = 0.4;
const MAX_PATH_ATTEMPTS = 24;
const MIN_SPLIT_POINTS = 9;
const SPLIT_BAND: [number, number] = [0.35, 0.65];
const HARBOR_WAIT_CHANCE = 0.45;
const MUSTER_CHANCE = 0.25;
const MAX_SEGMENTS = 15;

interface PlannedLeg {
  from: Burg;
  to: Burg;
  domain: "land" | "water" | "air";
  transport: Transport;
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

  const weights = Object.fromEntries(
    Object.entries(JOURNEY_ARCHETYPES).map(([key, archetype]) => [key, archetype.weight])
  );
  const archetype = JOURNEY_ARCHETYPES[rw(weights)];

  // an origin can turn out to be a dead end: a lone burg on an island nothing sails to
  for (let attempt = 0; attempt < ORIGIN_RETRIES; attempt++) {
    const legs = planLegs(pathfinder, archetype, burgs);
    if (!legs.length) continue;

    const segments = buildSegments(pathfinder, archetype, legs);
    if (segments.length) return { name: titleFor(archetype, legs), type: archetype.type, segments };
  }

  return null;
}

function planLegs(pathfinder: JourneyPathfinder, archetype: JourneyArchetype, burgs: Burg[]): PlannedLeg[] {
  const diagonal = Math.hypot(graphWidth, graphHeight) || 1;
  const band: [number, number] = [diagonal * LEG_MIN_FACTOR, diagonal * LEG_MAX_FACTOR];

  const origin = pickOrigin(burgs, archetype);
  const visited = new Set<number>([origin.i]);
  const legs: PlannedLeg[] = [];

  let current = origin;
  let attempts = 0;
  const legCount = Number(rw(LEG_COUNT_WEIGHTS));

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

function pickOrigin(burgs: Burg[], archetype: JourneyArchetype): Burg {
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
  archetype: JourneyArchetype
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
function buildLeg(pathfinder: JourneyPathfinder, archetype: JourneyArchetype, from: Burg, to: Burg): PlannedLeg | null {
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
function resolveTransport(weights: Record<string, number>, domain: TransportDomain): Transport | undefined {
  const types: Transport[] = pack.transports ?? [];
  const preferred = rw(weights);
  return (
    types.find(type => type.name === preferred && type.domain === domain) ?? types.find(type => type.domain === domain)
  );
}

/** Lore words, drawn fresh from the pools each time a token comes up */
const LORE_WORDS: Record<string, () => string> = {
  rank: () => ra(RANKS),
  company: () => ra(COMPANY_ADJECTIVES),
  banner: () => ra(BANNERS),
  cargo: () => ra(CARGO),
  beast: () => ra(BEASTS),
  relic: () => `${ra(COMPANY_ADJECTIVES)} ${ra(RELICS)}`,
  tavern: () => `The ${ra(TAVERN_QUALIFIERS)} ${ra(TAVERN_SUBJECTS)}`
};

/** Pick one of the templates and fill its {tokens} */
function phrase(templates: string[], context: Record<string, string> = {}): string {
  return ra(templates).replace(/{(\w+)}/g, (token, name: string) => context[name] ?? LORE_WORDS[name]?.() ?? token);
}

function buildSegments(
  pathfinder: JourneyPathfinder,
  archetype: JourneyArchetype,
  legs: PlannedLeg[]
): JouneySegment[] {
  const stayType = (pack.transports ?? []).find((type: Transport) => type.domain === "stay");

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

  const muster = Boolean(stayType) && P(MUSTER_CHANCE);
  // a long route with no pause anywhere is the bare A→B line this generator exists to replace;
  // a single hop is allowed to be exactly that
  if (stayType && legs.length > 1 && !muster && !plans.some(plan => plan.harborWait || plan.camp || plan.rest)) {
    const splittable = plans.find(plan => plan.leg.points.length >= MIN_SPLIT_POINTS);
    if (splittable) splittable.camp = true;
    else plans[0].rest = true;
  }

  const segments: JouneySegment[] = [];

  /** A leg goes in whole or not at all, so a truncated route still ends at a stop */
  const commit = (group: JouneySegment[]): boolean => {
    if (segments.length + group.length > MAX_SEGMENTS) return false;
    for (const segment of group) segments.push({ ...segment, id: segments.length });
    return true;
  };

  if (muster) {
    const name = phrase(HALT_NAMES.muster, { place: burgName(legs[0].from) });
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
      const name = phrase(HALT_NAMES.harborWait, { from });
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

    if (plan.rest)
      group.push(makeStay(stayType!, leg.to.cell, phrase(archetype.stopover, { place: to }), 12 * rand(1, 3)));

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
    transport: leg.transport.name,
    speed: leg.transport.speed,
    distance: slice.distance,
    points: slice.points
  };
  if (leg.avoidRoads) segment.avoidRoads = true;
  return segment;
}

function makeStay(stayType: Transport, cellId: number, name: string, duration: number): JouneySegment {
  const [x, y] = pack.cells.p[cellId];
  return {
    id: 0,
    name,
    from: cellId,
    to: cellId,
    transport: stayType.name,
    speed: 0,
    distance: 0,
    points: [[x, y, cellId]],
    duration
  };
}

function titleFor(archetype: JourneyArchetype, legs: PlannedLeg[]): string {
  const origin = legs[0].from;
  const destination = legs[legs.length - 1].to;
  // a title that names the country crossed wants land: "Survey of the open water" says nothing
  const namedLeg = legs.find(leg => leg.domain === "land") ?? legs[Math.floor(legs.length / 2)];
  const middle = namedLeg.points[Math.floor(namedLeg.points.length / 2)][2];

  return phrase(archetype.title, {
    hero: personName(origin),
    origin: burgName(origin),
    destination: burgName(destination),
    destinationAdjective: getAdjective(pack.states?.[destination.state ?? 0]?.name || burgName(destination)),
    // titles supply their own article ("to the ..."), so drop the one describeWater adds
    wild: namedLeg.domain === "land" ? describeWild(middle) : describeWater(namedLeg).replace(/^the /, "")
  });
}

interface TravelNaming {
  archetype: JourneyArchetype;
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
  const context = { from, to, wild };

  if (leg.domain === "air") return phrase(LEG_NAMES.air[part], context);
  if (leg.domain === "water") return phrase(LEG_NAMES.water[part], { ...context, water: describeWater(leg) });
  if (part !== "whole") return phrase(LEG_NAMES.land[part], context);

  // the closing leg names where the party ends up, however it got there
  if (leg.avoidRoads) return phrase(isLast ? LEG_NAMES.land.offRoadLast : LEG_NAMES.land.offRoad, context);
  if (isFirst) return phrase(LEG_NAMES.land.opening, context);
  if (isLast) return phrase(LEG_NAMES.land.closing, context);
  // half the time the party names the leg in its own voice, if it has one
  if (archetype.leg && P(0.5)) return phrase(archetype.leg, context);
  return phrase(LEG_NAMES.land.whole, context);
}

/** A night broken into a leg: at anchor at sea, in a camp on land */
function nameHalt(archetype: JourneyArchetype, leg: PlannedLeg, cellId: number, wild: string): string {
  const label = cellEndpointLabel(cellId);
  const nearby = label.startsWith("near ");

  if (leg.domain === "water") {
    const names = nearby ? HALT_NAMES.anchoredNear : HALT_NAMES.anchored;
    return phrase(names, { label, water: describeWater(leg) });
  }

  // near something worth naming, the party is as likely to say where it slept as how
  if (nearby) return phrase([...HALT_NAMES.campNear, ra(archetype.bivouac)], { label, wild });
  return phrase(archetype.bivouac, { wild });
}

function personName(burg: Burg): string {
  const culture = burg.culture;
  if (culture === undefined || !pack.cultures?.[culture]) return ra(NAMELESS);
  return Names.getCultureShort(culture) || ra(NAMELESS);
}

const burgName = (burg: Burg): string => burg.name || `Burg ${burg.i}`;

function describeWild(cellId: number): string {
  const height = pack.cells.h[cellId];
  if (height >= 70) return ra(HIGHLAND_TERMS);
  if (height >= 50) return ra(UPLAND_TERMS);

  const biome = pack.biomes?.[pack.cells.biome?.[cellId] ?? 0];
  if (!biome?.name) return UNKNOWN_WILD;
  return BIOME_TERMS[biome.name] ?? biome.name.toLowerCase();
}

function describeWater(leg: PlannedLeg): string {
  const middle = leg.points[Math.floor(leg.points.length / 2)][2];
  const feature = pack.features?.[pack.cells.f[middle]];
  if (feature?.name) return feature.name; // lakes are named; oceans and seas usually are not
  return feature?.type === "lake" ? "the open water" : "the open sea";
}
