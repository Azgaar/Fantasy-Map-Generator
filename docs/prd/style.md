# Style store

## Problem

Layer styling lives as attributes on SVG groups: presets are applied as thousands of DOM writes, renderers make decisions by reading attributes back (`+coordinates.attr("data-size")`), persistence rides inside the serialized SVG, and part of the styling has already moved to a JS `style` object (label groups, burg icons, relief) — so the truth is split across two stores and the DOM. The registry's erase-on-hide model makes DOM-held style state fragile: whatever owns styling must not be the thing that gets erased.

## Design

One typed, complete data object is the store and the API. Zod schemas are the single declaration — semantic attribute schemas compose into one strict schema per layer, TypeScript types are inferred from them, and layer keys are the registry's `LayerId`.

```ts
import { styles, applyStyles } from "@/styles/styles";

styles.labels.groups[groupId].attrs.opacity; // number | null, by inference
styles.rivers.attrs.fill = "hotpink"; // typed direct mutation
applyStyles("rivers"); // write attrs to the DOM, redraw the layer
```

- **`attrs` are written to the DOM; `options` never are** — they are renderer inputs (`fontSize`, `scheme`, `rescale`, `size`, `icon`…), read from `styles` directly. `null` on an attr means the attribute is not set.
- **Styles are complete by construction.** `parseStyles(json)` validates per layer and falls back to `Styles.defaults` for any invalid or missing layer, with one warning. No read site ever carries a fallback.
- **Addressing is `data-layer`/`data-group`, never element ids.** The registry stamps its layer groups and declared children; renderers stamp the elements they create; a few static elements carry theirs in the markup. The id quirks (`terrain`/`regions`/`armies`/`icons`, the `labels-` prefix) never enter the style code.
- **Writes are direct mutation + one call.** `applyStyles(id)` writes the layer's attrs and redraws it — matching how the rest of the codebase already works. Serialization is `JSON.stringify(styles)`.
- **Legacy formats are migration's problem.** `parseStyles` accepts the new format only; converting old selector-keyed presets is a separate function used only by migration code.

The whole library is `src/styles/styles.ts` (~250 lines: schemas + `parseStyles`/`setStyles`/`applyStyles`) and `src/styles/defaults.ts` (the default preset, typed).

## Migration

Covered separately in `style-migration.md`: the library lands dormant, the domains that already live in the JS `style` object are absorbed first, then DOM-attribute layers migrate one at a time.
