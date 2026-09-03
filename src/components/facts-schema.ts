import { z } from "zod";
import type { LayerId } from "@/components/layers";

// A fact is a value the map cannot be operated correctly without
const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;
const LABEL_MODES = ["auto", "short", "full"] as const;
const TRANSPORT_DOMAINS = ["land", "water", "air", "stay"] as const;

export const labelGroup = z.strictObject({
  name: z.string(),
  type: z.enum(LABEL_TYPES),
  active: z.boolean().optional(),
  layerDependency: z
    .custom<LayerId>(value => typeof value === "string")
    .nullable()
    .optional(),
  zoom: z.strictObject({ min: z.number().nullable(), max: z.number().nullable() }),
  mode: z.enum(LABEL_MODES).optional(),
  isDefault: z.boolean().optional()
});

export const burgGroup = z.strictObject({
  name: z.string(),
  order: z.number(),
  active: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  removed: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  percentile: z.number().optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  biomes: z.array(z.number()).optional(),
  states: z.array(z.number()).optional(),
  cultures: z.array(z.number()).optional(),
  religions: z.array(z.number()).optional(),
  preview: z.string().optional()
});

// regiments resolve their unit type by name, so the definitions travel with the map that uses them
export const militaryUnit = z.strictObject({
  icon: z.string(),
  name: z.string(),
  rural: z.number(),
  urban: z.number(),
  crew: z.number(),
  power: z.number(),
  type: z.string(),
  separate: z.number(),
  biomes: z.array(z.number()).optional(),
  states: z.array(z.number()).optional(),
  cultures: z.array(z.number()).optional(),
  religions: z.array(z.number()).optional()
});

// route segments reference a transport type by name, same as regiments reference military units
export const transport = z.strictObject({
  i: z.number(),
  name: z.string(),
  speed: z.number(),
  domain: z.enum(TRANSPORT_DOMAINS),
  hoursPerDay: z.number().optional(),
  icon: z.string().optional()
});

export const coastlineSettings = z.strictObject({
  enabled: z.boolean(),
  maxDepth: z.number(),
  baseAmplitude: z.number(),
  amplitudeDecay: z.number(),
  minEdge: z.number(),
  smoothThreshold: z.number(),
  roughnessContrast: z.number(),
  profileHarmonics: z.number(),
  lakeSmoothThreshMult: z.number()
});

export const factsSchema = z.strictObject({
  /** reproduces the map and identifies the graph it was built on */
  seed: z.string(),

  /** the coordinate extent the geometry lives in: fixed for the life of the graph, and not
   * recoverable from the topology, which floors it into cell counts */
  graph: z.strictObject({
    width: z.number().positive(),
    height: z.number().positive(),
    points: z.number().positive() // cells the graph was built to, not a request
  }),

  /** the terrain's character, re-read whenever terrain is re-derived */
  heightmap: z.strictObject({
    template: z.string(),
    resolveDepressionsSteps: z.number(),
    lakeElevationLimit: z.number()
  }),

  /** where the map sits on the globe; `coordinates` is a cache of the three values above and the
   * extent's aspect ratio - recomputed on load, never trusted from the file */
  geography: z.strictObject({
    mapSize: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    coordinates: z.strictObject({
      latT: z.number(),
      latN: z.number(),
      latS: z.number(),
      lonT: z.number(),
      lonW: z.number(),
      lonE: z.number()
    })
  }),

  /** produced the per-cell temperature and precipitation, and re-derives them on change */
  climate: z.strictObject({
    temperature: z.strictObject({ equator: z.number(), northPole: z.number(), southPole: z.number() }),
    precipitation: z.number(),
    winds: z.array(z.number()).length(6)
  }),

  /** rates and varieties are read whenever the world is extended; the count that was requested is
   * not - how many cultures exist is answered by the data */
  cultures: z.strictObject({
    set: z.string(),
    sizeVariety: z.number(),
    growthRate: z.number()
  }),
  states: z.strictObject({
    sizeVariety: z.number(),
    growthRate: z.number()
  }),

  /** names files, state history and battle reports */
  lore: z.strictObject({
    name: z.string(),
    calendar: z.strictObject({ year: z.number(), era: z.string(), eraShort: z.string() })
  }),

  /** the map's scale, and the author's presentation of it */
  units: z.strictObject({
    distance: z.strictObject({ unit: z.string(), scale: z.number() }),
    area: z.strictObject({ unit: z.string() }),
    height: z.strictObject({ unit: z.string(), exponent: z.number() }),
    temperature: z.strictObject({ unit: z.string() }),
    population: z.strictObject({
      scale: z.number(),
      urbanization: z.strictObject({ rate: z.number(), density: z.number() })
    })
  }),

  /** label data references groups by name */
  labels: z.strictObject({
    resizeOnZoom: z.boolean(),
    showAll: z.boolean(),
    groups: z.array(labelGroup)
  }),

  /** the scale bar's content and where the author put it. Its looks are in `styles` */
  scaleBar: z.strictObject({
    label: z.string(),
    position: z.strictObject({ x: z.number(), y: z.number() })
  }),

  /** the name of the preset the map's styles came from, so the Style tab can show it again */
  style: z.strictObject({ preset: z.string() }),

  military: z.strictObject({ units: z.array(militaryUnit) }),
  transports: z.array(transport),
  burgs: z.strictObject({ groups: z.array(burgGroup) }),

  /** read at render time to build every feature outline */
  coastline: coastlineSettings
});

export type FactsData = z.infer<typeof factsSchema>;
export type FactsSection = keyof FactsData;

const isImperial = () => typeof navigator !== "undefined" && navigator.language === "en-US";

/** A blank map's facts. The values here are the schema's defaults: nothing else defines them */
export function getDefaultFacts(): FactsData {
  return {
    seed: "",
    graph: { width: 1280, height: 800, points: 10000 },
    heightmap: { template: "", resolveDepressionsSteps: 250, lakeElevationLimit: 20 },
    geography: {
      mapSize: 100,
      latitude: 50,
      longitude: 50,
      coordinates: { latT: 180, latN: 90, latS: -90, lonT: 320, lonW: -160, lonE: 160 }
    },
    climate: {
      temperature: { equator: 27, northPole: -30, southPole: -15 },
      precipitation: 100,
      winds: [225, 45, 225, 315, 135, 315]
    },
    cultures: { set: "world", sizeVariety: 4, growthRate: 1 },
    states: { sizeVariety: 4, growthRate: 1 },
    lore: { name: "", calendar: { year: 1000, era: "Era", eraShort: "E" } },
    units: {
      distance: { unit: isImperial() ? "mi" : "km", scale: 3 },
      area: { unit: "square" },
      height: { unit: isImperial() ? "ft" : "m", exponent: 2 },
      temperature: { unit: isImperial() ? "°F" : "°C" },
      population: { scale: 1000, urbanization: { rate: 1, density: 10 } }
    },
    labels: { resizeOnZoom: true, showAll: false, groups: [] },
    scaleBar: { label: "", position: { x: 99, y: 99 } },
    style: { preset: "default" },
    military: { units: [] },
    transports: [],
    burgs: { groups: [] },
    coastline: {
      enabled: true,
      maxDepth: 4,
      baseAmplitude: 1.5,
      amplitudeDecay: 0.9,
      minEdge: 1,
      smoothThreshold: 0.25,
      roughnessContrast: 1.5,
      profileHarmonics: 4,
      lakeSmoothThreshMult: 2.0
    }
  };
}
