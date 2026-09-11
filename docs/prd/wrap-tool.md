# PRD — Wrap Tool

Updated: 2026-09-10. This replaces the earlier, overly broad deformation proposal: the tool moves
packed-cell **vertices** only and leaves every other map object where it is.

## Problem Statement

Local shape adjustments were only possible on coastlines, one point at a time. The coastline vertex
editor opened on a coastline click, showed a handle per vertex, and moved a single vertex per drag
through `GraphOverride.movePackVertex`. That has three consequences:

- **Lake shores and inland cell boundaries could not be adjusted at all**, although they are the same
  packed-graph vertices behind a different renderer.
- **Reshaping a stretch of coast is dozens of individual drags**, each one a separate override record,
  a separate derived-area refresh, and a separate redraw.
- **There is no stroke-level history.** Undo granularity is whatever the surrounding editor offered,
  so experimenting is expensive.

The obvious answer — a general deformation tool that carries rivers, routes, burgs, labels, markers
and grid-derived overlays along with the geometry — is a much larger piece of work: FMG keeps graph
geometry and entity coordinates in separate representations, so "move everything coherently" means
touching every coordinate-owning module, cell picking, and the IO format. That proposal is shelved.

## Solution

A **Wrap Tool** Controller, opened from Tools → Create, that drags packed-cell vertices under a
circular brush with smooth falloff. The cell structure under the brush is drawn on the map and follows
the pointer while the map layers hold still; they redraw once the drag ends. It reuses the existing
graph override mechanism, so persistence, derived areas, and graph-rebuild compatibility come for free.

The tool is deliberately narrow: vertices move, nothing else does. Each vertex is capped relative to
its original position and local edge lengths, no cell may fold over itself or collapse, and the map
frame does not move. The dialog says as much:

> Use for small shape adjustments. Use the Heightmap Editor for significant changes. Other map
> objects stay in place.

The coastline **vertex** editor is removed with its coastline click handler and registry entry. The
coastline settings editor (`coastline-editor`) and the Style coastline controls are untouched.

The agreed product name is **Wrap Tool**. Watabou's reference calls the interaction "Warp".

## User Stories

1. As a map author, I want to open Wrap from Tools without selecting a coastline, so that I can adjust
   any part of the map.
2. As a map author, I want one drag to move every vertex under the brush, so that reshaping a stretch
   of coast takes one gesture instead of twenty.
3. As a map author, I want the same brush to work on a coastline, a lake shore, and an inland cell
   boundary, so that I do not switch tools by geometry type.
4. As a map author, I want displacement to fade toward the brush edge, so that the adjustment blends
   into the surrounding cells.
5. As a map author, I want to resize the brush with the wheel or `+`/`-`, and to see the size in the
   dialog, so that I can change the affected area without leaving the canvas.
6. As a map author, I want a brush outline and the cell structure under it, so that I see what a drag will
   affect before I commit to it.
7. As a map author, I want the structure to follow the pointer while I drag and the map to redraw when I let
   go, so that dragging stays responsive on a large map.
8. As a map author, I want undo and redo per stroke, so that experimenting is cheap.
9. As a map author, I want to reset the session, so that I can abandon an experiment and still keep
   edits made before the tool was opened.
10. As a map author, I want Escape to cancel an unfinished drag, so that an interrupted stroke leaves
    no partial edit.
11. As a map author, I want to zoom and pan exactly as I do outside the tool, so that I can reach and
    inspect the area I am editing without learning new gestures.
12. As a map author, I want the brush to stop rather than fold cells over themselves, so that I cannot
    accidentally produce broken polygons.
13. As a map author, I want to be told upfront that other map objects stay in place, so that I pick the
    Heightmap Editor for anything larger.
14. As a map author, I want hidden layers to reflect my edits when I show them, so that layer
    visibility does not change the result.
15. As a map author, I want closing the tool to keep my edits and restore normal interaction, so that the
    map is usable again immediately.
16. As a map author, I want edits to survive save, load, and export, so that the work is not throwaway.

## Implementation Decisions

Four files carry the feature: `src/controllers/wrap-tool.ts` (dialog, lifecycle, history, redraw),
`src/controllers/vertex-brush.ts` (vertex lookup, falloff, limits, geometric validation),
`src/renderers/overlays/vertex-mesh.ts` (the structure overlay), and `movePackVertices` / `revert` on
`src/generators/graph-override.ts`. The gestures are not the tool's own: they come from
`src/components/map-brush.ts`, the brush instrument shared with the paint editor (see below). Two
shared modules gain an entry: the Tools tab button and the `Shift + W` hotkey. No new dependency.

The controller follows [migration-guide.md](../architecture/migration-guide.md): a named export over
module-scoped `let` state, `open()` → `render()` → `addListeners()`, and a `cleanup()` wired through
the dialog's `close` so every node, listener and overlay it introduced is removed again. It owns its
markup — nothing for it exists in `index.html` — and is lazy-loaded through the Controllers registry.

### Controller and lifecycle

- Registered lazily as `WrapTool` in `src/controllers/index.ts`; the Tools tab opens it from
  the `openWrapTool` button in the Create group (`src/components/options/tabs/tools-tab.ts`), and
  `Shift + W` opens it from `src/components/hotkeys.ts`.
- `open()` is a no-op while `customization` is active (heightmap editing owns the graph) or while the
  tool is already open, and closes other dialogs first. It then **takes customization itself**
  (`CUSTOMIZATION_MODE = 18`, released in `cleanup()`), so for as long as the tool is open no other
  editor opens over it — neither by a map click nor by a shortcut, since every editor's `open()`
  guards on the flag.
- `render()` injects the dialog into `#dialogs` and `cleanup()` destroys it, per the dialog markup
  ownership convention. All listeners `addListeners()` attaches hang off one `AbortController`, aborted
  in `cleanup()`; the d3 drag behaviour and the cursor are dropped by `applyDefaultViewboxEvents()`.
- Opening pins a main tip — "Wrap tool: drag to reshape cells, Shift + drag to resize the brush" —
  and `cleanup()` clears it.
- The session is identified by the `pack.vertices` object captured at open (`source`). Every stroke,
  apply, and redraw path re-checks `source === pack.vertices`, so if a map is generated or loaded while
  the tool is open the session goes inert instead of writing into the new graph.
- Close keeps completed edits (they live in `GraphOverride`), drops session history and baseline,
  removes both overlays, and calls `applyDefaultViewboxEvents()` to restore the cursor and drop the
  drag behaviour. Reopening starts a fresh session.

### The shared brush instrument

`MapBrush` (`src/components/map-brush.ts`) is the brush every tool over the map should use: it owns the
size control's markup and id, the radius, the radius circle, and the gestures — drag, `Shift` + drag to
resize, `Space` + drag to pan, `+`/`-` through the hotkey module, and the crosshair — plus `attach()` /
`detach()`, which restores the default map events. A tool supplies only what a stroke does: `onStart`
returns the stamp for that stroke, so per-stroke state lives in a closure rather than in module scope.

Strokes come in two shapes. A **stamped** brush (paint, and the heightmap and relief brushes when they
follow) stamps every `spacing(radius)` units of pointer travel through `createBrushStroke`, so it paints
evenly regardless of pointer-event rate. A **continuous** brush (`spacing: () => 0`, which is Wrap) is
handed every pointer event instead. `onMove` and the circle are coalesced into one animation frame.

The wrap tool and the paint editor are both on it; `relief-editor` and `heightmap-editor` still carry
their own copies of this wiring and are the next candidates.

### Brush and controls

The dialog is a warning line, a radius slider, and a bottom row of icon buttons — the shape other
controllers use, with the standard history icons (`icon-ccw` undo, `icon-cw` redo).

| Control       | Behaviour                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Primary drag  | Moves vertices under the brush by pointer displacement × falloff. A click without movement is a no-op |
| Brush size    | `Shift` + drag on the map, the `+`/`-` keys, or `slider-input#wrapRadius` (1–200 map units)     |
| Brush outline | The shared `brush-circle` overlay on `#debug`, following the pointer                            |
| Structure     | The affected vertices and the cells they shape, drawn on `#debug` under the brush               |
| Undo / Redo   | One entry per stroke, `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`, disabled when unavailable   |
| Reset session | Restores the positions vertices had when the session started and clears its history; the tool stays open, customization included |
| Apply         | Commits the session and starts a fresh one without closing, so editing can continue             |
| Revert all    | `GraphOverride.revert()` behind a confirmation: drops every vertex edit on the map, undoable by nothing |

- Falloff is smoothstep on the normalised distance: `t = 1 - distance / radius`, weight `t²(3 - 2t)`,
  zero at the brush edge.
- **The map's own events are left alone.** The wheel still zooms, panning, hover tips, and click-to-edit
  behave exactly as outside the tool; opening an editor by clicking the map closes the Wrap Tool the way
  it closes any other dialog. The tool adds only a d3 drag behaviour on `#viewbox` (which stops the
  mousedown from reaching the zoom behaviour, so a stroke never pans the map), a crosshair cursor, and
  its own `mousemove` listener registered *alongside* the default one rather than replacing it.
- `Shift` + drag is a resize gesture (in `MapBrush`, so every brush tool has it): the brush grows by the
  pointer's travel in map units on both axes — right and up grow it, left and down shrink it — and
  nothing is painted, so it records no history. Shift is read once, at drag start, so a stroke never
  changes meaning halfway through.
- Space+drag pans; `keyup` and `window.blur` clear the Space state and cancel an in-flight stroke.
- **The tool is built for local edits.** The radius starts at 10 and goes down to 1 — well under a
  cell — so a small brush over one corner moves that corner alone. `data-key-step="1"` on the slider
  makes `+`/`-` step by one unit instead of the default five, and `Shift` + drag stays the fast way to
  cross the whole range.
- **`+`/`-` belong to the hotkey module, not the tool.** `hotkeys.ts` resolves the visible brush size
  input through one `getVisibleBrush()` helper (`wrapRadius` alongside the heightmap and paint brush
  inputs) and, when one is on screen, keeps the `Equal` family away from the rulers layer and the
  Measurers editor — `+` is `Shift`+`=` on a US layout, so it used to open Measurers mid-stroke. The
  helper also drives the `[`/`]` path, the step comes from the input's optional `data-key-step`, and
  setting a size dispatches an `input` event so the owning tool picks the new value up.
- The `keydown` handler is capture-phase and calls `stopImmediatePropagation`, so global hotkeys do not
  fire underneath it; it bails out early when the event target is an input, textarea, select, or
  contenteditable, keeping native text editing and native undo intact.
- The dialog is created with `closeOnEscape: false`: Escape cancels an active stroke, and closes the
  tool only when no stroke is running.
- Radius and falloff weights are frozen for the duration of a stroke — a `VertexBrush` captures the
  affected vertices, weights, and limits in its constructor.

### The structure overlay

`drawMesh(vertexIds)` renders the affected vertices as dots and the cells they shape as polygon
outlines into `#debug > #vertices`, reusing the styling the old coastline vertex editor left behind.
Stroke width and dot radius are divided by `viewport.scale`, so the structure reads the same at any
zoom. It is shown on hover for the vertices the brush would take (`findVertices`), and during a drag
for the stroke's frozen set, so the author watches the structure deform under the pointer.

The brush circle keeps up with a single-cell radius: its stroke is `non-scaling-stroke`, so it stays
one crisp screen width at any zoom, and its dash pattern is derived from the radius, so a radius-1
circle still reads as a dashed ring instead of one long arc.

Both overlays are painted in a `requestAnimationFrame` callback that coalesces pointer events, and
`#debug` is stripped from exports by `src/services/io/export.ts`.

### Geometry and displacement limits

`VertexBrush` owns all geometry. `findVertices` collects the movable vertices under the brush through
the cell quadtree (`Pack.findAll`) rather than scanning the whole graph; the constructor freezes their
weights and limits; `move(point)` proposes a displacement and commits what is valid.

- **Frame is fixed.** Vertices on or outside the map frame are never collected, and every proposed
  position is clamped to stay `FRAME` units inside it, so the map border cannot be dragged.
- **Per-vertex budget, clamped rather than rejected.** Each vertex may sit at most
  `max(BUDGET × its average original edge, its current distance from origin)` from its origin — the
  *original* position from the override record when one exists, so the baseline is stable across
  repeated strokes, reopening the tool, and save/load, and edits already loaded from disk are never
  silently clamped. A proposed position outside the budget is pulled back onto that circle. It is
  deliberately not a batch rejection: a single sliver-edged vertex used to hold the entire brush back,
  which capped a 130-unit drag at 0.6 units of movement.
- **Cells may not fold or vanish.** A proposal is rejected if any affected cell's signed polygon area
  flips sign or drops below `AREA_MARGIN` of the area it had when the stroke started. Cells are free to
  drift off their (fixed) centres — the earlier per-edge centre test is what made the brush feel stuck,
  and its only real benefit was keeping nearest-centre cell picking exact.
- **Binary backoff.** A proposed displacement is validated as one batch; if invalid it is halved, down
  to 1/1024, and the first valid fraction is committed. Successive pointer events keep pushing toward
  the same clamped target, so a stroke converges on the budget instead of stalling.
- These checks are intentionally local to the cells under the brush. There is no global deformation
  system, no re-triangulation, and no attempt to validate rendered smoothing or coastline roughness.

### Coastline stability

A brush is only usable if the coast reacts locally, and it did not: coastline fractalization drew its
displacements from one sequential Alea stream per feature and sampled the roughness envelope at
normalised perimeter position, so moving a single vertex re-rolled the whole island. Measured on a
60-vertex ring, one moved vertex changed 88% of the outline and the change reached the far side.

`coastline-generator.ts` now indexes the noise by geometry instead of by position in a sequence:

- **displacement** is `noise(seed, quantised endpoints, depth)` — a pure function of the segment, so an
  untouched segment keeps its shape whatever happened elsewhere. Coordinates are keyed to 1/64 of a map
  unit, below which a vertex move changes nothing at all;
- **roughness** is a two-octave value-noise field sampled at the segment midpoint, so it is a property
  of the place rather than of the distance travelled along the perimeter — there is no global
  parameterisation left to shift. Interpolated noise clusters around ½ where the harmonic profile it
  replaces was normalised over its whole range, so the field is spread by `FIELD_STRETCH` before the
  unchanged `** roughnessContrast` curve; that constant is what keeps the settings meaning what they
  did.

In the running app, a wrap stroke on one coastal vertex now changes 28 of 5587 path commands on the
feature it touches and leaves every other feature byte-identical.

The settings behave as before: measured over 24 islands of assorted sizes and positions, the length a
preset adds to an outline is within about 10% of the old algorithm — Default 6.3% → 6.5%, Rocky 17.1% →
16.9%, Fjords 12.3% → 13.0%, Archipelago 11.3% → 12.7%, Smooth 0.8% → 0.5%. Every threshold, amplitude
and preset value is unchanged; only `profileHarmonics` (zone count) became `roughnessScale` (zone size
in map units), which the load path fills from defaults for maps saved earlier — no migration needed,
since `parseSections` strips a setting the shape no longer has and repairs the missing one.

Every existing map's coast detail is still redrawn, since the noise itself is different — accepted
deliberately, in exchange for not carrying two fractalization paths forever.

A `variant` setting (0 by default) goes into the per-feature seed, so an author can reshuffle every
coastline on a map without touching the heightmap or the character of the coasts. Per-feature control
is the next step: a feature carrying its own `coastline` block would let one island or lake be tuned on
its own, and the generator is already shaped for it — `fractalize(points, seed, settings)` takes the
settings per call. What is missing is the feature record, the IO round trip and an editor entry point.
See [future-data-model.md](../architecture/future-data-model.md).

### Batched overrides

`GraphOverride.movePackVertices(points)` is the batch form of `movePackVertex`, which now delegates to
it. `revert()` replaces the unused `clear()`: it puts every moved vertex back at its generated position,
refreshes the derived areas and drops the records — the map-wide escape hatch behind the dialog's
confirmation, covering edits from earlier sessions and from the loaded file that session history cannot
reach. It records `[original, current]` per vertex, deletes the record when a vertex returns exactly to
its original position (so undo and reset leave no residue), and calls `refreshDerivedData` **once** for
the whole batch instead of once per vertex — a brush event touching 40 vertices refreshes each affected
cell area and feature area a single time. Nothing else about the override representation changes, so
serialization and `restore()` on a rebuilt graph keep working unchanged.

### Rendering

**Map layers are not redrawn while dragging.** During a stroke only the structure overlay follows the
pointer; the layers are redrawn once, at drag end — and on undo, redo, reset, and cancel, which are not
drags. `Layers.draw` is called with the layers built from packed-cell polygons: `landmass`, `coastline`,
`lakes`, `heightmap`, `cells`, `states`, `provinces`, `borders`, `biomes`, `cultures`, `religions`,
`zones`, `markets`, `goods`, `fogging`. Hidden layers are unaffected by the call and render from the
edited vertices when next shown.

Nothing else is redrawn, and the omissions are deliberate: `temperature` and `precipitation` are drawn
from the source grid, `population` bars stand on unmoved cell centres, `ocean` is pattern and texture
rather than geometry, and the entity layers (rivers, routes, burgs, labels, relief, markers, military,
journeys, ice, rulers) own coordinates the tool does not touch. `goods` is redrawn for its cell shading
only; resource icons and burg plates keep their positions.

### Applying and cancelling

Closing the dialog is cancelling, as in the paint editor: `cleanup()` moves every vertex still recorded
in `baseline` back. Apply does not close the tool — it empties `baseline` and the history, which commits
what is done and begins a fresh session, so the author can keep editing and still discard only what
comes next. There is no Cancel button: the dialog's own close button and `Escape` are the cancel path,
and no button should duplicate them. Committed edits are ordinary graph overrides, so Reset never
reaches past its own session — only Revert all does.

### History

- Session-only, in memory: an array of `{before, after}` vertex maps plus an index, capped at 50 entries
  with the oldest evicted. A new stroke after undo discards the redo branch.
- One drag is one entry, computed at drag end from the vertices that actually differ from their
  pre-stroke positions.
- `baseline` records the first pre-stroke position seen for each vertex in the session; Reset diffs the
  current graph against it, applies the difference and empties the history — the session starts over
  with the tool and its customization mode still in place. Apply clears the baseline instead, which is
  what makes the edits permanent.
- Cancelling a stroke (Escape, blur, or the start of undo/redo/reset) restores its `before` map.
- Close clears history, index, and baseline, after discarding the session unless it was applied.
  History is never persisted.

### Coastline vertex editor removal

`src/controllers/coastline-vertex-editor.ts` is deleted, along with its `CoastlineVertexEditor` registry
entry and the `coastline` entry in the `GRAND_EDITORS` map in
`src/components/viewbox-events.ts` — clicking a coastline no longer opens an editor.
The coastline settings editor, the coastline generator and renderer, Style's coastline controls, saved
coastline groups and their appearance are all untouched; no style schema is migrated and no group
management is rewritten as part of this story.

## Testing Decisions

- **`VertexBrush` geometry** — new focused tests on small synthetic graphs: `findVertices` returning the
  vertices inside the radius and excluding frame ones; falloff weight at centre, mid-radius, and edge;
  a tight-budget vertex clamped to its own limit while its neighbours move on; the budget holding across
  repeated strokes and after a simulated save/load (override record present); a fold rejected; the
  backoff committing a reduced displacement; non-finite pointer input rejected.
- **`GraphOverride` batching** — extend `src/generators/graph-override.test.ts`:
  `movePackVertices` records originals for a batch, drops the record when a vertex returns to its
  original position, and refreshes each affected cell/feature area once per batch. The existing cases
  for original/custom values, derived areas, and restoration against a rebuilt graph stay green.
- **History** — stroke, cancel, undo, redo, branch, reset, and eviction restore exact vertex positions
  and leave no override records behind after a full undo.
- **Manual browser pass** (done for this change): opening sets `customization` and `Shift + B` no longer
  opens the Biomes editor; a radius-2 brush at 12× zoom marks exactly one vertex and three cells and
  the dashed outline stays legible; a stroke closed with the dialog's close button or `Escape` leaves
  the graph untouched while Apply keeps it; `Shift` + drag up 60px takes the radius 20 → 80 and down
  40px takes it back to 40, moving nothing; Reset drops 17 moved vertices and disables undo, redo and
  itself while the tool and `customization` stay in place; Apply commits a stroke, leaves the tool open
  and resets the buttons, and a later stroke is discarded on close while the applied one survives; the
  paint editor on the shared brush still selects on click, paints 14 cells along a drag, commits them on
  Apply, and gains `Shift` + drag resizing; `Shift + W` opens the tool and pins the hint; `+`/`-`
  move the radius 40 → 45 → 35 with the rulers layer untouched and no Measurers editor; `Shift` + drag
  takes the radius 40 → 70 and moves no vertex; Revert all shows its confirmation and restores all 247
  vertices a stroke had moved; the structure appears under the brush on hover; the
  map layers are byte-identical mid-drag and change at drag end; a 130-unit drag at radius 40 moves the
  worst-limited vertex to its full budget (~20 units on an 11-unit-spacing map, against 0.6 before);
  undo, redo, and reset each restore the vertex set exactly; the wheel zooms and leaves the radius at
  40; closing removes both overlays and restores the default cursor, click, and drag handlers.
- Run the focused Vitest tests, lint, and build. Do not run Playwright automatically.

## Acceptance Criteria

1. Tools → Wrap Tool opens one dialog with a radius slider, an icon row of undo, redo, reset, and revert, and
   the small-adjustments guidance.
2. Hovering shows the vertices and cells the brush would affect; dragging deforms that structure live.
3. The brush moves vertices on coastlines, lake shores, and inland cell boundaries alike, and a drag
   moves them far enough to reshape a coast in one stroke.
4. Map layers do not redraw during a drag and are redrawn once when it ends.
5. Zoom, pan, hover tips, and click behave exactly as they do with the tool closed; the wheel zooms and
   never resizes the brush, `Shift` + drag resizes it and moves nothing, and `+`/`-` resize it without
   toggling the rulers layer or opening the Measurers editor.
6. `Shift + W` opens the tool, a pinned tip states how to drag and how to resize, and while it is open
   no other editor can be opened by click or shortcut.
7. Revert all asks for confirmation and, once confirmed, restores every vertex on the map and empties
   the session history.
8. Undo, redo, and reset restore vertex positions exactly; edits present before the session survive
   Reset, which clears the history and leaves the tool open; Apply commits and keeps the tool open; the
   close button and `Escape` discard whatever followed the last Apply.
9. A brush of radius 1–3 affects a single vertex, `+`/`-` step it by one, and the brush outline stays
   legible at that size.
10. Limits hold across repeated strokes, reopening the tool, and save/load: no cell folds over itself or
   collapses, and no vertex leaves the map frame.
11. Only packed vertices, the derived cell/feature areas, and the override records change. Every other
    map record is byte-identical after a stroke and after undo.
12. The coastline vertex editor, its registry entry, and the coastline click handler are gone; coastline
    settings and Style controls remain available; no references to the removed module remain.
13. Focused geometry, override, and history tests pass, along with lint and build.

## Documentation

`docs/wiki/Wrap-Tool.md` is the user-facing guide (what the tool moves and what stays put, the brush
gestures, the buttons, and when to reach for the Heightmap editor instead), linked from `Home.md`.
`Hotkeys.md` gains `Shift + W` and the tool's in-session keys. The Knowledge Base drops both Coastline
Editor answers — one becomes "How do I fine-tune the shape of a coastline, lake shore or border?" — and
gains "How do I change the heightmap on a small scale?" and "How do I change borders on a small scale?",
each pointing at the right tool for the scale of the change.

## Out of Scope

- Moving anything but packed vertices: cell centres, burgs, rivers, routes, labels, markers, relief,
  military units, journeys, ice, measurers.
- Creating or removing land, water, cells, or features; changing heights, adjacency, feature membership,
  or any generated attribute.
- Changing the source grid, the map schema, IO, or the override representation beyond the batch method.
- Polygon-aware cell picking. `Pack.findCell` remains nearest-centre, and since cells may now drift off
  their centres, a click near a heavily moved boundary can resolve to the neighbouring cell.
- A strength control, wheel-driven brush resizing, additional brush modes (smooth, inflate, pinch,
  rotate), a global deformation system, an application-wide history system, or history in the map file.
- Style/coastline group management changes, and any redraw or validation of rendered smoothing and
  coastline roughness.

## Further Notes

- Known accepted limitation: because entity coordinates stay put, a large stroke can visibly separate a
  coastline from a port, a river mouth, or a relief icon. The dialog warns about it and the displacement
  budget keeps it small; carrying entities along is the shelved broader proposal.
- Watabou's [Warp tool devlog](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/22794/052-warp-tool)
  is the interaction reference. FMG's separate graph and entity coordinate representations are exactly
  why the equivalent "everything follows" behaviour is not in this story.
- `BUDGET` (3 average original edges), `AREA_MARGIN` (25% of the stroke-start cell area), `FRAME`, the
  1/1024 backoff floor, and the 50-entry history cap are tuning constants in `vertex-brush.ts` and
  `wrap-tool.ts`; they can be adjusted against representative maps without changing the design.
- The structure overlay reuses the `#vertices` group and its `public/index.css` rules, which the removed
  coastline vertex editor left behind — no new CSS, so no cache-busting bump.
