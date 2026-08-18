# Style store — migration

Companion to `style.md` (the approved design). This covers only how to get there from master. Five steps; each lands green on its own with tsc, vitest and e2e passing, so review stays small.

## What moves where

Today styling lives in four places: attributes on SVG groups (persisted inside the map file's serialized SVG), the legacy `style` object (`labels.groups`, `burgIcons`, `anchors`, `relief`), selector-keyed preset JSONs, and static `attrs` bags on registry layer entries. All four converge on the `Style` instance.

## Steps

**1. The class, applied.** `src/styles/` with `Style`, the `Attrs`/options schemas and the private applier. Registry calls `style.applyTo(layer)` in `init()` and in its redraw; the static `attrs` bags on layer entries fold into the default style. The 12 preset JSONs convert to the new format by script; `fromJSON` recognizes the old selector-keyed format and upgrades it internally, so custom localStorage presets and user uploads keep working with no user action. Renderers are untouched — the applier writes the same attributes they already read, so the DOM output is identical before and after.

```ts
// the upgrader ships permanently (users upload old presets forever), but privately:
Style.fromJSON(oldSelectorKeyedJson);  // works, warns nothing, returns the same result
```

**2. Persistence.** `style.toJSON()` becomes its own record in the map file; load builds the instance from it and the registry applies it over the restored SVG. For older maps, auto-update scrapes the known styling attributes off the restored SVG into the old preset shape and feeds it through the same `fromJSON` — one `isOlderThan` gate, no legacy symbol outside `src/styles/`.

**3. Options, per consumer.** Each decision-attribute moves as one small PR: the renderer read, the style-editor input and the attribute's removal migrate together, per layer group (`data-size` family; heightmap `scheme/terracing/skip/relax/curve`; `rescale`, `data-width`, ocean `layers`; texture/vignette/scale-bar geometry). After each PR that attribute no longer exists in the DOM. Rule kept from the design: every option read states its default at the use site.

**4. Editor through the facade.** `style.js` reads via `options()`/the tree and writes via `setAttr`/`setOptions`; both setters schedule the redraw, so the editor's hand-maintained redraw calls go away.

**5. Delete the legacy layer.** The old `style` object shapes re-home into the instance and disappear, `src/types/style.ts` retires, and the registry's hand-written `erase` overrides (`removeRoutes`, `removePrecipitation`, `removeBurgIcons`) become deletable — the uniform `eraseContent` is safe once styling lives off-DOM.

## Order matters for two reasons

Steps 1-2 keep a transitional invariant: the applier writes every attribute the renderers still read, so nothing breaks while reads migrate. An options attribute is only removed from the DOM in the same PR that migrates its last reader (step 3) — never earlier.

## Verification

Two attribute-snapshot e2e baselines pin the rendered styling of every layer group — one for a loaded reference map, one for a freshly generated map (generated-map styling is preset-driven, so it is seed-stable). Captured on master before step 1, they must stay byte-identical through steps 1-2 and shrink only by the exact attributes each step-3 PR removes. Plus, per step: schema round-trip of all 12 converted presets, old-map load with harvested styles asserted, and editor writes driven through real `input`/`change` events (store-API-only coverage misses unconverted handlers).
