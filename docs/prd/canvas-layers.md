# PRD — Canvas Layers

**Status: draft.**

## Problem Statement

Big maps with heavy styles are slow to navigate. On an Apple M1 Pro at DPR 2, a 10k-cell map on Frostbite
pans at 30–48 ms a frame when zoomed out; a 100k-cell map with relief on Cinderwood is far worse. The cost is
the browser painting SVG on the main thread: full-map masks (ocean bands and waves), filters (halos, shadows),
large textured fills and dense icons. The map is one SVG root whose camera is a transform on `#viewbox`, so
every frame of a gesture repaints all of it.

Node count is no longer the main problem: labels, relief, burg icons, markers, routes and rivers are already
viewport-culled. What is left is the per-pixel cost of the layers that culling cannot reduce.

## Solution

**Canvas Layers.** The map is drawn per layer: a layer is either SVG, as today, or drawn on the GPU straight
from map data. Layers move to the GPU one at a time, heaviest per-pixel cost first; the rest stay SVG.

The preferred shape, to be confirmed by the [required investigations](#required-investigations):

- **One element per layer.** A container holds one child per layer in z-order: an SVG root or a canvas.
  Reordering moves one element, toggling shows or hides one. Alternatives: [R2](#r2-layer-composition).
- **One camera.** Each camera frame writes the transform to every visible SVG root and redraws every visible
  canvas.
- **One GPU renderer.** A three.js `WebGPURenderer` draws every canvas layer, switching its `CanvasTarget` per
  layer, so pipelines and textures are shared. WebGPU on Chrome (about 90% of users), its automatic WebGL2
  fallback elsewhere, slower but working; later the same renderer serves the 3D view. Alternatives:
  [R3](#r3-gpu-api-and-library).
- **Editing.** Editors keep their SVG feedback in `#debug`, the top SVG layer. A canvas layer answers clicks
  from map data, not from the DOM ([R6](#r6-hit-testing-from-data)).

## Dependencies

### FMG 2.0: map data separated from rendering

Canvas Layers lands only once a `.map` no longer depends on its stored SVG. Then the map's DOM is not part of
the file format and can change shape without migrating a single file.

Today it is part of the format:

- Record 5 of a `.map` is the serialized `#map` SVG. Loading replaces `#map` with it as it is
  (`load.ts`, `data[5]`).
- The layers registry adopts the loaded content without redrawing it (`Layers.restore`).
- `auto-update.ts` migrates old files by rewriting groups inside that SVG.
- Some content may survive only there: layers that keep their content (`landmass`, `legend`, `debug`) and any
  group a renderer does not redraw on load. To inventory.

Splitting `#map` into per-layer roots while that holds would mean migrating every old file's SVG into the new
structure, and keeping that migration forever.

Done when:

1. Every layer has a stateless renderer that draws it from map data and styles, and loading redraws every
   layer instead of adopting stored SVG.
2. Loading ignores record 5; saving stops writing it (or writes it only for older generator versions to read).
3. `auto-update.ts` migrates data and styles only, never SVG.
4. SVG and PNG exports are built from the renderers, not by cloning `#map`.

This is the FMG 2.0 goal "make world data independent from SVG / DOM manipulation"
([architecture](../architecture/architecture.md)). It is worth doing for its own sake: smaller files, no
SVG-shaped migrations, and alternative renderers become possible.

### Other dependencies

- **Viewport culling everywhere it applies.** GPU layers must cull before they draw (barrulus's lesson), using
  the same bounds as the viewport renderer.
- **The layers registry** as the single owner of layer identity, order and visibility
  ([layers management](layers-management.md)). It gains the choice of element per layer.

## Investigation

### Done

| Attempt                                                        | Where                                                                      | Result                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Ocean bands and waves cached as an `<image>`                   | [#1967](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1967), merged | Pan frame 53–164 ms → 22–31 ms on five presets (SwiftShader). Ocean-only. Stays for Vector                                               |
| Camera as a CSS transform with `will-change` during pans       | Local experiment, not kept                                                 | −70% pan painting in `npm run benchmark`, which rasters on the CPU. On a GPU: no gain, and Atlas and Cinderwood pans at 2× twice as slow |
| Raster view: whole map and tiles rasterized from SVG snapshots | Branch `raster-view` (local), reverted from master                         | Pans at display rate once bitmaps exist (8.8 ms vs 33.8 ms on Frostbite), but producing them stays slow. Worse than Vector in practice   |
| Relief through three.js in a `foreignObject`                   | [#1352](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1352), draft  | Stale; `foreignObject` brings Safari, pointer and export problems                                                                        |
| GPU burg icons, SDF burg labels, `LayerHost`                   | barrulus's fork, June–August 2026                                          | All removed; see below                                                                                                                   |

#### Raster view, in more detail

The cost is making pixels from SVG, not showing them.

- The snapshot export (`getMapURL`) blocks the main thread: 219 ms per zoom level at 10k cells on
  Cinderwood, seconds at 100k.
- `drawImage` of a 512 px tile from a decoded SVG image costs about 190 ms on Cinderwood, almost as much as the
  whole map (516 ms), because full-map masks are re-rendered for every crop.
- `createImageBitmap` with a crop rasterizes an SVG image off the main thread (about 20 ms of main thread out
  of 224 ms) and stays vector-sharp. Useful elsewhere; not enough here.
- A hidden SVG still costs about 11 ms a frame in hit testing, style, layout and paint; `display: none` during
  gestures removes it. `opacity: 0` does not: Chromium still paints transparent SVG.
- WebGL or three.js textures of the same bitmaps would not help: display was never the bottleneck.

#### Barrulus's fork

[barrulus/Fantasy-Map-Generator](https://github.com/barrulus/Fantasy-Map-Generator) built the most complete
GPU attempt, then removed it after measuring. The record is in its
`docs/superpowers/specs/2026-08-19-webgl-layers-keep-or-kill.md`.

- **What it had:** raw WebGL2 burg icons (instanced sprites from an atlas), SDF burg labels (glyph atlas,
  layout, collision), and `LayerHost`, which split `#map` into SVG, canvas and a second SVG root `#mapTop`
  wherever a GPU layer had SVG layers above it. About 2,900 lines plus 1,100 lines of label sizing and
  collision.
- **GPU labels were slower than culled SVG** in 5 of 6 cases on a 75k-burg map, up to 37×. Each frame ran
  sizing and collision on the CPU over all 74,729 labels; the SVG path only materialises the visible few
  (54 at zoom 1). Removed 2026-08-19.
- **GPU icons were 10× faster, but only against unculled SVG icons.** Once burg icons became a
  `ViewportLayers` pass (16–61 nodes instead of 2,251 on a probe map), the GPU layer stopped paying for itself
  and had also drifted out of sync with the zoom handler. Removed with `LayerHost` on 2026-08-22
  (`a66dbb95`): "The GPU path's speed came from its min-zoom culling, not the GPU".
- **Lessons:**
  - Cull before anything else, on every path; a GPU layer with unculled CPU work loses to culled SVG.
  - Measure against the current SVG path, on a real GPU, with interleaved rounds and medians.
  - A second renderer for the same layer is a permanent tax: every feature built twice and kept consistent.
  - `LayerHost`'s conditional split collided with the layers registry and doubled code paths.

#### Settled

| Question             | Options                                                              | Choice                                                                                                                                                                     |
| -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raster or GPU-native | SVG raster caching; textures of SVG bitmaps; GPU rendering from data | GPU from data, per layer                                                                                                                                                   |
| WebGPU only          | WebGPU only; WebGPU with a WebGL2 fallback                           | A WebGL2 fallback is required: WebGPU is missing on older Safari, parts of Firefox and older tablets. A slower fallback is acceptable, as about 90% of users are on Chrome |

### Required investigations

#### R1. Cost per layer

Frame time on a 100k-cell map with relief, Cinderwood and Frostbite, at 2× and 8× zoom, with each layer
turned off in turn: headed Chromium on a GPU at DPR 2, one preset per run. Picks the first GPU layers.

Expected first candidates:

| Layer                      | Why SVG is slow                                           | GPU approach                              |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| Ocean bands and waves      | Full-map masks re-rendered every frame                    | A shader over a distance-to-coast texture |
| Texture, heightmap, biomes | Large textured or filtered fills                          | Triangulated polygons, texture sampling   |
| Relief, zoomed out         | Thousands of icons on screen at once; culling cannot help | Instanced sprites from an icon atlas      |

Not expected: labels, burg icons, markers, routes and rivers. Culling already keeps them cheap.

#### R2. Layer composition

How SVG and GPU layers share one z-order that users reorder freely.

| Option                                 | How                                                                           | For                                                                                                                   | Against                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A. One element per layer (preferred)   | A container with one SVG root or canvas per layer                             | No grouping logic; reorder moves one element; the browser merges consecutive SVG roots into shared compositing layers | One backing store per visible canvas (about 23 MB at 1600×900, DPR 2); in WebGL2 one context per canvas, at most about 16 |
| B. Grouped runs                        | Consecutive layers of one kind share an element; regroup on reorder or toggle | Fewest canvases and contexts                                                                                          | The `LayerHost` problem: a split that depends on order, two code paths, reconciliation on every reorder                   |
| C. GPU layers in one canvas, SVG above | All GPU layers in one canvas at the bottom, one SVG root on top               | One canvas, one context, simplest compositing                                                                         | Constrains order: no SVG layer may sit between GPU layers, so users cannot reorder freely                                 |
| D. Everything on the GPU               | One canvas for the whole map; SVG only for editor feedback and export         | Fastest; one renderer, shareable with the 3D view                                                                     | Every layer and style option rewritten; the end state of many iterations, not a start                                     |
| E. `foreignObject`                     | A canvas inside the SVG at the layer's slot                                   | Keeps one SVG root                                                                                                    | Safari bugs with transformed `foreignObject`, pointer quirks, export special cases (#1352)                                |
| F. three.js DOM overlays               | `CSS3DRenderer` or `SVGRenderer` around one canvas                            | Comes with three.js                                                                                                   | Overlays sit wholly above or below the canvas; no interleaving                                                            |

To measure for A, B and C: frame time and GPU memory with 1, 4, 8 and 15 canvases; context behaviour of the
WebGL2 fallback; reorder and toggle cost. A is preferred unless canvas memory or contexts rule it out; then
B only for adjacent GPU layers, inside the renderer, not as a system-wide split.

#### R3. GPU API and library

| Option                                | For                                                                                                                                                        | Against                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| three.js `WebGPURenderer` (preferred) | Already a dependency (3D view); WebGPU with an automatic WebGL2 fallback; `CanvasTarget` lets one renderer draw many canvases; can serve the 3D view later | 3D scene graph for 2D work; adds about 150 KB gzipped to startup (it loads lazily today); its WebGPU API still changes |
| Raw WebGL2                            | Small, stable, no dependency; barrulus's code as prior art                                                                                                 | No WebGPU; one context per canvas; a second backend later means a rewrite                                              |
| Raw WebGPU plus raw WebGL2            | Full control on both                                                                                                                                       | Two renderers to write and keep consistent                                                                             |
| PixiJS v8                             | 2D-first; WebGPU and WebGL backends; sprites, polygons and text built in                                                                                   | A new production dependency; not shareable with the 3D view                                                            |
| Thin wrappers (regl, TWGL)            | Less boilerplate over WebGL2                                                                                                                               | WebGL2 only                                                                                                            |

To verify: three.js's WebGL2 fallback with `CanvasTarget` (one context per canvas, copies, or neither); frame
time of the same layer on WebGPU and on the fallback; startup cost and whether the GPU path can load lazily
on first use; instancing and polygon throughput for R1's candidates.

#### R4. Text

Labels stay SVG unless R1 shows they dominate after culling.

| Option                                                  | Quality                                                                                                   | Cost at scale                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| SVG text (today)                                        | Best: native shaping, kerning, right-to-left, CJK, any CSS font                                           | Re-layout when the zoom changes; curved text is the most expensive part                         |
| Canvas 2D `fillText`                                    | Native shaping for straight text; curved text glyph by glyph loses kerning and breaks scripts like Arabic | Fast, but redraws every frame                                                                   |
| GPU SDF text (`troika-three-text` with three.js)        | Sharp at any zoom; small sizes and large glyph sets need care; needs font files, not CSS font names       | Shaped once, scaled freely; cheap per frame, provided layout is culled first                    |
| Polotno's [render-tag](https://polotno.com/render-tag/) | Rich HTML/CSS text into Canvas 2D, including text on a path                                               | A layout engine per block: suits the legend or notes, not thousands of labels re-sized per zoom |

#### R5. WebGPU across many canvases

Part of R2 and R3, measured on its own: one device configured for many canvases, sharing pipelines and
textures. Frame time and memory as canvases are added, on Chrome and on the WebGL2 fallback.

#### R6. Hit testing from data

A canvas layer has no DOM nodes to click. A spatial index over its features answers the same clicks,
tooltips and drags the SVG did, with the same priority between layers.

#### R7. Export from renderers

SVG and PNG export assembled from every layer's SVG renderer into one document, in layer order, matching
today's output. Needed by the FMG 2.0 dependency anyway.

## Implementation Plan

| Phase              | Work                                                                                                                                                                                                                                         | Depends on             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 0. Investigate     | R1–R7, as spikes outside the main code                                                                                                                                                                                                       | Nothing; can start now |
| 1. Data-only maps  | Every layer redrawn from data on load; record 5 ignored; exports built from renderers (R7)                                                                                                                                                   | FMG 2.0 work           |
| 2. Layer stage     | The registry creates one element per layer (or R2's choice), all SVG; single-root assumptions migrated (46 files, about 146 `#viewbox` references, 21 to `#map`); the whole-map style filter moves to the container. Same pixels, same speed | Phase 1, R2            |
| 3. Map renderer    | The GPU renderer singleton (R3's choice), the shared camera, hit testing from data (R6). No layer moved yet                                                                                                                                  | Phase 2, R3, R5, R6    |
| 4. First GPU layer | R1's top candidate, likely ocean bands and waves, behind a per-layer switch; pixel parity with its SVG renderer; measured against it                                                                                                         | Phase 3, R1            |
| 5. More layers     | One at a time, each kept only if the measurement shows a clear gain                                                                                                                                                                          | Phase 4                |
| Later              | The 3D view on the same renderer; WebGPU compute for the coast distance field and other fields                                                                                                                                               | Phase 3                |

Each phase ships on its own and leaves the map working. Phase 2 changes no pixels, so a regression there is a
structure problem, not a rendering one.

## User Stories

1. As a map author with a large map and a heavy style, I want panning and zooming to stay smooth, so that I can
   explore the whole map.
2. As a map author, I want every layer to look the same as before, so that moving a layer to the GPU changes
   speed, not my map.
3. As a map author, I want to reorder and toggle layers freely, so that a layer's renderer never limits the
   order I choose.
4. As a map author, I want clicks, tooltips and editors to work on every layer, so that editing does not
   depend on how a layer is drawn.
5. As a map author, I want my old `.map` files to open and my SVG exports to look the same, so that the change
   costs me nothing.
6. As a map author on a browser without WebGPU, I want the map to work, slower, so that nobody is locked out.

## Implementation Decisions

- **The layers registry decides the element.** A layer declares whether it is drawn as SVG or on the GPU. The
  registry creates the element, keeps the order and toggles visibility; nothing else touches the stack.
- **A map renderer singleton** owns the GPU renderer, the per-layer canvas targets and the shared camera. A
  GPU layer gives it a draw function and its data; it does not own a context.
- **The camera** stays in `zoom.ts`. Per frame it writes the SVG transforms and asks the map renderer to draw.
- **No migration.** Nothing in a `.map` describes the DOM once the FMG 2.0 dependency is met, so old files open
  through the same data path as new ones.
- **A GPU layer keeps an SVG renderer** for export only. That is the one place two renderers of a layer
  coexist, and export parity tests keep them aligned.
- **Culling first.** A GPU layer culls on the CPU before it uploads or draws, with the viewport renderer's
  bounds.

## Testing Decisions

- Every performance claim comes from headed Chromium on a GPU at DPR 2, against the current SVG path, with
  interleaved rounds and medians. `npm run benchmark` rasters on the CPU and only guards page work.
- One browser and one preset per run: the measurements are heavy enough to stall the machine.
- A GPU layer is compared pixel by pixel with its SVG renderer at settled views.
- Unit tests cover the stack: order, toggling, reordering, the camera reaching every root, export assembling
  one SVG in layer order.

## Out of Scope

- Raster caching of SVG in any form, and textures made from SVG bitmaps.
- GPU labels and burg icons, unless R1 shows they dominate after culling.
- Rendering the 3D view with the same renderer. Planned later, not in this work.

## Further Notes

- **WebGPU compute** fits jobs the CPU does today: the distance-to-coast field for ocean bands, heightmap
  contours and hachures, the erosion bake.
- **Raster view findings** worth reusing, on the local `raster-view` branch: `createImageBitmap` rasterizes SVG
  off the main thread; an export clone must be mounted off-screen, or it flashes on screen while the export
  awaits; the ocean cache needs a way to be suspended when another renderer draws the ocean.
