import { z } from "zod";
import type { LayerId } from "@/components/layers";
import { count, degrees, ids, nonNegative, percent, positive } from "@/utils/schemaUtils";

const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;
const LABEL_MODES = ["auto", "short", "full"] as const;
const TRANSPORT_DOMAINS = ["land", "water", "air", "stay"] as const;

export const labelGroup = z.strictObject({
  name: z.string(),
  type: z.enum(LABEL_TYPES),
  active: z.boolean().optional(),
  layerDependency: z
    .custom<LayerId>(value => typeof value === "string" && Layers?.has(value))
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

// regiments resolve their unit type by name
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

// route segments reference a transport type by name
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

export const factsSchema = z.strictObject({
  seed: z.string(),
  graph: z.strictObject({ width: positive, height: positive, points: positive }),
  geography,
  climate,
  cultures: z.strictObject({ set: z.string().min(1) }),
  lore,
  units,
  labels: z.strictObject({ resizeOnZoom: z.boolean(), groups: z.array(labelGroup) }),
  style: z.strictObject({ preset: z.string().min(1) }),
  military: z.strictObject({ units: z.array(militaryUnit) }),
  transports: z.array(transport),
  burgs: z.strictObject({ groups: z.array(burgGroup) }),
  coastline: coastlineSettings
});

export type FactsData = z.infer<typeof factsSchema>;
export type FactsSection = keyof FactsData;
