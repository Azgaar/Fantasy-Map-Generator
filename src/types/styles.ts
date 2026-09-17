import type { z } from "zod";
import type { LayerId } from "@/components/layers";
import type { stylesSchema } from "@/generators/styles-schema";

/** The controls the form engine ships; a caller registers more under its own names */
export type StandardControl = "checkbox" | "select" | "slider" | "number" | "text" | "color" | "percent" | "px";

/** How a schema field is edited, registered on the zod node */
export type FieldMeta<Control extends string = StandardControl> = {
  control?: Control; // overrides the derived control
  label?: string; // default: key → sentence case ("stroke-width" → "Stroke width")
  tip?: string; // the row's data-tip
  step?: number; // sliders; default 1 for int, 0.01 for a range ≤ 2, else 0.1
  range?: [number, number]; // slider bounds for a number the schema leaves unbounded; widened to hold the stored value
  choices?: Record<string, string>; // labels for enum values, keyed by value
  nullAs?: number | string; // what an unset attr shows as (opacity null → 1, filter null → "")
  hidden?: true; // stored, never edited
  gate?: string; // on a nested object: the key (or dotted path) that switches the rest of the section on
  group?: string; // a caption over the consecutive fields sharing it; their labels read under it ("Stroke" → "Width")
};

// --- the style form (src/generators/styles-schema.ts) -------------------------------------------------

/** The controls the style editor registers over the standard ones (src/controllers/style-editor/controls.ts) */
export type StyleControl =
  | StandardControl
  | "filter"
  | "font"
  | "blur"
  | "transform"
  | "labelStyle"
  | "scheme"
  | "texture"
  | "icon"
  | "emoji";

/** What the style editor runs after a value changes; set on a field or on a whole node, the nearest wins.
 * Unset: an attr is written to its element, an option redraws the layer (src/controllers/style-editor/effects.ts) */
export type StyleEffect =
  | "write" // the one attr onto its element, nothing redrawn
  | "draw" // redraw the element's layer; an attr is written first
  | "zoom" // re-run the active zooming, which derives what it writes from the attr; the attr is written first
  | "applyVignette" // reshape the vignette mask in defs
  | "changeReliefSet" // restyle the placed relief icons
  | "resizeRelief" // scale the placed relief icons by the ratio
  | "regenerateRelief"; // place the relief icons anew

export type StyleMeta = FieldMeta<StyleControl> & { effect?: StyleEffect };

/** The `styles` global: one entry per style element, each a tree of attrs, options and groups */
export type StylesData = z.infer<typeof stylesSchema>;

/** A map layer's style, or `map` for the whole-map filter */
export type StyleElement = keyof StylesData;

// --- the editor (src/controllers/style-editor) --------------------------------------------------------

/** What the Style tab shows: an element, its group when it has a record of them, and the layer it is drawn on */
export type StyleSelection = { element: StyleElement; group?: string; layer?: LayerId };

/** One value set on the store at a path, with what it replaced */
export type StyleChange = { sel: StyleSelection; path: string[]; value: unknown; previous: unknown };

/** A selection addressed by its store path, for comparing with the preset (baseline.ts) */
export type PathSelection = { element: StyleElement; group?: string; path: string[] };
