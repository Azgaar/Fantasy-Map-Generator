# 3D View

## Overview

The 3D view renders the generated map as a three-dimensional scene using [three.js](https://threejs.org/), loaded lazily. 
It is a **presentation-only** feature: nothing it does ever mutates map data. It has two independent modes:

- **Mesh** — a perspective terrain view of the map (heightmap as a 3D landscape).
- **Globe** — the map projected onto a sphere with an equirectangular projection.

Implementation lives in [src/controllers/view-3d.ts](../../src/controllers/view-3d.ts),
exposed globally as `window.ThreeD`. The erosion bake and satellite texture pipelines are
separate modules: [src/renderers/erosion-bake.ts](../../src/renderers/erosion-bake.ts) and
[src/renderers/draw-satellite-texture.ts](../../src/renderers/draw-satellite-texture.ts).

## Entry points

- **View mode toolbar** (top of the map): `Standard` / `3D scene` / `Globe` buttons
  (`#viewMode` in [src/index.html](../../src/index.html)). Switching away from Standard
  creates a full-window `<canvas id="canvas3d">` and calls `ThreeD.create(canvas, type)`;
  switching back to Standard calls `ThreeD.stop()` and removes the canvas. The 3D view
  **cannot be used for editing** — Standard mode is required for that.
- **Heightmap editor preview**: a "3D scene" button opens a small resizable `#preview3d`
  dialog showing a live 3D preview of the heightmap being edited (`heightmap3DView` type).
  This preview auto-refreshes (`ThreeD.redraw()`) whenever the heightmap, layers, or world
  config change while it's open.
- **Settings dialog** ("3D mode settings", `#options3d`) opens automatically when entering
  3D and can be toggled with the **`O`** key while a 3D canvas is present.

## Navigation

- **Mesh mode** uses Google-Maps-style `MapControls`: left-drag to pan, scroll to zoom,
  right-drag to rotate/orbit. The camera is clamped so it can't go below the horizon.
- **Globe mode** uses `OrbitControls`: left-drag rotates the globe, scroll zooms, right-drag
  pans.
- Both support auto-rotation via a **Rotation** slider (0–10, 0 = off).

## Mesh view features

### Terrain geometry

- **Classic mesh** (default): one vertex per heightmap grid cell (`grid.cellsX × grid.cellsY`,
  typically ~10k vertices), height from `grid.cells.h`. Water cells/shorelines are flattened to
  a uniform water-feature height.
- **Height scale** slider (0–100, default 50): vertical exaggeration of the terrain. Purely a
  display multiplier — never changes underlying data and (for the eroded mesh) never triggers
  a re-bake.
- **Smooth geometry** ("Smooth geometry [slow]"): applies Loop subdivision to round off the
  blocky classic mesh. Disabled/ignored while **Eroded terrain** is on (the dense mesh doesn't
  need it).
- **Wireframe**: renders the mesh as a wireframe instead of textured. Disables the satellite
  texture while active.

### Eroded terrain

A GPU bake that turns the coarse 10k-vertex heightmap into a dense, realistically-detailed
terrain — ridgelines, gullies, carved river valleys — without any hydraulic simulation. See
[docs/prd-3d-erosion.md](../prd-3d-erosion.md).
Key points for users and future work:

- **View-only**: `grid` and `pack` are never touched; this is purely how the existing
  heightmap is displayed.
- Settings (shown only while enabled):
  - **Mesh detail**: 256 / 512 / 1024 (default) / 2048 `[slow]` — vertices on the long side of
    the dense mesh (2048 ≈ several million vertices).
  - **Gully strength** (0–100, default 30): intensity of the procedural erosion noise
    (ridges/gullies).
  - **River valleys** (0–100, default 10): how deeply river courses are carved into the
    terrain.
  - **Detail octaves** (1–4, default 2): number of noise octaves layered into the erosion
    detail; more octaves add finer-scale gullies at a performance cost.
- The bake is **cached by content hash** (heightmap + rivers + these parameters), so toggling
  unrelated settings or repeated redraws (e.g. heightmap-editor live preview) reuse the cached
  result instead of re-baking.
- **Fallback**: if the GPU bake fails (very old/limited GPUs, context loss), the view silently
  falls back to the classic mesh with a warning tip — nothing crashes.
- 3D labels and burg icons sample the baked height field directly (not raycasting) when the
  eroded mesh is active, since the dense mesh has no BVH to raycast efficiently.
- OBJ export of the eroded mesh works but produces large files (tens of MB).

### Satellite texture

An independent toggle that replaces the terrain's texture with a fully procedural,
satellite-photo-style render: biome-based ground colors, slope-based rock/cliff/snow/sand
shading, coastlines/lakes/rivers drawn from the actual vector geometry, and animated water
(ocean shimmer and swell, calm ripples on lakes, flowing/freezing rivers, waterfalls on steep
river drops).

- Independent of **Eroded terrain** — it works on the classic coarse mesh too (in which case
  slopes come from a "clean" zero-strength bake, so rock/snow only appear on genuinely steep
  terrain).
- Replaces the standard 2D-map-render texture entirely; none of the 2D map's SVG layers (other
  than the geometry they imply) are drawn onto the satellite terrain.
- Not available together with Wireframe mode.
- **Texture resolution** select (512 / 1024 / 2048 / 4096 (default) / 8192 px) controls the
  resolution of both the standard map-render texture and the satellite texture/erosion bake
  ladder. Higher values look sharper at the cost of bake time and memory.

### Lighting & atmosphere

- **Lightness** slider (0–100, mapped to ambient light intensity 0–5).
- **Sun position** (X/Y number inputs) and **sun color** picker (directional spot light).
- **Time of day** presets — _Dawn / Noon (default) / Evening / Night / Custom_ — each preset
  sets sun position, sun color, lightness, and (if "extend water" is on) sky/water colors in
  one click. Manually changing sun position/color switches the preset back to "Custom".
- **"Show sky and extend water"**: adds a sky-colored background, distance fog, and a large
  water plane extending past the map edges, turning the terrain into an "island in an ocean"
  scene. Reveals **Sky** and **Water** color pickers when enabled.

### Labels

- **"Show 3D labels"**: renders state and burg name labels as billboard sprites floating above
  the terrain (using the same fonts/sizes/colors as the 2D label styling), plus small burg
  icon markers with connector lines down to the terrain surface.

### Export

- **Screenshot** button: saves the current 3D view as a JPEG.
- **OBJ export** button: exports the current terrain mesh (dense if eroded terrain is active)
  as a `.obj` file. Hidden in Globe mode.

## Globe view

- Projects the map onto a sphere using an **equirectangular projection** — maps with a 2:1
  aspect ratio give the best (least distorted) result; distortion is greatest at the poles.
- Standalone starfield background (independent of the mesh view's sky settings).
- **Texture resolution** select: 0.5x / 1x / 2x / 4x / 8x, mapped to a 512–8192 px texture.
- **Rotation** slider for auto-spin, same 0–10 scale as the mesh view.
- The Eroded terrain, satellite texture, wireframe, labels, sky/water, and OBJ export
  controls are mesh-only and hidden in Globe mode.

## Settings & lifecycle notes

- All 3D options live in `ThreeD.options` (an in-memory object, not persisted across page
  reloads — every session starts from the defaults described above).
- `ThreeD.update()` refreshes the current scene (texture/heightmap) without rebuilding camera
  controls; `ThreeD.redraw()` rebuilds the mesh/geometry — used after settings that change
  geometry or baked data.
- Edits made in the heightmap editor, layer visibility toggles, and world/climate
  configuration changes all trigger a 3D refresh automatically if a 3D canvas is open.
- `ThreeD.stop()` (called when returning to Standard view) disposes all three.js resources —
  geometry, materials, textures, the erosion bake cache, satellite/river-flow textures, and
  animation loops — to avoid leaking GPU memory between sessions.
