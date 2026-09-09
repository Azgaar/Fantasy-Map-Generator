# PRD: Wrap Tool

Status: Draft for implementation review  
Date: 2026-09-10

## Problem Statement

Map authors can currently drag individual coastline vertices, but cannot make the same local shape
adjustments elsewhere through one consistent tool. Editing one vertex at a time is cumbersome when
reshaping a stretch of coastline, a lake shore, or an inland boundary. The existing editor also lacks
brush controls and stroke history.

Moving map geometry has consequences beyond its visible outline. Shared cell boundaries, rivers,
routes, settlements, labels, cell selection, and saved maps must remain consistent. A tool that permits
large or invalid distortions can make a map difficult to use even when the initial edit looks acceptable.

## Solution

Introduce a global **Wrap Tool** as a new Controller, available from the Tools tab. Authors drag a
circular brush to push nearby map geometry, with smooth falloff toward the edge. The mouse wheel changes
brush size. A compact dialog provides brush size, strength, undo, redo, reset, help, and close controls.

The tool adjusts existing shapes while preserving cell identities, adjacency, and land/water
classification. It works inland as well as on coastlines and lakes. Attached map content follows the
accepted deformation. Significant terrain changes remain the responsibility of the Heightmap Editor.

Remove the coastline editor completely, including its standalone dialogs, Controller registrations,
entry points, and vertex handles. Preserve existing coastline appearance settings and saved groups;
their controls belong in Style, outside the Wrap Tool.

Display this non-blocking guidance in the dialog:

> Use Wrap for small shape adjustments. For major terrain changes, such as creating islands or changing
> land into water, use the Heightmap Editor. Movement is limited to keep the map geometry valid.

The agreed product name is **Wrap Tool**. Watabou's reference calls the interaction “Warp”; this PRD
uses the user's requested name consistently.

## User Stories

1. As a map author, I want to open Wrap from Tools without selecting a coastline, so that I can adjust any part of the map.
2. As a map author, I want to drag a brush across several vertices, so that reshaping an area takes fewer actions.
3. As a map author, I want movement to fade toward the brush edge, so that adjustments blend into the surrounding map.
4. As a map author, I want to resize the brush with the mouse wheel, so that I can change the affected area without leaving the canvas.
5. As a map author, I want a visible brush outline, so that I know which area will be affected before dragging.
6. As a map author, I want a labelled size control, so that I can discover and adjust brush size without a wheel.
7. As a map author, I want a strength control, so that I can make delicate corrections with a large brush.
8. As a map author, I want familiar keyboard controls and tooltips, so that I can work without learning a complex interface.
9. As a map author, I want to pan and zoom while using Wrap, so that I can reach and inspect the area I am editing.
10. As a map author, I want a coastline, lake shore, or inland boundary to respond to the same brush, so that I do not switch geometry editors.
11. As a map author, I want shared boundaries to move together, so that adjacent regions do not develop gaps or overlaps.
12. As a map author, I want rivers, roads, and settlements to follow the terrain adjustment, so that their relationships remain believable.
13. As a map author, I want labels and other map annotations to stay with the features they describe, so that the map remains readable.
14. As a map author, I want hidden layers to reflect my edits when shown, so that layer visibility does not change the result.
15. As a map author, I want to undo or redo a whole stroke, so that experimenting is easy.
16. As a map author, I want to reset the current editing session, so that I can abandon an experiment without losing earlier work.
17. As a map author, I want to cancel an unfinished stroke, so that an interrupted drag does not leave a partial edit.
18. As a map author, I want the brush to stop before geometry becomes invalid, so that I cannot accidentally break the map.
19. As a map author, I want feedback when movement reaches a limit, so that I understand why the brush stops responding.
20. As a map author, I want clear guidance about heightmap editing, so that I choose the right tool for major terrain changes.
21. As a map author, I want clicks and hover information to match the edited cells, so that subsequent editing remains accurate.
22. As a map author, I want areas and geometric distances to refresh, so that map information reflects the new shapes.
23. As a map author, I want saved and exported maps to preserve the result, so that editing work survives sharing and reopening.
24. As an existing user, I want maps with earlier coastline edits and custom styles to remain usable, so that replacing the editor does not discard my work.
25. As a map author, I want closing the tool to restore normal map interaction, so that scrolling and clicking behave normally afterward.
26. As a map author working on a large map, I want responsive previews and bounded history, so that the tool remains practical throughout a session.

## Implementation Decisions

The product scope above incorporates the conversation. The engineering choices below are proposed
implementation requirements, rather than a claim that the implementation already exists.

### Controller and lifecycle

- Register one lazy-loaded Wrap Tool Controller through the existing Controllers registry. Opening it
  requires no selected feature and reuses the existing instance if already open.
- Build the dialog and brush overlay on demand. Opening the tool enters an exclusive editing mode;
  normal click-to-edit actions must not open other editors beneath a stroke.
- Do not allow concurrent heightmap editing or another geometry editor. Follow existing editor lifecycle
  conventions when switching tools, and cancel an unfinished stroke before switching.
- Close keeps completed changes, removes overlays and listeners, releases session history, and restores
  normal pan, zoom, hover, and click behavior. Opening again begins a new history session.
- Tool preferences are browser preferences. Geometry changes are map state. Brush overlays and history
  are transient and must not appear in exports or saved map geometry.

### Brush and standard controls

| Control | Required behavior |
| --- | --- |
| Primary drag | Push affected geometry in the direction of pointer travel. A click without movement makes no edit. |
| Brush size | Labelled slider and numeric value; wheel over the canvas changes size while Wrap is active. |
| Strength | Labelled slider controlling the proportion of drag movement applied at the brush centre. |
| Brush outline | Show the affected radius; distinguish a constrained stroke with more than colour alone. |
| Undo / Redo | One entry per completed stroke, with disabled states when unavailable. |
| Reset session | Restore geometry and dependent state to tool-opening values; record reset as one undoable action. |
| Help | Explain dragging, wheel resizing, navigation, history scope, and movement limits. |
| Close | Keep completed strokes and leave editing mode. |

- Use smooth radial falloff with zero displacement at the outer edge. Resolve pointer movement in map
  coordinates and make the result independent of pointer-event frequency within a documented tolerance.
- Keep the brush radius in map units; its outline scales with zoom. Wheel direction and slider values
  must agree. Clamp radius and strength to valid ranges and handle trackpad wheel deltas smoothly.
- While the tool is active, wheel events over the canvas resize the brush without also zooming the map
  or scrolling the page. Do not intercept wheel events over dialog controls.
- Provide `+` and `-` for size, Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z and Ctrl+Y for redo. Shortcuts must
  not intercept typing or native undo in inputs.
- Space+drag temporarily pans. Existing zoom buttons remain usable. Navigation must not create a stroke.
- Escape cancels an active stroke; otherwise it closes the tool. Pointer cancellation rolls back the
  unfinished stroke. Capture the pointer so release outside the canvas still ends the stroke cleanly.
- Freeze size and strength for the duration of a stroke; changes made during dragging apply to the next
  stroke. Finalize or cancel the stroke before save, export, reset, or other map mutations.

### Safe deformation

- Deform the shared packed-cell mesh, preserving vertex and cell identities, adjacency, feature
  membership, and land/water classification. Do not regenerate the Voronoi graph after each stroke.
- Do not implement the original-polygon suggestion as containment in every incident cell: a vertex is
  shared by multiple cells and begins on their boundaries. Use a local displacement budget together
  with geometric validation.
- Measure the budget from the original graph position, scaled to original local edge lengths. Keep that
  baseline stable across repeated strokes, closing/reopening, and save/load. Exact limits are tuning
  parameters to establish against representative maps; users cannot disable validity checks.
- Validate affected cells and neighboring geometry as a batch. Prevent edge crossings, self-intersecting
  polygons, inverted or collapsed cells, and overlaps between previously separate features. Respect map
  bounds and keep the map frame fixed.
- Scale down a proposed drag to a valid displacement; if none is available, keep the previous valid
  state. Avoid independently clamping vertices in ways that introduce tears or abrupt spikes.
- Show brief inline feedback such as “Movement limit reached. Use the Heightmap Editor for larger
  changes.” A no-op or fully blocked stroke creates no history entry.
- Rendered smoothing and coastline roughness must also be checked against representative narrow straits,
  small lakes, and sharp bends; a valid base polygon alone does not guarantee a usable displayed outline.
- Existing saved edits outside the new limits must load without being silently clamped. Further Wrap
  edits must not worsen invalid geometry or exceed an already exceeded budget; permit corrective
  movement where it is valid, otherwise explain the restriction.

### Consistent map content

Global describes one coherent deformation, independent of visible layers. Merely moving coastline or
SVG path points is insufficient.

| Content | Required treatment |
| --- | --- |
| Cell-based layers | Redraw coastlines, lakes, elevation, states, provinces, borders, cultures, religions, biomes, zones, markets, and other cell-based geometry from the accepted state. |
| Cell anchor positions | Keep anchors inside their cells and update derived spatial indexes without changing cell identity or adjacency. |
| Rivers, routes, journeys | Transform stored control points and shared junctions consistently; regenerate derived geometry from updated anchors. Preserve connectivity and cell references. |
| Burgs and ports | Move geographic positions with their cells and preserve road endpoints, river connections, and shore relationships. |
| Labels and emblems | Move geographic anchors and custom label paths with their owner or location; retain typography, icon size, and intentional label offsets. |
| Other geographic objects | Move markers, relief placements, ice geometry, regiment positions, and measurer points through the same accepted deformation. Retain symbol dimensions and style. |
| Screen furniture | Keep the legend, scale bar placement, dialogs, and other screen-positioned controls fixed. |
| Grid-derived views | Maintain a consistent mapping between edited geography and grid-derived overlays or samples. Height values and source-grid topology remain unchanged. |

- Apply the accepted deformation once to each position. In particular, do not move an owner and then
  independently apply the same displacement a second time to an owner-derived label or route endpoint.
- Cell picking must select the polygon under the pointer. The existing nearest-anchor lookup is not
  sufficient by itself once cells cease to form an exact Voronoi diagram; use polygon-aware lookup for
  containment-dependent interactions while preserving explicit nearest-point query behavior.
- Recompute or invalidate affected areas, path lengths, measurer values, and geometric caches. Do not
  rerun climate, hydrology, population generation, political assignment, or economic simulation.
- Preserve explicit user overrides such as a manually entered journey duration; update derived values
  according to the owning module's existing rules.
- Inventory coordinate-owning modules and grid-dependent consumers before implementation. Each must
  use the common deformation or have an explicit fixed-placement rule; hidden layers cannot be skipped.

### History and persistence

- Each stroke stores before/after changes for all affected geometry, entity coordinates, and override
  records. Undo, redo, reset, and cancellation restore the whole change atomically.
- Starting a new stroke after undo discards the redo branch. Reset affects only the current session,
  preserving edits loaded from disk or completed before the tool was opened.
- Keep history bounded and store changed records rather than full-world snapshots per pointer event.
  Retain the tool-opening baseline needed by Reset even when older undo entries are evicted. Indicate
  when the oldest retained history point has been reached.
- Loading or generating another map clears history and exits the tool. Unrelated map edits end the
  current session rather than leaving undo records that refer to changed or deleted entities.
- Extend existing graph override persistence for coordinates regenerated on load, including moved cell
  anchors. Persist entity coordinates through their owning map records. Preserve original positions
  needed for displacement limits and avoid applying saved entity movement twice.
- Existing vertex-only graph overrides remain readable. New files must reproduce the same edited world
  after load and redraw, including coordinates, derived measurements, feature associations, and style.
- A graph rebuild must restore compatible edits as one consistent set. If a terrain change makes a set
  incompatible, discard that set consistently and report it rather than restoring only its coastline
  or leaving displaced attachments behind. Do not reuse an ID without validating its original geometry.

### Complete coastline editor removal

- Remove the coastline vertex editor and its coastline-click opener, vertex handles, dialog, registry
  entry, and obsolete listeners. Clicking a coastline must no longer open a dedicated editor.
- Remove the separate Coastline Settings Editor dialog and Tools entry as well. Preserve roughness
  presets, coastline generation settings, group styling, and feature-to-group assignments through the
  coastline section of Style. Do not delete the coastline generator or renderer.
- Provide coastline group management and feature assignment in Style, including selection of the
  coastline to assign. Preserve existing saved group IDs and appearance.
- Update help, tooltips, and domain documentation to point shape editing to Wrap and appearance editing
  to Style. Remove dead imports, selectors, and Controller registrations.
- Lake property editing remains available for lake-specific data and appearance. Its geometry editing
  must use the shared safeguards and synchronization; it must not bypass Wrap's validity guarantees.

### Module boundaries and performance

- **Wrap Controller:** owns the dialog, gestures, editing lifecycle, and renderer updates.
- **Deformation module:** accepts world geometry and brush movement, validates the proposed deformation,
  and returns one accepted change with affected IDs and limit feedback. Encapsulate falloff, geometry
  constraints, and position mapping behind a small interface independent of the DOM.
- **Edit transaction/history module:** applies, commits, cancels, and restores complete changes. Keep
  graph override recording and derived-data refresh batched rather than repeated for every moved vertex.
- **Existing domain modules and IO:** own entity-specific geometry, derived values, compatibility, and
  persistence. Use the common position mapping rather than separate brush algorithms per layer.
- **Existing renderers and layer registry:** render accepted state and refresh affected visible layers;
  hidden layers render correctly when next shown. Rendering must not become the source of geometry.
- Reuse brush overlays, sliders, dialog helpers, and existing interaction conventions where appropriate.
  New implementation modules use TypeScript and require no new production dependency.
- Query nearby geometry spatially and schedule previews at most once per animation frame. Avoid full
  map serialization or redraw on every pointer event. Update dependent content coherently in the preview
  and finalize expensive derived work once per stroke where safe.
- Validate responsiveness at ordinary map density and the supported 100k-cell configuration. Record the
  test machine, brush sizes, frame times, stroke completion times, and history memory; tune limits from
  that evidence before release.

## Testing Decisions

Test externally observable behavior and map invariants rather than internal helper calls or snapshots
of dialog markup. The following test coverage is proposed for implementation:

- **Deformation:** known small meshes covering falloff, unaffected points outside the radius, equivalent
  pointer paths sampled at different rates, repeated-stroke limits, narrow cells, crossed edges,
  collapsed cells, map borders, and safe rejection of invalid input. Validate the accepted batch as a
  whole, including interactions between simultaneously moved vertices.
- **Attachment consistency:** fixtures with a port, connected route, river junction, custom label path,
  marker, and grid-derived overlay. Verify shared endpoints remain coincident and hidden-layer redraw
  agrees with edits made while visible.
- **History:** exact state restoration after stroke, cancellation, undo, redo, branching, reset, history
  eviction, and session termination. Include entity positions, original baselines, and graph overrides.
- **Persistence:** save/load/redraw round trips, legacy vertex-only edits, repeated load without double
  displacement, compatible graph rebuilds, and consistent invalidation of incompatible edit sets.
- **Spatial queries and measurements:** clicks on both sides of a moved boundary select the correct
  cells; affected areas and lengths change and return to their original values after undo.
- **Controller integration:** wheel resizes without zoom, inputs retain native editing behavior,
  navigation creates no edits, closing restores default events, and opening repeatedly does not duplicate
  listeners. Cover removal of both coastline dialogs and access to migrated Style controls.
- **Prior art:** existing graph override tests cover original/custom positions, derived areas, and
  restoration against rebuilt graphs. Packed-graph query tests cover spatial lookup behavior. Existing
  brush utilities and heightmap history provide interaction conventions to reuse.
- Run relevant Vitest tests, lint, and build during implementation. Perform a manual interaction and
  performance pass; follow the repository rule against automatically running Playwright during
  development. This PRD alone does not require application tests.

## Acceptance Criteria

1. Tools opens a single Wrap Tool dialog with working brush size, strength, undo, redo, reset, help, and
   close controls, plus the heightmap guidance message.
2. The same brush edits a coastline, lake shore, and inland boundary; wheel sizing and navigation work
   without conflicting gestures.
3. Nearby geographic content follows the accepted deformation, including content on hidden layers;
   displayed boundaries, cell selection, and dependent measurements agree.
4. Invalid movement is limited with feedback, and repeated strokes or save/load cannot bypass limits.
5. Undo, redo, cancellation, and session reset restore complete state without detached features.
6. Save/load and supported exports preserve the edited result. Legacy coastline edits and styles survive.
7. Both standalone coastline dialogs and their entry points are gone. Coastline appearance and group
   controls remain accessible through Style.
8. Closing or switching maps restores normal interaction and leaves no brush overlays, stale listeners,
   or history referencing the previous world.
9. Focused correctness tests pass and the recorded large-map performance check demonstrates usable
   continuous dragging without work accumulating behind the pointer.

## Out of Scope

- Creating or deleting land, water, islands, lakes, cells, routes, or rivers through the brush.
- Changing elevation values, cell adjacency, region membership, or procedural simulation results.
- Unrestricted continental-scale deformation or a mode that bypasses geometry validation.
- Additional brush modes such as rotate, inflate, pinch, smooth, or regional restore in the first release.
- A general application-wide history system or history persisted across saved files.
- A redesign of all editors, a full rewrite of map state, or broad restructuring of the main HTML template.

## Further Notes

- The supplied screenshot is a visual interaction reference. It does not introduce requirements beyond
  the user's request and the decisions documented here.
- Watabou's [Warp tool introduction](https://watabou.itch.io/medieval-fantasy-city-generator/devlog/22794/052-warp-tool)
  describes deformation of an existing mesh while preserving its connections. FMG has separate graph
  and entity coordinate representations, so consistent propagation is a core implementation requirement.
- This document supersedes the earlier suggestion to retain a separate coastline grouping/style dialog:
  the user's latest direction is complete removal of the coastline editor.
