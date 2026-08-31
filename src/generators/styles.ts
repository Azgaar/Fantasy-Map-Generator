import type { z } from "zod";
import { type LayerId, Layers } from "@/components/layers";
import { DEFAULT_STYLES, type StyleLayerId, type Styles as StylesData, stylesSchema } from "./styles-schema";

// the active styles global; a clone, so pre-preset edits can't taint Styles.defaults
globalThis.styles = structuredClone(DEFAULT_STYLES);

// new format only (legacy presets are converted by migration code first); an invalid or
// missing layer falls back to the default with one warning, so the result is always complete
function parse(json: unknown): StylesData {
  const input = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const result = {} as Record<string, unknown>;
  for (const [layer, schema] of Object.entries(stylesSchema.shape)) {
    const parsed = schema.safeParse(input[layer]);
    if (parsed.success) {
      result[layer] = parsed.data;
      continue;
    }

    const fallback = structuredClone(DEFAULT_STYLES[layer as keyof StylesData]);
    const repaired = replaceInvalidValues(input[layer], fallback, parsed.error);
    const reparsed = repaired === undefined ? undefined : schema.safeParse(repaired);

    if (reparsed?.success) {
      console.warn(`Styles.parse: invalid "${layer}" values replaced with defaults`);
      result[layer] = reparsed.data;
    } else {
      console.warn(`Styles.parse: invalid or missing "${layer}", default used`);
      result[layer] = fallback;
    }
  }
  return result as StylesData;
}

// replaces the failing values alone, so one bad attribute does not cost the layer around it;
// undefined when that cannot be done, leaving the caller its whole-layer fallback
function replaceInvalidValues(input: unknown, fallback: unknown, error: z.ZodError): unknown {
  if (typeof input !== "object" || input === null) return undefined;

  const repaired = structuredClone(input) as Record<PropertyKey, any>;
  for (const { path } of error.issues) {
    if (!path.length) return undefined;

    let target: any = repaired;
    let source: any = fallback;
    for (const key of path.slice(0, -1)) {
      target = target?.[key];
      source = source?.[key];
    }

    const key = path[path.length - 1];
    if (target === undefined || target === null || source === undefined || source === null) return undefined;
    if (!(key in source)) return undefined;
    target[key] = structuredClone(source[key]);
  }
  return repaired;
}

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

export const Styles = { defaults: DEFAULT_STYLES, parse, set, write, apply };
globalThis.Styles = Styles;
