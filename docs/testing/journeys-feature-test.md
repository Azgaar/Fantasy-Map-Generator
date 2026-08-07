# Journeys (Travel Map Calculator) — Manual Test Plan

Branch: `travel-map-calculator`

This document walks through validating the new Journeys feature end-to-end. Journeys are multi-segment travel routes across the map. Each segment has its own transport type (which drives speed and pathfinding mode), and the editor derives total distance, average speed, and travel time.

## What shipped in this pass

- **Data model & persistence**: `pack.journeys` and `pack.transportTypes` — round-trip through `.map` save/load, JSON export, and older-map auto-update (seeds default transport types on load).
- **Renderer & layer**: new `#journeys` SVG group with a `toggleJourneys` layer button. Segments render as smoothed paths with endpoint circles and direction arrows.
- **Overview dialog** (Tools → Journeys): list all journeys with totals, add/delete/lock, CSV export.
- **Journey Editor**: per-segment table (name, transport type, speed, from/to, distance, time). Cell picking by clicking on the map. Recompute button re-runs pathfinding for all segments.
- **Three pathfinding modes** driven by transport type:
  - **direct**: straight line between endpoints
  - **route**: BFS over the existing road network (`pack.cells.routes`); falls back to land pathfinding if endpoints are off-road
  - **sea**: `findPath` over water cells
- **Transport Types editor**: CRUD on transport types with in-use protection.

## What was deliberately deferred

- **Drag-to-edit segment paths**: for now you cannot drag individual control points. To change a segment's shape, edit `from`/`to` and press Recompute.
- **Notes/legend integration**: no free-text notes UI for journeys yet (data field exists on the type).
- **Style editor integration** (Ctrl+click on layer): the Journeys layer uses hardcoded stroke defaults.

---

## 0. Prerequisites

```bash
npm install
npm run dev
```

Open http://localhost:5173 in a browser. Generate any map (default settings are fine). The map must have at least a few burgs and roads if you want to exercise `route` mode.

Optional sanity check before manual testing:

```bash
npx vitest run src/utils/journey-metrics.test.ts
```

Should show 5 tests passing.

---

## 1. Layer toggle & Overview dialog

1. Click the Layers menu (top-left toolbar). Confirm a new **Journeys** entry sits between Markers and Rulers.
2. Click **Journeys** — the button lights up (layer is ON). Nothing visible yet (no journeys exist).
3. Open the Tools menu → the **Overview** section → click the new **Journeys** button. The **Journeys Overview** dialog opens on the right.
4. Confirm the dialog has: search, Add (plus icon), Refresh, Export CSV, Lock all, Remove all buttons. Table shows 0 journeys.

## 2. Create a journey (direct mode — always works)

1. In the Overview, click **+ (Add)**. A new "Journey 1" is created and the **Journey Editor** opens.
2. In the header, change **Name** to `Trader's Round` and pick a **Color**. Confirm the journey name updates in the Overview immediately (Refresh if needed).
3. Click **Add segment**. A row appears with default transport type "On Foot" and a tip prompts you to pick a `To` cell.
4. Click any cell on the map. The segment's `To` cell fills in; because `From` defaulted to 0, distance may still be 0 until you set both endpoints. Click **From** in the row and pick a starting cell.
5. In the transport-type dropdown, choose **Direct** (path mode `direct`). The path recomputes as a straight line between the two cells.
6. Confirm on the map:
   - A colored curve is drawn between the two cells.
   - Small circles mark each endpoint.
   - An arrowhead marks the destination end.
7. Confirm the footer shows: Total distance, Average speed (`5 km/h` for On Foot / Direct), Travel time (e.g. `3h 20m`).

## 3. Chain multiple segments

1. Click **Add segment** again. The new row's `From` defaults to the previous segment's `To` — press **Esc** to cancel the automatic "pick To" prompt, then click **To** and pick a cell far from the first pair.
2. Change this segment's transport type to **Horse** (12 km/h). Confirm the Speed field updates automatically to 12 and travel time recomputes.
3. Verify totals in the footer sum both segments correctly:
   - `totalKm = seg1 + seg2`
   - `totalHours = (seg1_km / 5) + (seg2_km / 12)`
   - `avgSpeed = totalKm / totalHours` (should be between 5 and 12)
4. Click **↑** on segment 2 — it moves up. Confirm order changes and totals stay the same.

## 4. Route-mode pathfinding

1. Add a segment. Set transport type to **On Foot** (path mode `route`) — the default.
2. Pick `From` = a cell that has a road passing through it, and `To` = another road cell in the same connected road network. (Turn on the Routes layer if needed to see them.)
3. Confirm the segment traces along the existing road network rather than cutting straight across.
4. Now try `To` = a cell far from any road: you should see a "Segment leaves the road network" tip and the path falls back to land-based `findPath`.

## 5. Sea-mode pathfinding

1. Add a segment. Choose transport type **Ship** (path mode `sea`, speed 15 km/h).
2. Pick `From` and `To` as two water cells in the same body of water (open ocean or same lake).
3. Confirm the path snakes through water cells, avoiding land. Distance and travel time populate.
4. Try picking a land cell → tip should say "No sea path found — using direct line" and the path degrades to a straight line.

## 6. Recompute button

1. In the Journey Editor, change one segment's transport type from **Horse** to **Direct**. Confirm the path immediately shortens (straight line).
2. Click **Recompute**. Confirm the tip "All segments recomputed" appears; totals are consistent.

## 7. Transport Types editor

1. From the Journey Editor, click **Transport…**. The Transport Types dialog opens.
2. Edit the speed of **On Foot** to `6`. Close and reopen the Journey Editor; segments using On Foot use 6 km/h now (change the transport dropdown once to force reseed, or press Recompute).
3. Try to delete **Horse** while a segment still uses it → an error tip appears; deletion is refused.
4. Change the transport type of every "Horse" segment to something else, then delete "Horse" — confirmation dialog appears.
5. Click **Reset defaults** → confirmation → the list resets to the six defaults.

## 8. Rendering & layer

1. In the Overview, hover a journey row. The corresponding SVG group thickens (highlight-on-hover).
2. Click the target icon on a row — the map zooms to the journey's bounding box.
3. In the Layers menu, click **Journeys** to hide the layer. All paths disappear. Toggle it back on — paths reappear correctly.

## 9. Persistence — save / load / export

1. **Save to storage**: Menu → Save/Load → Save to browser storage. Reload the page fully (Ctrl+F5). Load from browser storage. Reopen the Journeys Overview — all journeys, segments, and totals are identical.
2. **Save to machine**: Save the `.map` file. Open it in a fresh session (drag into the map window). Same round-trip check.
3. **Export JSON** (Menu → Export → Full JSON, or Minimal). Open the downloaded JSON in a text editor. Search for `"journeys"` and `"transportTypes"` at the top level of the `pack` object — both should be present with the expected content.

## 10. CSV exports

1. From the Overview, click **Download** (icon-download). A `Journeys.csv` file downloads: header `Id,Name,Segments,DistanceKm,AvgSpeedKmh,TravelHours` and one row per journey.
2. From the Journey Editor, click **CSV**. A per-journey file downloads with header `Idx,Name,TransportType,SpeedKmh,DistancePx,DistanceKm,TimeHours,From,To,Note`.

## 11. Locking

1. In the Overview, click the padlock icon on a journey → it locks. Click **Remove all** → the confirmation notes locked journeys will be kept; only unlocked are removed.
2. Click **Lock all** → all journeys lock. Click again → all unlock.

---

## Known gaps / follow-ups to raise

- **No control-point drag** on segment paths yet (deferred M4).
- **Notes/legend integration** not wired (deferred M6).
- **Style tab integration**: Ctrl-clicking the Journeys layer does not open the style editor.
- Path recompute is manual — if you edit the road network later, existing route-mode segments do not auto-invalidate. Use Recompute.

## Feedback to send back

For each numbered section above, please note:
- ✅ works as described
- ⚠️ works but ... (describe)
- ❌ broken — with steps to reproduce and any console errors (open DevTools → Console)

Screenshots of the Overview, Editor, and a rendered journey on the map are useful, especially for renderer feedback (colors, arrow size, endpoint circle size).
