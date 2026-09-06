// All app configuration options, options.map saved to `.map` file as settings; docs/architecture/configuration.md
import { z } from "zod";
import type { LayerId } from "@/components/layers";
import { MAX_DENSITY, MIN_DENSITY } from "@/data/graph-density";
import { count, degrees, hexColor, ids, nonNegative, percent, positive, ratio } from "@/utils/schemaUtils";

/** the burg request at its maximum stands for "as many burgs as the land supports" */
export const AUTO_BURG_LIMIT = 1000;

const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;
const LABEL_MODES = ["auto", "short", "full"] as const;
const TRANSPORT_DOMAINS = ["land", "water", "air", "stay"] as const;

export const labelGroup = z.strictObject({
  name: z.string(),
  type: z.enum(LABEL_TYPES),
  active: z.boolean().optional(),
  // the id of a layer the registry still has. Nothing to check it against until the registry is
  // loaded, and dropping every group would be the worse answer, so an unloaded registry accepts
  layerDependency: z
    .custom<LayerId>(value => typeof value === "string" && (globalThis.Layers?.has(value) ?? true))
    .nullable()
    .optional(),
  zoom: z.strictObject({ min: nonNegative.nullable(), max: nonNegative.nullable() }),
  mode: z.enum(LABEL_MODES).optional(),
  isDefault: z.boolean().optional()
});

export const burgGroup = z.strictObject({
  name: z.string(),
  order: z.number(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  removed: z.boolean().optional(),
  min: nonNegative.optional(),
  max: nonNegative.optional(),
  percentile: percent.optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  biomes: ids,
  states: ids,
  cultures: ids,
  religions: ids,
  preview: z.string().optional()
});

export const militaryUnit = z.strictObject({
  icon: z.string(),
  name: z.string(),
  rural: nonNegative,
  urban: nonNegative,
  crew: positive,
  power: nonNegative,
  type: z.string(),
  separate: z.number().int(),
  biomes: ids,
  states: ids,
  cultures: ids,
  religions: ids
});

export const transport = z.strictObject({
  i: z.number().int(),
  name: z.string(),
  speed: nonNegative,
  domain: z.enum(TRANSPORT_DOMAINS),
  hoursPerDay: positive.max(24).optional(),
  icon: z.string().optional()
});

/** read at render time to build every feature outline */
export const coastlineSettings = z.strictObject({
  enabled: z.boolean(),
  maxDepth: count,
  baseAmplitude: nonNegative,
  amplitudeDecay: nonNegative,
  minEdge: nonNegative,
  smoothThreshold: nonNegative,
  roughnessContrast: nonNegative,
  profileHarmonics: count,
  lakeSmoothThreshMult: nonNegative
});

/** where the map sits on the globe */
const geography = z.strictObject({
  mapSize: percent,
  latitude: percent,
  longitude: percent,
  coordinates: z.strictObject({
    latT: z.number().min(0).max(180),
    latN: z.number().min(-90).max(90),
    latS: z.number().min(-90).max(90),
    lonT: z.number().min(0).max(360),
    lonW: z.number().min(-180).max(180),
    lonE: z.number().min(-180).max(180)
  })
});

/** produced the per-cell temperature and precipitation, and re-derives them on change */
const climate = z.strictObject({
  temperature: z.strictObject({ equator: z.number(), northPole: z.number(), southPole: z.number() }),
  precipitation: nonNegative,
  winds: z.array(degrees).length(6)
});

/** names files, state history and battle reports; the description is the author's own note */
const lore = z.strictObject({
  name: z.string(),
  description: z.string(),
  calendar: z.strictObject({ year: z.number().int(), era: z.string(), eraShort: z.string() })
});

/** the map's scale, and the author's presentation of it. Units may be named by the user */
const units = z.strictObject({
  distance: z.strictObject({ unit: z.string(), scale: positive }),
  area: z.strictObject({ unit: z.string() }),
  height: z.strictObject({ unit: z.string(), exponent: positive }),
  temperature: z.strictObject({ unit: z.string() }),
  population: z.strictObject({
    scale: positive,
    urbanization: z.strictObject({ rate: nonNegative, density: positive })
  })
});

/**
 * The map's own configuration, and the whole of what a `.map` file stores in its settings block.
 * Saving writes this object and loading replaces it, so the two are the same shape by construction
 */
export const mapSchema = z.strictObject({
  seed: z.string(),
  graph: z.strictObject({ width: positive, height: positive, points: positive }),
  geography,
  climate,
  cultures: z.strictObject({ set: z.string().min(1) }),
  lore,
  units,
  style: z.strictObject({ preset: z.string().min(1) }),
  burgs: z.strictObject({ groups: z.array(burgGroup) }),
  labels: z.strictObject({ resizeOnZoom: z.boolean(), groups: z.array(labelGroup) }),
  military: z.strictObject({ units: z.array(militaryUnit) }),
  transports: z.array(transport),
  coastline: coastlineSettings
});

// ---------------------------------------------------------------------------------------------
// The whole of what this browser holds
// ---------------------------------------------------------------------------------------------

export const optionsSchema = z.strictObject({
  /** what is true about the map on screen, and what a `.map` file stores */
  map: mapSchema,

  /** what to ask the generators for */
  generation: z.strictObject({
    /** the graph the next map is built on: its extent, and how finely it is divided */
    graph: z.strictObject({
      width: positive,
      height: positive,
      density: count.min(MIN_DENSITY).max(MAX_DENSITY) // the Points slider step
    }),
    template: z.string(), // ids include the user's own precreated heightmaps, so no enum
    resolveDepressionsSteps: count,
    lakeElevationLimit: nonNegative,
    cultures: z.strictObject({
      limit: count,
      set: z.string().min(1),
      sizeVariety: nonNegative,
      growthRate: nonNegative
    }),
    states: z.strictObject({ limit: count, sizeVariety: nonNegative, growthRate: nonNegative }),
    provinces: z.strictObject({ ratio: percent }),
    religions: z.strictObject({ limit: count }),
    burgs: z.strictObject({ limit: count }) // AUTO_BURG_LIMIT means "as many as the land supports"
  }),

  /** how the app itself behaves: applied at once, generating nothing, describing no map */
  app: z.strictObject({
    notesPinned: z.boolean(),
    // "show everything regardless of zoom" is this browser inspecting the map, not the map itself
    emblems: z.strictObject({ showAll: z.boolean(), shape: z.string().min(1) }),
    labels: z.strictObject({ showAll: z.boolean() }),
    rendering: z.enum(["geometricPrecision", "optimizeSpeed"]), // the viewbox shape-rendering
    // when the viewport layers are rewritten during a zoom: every frame, or once the gesture settles
    viewportRedraw: z.enum(["continuous", "settled"]),
    onLoad: z.enum(["random", "lastSaved"]), // what the app does with no map asked for
    zoomExtent: z.strictObject({ min: positive, max: positive }).refine(({ min, max }) => min <= max, {
      message: "zoomExtent.min must not exceed max"
    }),
    // the map window on screen. null until the user sets one: it then follows the browser window
    viewport: z.strictObject({ width: positive, height: positive }).nullable(),
    autosave: z.strictObject({ interval: count, remind: z.boolean() }), // interval in minutes, 0 is off
    ui: z.strictObject({
      size: positive.nullable(), // null until the user picks one: the interface follows the extent
      tooltipSize: positive,
      themeColor: hexColor,
      transparency: percent,
      assistant: z.enum(["show", "hide"]),
      speakerVoice: z.string() // the index into the browser's voice list, "" until one is picked
    }),
    export: z.strictObject({
      pngResolution: positive,
      tiles: z.strictObject({ cols: count.positive(), rows: count.positive(), scale: positive })
    }),
    trade: z.strictObject({
      animation: z.strictObject({
        displayType: z.enum(["local", "global", "both"]),
        concurrent: count.positive(),
        duration: positive,
        landDurationModifier: nonNegative,
        segmentChangePause: nonNegative,
        markerSize: positive
      })
    }),
    threeD: z.strictObject({
      scale: positive,
      lightness: ratio,
      shadow: ratio,
      sun: z.strictObject({ x: z.number(), y: z.number(), z: z.number() }),
      rotateMesh: z.number(),
      rotateGlobe: z.number(),
      skyColor: hexColor,
      waterColor: hexColor,
      sunColor: hexColor,
      extendedWater: z.boolean(),
      labels3d: z.boolean(),
      satellite: z.boolean(),
      wireframe: z.boolean(),
      // the globe texture multiplier is derived from the scale where it is read, never stored
      resolutionScale: positive,
      subdivide: z.boolean(),
      erosion: z.boolean(),
      erosionDetail: nonNegative,
      erosionStrength: nonNegative,
      erosionRiverDepth: nonNegative,
      erosionOctaves: count
    })
  })
});

export type OptionsData = z.infer<typeof optionsSchema>;
export type OptionsSection = keyof OptionsData;

/** What a `.map` file stores, and what every generator, renderer and editor reads */
export type MapData = z.infer<typeof mapSchema>;
