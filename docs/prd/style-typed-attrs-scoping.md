# Typed attrs — what it looks like in practice

Working notes behind the PRD revision. Question from review: type `attrs` fully (no open bag), validate everything with zod, unify invalidation to "any change redraws the layer" via the existing render scheduler. This doc sizes that against the real data.

## The actual attribute surface

Mined from all 12 system presets (93 selectors, every styled node in the app): **59 distinct attribute names**, but the distribution is two clearly different populations.

**Population 1 — SVG paint attributes, broadly shared.** 18 names account for essentially all repeated use (each on 9-82 selectors): `opacity, filter, stroke, stroke-width, stroke-dasharray, stroke-linecap, stroke-linejoin, stroke-opacity, fill, fill-opacity, font-size, font-family, letter-spacing, mask, style (text-shadow), transform, shape-rendering, background-color`.

**Population 2 — the long tail, 41 names, almost all on exactly one selector.** Every one of them is either a renderer input in disguise (`scheme, terracing, skip, relax, curve, set, size, density, rescale, layers, type, scale, dx, dy, box-size, data-size, data-width, data-columns, data-bar-size, data-label, data-top/right/bottom/left, data-circle, data-icon, data-dx, data-dy, data-render, data-filter, auto-filter`) or geometry of a single non-`<g>` element (`x, y, width, height, rx, ry, href, data-href, data-x, data-y` — the vignette rect, the ocean pattern, the texture image).

## Conclusion: typing attrs is one interface, not a treadmill

The open bag was hedging against a large, unknowable attribute vocabulary. The vocabulary is neither large nor unknowable: **one shared `Attrs` interface of ~18 optional fields covers every paint attribute in every preset**, because SVG paint attributes are the same everywhere — that is what makes them paint attributes. Everything else was already `options` in the PRD's model (typed, per-layer/child) or becomes element geometry options.

```ts
interface Attrs {
  opacity?: number;
  fill?: string;
  "fill-opacity"?: number;
  stroke?: string;
  "stroke-width"?: number;
  "stroke-dasharray"?: string;
  "stroke-linecap"?: string;
  "stroke-linejoin"?: string;
  "stroke-opacity"?: number;
  filter?: string;
  mask?: string;
  "font-size"?: number | string;
  "font-family"?: string;
  "letter-spacing"?: number;
  style?: string;            // text-shadow on label groups
  transform?: string;        // compass
  "shape-rendering"?: string;
  "background-color"?: string; // svg root only
}
```

One zod schema mirrors it; every field nullable (`null` = remove-attribute, the reset semantics preset switching needs). Unknown keys are now rejected with a console warning instead of passed through — which is exactly what makes third-party preset JSON validatable, the point of the change.

Per-layer narrowing (routes children never carry `font-family`, etc.) is possible later by intersecting subsets, but is polish, not required: the shared interface is already fully typed and validated, and narrowing adds schema surface for little safety since a stray-but-valid paint attribute is harmless by construction.

## Unified invalidation

`setAttr` and `setOptions` both mutate and schedule a redraw of the affected layer through the existing render scheduler (the one already serving labels/relief), which coalesces to a frame — slider drags render at frame rate, not event rate, on SVG and WebGL alike. `applyTo(layer)` stays, but becomes part of the registry's redraw (applied before `draw(layer)`), not a separate cheap path the caller reasons about.

## Scope delta vs the current PRD

- Add: the `Attrs` interface + schema (~40 lines), reject-unknown-attrs behaviour, geometry options for the 3 non-`<g>` elements. Small.
- Remove: the open-bag semantics and its "never migrated" clause; the two-path invalidation story and the editor's redraw caveat. Net simpler.
- Unchanged: the options model and its enumeration (always the real work), `fromJSON`/`toJSON`/`applyTo`, the tree shape, legacy upgrade.
- New cost accepted: adding a genuinely new paint attribute later means one line in `Attrs` + one in the schema. At ~18 fields stable across 12 presets and years of styles, that is a rare event.
