// Bringing this browser's stored data up to the layout the app expects.
// A migration describes a world that no longer exists, so it carries its own copy of it and never
// leans on the live model: what the app calls things today is free to keep changing

import { CELLS_BY_DENSITY, STORAGE_KEY } from "@/components/options";
import { LOCKS_KEY } from "@/utils/preferences";
import { safeParseJSON } from "@/utils/stringUtils";

/** Where each option lived before the move, and where it goes in the options object */
const LEGACY_SETTINGS: [key: string, path: string, parse?: (value: string) => unknown][] = [
  ["seed", "seed"],
  ["mapName", "lore.name"],
  ["mapWidth", "graph.width", Number],
  ["mapHeight", "graph.height", Number],
  ["template", "heightmap.template"],
  ["resolveDepressionsSteps", "heightmap.resolveDepressionsSteps", Number],
  ["lakeElevationLimit", "heightmap.lakeElevationLimit", Number],
  ["year", "lore.calendar.year", Number],
  ["era", "lore.calendar.era"],
  ["cultures", "cultures.limit", Number],
  ["culturesSet", "cultures.set"],
  ["statesNumber", "states.limit", Number],
  ["growthRate", "states.growthRate", Number],
  ["sizeVariety", "states.sizeVariety", Number],
  ["provincesRatio", "provinces.ratio", Number],
  ["manors", "burgs.limit", Number],
  ["religionsNumber", "religions.limit", Number],
  ["heightExponent", "units.height.exponent", Number],
  ["populationRate", "units.population.scale", Number],
  ["urbanization", "units.population.urbanization.rate", Number],
  ["urbanDensity", "units.population.urbanization.density", Number],
  ["distanceScale", "units.distance.scale", Number],
  ["distanceUnit", "units.distance.unit"],
  ["heightUnit", "units.height.unit"],
  ["areaUnit", "units.area.unit"],
  ["temperatureScale", "units.temperature.unit"],
  ["temperatureEquator", "climate.temperature.equator", Number],
  ["temperatureNorthPole", "climate.temperature.northPole", Number],
  ["temperatureSouthPole", "climate.temperature.southPole", Number],
  ["prec", "climate.precipitation", Number],
  ["mapSize", "geography.mapSize", Number],
  ["latitude", "geography.latitude", Number],
  ["longitude", "geography.longitude", Number]
];

/** The one setting a key of its own could not express, and the groups kept as their own JSON */
const LEGACY_GROUPS: [key: string, path: string][] = [
  ["military", "military"],
  ["burg-groups", "burgs.groups"],
  ["options-labels", "labels"],
  ["trade-animation", "trade.animation"],
  ["coastline-settings", "coastline"],
  ["options-transports", "transports"]
];

/**
 * Up to v1.151 every option had a localStorage key of its own, and a key being there was what
 * "locked" meant. Fold those keys into the one stored options object, and turn the keys that
 * held a value into the locks they stood for
 */
export function migrateStoredOptions(): void {
  if (localStorage.getItem(STORAGE_KEY)) return; // already the current layout, or a first visit

  const options: Record<string, any> = {};
  const locks: string[] = [];

  const take = (key: string) => {
    const value = localStorage.getItem(key);
    localStorage.removeItem(key);
    return value;
  };

  for (const [key, path, parse] of LEGACY_SETTINGS) {
    const value = take(key);
    if (value === null) continue;
    assign(options, path, parse ? parse(value) : value);
    locks.push(key);
  }

  // the Points slider stored its step, the cell count was derived from it
  const density = take("points");
  if (density !== null) {
    assign(options, "graph.density", +density);
    assign(options, "graph.cellsDesired", CELLS_BY_DENSITY[+density]);
    locks.push("points");
  }

  const winds = take("winds");
  if (winds) assign(options, "climate.winds", winds.split(",").map(Number));

  for (const [key, path] of LEGACY_GROUPS) {
    const value = safeParseJSON(take(key) ?? "");
    if (value) assign(options, path, value);
  }

  if (!Object.keys(options).length && !locks.length) return; // nothing was stored the old way

  localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  if (locks.length) localStorage.setItem(LOCKS_KEY, JSON.stringify(locks));
}

/** Write a value at a dotted path, creating the objects on the way */
function assign(target: Record<string, any>, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  let node = target;
  for (const key of keys) node = node[key] ??= {};
  node[last] = value;
}
