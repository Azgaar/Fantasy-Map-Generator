import { type LayerId, Layers } from "@/components/layers";
import { DEFAULT_STYLES, type StyleLayerId, type Styles as StylesData, stylesSchema } from "./styles-schema";

// The active styles, a plain global. Read and write directly:
// styles.labels.groups[id].attrs.opacity. Replaces the legacy `style` global when that retires.
// A clone, so edits before the first preset apply can't taint Styles.defaults.
globalThis.styles = structuredClone(DEFAULT_STYLES);

// New format only; legacy selector-keyed presets are converted by migration code, not here.
// An invalid or missing layer falls back to the default with one warning, so the result is
// always complete.
function parse(json: unknown): StylesData {
  const input = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const result = {} as Record<string, unknown>;
  for (const [layer, schema] of Object.entries(stylesSchema.shape)) {
    const parsed = schema.safeParse(input[layer]);
    if (parsed.success) result[layer] = parsed.data;
    else {
      console.warn(`Styles.parse: invalid or missing "${layer}", default used`);
      result[layer] = structuredClone(DEFAULT_STYLES[layer as keyof StylesData]);
    }
  }
  return result as StylesData;
}

function set(data: StylesData): void {
  globalThis.styles = data;
}

// Write the layers' attrs onto the DOM, addressed by data-layer/data-group. Options are never
// written; renderers read them from `styles` directly. Does not redraw.
function write(...ids: StyleLayerId[]): void {
  for (const id of ids) {
    const root = document.querySelector(`[data-layer="${id}"]`);
    if (!root) continue;
    writeNode(root, styles[id]);
  }
}

// write, then redraw the layers
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
