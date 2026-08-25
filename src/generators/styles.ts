import { type LayerId, Layers } from "@/components/layers";
import { DEFAULT_STYLES } from "./styles-defaults";
import { type StyleLayerId, type Styles, stylesSchema } from "./styles-schema";

// The active styles. Read and write directly: styles.labels.groups[id].attrs.opacity.
// Replaces the legacy `style` global when that retires.
export let styles: Styles = DEFAULT_STYLES;
// src imports the live binding; classic public/ scripts read the global
globalThis.styles = styles;
globalThis.stylesStore = { parseStyles, setStyles, writeStyles, applyStyles };

export function setStyles(data: Styles): void {
  styles = data;
  globalThis.styles = styles;
}

// New format only; legacy selector-keyed presets are converted by migration code, not here.
// An invalid or missing layer falls back to the default with one warning, so the result is
// always complete.
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

// Write the layers' attrs onto the DOM, addressed by data-layer/data-group. Options are never
// written; renderers read them from `styles` directly. Does not redraw.
export function writeStyles(...ids: StyleLayerId[]): void {
  for (const id of ids) {
    const root = document.querySelector(`[data-layer="${id}"]`);
    if (!root) continue;
    writeNode(root, styles[id]);
  }
}

// writeStyles, then redraw the layers
export function applyStyles(...ids: StyleLayerId[]): void {
  writeStyles(...ids);
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
