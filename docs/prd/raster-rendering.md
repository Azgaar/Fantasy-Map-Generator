# PRD — Raster Rendering

> **Status: concluded proof of concept, not to be merged.** Raster mode works, but on heavy maps it is still
> slow to fill in and feels worse than Vector. See [Conclusion](#conclusion). The way forward is GPU rendering
> of the heavy layers from map data, layer by layer, without rasterizing SVG.

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

### Implementation check (GPU)

One headed run on the implementation, Frostbite at 2×, Apple M1 Pro at DPR 2, mean frame interval over a
100-step pan:

| Build                                           | Vector  | Raster  |
| ----------------------------------------------- | ------: | ------: |
| Hidden SVG kept in step with the camera         | 40.8 ms | 12.9 ms |
| SVG left behind during the gesture (as built)   | 33.8 ms |  8.8 ms |

8.8 ms is the 120 Hz display rate. The first bitmap was ready 1.4–1.5 s after Raster was turned on.

### Rasterizing off the main thread (pane check)

A browser renders SVG only on the main thread, so every rebuild blocked navigation. Measured on a 10k-cell
map, Cinderwood, Apple M1 Pro:

| Step                                                         | Main thread | Total   |
| ------------------------------------------------------------ | ----------: | ------: |
| Export the full-map snapshot (`getMapURL`)                   | 219 ms      | 219 ms  |
| Decode it (1.9 MB SVG)                                       | 48 ms       | 48 ms   |
| `drawImage` of the whole map at 3840×2160                    | 516 ms      | 516 ms  |
| `drawImage` of one 512 px tile at 10× from the same image    | ~190 ms     | ~190 ms |
| `createImageBitmap` of the same tile (crop + resize)         | ~20 ms      | 224 ms  |

`createImageBitmap` rasterizes the SVG image off the main thread (a 4 ms timer kept ticking through it) and
stays vector-crisp at the requested size (edge sharpness 8.16 against 8.23 for `drawImage`, 1.61 for an
upscaled bitmap). On the default style a tile costs about 14 ms of main thread.

## Solution

One Performance setting, **Map rendering: Vector / Raster**. In Raster mode the map on screen is drawn from
bitmaps on a canvas under the SVG, the way a web map shows tiles: a coarse picture at once, sharp tiles
filling in around the centre, nothing ever blocking a gesture. The SVG stays in the DOM, invisible, as the
model and the hit-test surface.

### Behaviour

- **Snapshot per zoom level.** The map is exported once per zoom level (powers of 2, labels sized for that
  level) and decoded. It is the only step that blocks the main thread, it never runs during a gesture, and it
  is redone only after an edit.
- **Overview.** The whole map, cut from the level-1 snapshot as densely as 16 MP allows. It covers any view at
  once, so pans and zooms never leave raster.
- **Tiles.** Once the zoom outgrows the overview's density, the view is filled with 512 px tiles cut from its
  level's snapshot by `createImageBitmap`: two at a time, nearest the centre first, each drawn as it lands.
  A one-tile margin is prepared around the view. Tiles stay cached (at most 160, about 160 MB, least recently
  drawn evicted), so returning to an area or a zoom costs nothing.
- **Always raster.** From the first overview on, the screen is the canvas. Missing tiles show the overview or
  another level's tiles; after an edit the old bitmaps stay until new ones replace them.
- **Gestures.** Every camera frame redraws the bitmaps under the camera. No new work starts during a gesture,
  and the SVG is left behind: `#viewbox` is not displayed and the zoom skips its per-frame SVG work. It
  catches up once at the end, invisibly, for hit testing.
- **Editing.** Dialogs change nothing about what is shown. Editor feedback drawn into `#debug` is live and
  shows over the canvas; any other change inside `#viewbox` is an edit and shows once its tiles are redone.
- **Live layers.** Coordinates, trade animation, journeys, rulers and `#debug` are left out of the bitmaps and
  stay visible in the SVG, above the canvas, except during a gesture. Layers outside `#viewbox` (scale bar,
  legend, vignette) are untouched and left out too.
- **Ocean cache.** Suspended in Raster mode: the bitmaps do its job, and its asynchronous image swaps would
  read as edits. It keeps working in Vector mode.
- **Off-screen export.** The export mounts its working clone in an off-screen host, so a snapshot being built
  never flashes on screen.

### Setting

`app.performance.rendering: "vector" | "raster"`. Quality and Balance: Vector; Speed: Raster.

### Costs accepted

| Cost              | Bound                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Snapshot pause    | One export per zoom level per edit (219 ms at 10k cells on Cinderwood), never mid-gesture |
| Tile hand-off     | 14–20 ms of main thread per tile, two in flight                                      |
| Zoom blur         | Until the tiles of the new level land                                                |
| Label sizes       | Between levels, labels scale with the bitmap; the overview's are sized for scale 1  |
| Memory            | Overview ≤ 16 MP, 160 tiles of 1 MB, up to 3 decoded snapshots                      |
| Editing           | An edit shows after its tiles are redone; only `#debug` feedback is live            |
| Live layers       | Not shown while a gesture is carried by the bitmaps                                 |
| Other browsers    | Where `createImageBitmap` cannot take an SVG image, tiles are drawn on the main thread |

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

One new closed singleton owns everything raster. Each existing module gains at most one generic hook and
never learns that rasterization exists.

### Changes

| Module                                      | Change                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/components/raster-view.ts` (new)       | The `RasterView` singleton, with its own style element                       |
| `src/components/zoom.ts`                    | Skips the SVG frame when `RasterView.follow()` carries it; `settle()` at end |
| `src/renderers/ocean-cache.ts`              | `suspendOceanCache(on)`: vectors only, nothing rasterized                    |
| `src/components/performance.ts`             | The `rendering` value in each preset; apply calls `RasterView.setEnabled()`  |
| `src/components/options-schema.ts`          | `rendering: z.enum(["vector", "raster"])` with a `"vector"` default          |
| `src/components/options/performance-settings.ts` | One `SETTINGS` row                                                      |
| `src/services/io/export.ts`                 | `GetMapURLOptions.exclude`; the clone is mounted in an off-screen host       |

Save and load, the layers registry, the viewport renderer, the ocean cache and every renderer stay as they
are.

### `RasterView`

```ts
class RasterViewModule {
  setEnabled(on: boolean): void; // the Performance setting
  follow(): boolean; // every camera frame: redraw the bitmaps under the camera; false before the first one
  settle(): void; // gesture end: fill the view with tiles for its zoom
}

export const RasterView = new RasterViewModule();
```

Three methods, nothing else exported. `follow()` and `settle()` return at once when Raster is off. It lives
in `components/`: it reads `Layers` and the export service, which a renderer may not import.

Invalidation is internal: one `MutationObserver` on `#viewbox`, from `setEnabled(true)` to
`setEnabled(false)`. A record inside a live layer, or an attribute of `#viewbox` itself (the camera), is
ignored; a child added to or removed from `#viewbox` (a layer moved) counts. `settle()` drops the records of
the SVG catching up with the camera, which run in the same task before it. An edit bumps a version; no other
module calls an `invalidate()`, and `Layers` needs no hook.

Private state: the canvas, the overview, the tile cache keyed by level, pixel ratio, column and row, the
decoded snapshots, the jobs in flight, the version and a session that turning off bumps, so late results are
dropped. A pump starts jobs after a 150 ms idle delay: the overview first, then the view's missing tiles; a
job needing a snapshot that is not there yet starts its export and waits for the next pump. One export runs
at a time; one that fails is not retried until the next edit.

A snapshot is `ExportMap.getMapURL("png", { region: whole map at width × level, exclude })` and an `Image`
decode. A tile is `createImageBitmap(image, crop, { resizeWidth: 512, resizeHeight: 512 })`, with a
`drawImage` fallback for browsers that cannot bitmap an SVG image.

The excluded ids come from `Layers`: the elements of layers whose parent is `map`, and of the live layers,
a constant list of layer ids (`coordinates`, `trade`, `journeys`, `rulers`, `debug`) inside the module.

### Visibility

The canvas is a sibling inserted right before `#map`, sized to it, behind it (`z-index: -1`) and with
`pointer-events: none`. Its `hidden` attribute is the single switch for both sides. The module injects the
rules on first enable, so no stylesheet changes:

```css
#rasterView:not([hidden]) + #map { background-color: transparent; }
#rasterView:not([hidden]) + #map #viewbox { visibility: hidden; pointer-events: painted; }
#rasterView:not([hidden]) + #map :is(#coordinates, #tradeAnimation, #journeys, #ruler, #debug) { visibility: visible; }
#rasterView[data-moving]:not([hidden]) + #map #viewbox { display: none; }
```

- One state drives both, so the canvas and the SVG cannot disagree.
- `pointer-events: painted` hits what a visible map would hit, ignoring `visibility`. An element that sets a
  `visible*` value of its own must switch to the plain value (`stroke`, `fill`, `painted`).
- The export and save clones are not next to the canvas, so neither rule reaches them: files never change.
- `#map`'s black background goes transparent while the canvas shows; the canvas copies it.
- The minimap draws `#viewbox` through a `<use>`; the rules do not match inside its copy, so it stays drawn.

### Not done, on purpose

- No worker renderer: the snapshot export stays on the main thread, once per zoom level per edit.
- The ocean cache stays for Vector, suspended in Raster.

## Testing Decisions

- Unit tests drive `RasterView` through its three methods with stubbed `getMapURL` and `createImageBitmap`:
  the canvas and the ocean-cache suspension come and go with `setEnabled`; one export makes the overview; a
  zoom past it exports its level once and cuts the view's tiles nearest the centre first; a gesture starts
  no work until it settles; an edit keeps the old bitmaps until new ones; live layers and the camera are not
  edits; work that finishes after Raster is off is dropped.
- An export and a save with Raster on match the same with Vector, byte for byte.
- Frame intervals decide the defaults: a headed, GPU-rastered browser at DPR 2, one preset and one browser
  per run (Frostbite and Default at 2×), Vector against Raster, plus the rebuild pause. `npm run benchmark`
  only guards page work, since it rasters on the CPU.

## Out of Scope

- WebGL renderers and the three.js relief of #1352. #1352 closes in favour of this PRD.
- Drawing layers to canvas natively (`Path2D`): it needs masks, filters, patterns and text reimplemented.
- Rasterizing saved maps or exports.

## Conclusion

The POC is on branch `raster-view` as a record. What it showed:

- **Showing pixels is solved; making them is not.** Once bitmaps exist, pans and zooms run at the display's
  refresh rate (8.8 ms a frame on Frostbite against 33.8 ms in Vector). Every bitmap, though, has to come from
  the SVG, and that is where the time goes:
  - the snapshot export blocks the main thread once per zoom level per edit (219 ms at 10k cells on
    Cinderwood, seconds at 100k);
  - each tile costs about 200 ms on heavy styles even off the main thread, because the browser re-renders
    full-map masks and filters for every crop.
- **The real experience is worse.** On a 100k-cell map with relief and Cinderwood, fast navigation shows
  blurry overview pixels for long stretches while tiles trickle in, and edits show late. Vector is slower per
  frame but always current and sharp.
- **Textures do not change it.** Putting the same bitmaps into WebGL or three.js textures would display them no
  faster than the canvas does now; they would still come from the same SVG pipeline.
- **Done the hard way, still useful:** `createImageBitmap` rasterizes an SVG image off the main thread and stays
  vector-sharp; the export now mounts its clone off-screen; the ocean cache can be suspended.

### Next: GPU rendering per layer

Render the heaviest layers natively on the GPU from map data, the way
[#1352](https://github.com/Azgaar/Fantasy-Map-Generator/pull/1352) started with relief, keeping SVG for the
rest and for export and editing:

1. Measure draw cost per layer on a 100k-cell map with heavy presets, by toggling layers, and pick the two or
   three that dominate. Expected: relief icons, ocean bands and waves, textured and filtered fills.
2. Give each a WebGL2 renderer: relief as instanced sprites from an icon atlas, ocean bands and waves as a
   shader over a distance-to-coast texture instead of SVG masks, fills as triangulated polygons, labels as
   signed-distance-field text.
3. Composite them with the SVG layers in z-order, for example the two-root split (SVG root, canvas, second SVG
   root) from barrulus's fork, and judge each layer frame for frame against SVG on a GPU at DPR 2.

## Further Notes

- **If the raster path is revisited**, the snapshot export is the last blocking step: it clones the map,
  inlines computed styles and serializes it. Splitting it into chunks that yield between them would remove
  the pause, but not the tile cost of heavy styles.
- The two-root compositor in barrulus's fork (an SVG root, a canvas, a second SVG root above it) is the
  fallback if only the bottom layers (ocean, bands, waves) should be rasterized.
