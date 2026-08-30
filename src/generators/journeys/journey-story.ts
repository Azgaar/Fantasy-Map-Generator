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
  type TravelDomain,
  UNKNOWN_WILD,
  UPLAND_TERMS
} from "@/data/journey-lore";
import type { Journey, JourneyPoint, JourneySegment } from "@/types/Journey";
import { getAdjective, P, ra, rand, rw } from "@/utils";
import type { Burg } from "../burgs-generator";
import type { Transport, TransportDomain } from "../transports-generator";
import { cellPlacePhrase } from "./journey-places";
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
  domain: TravelDomain;
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

  const sea = domainShare(archetype, "water");
  const overWater = Math.min(1, sea + domainShare(archetype, "air"));

  // a party that mostly sails has to start where the ships are — unless the map has no coast to speak of
  const ports = burgs.filter(burg => burg.port);
  const pool = primaryDomain(archetype) === "water" && ports.length > 1 ? ports : burgs;

  const scored = pool
    .map(burg => {
      let score = (burg.population ?? 1) + 1;
      if (burg.capital) score *= 2.5;
      // the more of the journey goes by sea, the less a party can afford to start away from the water
      score *= burg.port ? 1 + sea * 2 : 1 - sea * 0.7;
      // a burg alone on its island has nowhere overland to go — no trouble to a party that leaves by sea or air
      const overland = Math.min(1, (neighbours[pack.cells.f[burg.cell]] ?? 1) / 3);
      score *= overland + (1 - overland) * overWater;
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
  const sea = domainShare(archetype, "water");
  const landbound = !crossesWater(archetype);

  const inBand: { burg: Burg; score: number }[] = [];
  const outOfBand: { burg: Burg; score: number }[] = [];

  for (const burg of burgs) {
    if (visited.has(burg.i)) continue;
    // a party with no way over water can only reach its own landmass, so don't waste a try on the rest
    if (landbound && pack.cells.f[burg.cell] !== pack.cells.f[current.cell]) continue;

    let score = 1 + Math.log10(1 + (burg.population ?? 0));
    if (burg.capital) score += 0.8;
    if (burg.state !== current.state) score += 0.8;
    // sailors steer from port to port; for everyone else a port is a pleasant coincidence
    const sailable = burg.port && current.port;
    if (burg.port) score += sailable ? sea * 3 : sea;
    if (!sailable) score *= 1 - sea * 0.8;
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
 * Route one leg the way this party travels: its domains rolled by weight, best first.
 * The roll decides the leg; the rest are there for when the map refuses — an inland pair
 * for a party of sailors, a lake crossing with no port on the far side.
 */
function buildLeg(pathfinder: JourneyPathfinder, archetype: JourneyArchetype, from: Burg, to: Burg): PlannedLeg | null {
  for (const domain of rollDomains(archetype)) {
    // a water leg needs somewhere to tie up at both ends; land and air are only refused by the path
    if (domain === "water" && !(from.port && to.port)) continue;

    const transport = resolveTransport(archetype, domain);
    if (!transport) continue;

    for (const avoidRoads of roadPreference(archetype, domain)) {
      const { points, distance, errorCode } = pathfinder.findPath(from.cell, to.cell, domain, { avoidRoads });
      if (errorCode || points.length < 2 || !pathfinder.isValidPath(points, domain)) continue;

      return { from, to, domain, transport, avoidRoads, points, distance };
    }
  }

  return null;
}

/** The party's domains in the order it would try them: a weighted shuffle, so weight decides how often */
function rollDomains(archetype: JourneyArchetype): TravelDomain[] {
  const remaining: Record<string, number> = { ...archetype.domains };
  const order: TravelDomain[] = [];

  while (Object.keys(remaining).length) {
    const domain = rw(remaining) as TravelDomain;
    order.push(domain);
    delete remaining[domain];
  }

  return order;
}

/** Off-road is a land habit: a party that takes to the wild still falls back to the roads */
function roadPreference(archetype: JourneyArchetype, domain: TravelDomain): boolean[] {
  if (domain !== "land") return [false];
  return P(archetype.offRoad) ? [true, false] : [false];
}

/**
 * The party's rolled preference if the map still has it, then any other type it would have taken,
 * and only then the most modest type of the domain. The last resort matters: falling back to the
 * first type of a domain would put a fantasy party in whatever sits at the top of the list.
 */
function resolveTransport(archetype: JourneyArchetype, domain: TravelDomain): Transport | undefined {
  const inDomain: Transport[] = Transports.all.filter(type => type.domain === domain);
  if (!inDomain.length) return undefined;

  const weights = archetype.transports[domain] ?? {};
  const byName = (name: string) => inDomain.find(type => type.name === name);
  const preferred = Object.keys(weights).length ? byName(rw(weights)) : undefined;
  if (preferred) return preferred;

  for (const name of Object.keys(weights)) {
    const alternative = byName(name);
    if (alternative) return alternative;
  }

  return inDomain.reduce((slowest, type) => (type.speed < slowest.speed ? type : slowest));
}

/** The domain the party is built around: what it does unless the map won't let it */
function primaryDomain(archetype: JourneyArchetype): TravelDomain {
  const entries = Object.entries(archetype.domains) as [TravelDomain, number][];
  return entries.reduce((first, entry) => (entry[1] > first[1] ? entry : first))[0];
}

/** The share of this party's travel that goes by `domain`, 0 to 1 */
function domainShare(archetype: JourneyArchetype, domain: TravelDomain): number {
  const weights = Object.values(archetype.domains) as number[];
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return total ? (archetype.domains[domain] ?? 0) / total : 0;
}

/** Whether the party can leave its landmass at all — everyone else is stuck with what it can walk to */
function crossesWater(archetype: JourneyArchetype): boolean {
  return domainShare(archetype, "water") + domainShare(archetype, "air") > 0;
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
): JourneySegment[] {
  const stayType = Transports.getByDomain("stay");

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

  const segments: JourneySegment[] = [];

  /** A leg goes in whole or not at all, so a truncated route still ends at a stop */
  const commit = (group: JourneySegment[]): boolean => {
    if (segments.length + group.length > MAX_SEGMENTS) return false;
    for (const segment of group) segments.push({ ...segment, i: segments.length });
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
    const group: JourneySegment[] = [];

    if (plan.harborWait) {
      // a party of sailors is waiting on its own ship, not on a berth to be found
      const pool = primaryDomain(archetype) === "water" ? HALT_NAMES.castingOff : HALT_NAMES.harborWait;
      const name = phrase(pool, { from });
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

function makeTravel(leg: PlannedLeg, slice: PathSlice, name: string): JourneySegment {
  const segment: JourneySegment = {
    i: 0, // reassigned on push, so the ids stay sequential
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

function makeStay(stayType: Transport, cellId: number, name: string, duration: number): JourneySegment {
  const [x, y] = pack.cells.p[cellId];
  return {
    i: 0,
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
  const label = cellPlacePhrase(cellId); // "at Redgate" / "near Redgate", or null out in the wild

  if (leg.domain === "water") {
    const names = label ? HALT_NAMES.anchoredNear : HALT_NAMES.anchored;
    return phrase(names, { label: label ?? "", water: describeWater(leg) });
  }

  // near something worth naming, the party is as likely to say where it slept as how
  if (label) return phrase([...HALT_NAMES.campNear, ra(archetype.bivouac)], { label, wild });
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
