// The one table that says, per key, which object holds a configuration value and where.
// See docs/architecture/configuration.md#locks
import type { z } from "zod";
import { factsSchema } from "@/components/facts-schema";
import { optionsSchema } from "@/components/options-schema";
import { readLocks, setPinResolver } from "@/utils/preferences";

type Scope = "request" | "fact" | "preference";

/** `paths` beyond the first receive the same value: one control, one value, several homes */
type Setting = { scope: Scope; paths: string[] };

const at =
  (scope: Scope) =>
  (...paths: string[]): Setting => ({ scope, paths });

const request = at("request"); // asked for; generation reads it when it resolves the requests
const fact = at("fact"); // true of the map; a pin is all that carries it to the next one
const preference = at("preference"); // this browser's; applied at once and never pinned

export const SETTINGS = {
  // requests: what the next map asks for
  mapWidth: request("generation.graph.width"),
  mapHeight: request("generation.graph.height"),
  points: request("generation.graph.density"),
  template: request("generation.template"),
  resolveDepressionsSteps: request("generation.resolveDepressionsSteps"),
  lakeElevationLimit: request("generation.lakeElevationLimit"),
  cultures: request("generation.cultures.limit"),
  culturesSet: request("generation.cultures.set"),
  statesNumber: request("generation.states.limit"),
  provincesRatio: request("generation.provinces.ratio"),
  religionsNumber: request("generation.religions.limit"),
  manors: request("generation.burgs.limit"),
  // one panel slider drives both, until the UI offers them separately
  sizeVariety: request("generation.states.sizeVariety", "generation.cultures.sizeVariety"),
  growthRate: request("generation.states.growthRate", "generation.cultures.growthRate"),

  // facts with no request of their own: the pin is how a new map keeps them
  seed: fact("seed"), // a readout: typing a seed regenerates rather than editing this map
  mapName: fact("lore.name"),
  year: fact("lore.calendar.year"),
  era: fact("lore.calendar.era"),
  // pinned beside the era rather than derived from it, so an abbreviation the user typed survives
  eraShort: fact("lore.calendar.eraShort"),
  mapSize: fact("geography.mapSize"),
  latitude: fact("geography.latitude"),
  longitude: fact("geography.longitude"),
  temperatureEquator: fact("climate.temperature.equator"),
  temperatureNorthPole: fact("climate.temperature.northPole"),
  temperatureSouthPole: fact("climate.temperature.southPole"),
  prec: fact("climate.precipitation"),
  distanceScale: fact("units.distance.scale"),
  distanceUnit: fact("units.distance.unit"),
  heightUnit: fact("units.height.unit"),
  heightExponent: fact("units.height.exponent"),
  areaUnit: fact("units.area.unit"),
  temperatureScale: fact("units.temperature.unit"),
  populationRate: fact("units.population.scale"),
  urbanization: fact("units.population.urbanization.rate"),
  urbanDensity: fact("units.population.urbanization.density"),

  // preferences: what this browser wants, whatever map is on screen
  uiSize: preference("app.ui.size"),
  tooltipSize: preference("app.ui.tooltipSize"),
  azgaarAssistant: preference("app.ui.assistant"),
  speakerVoice: preference("app.ui.speakerVoice"),
  emblemShape: preference("app.emblems.shape"),
  shapeRendering: preference("app.rendering"),
  onloadBehavior: preference("app.onLoad"),
  autosaveInterval: preference("app.autosave.interval"),
  zoomExtentMin: preference("app.zoomExtent.min"),
  zoomExtentMax: preference("app.zoomExtent.max"),
  pngResolution: preference("app.export.pngResolution"),
  tileCols: preference("app.export.tiles.cols"),
  tileRows: preference("app.export.tiles.rows"),
  tileScale: preference("app.export.tiles.scale")
} satisfies Record<string, Setting>;

/** Typing a panel's key list against this is what stops it naming a control nothing answers for */
export type SettingKey = keyof typeof SETTINGS;

const settingFor = (key: string): Setting | undefined => (SETTINGS as Record<string, Setting>)[key];

const rootOf = (scope: Scope): Record<string, any> => (scope === "fact" ? globalThis.facts : globalThis.options);

/** What the setting holds now, or undefined when nothing answers for the key */
export function read(key: string): unknown {
  const setting = settingFor(key);
  if (!setting) return undefined;
  return setting.paths[0].split(".").reduce<any>((node, step) => node?.[step], rootOf(setting.scope));
}

/** Write the value where the key says it belongs, once the schema says it is that value */
export function write(key: string, value: unknown): boolean {
  const setting = settingFor(key);
  if (!setting) return false;
  if (!schemaFor(key)?.safeParse(value).success) return false;

  const apply = () => {
    for (const path of setting.paths) {
      const steps = path.split(".");
      const target = steps.slice(0, -1).reduce<any>((node, step) => node?.[step], rootOf(setting.scope));
      if (target) target[steps.at(-1) as string] = value;
    }
  };

  // a fact changes the map now; an option is this browser's and is remembered
  if (setting.scope === "fact") apply();
  else Options.set(apply);
  return true;
}

/** The value a control's string stands for, or undefined when it stands for nothing valid */
export function parseInput(key: string, raw: string): unknown {
  const schema = schemaFor(key);
  if (!schema) return undefined;

  const asNumber = raw.trim() === "" ? Number.NaN : Number(raw);
  if (schema.safeParse(asNumber).success) return asNumber;
  if (schema.safeParse(raw).success) return raw;
  return undefined;
}

/** What this key may hold: the same contract a control and a lock are both held to */
export function schemaFor(key: string): z.ZodType | undefined {
  const setting = settingFor(key);
  if (!setting) return undefined;

  let node: any = setting.scope === "fact" ? factsSchema : optionsSchema;
  for (const step of setting.paths[0].split(".")) {
    node = unwrap(node)?.shape?.[step];
    if (!node) return undefined;
  }
  return unwrap(node);
}

/** past the nullable and optional wrappers, to the type describing the value itself */
const unwrap = (schema: any) => (typeof schema?.unwrap === "function" ? schema.unwrap() : schema);

/** A preference is never re-rolled, so there is nothing to pin it against */
export const isPinnable = (key: string): boolean => {
  const scope = settingFor(key)?.scope;
  return scope !== undefined && scope !== "preference";
};

/** What `lock(key)` stores when the caller does not pass a value of its own */
setPinResolver(key => (isPinnable(key) ? read(key) : undefined));

/** Every key the user has pinned, in no particular order */
export function pinnedKeys(): string[] {
  return Object.keys(readLocks());
}

/** Only the facts: a request pin is applied where requests are resolved, before this runs */
export function pinnedFactKeys(): string[] {
  return pinnedKeys().filter(key => settingFor(key)?.scope === "fact");
}

/** Put a pinned value back. Locks are raw `localStorage`, so it is untrusted like any other input */
export function applyPin(key: string, value: unknown): boolean {
  if (!isPinnable(key)) return false;
  if (write(key, value)) return true;

  ERROR && console.error(`applyPin: "${key}" is pinned to a value its schema rejects, ignored`);
  return false;
}
