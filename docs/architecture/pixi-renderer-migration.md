# PixiJS renderer migration plan

## Status

This document is the implementation roadmap for replacing the interactive SVG renderer with PixiJS. As of the
2026-08-20 hard-cutover decision, the legacy renderer is not a supported fallback or compatibility target. Temporary
SVG/HTML may remain only for not-yet-migrated layers and active interaction controls while this branch is in progress.

In this document, **total conversion** means that PixiJS is the only persistent renderer for the interactive map.
The application may still use HTML for panels and accessible controls and a small HTML/SVG overlay for active editor
handles. Export must be rebuilt from domain/scene data or Pixi render targets; cloning or reconstructing the legacy
live SVG renderer is explicitly out of scope.

The former opt-in experiment is retained only as historical context in
[pixi-renderer-prototype.md](pixi-renderer-prototype.md).

## Implementation progress

- The renderer now boots unconditionally after generation/load. The prototype flag, theme switch, disable path,
  console global, and lazy SVG materializer have been removed. Migrated layers have a one-way Pixi owner.
- Pixi uses a viewport-sized HTML surface, shares the D3 camera transform, reacts
  to SVG resizing, and enables culling on suitable display objects.
- S-002 retained cell topology is implemented: stable typed positions and indices, per-cell triangle ranges and bounds,
  and revision-aware CPU reuse are available without DOM or Pixi dependencies.
- R-001 through R-003 now include the typed renderer contract, camera state, canonical layer registry, one-owner
  coordinator, typed invalidation coalescing, and an on-demand scheduler. Classic application scripts dispatch typed
  bridge events and no longer call or expose `window.PixiMapPrototype`.
- S-001 and L-001 are implemented for state and biome fills: semantic renderer style is serialized in application
  state, scene construction no longer reads DOM styles, both layers use retained indexed meshes simultaneously, and
  assignment changes update color attributes without rebuilding topology.
- M5 now also owns culture, religion, province, and zone fills. All five single-assignment thematic layers share
  retained cell topology, independently update attributes and opacity, and render in canonical order. Zones use
  ordered per-zone polygon batches because memberships can overlap and cannot be represented by one assignment value
  per cell. The classic isoline/zone-path draw branches and synchronous SVG/Pixi ownership-request bridge are deleted.
- M6 owns state/province borders, explicit cell outlines, the procedural grid, temperature, and precipitation. Cell
  edges and all ten grid pattern types are renderer-neutral clipped line batches. Climate rendering receives the
  high-resolution generation grid through an explicit render-world snapshot; temperature emits ordered contour bands
  and labels, while precipitation emits one batched circle scene. Their semantic style and visibility are persisted.
  The persistent SVG cell, grid, temperature, and precipitation renderers have been deleted; heightmap-edit cell
  geometry remains only as a transient editing overlay. Camera-aware grid density, zoom-stable strokes, contour visual
  acceptance, dense-layer performance, and shared picking geometry remain open for this milestone.
- The first M7 line slice gives rivers and routes renderer-neutral scenes and Pixi ownership. Rivers are deterministic
  variable-width polygons; routes are Catmull-Rom line paths grouped by semantic route role, including Pixi-side dash
  rendering. Their classic persistent draw branches are deleted. River and route editors now accept domain IDs and
  place only the active edit path and control handles in the transient `#debug` overlay; creators and overviews no
  longer create, locate, style, or measure paths through `#rivers` or `#routes`. Direct Pixi picking and hover/basin
  highlighting remain M9 work, so controls that depended on persistent path nodes are not retained as compatibility
  shims.
- The next M7 point-symbol slice moves burg icons, port anchors, and markers to one-way Pixi ownership. Their persistent
  SVG renderers and globals are deleted, generation/load redraws now issue typed invalidations, and marker filters and
  pinned-only display state are transient renderer inputs rather than attributes on `#markers`. Burg symbols are
  grouped into semantic vector batches; marker pins use cullable domain-ID containers with zoom-aware sizing, emoji
  text, reference-counted external-image textures, and an explicit missing-image placeholder. Burg relocation and
  marker dragging update domain entities and use only transient `#debug` controls. Saved presets translate burg and
  marker styling into the serialized `mapRenderer` subtree. Texture-atlas packing, direct Pixi picking, and visual
  acceptance across presets remain open for M7/M9.
- The M7 economic/ice slice moves ice polygons, visible-good production cells and resource symbols, burg production
  plates, market territories, borders, and centers into renderer-neutral scenes with stable domain IDs. Pixi owns the
  three layers in canonical order and reference-counts goods symbol textures through the shared cache. Their semantic
  styles and visibility now round-trip through application style state and preset adapters. The live `#ice`, `#goods`,
  `#goodsCells`, `#goodsIcons`, `#goodsBurgs`, and `#markets` creation/render paths are removed; old serialized groups
  are import input only and are purged before Pixi paints. Direct hover highlighting and the ice/goods/market editing
  gestures that formerly selected persistent SVG nodes intentionally await M9/M10 rather than receiving compatibility
  shims.
- The following M7 entity slice moves rural/urban population bars and military regiment badges into renderer-neutral
  scenes. Population emits stable cell/burg line IDs; regiment badges retain state/regiment IDs, rotations, totals,
  state colors, emoji, and reference-counted external icon textures with missing-asset placeholders. Both layers now
  use semantic style and persisted visibility, render in canonical Pixi order, and invalidate from domain mutations.
  The viewport population reconciler, live `#population`/`#rural`/`#urban` groups, live `#armies` renderer, regiment
  SVG transitions, and their SVG export fixups are removed. Regiment selection, hover, attack/attach targeting, and
  editor handles remain explicit M9/M10 work rather than compatibility branches.
- The final M7 overlay slice moves the compass rose and trade markers to Pixi. Compass placement, scale, opacity, and
  preset import now use semantic style; its historical defs element is read once as a texture source and no live
  `#compass` group is created. Trade retains its renderer-neutral route pathfinder and uses a requestAnimationFrame
  scheduler only while visible markers exist, with deterministic stop/destroy cleanup, Pixi wagon/ship textures, and
  a Pixi path highlight. The live `#tradeAnimation` group, D3 transitions, SVG marker-symbol loader, and compass/trade
  save/export fixups are deleted. Marker picking and draggable compass placement remain M9/M10 work rather than
  compatibility shims.
- Current-format saves explicitly serialize migrated layer visibility. Loading prefers that state instead of inferring
  visibility from SVG child paths, while older files may still use their SVG contents as a best-effort import hint.
  The style UI and style presets now write thematic opacity into semantic renderer style and invalidate Pixi.
- R-004 now has resource byte/count accounting, an adaptive DPR policy bounded by viewport pixels and device memory,
  deterministic WebGL context listener cleanup, context-restoration reconstruction scheduling, and repeated
  destroy/remount unit coverage. Relief textures use a reference-counted, concurrent-load-deduplicating LRU cache with
  a byte budget; retained geometry and cached textures have lifecycle tests proving that clear returns accounting to
  baseline. Browser-verified reconstruction and GPU/heap memory evidence remain open.
- M2 scene contracts now define renderer-neutral polygon, line, circle, sprite, label, hit-region, and mask primitives. State
  and biome fills build polygon batches from retained topology, relief builds a pure sprite-instance batch, and Pixi
  consumes both scene outputs. Borders emit stable line batches with domain IDs and bounds and are drawn directly with
  Pixi graphics. World/topology/layer revision tokens advance from typed invalidations.
- S-003 now has a pure base-geography builder for the ocean rectangle, grouped land and lake polygon paths, coastline
  paths, and ordered include/exclude land and water masks. Feature shaping and boundary clipping are renderer-neutral,
  and Pixi consumes the ocean, landmass, lake, and coastline outputs in canonical order. Depth bands, patterns, and
  visual parity remain part of M4.
- V-001 now has an editor-free mount/update/destroy API, a static typed world fixture, and a separate production build.
  The first build proves that the production renderer can be lazy-loaded without the classic scripts and records its
  bundle and asset assumptions in [pixi-viewer-spike.md](pixi-viewer-spike.md). Browser startup and embed proof remain
  open.
- Q-001 now has deterministic 10k/50k/100k seed recipes, a checked-in legacy fixture, fixed reference profiles, a
  versioned report contract, separate scene-build/GPU-submit instrumentation, and a two-run SVG/Pixi benchmark command.
  Checked-in reference measurements still require browser execution on the documented profiles.
- P-001 was retired by the hard-cutover decision. Save no longer materializes Pixi-owned SVG layers, and legacy SVG
  export is allowed to omit migrated content until M11 replaces it with scene/Pixi export.
- The first M11 raster slice is implemented for viewport PNG/JPEG: export requires the live Pixi renderer, draws its
  canvas as the authoritative base, then composites only not-yet-migrated SVG overlays. Offscreen full-map rendering,
  maximum-texture detection, and Pixi-backed tile export remain open.
- The Phase 2 exit gate is not complete until camera benchmarks, resize/alignment screenshots, multiple browsers, and
  WebGL context-loss recovery are verified.

## Why migrate

The current SVG renderer is valuable for vector output and DOM-based editing, but its cost grows with the number of
visible paths, text nodes, symbols, filters, and mutations. The migration should improve:

- pan and zoom frame consistency on large maps;
- layer toggle and redraw latency;
- memory use during long editing sessions;
- the ability to embed a read-only map viewer in another website;
- renderer isolation from the serialized world model.

PixiJS only helps when it replaces work. Rendering the full SVG map and then covering it with a Pixi canvas is not a
performance architecture.

## Success criteria

Measure the same fixed map fixtures on the same browser and hardware. Include 10k, 50k, and 100k requested-cell maps.

| Metric | Migration target |
| --- | --- |
| Pan/zoom | p95 frame time below 16.7 ms on the reference desktop at the default viewport size |
| Layer toggle | p95 visible response below 100 ms for a migrated static layer |
| Map redraw | At least 30% faster than SVG for the migrated layer set |
| DOM size | At least 60% fewer nodes below `#map` in read-only Pixi mode |
| Memory | No unbounded growth after 50 layer toggles and 20 map regenerations |
| Visual fidelity | No unexplained high-severity differences in reference screenshots |
| Persistence | Current-format `.map` round trips preserve domain and semantic style data |
| Export | Pixi raster export meets the M11 size, tiling, and cleanup gates |

Generation time is a separate metric. Pixi does not accelerate climate, topology, state expansion, economy, or other
procedural generators.

## Architectural target

```text
world data + semantic style
            |
            v
     renderer coordinator
              |
              v
       Pixi viewport ----> snapshot/export services
              |
              v
    canvas + HTML editing overlays
```

The world model must not contain Pixi objects, DOM nodes, GPU buffers, or textures. Runtime resources belong to the
renderer and are disposable caches.

### Renderer contract

Introduce a small renderer interface before migrating many layers:

```ts
interface MapRenderer {
  mount(surface: HTMLElement): Promise<void>;
  render(world: PackedGraph, style: MapStyle, invalidation: RenderInvalidation): Promise<void>;
  resize(viewport: ViewportSize): void;
  setCamera(camera: MapCamera): void;
  setLayerVisibility(layer: MapLayerId, visible: boolean): void;
  pick(point: ScreenPoint): MapHit | null;
  destroy(): void;
}
```

The exact types can evolve. The important properties are explicit ownership, idempotent rendering, typed inputs, and
resource cleanup.

### Renderer coordinator

The coordinator decides which backend owns each live layer. A layer must have one live owner. It should:

- dispatch invalidations instead of calling global drawing functions;
- preserve canonical layer ordering;
- assign migrated layers permanently to Pixi and reject duplicate live owners;
- expose diagnostics and per-layer timings;
- expose diagnostics and fail visibly when the mandatory renderer cannot start.

The prototype's `ownsLayer` check is a temporary bridge for classic scripts, not the final coordinator API.

### Scene preparation

Separate geometry preparation from painting. Each migrated layer should have a pure, testable scene builder:

```text
pack + semantic style -> layer scene data -> Pixi resources
                                  `-------> export data (M11)
```

Examples of renderer-neutral scene data are polygon batches, polyline strips, label runs, sprite instances, and hit
regions. Both renderers should consume the same geometry where practical. `buildBorderPaths` is the first extraction
in this direction.

### Camera and surfaces

The final Pixi canvas should be an HTML sibling of the SVG/overlay surface, not an SVG `foreignObject`.

- Keep camera state as `{x, y, scale, viewportWidth, viewportHeight}`.
- Apply the same state to Pixi containers and editing overlays.
- Resize the renderer to viewport pixels, not full map pixels.
- Use device-pixel ratio adaptively and cap it on large or low-memory devices.
- Render only on invalidation; do not run a permanent animation loop for a static map.

This avoids allocating a full-map high-resolution canvas and makes viewport culling natural.

## Layer strategy

### GPU-native base layers

Migrate these first because they are numerous, mostly static, and have straightforward hit testing:

1. ocean and land base;
2. state, biome, culture, religion, and province fills;
3. borders and coastline;
4. rivers and routes;
5. relief, burg, marker, good, market, ice, and military sprites.

Use shared geometry buffers and instance data where possible. Avoid one Pixi `Graphics` object per cell or entity.

### Labels

Labels need a dedicated milestone, not an incidental conversion.

- Load and validate fonts before measuring or placing text.
- Cache glyphs through bitmap or signed-distance-field atlases.
- Preserve curved labels, letter spacing, multiline labels, zoom bounds, and label groups.
- Treat missing text features as explicit migration defects; do not route them through the old live renderer.

### Editing overlays

Editors can initially remain in SVG or HTML above Pixi. The overlay should contain only active handles, selection
outlines, brush previews, and other transient controls—not a hidden copy of every map layer.

Picking should move from DOM event targets to a renderer-independent hit-test service:

- cell lookup from the Voronoi data for area tools;
- spatial indexes for point and line entities;
- stable domain IDs in hit results;
- no Pixi display object references in controllers.

## Current phase-level roadmap

These phases record the broad migration sequence and the work already attempted by the prototype. The executable
milestones later in this document refine them into mergeable outcomes. Use the milestone IDs for new issues and pull
requests.

### Phase 0: benchmarks and fixtures

- Add deterministic reference maps at small, medium, and large sizes.
- Record generation, scene-build, upload, first-paint, layer-toggle, and camera frame timings.
- Record DOM nodes, GPU/canvas resolution, JS heap when available, and long tasks.
- Capture SVG reference screenshots for the major presets.
- Define the reference desktop and a constrained mobile profile.

Exit gate: repeatable numbers can distinguish generator, geometry, paint, and camera costs.

### Phase 1: ownership and duplicate-work removal

- Add a renderer ownership decision at the layer dispatcher.
- Skip live SVG creation for Pixi-owned layers.
- Extract border geometry from SVG mutation code.
- Make missing Pixi ownership or startup fail explicitly instead of restoring legacy rendering.
- Allow vector output to omit migrated layers until it is replaced by a renderer-neutral exporter.

Exit gate: the live DOM does not contain duplicate migrated layers, there is no disable/fallback path, and raster
export consumes the Pixi output rather than reconstructing SVG geometry.

### Phase 2: viewport-native canvas and camera

- Move the canvas out of `foreignObject` into the map viewport stack.
- Share one typed camera state between zoom controls, Pixi, and editing overlays.
- Size the canvas to the viewport and implement culling bounds.
- Add adaptive resolution and context-loss recovery.

Exit gate: camera benchmarks beat SVG, resize is stable, and there is no drift between canvas and overlays.

### Phase 3: retained geometry and incremental invalidation

- Replace rebuild-on-every-change with per-layer caches.
- Upload stable vertex/index buffers once and update color or visibility attributes independently.
- Track invalidations such as `camera`, `style.states`, `geometry.borders`, or `entity.burg:42`.
- Destroy replaced GPU resources deterministically.

Exit gate: style and visibility changes avoid full map tessellation and memory remains bounded.

### Phase 4: base-map parity

- Migrate ocean layers, land, lakes, coastline, textures, height presentation, and masks.
- Implement supported hatching and pattern fills with textures or shaders.
- Establish canonical z-order tests.
- Document intentional differences for SVG-only filters.

Exit gate: political, biomes, cultural, religions, provinces, physical, and heightmap presets are usable.

### Phase 5: lines and sprites

- Migrate rivers, routes, grid, borders, relief, burgs, markers, ice, goods, markets, and military.
- Use line meshes suitable for zoom-stable widths and joins.
- Use texture atlases and instancing for repeated icons.
- Cull by viewport plus a size-aware margin.

Exit gate: common read-only maps no longer require persistent SVG feature layers.

### Phase 6: labels

- Implement font loading, glyph atlases, plain and multiline text.
- Add curved path text and label-group zoom rules.
- Compare label placement across bundled presets and representative user fonts.

Exit gate: label readability and placement are acceptable at normal viewing scales; unsupported fonts or effects are
reported explicitly and do not invoke legacy rendering.

### Phase 7: editor integration

- Add renderer-independent picking and selection.
- Move editors one at a time to world mutation plus invalidation events.
- Keep transient SVG/HTML handles where they provide better accessibility or interaction.
- Remove controller dependencies on persistent rendered SVG paths.

Exit gate: all core editors work without reconstructing the full SVG map.

### Phase 8: embedding package

- Expose a read-only `FantasyMapViewer` API with `mount`, `load`, `setCamera`, `setLayers`, `resize`, and `destroy`.
- Support direct module embedding and an iframe wrapper for untrusted or version-isolated hosts.
- Keep CSS scoped and avoid application globals in the viewer entry point.
- Define asset-base URL, font, CORS, content-security-policy, and worker behavior.
- Publish a versioned viewer data contract rather than exposing the mutable internal `pack` object.

Exit gate: a minimal external page can load a map, resize it, control layers, and dispose it without the editor shell.

### Phase 9: hard cutover and cleanup

- Boot Pixi unconditionally and remove renderer flags, themes, disable paths, and materialization bridges.
- Compare current performance and visual evidence against checked-in historical SVG baselines only.
- Delete each SVG live-render path as soon as its Pixi owner and editor integration are usable.
- Reintroduce vector output only from renderer-neutral scene data if it remains valuable.

Exit gate: Pixi is the mandatory interactive renderer and no legacy renderer path is callable.

| Existing phase | Executable milestone mapping |
| --- | --- |
| Phase 0 | M0 |
| Phases 1–2 | Prototype evidence feeding M1; their production lifecycle and quality gates are not yet complete |
| Phase 3 | M2–M3 |
| Phase 4 | M4–M6 |
| Phase 5 | M6–M7 |
| Phase 6 | M8 |
| Phase 7 | M9–M10 |
| Phase 8 | M12 |
| Phase 9 | M13–M14 |
| Cross-cutting save/export work | M11 |

## Save, load, and export

- Do not add Pixi runtime objects to `.map` serialization.
- Preserve domain-data loading where practical, but do not serialize or materialize Pixi-owned SVG layers.
- Store semantic renderer style with application style data, never as computed SVG presentation.
- Build raster export from Pixi render targets and optional vector output from renderer-neutral scene data.
- Raster export may render Pixi to an offscreen target, but must account for maximum texture size and tiled output.
- Test save/load round trips with Pixi enabled and disabled.

## Styling migration

Pixi should consume the semantic style model described in [architecture.md](architecture.md), not computed SVG styles.
For each layer:

1. define and serialize its typed style subtree;
2. migrate preset selector values into that subtree;
3. make controllers update style state;
4. make Pixi and export consumers use the same state;
5. remove DOM style reads from the normal Pixi path.

Computed SVG style reads are prohibited in migrated rendering paths.

## Testing and quality gates

Every migrated layer should add:

- unit tests for scene-data generation and invalidation decisions;
- deterministic screenshot comparisons at representative zoom levels;
- layer toggle and z-order interaction tests;
- save/load and Pixi raster export coverage;
- context loss, resize, device-pixel-ratio, and destroy/remount tests;
- performance measurements against the fixed fixtures;
- memory checks after repeated rebuilds and map changes.

Test WebGL 2 first. Keep WebGPU an optional future backend selected by Pixi when its browser support and visual
behavior are suitable; do not make the migration depend on it.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Pixi is slower because geometry is rebuilt | Retain buffers and use granular invalidations |
| Large GPU allocations | Viewport-sized targets, culling, adaptive resolution, resource budgets |
| Loss of SVG visual effects | Catalogue effects, implement high-value equivalents, and record intentional removals |
| Text fidelity regressions | Separate label milestone and fail explicitly for unsupported cases |
| Editors coupled to SVG nodes | Introduce domain-ID picking and transient overlays |
| Save/export loses hidden layers | Snapshot visibility/style state and export from Pixi/neutral scenes |
| WebGL context loss | Recreate resources from scene caches and show a recoverable renderer error state |
| Bundle growth | Keep Pixi code-split and create a minimal viewer entry point |
| Migration stalls in permanent dual rendering | Enforce one live owner per layer and phase exit gates |

## Immediate backlog

The ordered, executable backlog is defined in [First execution tickets](#first-execution-tickets). The next technical
milestone is retained cell geometry and semantic style inputs, not another direct translation of an SVG draw function.

## Scope and completion boundary

The migration is complete only when all of the following are true:

- Pixi owns every persistent interactive map layer in the editor and read-only viewer.
- There is no complete live SVG map, hidden SVG fallback, or DOM tree used as the source of rendering truth.
- Layer visibility, ordering, style, camera, selection, and invalidation are typed application state.
- Controllers mutate world or style state and publish invalidations; they do not query or rewrite rendered paths.
- Picking returns domain IDs and geometry information without exposing Pixi display objects to tools.
- Save and load serialize domain data and semantic styles, never Pixi resources.
- SVG export is generated from renderer-neutral scene data instead of cloning the live map DOM.
- Raster export can render maps larger than the GPU maximum texture size using tiled output.
- A read-only viewer can be imported without the editor shell, classic globals, or D3 v5.
- The prototype globals, layer-ownership bridge, and classic draw dispatcher are removed.
- Existing supported `.map` files still load through the legacy data migration path.

The following are deliberately outside the conversion boundary:

- replacing HTML application panels with Pixi;
- accelerating procedural world generation;
- removing SVG as a vector file format;
- forcing editor handles into Pixi when HTML or a small SVG overlay is more accessible;
- changing the `.map` schema merely to match the renderer.

## Workstreams

The work is organized into independently reviewable workstreams. Milestones later in this document state which
workstreams they depend on.

| ID | Workstream | Required result |
| --- | --- | --- |
| R | Renderer platform | Lifecycle, camera, layer registry, ordering, invalidation, diagnostics, resource ownership, and recovery |
| S | Scene and style | Renderer-neutral scene builders and typed semantic style inputs |
| L | Layer conversion | Pixi implementations for all persistent map layers with no duplicate live owner |
| I | Interaction and editors | Domain-based picking, selections, tools, and transient overlays |
| T | Text and symbols | Font loading, label layout, glyph caches, icon atlases, emblems, and zoom rules |
| P | Persistence and export | Compatible load/save plus scene-driven SVG and tiled raster export |
| V | Viewer and embedding | Editor-free package, stable viewer contract, asset loading, isolation, and disposal |
| C | Classic cleanup | Removal of live SVG assumptions, D3 v5 globals, bridge functions, and obsolete scripts |
| Q | Quality | Fixtures, visual comparisons, performance budgets, memory checks, and browser coverage |

R, S, and Q are the critical foundation. Layer work can then proceed in clusters. I, P, and V can proceed alongside
later layer clusters once the renderer and scene contracts are stable. C completes incrementally, but its final steps
must wait for editor and export parity.

## Target module boundaries

The names below are a proposed layout, not an instruction to move unrelated code in one large refactor. Create each
boundary when its first real consumer is migrated.

```text
src/renderers/
  core/
    map-renderer.ts          # backend contract and lifecycle
    renderer-coordinator.ts  # one live owner and canonical ordering
    camera.ts                # renderer-independent camera state
    invalidation.ts          # typed invalidation events and coalescing
    layer-registry.ts        # IDs, dependencies, visibility, and order
    render-diagnostics.ts    # timings, counts, GPU estimates
  scene/
    world-scene.ts           # stable snapshot/version used by builders
    styles.ts                # semantic styles, never computed DOM styles
    layers/                  # pure geometry/instance/label builders
    spatial-indexes/         # shared point, line, and area indexes
  pixi/
    pixi-map-renderer.ts
    resource-cache.ts
    render-scheduler.ts
    layers/                  # Pixi consumers of layer scene data
    text/                    # font and glyph atlas resources
  svg-export/
    svg-export-renderer.ts   # vector output from the same scene contracts
src/interactions/map/
  picking.ts
  selection.ts
  tool-overlay.ts
src/viewer/
  fantasy-map-viewer.ts
  viewer-entry.ts
  viewer-data.ts
```

`src/renderers/pixi/pixi-map-prototype.ts` should be decomposed into these boundaries rather than renamed wholesale.
Existing renderers can move only as they become independent of the DOM. This keeps changes small and makes it clear
which legacy assumptions remain.

### Stable contracts

Keep four different kinds of state separate:

| State | Examples | Owner | Serializable |
| --- | --- | --- | --- |
| World | cells, features, states, rivers, burgs | world model | yes |
| Semantic style | colors, widths, patterns, font roles, visibility defaults | style store | yes |
| View | camera, visible layers, selection, active tool | application/viewer | optionally |
| Runtime resources | Pixi containers, buffers, textures, glyph atlases | renderer | no |

Scene builders should accept immutable or versioned views of world and style state. A builder result should carry
domain IDs, bounds, and a version so the renderer can update only the affected buffers. The renderer coordinator is
the only component allowed to decide which backend owns a live layer.

## Canonical layer conversion inventory

Every group created by the classic `public/main.js` layer stack must have an explicit destination. “UI overlay” below
means transient interaction or viewport decoration, not a persistent duplicate of map content.

| Layer family | Current data/source | Pixi representation | Interaction and dependencies | Target milestone |
| --- | --- | --- | --- | --- |
| Ocean, landmass, feature masks | `pack.features`, map dimensions, ocean pattern settings | Full-screen meshes, feature polygons, reusable pattern textures | Base clipping/masking; no entity picking | M4 |
| Ocean depth layers and patterns | feature geometry and style selectors | Tessellated bands or shader/material parameters | Depends on semantic pattern support | M4 |
| Texture and satellite presentation | style state and generated/loaded image assets | Tiled sprites or shader pass | Asset/CORS rules; export equivalence | M4 |
| Heightmap and terrain presentation | cell heights and height style | Retained cell mesh with color attribute or generated texture | Heightmap editor invalidates subsets | M3/M4 |
| Lakes and coastline | feature geometry and lake/coast styles | Polygon fills and line meshes | Feature IDs; coastline tools | M4/M10 |
| Biomes and cells | `pack.cells.biome`, cell polygons | Shared indexed cell mesh with palette/attribute updates | Cell lookup and brush edits | M3/M5/M6/M10 |
| Grid and coordinates | grid settings and viewport/map bounds | Procedural line/text batches | Camera-aware density; normally not pickable | M6/M8 |
| Compass | style and position | Atlas sprite or small vector mesh | Draggable placement if supported | M7/M10 |
| Rivers | river geometry and style | Batched polyline/triangle meshes | River ID, edit nodes, width/zoom behavior | M7/M10 |
| Relief icons | cell relief placement and icon set | Culled atlas instances | Cell/domain IDs; icon asset loading | M7 |
| Culture, religion, state, province, zone fills | packed assignments and boundary geometry | Shared fill mesh plus palette textures/attributes | Area picking and brush/merge editors | M3/M5/M10 |
| State and province borders | shared boundary paths | Batched line meshes with separate style ranges | Shared geometry with fills; stable joins | M6 |
| Routes | route geometry and route groups | Batched line meshes | Route ID, node editing, hit tolerance | M7/M10 |
| Temperature and precipitation | climate cell values and isolines | Retained fill mesh and line batches | Legend/style dependencies | M6 |
| Ice | ice geometry and style | Polygon meshes or atlas sprites by kind | Ice entity editing | M7/M10 |
| Population | rural/urban values | Instanced bars or markers | Burg/cell IDs and scale rules | M7 |
| Goods, markets, trade animation | economic entities and routes | Atlas instances and optional animated line particles | Explicit animation scheduler; entity picking | M7/M10 |
| Burg icons and anchors | burg data and group style | Atlas instances | Burg ID, drag/place/select | M7/M10 |
| Labels | label data, groups, fonts, paths | Glyph atlas text plus curved-label geometry | Font readiness, collision/layout, label editing | M8/M10 |
| Emblems | heraldry data and placements | Generated texture atlas or cached render textures | State/province/burg IDs; atlas invalidation | M8 |
| Military | regiment data and icons | Atlas instances, small text batches, optional path previews | Regiment ID and drag/edit operations | M7/M10 |
| Markers | marker data and symbols | Atlas instances with grouped text as needed | Marker ID, placement and edit dialog | M7/M10 |
| Fogging | active fog mask | Render texture/mask | Brush invalidation and export rules | M9/M10 |
| Rulers and measurers | tool state | HTML/SVG tool overlay, optionally Pixi lines | Transient handles must remain accessible | M9/M10 |
| Selection, highlight, brush radius | active tool/selection state | HTML/SVG overlay or dedicated Pixi overlay layer | Never serialized; camera synchronized | M9 |
| Scale bar, legend, vignette | view/style state | HTML for accessible text or Pixi decoration where useful | Viewport anchored; export backend must reproduce it | M8/M11 |
| Debug overlays | diagnostic state | Disposable Pixi batches or HTML diagnostics | Development-only and excluded from save | M2/M9 |

For fill layers, avoid creating a `Graphics` or `Container` per cell. Prefer one stable triangulation for the cell
mesh, with layer-specific color/palette buffers. For point symbols, prefer atlases and instancing. For lines, group
compatible widths/materials into batches while retaining domain IDs in a CPU-side spatial index.

## Dependency and delivery sequence

```text
M0 fixtures and measurements
  -> M1 renderer platform
      -> M2 semantic styles and scene contracts
          -> M3 retained cells and invalidation
              -> M4 base geography
              -> M5 thematic fills
              -> M6 boundaries and climate
              -> M7 lines and point symbols
                  -> M8 labels, emblems, viewport decoration
                      -> M9 picking and overlay framework
                          -> M10 editor migration
          -> M11 save/load/export
          -> M12 standalone viewer
M4–M12 -> M13 legacy runtime removal -> M14 default rollout and cleanup
```

M11 can start with the first stable scene contracts; it does not need to wait for every layer. M12 can start when the
base geography and representative fills, lines, points, and labels are available. M10 is intentionally after picking
and overlay foundations so editors do not invent incompatible interaction paths.

## Executable milestones

### M0 — Reproducible baseline

Deliverables:

- deterministic 10k, 50k, and 100k requested-cell fixtures, plus at least one imported legacy `.map` fixture;
- a benchmark command/report that separates generation, scene building, GPU upload, first paint, layer changes, and
  camera frames;
- reference screenshots for the main style presets at fixed viewport sizes and zooms;
- DOM node, canvas resolution, JS heap where available, resource count, and long-task measurements;
- a checked-in description of reference desktop and constrained-device profiles.

Exit gate: two consecutive runs are stable enough to detect meaningful regressions, and reports identify whether time
is spent in generation, scene preparation, upload, or drawing.

### M1 — Production renderer platform

Deliverables:

- replace `window.PixiMapPrototype` with a typed `MapRenderer` implementation and lifecycle;
- introduce the coordinator, canonical layer registry, typed camera, render-on-invalidation scheduler, and diagnostics;
- make mount, resize, device-pixel ratio changes, destroy/remount, and WebGL context restoration deterministic;
- define a resource budget and cache eviction rules for textures, geometry, and glyph atlases;
- boot the production renderer unconditionally with no disable or fallback path.

Tests: lifecycle unit tests, resize/DPR screenshots, context-loss recovery, repeated mount/destroy memory check, and
camera alignment with the interaction overlay.

Exit gate: the prototype global is no longer an application dependency, and an empty/basic renderer survives all
lifecycle cases without a continuous ticker.

### M2 — Semantic style and renderer-neutral scenes

Deliverables:

- define typed, serialized style subtrees for migrated layers without computed DOM values;
- define scene primitives for polygon batches, line batches, sprite instances, labels, hit regions, masks, and bounds;
- add stable world/style revision tokens and typed invalidations;
- move shared geometry such as borders behind pure scene builders;
- prohibit computed SVG style reads in production Pixi consumers.

Tests: pure builder snapshots, style round trips, invalidation coalescing, stable domain IDs, and no-DOM builder tests.

Exit gate: at least one fill, line, and sprite layer can be built once and consumed by a test backend without DOM or
Pixi access.

### M3 — Retained cells and granular invalidation

Deliverables:

- triangulate cell polygons once per world topology revision;
- share stable positions and indices across height, biome, culture, religion, state, province, zone, temperature,
  precipitation, and other cell-derived views;
- update palettes or per-cell attributes without re-tessellating geometry;
- distinguish topology, assignment, style, visibility, camera, and single-entity invalidations;
- account for and destroy replaced GPU buffers.

Tests: partial attribute updates, topology replacement, palette changes, hidden-layer invalidation, resource disposal,
and 50-toggle/20-regeneration memory loops.

Exit gate: a cell fill style or assignment update does not rebuild unchanged polygon geometry and meets the layer
toggle target on the reference fixtures.

### M4 — Base geography and masks

Deliverables:

- ocean, ocean bands/pattern, landmass, feature masks, lakes, coastline, height presentation, texture, and supported
  physical-map effects;
- renderer-neutral pattern definitions with explicit fallback behavior;
- clipping and z-order that do not depend on SVG `<defs>`, filters, or element order;
- no reconstruction or materialization of the removed SVG base renderer.

Tests: political, physical, heightmap, and satellite preset screenshots; texture loading failures; clipping at map
edges; very large viewport and high-DPI behavior.

Exit gate: the visual foundation is usable with no persistent SVG base layers.

### M5 — Thematic area fills

Deliverables:

- biome, culture, religion, state, province, and zone fills using the retained cell representation;
- shared boundary/assignment revisions so an edited cell updates all dependent layers predictably;
- semantic opacity, color, pattern, and halo rules;
- domain IDs and bounds prepared for M9 picking.

Tests: all combinations of overlapping thematic layers, opacity/pattern presets, assignment edits, and z-order.

Exit gate: the major area presets render without live SVG paths and updates remain incremental.

### M6 — Borders, cells, grid, and climate overlays

Deliverables:

- state/province borders, explicit cell outlines, grid, temperature, precipitation, and other cell-derived overlays;
- zoom-stable line widths, documented join/cap behavior, and batch splitting only where styles require it;
- camera-aware grid/coordinate density to avoid building invisible detail;
- shared geometry between thematic areas, borders, and picking indexes.

Tests: line joins at representative zooms, border changes after assignments, dense-grid performance, and preset visual
comparisons.

Exit gate: thematic and analytical map modes no longer need persistent SVG geometry.

### M7 — Rivers, routes, icons, and entities

Deliverables:

- rivers and routes as retained line meshes;
- relief, burg, marker, good, market, ice, military, compass, population, and trade representations;
- texture-atlas build/loading strategy with missing-asset placeholders and reference counting;
- viewport culling with a margin derived from symbol or line size;
- animation scheduling only while a visible animated layer requires it.

Tests: atlas invalidation, zoom bounds, offscreen culling, line hit tolerance data, missing assets, and animation
start/stop cleanup.

Exit gate: a common read-only map has no persistent SVG feature layer except not-yet-migrated labels.

### M8 — Labels, emblems, and viewport decoration

Deliverables:

- deterministic font loading and font-role resolution before measurement;
- glyph atlas text for straight and multiline labels;
- curved-label geometry, letter spacing, group visibility, and zoom bounds;
- emblem texture generation/caching with invalidation by heraldry revision;
- scale bar, legend, vignette, and coordinate presentation with a documented HTML/Pixi/export owner.

Tests: bundled fonts, failed/custom font behavior, curved and multiline cases, different DPR values, zoom transitions,
atlas eviction, and reference screenshots.

Exit gate: normal viewing no longer needs live SVG labels, and unsupported text/effect cases fail explicitly rather
than silently reconstructing the removed renderer.

### M9 — Picking and interaction foundation

Deliverables:

- one screen-to-world transform shared by renderer, tools, context menu, and overlays;
- Voronoi/cell lookup for areas and spatial indexes for points and polylines;
- a `MapHit` result containing domain kind, stable ID, world position, distance, and optional sub-part metadata;
- selection/highlight/brush overlay APIs with accessible DOM events and pointer capture;
- deterministic precedence rules when multiple visible entities overlap.

Tests: transformed coordinate round trips, overlap precedence, zoom-dependent hit tolerance, invisible-layer behavior,
touch/pointer input, and overlay alignment after resize.

Exit gate: map inspection and selection work without reading event targets, SVG IDs, or path geometry from the DOM.

### M10 — Editor migration

Migrate editors in waves. For every editor, first move mutations into domain/style commands, then emit invalidations,
then replace DOM-derived selection and handles. Do not port a controller by giving it Pixi object references.

| Wave | Editors/tools | Primary dependency | Completion evidence |
| --- | --- | --- | --- |
| A | Cell inspection, context menu, layer information, read-only selection | M9 picking | No DOM target/path lookup |
| B | Burgs, markers, goods, markets, ice, compass placement | Point indexes and overlay handles | Create/select/drag/delete and undo path tested |
| C | Routes, rivers, rulers, measurers | Polyline indexes and node overlays | Node/segment edits update only affected scenes |
| D | Biomes, cultures, religions, states, provinces, zones | Cell lookup and assignment invalidation | Brush, merge, split, assign, regenerate tested |
| E | Heightmap, lakes, coastline, relief | Topology/feature revisions and masks | Topology changes safely rebuild dependent caches |
| F | Labels, emblems, military and specialized dialogs | Text/symbol resources | Group/style/entity edits survive save/load |

Each migrated editor must:

- read domain and style state rather than rendered attributes;
- issue a command/mutation with an explicit affected-domain result;
- publish typed invalidations;
- use `MapHit` and overlay handles;
- preserve keyboard, touch, tooltip, context-menu, and undo behavior where currently supported;
- have its legacy SVG branch removed once its parity gate passes.

Exit gate: all core editors operate with the SVG live renderer disabled, and no controller reconstructs the full SVG
map as a side effect.

### M11 — Persistence and export

Deliverables:

1. Serialize domain data, semantic `MapStyle`, visibility, and view metadata without Pixi objects or persistent layer
   markup. Current-format round trips are required; older SVG-centric files are best-effort imports, not a release gate.
2. Introduce an immutable `WorldSnapshot` plus semantic `MapStyle`/`RenderSnapshot` shared by editor and viewer.
3. Build raster export from Pixi/offscreen scene data with overlap-safe tiling, maximum texture-size detection, progress,
   and deterministic cleanup.
4. If vector output is retained, build it from renderer-neutral scene data as a separate exporter. It must never clone
   or reconstruct the removed live SVG renderer.

Tests: current round trips, maps with hidden layers and custom fonts/images, raster pixel dimensions, tiled seams,
canceled exports, and deterministic renderer cleanup.

Exit gate: save and raster export work when `#map` contains no persistent feature geometry.

### M12 — Standalone viewer and embedding

Deliverables:

- a tree-shakeable `FantasyMapViewer` package/API with `mount`, `load`, `setCamera`, `fitBounds`, `setLayers`, `pick`,
  `resize`, event subscription, and `destroy`;
- a versioned, read-only viewer data contract that does not expose mutable `pack` internals;
- an iframe wrapper for untrusted/version-isolated hosts and a direct module example for integrated hosts;
- configurable asset base URL, fonts, CORS/credentials policy, worker URL, renderer preference, resolution cap, and
  reduced-motion behavior;
- scoped CSS, no editor globals, no classic scripts, and no dependency on editor dialogs or jQuery UI;
- explicit errors for unsupported data versions or missing assets.

Tests: two viewers on one page, repeated mount/destroy, container resize, hidden tab restoration, cross-origin assets,
strict CSP example, iframe messaging, mobile gestures, and a bundle-size report.

Exit gate: an external static page can load and interact with a map without loading the generator/editor application.

### M13 — Classic runtime and global removal

Remove legacy code by dependency, not by file age:

| Legacy area | Must move before removal | Removal proof |
| --- | --- | --- |
| `public/modules/ui/layers.js` | layer registry, visibility state, coordinator dispatch, all layer scene builders | No application references to classic `toggle*`/`draw*` layer functions |
| `public/modules/ui/style.js` | typed semantic style actions and controls | No computed SVG style reads or direct layer attribute mutation |
| `public/modules/ui/style-presets.js` | versioned semantic presets and legacy preset conversion | Preset visual and serialization tests pass without SVG DOM |
| `public/modules/ui/options.js` | typed generation/view options and command handlers | No renderer changes performed through classic globals |
| `public/main.js` map bootstrap | typed application bootstrap, world store, viewport surface, layer registry | No global SVG layer selections are initialized |
| Global D3 v5 selections/zoom | imported geometry utilities where needed and the typed camera/input layer | No `d3.event`, global selection, or SVG zoom dependency remains |
| Prototype bridges | coordinator and renderer lifecycle | No `window.PixiMapPrototype`, renderer flag/theme, disable path, or lazy materializer |

Before deleting any classic symbol, search classic scripts, TypeScript, inline HTML handlers, tests, save/load migrations,
and external compatibility shims. Keep positional placeholders in the `.map` format and old data migrations even if
their original live renderer has gone.

Exit gate: the editor and viewer boot without classic rendering scripts or global SVG layer selections. Any remaining
legacy code is documented as data compatibility or unrelated editor UI, not interactive map rendering.

### M14 — Hard-cutover cleanup

Deliverables:

- unconditional Pixi startup and removal of every renderer selection/fallback branch;
- benchmark/diagnostic export that includes browser, GPU backend, fixture, layer set, and renderer version;
- a supported-browser matrix and graceful canvas/WebGL failure message;
- removal of comparison-only and migrated SVG paths immediately after ownership transfer;
- updated architecture, contributor, embedding, troubleshooting, and performance documentation.

Exit gate: Pixi is the single persistent interactive renderer, all completion-boundary items are checked, and deletion
candidates have passed the removal audit.

## Pull request slicing and acceptance rules

Use small vertical slices rather than a renderer-wide branch. A typical layer PR should include:

1. semantic style inputs and a pure scene builder;
2. a Pixi consumer with deterministic resource cleanup;
3. ownership registration and canonical z-order;
4. visual, interaction, invalidation, and performance coverage;
5. save/export behavior for the layer, which may intentionally break legacy SVG output before M11;
6. deletion of its obsolete live SVG path in the same slice.

Rules for every slice:

- one persistent live owner per layer;
- no new `window` API, DOM style dependency, or renderer object in world/controller state;
- no permanent ticker for static content;
- no full-layer rebuild for camera-only invalidations;
- fixtures and benchmark method must remain comparable to the baseline;
- intentional visual differences require a screenshot, rationale, and acceptance in the PR;
- resource counts must return to baseline after destroy or map replacement;
- renderer flags and runtime SVG/Pixi comparisons are prohibited; use checked-in baselines instead.

## First execution tickets

These are the first independently mergeable tickets, in dependency order:

1. **Q-001: deterministic benchmark fixtures.** Add 10k/50k/100k and legacy-load fixtures, a report schema, and the
   reference historical-SVG and current-Pixi measurements.
2. **R-001: typed renderer lifecycle.** Define `MapRenderer`, move mount/resize/camera/destroy out of the prototype
   global, and add lifecycle tests without changing visual ownership.
3. **R-002: layer registry and coordinator.** Encode canonical order, visibility, dependencies, and one-owner checks;
   adapt the existing ownership bridge to it.
4. **R-003: invalidation scheduler.** Add typed invalidations, coalescing, on-demand render scheduling, diagnostics,
   and tests proving camera events do not rebuild scenes.
5. **S-001: semantic state/biome styles.** Define typed inputs and a one-time adapter from existing style values; remove
   DOM style reads from their Pixi scene construction.
6. **S-002: retained cell topology.** Build stable vertex/index buffers, cell-to-triangle ranges, bounds, and topology
   revision tests.
7. **L-001: state and biome attribute updates.** Render both from shared retained cells, update colors/assignments
   incrementally, and benchmark layer toggles and edits.
8. **R-004: resource lifecycle and context recovery.** Add buffer/texture accounting, disposal, resolution caps, and a
   complete WebGL context reconstruction test.
9. **Q-002: visual reference harness.** Capture fixed Pixi views against checked-in historical baselines, z-order
   combinations, resize, and overlay alignment with an intentional-difference allowlist.
10. **P-001: retired.** The hard-cutover decision removed lazy SVG materialization and exact legacy SVG export as a
    migration requirement.
11. **S-003: base geography scene builders.** Extract ocean, landmass, lakes, and coastline without DOM or Pixi access.
12. **V-001: viewer contract spike.** Mount the production renderer through an editor-free entry using a static scene
    fixture; record bundle and asset assumptions before the API becomes difficult to separate.

After tickets 1–10, review the measured results. Continue the migration if retained geometry and camera performance
meet the targets; otherwise profile scene building, uploads, overdraw, batching, and resolution before converting more
layers.

## Final definition of done

- [ ] Every persistent layer in the canonical inventory has a Pixi owner and parity evidence.
- [ ] No hidden or background full SVG map is rendered during normal editor or viewer use.
- [ ] Camera, styles, visibility, ordering, selection, and invalidation are typed state.
- [ ] All core editors work through domain mutations, `MapHit`, and transient overlays.
- [ ] Current-format save/load round trips preserve domain and semantic renderer state.
- [ ] Pixi tiled raster export is independent of the live DOM; any retained vector exporter uses neutral scenes.
- [ ] The standalone viewer passes embedding, lifecycle, CSP, and multi-instance tests.
- [ ] Performance, memory, context recovery, visual, and browser gates pass.
- [ ] Classic layer/style rendering globals and prototype bridges are removed.
- [ ] Remaining SVG usage is limited to small documented UI/interaction overlays.
- [ ] Architecture and contributor documentation describe the new ownership model.
