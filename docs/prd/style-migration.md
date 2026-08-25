# Style store — migration

Companion to `style.md`. How to get there from master, one pointed step at a time — no big bang. Each step lands green on its own (tsc, vitest, e2e), so review stays small.

Today styling lives in four places: the legacy `style` JS object (`labels.groups`, `burgIcons`, `anchors`, `relief` — persisted as its own record in the map file), attributes on SVG groups (persisted inside the serialized SVG), selector-keyed preset JSONs, and static `attrs` bags on registry layer entries. All four converge on `styles`.

## Steps

**1. The library + the addressing contract.** *(done — this branch)* `src/styles/` lands dormant: nothing imports it, zod ships zero bundle bytes. The live half is the addressing contract: the registry stamps `data-layer`/`data-group` on layer groups and declared children, renderers stamp the elements they create. Saved maps carry the inert attributes from here on — harmless everywhere.

**2. Absorb the JS `style` object.** *(done — this branch)* The domains that already made the jump to JS move into `styles`, so there is one JS store from day one. Per-domain commits, each green alone:

- *labels.groups* → `styles.labels.groups` — readers (`label-groups`, `label-arc`, `fit-state-label`, `label-spread`, 3d renderer, groups editor) and writers (preset routing, editor, submap) retarget.
- *burgIcons + anchors* → `styles.burgIcons.{burgIcons,anchors}.groups` — the draw-time DOM harvest in `createIconGroups` retargets; it keeps existing until the editor writes through `styles` (step 6).
- *relief* → `styles.relief.options` — `set`/`size`/`density` relocate as they are; moving `density` to app options (it regenerates data, so it is arguably not style) is its own later step-5-shaped PR, not smuggled into the relocation.

One bridge: the map file's legacy style record keeps being written (`stylesToLegacy`), so files stay loadable on master in both directions; load converts it into `styles` (`stylesFromLegacy`). Dies at step 4. The legacy `style` global, its `Style` interface and its initializer are gone; classic `public/` scripts reach the store as the `styles` global and convert legacy shapes through `stylesLegacy`.

**3. The preset pipeline swap.** *(done — this branch)* The 12 preset JSONs convert to the new format by script; applying a preset becomes `setStyles(parseStyles(json))` + `applyStyles(...)` instead of selector-keyed DOM writes. Custom localStorage presets and uploads keep working through the legacy upgrader — a separate function (`parseStyles` never sees old formats), permanent because users upload old presets forever. Renderers are untouched: the applier writes the same attributes they already read, so DOM output is identical.

**4. Persistence.** *(done — this branch)* `JSON.stringify(styles)` becomes its own record in the map file; load parses it and applies over the restored SVG. For older maps, auto-update scrapes the known styling attributes off the restored SVG and feeds them through the upgrader — gated on the record's shape, not a version line (`isStoreStyles`), since version lines lie. The step-2 bridge dies here.

**5. Options, per consumer.** Each decision-attribute moves as one small PR: the renderer read, the style-editor input and the attribute's removal migrate together (`data-size` family; heightmap `scheme/terracing/skip/relax/curve`; `rescale`, halo `data-width`, ocean `layers`; texture/vignette/scale-bar geometry). After each PR that attribute no longer exists in the DOM.

**6. Editor through `styles`.** `style.js` reads from `styles` and writes by mutation + `applyStyles` — its hand-maintained per-input DOM writes and redraw calls go away. The burg-icon DOM harvest dies here.

**7. Delete the legacy layer.** The `Style` interface and its global retire; the registry's hand-written `erase` overrides protecting DOM-held style state (`removeRoutes`, `removePrecipitation`, `removeBurgIcons`) become deletable — uniform `eraseContent` is safe once styling lives off-DOM.

## Invariants

- Steps 2–4: the applier writes every attribute renderers still read. An options attribute leaves the DOM only in the same PR that migrates its last reader (step 5) — never earlier.
- Old files always load: legacy map records (step 4) and legacy presets (step 3) convert forever; only the code that *produces* legacy shapes dies.

## Verification

Attribute-snapshot e2e baselines pin the rendered styling of every layer group on a loaded reference map and a freshly generated one (seed-stable). They must stay byte-identical through steps 2–4 and shrink only by the exact attributes each step-5 PR removes. Per step additionally: schema round-trip of all 12 converted presets (step 3), old-map load with harvested styles asserted (step 4), and editor writes driven through real `input`/`change` events (step 6).
