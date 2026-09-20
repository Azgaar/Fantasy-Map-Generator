// The style store: the record every layer reads, and the SVG projection written from it
import { type LayerId, Layers } from "@/components/layers";
import { NODE_KEYS, type StyleElement, type StylesData } from "@/types/styles";
import { parseSections, type TemplateLookup } from "@/utils/schemaUtils";
import defaultStyles from "./default-styles.json";
import { stylesSchema } from "./styles-schema";

class StylesStore {
  /** the parsed default preset (src/generators/default-styles.json) */
  private static readonly defaults: DeepReadonly<StylesData> = stylesSchema.parse(defaultStyles);
  /** the live record; `styles` holds this same object */
  private data: StylesData;

  constructor() {
    this.data = structuredClone(StylesStore.defaults);
    globalThis.styles = this.data;
  }

  /** The parsed default preset, the repair source of every parse */
  get defaults(): DeepReadonly<StylesData> {
    return StylesStore.defaults;
  }

  /** Adopt an unknown record: per-section validation, repair from the defaults, one warning per section */
  parse(json: unknown): StylesData {
    return parseSections<StylesData>(
      stylesSchema,
      StylesStore.defaults,
      json,
      "Styles.parse",
      StylesStore.sourceValueFor
    );
  }

  /** Replace the record wholesale; the preset-apply and load path */
  set(data: StylesData): void {
    this.data = data;
    globalThis.styles = data;
  }

  /** Put the attrs of the named style elements onto their DOM elements */
  write(...ids: StyleElement[]): void {
    for (const id of ids) {
      const root = document.querySelector(`[data-layer="${id}"]`);
      if (!root) continue;
      this.writeNode(root, this.data[id]);
    }
  }

  /** Write every element, the preset-apply and load path */
  writeAll(): void {
    this.write(...(Object.keys(this.data) as StyleElement[]));
  }

  /** Write, then redraw the named layers */
  apply(...ids: StyleElement[]): void {
    this.write(...ids);
    Layers.draw(...ids.filter((id): id is StyleElement & LayerId => id !== "map"));
  }

  /** Set or remove the one attribute at a store path (`[layer, ..., "attrs", name]`) on its element */
  writeAttr(path: string[]): void {
    const [id, ...rest] = path;
    const name = rest.at(-1);
    const keys = rest.slice(0, -1); // the attrs bag with the groups above it
    let element = document.querySelector(`[data-layer="${id}"]`);
    let node: unknown = this.data[id as StyleElement];

    for (const [index, key] of keys.entries()) {
      node = node == null ? undefined : (node as Record<string, unknown>)[key];
      // the attrs bag and the structural `groups` key address no element of their own; a group name does
      if (index === keys.length - 1 || key === "groups") continue;
      element = this.groupElement(element, key);
    }

    if (!element || !name) return;
    const value = node == null ? undefined : (node as Record<string, unknown>)[name];
    if (value === null || value === undefined) element.removeAttribute(name);
    else element.setAttribute(name, String(value));
  }

  /** Write a node's attrs onto an element, and recurse into its groups */
  private writeNode(el: Element, node: object): void {
    for (const [key, value] of Object.entries(node)) {
      if (key === "options") continue;
      if (key === "attrs") {
        for (const [name, v] of Object.entries(value as object)) {
          if (v === null || v === undefined) el.removeAttribute(name);
          else el.setAttribute(name, String(v));
        }
        continue;
      }
      if (key !== "groups") continue; // the tree holds nothing else
      for (const [group, groupNode] of Object.entries(value as object)) {
        if (NODE_KEYS.has(group)) continue; // reserved, never a group name
        const child = this.groupElement(el, group);
        if (child) this.writeNode(child, groupNode as object);
      }
    }
  }

  /** The element a `groups` entry addresses */
  private groupElement(parent: Element | null, name: string): Element | null {
    const child = parent?.querySelector(`:scope > [data-group="${CSS.escape(name)}"]`);
    return child ?? parent?.querySelector(`[data-group="${CSS.escape(name)}"]`) ?? null;
  }

  /** custom group names don't exist in the defaults, so any stock group of the same record stands in */
  private static readonly sourceValueFor: TemplateLookup = (source, key, parentKey) => {
    if (typeof source !== "object" || source === null) return undefined;
    const record = source as Record<PropertyKey, unknown>;
    const value = record[key];
    if (value !== undefined || parentKey !== "groups") return value;
    return Object.values(record)[0];
  };
}

export const Styles = new StylesStore();

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

declare global {
  /** the live style record, read bare across every layer and replaced wholesale on load */
  var styles: StylesData;
}
