# PRD — Raster Rendering

## Problem Statement

Zooming and panning a detailed map is slow, and painting is most of that cost. The camera is a `transform`
attribute on `<g id="viewbox">`. A transform inside an SVG is not a compositing boundary, so Chromium repaints
the whole map on every frame of a gesture: every path is rasterized again, and every mask and filter
renders its offscreen pass again.

Two attempts addressed parts of it:

- **[#1967](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1967)** (merged) caches the ocean bands and
  waves as an `<image>` of the padded viewport (`src/renderers/ocean-cache.ts`). It works, but only for two
  layers, with ocean-specific invalidation (a `MutationObserver` on `#featurePaths`) and a hand-listed set
  of defs.
- **[#1352](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1352)** (draft) draws relief through
  three.js in a `foreignObject`. It is stale: relief is now viewport-culled SVG `<use>` elements.

The ask: make raster rendering general (any layer, or the whole map) and put it behind a single
Performance setting.

## Investigation

### Ocean cache (#1967)

Average frame interval over a 30-step pan, seed 1966, 1600×900, 3× zoom, Chromium software rendering:

| Preset     | Vectors  | Cached  |
| ---------- | -------: | ------: |
| Ink        |  66.1 ms | 22.2 ms |
| Ancient    | 105.4 ms | 25.4 ms |
| Cinderwood | 160.0 ms | 30.5 ms |
| Atlas      | 113.8 ms | 29.6 ms |
| Frostbite  | 163.5 ms | 123.0 ms |
| Gloom      |  53.0 ms | 27.9 ms |

Frostbite stays slow because its burg-icon filter is not cached. The per-layer cap of 16 MP
(`MAX_PIXELS`) matches iOS Safari's maximum canvas area (4096²).

### Compositor camera (rejected)

If the camera is a CSS `transform` with `will-change: transform`, Chromium promotes `#viewbox` to its own
layer, tiles it, and pans by moving the tiles instead of repainting.

**Software raster.** `npm run benchmark` (seed `benchmark`, 10k cells, 1280×720, headless Chromium on
SwiftShader, 3 rounds against `origin/master@bae507ce`):

| Variant                                                  | Pan: painting  | Zoom: painting |
| -------------------------------------------------------- | -------------- | -------------- |
| A: `will-change` for the whole gesture                   | 16.0 → 5.4 s   | 28.3 → 45.8 s  |
| B: `will-change` dropped on the first scale change       | 15.6 → 4.6 s   | no change      |

**GPU raster.** Mean frame interval over a 100-step pan, Variant B against the same page with compositing
blocked, headed Chromium on an Apple M1 Pro, 1600×900 at DPR 2, 3 alternating rounds:

| Preset     | Zoom | Composited | Not composited |
| ---------- | ---- | ---------: | -------------: |
| Default    | 4×   |     8.9 ms |         8.3 ms |
| Frostbite  | 2×   |    30.4 ms |        32.8 ms |
| Frostbite  | 6×   |     8.6 ms |        10.8 ms |
| Atlas      | 2×   |    20.0 ms |        10.3 ms |
| Cinderwood | 2×   |    23.5 ms |        11.4 ms |
| All        | 20×  |     8.3 ms |         8.3 ms |

On a GPU the gain disappears, and at low zoom Atlas and Cinderwood pan at half the frame rate: promoting a
layer that covers most of the map rasters all of it at the start of every pan. The benchmark win is a
software-raster artifact. The camera stays a `transform` attribute.

What the GPU numbers do show:

- **The pain is low zoom on heavy presets.** With most of the map visible, Frostbite pans at about 30 fps;
  at 6× and above every preset holds the 120 Hz display rate.
- **`npm run benchmark` cannot judge rendering work.** It rasters on the CPU, where costs are ordered
  differently. The #1967 numbers were also taken on SwiftShader, so its GPU gain is unmeasured too.

### Raster display spike (GPU)

A throwaway harness rendered the export pipeline's full-map SVG (`getMapURL("png", { fullMap: true })`) into
one bitmap at the current scale and drew it each frame onto a viewport canvas above the map, following the
camera. Headed Chromium, Apple M1 Pro, 1600×900 at DPR 2, seed `benchmark` (10k cells), 2× zoom, mean
frame interval over a 100-step pan, 3 alternating rounds:

| Preset    | SVG     | Canvas, SVG `opacity: 0` | Canvas, SVG hidden + `pointer-events: painted` | Canvas, SVG `display: none` |
| --------- | ------: | -----------------------: | ---------------------------------------------: | --------------------------: |
| Frostbite | 46.3 ms |                  38.1 ms |                                        14.2 ms |                     13.6 ms |
| Atlas     | 16.2 ms |                  32.6 ms |                                        14.1 ms |                     12.3 ms |
| Default   | 10.1 ms |                  22.9 ms |                                        10.0 ms |                     10.4 ms |

Snapshot cost on the same map:

| Preset    | Build (`getMapURL`) | Decode | Raster to bitmap | SVG size |
| --------- | ------------------: | -----: | ---------------: | -------: |
| Frostbite |         1.4–1.6 s   | 460 ms |          24–67 ms |  1.1 MB |
| Atlas     |            443 ms   |  85 ms |            55 ms |  945 kB |
| Default   |            875 ms   | 140 ms |           125 ms | 1013 kB |

Findings:

- **The gain is real where the pain is.** Frostbite pans 3× faster (46 → 14 ms). Atlas gains a little and
  Default nothing: they were not painting-bound on a GPU to begin with.
- **`opacity: 0` is not hidden.** Chromium still paints a transparent SVG; on lighter presets the extra canvas
  makes it slower than plain SVG.
- **`visibility: hidden` with `pointer-events: painted` works.** The SVG costs almost nothing to keep, and
  native hit testing still finds the burg under the cursor: its tooltip shows and a click opens the Burg
  Editor. SVG `painted` ignores visibility and keeps the default rule of hitting only painted shapes.
- **What remains is page work.** The floor (`display: none`, 10–14 ms) is the zoom handler and the viewport
  layers redrawing labels and icons during the pan, not painting.
- **A snapshot is expensive.** 0.5–2 s on a 10k-cell map, mostly the export pipeline, before any tile is drawn.
  It cannot run per edit; it has to wait for the map to settle and run off the gesture.

Not measured (stopped: headed multi-browser runs overload the machine):

1. **One decode, many tiles.** Does `drawImage(img, sx, sy, sw, sh, …)` of one decoded SVG image draw crisp
   vectors at 20× in Firefox and WebKit, or does each tile need its own cropped document? The spike drew one
   bitmap at 2× only.
2. **Bigger maps.** Snapshot cost on 50k–100k cells.
3. **Other browsers' frame rates.**

Run these one browser and one preset at a time.

## Solution

Raster tiles behind one Performance setting. The spike shows the display side pays off for heavy presets; the
tiling and snapshot questions above decide whether it can be built cheaply enough.

### Raster tiles (Performance setting)

One select in Performance settings, **Map rendering: Vector / Raster**, stored as
`app.performance.rendering`. Quality preset: Vector; Balance and Speed: Raster.

In Raster mode the map on screen is a viewport-sized `<canvas>` filled from tiles:

- **Source.** The SVG stays the model. One self-contained snapshot per invalidation is built by the export
  pipeline, with `ViewportLayers.renderTo()` drawing the culled layers for the region being tiled.
- **Tiles.** 512 px tiles at device pixel ratio, at zoom levels a power of 2 apart, prerendered for the
  viewport plus a margin. A missing tile is drawn from the coarser level, scaled, until its own is ready.
- **Memory.** An LRU tile pool with a byte budget, about 80 MB on desktop (the current level for a
  1920×1080 viewport at DPR 2 with a one-tile margin, plus a coarser level) and less on iOS. No single
  canvas exceeds 16 MP.
- **Interaction.** The SVG stays in the DOM with `visibility: hidden` and `pointer-events: painted`,
  following the camera, so the existing click, drag and tooltip handlers keep working through native hit
  testing. Not `opacity: 0`: Chromium still paints it.
- **Editing.** While an editor is open or a drag is active the map shows the SVG (Vector), since hover
  highlights, drag previews and selection outlines must be visible as they change.
- **Animation.** Animated layers (trade animation, journeys, measurers) stay live SVG above the canvas.
- **Invalidation.** A layer draw (`Layers.draw`) marks the snapshot stale. A new snapshot is built once the
  map settles, never during a gesture (it takes 0.5–2 s); until it is ready the stale tiles stay on screen.

The ocean cache is retired once the tiles cover it.

### Costs accepted

| Cost        | Bound                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| Clicks      | Native hit testing on the hidden SVG; vectors shown while editing             |
| Memory      | Fixed tile budget, about 80 MB desktop                                        |
| Zoom blur   | At most 2× upscaling, for as long as the next level takes to render          |
| Edits       | Each change pays one snapshot (0.5–2 s, off the gesture); editors show vectors |

## User Stories

1. As a map author using a heavy style, I want panning the whole map to stay smooth, so that I can
   navigate without waiting on every frame.
2. As a map author, I want zooming no slower than today, so that a pan speed-up costs nothing elsewhere.
3. As a map author on a slow machine, I want one Performance setting that trades a little sharpness while
   zooming for much faster navigation, so that heavy styles stay usable.
4. As a map author, I want clicks, tooltips and editors to behave the same in either mode, so that the
   setting changes speed, not how I work.
5. As a map author, I want saved maps and exports unchanged by the setting, so that a raster view never
   leaks into a file.

## Implementation Decisions

- The setting is a field of `app.performance` with a default, so a stored performance block without it
  still loads.
- A `Rasterizer` module owns snapshots, the tile pool and the display canvas. `applyPerformanceSettings()`
  switches it on or off. It does not know layer names: it reads layers through `Layers` and
  `ViewportLayers`.
- Defs a snapshot needs are found from its references (`url(#…)`, `href="#…"`), not listed per layer.

## Testing Decisions

- Frame intervals in a GPU-rastered browser decide the feature: pans at 2×, 6× and 20× on the default,
  Atlas, Cinderwood and Frostbite presets at DPR 2, Vector against Raster. `npm run benchmark` only guards
  page work, since it rasters on the CPU.
- Unit tests for tile cover, LRU eviction and stale-snapshot discards; a pixel comparison of
  Vector and Raster at settled views.

## Out of Scope

- WebGL renderers and the three.js relief of #1352. #1352 closes in favour of this PRD.
- Drawing layers to canvas natively (`Path2D`): it needs masks, filters, patterns and text reimplemented.
- Rasterizing saved maps or exports.

## Further Notes

The two-root compositor in barrulus's fork (an SVG root, a canvas, a second SVG root above it) is the
fallback if the tiles should go to a canvas below the SVG for the bottom layers only (ocean, bands, waves).
