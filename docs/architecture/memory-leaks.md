# Memory leaks

Audit of the app for memory that is never released. Every finding names the exact line and the
retain path so it can be re-checked, and gives a one-line fix where one exists.

The app is a long-lived SPA, and the world state (`pack` / `grid` on `window` — tens to hundreds of
MB of typed arrays and object graphs) is replaced wholesale on every generation, load, transform and
heightmap edit. Two leak classes dominate:

1. **A module-level reference or listener that outlives a world replacement and pins the previous
   world** (findings 4–6).
2. **`renderDialog()` raw-removing a still-live jQuery-UI dialog element** instead of calling
   `destroyDialog()`, which orphans the `.ui-dialog` wrapper, the tracked widget and the whole
   detached dialog subtree (findings 2 and 8). This shape appears in ~15 files.

## Summary

| #   | Sev    | Where                                                                                      | What leaks                                                                                                      | Trigger                                            |
| --- | ------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | HIGH   | `src/renderers/view-3d-renderer.ts:1008` (+205/383/985, 116) + `controllers/view-3d.ts:71` | WebGL context per 3D open, never released; uncancellable rAF chains that keep rendering a disposed renderer     | open/close the 3D view; change rotation            |
| 2   | HIGH   | `src/controllers/elevation-profile.ts:571` (+26, 248 of `river-editor.ts`)                 | one orphan `.ui-dialog` + detached profile subtree **per mousemove** while dragging a river/route control point | drag a river/route point with the profile open     |
| 3   | HIGH   | `src/services/io/load.ts:374` + `controllers/good-editor.ts:524-527`                       | a copy of every custom good icon appended to the page-lifetime `#good-icons` per load                           | every `.map` load with custom good icons           |
| 4   | HIGH   | `src/generators/graph-override.ts:17,57`                                                   | previous `pack.vertices` (~10–30 MB)                                                                            | move a coastline/lake vertex, then generate/load   |
| 5   | HIGH   | `src/generators/heightmap-generator.ts:16-17,77-84`                                        | previous full `GridGraph` + heights copy                                                                        | open heightmap editor, then load a `.map`          |
| 6   | HIGH   | `src/renderers/draw-goods.ts:15,70` + `draw-markets.ts:12-13,42-43`                        | previous generation's entire `pack`                                                                             | goods/markets layer on → off → generate            |
| 7   | MEDIUM | `src/controllers/heightmap-editor.ts:862-890`                                              | uncapped undo stack of full-grid `Uint8Array` snapshots                                                         | paint in the heightmap editor                      |
| 8   | MEDIUM | 14 more `renderDialog()` sites (list below)                                                | same orphan wrapper + detached subtree as #2, on repeat-open only                                               | `open()` while that dialog is already open         |
| 9   | MEDIUM | `src/controllers/journey/journeys-overview.ts:169-171` + `renderers/journey-travel.ts:96`  | runaway self-rechaining timer holding the travel `steps` closure                                                | hover a journey row, then click one of its buttons |
| 10  | MEDIUM | `src/services/io/load.ts:271-279` + `src/services/fonts.ts:271-295`                        | duplicate `<option>` and duplicate `FontFace` per load                                                          | every `.map` load                                  |
| 11  | MEDIUM | `src/services/ui-tour.ts:386` (+45, 355, 382)                                              | `document` keydown listener + driver instance, stacks                                                           | finish the tour or press Esc, then re-run it       |
| 12  | MEDIUM | `src/renderers/view-3d-renderer.ts:341-342` (+114-140, 868-871)                            | 2048² shadow-map render target and globe background texture                                                     | every mesh/globe 3D open                           |
| 13  | MEDIUM | `src/renderers/view-3d-renderer.ts:980-987`                                                | one `SphereGeometry` per globe redraw                                                                           | globe redraw (resolution, edit, regenerate)        |
| 14  | MEDIUM | `src/services/io/export.ts:258-260` vs `:522`                                              | full map SVG clone stranded in `document.body`                                                                  | any failure in the export await chain              |
| 15  | MEDIUM | `src/controllers/heightmap-selection.ts:12-13`                                             | one full `GridGraph` for the session                                                                            | open "Select Heightmap" once                       |
| 16  | LOW    | `src/controllers/burgs-overview.ts:228`                                                    | one anonymous `change` listener per open on a static file input                                                 | repeat opens of Burgs Overview                     |
| 17  | LOW    | `src/controllers/label-spread.ts:135` (+475, 152-154)                                      | measuring `<svg>` on `body` orphaned if the sandbox constructor throws                                          | spread fails                                       |
| 18  | LOW    | `src/controllers/states-editor.ts:1609`                                                    | 2 `#viewbox` listeners + detached merge form, cleanup bound to the wrong node                                   | Merge States, then close                           |
| 19  | LOW    | `src/utils/commonUtils.ts:339-349`, `namesbase-editor.ts:124,130`                          | `{once:true}` listeners accumulate on persistent prompt/upload elements; stale callbacks still fire             | open a prompt/upload, then cancel                  |
| 20  | LOW    | `src/controllers/military-overview.ts:536-560`                                             | static `#alert` keeps the last Apply closure, capturing live `pack` arrays                                      | Limit unit, then regenerate                        |
| 21  | LOW    | `src/components/lifecycle.ts:156-171`                                                      | `mapHistory` grows one record per map                                                                           | every generation/load                              |
| 22  | LOW    | stale module-level `let` slots in ~12 editors (list below)                                 | last-viewed `pack` entities / detached SVG pins one generation                                                  | close editor, regenerate, do not reopen            |
| 23  | LOW    | `src/renderers/view-3d-renderer.ts:79,85`                                                  | `gridToPackCellMap` + label-measuring canvas survive teardown                                                   | open the 3D view once                              |
| 24  | LOW    | `src/renderers/emblems/renderer.ts:17,305-313`                                             | `versions` keyed by emblem element id, never deleted                                                            | many maps/edits with rising entity counts          |
| 25  | LOW    | `src/services/io/export.ts:888-896`, `src/services/io/cloud.ts:54-62`                      | `<script>` tag per call, never removed                                                                          | repeat PNG-tiles export / Dropbox op               |
| 26  | LOW    | `src/controllers/color-picker.ts:104,130-137`                                              | picker container on `body` retains a callback into the closed editor                                            | close the editor with the picker still open        |
| 27  | LOW    | `src/components/dialog/table.ts:348`                                                       | stale `document` mousedown listener                                                                             | destroy a dialog with the columns picker open      |
| 28  | LOW    | `src/controllers/route-groups-editor.ts:97`                                                | dead `styles.routes.groups[...]` key per removed route group                                                    | add then remove a route group                      |
| 29  | LOW    | `heightmap-editor.ts:1114` + `:1070`                                                       | `line#brushCircle` left in the persistent `#debug` layer                                                        | abort a line brush                                 |
| 30  | LOW    | `src/generators/heightmap-generator.ts:600-616`                                            | missing `img.onerror`: promise never settles, fields stay set                                                   | a precreated heightmap whose PNG 404s              |
| 31  | bug    | `src/controllers/burg-editor.ts:558` vs `:836-841`                                         | `previewSettleTimer` not cleared on close → fires on a dead dialog (TypeError)                                  | close the burg editor within 200 ms of a pan       |

---

## HIGH

### 1. The 3D view leaks a WebGL context and leaves frame loops running

Two defects in `src/renderers/view-3d-renderer.ts`, with the same net effect: closing the 3D view
does not stop it.

**a. `animate()` has no idempotence guard.**

```ts
function animate() {
  animationFrame = requestAnimationFrame(animate); // :1008-1011
  if (controls?.update) controls.update();
}
```

Every call starts a new self-perpetuating chain, but `animationFrame` (`:64`) holds only the most
recently scheduled id, and `stop()` cancels exactly one frame:

```ts
const stop = () => {
  if (controls) controls.dispose();
  cancelAnimationFrame(animationFrame);              // :116
```

`animate()` is reached from three places — `newMesh` (`:383`, unconditional), `setRotation` on a
0 → non-zero transition (`:205`) and `addGlobe3dMesh` when autorotating (`:985`). On the globe,
`redraw()` → `updateGlobeTexure(true)` → `img2.onload` → `addGlobe3dMesh()` adds another chain on
**every** globe redraw, and `DEFAULT_THREE_D.rotateGlobe` is `0.5`
(`src/data/view-3d-options.ts:72`), so the autorotate branch is the default.

`stop()` also never nulls `Renderer`, `scene`, `camera`, `controls`, `mesh`, `material` or
`geometry`, and `render()` only bails on a truthiness check:

```ts
function render() {
  if (!Renderer || !scene || !camera) return;
  Renderer.render(scene, camera);
  renderThrottled();
}
```

So a surviving chain keeps calling `controls.update()` → the `"change"` listener registered at
`:385` / `:908` → `render()` against an already-disposed renderer: permanent CPU and GPU work after
the view is closed, plus the whole scene stays reachable.

**b. The WebGL context is never released.** `src/controllers/view-3d.ts:71-72` creates a **fresh
canvas** on every `open()`, and `:346` / `:874` build a `WebGLRenderer` on it. `stop()` calls
`Renderer.dispose()`, which only tears down three's own bookkeeping — `loseContext()` appears exactly
once in `public/libs/three.min.js`, inside `forceContextLoss`, and **`forceContextLoss` is never
called anywhere in `src/`, `public/modules/` or `electron/`**. The module-level `Renderer` is never
nulled either, so the detached canvas stays reachable.

Browsers cap live WebGL contexts (~16 in Chrome) and drop the oldest past that, so a handful of
open/close cycles degrades and eventually breaks WebGL for the whole page, while the GPU memory of
every earlier context stays allocated.

**Fix:** guard `animate()` with a running flag and reset it in `stop()`; null the module refs in
`stop()`; call `Renderer.forceContextLoss()` after `Renderer.dispose()`.

### 2. Elevation profile leaks a dialog wrapper on every mousemove

`src/controllers/elevation-profile.ts`:

```ts
function open(cells: number[], routeLen: number, isRiver: boolean): void {
  closeDialogs("#elevationProfile, .stable");   // :26 — excludes itself, so it stays open
  renderDialog();                               // :27
  ...
  function closeElevationProfile(): void {      // :564 — nested in open(): retains its whole scope
    $("#elevationProfile").dialog("destroy");
    ensureEl("elevationProfile").remove();
  }
}

function renderDialog(): void {
  document.getElementById("elevationProfile")?.remove();   // :571 — content only, no destroy
```

And the river editor re-opens it from inside a drag handler
(`src/controllers/river-editor.ts`):

```ts
redrawRiver();                                       // :222, inside event.on("drag", …)
...
if (findEl("elevationProfile")) showRiverElevationProfile();   // :248
```

`route-editor.ts:196` does the same. So while the elevation profile is open, **every mousemove of a
control-point drag** runs `open()` → skip the close sweep → raw-remove the live content element →
insert a new one → `.dialog()` creates a second wrapper. Each orphan holds the detached
`#elevationProfile` / `#elevationSVG` subtree and a `closeElevationProfile` closure over the whole
`open()` scope (`cells`, `chartData`).

The mechanism was reproduced against the repo's own vendored jQuery UI under jsdom: 200 raw
re-opens produce 200 connected `.ui-dialog` wrappers and 200 entries in
`document.data("ui-dialog-instances")`, and the detached content element survives forced GC. The
same 200 re-opens through `destroyDialog()` produce 1 wrapper and 1 tracked instance.

`_destroy` is the only code that removes the wrapper (`this.element...detach(), this.uiDialog.remove()`)
and it is reached only through `.dialog("destroy")` — exactly what `destroyDialog()`
(`src/components/dialog/dialog-helpers.ts:150-155`) does.

**Fix:** `destroyDialog("elevationProfile")` at `:571`, or stop excluding it at `:26` so a re-open
closes the previous instance first.

### 3. Custom good icons accumulate in the page-lifetime defs group

`src/controllers/good-editor.ts` writes each uploaded icon straight into `#good-icons`:

```ts
const id = `good-custom-${Math.random().toString(36).slice(-6)}`; // :523
const goodIcons = ensureEl("good-icons"); // :524
goodIcons.insertAdjacentHTML("beforeend", svg); // :527 (raster branch)
const icon = goodIcons.appendChild(svg);
icon.id = id; // :550 (SVG branch)
```

`#good-icons` is inside `<svg id="defElements">` (`src/index.html:2549`) — a separate SVG from
`#map`, so it is **not** part of the map SVG that gets replaced on load. On load, the saved icons
are appended to it again with no clear:

```ts
// src/services/io/load.ts:373-377
if (data[45]) {
  const goodIconsDefs = document.getElementById("good-icons");
  if (goodIconsDefs) goodIconsDefs.insertAdjacentHTML("beforeend", data[45]);
}
```

Nothing anywhere removes a `[id^="good-custom-"]` symbol — the only other readers are
`save.ts:123-124` (serialises all of them into `data[45]`) and `export.ts:415`. So every load of a
map that has custom icons appends another full copy of the set, and the next save persists the
duplicated set, so the growth compounds across load→save→load cycles. Raster icons are inlined
`data:` URLs (up to ~200 kB each), so this is unbounded growth in both memory and `.map` size.

`src/services/io/load.ts:140` already shows the correct pattern one branch away:
`ensureEl("coas").innerHTML = ""` before repopulating.

**Fix:** in `load.ts`, clear `#good-icons [id^="good-custom-"]` before inserting `data[45]`, and
remove the symbol when its good is deleted.

### 4. `GraphOverride` pins the previous world's vertices

`src/generators/graph-override.ts:17`:

```ts
private vertices: PackedGraph["vertices"] | null = null; // only pack.vertices can be changed for now
```

`reset()` (`:57`, `this.vertices = pack.vertices`) is the only writer and runs from
`movePackVertex` (`:30`) and `restore` (`:37`). `clear()` (`:52`) delegates to `reset()` but **has no
callers anywhere**.

`Pack.clear()` / `Pack.generate()` build a brand-new `pack.vertices`, so after the next generation
nothing else in the process keeps the old `{p: Point[], v: number[][], c: number[][]}` alive. On a
large map that is the single biggest object in the graph.

**Fix:** call `GraphOverride.clear()` where the world is replaced, next to `Pack.clear()` in the
generation pipeline and in `Services.Load.parseLoadedData`.

### 5. `HeightmapGenerator` keeps the old grid across a map load

`src/generators/heightmap-generator.ts`:

```ts
grid: any = null;
heights: Uint8Array | null = null;
private clearData() { this.heights = null; this.grid = null; }   // :22
setGraph(graph: GridGraph, ...) { ...; this.grid = graph; }      // :77-84
```

`clearData()` has exactly one caller — `generate()` at `:561`. `setGraph()` is called from
`heightmap-editor.ts:1147, 1395, 1413, 1683`, none of which clear afterwards. The map-load path
replaces the global (`services/io/load.ts:295 grid = JSON.parse(data[6])`) without touching
`HeightmapGenerator`, so the previous grid (points, cells `v/c/h/f/t/temp/prec`, vertices `p/v/c`)
stays pinned for the rest of the session.

**Fix:** clear both fields when the heightmap editor closes, and from the load path.

### 6. `sourcePack` in the goods and markets renderers pins the previous `pack`

`src/renderers/draw-goods.ts`:

```ts
let sourcePack: PackedGraph | null = null;
function buildScene(): void { ...; sourcePack = pack; }        // only write
function reconcileGoods(...) { if (sourcePack !== pack) buildScene(); ... }
```

`src/renderers/draw-markets.ts` has the same shape plus `sourceMarkets = pack.cells.market` (a large
`Uint16Array`) and a `territories` Map of derived paths.

The identity check is a legitimate cache invalidation, but nothing ever clears it. `Layers.draw()`
only draws a layer when it is active (`components/layers.ts:169`), and neither the `goods` nor the
`markets` layer registers an `erase` callback (`layers.ts:343-349`, unlike `rivers`, `emblems` and
`labels`). So: turn the goods layer on once, turn it off, generate a new map — `pack` is reassigned,
the layer never draws again, and the previous world's `pack` is unreachable from anywhere except
this module variable.

**Fix:** register an `erase` for both layers that nulls `sourcePack` / `sourceMarkets` and clears
`territories`, or hold a generation token instead of the pack itself.

---

## MEDIUM

### 7. Heightmap editor undo stack is unbounded and stores full-grid snapshots

`src/controllers/heightmap-editor.ts:862-890`:

```ts
function updateHistory(noStat?: string): void {
  const step = edits.n;
  edits = Object.assign(edits.slice(0, step), { n: step + 1 });
  edits[step] = grid.cells.h.slice();          // a full Uint8Array copy per step
  ...
}
function restartHistory(): void {
  window.edits = Object.assign([], { n: 0 });
```

`edits` is a plain array on `window` with **no length cap**. Every brush stroke, line, fill, smooth,
disrupt and rescale calls `updateHistory()`, so a long session grows by one `cells.length`-byte copy
per action (tens of KB each on a large map; thousands of actions → hundreds of MB). It is released
only when the user leaves the heightmap editor (`:458`) or re-opens it (`:49`).

The paint editor does this correctly and is the model to copy — `src/controllers/paint-editor.ts`
stores deltas and caps the stack:

```ts
const historyLimit = 100; // :61
activeState.history.push(entry); // :308
if (activeState.history.length > historyLimit) activeState.history.shift(); // :309
```

**Fix:** cap `edits` (drop the oldest snapshot past N), or store per-stroke cell deltas.

### 8. Thirteen more `renderDialog()` sites orphan their dialog wrapper

Same mechanism as finding 2, but reachable only by calling `open()` while that dialog is already
open. Each `open()` either excludes itself from `closeDialogs` or has no sweep at all, and then
`renderDialog()` raw-removes the live content element:

| file:line (raw remove)        | dialog               | repeat-open trigger                                  |
| ----------------------------- | -------------------- | ---------------------------------------------------- |
| `burgs-overview.ts:145`       | `#burgsOverview`     | Shift+T twice, `map-commands.ts:48`                  |
| `charts-overview.ts:386`      | `#chartsOverview`    | Shift+A twice, `map-commands.ts:192`                 |
| `markets-overview.ts:80`      | `#marketsOverview`   | `map-commands.ts:96`                                 |
| `market-overview.ts:83`       | `#marketOverview`    | `markets-overview.ts:151`, `viewbox-events.ts:46`    |
| `market-deals-overview.ts:92` | deals dialog         | `market-overview.ts:127` twice; no sweep in `open()` |
| `markers-overview.ts:54`      | `#markersOverview`   | Shift+K twice                                        |
| `military-overview.ts:57`     | `#militaryOverview`  | Shift+M twice, `map-commands.ts:114`                 |
| `military-overview.ts:632`    | `#militaryOptions`   | options button twice                                 |
| `minimap.ts:23`               | `#minimap`           | "Open Minimap" again from the omnibar                |
| `compare-prices.ts:70`        | compare dialog       | `goods-editor.ts:273`; no sweep in `open()`          |
| `production-chains.ts:153`    | production chains    | repeat open; no sweep in `open()`                    |
| `regiments-overview.ts:53`    | `#regimentsOverview` | `.stable` excludes it from `closeDialogs(".stable")` |
| `trade-details.ts:85`         | trade details        | repeat open; no sweep in `open()`                    |

**Fix:** replace `document.getElementById(id)?.remove()` with `destroyDialog(id)` in each
`renderDialog()`.

### 9. Journey travel timer can run away after its row is destroyed

`src/controllers/journey/journeys-overview.ts:169` re-renders the table body by removing the rows:

```ts
body.querySelectorAll(":scope > .states").forEach(row => { row.remove(); });   // :169
...
body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", stopJourneyTravel));  // :222
```

The travel animation is stopped by that row's `mouseleave` (`journey-travel.ts:20`, `:96-100`
re-arms itself with `window.setTimeout` and re-creates `#journeyTravel` in the persistent `#debug`
layer). Removing the row without firing `mouseleave` — which is what clicking its eye/lock/trash
buttons does, since they call `refresh()`/`renderJourneysPage()` — leaves the loop re-arming forever,
holding the `steps` closure (path `d` strings and `segment.points` references) and rebuilding DOM in
`#debug`.

**Fix:** call `stopJourneyTravel()` at the top of `renderJourneysPage()`.

### 10. Fonts accumulate an `<option>` and a `FontFace` per map load

`src/services/io/load.ts:271-279`:

```ts
const defaultFont = fonts.find(...);
if (!defaultFont) fonts.push(usedFont);
declareFont(usedFont);            // unconditional, every load
```

`declareFont` (`src/services/fonts.ts:271-278`) always appends an `<option>` to the static
`#styleSelectFont` (`:288-295`) and, when the font has a `src`, does `document.fonts.add(new FontFace(...))`.
Nothing ever removes an option and nothing ever deletes a `FontFace`. The `fonts` array itself is
correctly de-duplicated — only the DOM and `document.fonts` grow, so after N loads the user picks
from N duplicate entries and N font records (each holding its source, possibly an inlined data URI)
stay live.

**Fix:** track already-declared `family|src|unicodeRange|variant` keys and skip, or rebuild the select.

### 11. UI tour keydown listener is never removed on the normal exit paths

`src/services/ui-tour.ts:386` registers a `document` keydown handler on every `start()`. The only
removal is inside `onDestroyStarted` (`:45`), but `destroy()` in driver.js 1.4.0 is
`destroy: () => { g(!1) }` (`node_modules/driver.js/dist/driver.js.mjs:667-669`), and `g` only calls
that hook when its flag is truthy (`:595-596`). The two exits that go through `tour.destroy()` — the
last step's `onNextClick` (`:355`) and the Escape branch of `handleKeydown` itself (`:382`) —
therefore never run the cleanup. `start()` has no running-tour guard and three entry points
(`about-tab.ts:9`, `map-commands.ts:601`, `shell.ts:132`), so listeners and driver instances stack,
each retaining its overlay DOM and step closures.

**Fix:** move the removal into `onDestroyed` (which always runs) and add
`if (tour?.isActive()) return;` to `start()`.

### 12. Shadow-map target and globe background texture are never disposed

`stop()` (`src/renderers/view-3d-renderer.ts:114-140`) disposes `texture`, `geometry`, `material`,
`waterPlane`, `waterMaterial`, the erosion bake, the satellite and river-flow textures and the
labels. It never disposes:

- `spotLight.shadow.map` — a 2048×2048 render target configured at `:341-342` and enabled at `:346`
  (~16 MB), created whenever `shadowMap.enabled` is on;
- `scene.background` — the globe's star texture (`:868-871`).

`scene.remove(spotLight)` (`:133`) is not disposal: three never frees `light.shadow.map` on removal,
and `Renderer.dispose()` clears its own tracking map without releasing the textures.

**Fix:** in `stop()`, `spotLight?.shadow?.map?.dispose()` and
`(scene.background as THREE.Texture)?.dispose()`.

### 13. Globe redraw leaks a `SphereGeometry`

`src/renderers/view-3d-renderer.ts:980-987`:

```ts
function addGlobe3dMesh() {
  if (!scene || !material) return;
  geometry = new Three.SphereGeometry(1, 64, 64);   // previous geometry dropped, not disposed
  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
```

`redraw()` (`:98-105`) does `scene.remove(mesh)` and then, in globe view, rebuilds through
`updateGlobeTexure(true)` → `addGlobe3dMesh()`. The old `SphereGeometry` is overwritten without
`.dispose()`, and three frees GL buffers only on the geometry's dispose event, so each globe redraw
(resolution change, heightmap edit, `redraw()` from `lifecycle.ts:111`) leaks a 64×64-segment mesh
worth of buffers.

**Fix:** `geometry?.dispose()` before reassigning, and remove the old mesh.

### 14. Exported map clone is stranded in the document when an export step throws

`src/services/io/export.ts`:

```ts
const cloneEl = ensureEl("map").cloneNode(true) as SVGSVGElement;   // :258
cloneEl.id = "fantasyMap";
document.body.appendChild(cloneEl);                                 // :260
...
clone.remove();                                                     // :522 — success path only
```

There is no `try`/`finally`, and the ~260 lines in between await font fetching, image loading and
canvas work. Any rejection (most likely `loadFontsAsDataURI` → `fetch` at `src/services/fonts.ts:337`,
which throws offline) leaves a complete copy of the map DOM in `document.body` forever; `fantasyMap`
appears nowhere else, so nothing can clean it up. Repeated failures accumulate one full map SVG each.

**Fix:** wrap the body in `try { ... } finally { cloneEl.remove(); }`.

### 15. Select-Heightmap keeps a private copy of the graph

`src/controllers/heightmap-selection.ts:12-13`:

```ts
let graphConfig = getGraphConfig();
let graph = getGraph(); // structuredClone(grid), or a fresh Grid.generate(...) — :288-297
```

Module-scope, assigned at import time and reassigned on each `open()`, never nulled on
Cancel/Select/close. The dialog also renders a preview image per template against it, so a full
`GridGraph` is retained for the session after a single visit.

**Fix:** null it when the dialog closes, or scope it to `open()`.

---

## LOW

- **16. Anonymous listener stacks on a static file input.** `#fileInputs` (`src/index.html:729-743`)
  is permanent, and `burgs-overview.ts:228` adds a _new anonymous_ `change` handler on every
  `open()` → `renderDialog()`. (`cultures-editor.ts:188` passes the named `uploadCulturesData`, and
  `addEventListener` ignores duplicate `(type, listener, capture)` triples, so it is harmless;
  `notes-editor.ts:195-196` guards with `uploadBound`.) The handlers are small, and `uploadFile`
  clears `input.value` (`src/utils/fileUtils.ts:39`) so only the first does work — but the records
  accumulate forever. Prefer `onchange =` assignment, as `heightmap-editor.ts:276` already does.
- **17. Label-spread sandbox orphaned on a constructor throw.** `src/controllers/label-spread.ts:135`
  creates `new LabelMeasurementSandbox()` which appends its `<svg>` to `document.body` at `:475`,
  before the `try` at `:136`; `destroy()` runs only from the `finally` at `:152-154`. A throw in
  `createGroup` (`:544`) leaks one measuring SVG. Construct inside the `try`.
- **18. `applyLineHighlighting` cleanup bound to the wrong node.** `states-editor.ts:1609` binds it
  to the merge form inside `#alert`, but the `dialogclose` event is fired on `#alert` and bubbles
  _up_, so the `one("dialogclose")` cleanup never matches: 2 `#viewbox` listeners plus the detached
  form persist until the next Merge States open. Pass the `#alert` element.
- **19. Cancelled prompts leave `{once:true}` listeners.** `window.prompt`
  (`src/utils/commonUtils.ts:339-349`) adds a `submit` listener to the persistent `#promptForm`
  (`src/index.html:712`) on every call, removed only when it actually fires; Cancel (`:352-355`)
  just hides the dialog. So each cancellation leaves one listener capturing its `callback`, `input`
  and prompt nodes — and because the stale listeners are still registered, a later submit runs
  _all_ of them, calling every abandoned callback. `namesbase-editor.ts:124,130` has the same shape
  with `{once:true}` on `#namesbaseToLoad` (`:739`).
- **20. `#alert` retains the last military Apply closure.** `military-overview.ts:536-560` — the
  dialog's `buttons` closure captures `data`, which is derived from the live
  `pack.states`/`cultures`/`religions` arrays (`:419-421`), so one generation of those arrays stays
  alive until `#alert` is used again.
- **21. `mapHistory` grows without bound.** `src/components/lifecycle.ts:156-171` pushes one small
  record per map put on screen and nothing trims it. It backs the seed-history dialog, so it is
  intentional, but it should be capped.
- **22. Stale module-level slots in editors.** These hold the last-viewed `pack` entity or a
  detached SVG until the same editor is reopened: `rivers-overview.ts:94`, `routes-overview.ts:73`,
  `provinces-editor.ts:97`, `states-editor.ts:143`, `zones-editor.ts:40`, `religions-editor.ts:105`
  (the table holder in `table.ts:29,38`); `river-editor.ts:13`, `route-editor.ts:12`,
  `markers-editor.ts:11-12`, `ice-editor.ts:9`, `lakes-editor.ts:15`,
  `coastline-vertex-editor.ts:12`; and `hierarchy-tree.ts:38,49-50` via
  `religions-editor.ts:819-826`. Same for `trade-details.ts:19 activePoints`. Clearing them in the
  `close` handler is a one-liner each.
- **23. 3D teardown keeps two module-level objects.** `gridToPackCellMap`
  (`view-3d-renderer.ts:79`, one entry per grid cell) and the label-measuring 2D canvas (`:85`) are
  rebuilt on the next `createMesh`/`createTextLabel` but not cleared by `stop()`.
- **24. Emblem version cache never shrinks.** `src/renderers/emblems/renderer.ts:17` `versions` is
  keyed by `state|province|burgCOA<i>`; `remove()` (`:305`) only bumps the counter, never deletes.
  Bounded by the highest entity index ever seen.
- **25. `loadScript` never removes the tag.** `src/services/io/export.ts:888-896` (JSZip, per
  PNG-tiles export) and `src/services/io/cloud.ts:54-62` (Dropbox SDK, per connect) append to
  `<head>` and only resolve. Memoise per `src`, or `script.remove()` in `onload`.
- **26. Colour picker container outlives its editor.** `src/controllers/color-picker.ts:104,130-137`
  appends a container to `body` holding a callback into the calling editor; if the editor is closed
  while the picker is open the container (and that callback) survives until the next
  `ColorPicker.open`. Callers: `provinces-editor.ts:427`, `states-editor.ts:517`,
  `zones-editor.ts:322`, `religions-editor.ts:514`, `markets-overview.ts:351`.
- **27. Stale columns-picker listener.** `src/components/dialog/table.ts:348` adds a `document`
  mousedown handler that self-removes via `closePopup()`. If the dialog is destroyed while the
  picker is open (`provinces-editor.ts:119` calls `destroyDialog` in `renderDialog`) the
  `dialogclose` cleanup never fires — bounded to one stale closure, which then unregisters itself
  on the next mousedown.
- **28. Dead route-group style keys.** `src/controllers/route-groups-editor.ts:97` writes
  `styles.routes.groups["<name>"]` and never deletes it when the group is removed; one dead record
  per removed custom group (`labels-group-editor.ts` does delete its style keys).
- **29. Aborted line brush leaves a node in `#debug`.** `heightmap-editor.ts:1114` creates
  `line#brushCircle`; `exitBrushMode` (`:1070`) removes only `.lineCircle`.
- **30. `fromPrecreated` has no `img.onerror`.** `src/generators/heightmap-generator.ts:600-616`
  resolves only from `img.onload`; if `./heightmaps/<id>.png` is missing or blocked, the promise
  never settles, `this.grid`/`this.heights` stay set, and the awaiting caller waits forever.
- **31. Not a leak, a crash.** `burg-editor.ts:558` sets `previewSettleTimer`, cleared at `:557`
  and `:576`, but `closeBurgEditor` (`:836-841`) does not clear it — closing the editor within
  200 ms of a pan fires `commitPreviewTransform` against a removed dialog.

---

## Checked and cleared

These are the recurring patterns that _look_ like leaks but are not, so they need no re-checking.

- **Global listeners.** Only nine files register `window`/`document` listeners (`main.ts`,
  `utils/index.ts`, `components/hotkeys.ts`, `components/shell.ts`, `components/dialog/table.ts`,
  `controllers/omnibar.ts`, `controllers/journey/journey-path-editor.ts`, `services/platform.ts`,
  `services/ui-tour.ts`). All but the tour (#11) and the columns picker (#27) are one-shot,
  `{once:true}`, or `AbortController`-managed (`omnibar.ts` aborts in `cleanup()` at `:658-662`).
- **Re-applied pan/zoom handlers never stack.** `applyDefaultViewboxEvents()` and
  `applyZoomBehavior()` run from `boot()`, `services/io/load.ts:669` and ~20 editors and tools, and
  every one of them replaces the previous binding: d3-selection `.on(type, listener)` replaces the
  same `(type, name)` pair, `zoomBehavior.on("zoom"/"end")` is namespaced, and `drag()` uses the
  `.drag` namespace. The same is true for the `.on("click")` overrides in `map-placement.ts:25`,
  `annex-mode.ts:40` and every editor that arms a cell picker — all of which restore the defaults on
  exit.
- **`Layers.init()`** is find-or-create plus `append` (which moves), so it is idempotent from
  `initShell`, `restore` and `move`.
- **`ViewportLayers.register`** is only called at module scope; `Scene` instances are `replace`d or
  `invalidate`d through the matching layer `erase` (`labels`, `emblems`, `routes`, `relief`,
  `rivers`).
- **Timers.** `initiateAutosave` has one caller (boot) and its reminder interval is cleared by
  `toggleSaveReminder`; the `loadVoices` interval self-clears within 10 attempts; the help-assistant
  `retryTimer` is cleared on dialog close, on reuse and at countdown end; `labels-overview.ts:180`
  `searchTimeout` is cleared at `:161`/`:177`; `burg-editor.ts:558` is cleared at `:557`/`:576` (but
  see #31); `label-spread.ts` pairs `requestAnimationFrame` with `clearTimeout`;
  `versioning.ts`/`url-params.ts` use one-shot timeouts; the satellite water loop is single-flight
  and cancelled (`view-3d-renderer.ts:1016-1027`); `view-3d-renderer.ts:381`'s globe variant is the
  same pattern.
- **Electron.** There is no `ipcMain`/`ipcRenderer` anywhere in the repo, so recreating a window
  cannot stack IPC handlers. `initUpdater` is called once from `whenReady` and its
  `setTimeout`/`setInterval` are process-lifetime by design.
- **Object URLs.** Every `createObjectURL` has a matching `revokeObjectURL` (`save.ts:218`,
  `export.ts:90/136/216/527`, `export-json.ts:32`, `fileUtils.ts:29`, `view-3d-renderer.ts:625/854`,
  `charts-overview.ts:875`, `elevation-profile.ts:551/558`, `emblems-editor.ts:545/553`).
- **Generator state.** `religions-generator.ts:67 approaches` is a static config built once;
  the `routes-generator` connection/river caches and `production-generator.zoneCellSets` are reset
  at the start of every run; `goods`/`markets`/`markers` generator index caches are rebuilt per run
  and end pointing at the current pack; `pack-generator.ts:13` is a `WeakMap` keyed on
  `graph.cells.p`; `resample.ts:450 parentMap` is a local held only for the duration of `process()`.
- **Bounded dialog caches.** `dialog/state.ts entries` (one record per dialog id),
  `table.ts:198 dialogColumnsRegistry`, `dialog/highlighting.ts:3 cleanups` (self-deleting and
  guarded by `cleanups.get(id)?.()` on re-application) and `draw-emblems.ts:56 reconcileListeners`
  (unsubscribed at `emblems-editor.ts:737-738`) are bounded or properly released.
- **Columns picker table/sort bindings.** All 24 `initColumnVisibility` / `bindColumnSorting` /
  `applySortingByHeader` callers sit in `renderDialog()`-style functions that rebuild the DOM
  immediately before binding, so the header buttons are always fresh.
- **jQuery UI on the normal close path.** `closeDialogs()` uses `.dialog("close")`, which fires
  `dialogclose` before the `close` option callback, so `applyLineHighlighting`'s
  `one("dialogclose")` cleanup and the `close: closeX()` handlers that call `.dialog("destroy")`
  do run. The shared `#alert` dialog reuses its content element, so re-calling `.dialog({...})` is
  safe. `view-3d.ts:154` is a raw remove but is unreachable: `toggleOptions()` returns early when
  `#options3d` exists (`:135`).
- **Map-scoped state that is correctly reset.** `labels-overview.ts:56 listedLabels.clear()` at
  `:235`; `markers-in-radius.ts:14 inRangeMarkers = []` and `center = null` at `:205-206`;
  `spreadPreview.snapshot = null` at `:499`; `charts-overview charts[]` reset on map change (`:369`);
  `editingJourneyId` nulled (`:639`); `paint-editor` `state` nulled in `cleanup()` (`:351`);
  `bridge`/`battle-screen` `battle = null` (`:1400`, and its raw removes at `:83-84` are unreachable
  behind the `customization` guard).
- **Inline dialog HTML + element listeners** die with `destroyDialog` — every
  `insertAdjacentHTML("dialogs", …)` followed by `addEventListener` in the editors is on a freshly
  created node, because `renderDialog()` either calls `destroyDialog()` first (the correct ~40
  files) or removes the previous node (the ~15 files in finding 8, which is why they are listed).

## Method

Static audit, no runtime profiling. Five areas were read in full and in parallel
(`src/controllers` a–m + `journey/`, `src/controllers` n–z, `src/components`, `src/renderers`,
`src/services` + `electron` + `src/generators` + `src/utils` + `public/modules`), then every
reported finding was re-verified against the source. Three claims were falsified during
verification and are **not** listed: the Quill editor was asserted to leak per-instance `document`
listeners (its real document listeners are module-scope; `listenDOM` adds to a virtual list), the
columns-picker mousedown listener was rated MEDIUM (it self-removes, see #27), and
`regiments-overview.ts` was initially reported as _unaffected_ by the wrapper bug when it in fact
is (#8). The wrapper mechanism in findings 2 and 8 was reproduced in jsdom against the repo's own
vendored jQuery UI, comparing raw `.remove()` against `destroyDialog()`.
