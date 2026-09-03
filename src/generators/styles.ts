import { type LayerId, Layers } from "@/components/layers";
import { parseSections, type TemplateLookup } from "@/utils/schemaUtils";
import defaultStyles from "./default-styles.json";
import { type StyleLayerId, type Styles as StylesData, stylesSchema } from "./styles-schema";

const DEFAULT_STYLES: DeepReadonly<StylesData> = stylesSchema.parse(defaultStyles);
globalThis.styles = structuredClone(DEFAULT_STYLES);

function parse(json: unknown): StylesData {
  return parseSections<StylesData>(stylesSchema, DEFAULT_STYLES, json, "Styles.parse", sourceValueFor);
}

// custom group names don't exist in the defaults, so any stock group of the same record stands in as template
const sourceValueFor: TemplateLookup = (source, key, parentKey) => {
  const value = source?.[key];
  if (value !== undefined || parentKey !== "groups") return value;
  return Object.values(source)[0];
};

function set(data: StylesData): void {
  globalThis.styles = data;
}

// attrs go onto the DOM by data-layer/data-group; options never do (renderers read the store)
function write(...ids: StyleLayerId[]): void {
  for (const id of ids) {
    const root = document.querySelector(`[data-layer="${id}"]`);
    if (!root) continue;
    writeNode(root, styles[id]);
  }
}

function apply(...ids: StyleLayerId[]): void {
  write(...ids);
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

type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export const Styles = { defaults: DEFAULT_STYLES, parse, set, write, apply };

type StylesApi = typeof Styles;

declare global {
  /** the live style record, read bare across every layer and replaced wholesale on load */
  var styles: import("./styles-schema").Styles;
  // biome-ignore lint/suspicious/noRedeclare: the bridge registered just below
  var Styles: StylesApi;
}

globalThis.Styles = Styles;
