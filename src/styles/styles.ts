import { z } from "zod";
import { type LayerId, Layers } from "@/components/layers";
import { DEFAULT_STYLES } from "./defaults";

// Semantic attribute schemas. Attrs are written to the DOM; null = attribute not set.
const opacity = z.number().nullable();
const color = z.string().nullable();
const width = z.number().nullable();
const dasharray = z.union([z.string(), z.number()]).nullable();
const linecap = z.string().nullable();
const filter = z.string().nullable();
const mask = z.string().nullable();
const cssLength = z.string(); // "0.3%", "8px"

const strokeAttrs = { stroke: color, "stroke-width": width, "stroke-dasharray": dasharray, "stroke-linecap": linecap };
const fillAttrs = { fill: color, "fill-opacity": opacity };

const attrs = <T extends z.ZodRawShape>(shape: T) => z.object({ attrs: z.object(shape).strict() }).strict();
const node = <A extends z.ZodRawShape, O extends z.ZodRawShape>(a: A, o: O) =>
  z.object({ attrs: z.object(a).strict(), options: z.object(o).strict() }).strict();

// One strict schema per layer. attrs go to the DOM; options are renderer inputs and never do.
const routeGroup = attrs({ opacity, ...strokeAttrs, filter, mask });
const lake = attrs({ opacity, ...fillAttrs, ...strokeAttrs, filter });
const heights = node(
  { opacity, filter, mask },
  {
    scheme: z.string(),
    terracing: z.number(),
    skip: z.number(),
    relax: z.number(),
    curve: z.string(),
    render: z.boolean()
  }
);
const labelGroup = node(
  {
    opacity,
    ...fillAttrs,
    ...strokeAttrs,
    "letter-spacing": width,
    "font-size": cssLength,
    "font-family": z.string(),
    style: z.string().nullable(),
    filter
  },
  { dx: z.number(), dy: z.number() }
);
const burgGroup = node(
  { opacity, ...fillAttrs, ...strokeAttrs, "stroke-linejoin": linecap },
  { size: z.number(), icon: z.string() }
);
const emblemGroup = z.object({ options: z.object({ size: z.number() }).strict() }).strict();

export const stylesSchema = z
  .object({
    map: node({ "background-color": color, filter }, { dataFilter: z.string().nullable() }),
    ocean: z
      .object({
        attrs: z.object({ filter }).strict(),
        // pattern/patternOpacity style #oceanicPattern, a defs resource the renderer owns
        options: z.object({ outline: z.string(), pattern: z.string(), patternOpacity: z.number() }).strict(),
        base: attrs({ fill: color })
      })
      .strict(),
    landmass: attrs({ opacity, fill: color, filter }),
    texture: node({ opacity, filter, mask }, { href: z.string(), x: z.number(), y: z.number() }),
    heightmap: z.object({ landHeights: heights, oceanHeights: heights }).strict(),
    biomes: attrs({ opacity, filter, mask }),
    cells: attrs({ opacity, ...strokeAttrs, filter, mask }),
    grid: node(
      { opacity, ...strokeAttrs, transform: z.string().nullable(), filter, mask },
      { type: z.string(), scale: z.number(), dx: z.number(), dy: z.number() }
    ),
    coordinates: node({ opacity, ...strokeAttrs, filter, mask }, { fontSize: z.number() }),
    compass: z
      .object({
        attrs: z
          .object({ opacity, transform: z.string().nullable(), filter, mask, "shape-rendering": z.string().nullable() })
          .strict(),
        compassRose: attrs({ transform: z.string().nullable() })
      })
      .strict(),
    rivers: attrs({ opacity, fill: color, filter }),
    lakes: z.object({ freshwater: lake, salt: lake, sinkhole: lake, frozen: lake, lava: lake, dry: lake }).strict(),
    coastline: z
      .object({
        sea_island: attrs({ opacity, ...strokeAttrs, filter }),
        lake_island: attrs({ opacity, ...strokeAttrs, filter })
      })
      .strict(),
    relief: node({ opacity, filter, mask }, { set: z.string(), size: z.number() }),
    religions: attrs({ opacity, ...strokeAttrs, filter }),
    cultures: attrs({ opacity, ...strokeAttrs, filter }),
    states: z
      .object({
        statesBody: attrs({ opacity, filter }),
        statesHalo: node({ opacity, "stroke-width": width, filter }, { width: z.number() })
      })
      .strict(),
    provinces: attrs({ opacity, fill: color, "font-size": width, "font-family": z.string(), filter }),
    zones: attrs({ opacity, ...strokeAttrs, filter, mask }),
    borders: z
      .object({
        stateBorders: attrs({ opacity, ...strokeAttrs, filter }),
        provinceBorders: attrs({ opacity, ...strokeAttrs, filter })
      })
      .strict(),
    routes: z.object({ roads: routeGroup, trails: routeGroup, searoutes: routeGroup }).strict(),
    temperature: attrs({ opacity, ...fillAttrs, ...strokeAttrs, "font-size": cssLength, filter }),
    ice: attrs({ opacity, fill: color, ...strokeAttrs, filter }),
    precipitation: attrs({ opacity, fill: color, ...strokeAttrs, filter }),
    population: z
      .object({
        attrs: z
          .object({ opacity, "stroke-width": width, "stroke-dasharray": dasharray, "stroke-linecap": linecap, filter })
          .strict(),
        rural: attrs({ stroke: color }),
        urban: attrs({ stroke: color })
      })
      .strict(),
    emblems: z
      .object({
        attrs: z.object({ opacity, "stroke-width": width, filter }).strict(),
        stateEmblems: emblemGroup,
        provinceEmblems: emblemGroup,
        burgEmblems: emblemGroup
      })
      .strict(),
    labels: z
      .object({
        attrs: z.object({ "font-size": width }).strict(),
        groups: z.record(z.string(), labelGroup)
      })
      .strict(),
    burgIcons: z
      .object({
        burgIcons: z.object({ groups: z.record(z.string(), burgGroup) }).strict(),
        anchors: z.object({ groups: z.record(z.string(), burgGroup) }).strict()
      })
      .strict(),
    goods: z
      .object({
        goodsCells: attrs({ opacity, filter }),
        goodsIcons: node({ opacity, "stroke-width": width, filter }, { size: z.number(), circle: z.boolean() }),
        goodsBurgs: node({ opacity, stroke: color, "stroke-width": width }, { size: z.number() })
      })
      .strict(),
    markets: node(
      { opacity, ...fillAttrs, "stroke-width": width, "stroke-opacity": opacity, filter },
      { size: z.number(), fontSize: z.number(), icon: z.string() }
    ),
    trade: attrs({ opacity, filter }),
    markers: node({ opacity, filter }, { rescale: z.number() }),
    military: node({ ...strokeAttrs, "fill-opacity": opacity, filter }, { fontSize: z.number(), boxSize: z.number() }),
    rulers: node(
      { opacity, "stroke-width": width, "stroke-dasharray": dasharray, "stroke-linecap": linecap, filter },
      { fontSize: z.number() }
    ),
    scaleBar: z
      .object({
        attrs: z.object({ opacity, fill: color, "font-size": width }).strict(),
        options: z.object({ barSize: z.number(), x: z.number(), y: z.number(), label: z.string() }).strict(),
        back: node(
          { opacity, ...fillAttrs, stroke: color, "stroke-width": width, filter },
          { top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }
        )
      })
      .strict(),
    legend: z
      .object({
        attrs: z.object({ ...strokeAttrs, "font-family": z.string() }).strict(),
        options: z.object({ fontSize: z.number(), x: z.number(), y: z.number(), columns: z.number() }).strict(),
        box: attrs({ ...fillAttrs })
      })
      .strict(),
    fogging: attrs({ opacity, fill: color, mask }),
    // the geometry options shape #vignette-rect, the mask rect in defs the renderer owns
    vignette: node(
      { opacity, fill: color, mask },
      { x: cssLength, y: cssLength, width: cssLength, height: cssLength, rx: cssLength, ry: cssLength, filter }
    )
  })
  .strict();

export type Styles = z.infer<typeof stylesSchema>;
// every styled layer is a registry layer; "map" (the svg root) is the one deliberate extra
export type StyleLayerId = keyof Styles & (LayerId | "map");

// The active styles. Read and write directly: styles.labels.groups[id].attrs.opacity.
// Replaces the legacy `style` global when that retires.
export let styles: Styles = DEFAULT_STYLES;

export function setStyles(data: Styles): void {
  styles = data;
}

// New format only; legacy selector-keyed presets are converted by migration code, not here.
// Per layer: an invalid or missing entry falls back to the default with one warning, so the
// result is always complete and nothing downstream checks for absence.
export function parseStyles(json: unknown): Styles {
  const input = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const result = {} as Record<string, unknown>;
  for (const [layer, schema] of Object.entries(stylesSchema.shape)) {
    const parsed = schema.safeParse(input[layer]);
    if (parsed.success) result[layer] = parsed.data;
    else {
      console.warn(`parseStyles: invalid or missing "${layer}", default used`);
      result[layer] = structuredClone(DEFAULT_STYLES[layer as keyof Styles]);
    }
  }
  return result as Styles;
}

// Write the layers' attrs onto the DOM and redraw them. Addressing is data-layer/data-group,
// stamped by the registry — no element ids, no nesting knowledge. Options are never written;
// renderers read them from `styles` directly. Mutate `styles`, then call this.
export function applyStyles(...ids: StyleLayerId[]): void {
  for (const id of ids) {
    const root = document.querySelector(`[data-layer="${id}"]`);
    if (!root) continue;
    writeNode(root, styles[id]);
  }
  Layers.draw(...ids.filter((id): id is StyleLayerId & LayerId => id !== "map"));
}

function writeNode(el: Element, node: object): void {
  for (const [key, value] of Object.entries(node)) {
    if (key === "options") continue;
    if (key === "attrs") {
      for (const [name, v] of Object.entries(value as object)) {
        if (v === null || v === undefined) el.removeAttribute(name);
        else el.setAttribute(name, String(v));
      }
    } else {
      // a named subgroup (roads, statesHalo, ...) or a groups record of them
      const entries = key === "groups" ? Object.entries(value as object) : [[key, value] as const];
      for (const [group, groupNode] of entries) {
        const child = el.querySelector(`[data-group="${CSS.escape(group)}"]`);
        if (child) writeNode(child, groupNode as object);
      }
    }
  }
}

// serialization is JSON.stringify(styles) — there is nothing else to it
