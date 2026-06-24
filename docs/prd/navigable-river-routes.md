# PRD — Navigable River Routes

## Problem Statement

Sea routes today only traverse water cells, so a major river running deep inland — the kind that historically carried more cargo than coastal shipping ever did — gets no transport network. River burgs sitting on a 1000 m³/s waterway are treated identically to a burg on a dry hillside: connected by trails only.

Two consequences for the user:

1. **Inland trade is invisible.** A burg on the navigable stretch of a great river has no marine connection to the coast or to other river burgs, so trade animation and connectivity rates miss the most important commercial axis of any river basin.
2. **Closed lakes have no ports.** Burgs on the shore of a closed (endorheic) lake are detached from any sea network. Real-world analogues like the Caspian or pre-canal Great Lakes have their own self-contained shipping networks; the generator can't represent that today.

## Solution

Extend the existing `searoutes` route group so sea-route pathfinding can also traverse navigable river cells along the actual river course. River burgs above a flux threshold get folded into the sea-route Urquhart graph by widening the meaning of `burg.port` from "adjacent sea/lake feature" to "final reachable water body" — the body the burg can reach via continuous navigable water.

A burg on a river that drains into the ocean ends up grouped with coastal sea ports of that ocean. A burg on a river that drains into a closed lake ends up grouped with other ports of that lake, forming an isolated lacustrine network. The route group label, the renderer, and the trade animation are unchanged.

## User Stories

1. As a map author, I want river burgs on a navigable river to be connected by sea routes that follow the river course, so my inland cities participate in trade.
2. As a map author, I want those river routes to follow only the real river path (not jump across watershed divides between voronoi-adjacent rivers), so the generated network is geographically plausible.
3. As a map author, I want a sea port at the coast and a river burg far upstream to be directly connected through a single route entry, so trade between them animates as one flow.
4. As a map author, I want river burgs on a river chain that passes through one or more open lakes (Great Lakes style) to be grouped with the ocean's port network, so they integrate with global shipping.
5. As a map author, I want river burgs on a basin that drains into a closed lake (Caspian style) to be grouped with the lake's port network only, so their network stays self-contained.
6. As a map author, I want tiny brooks and seasonal streams excluded from navigation, so only rivers that could realistically carry boats produce routes.
7. As a map author, I want confluences to act as switching points so a boat can change from a tributary onto its parent river at the join, but never cut across to an unrelated river running through the next valley.
8. As a map author, I want the river-mouth-to-sea transition handled implicitly, so a route can start in a deep-inland river burg and continue out into open ocean as one path.
9. As a map author, I want a burg on the navigable stretch of a river to be marked as a port in the burg data, so existing port-aware UI (burg editor, connectivity, naval-type tagging) lights up for river ports too.
10. As a map author regenerating routes, I want the new behaviour to be deterministic for a given seed, so my map is reproducible.
11. As a map author, I want existing `.map` files to keep loading without schema change, so this is not a breaking save format.
12. As a developer extending routes, I want the river-course adjacency to be derivable from existing `pack.rivers` data, so I don't have to maintain new persisted state.
13. As a developer reviewing this work, I want unit tests that prove a path cannot hop between two unrelated rivers via a voronoi-adjacent bank cell, so the watershed invariant is locked in.

## Investigation: Why an Open Lake Is Not Connected to the Ocean

### Symptom

A large lake with a clearly navigable outlet river (cell flux values ≥ `MIN_NAVIGABLE_FLUX` visible in the outlet cells) produces no sea-route connection to the ocean. Burgs on its shore are linked to each other across the lake surface but are isolated from coastal ocean ports.

### Root cause

Three functions interact to produce the isolation:

**Step 1 — `BurgsModule.assignPorts()`, coastal-port loop.**  
For every burg that has a safe harbour adjacent to a multi-cell water body with ≥ 2 qualifying neighbours, the loop assigns `burg.port = featureId` where `featureId` is the lake's feature id. This is correct for a purely coastal context but records the _lake_ id, not the ocean id.

**Step 2 — `BurgsModule.assignPorts()`, river-port loop.**

```typescript
for (const burg of burgs) {
  if (!burg.i || burg.lock || burg.port) continue;   // ← already-ported burgs are skipped
  if (!Rivers.isNavigable(burg.cell)) continue;
  const drainFeature = Rivers.resolveDrainFeature(burg.cell);
  …
}
```

The `if (burg.port) continue` guard means lake-shore burgs that received a port in Step 1 are never re-evaluated. `resolveDrainFeature` — which _would_ follow the outlet chain to the ocean — is never called for them.

**Step 3 — `RoutesModule.generateSeaRoutes()`.**

```typescript
for (const [featureId, featurePorts] of Object.entries(portsByFeature)) { … }
```

Routes are generated only between burgs that share the _same_ `burg.port` value. Lake burgs grouped under `lakeFeatureId` never appear in the same bucket as ocean burgs grouped under `oceanFeatureId`, so no route is ever attempted between them.

### Why the pathfinder itself is not the blocker

`findPath` checks `isExit(next, current)` _before_ evaluating `getCost`, so it can reach a non-river coastal land cell from an adjacent water cell without the land-cell cost check blocking it. `riverAdjacency` already contains the outlet-lake-water-cell ↔ outlet-land-cell pair because the outlet river's `cells` array includes both (consecutive entries). The water-cost function allows any non-river land cell to enter any adjacent water cell freely. A path from a lake-shore burg through the lake, out the outlet river, and into the ocean is therefore fully traversable once the port assignment is correct.

### Fix

Two additions are required.

**Addition 1 — `Rivers.resolveLakeDrainFeature(lakeFeatureId)`** (new public method on `RiverModule`).  
Mirrors the outlet-chain walk in `resolveDrainFeature` but starts from a lake feature rather than a cell. Necessary because lake-shore burgs may not sit on a river cell, so `cells.r[burg.cell]` can be zero and `resolveDrainFeature(burg.cell)` would immediately return `null`.

```typescript
resolveLakeDrainFeature(lakeFeatureId: number): number | null {
  const { features, rivers, cells } = pack;
  const lake = features[lakeFeatureId];
  if (!lake || lake.type !== "lake") return null;
  if (!lake.outlet) return lakeFeatureId; // closed lake — return itself

  const visited = new Set<number>();
  let river = rivers.find(r => r.i === lake.outlet);
  while (river && !visited.has(river.i)) {
    visited.add(river.i);
    const lastCell = river.cells[river.cells.length - 1];
    if (lastCell < 0) return null; // outlet exits the map

    const feature = features[cells.f[lastCell]];
    if (!feature) return null;
    if (feature.type === "ocean") return feature.i;
    if (feature.type !== "lake") return null;
    if (!feature.outlet) return feature.i; // closed downstream lake
    river = rivers.find(r => r.i === feature.outlet);
  }
  return null;
}
```

**Addition 2 — third pass in `BurgsModule.assignPorts()`**, inserted after the river-port loop:

```typescript
// Promote open-lake port assignments to the lake's final drain feature.
// Lake-shore burgs receive burg.port = lakeFeatureId from the coastal-port loop above;
// if the lake drains to the ocean we must replace that id with the ocean's feature id
// so these burgs join the ocean port network in generateSeaRoutes().
for (const burg of burgs) {
  if (!burg.i || burg.lock || !burg.port) continue;
  const portFeature = features[burg.port];
  if (!portFeature || portFeature.type !== "lake" || !portFeature.outlet) continue;
  const finalFeature = Rivers.resolveLakeDrainFeature(burg.port);
  if (finalFeature !== null && finalFeature !== burg.port) burg.port = finalFeature;
}
```

Expected behaviours after this fix:

| Lake type                         | `burg.port` before  | `burg.port` after           |
| --------------------------------- | ------------------- | --------------------------- |
| Open lake draining to ocean       | `lakeFeatureId`     | `oceanFeatureId`            |
| Open lake draining to closed lake | `openLakeFeatureId` | `closedLakeFeatureId`       |
| Closed lake (no outlet)           | `lakeFeatureId`     | unchanged (`lakeFeatureId`) |
| Outlet exits map                  | `lakeFeatureId`     | unchanged (`lakeFeatureId`) |

---

## Implementation Decisions

### Threshold

A single constant `MIN_NAVIGABLE_FLUX = 100` gates river navigability, matching the existing threshold used by `BurgsModule.getType` to tag a burg as a "River" type. No UI control in v1; the constant can be tuned later. Flux below the threshold is impassable for routes; flux above is fully navigable with no flux-based cost shaping.

### `burg.port` semantic change

`burg.port` keeps its existing type (`number`, a feature id) and continues to identify "the water body this burg trades by." The interpretation widens:

- Coastal burg adjacent to sea feature F → `burg.port = F` (unchanged).
- Burg on a navigable river cell whose basin ultimately drains into sea feature F → `burg.port = F`.
- Burg on a navigable river cell whose basin terminates in a closed lake L → `burg.port = L`.
- Burg on a river whose chain passes through open lakes and reaches the sea → `burg.port` is the final sea feature, not an intermediate lake.

No schema migration. Existing `.map` files contain port values that remain valid coastal-port assignments; the new river-port assignments only appear when burgs are regenerated.

### Modules touched

No new module files. All additions are methods on existing modules.

**`RiverModule` (river-generator.ts)** gains three public helpers:

- `resolveDrainFeature(cellId)` — given a cell on a river, walks downstream through the river-and-lake chain and returns the feature id of the final receiving water body (open sea or closed lake), or `null` if the chain leaves the map. Resolves the open-vs-closed-lake distinction by checking `feature.outlet` on each lake reached; an open lake's outlet river is followed onward, a closed lake terminates the walk.
- `resolveLakeDrainFeature(lakeFeatureId)` — same outlet-chain walk but starts from a lake feature directly (not from a cell). Required because lake-shore burgs may have `cells.r[cell] = 0`, making `resolveDrainFeature` unusable. Returns the ocean feature id when the chain reaches the sea, the closed-lake feature id when the chain terminates in a closed lake, or `null` when the chain exits the map.
- `isNavigable(cellId)` — convenience predicate, true when `cells.r[cellId] && cells.fl[cellId] >= MIN_NAVIGABLE_FLUX`. Co-located with the river module so other consumers (zones, markers) can reuse the same threshold.

**`BurgsModule.shift()` (burgs-generator.ts)** is extended with two passes after the existing coastal-port assignment loop:

**Pass 1 — river-port assignment** (for burgs not yet assigned a port):

- For every burg whose cell is navigable, set `burg.port = Rivers.resolveDrainFeature(burg.cell)` (skip when the resolver returns `null`).
- Existing coastal-port logic and the "shift non-port river burgs a bit" cosmetic step are left alone; both still apply where they applied before. A burg that was previously left non-port purely because it sits on a river will now flip into a port.

**Pass 2 — open-lake port promotion** (for burgs already assigned a lake port):

- For every burg whose `burg.port` points to a lake feature that has an outlet, call `Rivers.resolveLakeDrainFeature(burg.port)` and replace `burg.port` with the result if non-null.
- This corrects lake-shore burgs that received the lake's own feature id in the coastal-port loop but whose lake actually drains to the ocean. Without this pass those burgs stay isolated in an in-lake port group and are never connected to ocean burgs by `generateSeaRoutes()`.
- Burgs on closed lakes (no `feature.outlet`) or lakes whose outlet exits the map are left with their existing lake feature id, preserving the isolated-network behaviour described in user story 5.

**`RoutesModule` (routes-generator.ts)** gains one private state and adjusts one cost branch:

- Private `riverAdjacency: Map<number, Set<number>>`, built by a new private `buildRiverAdjacency()` that iterates `pack.rivers[*].cells` pairwise and inserts both directions. Built once per call to `generate()` (and refreshed in `sync()` on map load).
- `getWaterPathCost(current, next)` adds a land-cell branch: if `cells.h[next] >= 20`, the step is allowed only when `cells.r[next] && cells.fl[next] >= MIN_NAVIGABLE_FLUX && this.riverAdjacency.get(current)?.has(next)`. When permitted, base cost is `distanceSquared × connectionModifier` with the same sea-cell `typeModifier` set to a fixed river constant (no flux scaling). Otherwise `Infinity`.
- Sea→river-mouth and river-mouth→sea transitions are picked up automatically because `river.cells` stores the receiving water cell as the last entry, so the adjacency map already contains the mouth↔sea pair.
- No change to Urquhart construction, route merging, name generation, `getPoints` smoothing, or the `searoutes` group label.

### Constants & wiring

`MIN_NAVIGABLE_FLUX` lives next to the existing `MIN_PASSABLE_SEA_TEMP` in routes-generator and is re-exported for `RiverModule.isNavigable` (or duplicated; both modules ship in the same build, no cycle risk).

### Order of operations

`BurgsModule.shift()` already runs after `RiverModule.generate()` in the standard pipeline (rivers are needed for `cells.r` and `cells.fl`), so the resolver has everything it needs at the moment `shift()` calls it. `RoutesModule.generate()` runs after `shift()`, so by the time the adjacency map is built and the Urquhart pass starts, river burgs already carry their drain-feature `port` values.

### What is _not_ changed

- `Route` interface and group taxonomy.
- The `searoutes` style entry in any `public/styles/*.json`.
- `Routes.connect()` for isolated cells (still produces a land trail; river-bank cells get a river hookup only if there is a burg and routes are regenerated).
- Trade animation, markers generation, zones generation.

## Testing Decisions

Tests follow the existing pattern in `src/generators/*.test.ts` (Vitest, fabricate a minimal `pack` shape, assert behaviour through the module's public surface). Good tests verify external behaviour — does the cost evaluator reject the cross-watershed hop, does the resolver return the closed-lake id — not internal map structure.

**`RiverModule.resolveDrainFeature`**

- Returns the sea feature id when the river drains directly into the sea.
- Returns the closed-lake feature id when the river terminates in a lake without an outlet.
- Walks through an open lake (lake with an outlet river) and returns the downstream receiving feature.
- Returns `null` when the river exits the map (final cell is `-1`).

**`RoutesModule` river-routing behaviour**

- Building adjacency from a synthetic two-river pack: pairs sequential in `river.cells` end up adjacent both ways; cells from different rivers that happen to be voronoi-neighbors do **not** end up adjacent.
- `getWaterPathCost` returns a finite cost for a step along the river course above the flux threshold.
- `getWaterPathCost` returns `Infinity` for a step between two voronoi-adjacent river cells that belong to different rivers (the watershed invariant from user story 13).
- `getWaterPathCost` returns `Infinity` for a step onto a river cell whose flux is below `MIN_NAVIGABLE_FLUX`.

**`RiverModule.resolveLakeDrainFeature`**

- Returns the ocean feature id when the lake's outlet chain reaches the sea.
- Returns the closed-lake feature id when the outlet chain terminates in a lake with no further outlet.
- Returns `null` when the outlet chain exits the map (`lastCell < 0`).
- Returns the lake's own feature id when the lake has no outlet (closed lake passed directly).
- Returns `null` for a non-lake feature id.

**`BurgsModule.shift` port widening**

- A burg on a sea-coast cell still gets the coastal-sea feature id as `burg.port`.
- A burg on a navigable river cell whose basin drains into a sea gets that sea's feature id as `burg.port`.
- A burg on a navigable river cell whose basin terminates in a closed lake gets the closed-lake feature id as `burg.port`.
- A burg on a river cell with flux below the threshold does not receive a `port` value from the river path.

**`BurgsModule.shift` open-lake port promotion**

- A lake-shore burg with `burg.port = openLakeFeatureId` (from the coastal-port loop) gets its port updated to the ocean feature id when the lake's outlet chain reaches the sea.
- A lake-shore burg with `burg.port = openLakeFeatureId` whose outlet chain terminates in a closed downstream lake gets its port updated to that closed lake's feature id.
- A lake-shore burg on a closed lake (no `feature.outlet`) keeps its original `burg.port` unchanged.
- A lake-shore burg on a lake whose outlet exits the map keeps its original `burg.port` unchanged.

Prior art for the test style: `src/generators/states-generator.test.ts`, `src/renderers/trade-animation.test.ts`.

## Out of Scope

- Distinguishing river routes from sea routes visually or in the route group taxonomy. A new `"rivers"` group can come later; for now everything ships as `"searoutes"`.
- UI control for the flux threshold. The constant is fixed in v1.
- Upstream-vs-downstream cost asymmetry (riverine traffic going upstream is historically more expensive). Pathfinder treats both directions equally.
- River-aware behaviour for `Routes.connect()` on isolated cells.
- Migrating already-saved `.map` files so legacy maps gain river ports without regenerating burgs and routes.
- Renaming or restyling the existing `#searoutes` SVG layer.
- Markers, zones, or culture spreading taking advantage of the new river adjacency.

## Further Notes

- The adjacency map is rebuilt every time `RoutesModule.generate()` or `sync()` runs. It is not persisted; it falls out of `pack.rivers` in O(total river cells) and stays cheap.
- Adjacency is the only place that enforces "follow the river course." Without it, the cost function would let voronoi-adjacent high-flux cells from different rivers transit into one another, producing physically impossible cross-watershed routes.
- Confluences need no special-casing: the confluence cell appears in multiple rivers' `cells` arrays, so its adjacency set ends up holding all legitimate course-following neighbors. A tributary boat naturally switches onto the parent stream at the join.
- The `burg.port` widening is intentionally minimal — same type, same field, just a broader pool of feature ids. Anything that reads `burg.port` today (port name suggestion, naval culture type, the burg-editor "warn if no haven" message) keeps working, with the river burgs now triggering port-aware branches.
- If a future iteration wants distinct visual treatment for river vs. sea routes, the path-cell sequence already carries enough information to split — every cell where `pack.cells.r[cellId] > 0` is the river segment. No data model change required at that point either.
