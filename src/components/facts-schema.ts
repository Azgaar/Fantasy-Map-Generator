import { z } from "zod";
import type { LayerId } from "@/components/layers";
import { count, degrees, nonNegative, percent, positive } from "@/utils/schemaUtils";

// A fact is a value the map cannot be operated correctly without
const LABEL_TYPES = ["state", "province", "burg", "river", "route", "added"] as const;
const LABEL_MODES = ["auto", "short", "full"] as const;
const TRANSPORT_DOMAINS = ["land", "water", "air", "stay"] as const;

// entity ids the definition sets filter by; a stale one filters nothing rather than breaking
const entityIds = z.array(z.number().int()).optional();

// a group whose layer no longer exists is never drawn, so the id is checked against the registry
// rather than asserted. The registry is a runtime global: importing it would pull every renderer
// into the schema, and it is not up yet while this module evaluates
const layerId = z.custom<LayerId>(value =>
  typeof value !== "string" || !value ? false : (globalThis.Layers?.has(value) ?? true)
);

export const labelGroup = z.strictObject({
  name: z.string(),
  type: z.enum(LABEL_TYPES),
  active: z.boolean().optional(),
  layerDependency: layerId.nullable().optional(),
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
  biomes: entityIds,
  states: entityIds,
  cultures: entityIds,
  religions: entityIds,
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
  biomes: entityIds,
  states: entityIds,
  cultures: entityIds,
  religions: entityIds
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

export const factsSchema = z.strictObject({
  seed: z.string(),

  graph: z.strictObject({ width: positive, height: positive, points: positive }),

  /** where the map sits on the globe; `coordinates` is a cache of the three values above and the
   * extent's aspect ratio - recomputed on load, never trusted from the file */
  geography: z.strictObject({
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
  }),

  /** produced the per-cell temperature and precipitation, and re-derives them on change */
  climate: z.strictObject({
    temperature: z.strictObject({ equator: z.number(), northPole: z.number(), southPole: z.number() }),
    precipitation: nonNegative,
    winds: z.array(degrees).length(6)
  }),

  /** the name set cultures were drawn from: unrelated generators still branch on it long after the
   * cultures exist, which no count, rate or variety does - those are asked for, then spent */
  cultures: z.strictObject({ set: z.string().min(1) }),

  /** names files, state history and battle reports; the description is the author's own note */
  lore: z.strictObject({
    name: z.string(),
    description: z.string(),
    calendar: z.strictObject({ year: z.number().int(), era: z.string(), eraShort: z.string() })
  }),

  /** the map's scale, and the author's presentation of it. Units may be named by the user */
  units: z.strictObject({
    distance: z.strictObject({ unit: z.string(), scale: positive }),
    area: z.strictObject({ unit: z.string() }),
    height: z.strictObject({ unit: z.string(), exponent: positive }),
    temperature: z.strictObject({ unit: z.string() }),
    population: z.strictObject({
      scale: positive,
      urbanization: z.strictObject({ rate: nonNegative, density: positive })
    })
  }),

  /** label data references groups by name; whether all labels are shown is a browser preference */
  labels: z.strictObject({ resizeOnZoom: z.boolean(), groups: z.array(labelGroup) }),

  /** the name of the preset the map's styles came from, so the Style tab can show it again */
  style: z.strictObject({ preset: z.string().min(1) }),

  military: z.strictObject({ units: z.array(militaryUnit) }),
  transports: z.array(transport),
  burgs: z.strictObject({ groups: z.array(burgGroup) }),

  /** read at render time to build every feature outline */
  coastline: coastlineSettings
});

export type FactsData = z.infer<typeof factsSchema>;
export type FactsSection = keyof FactsData;
