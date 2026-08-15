# Style migration — branch handoff

Branch: `style-migration` (barrulus fork), merged with `upstream/master` at v1.143.2, version bumped
to **1.143.3**. **This is not a PR** — it is a branch to assess and rebase against the Layer registry
work, since that work materializes and destroys layer `<g>` elements and this touches how those
elements get their attributes.

## What changed

Styling is one store, `style.layers`, serialized at `data[48]`, and it is the authority — the SVG is
written to, never read. Every value is split by **consumer**: if the browser consumes it (`fill`,
`stroke`, `opacity`, `filter`, `font-size`) it is `presentation` and the applier is the only writer;
if FMG code consumes it (relief `set`, heightmap `scheme`, `oceanLayers.layers`, `markers.rescale`,
`statesHalo.width`) it is an `option` and the renderer reads it from the store with
`getLayerOptions()`. Options are no longer mirrored onto the SVG, so `data-size`, `data-width`,
`scheme`, `rescale`, `layers` and friends are gone from the DOM. Nodes nest: `{presentation, options,
children}`, children resolved against **direct `<g>` children** by `id`, falling back to
`data-group`. The 12 presets in `public/styles/` are converted to that shape; old flat
`{"#selector": {...}}` presets (downloaded files and `fmgStyle_*` in localStorage) are upgraded on
read; old maps are migrated by harvesting the attributes off the SVG they carry.

Data model docs: `docs/architecture/data_model.md` (new `# Style` section, plus the Relief section).

## The registry seam

Two functions, both in `src/services/styles/apply.ts`:

```ts
applyLayerStyle(layerId)                          // look up #<layerId>, apply the whole node
applyStyleNode(root, node, {createMissing})       // apply a node onto an element you already have
```

- **A layer that is not materialized is a safe no-op.** `applyLayerStyle` returns early when the
  element (or the node) is missing. Styling state lives in the store regardless of whether the `<g>`
  exists, so a registry can destroy a layer's element freely and nothing is lost.
- **When a registry materializes a layer's `<g>`, call `applyLayerStyle(layerId)` right after
  appending it.** That is the whole contract — the element is styled from the store, including its
  children.
- **`createMissing: false` is the hook for renderer-owned groups.** By default the applier creates a
  missing child `<g>` so a preset can style a group that has not been drawn yet. For `labels` it
  passes `createMissing: false`, because `drawLabels`/`renderLabelGroup` own those groups' lifecycle
  and use their own id scheme (`id="labels-<name>" data-group="<name>"`). Any layer whose children a
  registry owns should be treated the same way.
- Options have no single writer by design: each renderer reads its own when it draws. A registry
  that re-materializes a layer therefore needs the layer's normal draw path, not just the applier.

## Files with the highest conflict surface

| File | What this branch did |
|---|---|
| `public/modules/ui/style-presets.js` | Rewritten around the store: `applyStylePreset` parses/upgrades a preset, replaces `style.layers`, then calls `applyLayerStyle` per layer plus the side-effect passes (terrain, texture, single-instance elements, heightmap schemes). `collectStyleData` is now only a serializer. |
| `public/modules/ui/style.js` | Every editor handler writes `setPresentation`/`setOptions` instead of `d3.select(...).attr(...)`; the element+group selects resolve to a `{layerId, childIds}` target (`styleTargetFromUI`). |
| `public/modules/ui/layers.js` | Small: draw paths read their options from the store (`drawTexture`, ocean layers, relief) instead of off the layer element. |
| `src/services/io/load.ts` | `data[48]` is parsed with `parseStyle` into `style.layers`; malformed data degrades to an empty shape instead of aborting the load. |
| `src/services/io/auto-update.ts` | New `isOlderThan("1.143.3")` block: `rehomeLegacyStyleBags()` (v1.140–1.142 bags) then `harvestLegacyLayerStyles()` (attributes off the SVG), both through the legacy upgrader; harvested option attributes are then stripped from the SVG. |
| `src/components/zoom.ts` | `invokeActiveZooming` reads `statesHalo.width`, `markers.rescale` and the emblems gate from the store rather than from attributes. |
| `src/renderers/labels/label-groups.ts` | Label groups are styled from `style.layers.labels.children`; dx/dy are options projected as `data-dx`/`data-dy` + an inline transform, re-derived after an applier pass (`applyLabelGroupShifts`). |
| `public/styles/*.json` (12 files) | Converted to the new format wholesale — expect these to conflict textually with any preset edit. |

New, so conflict-free: `src/services/styles/{schema,store,apply,legacy}.ts` (+ tests),
`tools/convert-style-presets.mjs`, `tests/e2e/style-parity.spec.ts`.

## Deliberately still DOM-projected

Not an oversight — these have no renderer that reads them, or CSS does the work:

- `applySingleInstanceOptionElements()` in `style-presets.js` writes 5 singletons after a preset
  apply: the **vignette rect**, the **compass `<use>` transform**, **`#oceanBase` fill**,
  **`#oceanicPattern`**, and the **`#scaleBarBack`** plate.
- Two load-bearing `font-size` duplicates (`LAYER_OPTION_ATTRIBUTES`): **`armies.options.fontSize`**
  and **`scaleBar.options.fontSize`** are also written as `font-size` on the layer `<g>`, because
  their children inherit it via CSS. Nothing reads them back.

Everything else that used to live on the SVG for FMG's own use is now read from the store.

## New dependency

`zod` (^4.4.3). It validates in one place: `parseStyle()` in `src/services/styles/schema.ts`, used by
map load (`data[48]`), preset apply, and the legacy upgrader's output. Unknown layer ids and invalid
options are dropped with a `console.warn` rather than throwing — a bad preset must never break a
load. Numeric options use `z.coerce.number()` (legacy JSON stores `"0"` as a string), and `null` is
preserved as the explicit *remove this attribute* semantics.

## The parity harness

`tests/e2e/style-parity.spec.ts` plus two committed baselines. It compares 68/73 selectors × ~50
styling attributes against a snapshot taken from the pre-migration build:

- `tests/fixtures/style-baseline.json` — a **loaded** map (`demo.map`): pins that the migration path
  produces byte-identical styling to before.
- `tests/fixtures/style-baseline-generated.json` — a **freshly generated** map: pins the
  preset-apply path (style attributes there are preset-driven, so seed-independent), including the
  burg-group children.

Regenerate deliberately with `UPDATE_STYLE_BASELINE=1 npx playwright test tests/e2e/style-parity.spec.ts`,
and diff the fixture before committing. It is worth keeping in master: it is the only thing that
catches a style silently not reaching the DOM, and it would catch a registry that materializes a
layer without styling it.

### How to verify quickly

```bash
npx vitest run                                   # unit: schema / store / apply / legacy upgrader
npx playwright test tests/e2e/style-parity.spec.ts   # both baselines + editor/preset/submap paths
npx playwright test tests/e2e/layers.spec.ts     # per-layer DOM snapshots
npx playwright test tests/e2e/load-map.spec.ts   # old-map load + the legacy harvest
```

`style-parity.spec.ts` also covers: the editor bridge (store + DOM), burg-icon/anchor group creation,
group navigation for all 8 group-aware elements, a full system-preset switch and revert against the
values the preset files actually carry, the create-custom-heightmap-scheme dialog, and a submap run
(regression: the submap tool must not materialize empty style nodes).

A manual pass the automated tests cannot do is written up in
`docs/superpowers/plans/2026-08-14-style-migration-manual-tests.md`.

## Open and known items

- **`label-groups.ts` keeps its own one-line non-materializing store reader** instead of importing
  `getStyleNodeIfSet` from the store, to avoid a store → apply → label-groups import cycle.
  Equivalent today; could drift.
- **`changeStatesNumber` silently skips label groups with no store entry.** Previously it rescaled
  the live group unconditionally. A proper fix needs an effective-style helper (store value falling
  back to the built-in group style), which is bigger than a patch.
- **`Relief.changeSize()` is called with a size by the preset path and with a ratio by the editor.**
  Pre-existing inconsistency, preserved deliberately rather than fixed mid-migration. It is reachable
  — `pale.json` carries a terrain `size` of 0.7.
- **The emblems zoom gate** moved from `emblems.style("display") !== "none"` to
  `layerIsOn("toggleEmblems")`, so the zoom pass now also runs while the layer's `<g>` is hidden.
  Verified inert (toggling the layer on renders and re-evaluates correctly), but it is why
  `tests/e2e/layers.spec.ts-snapshots/emblems.html` gained a `class="hidden"`.
- **Version gate**: the migration runs for maps older than 1.143.3, one ahead of upstream's 1.143.2,
  because 1.143.0–1.143.2 shipped without the store. Retune the constant if this lands under a
  different version.
- `tests/e2e/3d-view.spec.ts` fails locally on NixOS — it launches its own browser and hits the
  bundled-chromium library issue. Environmental, unrelated to this branch.

## Not a PR

Deliberately handed over as a branch: the conflict surface against the Layer registry is in
`layers.js` and in when layer elements exist, and that is a call for whoever owns the registry. Happy
to rebase it on the registry once its shape is settled.
