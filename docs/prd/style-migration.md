# Style store — migration

Companion to `style.md` (the approved design). This covers only how to get there from master. Six steps; each lands green on its own with tsc, vitest and e2e passing, so review stays small.

## What moves where

Today styling lives in four places: attributes on SVG groups (persisted inside the map file's serialized SVG), the legacy `style` object (`labels.groups`, `burgIcons`, `anchors`, `relief`), selector-keyed preset JSONs, and static `attrs` bags on registry layer entries. All four converge on the `Style` instance.

## Steps

**1. The library, dormant.** `src/styles/` with `Style`, the `Attrs`/options schemas, the legacy upgrader and the private applier — landed and tested, consumed by nobody. Migration is its own concern, so this step touches no live code path: no preset-pipeline change, no save/load change, no registry change. What it buys is a reviewable library and the parity baselines that later steps are measured against. `docs/step1-summary.md` records what landed.

```ts
// the upgrader ships permanently (users upload old presets forever), but privately - it is not
// exported from src/styles/, so Style.fromJSON is the only way in:
Style.fromJSON(oldSelectorKeyedJson);  // works, and warns only about keys it drops on purpose
                                       // (`auto-filter`, `#provs`'s unread `data-size`)
```

**2. The pipeline swap.** Presets stop being applied as raw DOM writes: `applyStylePreset` builds a `Style` and the registry calls `style.applyTo(layer)` in `init()` and in its redraw, the static `attrs` bags on layer entries fold into the default style, and the 12 preset JSONs convert to the new format by script (`tools/convert-style-presets.mjs`). Renderers are untouched — the applier writes the same attributes they already read, so the DOM output is identical before and after. Custom localStorage presets and uploads keep working through the upgrader, with no user action.

Three named bridges come with the swap, each scaffolding with a stated death date rather than an accident:

- *Legacy mirrors.* The old style save slot keeps being written from the `Style` instance, so a file saved by this build still loads on master. Dies with the legacy layer (step 6).
- *Transitional saver.* Custom-preset save scrapes the live DOM in the legacy selector shape and runs it through `fromJSON`→`toJSON`, so it captures editor edits rather than the stale applied instance. Dies when the editor writes through `Style` (step 5).
- *Load resync.* After a map load replaces the whole `#map` SVG, the instance is rebuilt from what the restored document actually carries, so the two cannot drift. Dies at step 3, which gives the map file its own style record.

Also decided here, not before: whether `applyTo` runs inside the registry's redraw (as `style.md` says) or only from `init()`. The redraw-reapply model reverts raw DOM edits, which `layer-teardown.spec.ts` asserts must survive — so it costs either that test's contract or an amendment to `style.md`.

**3. Persistence.** `style.toJSON()` becomes its own record in the map file; load builds the instance from it and the registry applies it over the restored SVG, retiring the load resync bridge. For older maps, auto-update scrapes the known styling attributes off the restored SVG into the old preset shape and feeds it through the same `fromJSON` — one `isOlderThan` gate, no legacy symbol outside `src/styles/`.

**4. Options, per consumer.** Each decision-attribute moves as one small PR: the renderer read, the style-editor input and the attribute's removal migrate together, per layer group (`data-size` family; heightmap `scheme/terracing/skip/relax/curve`; `rescale`, `data-width`, ocean `layers`; texture/vignette/scale-bar geometry). After each PR that attribute no longer exists in the DOM. Rule kept from the design: every option read states its default at the use site.

**5. Editor through the facade.** `style.js` reads via `options()`/the tree and writes via `setAttr`/`setOptions`; both setters schedule the redraw, so the editor's hand-maintained redraw calls go away. The transitional saver dies here: once the editor stops writing raw DOM, `toJSON()` is already the truth.

**6. Delete the legacy layer.** The old `style` object shapes re-home into the instance and disappear, `src/types/style.ts` and the legacy save mirrors retire, and the registry's hand-written `erase` overrides (`removeRoutes`, `removePrecipitation`, `removeBurgIcons`) become deletable — the uniform `eraseContent` is safe once styling lives off-DOM.

## Order matters for two reasons

Steps 2-3 keep a transitional invariant: the applier writes every attribute the renderers still read, so nothing breaks while reads migrate. An options attribute is only removed from the DOM in the same PR that migrates its last reader (step 4) — never earlier.

## Verification

Two attribute-snapshot e2e baselines pin the rendered styling of every layer group — one for a loaded reference map, one for a freshly generated map (generated-map styling is preset-driven, so it is seed-stable). Captured on master and landed with step 1 (where they assert that nothing rendered changed at all), they must stay byte-identical through steps 2-3 and shrink only by the exact attributes each step-4 PR removes. Plus, per step: schema round-trip of all 12 converted presets, old-map load with harvested styles asserted, and editor writes driven through real `input`/`change` events (store-API-only coverage misses unconverted handlers).
