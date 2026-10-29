import type { z } from "zod";
import type { stylesSchema } from "@/model/styles/styles-schema";
import type { LayerId } from "@/renderers/layers";

/** The controls the form engine ships; a caller registers more under its own names */
export type StandardControl = "checkbox" | "select" | "slider" | "number" | "text" | "color" | "percent" | "px";

/** How a schema field is edited, registered on the zod node */
export type FieldMeta<Control extends string = StandardControl> = {
  control?: Control; // overrides the derived control
  label?: string; // default: the key; the styles schema labels every field it shows
  tip?: string; // the row's data-tip
  step?: number; // sliders; default 1 for int, 0.01 for a range ≤ 2, else 0.1
  range?: [number, number]; // slider bounds for a number the schema leaves unbounded; widened to hold the stored value
  choices?: Record<string, string>; // labels for enum values, keyed by value
  nullAs?: number | string; // what an unset attr shows as (opacity null → 1, filter null → "")
  unsetLabel?: string; // a select's unset option; default "inherit"
  hidden?: true; // stored, never edited
  gate?: string; // on a nested object: the key (or dotted path) that switches the rest of the section on
  group?: string; // a caption over the consecutive fields sharing it; their labels read under it ("Stroke" → "Width")
};

/** The controls the style editor registers over the standard ones (src/controllers/style/controls.ts) */
export type StyleControl =
  | StandardControl
  | "filter"
  | "font"
  | "blur"
  | "dash"
  | "transform"
  | "labelStyle"
  | "scheme"
  | "texture"
  | "icon";

/** What the style editor runs after a value changes; set on a field or on a whole node, the nearest wins.
 * Unset: an attr is written to its element, an option redraws the layer (src/controllers/style/effects.ts) */
export type StyleEffect =
  | "write" // the one attr onto its element, nothing redrawn
  | "draw" // redraw the element's layer; an attr is written first
  | "zoom" // re-run the active zooming, which derives what it writes from the attr; the attr is written first
  | "regenerateRelief"; // place the relief icons anew

export type StyleMeta = FieldMeta<StyleControl> & { effect?: StyleEffect };

/** The `styles` global: one entry per style element, each a tree of attrs, options and groups */
export type StylesData = z.infer<typeof stylesSchema>;

/** A map layer's style, or `map` for the whole-map filter */
export type StyleElement = keyof StylesData;

/** The bags every style node may carry; reserved, so a group name may never be one of them */
export const NODE_KEYS: ReadonlySet<string> = new Set(["attrs", "options", "groups"]);

/** What the Style tab shows: an element, its group when it has a record of them, and the layer it is drawn on */
export type StyleSelection = { element: StyleElement; group?: string; layer?: LayerId };
