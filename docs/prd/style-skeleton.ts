// Style store, round 3 — the whole library in one sketch.
// The typed data IS the API: `styles.labels.groups[id].attrs.opacity` is a number|null by
// inference. Zod schemas are the single declaration; a style is complete by construction
// (parseStyle merges over DEFAULT_STYLE); three plain functions do the rest. No class.

import { z } from "zod";

// semantic attribute schemas, shared vocabulary — null = remove / not set
const opacitySchema = z.number().nullable();
const fillSchema = z.string();
const strokeSchema = z.string();
const strokeWidthSchema = z.number();
const dasharraySchema = z.string().nullable();
const filterSchema = z.string().nullable();
const maskSchema = z.string().nullable();
const fontSizePxSchema = z.number();
const fontSizePercentageSchema = z.string(); // "6%"

// one strict schema per layer — attrs are written to the DOM, options are renderer inputs
const routeGroupSchema = z.object({
  attrs: z.object({ opacity: opacitySchema, stroke: strokeSchema, "stroke-width": strokeWidthSchema, "stroke-dasharray": dasharraySchema, filter: filterSchema }).strict(),
}).strict();

const labelGroupSchema = z.object({
  attrs: z.object({ opacity: opacitySchema, fill: fillSchema, stroke: strokeSchema, "stroke-width": strokeWidthSchema, "letter-spacing": z.number(), "font-size": fontSizePercentageSchema, "font-family": z.string(), style: z.string().nullable(), filter: filterSchema }).strict(),
  options: z.object({ dx: z.number(), dy: z.number() }).strict(),
}).strict();

const burgGroupSchema = z.object({
  attrs: z.object({ opacity: opacitySchema, fill: fillSchema, "fill-opacity": z.number(), stroke: strokeSchema, "stroke-width": strokeWidthSchema }).strict(),
  options: z.object({ size: z.number(), icon: z.string() }).strict(),
}).strict();

const heightsGroupSchema = z.object({
  attrs: z.object({ opacity: opacitySchema, filter: filterSchema, mask: maskSchema }).strict(),
  options: z.object({ scheme: z.string(), terracing: z.number(), skip: z.number(), relax: z.number(), curve: z.string(), render: z.boolean() }).strict(),
}).strict();

const stylesSchema = z.object({
  routes: z.object({
    attrs: z.object({ opacity: opacitySchema, mask: maskSchema }).strict(),
    roads: routeGroupSchema, trails: routeGroupSchema, searoutes: routeGroupSchema,
  }).strict(),
  rivers: z.object({ attrs: z.object({ opacity: opacitySchema, fill: fillSchema, filter: filterSchema }).strict() }).strict(),
  coordinates: z.object({
    attrs: z.object({ opacity: opacitySchema, stroke: strokeSchema, "stroke-width": strokeWidthSchema, "stroke-dasharray": dasharraySchema, filter: filterSchema }).strict(),
    options: z.object({ fontSize: fontSizePxSchema }).strict(),
  }).strict(),
  heightmap: z.object({ landHeights: heightsGroupSchema, oceanHeights: heightsGroupSchema }).strict(),
  labels: z.object({
    attrs: z.object({ "font-size": fontSizePxSchema }).strict(),
    groups: z.record(z.string(), labelGroupSchema),
  }).strict(),
  burgIcons: z.object({ groups: z.record(z.string(), burgGroupSchema) }).strict(),
  anchors: z.object({ groups: z.record(z.string(), burgGroupSchema) }).strict(),
  // ...every remaining layer, ~35 entries. All required: styles are complete by construction.
}).strict();

import type { LayerId } from "@/components/layers";

export type Styles = z.infer<typeof stylesSchema>;
export type StyleLayerId = keyof Styles & LayerId; // registry owns layer identity; a schema key
type _styledLayersAreRegistryLayers = keyof Styles extends LayerId ? true : never; // outside it is a compile error

// the complete default — the single place defaults exist in the whole app
const DEFAULT_STYLES: Styles = /* the default preset, satisfies stylesSchema */;

// the active styles — read and write directly: styles.labels.groups[id].attrs.opacity
export let styles: Styles;

// New format only (legacy conversion lives in legacy.ts, used only by migration code).
// Per layer: safeParse; an invalid or missing layer falls back to the default with one warn.
// Result always satisfies stylesSchema, so nothing downstream ever checks for absence.
export function parseStyles(json: unknown): Styles { /* ~20 lines */ }

export function setStyles(data: Styles): void { styles = data; }

// Write a layer's attrs onto the DOM and redraw it. No ids, no nesting knowledge: the registry
// stamps data-layer on layer groups and data-group on subgroups, so addressing is
// [data-layer="routes"] and, inside it, [data-group="roads"]. Options are never written —
// renderers read them from `styles` directly. Callers mutate, then call this.
export function applyStyles(...ids: StyleLayerId[]): void { /* ~25 lines, ends with Layers.draw(...ids) */ }

// serialization is JSON.stringify(styles) — there is nothing else to it
