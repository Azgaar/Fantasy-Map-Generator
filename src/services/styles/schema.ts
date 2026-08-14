import { z } from "zod";

export type PresentationValue = string | number | null;

export interface StyleNode {
  presentation?: Record<string, PresentationValue>;
  options?: Record<string, unknown>;
  children?: Record<string, StyleNode>;
}

export const LAYER_IDS = [
  "map",
  "armies",
  "anchors",
  "biomes",
  "borders",
  "burgIcons",
  "cells",
  "coastline",
  "compass",
  "coordinates",
  "cults",
  "emblems",
  "fogging",
  "goods",
  "gridOverlay",
  "ice",
  "labels",
  "lakes",
  "landmass",
  "legend",
  "markers",
  "markets",
  "oceanLayers",
  "population",
  "prec",
  "provs",
  "regions",
  "relig",
  "rivers",
  "routes",
  "ruler",
  "scaleBar",
  "temperature",
  "terrain",
  "terrs",
  "texture",
  "tradeAnimation",
  "vignette",
  "zones"
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export interface Style {
  layers: Partial<Record<LayerId, StyleNode>>;
}

const presentationSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

const styleNodeSchema: z.ZodType<StyleNode> = z.lazy(() =>
  z.object({
    presentation: presentationSchema.optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    children: z.record(z.string(), styleNodeSchema).optional()
  })
);

// null is a legitimate option value (remove-attribute semantics, same as presentation); numeric
// fields coerce numeric strings (legacy JSON sometimes stores e.g. "0" instead of 0) - .nullable()
// must wrap the coercion so an explicit null bypasses Number(null) === 0 and survives as null
const num = () => z.coerce.number().nullable();
const str = () => z.string().nullable();

// typed per-layer options; keys absent here mean the layer has no options
export const layerOptionsSchemas: Partial<Record<LayerId, z.ZodType>> = {
  armies: z.object({ fontSize: num(), boxSize: num() }).partial(),
  compass: z.object({ use: z.object({ x: num(), y: num(), scale: num() }).partial() }).partial(),
  coordinates: z.object({ fontSize: num() }).partial(),
  gridOverlay: z.object({ type: str(), scale: num(), dx: num(), dy: num() }).partial(),
  legend: z.object({ fontSize: num(), x: num(), y: num(), columns: num() }).partial(),
  markers: z.object({ rescale: num() }).partial(),
  markets: z.object({ size: num(), fontSize: num(), icon: str() }).partial(),
  oceanLayers: z
    .object({
      layers: str(),
      baseFill: str(),
      pattern: z.object({ href: str(), opacity: num() }).partial()
    })
    .partial(),
  ruler: z.object({ fontSize: num() }).partial(),
  scaleBar: z
    .object({
      fontSize: num(),
      barSize: num(),
      x: num(),
      y: num(),
      label: str(),
      back: z
        .object({
          opacity: num(),
          fill: str(),
          stroke: str(),
          strokeWidth: num(),
          filter: str(),
          top: num(),
          right: num(),
          bottom: num(),
          left: num()
        })
        .partial()
    })
    .partial(),
  temperature: z.object({ fontSize: num() }).partial(),
  terrain: z.object({ set: z.enum(["simple", "colored", "gray"]).nullable(), size: num() }).partial(),
  texture: z.object({ href: str(), x: num(), y: num() }).partial(),
  vignette: z
    .object({
      rect: z.object({ x: str(), y: str(), width: str(), height: str(), rx: str(), ry: str(), filter: str() }).partial()
    })
    .partial()
};

function heightsOptions() {
  return z.object({ scheme: str(), terracing: num(), skip: num(), relax: num(), curve: str() }).partial();
}

// options living on a CHILD node (validated when parsing that child)
// keys of the form "layerId/*" are a wildcard fallback for any child of that layer
export const childOptionsSchemas: Record<string, z.ZodType> = {
  "emblems/stateEmblems": z.object({ size: num() }).partial(),
  "emblems/provinceEmblems": z.object({ size: num() }).partial(),
  "emblems/burgEmblems": z.object({ size: num() }).partial(),
  "goods/goodsIcons": z.object({ size: num(), circle: num() }).partial(),
  "goods/goodsBurgs": z.object({ size: num() }).partial(),
  "regions/statesHalo": z.object({ width: num() }).partial(),
  "terrs/landHeights": heightsOptions(),
  "terrs/oceanHeights": heightsOptions(),
  "labels/*": z.object({ fontSize: num(), dx: num(), dy: num() }).partial(),
  "burgIcons/*": z.object({ size: num() }).partial(),
  "anchors/*": z.object({ size: num() }).partial()
};

function findChildOptionsSchema(path: string, childId: string): z.ZodType | undefined {
  return childOptionsSchemas[`${path}/${childId}`] ?? childOptionsSchemas[`${path}/*`];
}

const layersSchema = z.record(z.string(), styleNodeSchema);
const styleSchema = z.object({ layers: layersSchema });

export function parseStyle(json: unknown): Style {
  const parsed = styleSchema.parse(json);
  const layers: Style["layers"] = {};

  for (const [key, node] of Object.entries(parsed.layers)) {
    if (!(LAYER_IDS as readonly string[]).includes(key)) {
      console.warn(`Style: dropping unknown layer "${key}"`, node);
      continue;
    }
    const layerId = key as LayerId;
    layers[layerId] = validateNodeOptions(node, layerId, layerOptionsSchemas[layerId]);
  }

  return { layers };
}

function validateNodeOptions(node: StyleNode, path: string, schema?: z.ZodType): StyleNode {
  const result: StyleNode = { ...node };

  if (node.options) {
    if (!schema) {
      console.warn(`Style: dropping options on "${path}" (no options defined)`, node.options);
      delete result.options;
    } else {
      const options: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node.options)) {
        const check = schema.safeParse({ [key]: value });
        if (check.success && key in (check.data as object)) options[key] = (check.data as Record<string, unknown>)[key];
        else console.warn(`Style: dropping invalid option "${path}.${key}"`, value);
      }
      result.options = options;
    }
  }

  if (node.children) {
    const children: Record<string, StyleNode> = {};
    for (const [childId, child] of Object.entries(node.children)) {
      children[childId] = validateNodeOptions(child, `${path}/${childId}`, findChildOptionsSchema(path, childId));
    }
    result.children = children;
  }

  return result;
}

// guarded: this module is also imported by tools/convert-style-presets.mjs under plain node (no window)
if (typeof window !== "undefined") window.parseStyle = parseStyle;
