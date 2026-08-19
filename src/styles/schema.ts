import { z } from "zod";

// Every attribute is nullable: null means "remove this attribute", absent means "leave it alone".
const attrsShape = {
  opacity: z.coerce.number().nullable().optional(),
  fill: z.string().nullable().optional(),
  "fill-opacity": z.coerce.number().nullable().optional(),
  stroke: z.string().nullable().optional(),
  "stroke-width": z.coerce.number().nullable().optional(),
  // SVG accepts a bare number here (e.g. legacy `stroke-dasharray: 2`); coerce so it isn't
  // mistaken for an invalid value and dropped.
  "stroke-dasharray": z.coerce.string().nullable().optional(),
  "stroke-linecap": z.string().nullable().optional(),
  "stroke-linejoin": z.string().nullable().optional(),
  "stroke-opacity": z.coerce.number().nullable().optional(),
  filter: z.string().nullable().optional(),
  mask: z.string().nullable().optional(),
  "font-size": z.union([z.coerce.number(), z.string()]).nullable().optional(),
  "font-family": z.string().nullable().optional(),
  "letter-spacing": z.coerce.number().nullable().optional(),
  style: z.string().nullable().optional(),
  transform: z.string().nullable().optional(),
  "shape-rendering": z.string().nullable().optional(),
  "background-color": z.string().nullable().optional()
} as const;

const attrsSchema = z.object(attrsShape).strict();
export type Attrs = z.infer<typeof attrsSchema>;

// Ids that carry style, mirroring `mapLayers` in src/components/layers.ts (keys are registry
// layer ids, not svg group ids: `rulers` is `<g id="ruler">`). Three are not registry entries:
// `map` is the svg root, and `burgIcons`/`anchors` are the two container groups the registry's
// icons layer (`<g id="icons">`) nests - all three are resolved by the applier, which keeps the
// tree two levels deep everywhere.
export const STYLE_LAYER_IDS = [
  "ocean",
  "landmass",
  "texture",
  "heightmap",
  "lakes",
  "biomes",
  "cells",
  "grid",
  "coordinates",
  "compass",
  "rivers",
  "relief",
  "religions",
  "cultures",
  "states",
  "provinces",
  "zones",
  "borders",
  "routes",
  "temperature",
  "coastline",
  "ice",
  "goods",
  "markets",
  "trade",
  "precipitation",
  "population",
  "emblems",
  "burgIcons",
  "anchors",
  "labels",
  "military",
  "markers",
  "fogging",
  "rulers",
  "scaleBar",
  "vignette",
  "legend",
  "map"
] as const;

export type StyleLayerId = (typeof STYLE_LAYER_IDS)[number];

// Registry-declared children per layer, mirroring the `children` arrays in `mapLayers`
// (src/components/layers.ts). Kept as a static duplicate rather than importing that module:
// layers.ts pulls in every renderer, and several assign to `window` at module scope
// (draw-legend, overlays/fogging, trade-animation) — importing it here would throw when this
// schema loads under plain node (e.g. a future preset-conversion script) instead of a browser
// or a vitest run with test-setup's window shim. schema.test.ts asserts this stays in sync.
export const DECLARED_CHILDREN = {
  ocean: ["oceanLayers", "oceanPattern"],
  heightmap: ["oceanHeights", "landHeights"],
  lakes: ["freshwater", "salt", "sinkhole", "frozen", "lava", "dry"],
  compass: ["compassRose"],
  states: ["statesBody", "statesHalo"],
  borders: ["stateBorders", "provinceBorders"],
  routes: ["roads", "trails", "searoutes"],
  coastline: ["sea_island", "lake_island"],
  goods: ["goodsCells", "goodsIcons", "goodsBurgs"],
  population: ["rural", "urban"],
  emblems: ["burgEmblems", "provinceEmblems", "stateEmblems"]
} as const satisfies Partial<Record<StyleLayerId, readonly string[]>>;

// Widened view for runtime lookups keyed by an arbitrary StyleLayerId (the const object above
// only has properties for layers that declare children, so indexing it with the full
// StyleLayerId union needs this cast; the literal object itself stays narrow for ChildId below).
const DECLARED_CHILDREN_LOOKUP = DECLARED_CHILDREN as Partial<Record<StyleLayerId, readonly string[]>>;

// matches the renderer's own coercion (`Boolean(+ocean.attr("data-render"))`, draw-heightmap.ts):
// legacy DOM/JSON values are "0"/"1" strings or 0/1 numbers, and plain z.coerce.boolean() would
// turn "0" into `true` (any non-empty string is truthy), so this replicates `Boolean(+v)` instead.
const booleanFromLegacyFlag = z.union([z.boolean(), z.number(), z.string()]).transform(v => Boolean(Number(v)));

const heightsOptionsSchema = z
  .object({
    scheme: z.string().optional(),
    terracing: z.coerce.number().optional(),
    skip: z.coerce.number().optional(),
    relax: z.coerce.number().optional(),
    curve: z.string().optional(),
    render: booleanFromLegacyFlag.optional()
  })
  .strict();

// each burg-type group under burgIcons/anchors is a full node: presentation via `attrs`
// (the shared attrsSchema), plus the renderer knobs (`size`, `icon`) via `options`.
const burgGroupOptionsSchema = z.object({ size: z.coerce.number().optional(), icon: z.string().optional() }).strict();
const labelGroupOptionsSchema = z
  .object({
    fontSize: z.coerce.number().optional(),
    dx: z.coerce.number().optional(),
    dy: z.coerce.number().optional()
  })
  .strict();

// Registry-keyed layer options: what each layer's own <g>/<use>/etc attrs can carry beyond `attrs`.
const layerOptionsSchema = z
  .object({
    coordinates: z.object({ fontSize: z.coerce.number().optional() }).strict(),
    markers: z.object({ rescale: z.coerce.number().optional() }).strict(),
    military: z.object({ fontSize: z.coerce.number().optional(), boxSize: z.coerce.number().optional() }).strict(),
    legend: z
      .object({
        fontSize: z.coerce.number().optional(),
        x: z.coerce.number().optional(),
        y: z.coerce.number().optional(),
        columns: z.coerce.number().optional(),
        // the legend backdrop is a single rect#legendBox inside the layer, not the layer itself:
        // its paint must never reach <g id="legend">, where the label text would inherit it
        box: z.object({ fill: z.string().optional(), fillOpacity: z.coerce.number().optional() }).strict().optional()
      })
      .strict(),
    rulers: z.object({ fontSize: z.coerce.number().optional() }).strict(),
    markets: z
      .object({
        size: z.coerce.number().optional(),
        fontSize: z.coerce.number().optional(),
        icon: z.string().optional()
      })
      .strict(),
    ocean: z
      .object({
        outline: z.string().optional(),
        baseFill: z.string().optional(),
        pattern: z.object({ href: z.string().optional(), opacity: z.coerce.number().optional() }).strict().optional()
      })
      .strict(),
    relief: z
      .object({
        set: z.enum(["simple", "colored", "gray"]).optional(),
        size: z.coerce.number().optional()
      })
      .strict(),
    texture: z
      .object({
        href: z.string().optional(),
        x: z.coerce.number().optional(),
        y: z.coerce.number().optional()
      })
      .strict(),
    grid: z
      .object({
        type: z.string().optional(),
        scale: z.coerce.number().optional(),
        dx: z.coerce.number().optional(),
        dy: z.coerce.number().optional()
      })
      .strict(),
    temperature: z.object({ fontSize: z.coerce.number().optional() }).strict(),
    scaleBar: z
      .object({
        fontSize: z.coerce.number().optional(),
        barSize: z.coerce.number().optional(),
        x: z.coerce.number().optional(),
        y: z.coerce.number().optional(),
        label: z.string().optional(),
        back: z
          .object({
            opacity: z.coerce.number().optional(),
            fill: z.string().optional(),
            stroke: z.string().optional(),
            strokeWidth: z.coerce.number().optional(),
            filter: z.string().nullable().optional(),
            top: z.coerce.number().optional(),
            right: z.coerce.number().optional(),
            bottom: z.coerce.number().optional(),
            left: z.coerce.number().optional()
          })
          .strict()
          .optional()
      })
      .strict(),
    compass: z
      .object({
        use: z
          .object({
            x: z.coerce.number().optional(),
            y: z.coerce.number().optional(),
            scale: z.coerce.number().optional()
          })
          .strict()
          .optional()
      })
      .strict(),
    vignette: z
      .object({
        rect: z
          .object({
            x: z.string().optional(),
            y: z.string().optional(),
            width: z.string().optional(),
            height: z.string().optional(),
            rx: z.string().optional(),
            ry: z.string().optional(),
            filter: z.string().nullable().optional()
          })
          .strict()
          .optional()
      })
      .strict(),
    map: z.object({ dataFilter: z.string().nullable().optional() }).strict()
  })
  .strict();

export type LayerOptions = z.infer<typeof layerOptionsSchema>;

// Per-child `options` schemas, keyed by the registry's own child ids. This gates ONLY the
// `options` payload: any child declared in DECLARED_CHILDREN can carry `attrs` whether or not
// it appears here (e.g. `states.statesBody`, `goods.goodsCells`, `routes.roads` have no options
// schema and are attrs-only). `labels`, `burgIcons` and `anchors` are the dynamic-key layers:
// their children are user-namable groups, so they map an arbitrary key to a group options schema.
const childOptionsSchema = z
  .object({
    states: z.object({ statesHalo: z.object({ width: z.coerce.number().optional() }).strict() }).strict(),
    heightmap: z.object({ landHeights: heightsOptionsSchema, oceanHeights: heightsOptionsSchema }).strict(),
    emblems: z
      .object({
        burgEmblems: z.object({ size: z.coerce.number().optional() }).strict(),
        provinceEmblems: z.object({ size: z.coerce.number().optional() }).strict(),
        stateEmblems: z.object({ size: z.coerce.number().optional() }).strict()
      })
      .strict(),
    goods: z
      .object({
        goodsIcons: z.object({ size: z.coerce.number().optional(), circle: z.coerce.number().optional() }).strict(),
        goodsBurgs: z.object({ size: z.coerce.number().optional() }).strict()
      })
      .strict(),
    burgIcons: z.record(z.string(), burgGroupOptionsSchema),
    anchors: z.record(z.string(), burgGroupOptionsSchema),
    labels: z.record(z.string(), labelGroupOptionsSchema)
  })
  .strict();

export type ChildOptions = z.infer<typeof childOptionsSchema>;

// Layers whose `children` map accepts arbitrary keys (user-namable groups) rather than the fixed
// registry child ids, each mapped to the options schema its groups carry.
const DYNAMIC_GROUP_OPTIONS = {
  labels: labelGroupOptionsSchema,
  burgIcons: burgGroupOptionsSchema,
  anchors: burgGroupOptionsSchema
} as const satisfies Partial<Record<StyleLayerId, z.ZodObject<z.ZodRawShape>>>;

const DYNAMIC_GROUP_OPTIONS_LOOKUP = DYNAMIC_GROUP_OPTIONS as Partial<Record<StyleLayerId, z.ZodTypeAny>>;
const DYNAMIC_CHILD_LAYERS = new Set<string>(Object.keys(DYNAMIC_GROUP_OPTIONS));

// Declared-children ids for a layer, unioning both sources of truth: DECLARED_CHILDREN (the
// registry's fixed children, attrs-only ones included, e.g. states.statesBody) and ChildOptions
// (which only lists children that carry an `options` schema, e.g. states.statesHalo). Neither
// alone is complete - states needs both branches to get "statesBody" | "statesHalo". A layer in
// neither resolves to `never` (no valid child, e.g. "markers"); the dynamic-group layers
// (`labels`, `burgIcons`, `anchors`) resolve to plain `string`, since their ChildOptions entry is
// a Record keyed by a group name only the user knows.
type DeclaredChildId<Id extends StyleLayerId> = Id extends keyof typeof DECLARED_CHILDREN
  ? (typeof DECLARED_CHILDREN)[Id][number]
  : never;
type SchemaChildId<Id extends StyleLayerId> = Id extends keyof ChildOptions ? keyof ChildOptions[Id] & string : never;
export type ChildId<Id extends StyleLayerId> = DeclaredChildId<Id> | SchemaChildId<Id>;

type StyleChildNode = {
  attrs?: Attrs;
  options?: unknown;
};

export type StyleData = {
  [Id in StyleLayerId]?: {
    attrs?: Attrs;
    options?: Id extends keyof LayerOptions ? LayerOptions[Id] : never;
    children?: Record<string, StyleChildNode>;
  };
};

const STYLE_LAYER_ID_SET = new Set<string>(STYLE_LAYER_IDS);

function warnDropped(kind: string, key: string): void {
  console.warn(`parseStyleData: dropping unknown ${kind} "${key}"`);
}

/** Validate one attrs object, dropping (and warning on) any key the schema doesn't recognize. */
function parseAttrs(raw: unknown): Attrs {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    // Object.hasOwn, never `in`/plain indexing: a preset is untrusted JSON, so a key like
    // "toString" would otherwise resolve to a prototype method and blow up on .safeParse
    if (!Object.hasOwn(attrsShape, key)) {
      warnDropped("attr", key);
      continue;
    }
    const fieldSchema = attrsSchema.shape[key as keyof typeof attrsShape] as z.ZodTypeAny | undefined;
    if (!fieldSchema) {
      warnDropped("attr", key);
      continue;
    }
    const result = fieldSchema.safeParse(value);
    if (!result.success) {
      warnDropped("attr", key);
      continue;
    }
    out[key] = result.data;
  }
  return out as Attrs;
}

/** Validate one options object for a given layer, dropping (and warning on) unknown keys. */
function parseOptions(layerId: StyleLayerId, raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return {};
  const layerSchema = (layerOptionsSchema.shape as Record<string, z.ZodTypeAny | undefined>)[layerId];
  if (!layerSchema) {
    for (const key of Object.keys(raw as Record<string, unknown>)) warnDropped("option", `${layerId}.${key}`);
    return {};
  }
  const out: Record<string, unknown> = {};
  const shape = (layerSchema as z.ZodObject<z.ZodRawShape>).shape;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const fieldSchema = Object.hasOwn(shape, key) ? (shape[key] as z.ZodTypeAny | undefined) : undefined;
    if (!fieldSchema) {
      warnDropped("option", `${layerId}.${key}`);
      continue;
    }
    const result = fieldSchema.safeParse(value);
    if (!result.success) {
      warnDropped("option", `${layerId}.${key}`);
      continue;
    }
    out[key] = result.data;
  }
  return out;
}

/** Validate one grandchild options object (burg/label group), dropping unknown keys. */
function parseGroupOptions(groupSchema: z.ZodTypeAny, path: string, raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) return {};
  const shape = (groupSchema as z.ZodObject<z.ZodRawShape>).shape;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const fieldSchema = Object.hasOwn(shape, key) ? (shape[key] as z.ZodTypeAny | undefined) : undefined;
    if (!fieldSchema) {
      warnDropped("option", `${path}.${key}`);
      continue;
    }
    const result = fieldSchema.safeParse(value);
    if (!result.success) {
      warnDropped("option", `${path}.${key}`);
      continue;
    }
    out[key] = result.data;
  }
  return out;
}

/** Validate one child's `options` payload against its declared schema, if any (attrs-only children have none). */
function parseChildOptions(layerId: StyleLayerId, childKey: string, raw: unknown): unknown {
  const layerShapes = childOptionsSchema.shape as Record<string, z.ZodTypeAny | undefined>;
  const layerShape = Object.hasOwn(layerShapes, layerId) ? layerShapes[layerId] : undefined;
  if (!layerShape || !(layerShape instanceof z.ZodObject)) {
    if (typeof raw === "object" && raw !== null) {
      for (const key of Object.keys(raw as Record<string, unknown>))
        warnDropped("option", `${layerId}.${childKey}.${key}`);
    }
    return undefined;
  }
  const childShape = layerShape.shape as Record<string, z.ZodTypeAny | undefined>;
  const childSchema = Object.hasOwn(childShape, childKey) ? childShape[childKey] : undefined;
  if (!childSchema) {
    if (typeof raw === "object" && raw !== null) {
      for (const key of Object.keys(raw as Record<string, unknown>))
        warnDropped("option", `${layerId}.${childKey}.${key}`);
    }
    return undefined;
  }
  return parseGroupOptions(childSchema, `${layerId}.${childKey}`, raw);
}

function parseChildEntry(layerId: StyleLayerId, childKey: string, raw: unknown): StyleChildNode {
  if (typeof raw !== "object" || raw === null) return {};
  const entry = raw as Record<string, unknown>;
  const result: StyleChildNode = {};
  if ("attrs" in entry) result.attrs = parseAttrs(entry.attrs);
  if ("options" in entry) {
    // a dynamic layer's group KEYS are arbitrary, but their options are not: they go through the
    // group schema, which childOptionsSchema wires up as a record rather than an object
    const groupSchema = DYNAMIC_GROUP_OPTIONS_LOOKUP[layerId];
    result.options = groupSchema
      ? parseGroupOptions(groupSchema, `${layerId}.${childKey}`, entry.options)
      : parseChildOptions(layerId, childKey, entry.options);
  }
  return result;
}

/**
 * Validate one layer's `children` map: fixed registry keys everywhere except the dynamic-group
 * layers, which allow arbitrary group keys. A key gets in as long as it's registry-declared
 * (DECLARED_CHILDREN); whether it also has an `options` schema is a separate, per-key check.
 */
function parseChildren(layerId: StyleLayerId, raw: unknown): Record<string, StyleChildNode> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, StyleChildNode> = {};
  const isDynamic = DYNAMIC_CHILD_LAYERS.has(layerId);
  const declared = DECLARED_CHILDREN_LOOKUP[layerId];

  for (const [childKey, childValue] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDynamic && !declared?.includes(childKey)) {
      warnDropped("child", `${layerId}.${childKey}`);
      continue;
    }

    out[childKey] = parseChildEntry(layerId, childKey, childValue);
  }

  return out;
}

/**
 * Parse and validate a serialized style tree. Unknown attrs/options/layer ids/children are
 * dropped (each with a `console.warn`); only a non-object input throws.
 */
export function parseStyleData(json: unknown): StyleData {
  if (typeof json !== "object" || json === null) {
    throw new TypeError("parseStyleData: expected an object");
  }

  const out: StyleData = {};
  for (const [layerId, layerValue] of Object.entries(json as Record<string, unknown>)) {
    if (!STYLE_LAYER_ID_SET.has(layerId)) {
      warnDropped("layer", layerId);
      continue;
    }
    if (typeof layerValue !== "object" || layerValue === null) continue;

    const id = layerId as StyleLayerId;
    const entry: { attrs?: Attrs; options?: unknown; children?: Record<string, StyleChildNode> } = {};
    const layerData = layerValue as Record<string, unknown>;

    if ("attrs" in layerData) entry.attrs = parseAttrs(layerData.attrs);
    if ("options" in layerData) entry.options = parseOptions(id, layerData.options);
    if ("children" in layerData) entry.children = parseChildren(id, layerData.children);

    (out as Record<string, unknown>)[id] = entry;
  }

  return out;
}
