# PixiJS renderer migration plan

## Status

This document is the implementation roadmap for migrating the interactive map viewport from SVG to PixiJS. It is
not a commitment to remove SVG everywhere. SVG remains the compatibility and vector-export backend until the Pixi
renderer reaches feature parity and the project has a renderer-independent export pipeline.

The opt-in experiment is described in [pixi-renderer-prototype.md](pixi-renderer-prototype.md).

## Implementation progress

- Phase 1 is implemented in the prototype: selected layers have one live owner, borders use shared geometry, and SVG
  fallback is materialized only for compatibility operations.
- Phase 2 is implemented for evaluation: Pixi uses a viewport-sized HTML surface, shares the D3 camera transform, reacts
  to SVG resizing, and enables culling on suitable display objects.
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
| Compatibility | Existing `.map` files load without schema changes or data loss |
| Export | SVG and raster exports remain visually usable throughout migration |

Generation time is a separate metric. Pixi does not accelerate climate, topology, state expansion, economy, or other
procedural generators.

## Architectural target

```text
world data + semantic style
            |
            v
     renderer coordinator
       /             \
      v               v
Pixi viewport     SVG export renderer
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
- switch SVG/Pixi ownership for development comparisons;
- expose diagnostics and per-layer timings;
- materialize SVG only when an operation still requires it.

The prototype's `ownsLayer` check is a temporary bridge for classic scripts, not the final coordinator API.

### Scene preparation

Separate geometry preparation from painting. Each migrated layer should have a pure, testable scene builder:

```text
pack + semantic style -> layer scene data -> Pixi resources
                                  `-------> SVG output
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
- Keep a DOM/SVG fallback until screenshot comparisons cover the supported font and path cases.

### Editing overlays

Editors can initially remain in SVG or HTML above Pixi. The overlay should contain only active handles, selection
outlines, brush previews, and other transient controls—not a hidden copy of every map layer.

Picking should move from DOM event targets to a renderer-independent hit-test service:

- cell lookup from the Voronoi data for area tools;
- spatial indexes for point and line entities;
- stable domain IDs in hit results;
- no Pixi display object references in controllers.

## Phased delivery

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
- Generate SVG lazily for save/export while those paths still depend on it.
- Extract border geometry from SVG mutation code.
- Verify disabling Pixi restores a complete SVG map.

Exit gate: the live DOM does not contain duplicate states, biomes, relief, or borders, and save/export still work.

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

Exit gate: label readability and placement are acceptable at normal viewing scales, with a documented fallback for
unsupported fonts or effects.

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

### Phase 9: default rollout and cleanup

- Run opt-in, percentage, and default-on rollout stages with a persistent SVG fallback switch.
- Compare telemetry or submitted benchmark reports by renderer and device class.
- Remove SVG live-render paths only after export and editor replacements are proven.
- Keep SVG export as a supported backend if it remains valuable.

Exit gate: Pixi is the default interactive renderer and fallback usage is understood and acceptably low.

## Save, load, and export

- Do not add Pixi runtime objects to `.map` serialization.
- Preserve current `.map` compatibility until a separately versioned viewer format is introduced.
- During early phases, materialize missing SVG layers only while cloning for save/export.
- Long term, build SVG export from renderer-neutral scene data instead of cloning the live DOM.
- Raster export may render Pixi to an offscreen target, but must account for maximum texture size and tiled output.
- Test save/load round trips with Pixi enabled and disabled.

## Styling migration

Pixi should consume the semantic style model described in [architecture.md](architecture.md), not computed SVG styles.
For each layer:

1. define and serialize its typed style subtree;
2. migrate preset selector values into that subtree;
3. make controllers update style state;
4. make both renderers consume the same state;
5. remove DOM style reads from the normal Pixi path.

Computed SVG style reads are acceptable only as a temporary compatibility bridge.

## Testing and quality gates

Every migrated layer should add:

- unit tests for scene-data generation and invalidation decisions;
- deterministic screenshot comparisons at representative zoom levels;
- layer toggle and z-order interaction tests;
- save/load and SVG/raster export coverage;
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
| Loss of SVG visual effects | Catalogue effects, implement high-value equivalents, document fallbacks |
| Text fidelity regressions | Separate label milestone and keep fallback until proven |
| Editors coupled to SVG nodes | Introduce domain-ID picking and transient overlays |
| Save/export loses hidden layers | Lazy SVG materialization followed by renderer-neutral export |
| WebGL context loss | Recreate resources from scene caches and show a recoverable fallback |
| Bundle growth | Keep Pixi code-split and create a minimal viewer entry point |
| Migration stalls in permanent dual rendering | Enforce one live owner per layer and phase exit gates |

## Immediate backlog

1. Add benchmark fixtures and a comparison panel/exportable report.
2. Complete Phase 1 save/export and disable-path tests.
3. Extract state and biome scene builders from DOM/style reads.
4. Introduce a typed camera model and HTML viewport stack.
5. Benchmark the viewport-sized canvas against SVG for pan, zoom, resize, and high-DPI cases.
6. Add retained geometry for cell fills before migrating more layers.
