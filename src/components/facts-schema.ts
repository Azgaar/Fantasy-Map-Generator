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

// regiments resolve their unit type by name
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

// route segments reference a transport type by name
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
  seed: z.string(),

  graph: z.strictObject({
    width: z.number().positive(),
    height: z.number().positive(),
    points: z.number().positive()
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

  /** the name set cultures were drawn from: unrelated generators still branch on it long after the
   * cultures exist, which no count, rate or variety does - those are asked for, then spent */
  cultures: z.strictObject({ set: z.string() }),

  /** names files, state history and battle reports; the description is the author's own note */
  lore: z.strictObject({
    name: z.string(),
    description: z.string(),
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
