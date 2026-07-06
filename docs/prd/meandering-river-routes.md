# PRD — Meandering River Routes

## Problem Statement

Navigable-river routes (the `searoutes` group, as extended by [navigable-river-routes.md](./navigable-river-routes.md)) reach inland burgs by allowing the sea-route pathfinder to walk river cells. The pathfinder finds the right cells, but the rendered route line and the trade animation only know cell centers — straight chords connected by Catmull-Rom smoothing. A river that wiggles east-west between bend cells gets cut by a route that goes straight down its long axis.

Visible consequences:

1. **Routes leave the river polygon.** Even at modest river width, a chord between bend cell centers exits the visible river polygon at the outside of every meander. The dashed sea-route line ends up drawn over land, alongside the river instead of inside it. The screenshot accompanying this PRD shows this clearly.
2. **Trade animation does the same.** The ship marker travels in straight diagonals between cell centers, ignoring the river's actual course.
3. **Lakes and open water still look fine** because cell-center chords through open water match user expectations; the problem is specific to the river-following sub-stretches of a route.

The river renderer already solves the geometry problem: [RiverModule.addMeandering](../../src/generators/river-generator.ts:372) inserts 0–2 perpendicular interpolation points per cell-pair, producing the curved polygon the user sees. Routes don't reuse it.

## Solution

Reuse `addMeandering` on the river-following sub-stretches of every sea route. The route line and the trade animation curve along the same geometry the river polygon uses, with matching meander phase, so the route stays inside the river.

The function moves from `RiverModule` to `src/utils/pathUtils.ts` as a pure helper under the name `meander`. Its signature is generalised: it returns geometry plus anchor-position metadata, with the third-coordinate convention left to the caller. River-polygon callers pass a `flux`-supplier, route callers pass a `cellId`-supplier; the function itself doesn't know about either.

The route generator augments its existing `riverAdjacency` map into a direction-aware `riverEdges` map. When emitting route points, it walks the cells of each sea route, groups maximal runs of cells that share a river edge, calls `meander` once per run (in the river's source→mouth order so perpendicular meanders point the right way, with a `startStep` that matches the river polygon's phase), and reverses the per-run output if the route traverses mouth→source. Non-river cells emit a single anchor as today. Trade animation does the same in its path reconstruction.

No new persisted data. No `.map` schema change.

## User Stories

1. As a map author, I want the sea-route line drawn for a river burg to lie inside the river polygon along the whole navigable stretch, so the map reads as "boats go down the river" not "boats hike beside it".
2. As a map author, I want the route's curve to match the river's curve exactly (same bends, same phase), so the eye doesn't catch a divergence between the two lines.
3. As a map author, I want the trade animation's ship to follow the same curve, so the animation tracks the line the user sees.
4. As a map author, I want a route that starts mid-river and exits to the sea to curve along the river segment and then run straight through open water, so each sub-stretch is rendered with the geometry that suits it.
5. As a map author, I want routes traversed upstream to render identically to downstream, so the same edge looks the same regardless of which burg I read it from.
6. As a map author, I want lake transits to keep their existing straight-chord rendering, so this change doesn't disturb open-water sections.
7. As a map author, I want existing `.map` files to keep loading and re-render with the new curves automatically, so the upgrade is invisible.
8. As a developer touching route or river rendering, I want a single meandering helper used by both, so geometry bugs are fixed in one place.
9. As a developer reading the route generator, I want the river-segment splicing to be a single named helper, not a flag scattered through `getPoints`, so the code stays followable.
10. As a developer writing tests, I want the meandering function to be unit-testable as a pure function with no `pack` global, so test setup stays minimal.

## Investigation: Why The Current Route Geometry Cuts the Bends

### Symptom

A sea route whose cells follow a navigable river is rendered as a Catmull-Rom curve through the cells' anchor points. The anchor points are either cell centers (`pack.cells.p[cellId]`) or burg coordinates (`{burg.x, burg.y}`). Between two consecutive river cells, the route is a smooth chord — but the chord is the _straight_ path between centers, not the meandering path the river polygon takes.

### Root cause

Three things converge:

**1. River meanders are not in the data model.**  
[RiverModule.defineRivers](../../src/generators/river-generator.ts:191) stores `river.cells: number[]` and an optional anchor override `river.points?: Point[]` (used by the river editor). Neither carries the meander interpolation. The visible meander is computed at draw time by [addMeandering](../../src/generators/river-generator.ts:372) and discarded after every render. Storing it would bloat saves without buying anything callers can't recompute.

**2. The route generator doesn't ask the river module for geometry.**  
[RoutesModule.getPoints](../../src/generators/routes-generator.ts:464) takes the route's cell list and maps each to its anchor (`pointsArray[cellId]`). No call into river code; no awareness that a sub-sequence of those cells is actually a river course.

**3. `riverAdjacency` knows pairs but not direction.**  
[RoutesModule.buildRiverAdjacency](../../src/generators/routes-generator.ts:183) records `Map<cellA, Set<cellB>>` — enough for the cost function to enforce "the next step must be along a river course", not enough to recover which river the edge belongs to or which direction is downstream. Without those, the route generator can't call `addMeandering` in a way that matches the river polygon's perpendicular direction.

### Why naively calling `addMeandering(routeCells)` is wrong

`addMeandering`'s perpendicular direction is `(sin α, cos α)` where `α = atan2(y_next − y_curr, x_next − x_curr)`. Reversing the input cells negates both sine and cosine, putting the interpolation point on the _opposite_ side of the river. A route boating upstream would meander on the bank opposite the river polygon. The amplitude term `meander = 0.5 + 1/step + max(0.5 − step/100, 0)` is also `step`-dependent; a slice fed in with step starting at 1 (or 10) has different amplitudes than the same cells inside a longer river that's already at step 18 by the time it reaches them. Both quirks have to be neutralised for the route to overlay the river polygon cleanly.

### Why the cost function isn't enough

The pathfinder already restricts route hops to river-adjacent steps along the actual course. That guarantees the route's _cells_ are right. Rendering is a separate concern: the right cells with the wrong interpolation still draw outside the river.

## Implementation Decisions

### `addMeandering` moves to `pathUtils` and becomes pure

Current shape: an instance method on `RiverModule` that reaches into `pack.cells.fl`, `pack.cells.h`, `pack.cells.p`, `graphWidth`, `graphHeight`. Three callers exist ([layers.js drawRivers](../../public/modules/ui/layers.js:816), [rivers-editor.js](../../public/modules/ui/rivers-editor.js), [export.js](../../public/modules/io/export.js:587), [rivers-creator.js](../../public/modules/ui/rivers-creator.js), [resample.ts](../../src/generators/resample.ts:35), [tools.js](../../public/modules/ui/tools.js:789)). New shape:

```ts
// src/utils/pathUtils.ts
export type Meandered = {
  points: Point[];          // [x, y][] — the full curve including interior meander points
  anchorIndices: number[];  // anchorIndices[k] === index in points[] where input cells[k] sits
};

export type MeanderOptions = {
  anchors?: Point[];        // override default cell-center anchors; same length as cells
  meandering?: number;      // default 0.5
  startStep?: number;       // default: 10 if anchor[0] is on land, else 1
  bounds?: {                // for resolving cells[i] === -1 (off-map exit)
    width: number;
    height: number;
    fallbackPoint: Point;   // the on-map cell adjacent to the -1 marker
  };
};

export const meander = (
  cells: number[],
  cellPositions: Point[],   // pack.cells.p, passed explicitly — no globals
  options?: MeanderOptions
): MeanderedGeometry;
```

Pure: takes everything it needs as arguments, returns geometry and anchor metadata. No `pack`, no `grid`, no `graphWidth`.

Callers attach their third coordinate themselves:

- **River polygon** ([RiverModule.getRiverPath](../../src/generators/river-generator.ts:470) consumers): map `points[]` → `[x, y, flux][]` by using `anchorIndices` to know which entries are anchors and looking up `pack.cells.fl[cells[k]]` for each.
- **Routes**: map `points[]` → `[x, y, cellId][]` the same way, using `cells[k]` as the cellId for anchors. Interior meander points carry the _preceding_ anchor's cellId, so [RoutesModule.buildLinks](../../src/generators/routes-generator.ts:198) sees `cellA, cellA, cellA, cellB, cellB, ...` and its `cellId !== nextCellId` guard naturally skips duplicates without needing a sentinel value.

`RiverModule.getRiverPoints` and `RiverModule.getBorderPoint` move with `addMeandering` (they're its helpers). `RiverModule.getRiverPath` stays put; it gains a tiny adapter at top to walk the new `{points, anchorIndices}` shape.

A thin re-export `Rivers.addMeandering = (cells, points?, meandering?) => …` can be kept temporarily as a back-compat shim if migration of all callers in one pass is unwelcome; otherwise it's removed and all six call sites are updated. The PRD recommends updating all sites — six locations, mechanical change, simpler end state.

### `riverEdges` replaces `riverAdjacency`

New shape on `RoutesModule`:

```ts
private riverEdges: Map<number, Map<number, { riverId: number; fromIndex: number }>>;
```

Built in the same single pass that `buildRiverAdjacency` runs today, with two values stored per edge instead of just membership. `fromIndex` is the position of cell `cellA` in `river.cells`; the next cell `cellB` sits at `fromIndex + 1` (downstream direction). The downstream direction is `cells[fromIndex] → cells[fromIndex + 1]`; if a route step is `cellB → cellA`, the metadata is found under `riverEdges[cellB][cellA]` with `fromIndex = indexOfCellB`, and we know the route is going upstream relative to the river.

The cost function in [getWaterPathCost](../../src/generators/routes-generator.ts:304) and the approach guard in [findPathSegments](../../src/generators/routes-generator.ts:356) keep working — they only need `riverEdges.get(current)?.has(next)`, which still works because the inner `Map<cellB, …>` answers `.has()`. Two-line change at most.

### `addMeandering` helper

New private method on `RoutesModule`:

```ts
private addMeandering(
  cells: number[],
  anchors: Point[]   // one per cell; burg coords substituted where applicable
): [number, number, number][];   // [x, y, cellId]
```

Algorithm:

1. Walk `i = 0 … cells.length`.
2. At each `i`, look up `riverEdges.get(cells[i])?.get(cells[i+1])`.
3. If found, extend the run: continue while `(cells[j], cells[j+1])` edges all share the same `riverId` _and_ are contiguous in that river (`indexInRiver` strictly monotonic in the river's direction — same step of +1 or −1 every time). Confluence cells, where the run would switch rivers, terminate the run; the second river starts the next run.
4. For a run of length ≥ 2:
   - Determine the route's direction relative to the river (downstream vs upstream).
   - Build the canonical-order slice: if downstream, pass `cells.slice(i, j+1)` and the corresponding `anchors.slice(...)`; if upstream, reverse both.
   - Compute `startStep = 10 + indexInRiverOfFirstCellInCanonicalOrder` so the meander amplitude matches the river polygon at exactly these cells.
   - Call `addMeandering(canonicalCells, canonicalAnchors, { startStep })`.
   - If the route was upstream, reverse the returned `points` and re-derive `anchorIndices` accordingly. Tag the third coord with cellIds (anchor = its own cellId, interior = preceding anchor's cellId).
   - Append to the output, skipping the first anchor if it was already emitted by the previous run (avoid duplicating boundary anchors).
5. For a single cell (no river edge to the next, or first/last cell of the route), emit `[anchors[i][0], anchors[i][1], cells[i]]`.

Run termination at confluences is critical for user story 4 from the prior PRD: a route should walk the tributary to the join, then switch to the parent stream and continue. Each "river run" is one river only; confluence is a clean handoff point because the cell appears as the last cell of run N and the first cell of run N+1, contributing one anchor to each.

### Where `addMeandering` plugs in

[RoutesModule.getPoints](../../src/generators/routes-generator.ts:464) becomes the sole hook for `searoutes`:

```ts
if (group === "searoutes") {
  return this.addMeandering(cells, anchorsFor(cells, pointsArray));
}
// roads/trails branch unchanged (still does sharp-angle resolution)
```

`anchorsFor(cells, pointsArray)` just builds the per-cell anchor array using burg overrides — same logic as today's [preparePointsArray](../../src/generators/routes-generator.ts:455), reused here.

Sharp-angle resolution stays disabled for `searoutes` (its existing guard) — the new geometry doesn't need it.

### Trade animation integration

[TradeAnimationModule.buildPathResult](../../src/renderers/trade-animation.ts:196) reconstructs an array of cell ids from the A\* result, then maps each cell to a point via `getPoint(cellId)`. Replace that with a call to a shared meander pass:

```ts
const anchors = cells.map(cellId => getPoint(cellId));
const meandered = Routes.addMeandering(cells, anchors); // expose helper
```

Then iterate `meandered` to build the typed `segments` (land vs water). The land/water split already comes from `waterEdges[i]` per cell-pair; interior meander points belong to whichever cell-pair they're between, so each interior point inherits the surrounding pair's segment type.

Easiest implementation: build the typed-segment partition over `cells` first (as today), then expand each segment by replacing its internal cell-anchor sequence with the meandered version. Water segments expand into meandered geometry where they coincide with river edges; land segments are untouched.

`addMeandering` is promoted from private to public (or co-located in pathUtils alongside `addMeandering`) so trade-animation can call it without poking into routes internals.

### `buildLinks` and other consumers of `point[2]`

`buildLinks` reads `point.map(p => p[2])` as cell ids and skips `cellId === nextCellId` pairs. With interior meander points carrying the preceding anchor's cellId, the array looks like `[A, A, A, B, B, C, …]`. The dedupe guard already handles this; no change to `buildLinks`. The `connect`, `getRoute`, `remove`, `mergeRoutes`, `getRouteSegments` paths either work on anchor-only cell arrays or iterate point geometry without caring about anchor-ness — none break.

### Sentinel-free design

The third coord on `points: [x, y, cellId][]` stays a real cell id everywhere. No `0` or `-1` sentinel for "interior meander point". `buildLinks` continues to work without changes by virtue of the dedupe guard.

### Order of operations

`RoutesModule.generate()` runs after `RiverModule.generate()`; `addMeandering` runs inside `getPoints()` which runs after the A* pathfind. All inputs (`pack.rivers[*].cells`, `pack.cells.p`, the cost-function-built `riverEdges`) are populated by the time it's called. No new ordering constraint.

`Routes.sync()` (called on map load) already calls `buildRiverAdjacency`; that becomes `buildRiverEdges`. Routes are not re-laid out on sync — only the river-edge graph is rebuilt — so meander geometry stays as it was saved in `route.points`. On the next `generate()` (manual regeneration), the new geometry is produced.

### What is _not_ changed

- `Route` interface: `points: number[][]` shape is unchanged; just denser along navigable-river segments.
- River polygon rendering: identical pixels; the move to `pathUtils` is a refactor that preserves output.
- `riverAdjacency`'s consumers: only `RoutesModule` reads it; rename is internal.
- Trade animation's switch-cost logic, port-as-switch-point check, batch handling.
- The `searoutes` style entry, group label, name generation.
- Lake transits: still cell-center chords (no river → no meander).
- River source `.map` schema and burgs schema.

## Testing Decisions

Tests follow the existing Vitest pattern in `src/generators/*.test.ts` and `src/utils/*.test.ts`. `addMeandering` becoming pure makes its tests trivial — no `pack` fabrication needed.

**`pathUtils.addMeandering`** (new file `src/utils/pathUtils.test.ts` additions):

- Returns one entry in `anchorIndices` per input cell, with `anchorIndices[0] === 0`.
- Anchor positions in the output equal the input anchor positions (interpolation does not move anchors).
- Reversing the input cells produces an output whose anchor sequence is reversed and whose interior points lie on the opposite perpendicular side (i.e. mirror symmetry that the caller is expected to compensate for by feeding canonical order).
- `startStep` shifts amplitude as expected: cells fed at `startStep = 10` and again at `startStep = 30` produce identical perpendicular direction, smaller amplitude in the latter.
- `bounds.fallbackPoint` correctly resolves an off-map (`-1`) entry to the nearest map edge.

**`RoutesModule.addMeandering`**:

- Route along a single river produces anchors at every input cell and interior meander points between them.
- Route that exits the river into open sea splits cleanly: river segment is meandered, sea segment is straight (one anchor per cell, no interpolation).
- Route traversed upstream (cells in mouth→source order) produces points that, when re-reversed, match the downstream traversal — i.e. the same line, regardless of direction.
- A run that passes through a confluence is split into two runs at the confluence cell, each meandered on its own river; no interior point is emitted "across" the river switch.
- Burg cells in the run anchor at burg coords, not cell centers.
- A route with no river-edge cells (pure open-sea route) returns the same `[x, y, cellId][]` it would have produced under the old `getPoints`.

**`RoutesModule.buildLinks` invariants**:

- Routes with interior meander points still produce links exactly between consecutive anchor cell ids — no spurious `cellId → cellId` self-link from the interior.

**`TradeAnimationModule.buildPathResult`**:

- A trade path whose cells coincide with a river produces an animation curve identical (up to anchor positions) to the rendered route's curve.
- Land segments in the typed-segment partition are unaffected by the meander insertion.

**Visual / manual regression** (not unit-tested):

- Open a fixture map with a navigable river and verify the dashed sea-route line lies inside the rendered river polygon along the navigable stretch.
- Confirm the trade animation ship rides the river curve.

## Out of Scope

- Persisting meandered geometry in `.map` saves. Recomputation on regenerate is cheap.
- Visual distinction between river-following sea routes and open-water sea routes (still one `searoutes` group).
- River-aware behaviour for `Routes.connect()` on isolated cells. (Out of scope in the prior PRD; remains out of scope.)
- Meandering for roads/trails. (Land routes have no river analogue; their sharp-angle resolution stays as-is.)
- A user-tunable meander factor per route or per river.
- Touching `addMeandering`'s mathematical model (amplitude formula, interior-point count rules). The refactor preserves output exactly for river-polygon callers.
- Updating the rivers editor UI; it continues to call the (re-exported) function and re-render rivers on edit. Routes are not re-meandered until `Routes.generate()` is re-run, which the editor doesn't trigger.

## Further Notes

- Phase-matching via `startStep` is what makes this elegant rather than approximate. Without it, a route slice would meander at "fresh" amplitude while the river polygon at the same cells is at "settled" amplitude; the route would visibly wiggle wider than the river is wide at the upstream end of every run.
- Canonical-order feeding (source→mouth, then reverse-if-needed) is the only way to keep the perpendicular direction consistent between route and river polygon. The reverse step is cheap (a single array reverse).
- Confluence handling falls out for free from "run termination when `riverId` changes". The confluence cell appears as the last cell of one run and the first cell of the next; each run's `addMeandering` call sees it as a boundary anchor; no special case.
- The cell-id preservation in `point[2]` (anchors carry their own id, interior carries the preceding anchor's id) means `buildLinks` and every other consumer of `route.points` keeps working without a sentinel discriminator. If a future feature wants to distinguish anchors from interior points at read time, it can carry a parallel boolean array; that's a strictly additive change.
- Moving `addMeandering` to `pathUtils` opens the door for any future generator (canals, aqueducts, scenic trails) to reuse the same curve without depending on `RiverModule`. The function genuinely belongs with `findPath`, `getVertexPath`, and the other graph-geometry helpers already in that file.
- The `riverEdges` map is built in O(total river cells) on each `Routes.generate()` and `Routes.sync()`, same complexity as today. Memory is one `Map` entry per directed river edge — bounded and small.
- Trade animation already does its own A\* over `pack.cells.routes`; sharing the geometry helper (not the routing) keeps the animation's logic intact while fixing the rendering.
