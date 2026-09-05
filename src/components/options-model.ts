import type { z } from "zod";
import { adoptLegacyOptions } from "@/components/options-legacy";
import { type OptionsData, optionsSchema } from "@/components/options-schema";
import { DEFAULT_DENSITY, getPointsNumber } from "@/data/graph-density";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { DEFAULT_TRADE_ANIMATION } from "@/data/trade-animation-options";
import { DEFAULT_THREE_D } from "@/data/view-3d-options";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import { rn } from "@/utils/numberUtils";
import { deepMerge } from "@/utils/objectUtils";
import { clearLocks, isLocked, pinned, rolls } from "@/utils/preferences";
import { gauss, rand, rw } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Options: OptionsApi;
  /** this browser's options, read bare across the app and replaced wholesale on restore */
  var options: OptionsData;
}

export const STORAGE_KEY = "fmg-options";
export const THEME_COLOR = "#997787";

/** A fresh browser's options */
export function getDefaultOptions(): OptionsData {
  return {
    generation: {
      graph: { width: 1280, height: 800, density: DEFAULT_DENSITY },
      template: "",
      resolveDepressionsSteps: 250,
      lakeElevationLimit: 20,
      cultures: { limit: 12, set: "world", sizeVariety: 4, growthRate: 1 },
      states: { limit: 18, sizeVariety: 4, growthRate: 1 },
      provinces: { ratio: 20 },
      religions: { limit: 6 },
      burgs: { limit: 1000 }
    },
    app: {
      notesPinned: false,
      emblems: { showAll: false, shape: "culture" },
      labels: { showAll: false },
      rendering: "optimizeSpeed",
      onLoad: "random",
      zoomExtent: { min: 1, max: 20 },
      viewport: null,
      autosave: { interval: 15, remind: true },
      ui: {
        size: null,
        tooltipSize: 14,
        themeColor: THEME_COLOR,
        transparency: 5,
        assistant: "show",
        speakerVoice: "",
        clickArrowTip: true
      },
      export: { pngResolution: 1, tiles: { cols: 8, rows: 8, scale: 1 } },
      trade: { animation: { ...DEFAULT_TRADE_ANIMATION } },
      threeD: { ...DEFAULT_THREE_D }
    },
    library: { military: null, transports: null, burgGroups: null, labelGroups: null, coastline: null }
  };
}

globalThis.options = getDefaultOptions();

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
  clearLocks(); // a pin is this browser's too, and would go on generating a value nobody asked for
  persist();
}

/** Write the options to localStorage */
function persist(): void {
  clearTimeout(saveTimer);
  saveTimer = 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(globalThis.options));
}

/**
 * Boot: adopt what this browser kept from the last session, validated and repaired. Three layers,
 * newest last - the defaults, whatever the pre-`fmg-options` namespace still holds, then what this
 * browser stored. Migrating underneath rather than afterwards is what puts the old values through
 * the schema: a definition set from an old browser is untrusted like any other stored object
 */
function restoreStored(): void {
  const source = deepMerge(getDefaultOptions() as Record<string, unknown>, adoptLegacyOptions() ?? {});
  deepMerge(source, safeParse(localStorage.getItem(STORAGE_KEY) ?? ""));

  globalThis.options = parseSections<OptionsData>(optionsSchema, getDefaultOptions(), source, "Options.restore");
  persist();
  setGraphSize();
}

function safeParse(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** The extent the next map is generated on: what the caller asked for, a pin, or the window */
function setGraphSize(width?: number, height?: number): void {
  const { graph } = globalThis.options.generation;
  // the pinned value, not merely the absence of a roll: the locks and the options are separate
  // stores, so a repaired options object must not silently generate at a size nobody asked for
  graph.width = width || (isLocked("mapWidth") ? pinned("mapWidth", graph.width) : window.innerWidth);
  graph.height = height || (isLocked("mapHeight") ? pinned("mapHeight", graph.height) : window.innerHeight);

  // a hidden or headless tab reports no size, which would make a degenerate grid
  if (!(graph.width > 0)) graph.width = 1280;
  if (!(graph.height > 0)) graph.height = 800;
}

/** Re-roll every request the user has not pinned. Runs before the pipeline, never after */
function randomize(): void {
  const { generation } = globalThis.options;

  // the slider holds a density step and the cell count is derived from it, so both branches go
  // through setDensity - a step without its cell count generates a map of the wrong size
  setDensity(rolls("points") ? DEFAULT_DENSITY : pinned("points", generation.graph.density)); // a default, not a roll

  generation.template = rolls("template") ? randomTemplate() : pinned("template", generation.template);
  generation.states.limit = rolls("statesNumber")
    ? gauss(18, 5, 2, 30)
    : pinned("statesNumber", generation.states.limit);
  generation.provinces.ratio = rolls("provincesRatio")
    ? gauss(20, 10, 20, 100)
    : pinned("provincesRatio", generation.provinces.ratio);
  generation.burgs.limit = rolls("manors") ? 1000 : pinned("manors", generation.burgs.limit); // 1000 is auto
  generation.religions.limit = rolls("religionsNumber")
    ? gauss(6, 3, 2, 10)
    : pinned("religionsNumber", generation.religions.limit);
  setSizeVariety(rolls("sizeVariety") ? gauss(4, 2, 0, 10, 1) : pinned("sizeVariety", generation.states.sizeVariety));
  setGrowthRate(rolls("growthRate") ? rn(1 + Math.random(), 1) : pinned("growthRate", generation.states.growthRate));

  // the culture rolls come last: every roll above draws from the seeded PRNG, so reordering them
  // hands each request a different draw and the same seed stops producing the same map
  generation.cultures.limit = rolls("cultures") ? gauss(12, 3, 5, 30) : pinned("cultures", generation.cultures.limit);
  generation.cultures.set = rolls("culturesSet") ? randomCultureSet() : pinned("culturesSet", generation.cultures.set);

  capCultures();
}

function setDensity(density: number): void {
  globalThis.options.generation.graph.density = density;
}

/** A culture set holds a fixed number of cultures: the map cannot ask for more than it has */
function capCultures(): void {
  const { cultures } = globalThis.options.generation;
  const max = CULTURE_SETS[cultures.set]?.max;
  if (max && cultures.limit > max) cultures.limit = max;
}

/** One panel slider drives states and cultures alike, until the UI offers them separately */
function setSizeVariety(variety: number): void {
  const { generation } = globalThis.options;
  generation.cultures.sizeVariety = generation.states.sizeVariety = variety;
}

function setGrowthRate(rate: number): void {
  const { generation } = globalThis.options;
  generation.cultures.growthRate = generation.states.growthRate = rate;
}

/**
 * The one thing a `.map` load may carry into options: a request the user would expect to continue
 * from the map they just opened. A pinned request is never overridden.
 * See docs/architecture/configuration.md#the-sync-allowlist
 */
function syncOnLoad(): void {
  set(options => {
    if (!isLocked("mapWidth")) options.generation.graph.width = facts.graph.width;
    if (!isLocked("mapHeight")) options.generation.graph.height = facts.graph.height;
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
  setGraphSize,
  syncOnLoad,
  randomize,
  setDensity,
  cellsFor: getPointsNumber,
  capCultures,
  isAutoBurgLimit,
  remember,
  recall,
  randomYear: () => rand(100, 2000)
};

type OptionsApi = typeof Options;
globalThis.Options = Options;
