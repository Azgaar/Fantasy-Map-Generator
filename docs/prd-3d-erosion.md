# PRD: Erosion Detail Filter for the 3D Mesh View

## Problem

The 3D mesh view builds its terrain directly from the map heightmap: one vertex per grid cell
(`grid.cellsX × grid.cellsY`, typically ~130×80 ≈ 10k vertices), heights from `grid.cells.h`
(integers 0–100). This is faithful to the map data but visually coarse: no ridgelines, gullies,
or drainage detail. The "Smooth geometry" option only rounds the existing blobs.

## Goal

An opt-in **"Eroded terrain"** mode for the 3D mesh view that bakes a high-resolution,
erosion-detailed heightmap on the GPU and builds a dense mesh from it, producing realistic
slope-aligned relief (gullies, sharp ridges, carved river valleys) at interactive speed.

## Non-goals

- No mutation of map data: `grid.cells.h`, `pack` and all 2D rendering stay untouched.
  The filter is a view-only enhancement.
- No hydraulic simulation. The effect is procedural detail, not physically simulated erosion.
- Globe view is unaffected.
- No per-frame GPU cost: the result is baked once per map/parameter change; the render loop
  is unchanged.

## Approach

Noise-based erosion appearance filter, after the technique described in
[runevision: "Fast and Gorgeous Erosion Filter"](https://blog.runevision.com/2026/03/fast-and-gorgeous-erosion-filter.html)
(lineage: Clay John's 2018 Shadertoy "Eroded Terrain Noise", refined by Felix Westin 2023).
Instead of simulating water flow, the filter overlays multi-octave directional stripe noise
("gullies") aligned with the local downhill direction:

- the perpendicular of the heightfield gradient gives the stripe direction at each point,
  and it is deliberately **unnormalized**: the stripe phase is `dot(p − pivot, dir)`, so
  stripe frequency scales with the slope. Steep faces get dense gullies, flats degenerate to
  `cos(0) = 1` (a constant — the technique's built-in fade), and summits rise into points;
- cosine-wave kernels around jittered pivots in a 4×4 window are blended with a gaussian
  falloff; the sine term times the direction vector carries the analytic derivative
  (kernel-falloff derivatives are ignored, like the reference, to keep steering smooth);
- octaves stack with lacunarity 2 / gain 0.55, up to 6 octaves (Nyquist-guarded against the
  bake resolution); each octave's direction includes the analytically accumulated derivatives
  of previous octaves, producing dendritic branching. The accumulated derivative feedback uses
  only the **sign** of each octave's derivative (runevision's "straight gully" trick), so
  smaller-scale gullies snap to a consistent angle instead of wobbling with the noise
  magnitude;
- after the kernel, the value channel is **edge-shaped** (`1 − 2·pow((1−e)/2, 0.7)`) — crests
  between gullies sharpen while gully floors round off — before the flat-region retarget that
  keeps summits and plateaus correct;
- a separate **unsharp-mask pass** (`base − blur(base, ~1.5 cells)`) restores defined, peaked
  crests along the ridgelines the bilinear base already implies, gated to the hill/mountain
  band so lowlands are untouched;
- amplitude follows an **erosion-energy model** tied to FMG terrain classes: heights 50+
  (hills) and 70+ (mountains) get full sculpting; rugged areas qualify via a **land-only**
  local-relief channel (max delta to land neighbors — water neighbors are excluded so coasts
  and lake shores never read as rugged) weighted by an anomaly factor that fades in above
  ~h30. Genuinely flat lowlands get **zero** erosion energy — no constant floor;
- the coastline is the **true vector coastline**, not the grid: a land/water mask is
  rasterized at bake resolution from `pack.features` polygons (the same geometry
  `featurePathRenderer` draws for the 2D map), then Gaussian-blurred. Blurring a binary edge
  keeps its 0.5 level set at the original edge, so the mask's 0.5 contour still sits exactly
  on the true coastline. Water flattening and the coastal taper become one step: land height
  is fully clamped to the water surface for mask ≤ 0.5 (the coastline and everything seaward
  of it) and ramps to full height over the next `COAST_RAMP` of mask going inland — so cliffs
  start exactly at the coastline, never mid-cell, and the water-flatness guarantee is automatic;
- lowlands get **real dendritic drainage**: sub-river streams from FMG's per-cell flow
  accumulation (`pack.cells.fl`) are rasterized as faint carve channels converging into
  the river valleys;
- river valleys are **terrain-modulated and smooth**: Chaikin-smoothed polylines drawn at
  quarter resolution (bilinear upscale melts the pass rings into a smooth cross-section),
  a pow() profile narrows the deep core, and carve depth scales with the same erosion
  energy — shallow swales across floodplains, real valleys where rivers cut through hills;
- only a fraction of the detail-noise gradient steers the flow direction, so drainage
  follows the real terrain gradients and stays dendritic instead of locking onto noise.

Every output pixel is evaluated in isolation, so the whole filter is a single fragment-shader
pass over the upsampled heightmap — no ping-pong, no iteration.

**Rivers (FMG-specific extension):** the generator already computes a full drainage network
(`pack.rivers`, `pack.cells.fl` flux). River polylines are rasterized to a valley-intensity
texture (stroke width grows downstream with flux, mirroring `Rivers.getOffset`), blurred by
stacked strokes, and the shader carves valleys proportional to intensity and available relief —
so the procedural gullies converge to the map's real rivers.

### Approaches considered and rejected

| Approach | Why rejected |
| --- | --- |
| Droplet hydraulic simulation (CPU/worker) | 2–10 s per bake at useful resolution; hard to tune; overkill for a view-only effect |
| Pipe-model GPU erosion (Mei et al. 2007) | Dozens of ping-pong passes, much more complex, similar visual payoff for this use case |
| Pure mesh subdivision (existing option) | Adds polygons but no new information — terrain stays blobby |

### Provenance / license note

The reference Shadertoy implementations default to CC BY-NC-SA, which is incompatible with
FMG's MIT license. The shader in `public/modules/ui/3d-erosion.js` is implemented from the
published *descriptions* of the technique (blog post text and this PRD), not translated from
the Shadertoy sources. Hash and value-noise helpers are textbook constructions.

## Pipeline

```
CPU                                    GPU (one fragment pass)             CPU
grid.cells.h → height DataTexture  ┐                                       readRenderTargetPixels
pack.features coastline polygons   ┼→ fullscreen quad → RGBA8 target  ───→ decode 16-bit heights →
  → blurred land mask + water      │   bilinear base + analytic FBM,       Float32Array field →
  surface raster (Canvas, bake res)│   multi-octave gullies with fade,     dense PlaneGeometry
pack.rivers → flux-weighted valley ┘   river carve, coastline-mask        (bilinear per-vertex sample)
  raster (CanvasTexture)               water flatten/taper
```

- Output heights are packed as 16-bit fixed point into the RG channels of an RGBA8 render
  target — universally readable, no float-texture requirements.
- Baked heights stay in the normalized 0–100 domain; the height-scale slider applies on the
  CPU when building vertices, so changing it never re-bakes.
- The bake is cached by a content hash over the heightmap, river arrays, and parameters;
  repeated `redraw()` calls (e.g. heightmap editor preview) reuse the cache when nothing
  relevant changed.
- 3D labels/burg icons sample the baked height field directly instead of raycasting the
  dense mesh (no BVH in three r140; raycasting ~1.5M triangles per label would stall).

## Settings (3D mode settings dialog, mesh section)

| Setting | Values | Default |
| --- | --- | --- |
| Eroded terrain | on/off | off |
| Mesh detail | 256 / 512 / 1024 [slow] vertices on the long side | 512 |
| Gully strength | 0–100 | 50 |
| River valleys | 0–100 (carve depth) | 40 |
| Detail octaves | 3–6 | 5 |

Bake resolution is 1024×(aspect) at detail ≤ 512 and 2048×(aspect) at detail 1024.
"Smooth geometry" (loop subdivision) is ignored while eroded terrain is enabled; wireframe
and OBJ export work on the dense mesh.

## Performance budget

- Bake (texture build + shader pass + readback + decode): < 200 ms at 1024 on a mid-range GPU.
- Memory: 2048² RGBA8 target = 16 MB + decoded Float32 field ≤ 16 MB, freed on `ThreeD.stop()`.
- Mesh: 512-detail ≈ 260k vertices (default); 1024-detail ≈ 1M vertices, marked [slow].
- OBJ export of the dense mesh is tens of MB — acceptable, user-initiated.

## Failure / fallback behavior

If the erosion module fails to load or the bake throws (context loss, ancient GPU), the view
falls back to the classic coarse mesh, shows a warning tip, and logs the error. The checkbox
stays available; nothing crashes.

## Follow-ups (out of scope for v1)

- **v1.5 — normal map:** Sobel pass over the baked heightmap → normal map; switch terrain
  material to `MeshPhongMaterial({shininess: 0})` (Lambert in three r140 has no normal-map
  support) to carry sub-vertex detail when bake resolution exceeds mesh density.
- Curvature-based fade target (blog lists altitude-based fade as a known limitation).
- Optional export of the baked heightmap as PNG.
