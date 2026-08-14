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

// typed per-layer options; keys absent here mean the layer has no options
export const layerOptionsSchemas: Partial<Record<LayerId, z.ZodType>> = {
  armies: z.object({ fontSize: z.number(), boxSize: z.number() }).partial(),
  compass: z.object({ use: z.object({ x: z.number(), y: z.number(), scale: z.number() }).partial() }).partial(),
  coordinates: z.object({ fontSize: z.number() }).partial(),
  gridOverlay: z.object({ type: z.string(), scale: z.number(), dx: z.number(), dy: z.number() }).partial(),
  legend: z.object({ fontSize: z.number(), x: z.number(), y: z.number(), columns: z.number() }).partial(),
  markers: z.object({ rescale: z.number() }).partial(),
  markets: z.object({ size: z.number(), fontSize: z.number(), icon: z.string() }).partial(),
  oceanLayers: z
    .object({
      layers: z.string(),
      baseFill: z.string(),
      pattern: z.object({ href: z.string(), opacity: z.number() }).partial()
    })
    .partial(),
  ruler: z.object({ fontSize: z.number() }).partial(),
  scaleBar: z
    .object({
      fontSize: z.number(),
      barSize: z.number(),
      x: z.number(),
      y: z.number(),
      label: z.string(),
      back: z
        .object({
          opacity: z.number(),
          fill: z.string(),
          stroke: z.string(),
          strokeWidth: z.number(),
          filter: z.string().nullable(),
          top: z.number(),
          right: z.number(),
          bottom: z.number(),
          left: z.number()
        })
        .partial()
    })
    .partial(),
  temperature: z.object({ fontSize: z.number() }).partial(),
  terrain: z.object({ set: z.enum(["simple", "colored", "gray"]), size: z.number() }).partial(),
  texture: z.object({ href: z.string(), x: z.number(), y: z.number() }).partial(),
  vignette: z
    .object({
      rect: z
        .object({
          x: z.string(),
          y: z.string(),
          width: z.string(),
          height: z.string(),
          rx: z.string(),
          ry: z.string(),
          filter: z.string().nullable()
        })
        .partial()
    })
    .partial()
};

function heightsOptions() {
  return z
    .object({ scheme: z.string(), terracing: z.number(), skip: z.number(), relax: z.number(), curve: z.string() })
    .partial();
}

// options living on a CHILD node (validated when parsing that child)
export const childOptionsSchemas: Record<string, z.ZodType> = {
  "emblems/stateEmblems": z.object({ size: z.number() }).partial(),
  "emblems/provinceEmblems": z.object({ size: z.number() }).partial(),
  "emblems/burgEmblems": z.object({ size: z.number() }).partial(),
  "goods/goodsIcons": z.object({ size: z.number(), circle: z.number() }).partial(),
  "goods/goodsBurgs": z.object({ size: z.number() }).partial(),
  "regions/statesHalo": z.object({ width: z.number() }).partial(),
  "terrs/landHeights": heightsOptions(),
  "terrs/oceanHeights": heightsOptions()
};

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
      children[childId] = validateNodeOptions(child, `${path}/${childId}`, childOptionsSchemas[`${path}/${childId}`]);
    }
    result.children = children;
  }

  return result;
}
