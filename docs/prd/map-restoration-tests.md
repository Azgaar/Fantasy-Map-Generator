# Map restoration: release test round

Tests for `src/generators/map-restoration.ts`, which Risk heightmap edits, Submap and Transform run on.

## Why fixes keep coming back

1. Each scenario runs on one seed, so a fix counts as done once that seed passes. Other seeds break the same rules (see Gate 0).
2. The identity fingerprint keys data by cell position and leaves out derived fields: mouth, discharge, width, parent, basin, port, group. Changes to those go unnoticed until someone looks at the map.
3. The integrity rules and the restore code disagree on what is valid: river points, and states without a capital. A fix on one side breaks the other.
4. Nothing checks that a restore is a fixed point. Restoring an already restored map moves data again, so chained edits drift.
5. The unit tests mock `Rivers`, `Burgs` and `pack` by hand. A refactor breaks the mocks even when behavior is fine, and four of these tests fail now.
6. The e2e spec covers only Risk mode. Submap and Transform have no browser test of restoration.

The round below turns each of these into a check that runs every time. A regression then fails a test, not a manual run.

## Gate 0: defects found at `2ae1189e`

A throwaway probe on real generated maps (3K cells, 7–10 seeds) found these defects. Each fixed one has a test.

| #   | Defect                                                                                                                                                                           | Fix                                                                                                                                        | Guarded by                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| D1  | 11 restoration tests failed: stale mocks (`Rivers.updateWidth`, `pack.cultures`, `getParent`), a pre-fill river fixture, and D2/D7                                               | mocks and fixtures updated                                                                                                                 | the suite                                       |
| D2  | `river-points` broke on every Transform (49–80 rivers) and most Submaps: `fillPathGaps` put a filled point in a neighbor cell, and the River Editor rebuilds cells from points   | a filled point lies in its own cell, else at the cell's center                                                                             | `river-points`, `fillPathGaps` unit test        |
| D3  | After a ×4 or ×8 Submap, a state with land but no burg had no capital                                                                                                            | a capital is founded at the state's center with `Burgs.add`, as `Burgs.regenerate` does; routes are restored first, so it connects to them | scenario "founds a capital"                     |
| D4  | Rivers passed a cell twice after Submap, mirror, rotate or zoom-out                                                                                                              | `cutLoops`: a course that comes back to a cell goes on from its first pass there                                                           | `river-unique`, unit test                       |
| D5  | After a rotation or scale < 1, rivers ended with `-1` deep inside the map                                                                                                        | an old outlet now strictly inside the map ends at its cell                                                                                 | `river-outlet`, unit test                       |
| D6  | A drawn river ending on land lost its mouth cell on an identity edit (discharge 9 → 8)                                                                                           | the mouth stays at the last cell when it was there; it moves to `at(-2)` only where the course is cut at the sea                           | unit test                                       |
| D7  | An identity edit turned `burg.port` `undefined` into `0`                                                                                                                         | `burg.port && Burgs.getPortWater(cell)`                                                                                                    | identity scenario                               |
| D8  | A restore was not a fixed point: a second edit changed river cells and points again                                                                                              | D2, D4 and D5, plus: a course through cell centers keeps no `points`, as generated rivers have none, so saved maps don't grow              | two fixed-point scenarios (×2 submap, rotation) |
| D9  | An identity edit changed `cells.r` at confluences: generation gives the cell to the lower river id, the restore gave it to the river flowing through (hidden behind the D7 diff) | a contested cell keeps the river that held it while that river still meets there; the parent comes from the river flowing through          | identity scenario, unit test                    |

Still open, outside the restore:

- **Grid markup drift.** `Grid.openNearSeaLakes` patches `grid.cells.t` in place, inexactly, so a fresh `Features.markupGrid()` on the same heights changes `t` for a few cells. A Risk edit then rebuilds one or two pack cells differently near a breached lake, even on a freshly generated map. Data still carries over by position. Fixing it changes generation output for those seeds, so it needs its own change.
- **Generated rivers repeat a cell.** After an erosion edit, generated rivers can list a cell twice in a row. The next restore merges the repeat once, and from then on the map is a fixed point.

## Static round

### 1. New integrity rules

Each invariant from runs 1–10 becomes a rule in `map-integrity.ts`, so the sweep and the e2e tests check it on every map.

| Rule                         | Holds when                                                                                    | Guards                      |
| ---------------------------- | --------------------------------------------------------------------------------------------- | --------------------------- |
| `river-steps`                | consecutive river cells are neighbors                                                         | course gaps, `fillPathGaps` |
| `river-unique` (added)       | a course does not come back to a cell it left                                                 | D4                          |
| `river-outlet` (added)       | `-1` appears only as the last cell, with its point on or past the map edge                    | edge stretch, D5            |
| `river-mouth`                | `mouth = cells.at(-2)`, or `at(-1)` for a drawn river ending on land; `discharge = fl[mouth]` | run 1 `at(-1)`, D6          |
| `river-confluence`           | a river ending on land ends on another river's cell, and that cell has `conf ≥ 1`             | two-pass claim              |
| `river-chain`                | the parent chain has no loop, and the basin is its root                                       | `flowsInto`, basin          |
| `river-width`                | `width`, `widthFactor` and `sourceWidth` are finite and > 0                                   | width scaling               |
| `burg-state`                 | `burg.state = cells.state[burg.cell]`                                                         | state taken from the land   |
| `capital-flags`              | a burg is a capital exactly when its state names it as capital                                | `changeGroup`, `setCapital` |
| `province-capitals` (extend) | each capital is unique and lies inside its province                                           | successor rules             |
| `state-provinces` (extend)   | every living province is listed by its living state, and the reverse                          | removal cascade             |
| `culture-refs`               | burg, state and religion cultures and all origins are living or 0                             | `keptCulture`, origins      |
| `state-land`                 | a living state owns at least one cell; a removed state owns no cell and no burg               | state removal               |
| `tariffs`                    | tariffs name living states only                                                               | `pruneTariffs`              |
| `route-cells`                | when `route.cells` is stored, it matches the cells of the points                              | route cut                   |
| `journey-distance`           | `distance = getPathLength(points)`, and `from`/`to` are the end cells                         | journeys                    |
| `marker-bounds`              | every marker is inside the map                                                                | marker drop                 |
| `regiment-cells` (extend)    | merged children are checked too                                                               | regiment children           |
| `market-burgs`               | every market has at least one burg                                                            | market expansion            |
| `burg-values`                | population is finite                                                                          | NaN guards                  |

### 2. Regression ledger

Each bullet of the run summary gets one named test: in `map-restoration.scenarios.test.ts` on a real map, or in `map-restoration.test.ts` as a unit test. A fix that undoes an earlier one then fails by name. Bullets that a rule covers only need the sweep.

| Area        | Bullet                                                                         | Test                                                                                              |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Rivers      | mouth is `at(-2)`                                                              | scenario: a tributary's discharge is below its parent's; `river-mouth`                            |
| Rivers      | longest stretch inside the map, no start on `-1`                               | ×4 submap of a corner; `river-outlet`                                                             |
| Rivers      | consecutive cells are neighbors                                                | `river-steps`                                                                                     |
| Rivers      | the junction cell belongs to the main river; new `conf ≥ 1`                    | `river-confluence`                                                                                |
| Rivers      | sea or edge gives no parent, a lake keeps its parent, no loops                 | unit: sea, edge, lake and loop fixtures                                                           |
| Rivers      | width × scale, `updateWidth` only when the mouth changes, `sourceWidth` scaled | scenario: a ×2 submap doubles the width of an unchanged mouth; an identity edit keeps every width |
| Rivers      | `cutAtSea` skips `-1`                                                          | unit                                                                                              |
| Burgs       | two passes, capitals first                                                     | unit (exists)                                                                                     |
| Burgs       | the `strayed` set                                                              | unit                                                                                              |
| Burgs       | state taken from the land                                                      | `burg-state`                                                                                      |
| Burgs       | port checked again                                                             | scenario: sinking a port's sea makes its port 0; an identity edit keeps `port` (D7, covered)      |
| Burgs       | population rounded, no (0,0) fallback                                          | `burg-values`, `burg-positions`                                                                   |
| Burgs       | custom groups survive                                                          | scenario: an ordinary burg in a custom group keeps it; a former capital is regrouped              |
| States      | the capital cell returns to its state and province                             | unit: the capital cell is owned by the neighbor state                                             |
| States      | a far capital turns ordinary, the most populous burg succeeds                  | scenario (exists), also run in the sweep                                                          |
| States      | no land left, state removed                                                    | scenario: a submap away from a small state; `state-land`                                          |
| States      | center never `-1`                                                              | `state-centers`                                                                                   |
| States      | tariffs pruned                                                                 | `tariffs`, with a scenario that removes a state named in tariffs                                  |
| Provinces   | a successor is not another province's capital                                  | `province-capitals`                                                                               |
| Provinces   | a province that never had a capital stays without one                          | scenario: a province with `burg = 0` keeps `burg = 0` after an identity edit                      |
| Provinces   | a strayed capital stays only inside its province                               | unit                                                                                              |
| Cultures    | origins and culture references                                                 | `culture-refs`                                                                                    |
| Economy     | all market centers lost: `Markets.regenerate`, no reseed                       | scenario: a submap of an area with no market center; `Math.random` is not replaced, markets exist |
| Economy     | markets the user removed stay removed                                          | scenario: `pack.markets = []` stays `[]`                                                          |
| Economy     | markets expanded once                                                          | spy: `Markets.expandTerritories` is called once                                                   |
| Economy     | map without goods                                                              | scenario: `pack.goods = []` gets goods generated, with no new violation                           |
| Relief      | `parent.relief?.length` guard, Resample `relief: false`                        | unit (exists); browser B5                                                                         |
| Routes      | longest part kept, cells follow the points                                     | `route-cells`; scenario: a shift that cuts a route at the edge                                    |
| Journeys    | longest run, distance, warning                                                 | unit (exists); `journey-distance`                                                                 |
| Labels      | anchor or a curve point on the map                                             | unit (exists)                                                                                     |
| Markers     | markers off the map dropped                                                    | `marker-bounds`                                                                                   |
| Regiments   | merged children kept                                                           | scenario: two merged regiments keep their children after an identity edit                         |
| New land    | ranked with `Population.rankCells`                                             | scenario: in a raised sea corner, habitable new land has `s > 0` and `pop > 0`                    |
| Path search | no 500-cell cap                                                                | unit: a gap of more than 500 cells is filled                                                      |

### 3. Sweep

`map-restoration.sweep.test.ts`, opt-in with `SWEEP=1`. It runs every operation on every seed, template and size. Each run must add no violation; Risk edits that sink no burg land must keep every count; and each run must pass the fixed-point check.

- Seeds: `sweep-1` to `sweep-8`.
- Templates: `continents`, `archipelago`, `pangea`, `highIsland`, `lowIsland`, `isthmus`. Image heightmaps need a canvas, so they are not included.
- Points: 3K and 10K.
- Risk: no change, sink an inland patch, raise a sea corner, sink the land around the largest capital, sink most of the land; each with erosion on and off.
- Submap: ×2, ×4 and ×8, at the center and at each corner, plus one density change.
- Transform: mirror H and V; shift ±150 in x and in y; rotate 30°, 90° and 180°; scale 0.1, 0.5 and 2.
- Chain: Submap, then Risk, then Transform, then Risk with no change.

### 4. Fixed-point and round-trip checks

- **Identity.** A Risk edit with no change keeps every stored field. Compare whole entities after mapping cell ids by position: rivers, burgs, states, provinces, cultures, religions, routes, markers, zones, journeys, labels, markets and features. The hand-picked fingerprint is not enough, and no difference is allowed.
- **Fixed point.** After any sweep operation, a Risk edit with no change keeps every field. This is the check that stops drift from round to round.
- **Round trips.** Mirror H twice, or Submap at scale 1 from (0, 0): entity counts stay equal, and burgs, river courses and routes stay within one cell of where they started.

### 5. Unit tests

Where a test is about behavior, replace the hand-made `Rivers`, `Burgs` and `pack` mocks with small real maps (`generateMap({ points: 1000 })`). Keep fixtures only for the pure helpers: `fillPathGaps`, `findCellsBetween`, `matchOverlaps` and `cutAtSea`.

### Exit

- `npx vitest run` and `npm run test:scenarios` are green.
- `SWEEP=1 npx vitest run map-restoration.sweep` adds no violation, and every fixed-point check is exact.
- `CI=1 npx playwright test map-restoration` is green.

## Browser round

This covers what static checks cannot see: drawing, editors, save and load, and UI flows. Run it on `npm run dev`.

### Fixture map

Generate seed `restoration-release` (10K cells, continents), then add the data that only user edits create:

1. Rivers: lock one; drag the points of another in the River Editor; draw one river that ends on land and one that ends on another river.
2. A custom route near the map edge, and a journey of at least 3 segments, one of them drawn by hand.
3. An added label with a curved path, a custom state label path, and a burg label with an offset.
4. An ordinary burg in a custom group, a lake port and a sea port.
5. A province without a capital, and tariffs between two states.
6. Two merged regiments, and a naval regiment at sea.
7. A coastal zone, markers near the edge, notes on a burg, a lake and a river, and a renamed lake and island.

Commit it as `tests/fixtures/restoration-release.map`. For old-format data, use `tests/fixtures/1.112.1.map` and `1.139.4.map`.

### Scenarios

Load the fixture before each scenario.

| #   | Operation                                                                                                                                                      | Specific checks                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| B1  | Risk, erosion off: sink an inland patch next to a capital and raise a sea corner                                                                               | rivers through the patch end at the new water; the capital and its province are kept                  |
| B2  | Risk, erosion on, with the same edit                                                                                                                           | the locked river keeps its course; generated rivers carry the old names                               |
| B3  | Risk with no change                                                                                                                                            | the map is identical: counts, names, positions, and a screenshot diff at zoom 1                       |
| B4  | Submap ×2 around a capital near the region edge; Submap ×8 inside one state                                                                                    | capital succession; a state with no burg left gets a founded capital with a road                      |
| B5  | Submap with "Rescale burg styles" on, then off, and with a density change                                                                                      | burg icon sizes; relief placed anew                                                                   |
| B6  | Transform: mirror; rotate 45°; a shift that moves rivers off the map; scale 0.5 and 3                                                                          | rivers end at the map edge, not in the middle of the land (D5)                                        |
| B7  | B1, then B4, then B6, then B3; save and reload                                                                                                                 | the reloaded map equals the map as it was before saving                                               |
| B8  | Failure: before the operation, run `Production.regenerateEconomy = () => { throw new Error("x") }` (Risk) or replace `Features.markupPack` (Submap, Transform) | the tip says "The map is unchanged"; the map is identical and can still be edited; every editor opens |
| B9  | An old-format map: Risk, Submap, Transform                                                                                                                     | no console error; no NaN river width                                                                  |
| B10 | A 100K-cell map: Risk, Submap                                                                                                                                  | timed; the UI does not freeze for more than a few seconds                                             |
| B11 | The Burg Editor is open on a burg the operation removes, and the Rivers Overview is open                                                                       | the editors close or refresh without errors                                                           |

### After every operation

1. `MapIntegrity.check()` in the console returns `[]`, or no rule is worse than before the operation.
2. The console has no errors. The only warnings are the expected ones: a burg removed, journey segments dropped.
3. Turn every layer off and on again: rivers, routes, burgs, labels, markers, military, zones, relief, emblems, states, provinces, cultures, religions, markets and ice. Nothing is stale, such as a removed burg still drawn or a river missing, and nothing is drawn twice.
4. Open each of these:
   - the Burg Editor for a moved burg: port, group and position;
   - the States Editor: no blank capital;
   - the Provinces Editor;
   - the River Editor on a cut river: edit it and apply;
   - the Rivers Overview: no NaN in length, discharge or width;
   - the Routes Overview, Journeys (distances), the Markets and Economy overview, Zones and Notes.
5. Save, load the saved file, and run step 1 again.
6. The 3D view opens and closes.

### Exit

Every scenario passes the checklist and no defect is left open. B1–B8 are automated in `tests/e2e/map-restoration.spec.ts`, which has no Submap or Transform cases yet, using the committed fixture. B9–B11 stay manual.
