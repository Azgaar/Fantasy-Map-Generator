// The options model: the only thing that writes the options store.
// Options hold requests and preferences; they never describe the map on screen.
// See docs/architecture/configuration.md
import type { z } from "zod";
import {
  CELLS_BY_DENSITY,
  DEFAULT_DENSITY,
  getDefaultOptions,
  type OptionsData,
  optionsSchema,
  STORAGE_KEY
} from "@/components/options-schema";
import "@/components/options-store";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import { rn } from "@/utils/numberUtils";
import { isLocked, lockedValue } from "@/utils/preferences";
import { gauss, rand, rw } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Options: OptionsApi;
}

const SAVE_DELAY = 500;
let saveTimer = 0;

/** Change the options and remember them */
function set(change: (options: OptionsData) => void): void {
  change(globalThis.options);
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persist, SAVE_DELAY);
}

/** Throw this browser's options away and start from the defaults: a reset, never a repair */
function reset(): void {
  globalThis.options = getDefaultOptions();
  persist();
}

/** Write the options to localStorage */
function persist(): void {
  clearTimeout(saveTimer);
  saveTimer = 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalThis.options));
}

/** Boot: adopt what this browser kept from the last session, validated and repaired */
function restoreStored(): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  globalThis.options = stored
    ? parseSections<OptionsData>(optionsSchema, getDefaultOptions(), safeParse(stored), "Options.restore")
    : getDefaultOptions();
  adoptLegacyKeys();
  setNextMapSize();
}

/**
 * Every preference used to keep a `localStorage` key of its own, named after the control that
 * showed it, and so did every pin. There is one object and one key now: take the preferences into
 * it once and drop the whole namespace, so nothing outside the schema can reach a control again.
 *
 * A migration describes a world that no longer exists, so it carries its own list of that world's
 * keys and does not lean on today's schema. See docs/architecture/configuration.md#migrations
 */
function adoptLegacyKeys(): void {
  const read = (key: string) => localStorage.getItem(key) || null;
  const num = (key: string, apply: (value: number) => void) => {
    const value = Number(read(key));
    if (read(key) !== null && Number.isFinite(value)) apply(value);
  };
  const str = (key: string, apply: (value: string) => void) => {
    const value = read(key);
    if (value !== null) apply(value);
  };
  const { view } = globalThis.options;

  num("uiSize", value => (view.ui.size = value));
  num("tooltipSize", value => (view.ui.tooltipSize = value));
  num("transparency", value => (view.ui.transparency = value));
  str("themeColor", value => (view.ui.themeColor = value));
  str("speakerVoice", value => (view.ui.speakerVoice = value));
  str("azgaarAssistant", value => (view.ui.assistant = value));
  str("shapeRendering", value => (view.rendering = value));
  str("onloadBehavior", value => (view.onLoad = value));
  str("emblemShape", value => (view.emblemShape = value));
  num("autosaveInterval", value => (view.autosave.interval = value));
  num("pngResolution", value => (view.export.pngResolution = value));
  num("tileCols", value => (view.export.tiles.cols = value));
  num("tileRows", value => (view.export.tiles.rows = value));
  num("tileScale", value => (view.export.tiles.scale = value));
  if (read("noReminder")) view.autosave.remind = false;
  if (read("disable_click_arrow_tooltip")) view.ui.clickArrowTip = false;

  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  persist();
}

/** The `localStorage` keys of the pre-`fmg-options` world: preferences, and the pins beside them */
const LEGACY_KEYS = [
  // preferences, adopted above
  "uiSize",
  "tooltipSize",
  "transparency",
  "themeColor",
  "speakerVoice",
  "azgaarAssistant",
  "shapeRendering",
  "onloadBehavior",
  "emblemShape",
  "autosaveInterval",
  "pngResolution",
  "tileCols",
  "tileRows",
  "tileScale",
  "noReminder",
  "disable_click_arrow_tooltip",
  // requests and facts, which the objects answer for and a lock pins
  "mapWidth",
  "mapHeight",
  "points",
  "template",
  "resolveDepressionsSteps",
  "lakeElevationLimit",
  "cultures",
  "culturesSet",
  "statesNumber",
  "provincesRatio",
  "religionsNumber",
  "manors",
  "sizeVariety",
  "growthRate",
  "mapName",
  "year",
  "era",
  "seed",
  "mapSize",
  "latitude",
  "longitude",
  "temperatureEquator",
  "temperatureNorthPole",
  "temperatureSouthPole",
  "prec",
  "distanceScale",
  "distanceUnit",
  "heightUnit",
  "heightExponent",
  "areaUnit",
  "temperatureScale",
  "populationRate",
  "urbanization",
  "urbanDensity"
] as const;

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/** The extent the next map is generated on: what the caller asked for, a pin, or the window */
function setNextMapSize(width?: number, height?: number): void {
  const { nextMap } = globalThis.options;
  // the pinned value, not merely the absence of a roll: the locks and the options are separate
  // stores, so a repaired options object must not silently generate at a size nobody asked for
  const pinnedSize = (key: string, current: number) => lockedValue<number>(key) ?? current;

  if (width) nextMap.width = width;
  else nextMap.width = isLocked("mapWidth") ? pinnedSize("mapWidth", nextMap.width) : window.innerWidth;

  if (height) nextMap.height = height;
  else nextMap.height = isLocked("mapHeight") ? pinnedSize("mapHeight", nextMap.height) : window.innerHeight;

  // a hidden or headless tab reports no size, which would make a degenerate grid
  if (!(nextMap.width > 0)) nextMap.width = 1280;
  if (!(nextMap.height > 0)) nextMap.height = 800;
}

/** Re-roll every request the user has not pinned. Runs before the pipeline, never after */
function randomize(): void {
  const ignorePins = new URL(window.location.href).searchParams.get("options") === "default";
  const roll = (key: string) => ignorePins || !isLocked(key);
  const keep = <T>(key: string, fallback: T): T => {
    const value = ignorePins ? undefined : lockedValue<T>(key);
    return value === undefined ? fallback : value;
  };
  const { generation, nextMap } = globalThis.options;

  // the slider holds a density step and the cell count is derived from it, so both branches go
  // through setDensity - a step without its cell count generates a map of the wrong size
  setDensity(roll("points") ? DEFAULT_DENSITY : keep("points", nextMap.density)); // a default, not a roll

  generation.template = roll("template") ? randomTemplate() : keep("template", generation.template);
  generation.states.limit = roll("statesNumber") ? gauss(18, 5, 2, 30) : keep("statesNumber", generation.states.limit);
  generation.provinces.ratio = roll("provincesRatio")
    ? gauss(20, 10, 20, 100)
    : keep("provincesRatio", generation.provinces.ratio);
  generation.burgs.limit = roll("manors") ? 1000 : keep("manors", generation.burgs.limit); // 1000 is auto
  generation.religions.limit = roll("religionsNumber")
    ? gauss(6, 3, 2, 10)
    : keep("religionsNumber", generation.religions.limit);
  generation.cultures.limit = roll("cultures") ? gauss(12, 3, 5, 30) : keep("cultures", generation.cultures.limit);
  generation.cultures.set = roll("culturesSet") ? randomCultureSet() : keep("culturesSet", generation.cultures.set);

  setSizeVariety(roll("sizeVariety") ? gauss(4, 2, 0, 10, 1) : keep("sizeVariety", generation.states.sizeVariety));

  const rate = roll("growthRate") ? rn(1 + Math.random(), 1) : keep("growthRate", generation.states.growthRate);
  generation.states.growthRate = rate;
  generation.cultures.growthRate = rate;

  capCultures();
}

function setDensity(density: number): void {
  const { nextMap } = globalThis.options;
  nextMap.density = density;
  nextMap.points = CELLS_BY_DENSITY[density] ?? nextMap.points;
}

/** A culture set holds a fixed number of cultures: the map cannot ask for more than it has */
function capCultures(): void {
  const { cultures } = globalThis.options.generation;
  const max = CULTURE_SETS[cultures.set]?.max;
  if (max && cultures.limit > max) cultures.limit = max;
}

/** One panel slider drives both, until the UI offers them separately */
function setSizeVariety(variety: number): void {
  const { generation } = globalThis.options;
  generation.cultures.sizeVariety = generation.states.sizeVariety = variety;
}

/**
 * The one thing a `.map` load may carry into options: a request the user would expect to continue
 * from the map they just opened. A pinned request is never overridden.
 * See docs/architecture/configuration.md#the-sync-allowlist
 */
function syncOnLoad(): void {
  set(options => {
    if (!isLocked("mapWidth")) options.nextMap.width = globalThis.facts.graph.width;
    if (!isLocked("mapHeight")) options.nextMap.height = globalThis.facts.graph.height;
    if (!isLocked("template")) options.generation.template = globalThis.facts.heightmap.template;
  });
}

const isAutoBurgLimit = (): boolean => globalThis.options.generation.burgs.limit === 1000;

/**
 * The preservation library: the user's own definition sets, carried to the next map. Written only
 * by a user edit - never by a load and never by generation.
 * See docs/architecture/configuration.md#preservation-across-maps
 */
type Library = OptionsData["library"];

function remember<K extends keyof Library>(
  entry: K,
  value: NonNullable<Library[K]>,
  defaults: NonNullable<Library[K]>
): void {
  set(options => {
    // a set the user reset to the module defaults is not one of their own: clearing the entry lets
    // the next map follow the defaults as they change, instead of freezing today's copy of them
    const isOwn = canonical(entry, value) !== canonical(entry, defaults);
    options.library[entry] = isOwn ? (structuredClone(value) as Library[K]) : null;
  });
}

/** Both sides through the same schema, so a difference in key order is not a difference in value */
function canonical<K extends keyof Library>(entry: K, value: unknown): string {
  const schema = optionsSchema.shape.library.shape[entry] as z.ZodType;
  return JSON.stringify(schema.safeParse(value).data ?? null);
}

/** The user's own set for the next map, or undefined when they have not saved one */
function recall<K extends keyof Library>(entry: K): NonNullable<Library[K]> | undefined {
  const value = globalThis.options.library[entry];
  return (value === null ? undefined : structuredClone(value)) as NonNullable<Library[K]> | undefined;
}

/** weighted by how good each template looks, so the common ones come up more often */
function randomTemplate(): string {
  const probabilities: Record<string, number> = {};
  for (const [id, template] of Object.entries(heightmapTemplates)) probabilities[id] = template.probability || 0;
  return rw(probabilities);
}

function randomCultureSet(): string {
  return rw(Object.fromEntries(Object.entries(CULTURE_SETS).map(([id, set]) => [id, set.probability])));
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam, as in styles.ts
export const Options = {
  set,
  persist,
  reset,
  restoreStored,
  setNextMapSize,
  syncOnLoad,
  randomize,
  setDensity,
  capCultures,
  setSizeVariety,
  isAutoBurgLimit,
  remember,
  recall,
  randomYear: () => rand(100, 2000)
};

type OptionsApi = typeof Options;
globalThis.Options = Options;
