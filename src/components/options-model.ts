import type { z } from "zod";
import { adoptLegacyOptions } from "@/components/options-legacy";
import { AUTO_BURG_LIMIT, type OptionsData, optionsSchema } from "@/components/options-schema";
import { Pins } from "@/components/pins";
import { DEFAULT_DENSITY } from "@/data/graph-density";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { DEFAULT_TRADE_ANIMATION } from "@/data/trade-animation-options";
import { DEFAULT_THREE_D } from "@/data/view-3d-options";
import { Coastline } from "@/generators/coastline-generator";
import { CULTURE_SETS } from "@/generators/cultures-generator";
import { rn } from "@/utils/numberUtils";
import { deepMerge } from "@/utils/objectUtils";
import { gauss, rw } from "@/utils/probabilityUtils";
import { parseSections } from "@/utils/schemaUtils";

declare global {
  var Options: OptionsModel;
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
      viewportRedraw: "continuous",
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
    library: {
      burgGroups: Burgs.getDefaultGroups(),
      labelGroups: Labels.getDefaultGroups(),
      military: Military.getDefaultOptions(),
      transports: Transports.getDefaults(),
      coastline: Coastline.getDefaultSettings()
    }
  };
}

globalThis.options = getDefaultOptions();

const SAVE_DELAY = 500;

class OptionsModel {
  private saveTimer = 0;

  /** Change the options and remember them */
  set(change: (options: OptionsData) => void): void {
    change(globalThis.options);
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.persist(), SAVE_DELAY);
  }

  /** Write the options to localStorage */
  persist(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(globalThis.options));
  }

  /** Throw this browser's options away and start from the defaults: a reset, never a repair */
  reset(): void {
    globalThis.options = getDefaultOptions();
    Pins.clearAll(); // a pin is this browser's too, and would go on generating a value nobody asked for
    this.persist();
  }

  /**
   * Boot: adopt what this browser kept from the last session, validated and repaired. Three layers,
   * newest last - the defaults, whatever the pre-`fmg-options` namespace still holds, then what this
   * browser stored. Migrating underneath rather than afterwards is what puts the old values through
   * the schema: a definition set from an old browser is untrusted like any other stored object
   */
  restoreStored(): void {
    let stored: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
      if (typeof parsed === "object" && parsed !== null) stored = parsed;
    } catch {
      // an unreadable object is no object: this browser starts from the defaults
    }

    const source = deepMerge(getDefaultOptions() as Record<string, unknown>, adoptLegacyOptions() ?? {});
    deepMerge(source, stored);

    globalThis.options = parseSections<OptionsData>(optionsSchema, getDefaultOptions(), source, "Options.restore");
    this.persist();
    this.setGraphSize();
  }

  /** The extent the next map is generated on: what the caller asked for, a pin, or the window */
  setGraphSize(width?: number, height?: number): void {
    const { graph } = globalThis.options.generation;
    // the pinned value, not merely the absence of a roll: the pins and the options are separate
    // stores, so a repaired options object must not silently generate at a size nobody asked for
    graph.width = width || (Pins.has("mapWidth") ? Pins.valueOr("mapWidth", graph.width) : window.innerWidth);
    graph.height = height || (Pins.has("mapHeight") ? Pins.valueOr("mapHeight", graph.height) : window.innerHeight);

    // a hidden or headless tab reports no size, which would make a degenerate grid
    if (!(graph.width > 0)) graph.width = 1280;
    if (!(graph.height > 0)) graph.height = 800;
  }

  /**
   * Re-roll every request the user has not pinned. Runs before the pipeline, never after.
   * One line per request, the roll and the pin side by side
   */
  randomize(): void {
    const { generation } = globalThis.options;
    const { graph, cultures, states, provinces, religions, burgs } = generation;

    // the slider holds a density step; the cell count it stands for is derived where it is used
    graph.density = Pins.rolls("points") ? DEFAULT_DENSITY : Pins.valueOr("points", graph.density);

    generation.template = Pins.rolls("template") ? randomTemplate() : Pins.valueOr("template", generation.template);
    states.limit = Pins.rolls("statesNumber") ? gauss(18, 5, 2, 30) : Pins.valueOr("statesNumber", states.limit);
    provinces.ratio = Pins.rolls("provincesRatio")
      ? gauss(20, 10, 20, 100)
      : Pins.valueOr("provincesRatio", provinces.ratio);
    burgs.limit = Pins.rolls("manors") ? AUTO_BURG_LIMIT : Pins.valueOr("manors", burgs.limit);
    religions.limit = Pins.rolls("religionsNumber")
      ? gauss(6, 3, 2, 10)
      : Pins.valueOr("religionsNumber", religions.limit);

    // one panel slider drives states and cultures alike, until the UI offers them separately
    const variety = Pins.rolls("sizeVariety") ? gauss(4, 2, 0, 10, 1) : Pins.valueOr("sizeVariety", states.sizeVariety);
    const growth = Pins.rolls("growthRate") ? rn(1 + Math.random(), 1) : Pins.valueOr("growthRate", states.growthRate);
    states.sizeVariety = cultures.sizeVariety = variety;
    states.growthRate = cultures.growthRate = growth;

    cultures.limit = Pins.rolls("cultures") ? gauss(12, 3, 5, 30) : Pins.valueOr("cultures", cultures.limit);
    cultures.set = Pins.rolls("culturesSet") ? randomCultureSet() : Pins.valueOr("culturesSet", cultures.set);
    this.capCultures();
  }

  /** A culture set holds a fixed number of cultures: the map cannot ask for more than it has */
  capCultures(): void {
    const { cultures } = globalThis.options.generation;
    const max = CULTURE_SETS[cultures.set]?.max;
    if (max && cultures.limit > max) cultures.limit = max;
  }

  /**
   * The one thing a `.map` load may carry into options: a request the user would expect to continue
   * from the map they just opened. A pinned request is never overridden.
   * See docs/architecture/configuration.md#the-sync-allowlist
   */
  syncOnLoad(): void {
    this.set(options => {
      if (!Pins.has("mapWidth")) options.generation.graph.width = facts.graph.width;
      if (!Pins.has("mapHeight")) options.generation.graph.height = facts.graph.height;
    });
  }

  /**
   * The preservation library: a definition set the user built by hand, kept for the next map.
   * Written only by a user edit - never by a load and never by generation. The caller passes the
   * module defaults, because the module that owns the set is the one that answers for them.
   * See docs/architecture/configuration.md#preservation-across-maps
   */
  remember<K extends keyof Library>(entry: K, value: NonNullable<Library[K]>, defaults: NonNullable<Library[K]>): void {
    // both sides through the same schema, so a difference in key order is not a difference in value
    const schema = optionsSchema.shape.library.shape[entry] as z.ZodType;
    const canonical = (candidate: unknown) => JSON.stringify(schema.safeParse(candidate).data ?? null);

    this.set(options => {
      // a set the user reset to the module defaults is not one of their own: clearing the entry
      // lets the next map follow those defaults as they change, not freeze today's copy of them
      const isOwn = canonical(value) !== canonical(defaults);
      options.library[entry] = isOwn ? (structuredClone(value) as Library[K]) : null;
    });
  }

  /** The user's own set for the next map, or undefined when they have not saved one */
  recall<K extends keyof Library>(entry: K): NonNullable<Library[K]> | undefined {
    const value = globalThis.options.library[entry];
    return (value === null ? undefined : structuredClone(value)) as NonNullable<Library[K]> | undefined;
  }
}

type Library = OptionsData["library"];

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
export const Options = new OptionsModel();
globalThis.Options = Options;
