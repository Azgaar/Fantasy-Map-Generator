import { type LayerId, Layers } from "@/components/layers";
import type { StyleElement, StylesData } from "@/types/styles";
import { parseSections, type TemplateLookup } from "@/utils/schemaUtils";
import defaultStyles from "./default-styles.json";
import { stylesSchema } from "./styles-schema";

const DEFAULT_STYLES: DeepReadonly<StylesData> = stylesSchema.parse(defaultStyles);
globalThis.styles = structuredClone(DEFAULT_STYLES);

function parse(json: unknown): StylesData {
  return parseSections<StylesData>(stylesSchema, DEFAULT_STYLES, json, "Styles.parse", sourceValueFor);
}

// custom group names don't exist in the defaults, so any stock group of the same record stands in as template
const sourceValueFor: TemplateLookup = (source, key, parentKey) => {
  if (typeof source !== "object" || source === null) return undefined;
  const record = source as Record<PropertyKey, unknown>;
  const value = record[key];
  if (value !== undefined || parentKey !== "groups") return value;
  return Object.values(record)[0];
};

function set(data: StylesData): void {
  globalThis.styles = data;
}

// attrs go onto the DOM by data-layer/data-group; options never do (renderers read the store)
function write(...ids: StyleElement[]): void {
  for (const id of ids) {
    const root = document.querySelector(`[data-layer="${id}"]`);
    if (!root) continue;
    writeNode(root, styles[id]);
  }
}

function apply(...ids: StyleElement[]): void {
  write(...ids);
  Layers.draw(...ids.filter((id): id is StyleElement & LayerId => id !== "map"));
}

/** Set or remove the one attribute at a store path (`[layer, ..., "attrs", name]`) on its element */
function writeAttr(path: string[]): void {
  const [id, ...rest] = path;
  const name = rest.at(-1);
  let el: Element | null = document.querySelector(`[data-layer="${id}"]`);
  let node: unknown = styles[id as StyleElement];
  for (const key of rest.slice(0, -1)) {
    node = node == null ? undefined : (node as Record<string, unknown>)[key];
    if (key === "attrs") break;
    if (key === "groups") continue; // the record itself has no element: its entries do
    el = el?.querySelector(`[data-group="${CSS.escape(key)}"]`) ?? null;
  }
  if (!el || !name) return;
  const value = node == null ? undefined : (node as Record<string, unknown>)[name];
  if (value === null || value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, String(value));
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

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export const Styles = { defaults: DEFAULT_STYLES, parse, set, write, writeAttr, apply };

type StylesApi = typeof Styles;

declare global {
  /** the live style record, read bare across every layer and replaced wholesale on load */
  var styles: StylesData;
  // biome-ignore lint/suspicious/noRedeclare: the bridge registered just below
  var Styles: StylesApi;
}

globalThis.Styles = Styles;
