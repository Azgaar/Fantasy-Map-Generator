// Every option a lock can pin, and where its current value lives.
// A lock stores the value and not just the key, so the pin survives loading a map - see
// docs/architecture/configuration.md#locks. This table is the one place that says, per lock key,
// which object answers for it: a request in `options`, or a fact with no request of its own.
import { readLocks, setPinResolver } from "@/utils/preferences";

type Pin = { get: () => unknown; set: (value: never) => void; scope: "request" | "fact" };

const pinTo =
  (scope: Pin["scope"]) =>
  <T>(get: () => T, set: (value: T) => void): Pin => ({ get, set: set as (value: never) => void, scope });

/** A pin on a request: `options` answers for it, and generation reads it when it resolves them */
const request = pinTo("request");

/** A pin on a fact with no request of its own: the pin is the only thing that carries it over */
const fact = pinTo("fact");

export const PINNABLE: Record<string, Pin> = {
  // requests: what the next map asks for
  mapWidth: request(
    () => options.generation.graph.width,
    value => (options.generation.graph.width = value)
  ),
  mapHeight: request(
    () => options.generation.graph.height,
    value => (options.generation.graph.height = value)
  ),
  points: request(
    () => options.generation.graph.density,
    value => Options.setDensity(value)
  ),
  template: request(
    () => options.generation.template,
    value => (options.generation.template = value)
  ),
  resolveDepressionsSteps: request(
    () => options.generation.resolveDepressionsSteps,
    value => (options.generation.resolveDepressionsSteps = value)
  ),
  lakeElevationLimit: request(
    () => options.generation.lakeElevationLimit,
    value => (options.generation.lakeElevationLimit = value)
  ),
  cultures: request(
    () => options.generation.cultures.limit,
    value => (options.generation.cultures.limit = value)
  ),
  culturesSet: request(
    () => options.generation.cultures.set,
    value => (options.generation.cultures.set = value)
  ),
  statesNumber: request(
    () => options.generation.states.limit,
    value => (options.generation.states.limit = value)
  ),
  provincesRatio: request(
    () => options.generation.provinces.ratio,
    value => (options.generation.provinces.ratio = value)
  ),
  religionsNumber: request(
    () => options.generation.religions.limit,
    value => (options.generation.religions.limit = value)
  ),
  manors: request(
    () => options.generation.burgs.limit,
    value => (options.generation.burgs.limit = value)
  ),
  sizeVariety: request(
    () => options.generation.states.sizeVariety,
    value => Options.setSizeVariety(value)
  ),
  growthRate: request(
    () => options.generation.states.growthRate,
    value => {
      options.generation.states.growthRate = value;
      options.generation.cultures.growthRate = value;
    }
  ),

  // facts with no request of their own: the pin is how a new map keeps them
  mapName: fact(
    () => facts.lore.name,
    value => (facts.lore.name = value)
  ),
  year: fact(
    () => facts.lore.calendar.year,
    value => (facts.lore.calendar.year = value)
  ),
  era: fact(
    () => facts.lore.calendar.era,
    value => (facts.lore.calendar.era = value)
  ),
  // pinned beside the era rather than derived from it, so an abbreviation the user typed survives
  eraShort: fact(
    () => facts.lore.calendar.eraShort,
    value => (facts.lore.calendar.eraShort = value)
  ),
  mapSize: fact(
    () => facts.geography.mapSize,
    value => (facts.geography.mapSize = value)
  ),
  latitude: fact(
    () => facts.geography.latitude,
    value => (facts.geography.latitude = value)
  ),
  longitude: fact(
    () => facts.geography.longitude,
    value => (facts.geography.longitude = value)
  ),
  temperatureEquator: fact(
    () => facts.climate.temperature.equator,
    value => (facts.climate.temperature.equator = value)
  ),
  temperatureNorthPole: fact(
    () => facts.climate.temperature.northPole,
    value => (facts.climate.temperature.northPole = value)
  ),
  temperatureSouthPole: fact(
    () => facts.climate.temperature.southPole,
    value => (facts.climate.temperature.southPole = value)
  ),
  prec: fact(
    () => facts.climate.precipitation,
    value => (facts.climate.precipitation = value)
  ),
  distanceScale: fact(
    () => facts.units.distance.scale,
    value => (facts.units.distance.scale = value)
  ),
  distanceUnit: fact(
    () => facts.units.distance.unit,
    value => (facts.units.distance.unit = value)
  ),
  heightUnit: fact(
    () => facts.units.height.unit,
    value => (facts.units.height.unit = value)
  ),
  heightExponent: fact(
    () => facts.units.height.exponent,
    value => (facts.units.height.exponent = value)
  ),
  areaUnit: fact(
    () => facts.units.area.unit,
    value => (facts.units.area.unit = value)
  ),
  temperatureScale: fact(
    () => facts.units.temperature.unit,
    value => (facts.units.temperature.unit = value)
  ),
  populationRate: fact(
    () => facts.units.population.scale,
    value => (facts.units.population.scale = value)
  ),
  urbanization: fact(
    () => facts.units.population.urbanization.rate,
    value => (facts.units.population.urbanization.rate = value)
  ),
  urbanDensity: fact(
    () => facts.units.population.urbanization.density,
    value => (facts.units.population.urbanization.density = value)
  )
};

/** What `lock(key)` stores when the caller does not pass a value of its own */
setPinResolver(key => PINNABLE[key]?.get());

/** Every key the user has pinned, in no particular order */
export function pinnedKeys(): string[] {
  return Object.keys(readLocks());
}

/**
 * The pinned keys a fact answers for. A request pin is applied where the request is resolved -
 * seeding facts from an already-resolved request is what keeps the two from disagreeing
 */
export function pinnedFactKeys(): string[] {
  return pinnedKeys().filter(key => PINNABLE[key]?.scope === "fact");
}

/**
 * Write a pinned value back where it belongs. Locks are raw `localStorage`, so the value is
 * untrusted like anything else crossing a boundary: it must at least be the type the option holds.
 * Returns false when the key is not pinnable or the value cannot stand in for it
 */
export function applyPin(key: string, value: unknown): boolean {
  const entry = PINNABLE[key];
  if (!entry) return false;

  if (typeof value !== typeof entry.get()) {
    ERROR && console.error(`applyPin: "${key}" is pinned to a ${typeof value}, ignored`);
    return false;
  }

  entry.set(value as never);
  return true;
}
