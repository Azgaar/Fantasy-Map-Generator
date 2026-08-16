# Review notes — PR #1583 "Global layers registry"

18 findings, each independently verified against the PR head, all at full detail, ranked by
severity. Line numbers refer to 5c4d054e; the PR head has since moved to 9c292818, which adds
only zoom.test.ts and a one-line handleZoomEnd change in zoom.ts — no finding or line number is
affected.

## The pattern behind the top findings

Findings 1, 2, 3 and 9 share one mechanism: the registry's erase-on-hide model
(`eraseContent()`) deletes DOM state that nothing else owns. The old toggles were surgical
*because* the DOM was the database — they removed `<path>`/`<circle>`/`<use>` content and left
sibling groups, style attributes and editor state alone. A uniform erase is only safe once no
state lives exclusively in the DOM.

## Findings

### 1. Routes toggle permanently deletes custom route groups — `src/components/layers.ts:299`
The routes layer declares children `["roads","trails","searoutes"]`; default `eraseContent()`
(lines 239-244) removes any *undeclared* child `<g>` outright. Old `toggleRoutes` removed only
`<path>` elements.
**Repro:** add a custom route group (Route Groups editor appends a `<g>` under `#routes`),
assign routes, toggle Routes off. The group and its style attributes are deleted; on re-show
`drawRoutes`' `routes.select("#" + group).html(...)` is a silent no-op on the missing group, so
those routes never render again although `pack.routes` still holds them — and saving bakes the
loss into the .map file.

### 2. Precipitation toggle deletes the `#wind` group — `src/components/layers.ts:320`
The precipitation layer declares no children/keepContent/erase, so `eraseContent()` removes all
`#prec` children — including `#wind` (wind-direction labels), which only `generatePrecipitation()`
creates at map generation.
**Repro:** toggle Precipitation off then on. `drawPrecipitation` redraws circles only; wind
arrows/labels are gone until the next full regeneration, and saving meanwhile persists the map
without `#wind`.

### 3. Icons toggle silently reverts unsaved style edits — `src/components/layers.ts:333`
Toggling burg Icons off destroys the per-group `<g>`s under `#burgIcons`/`#anchors`
(`replaceChildren`). The only DOM→style-object harvest runs at draw *start*
(`createIconGroups`); toggle-off erases with no preceding harvest.
**Repro:** change the `capital` group fill in the Style editor (a DOM-attribute write), toggle
Icons off/on: groups are rebuilt from the stale style snapshot and the edit silently reverts.
Old `toggleBurgIcons` removed only `circle, use` nodes and preserved the groups.

### 4. Legacy label `layerDependency` ids fail open — `src/renderers/labels/labels-renderer.ts:117`
`!dependency || !Layers.has(dependency) || Layers.isOn(dependency)` treats pre-1.144 stored ids
(`toggleRivers`/`toggleRoutes`/`toggleProvinces`) as *no dependency*. The `LAYER_ID_MAP` remap
(auto-update.ts:1546) runs only on the .map load path; `options.labels` restored from
localStorage (public/main.js:68) is never remapped.
**Repro:** a returning user with pre-1.144 `options-labels` in localStorage generates a NEW map
(auto-update never runs): river labels keep dependency `toggleRivers`, so turning Rivers off no
longer hides them — labels float over a map with no rivers. Note data_model.md:348 claims
unknown ids "fail closed"; the code fails open.

### 5. Export runs drawScaleBar on a hidden scale bar — `src/services/io/export.ts:272`
Full-map export calls the rewritten `drawScaleBar` unconditionally; the renderer lost the old
`if (!scaleBar.size() || display === "none") return` guard and calls `getBBox()`
(draw-scalebar.ts:70,85) on the clone's `#scaleBar` even when the layer is off.
**Repro:** Scale Bar off + full-map export: dead work and a bogus transform at best; on Firefox
`getBBox()` on a non-rendered subtree throws `NS_ERROR_FAILURE` and the export fails. Nothing
strips hidden elements before line 272.

### 6. Load redraws every layer, discarding the parsed SVG — `src/services/io/load.ts:705`
Load now runs `Layers.drawAll()`, re-rendering every active + permanent layer from pack data;
the old load drew only the four layers not kept in the saved SVG. The PR's own PRD
(global-layers-registry.md:235) says redrawing loaded content "would be both slow and wrong".
**Impact:** seconds of extra load time on large maps (full isoline passes for
heightmap/biomes/states), SVG-only content dropped, and OceanLayers with the "random" outline
re-rolls to a different look on every load. Fix: draw only what save.ts strips
(`#terrain`, `#ruler`, `#tradeAnimation`, …), as before.

### 7. Attribute-hidden layers migrate active but stay invisible — `src/services/io/auto-update.ts:1564`
`recoverLayersState`'s `shown()` reads only inline style (`el.style.display !== "none"`); the
old loader's d3 computed-style read also caught the SVG `display="none"` presentation
*attribute*. `setVisible` (layers.ts:247-249) only writes inline style and never clears the
attribute.
**Repro:** legacy maps carry attribute-hidden layers (auto-update.ts:103 itself writes
`attr("display","none")` on `#zones`; only `#labels`/`#routes` get attribute cleanup). Loading
migrates the layer as ACTIVE: button on, element invisible forever — inline `''` does not
override the presentation attribute; toggling erases and redraws without ever revealing it.

### 8. `Layers.show()` redraws layers that are already on — `src/components/layers.ts:129`
`change()` skips already-active ids, but `draw(...ids)` runs for ALL requested ids and `emit()`
fires even on no-ops (`set()` at lines 152-163 gets this right). Old call sites guarded with
`if (!layerIsOn(...))`.
**Impact:** every burg click runs `BurgEditor.open()` → `Layers.show("burgIcons","labels")`:
with both layers on, `drawBurgIcons` rebuilds every burg `<use>` and `drawLabels` does a full
scene.replace over all labels — tens-to-hundreds of ms per click (seconds on large maps) where
the old code did zero work, plus a spurious layers-tab rebuild. Same in
states/diplomacy/biomes/cultures editor opens.

### 9. Heightmap toggle allowed mid-edit, wipes the canvas — `src/components/hotkeys.ts:79`
The edit-mode guard was dropped: old `toggleHeight` refused with a tip when
`customization === 1`. The new hotkey path guards only `code === "Equal"`, and the layers-tab
click handler (layers-tab.ts:74-80) has no guard while the tab stays reachable mid-edit
(options.js:69).
**Repro:** in the heightmap editor, press H (or click Heightmap in the Layers tab):
`Layers.toggle("heightmap")` → `eraseContent` wipes `#oceanHeights`/`#landHeights` with no
warning. Edit data in `grid.cells.h` survives; re-toggling costs a full redraw. The old error
tip is gone.

### 10. drawTexture renders literal `href="null"` — `src/renderers/draw-texture.ts:9`
`element.getAttribute("data-href")` returns null and the template interpolates it, producing
`href="null"`; the old d3 `.attr("href", null)` omitted the attribute.
**Repro:** pre-1.94 map saved with texture off, or a custom style whose null stripped the
attribute: toggling Texture issues `GET ./null` (404 console error) and renders a broken
`<image>` instead of nothing.

## Findings 11-18

### 11. Preset switch runs every renderer for a pure attribute change — `public/modules/ui/style-presets.js:196`
`applyStyleWithUiRefresh` replaced the old curated redraw list (scaleBar, heightmap-if-on,
legend, ocean, measurers, relief, burgIcons, labels — the only renderers that bake style values
into markup) with `Layers.drawAll()`.
**Repro:** large map, Political preset (states/borders/labels/provinces on), switch the style
preset dropdown (also hit on style-file upload at line 492). `drawAll` re-runs drawStates,
drawBiomes, drawCultures, drawReligions, drawProvinces — each a full getIsolines pass over all
pack cells — though none of them reads any style-preset data (verified per renderer). A
sub-second attribute application becomes multi-second full-map recomputation. Fix: curated id
subset, or a `styleDependent` flag per registry entry.

### 12. Thirteen style.js listeners render hidden layers into the save — `public/modules/ui/style.js:656`
drawHeightmap (lines 656, 757, 781, 786, 791, 796, 801), drawGoods (1059, 1064, 1069) and
drawMarketsLayer (1078, 1083, 1090) are called raw, bypassing the registry `isOn` gate the same
PR installed for grid/rulers/emblems in the same file (510, 515, 604, 1044).
**Repro:** Heightmap layer off (content erased per the new off⇒erased invariant), Style editor →
Heightmap → change the color scheme. The full heightmap renders into the hidden `#terrs` group —
a 100K-cell wasted render — and since nothing re-erases, the hidden content persists into the
saved .map, violating the PR's own invariant. New failure mode even though the raw calls predate
the PR (old off-state was children-removed, so a raw redraw desynced *visibly*; now it leaks
silently into saves). drawRelief's 3 sites are fine (internally guarded). Fix: the same
`Layers.draw("heightmap"/"goods"/"markets")` pattern already applied to grid/rulers/emblems.

### 13. Heightmap keep-mode bypasses the registry's display ownership — `src/controllers/heightmap-editor.ts:333`
Keep mode hides `#landmass`/`#lakes` via direct d3 `.style("display","none")` and
`restoreKeptData` clears it with `.style("display", null)` (459/540); `change()`
(layers.ts:221-232) skips layers already in the requested state without re-applying
`setVisible`, so the exit path cannot repair the DOM. `Layers.move` → `init()` also un-hides
`#landmass` mid-edit.
**Repro A:** Lakes off (`keepContent: true` — content stays, hidden by the registry's inline
display:none), enter the heightmap editor in keep mode, exit. `restoreKeptData` removes the
registry-written display:none, then `Layers.set(storedLayers)` skips lakes (off===off) — `#lakes`
content visible while the registry and tab button say off.
**Repro B (new in the PR):** during keep mode, open the Layers tab (no customization guard) and
drag any layer to reorder — `Layers.move` → `init()` → `setVisible(landmass, true)` un-hides the
landmass mid-edit. Fix at the right depth: registry-level suspend/resume, or `set()` re-applying
`setVisible` for every layer, so editors never write display on registry-owned groups.

### 14. Ctrl+click on Icons opens the wrong style section — `src/components/layers-tab.ts:74`
The shortcut passes `Layers.get(id).elementId` for every layer, but burgIcons' elementId is
`"icons"` (layers.ts:330-335), so it opens the generic Icons stroke block instead of the
per-group Burg Icons section (group select, data-icon, icon size, stroke-linejoin,
fill-opacity) the old code opened via `editStyle("burgIcons")`.
**Repro:** Ctrl+click the Icons entry in the Layers tab. Both select values are valid so nothing
throws — a silent regression. Exhaustive check: burgIcons→icons is the only mismatch of all 30
mappings. Fix: an explicit editStyle target on the layer entry (e.g. `styleElement: "burgIcons"`).

### 15. Pre-1.144 custom layer presets destroyed without migration — `src/components/layers-presets.ts:54`
`restoreCustomPresets` keeps a stored preset only if every id passes `Layers.has()`, so presets
stored with toggle-button ids ("toggleBorders", …) are all dropped; the next
`savePreset`/`removePreset` (91/111) rewrites localStorage `presets` with only the survivors.
**Repro:** save and select a custom preset on a pre-1.144 build; update. The preset vanishes
(`every(id => Layers.has(id))` fails), selection falls back to political; saving any new preset
overwrites the store, erasing the old data irrecoverably. The drop is a PRD-documented tradeoff,
but the destructive rewrite on next save is not called out — and the existing `LAYER_ID_MAP`
(auto-update.ts:1512), or a one-line toggle-prefix remap, would rescue old presets cheaply.

### 16. debugUtils console helpers all throw — `src/utils/debugUtils.ts:14`
`window.debug` is orphaned: old main.js created the global d3 selection; the PR replaces that
block with `Layers.init()` (the `#debug` group now comes from the registry entry) and nothing
assigns `window.debug`, while all five helpers call `window.debug.selectAll/append` behind a
`debug: any` declaration that silences tsc.
**Repro:** devtools console, `drawPoint([500, 300])` or `drawCellsValue(pack.cells.h)` (exposed
on window explicitly for runtime debugging) — TypeError: cannot read "selectAll" of undefined.
Low severity (no production path), but the whole debugging API is silently dead. One-line fix:
`select("#debug")` inside debugUtils, drop the Window.debug declaration.

### 17. savePreset appends duplicate dropdown options — `src/components/layers-presets.ts:90`
`ensureEl("layersPreset").add(new Option(name, name, false, true))` has no existing-name check;
utils' `applyOption` (nodeUtils.ts:74-79) dedupes by value and is a drop-in.
**Repro:** save a preset named "mine", save again under the same name — localStorage stays
correct (keyed overwrite) but the select accumulates a duplicate option per re-save; a name
shadowing a default preset both shadows it and duplicates its option. Carried over from old
layers.js:184, so frame as reuse-plus-bugfix.

### 18. The force-cells-layer state machine is hand-copied six times — `src/controllers/river-creator.ts:19`
river-creator (19/171), route-creator (21/188), river-editor (21/351), route-editor (20/469),
burg-editor (706/713-716) and goods-editor (516-519/559/566-568) each carry a module-level
`isCellsLayerForced` flag, translated by hand from the old DOM-dataset pattern — already drifted
into two variants — while `LayersRegistry` exposes only isOn/show/hide/toggle.
**Failure it invites:** two editors forcing cells concurrently (open a burg editor, then a river
editor, close the burg editor first) restores the cells layer out from under the river editor;
any fix must be repeated in six files in two shapes. Fix: one refcounted
`Layers.showTemporarily(id): () => void` restore helper replacing all six flags.
