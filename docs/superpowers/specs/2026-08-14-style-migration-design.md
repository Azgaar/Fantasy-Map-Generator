# Style Migration — DOM attributes to `style.layers`

**Date:** 2026-08-14
**Target:** upstream (Azgaar/Fantasy-Map-Generator), one complete branch/PR off `upstream/master`
**Status:** design approved (barrulus + Azgaar via Discord, 2026-08-14)
**Baseline:** upstream/master @ 280bc979 (v1.142.1)

## Problem

Layer styles live as attributes on SVG `<g>` elements. They persist only because the
whole SVG is serialized into the .map file (`data[5]`), and ~20 renderer code paths
read styling attributes off DOM groups to make rendering decisions. This blocks two
goals:

1. **Layer registry** (Azgaar, in progress): a disabled layer should not render its
   parent `<g>` at all. A group that doesn't exist can't carry its own style, so style
   must live off-DOM.
2. **Container format** (.fmgz future): style should be a standalone, selectively
   readable, validated entry — not attributes buried in a serialized SVG blob.

Partial migrations already exist and are inconsistent: `style.labels.groups`
(editor still reads DOM), `style.burgIcons`/`style.anchors` (harvest-from-DOM
round-trip in `draw-burg-icons.ts`), `style.relief` (clean — the template).

## Decisions already made (Discord, 2026-08-14)

- Consumer-split model approved by Azgaar ("good idea").
- Grouping key is `children`, not `groups` — a layer is also a group; the shape is
  recursive with no extra generic types.
- Style presets are applied "automatically to style.layers" — presets are serialized
  Style objects, no selector map.
- Zod runtime validation at the preset boundary (users upload outdated presets).
  `zod` becomes a new runtime dependency — sanctioned by Azgaar, flag in the PR.
- `relief.density` moves OUT of style into global options. Rule: **a style change
  must never cause data regeneration.** Everything in style is repaint/redraw cost.
- Delivery: one complete branch (all ~40 styleable elements), regular merges from
  master while the layer registry lands in parallel.

## 1. Data model

```ts
// src/types/style.ts
interface StyleNode {
  presentation?: Record<string, string | number>; // raw SVG attribute names, open bag
  options?: LayerOptions;                          // typed per layer, renderer-read
  children?: Record<string, StyleNode>;            // recursive; mirrors <g> containment
}

interface Style {
  layers: Record<LayerId, StyleNode>;
}
```

Split by **who consumes it**:

- `presentation` — the browser paints these. Keys are raw SVG attribute names
  (`opacity`, `filter`, `stroke`, `stroke-width`, `mask`, …). Open bag, applied
  generically, **never renamed, never migrated**. Unknown keys just apply.
- `options` — renderer logic reads these. Small typed interface per layer; a
  discriminated-by-layer union. This is where the DOM-read hacks go:

  | Layer | Options (replacing) |
  |---|---|
  | `terrs` | `landScheme`, `oceanScheme`, `terracing`, `skip`, `relax`, `curve` (attrs on `#landHeights`/`#oceanHeights`) |
  | `emblems` | `stateSize`, `provinceSize`, `burgSize` (`data-size` on the three sub-groups) |
  | `goods` | icon/burg sizes (`data-size` on `#goodsIcons`/`#goodsBurgs`) |
  | `markets` | `size`, `fontSize` (`data-size`/`font-size`) |
  | `markers` | `rescale` |
  | `oceanLayers` | `layers` (outline count string) |
  | `statesHalo` | `width` (`data-width`, read by `invokeActiveZooming`) |
  | `relief` | `set`, `size` (density leaves style — see below) |
  | `texture` | `href`, `x`, `y` (replaces the legacy `data-*`-on-group mirrored onto the `<image>` content element; the renderer builds the `<image>` from options) |
  | `gridOverlay` | `type`, `scale`, `dx`, `dy` |
  | `coordinates` | `size` (`data-size`) |
  | `ruler` | `size` (`data-size`) |
  | `legend` | `fontSize` (`font-size` read by `draw-legend.ts`) |
  | `rivers` | `basin` (`data-basin`, rivers-overview state flag) |
  | `labels` groups | existing `LabelGroupStyle` semantics fold into node options + presentation |

  (Authoritative inventory to be finalized during implementation from the
  exploration table; the list above covers all reads found at baseline.)
- `children` — recursive sub-nodes keyed by child `<g>` id. Only styled `<g>`
  sub-layers qualify; non-`<g>` content elements (texture's `<image>`, river
  `<path>`s, compass `<use>`) are renderer output, driven by `options` where
  configurable. Fixed children are typed
  literal keys (`routes: roads|trails|searoutes`, `borders: state|province`,
  `terrs: landHeights|oceanHeights`, `emblems: stateEmblems|provinceEmblems|burgEmblems`,
  `lakes: freshwater|salt|sinkhole|frozen|lava|dry`, `coastline: sea_island|lake_island`,
  `population: rural|urban`, `oceanLayers: oceanBase|oceanicPattern`). Dynamic children
  (burg groups under `labels`/`burgIcons`/`anchors`) are `Record<string, StyleNode>`
  with the existing fallback: a group missing from a preset inherits the default
  group of its type.

Example:

```ts
style.layers.routes = {
  presentation: {opacity: 0.9, mask: "url(#land)"},
  children: {
    roads:     {presentation: {stroke: "#d06d5b", "stroke-width": 0.7, "stroke-dasharray": "1 0.5"}},
    trails:    {presentation: {stroke: "#d06d5b", "stroke-width": 0.25}},
    searoutes: {presentation: {stroke: "#ffffff", "stroke-width": 0.45}}
  }
}
```

Keying is strictly **by layer** (matching `<g>` containment), not by domain: `capital`
appears under `labels`, `burgIcons`, and `anchors`. The applier and the layer registry
operate per-`<g>`; a domain view ("style burg group X everywhere") is an editor-UI
concern that reads across the three entries.

**Re-homing existing state:** `style.labels.groups` → `style.layers.labels.children`,
`style.burgIcons[g]`/`style.anchors[g]` → children of their layers, `style.relief` →
`style.layers.relief.options` minus `density`. `relief.density` moves to the global
`options` object (generation parameter; changing it regenerates `pack.relief`).

**LayerId** enumerates the styleable roots — the union of the style editor's 40
elements and the preset selector map: `armies, anchors, biomes, borders, burgIcons,
cells, coastline, compass, coordinates, cults, emblems, fogging, goods, goodsCells,
goodsIcons, goodsBurgs, gridOverlay, ice, labels, lakes, landmass, legend, markers,
markets, ocean/oceanLayers, population, prec, provs, regions (statesBody/statesHalo),
relief (terrain), relig, rivers, routes, ruler, scaleBar, temperature, terrs, texture,
tradeAnimation, vignette, zones, map (svg-level filter)`. Exact ids fixed during
implementation to match `getLayer()`/`styleElements` naming.

## 2. Applier — the registry seam

```ts
// one generic function, no per-layer code
applyStyle(g: SVGGElement, node: StyleNode): void
// sets node.presentation attrs on g; recurses into children by child <g> id,
// creating missing child <g> elements
```

Called from exactly three places:

1. **Layer materialization** — today the existing draw/toggle paths in `layers.js`
   and the two `ViewportLayers` renderers (labels, relief); later, Azgaar's layer
   registry calls it when it creates a layer's `<g>`. This is the whole integration
   contract between the two workstreams.
2. **Preset apply** — walk `style.layers`, apply each present node to its `<g>`
   (skipping non-materialized layers; they pick style up when they materialize).
3. **Editor writes** — after mutating the object, re-apply the affected node.

`options` are **never written to the DOM**. Renderers import them from the style
store. Deleted as a consequence:

- the harvest-from-DOM round-trip in `draw-burg-icons.ts:79–110`,
- every decision-read in the baseline inventory (`draw-emblems.ts`, `draw-goods.ts`,
  `draw-heightmap.ts`, `draw-legend.ts`, `draw-markers.ts`, `draw-markets.ts`,
  `draw-measurers.ts`, `emblems/renderer.ts`, `ocean-layers.ts`, `overlays/fogging.ts`,
  `layers.js` grid/coordinates/texture reads, `export.ts` scheme read,
  `zoom.ts` statesHalo read, `rivers-overview.ts` data-basin),
- `invokeActiveZooming`'s attribute reads (statesHalo `data-width`, markers
  `rescale`, emblem group font-size scan) — replaced with `style.layers` reads.

## 3. Presets

- **New format:** a preset is a serialized `Style` (full or partial subset of
  `layers`). Applying = validate → merge over defaults → walk and apply. The
  91-selector map and `collectStyleData`'s 170-line attribute table collapse to
  `JSON.stringify` of the live style (minus transient state).
- **Validation:** a Zod schema (`src/schemas/style.ts` or similar) is the single
  source of truth for the Style shape; `Style` TS type derives via `z.infer`.
  Every preset read — system fetch, localStorage, user upload — parses through it.
- **Legacy upgrade:** detector = top-level keys starting with `#`. Old selector-keyed
  presets (user `fmgStyle_*` localStorage entries, user-uploaded .json files) run
  through a selector→StyleNode upgrader, then validation. Upgrader is kept
  permanently (cheap, ~1 mapping table — the last selector map in the codebase,
  quarantined in one file).
- **System presets:** the 12 files in `public/styles/*.json` are regenerated by a
  one-off conversion script (same upgrader), committed as a reviewable diff.

## 4. Persistence and old-map migration

- `data[48]` (`styleData`) becomes the authoritative style for **all** layers.
  On load: Zod-validate + defaults-merge (today it's a blunt
  `style = JSON.parse(data[48])` full replacement — that changes).
- The SVG in `data[5]` still carries attributes in old files. Load order: inject
  SVG → parse `data[48]` → `resolveVersionConflicts` (harvest, below) → apply
  `style.layers` over the DOM. The object wins.
- **Auto-update** (one `isOlderThan(<release version at merge>)` block, relief/labels template):
  walk the restored DOM per layer, harvest known styling attributes into
  `style.layers` nodes, `removeAttribute` them. Also: legacy `style.labels.groups`
  / `burgIcons` / `anchors` / `relief` object shapes re-homed; `relief.density`
  moved to global options.
- New saves no longer depend on SVG-embedded styling — style is a clean standalone
  entry for the future .fmgz container. (The serialized SVG naturally stops
  containing style attrs for registry-materialized layers; stripping the rest is a
  non-goal for this branch.)

## 5. Editor rewiring (`public/modules/ui/style.js`)

- `selectStyleElement()` reads from `style.layers` instead of `el.attr(...)`.
- The ~60 write handlers become mutate-object → `applyStyle` on the affected node
  (a small `updateStyle(path, value)` helper).
- The 8 group-aware elements (`anchors, borders, burgIcons, coastline, lakes,
  labels, routes, terrs`) navigate `children`.
- The file **stays in `public/modules/ui/` as JS** — no TS conversion in this
  branch (that's Azgaar's separate editor-migration track). Only reads/writes are
  rewired. Same for `style-presets.js` internals where practical; the Zod schema
  and upgrader live in `src/` (TS) and are exposed on `window` like other services.
- `addStylePreset`/download path serializes the live style object.

## 6. Verification

- **Unit:** Zod schema round-trips all 12 regenerated system presets; legacy
  upgrader golden tests (old default.json → expected StyleNode tree); applier
  writes expected attrs for a nested node incl. child creation.
- **Old-map compat:** headless load of `public/__fixtures__/1.139.4.map` and
  `demo.map`, asserting (a) `style.layers` populated as expected post-migration,
  (b) rendered attribute parity — snapshot the styling attributes of every layer
  `<g>` before/after the branch and diff. Mechanical per-layer regression net,
  essential for a one-branch delivery of 40 elements.
- **Preset parity:** apply baseline `default.json` via legacy path vs regenerated
  `default.json` via native path → identical DOM attributes.
- Existing suite: `tsc --noEmit`, vitest, `npm run build`, Biome.

## 7. Workspace & process

- Clean worktree off `upstream/master`: `~/dev/fmg-style-migration`, branch
  `style-migration`, remote = barrulus fork, PR to Azgaar/Fantasy-Map-Generator.
- Merge `upstream/master` regularly (Azgaar lands registry + other work fast).
- Upstream code conventions: few comments, why-not-how, Biome formatting.
- No fork-specific code; the barrulus fork picks this up at the next upstream sync.

## Non-goals

- Layer materialization / registry itself (Azgaar's workstream; we provide the seam).
- TS conversion of `style.js` / `style-presets.js`.
- Stripping residual style attrs from the saved SVG for non-registry layers.
- .fmgz container work (this branch only makes style container-ready).
- Fork port (next sync).
