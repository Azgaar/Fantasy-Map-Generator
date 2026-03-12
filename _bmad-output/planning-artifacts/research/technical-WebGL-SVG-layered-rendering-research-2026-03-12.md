# Technical Research Report: WebGL + SVG Layered Rendering Architecture

**Date:** 2026-03-12  
**Project:** Fantasy-Map-Generator  
**Topic:** Browser compositing strategies for mixing Three.js WebGL and D3 SVG while preserving layer ordering  
**Status:** Complete

---

## 1. Research Scope

### Problem Statement

The Fantasy-Map-Generator relief icons layer is currently rendered via SVG (slow at scale). The goal is to replace or augment it with Three.js WebGL for GPU-accelerated rendering. Three candidate architectures were identified:

| Option                                 | Description                                                                                                                             | Known Issue                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **A — Canvas beside SVG**              | `<canvas>` element placed before/after the main SVG element                                                                             | No layer interleaving possible — canvas cannot be interleaved within SVG layer groups |
| **B — WebGL inside `<foreignObject>`** | Three.js canvas nested inside an SVG `<foreignObject>`                                                                                  | Forces FBO compositing on every frame; slower than pure SVG in practice               |
| **C — DOM-Split architecture**         | The single SVG is decomposed into multiple sibling DOM elements (canvas + SVG fragments), positioned absolutely and ordered via z-index | A major architectural change that may restore layer interleaving                      |

This report evaluates the browser-level feasibility of Option C and any additional approaches.

---

## 2. Browser Compositing: CSS Stacking Contexts

**Source:** MDN Web Docs — "Stacking context", CSS Compositing specification

### 2.1 What Creates a Stacking Context

Each of the following CSS conditions on an element creates a **stacking context** (a compositing boundary within which children are atomically composed together before being composited with siblings):

| CSS Property / Condition                       | Value                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `position` (non-static) + `z-index` (non-auto) | Any `position: relative/absolute/fixed/sticky` with explicit z-index |
| `opacity`                                      | `< 1`                                                                |
| `transform`                                    | Any value except `none`                                              |
| `filter`                                       | Any value except `none`                                              |
| `backdrop-filter`                              | Any value except `none`                                              |
| `clip-path`                                    | Any value except `none`                                              |
| `mask` / `mask-image` / `mask-border`          | Any non-none value                                                   |
| `mix-blend-mode`                               | Any value except `normal`                                            |
| `isolation`                                    | `isolate`                                                            |
| `will-change`                                  | Any value that would create a stacking context if set                |
| `contain`                                      | `layout`, `paint`, `strict`, or `content`                            |
| `perspective`                                  | Any value except `none`                                              |

### 2.2 Key Rules for DOM-Split Architecture

1. **Stacking contexts are atomic**: All children of a stacking context are painted together before compositing with sibling stacking contexts. Z-index values are only meaningful within the _same parent_ stacking context.
2. **Multiple sibling elements** at the same level of the DOM, each with `position: absolute` and different `z-index` values, form a Z-ordered stack — regardless of whether they are SVG, `<canvas>`, or `<div>`.
3. **`isolation: isolate`** can be used on a wrapper container to explicitly create a stacking context boundary, preventing `mix-blend-mode` from propagating upward and creating predictable compositing behavior.
4. **`will-change: transform`** hints to the browser compositor that the element should get its own layer. This is useful for canvas elements that update frequently — it avoids invalidating surrounding layers.

### 2.3 Implication for Option C

Option C is **architecturally valid** from the browser stacking context model:

- Each visual "layer" becomes a sibling DOM node at the same ancestry level
- `position: absolute; inset: 0;` makes all siblings coextensive (covering the same rectangle)
- `z-index` controls paint order
- The browser compositor stacks them correctly, regardless of element type

---

## 3. OffscreenCanvas + ImageBitmapRenderingContext

**Source:** MDN Web Docs — OffscreenCanvas API

### 3.1 Status

`OffscreenCanvas` is **Baseline Widely Available** as of 2024:

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | 69              |
| Firefox | 105             |
| Safari  | 16.4            |
| Edge    | 79              |

### 3.2 Key Patterns

**Pattern A — Worker WebGL → ImageBitmap → Visible Canvas (zero-copy transfer)**

```javascript
// main thread
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker("relief-worker.js");
worker.postMessage({canvas: offscreen}, [offscreen]);

// worker thread (relief-worker.js)
self.onmessage = ({data}) => {
  const gl = data.canvas.getContext("webgl2");
  // render loop...
  // Frames automatically appear on the visible canvas
};
```

This pushes the entire WebGL render loop off the main thread. The visible `<canvas>` element stays in the DOM at the correct z-index. The GPU work happens in a Worker.

**Pattern B — OffscreenCanvas + transferToImageBitmap (pull-style)**

```javascript
// main thread
const offscreen = new OffscreenCanvas(width, height);
const gl = offscreen.getContext("webgl2");
// render into offscreen...
const bitmap = offscreen.transferToImageBitmap();
visibleCanvas.getContext("bitmaprenderer").transferFromImageBitmap(bitmap);
```

This is synchronous on the main thread. The `ImageBitmapRenderingContext` (`bitmaprenderer`) is a lightweight context that just paints a pre-composited bitmap — no per-pixel work on the main thread.

### 3.3 WebGL Best Practices (from research)

- Prefer `webgl2` context
- Set `alpha: false` **only** if no transparency is needed; `alpha: false` can have a significant performance cost on some GPUs
- Use `gl.flush()` if rendering without `requestAnimationFrame` (e.g., render-on-demand MapGenerator pattern)
- Batch draw calls: minimize state changes between draw calls
- Use `texStorage2D` + `texSubImage2D` for texture atlas uploads
- Avoid FBO invalidation (the main cost of Option B / `<foreignObject>`)

---

## 4. Three.js Primitives for Relief Icon Rendering

**Source:** Three.js documentation — InstancedMesh, Sprite, CSS2DRenderer, CSS3DRenderer

### 4.1 InstancedMesh

`InstancedMesh(geometry, material, count)` enables drawing N copies of the same geometry in a **single draw call**:

```javascript
const mesh = new THREE.InstancedMesh(iconGeometry, iconMaterial, maxIcons);
// Per-instance position/scale/rotation:
mesh.setMatrixAt(i, matrix); // then mesh.instanceMatrix.needsUpdate = true
// Per-instance color tint:
mesh.setColorAt(i, color); // then mesh.instanceColor.needsUpdate = true
```

Key: The relief icon atlas (a single texture with all icon types as tiles) can be used with `InstancedMesh` where a per-instance attribute selects the UV offset into the atlas. This requires `ShaderMaterial` or `RawShaderMaterial` with custom UV attribute.

### 4.2 Sprite

`Sprite` is always camera-facing (billboard). Accepts `SpriteMaterial` with texture:

```javascript
const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture}));
sprite.center.set(0.5, 0.5); // anchor point
```

Sprites are **per-instance objects** — expensive for thousands of icons. `InstancedMesh` is preferred.

### 4.3 CSS2DRenderer / CSS3DRenderer (Official Three.js Addon)

Three.js has official addon renderers that solve the **inverse problem** (overlaying DOM elements on WebGL):

- `CSS2DRenderer` creates a `<div>` overlay, absolutely positioned, matching the WebGL canvas size
- `CSS3DObject` / `CSS3DSprite` HTML elements are synced to 3D world-space positions
- They use the same camera/projection — no manual coordinate mapping needed

**Relevance for Option C**: This pattern reveals that Three.js _already uses_ a multi-layer approach for mixing rendering technologies. The same coordinate synchronization technique can be applied in reverse — syncing multiple sibling DOM elements (canvas layers + SVG layers) to the same logical coordinate space.

---

## 5. Mapbox GL v3 — "Slots" Layer Ordering Pattern

**Source:** Mapbox GL JS v3 migration guide

### 5.1 The Slots Concept

Mapbox GL v3 introduced "slots" as a way to interleave custom layers within a single WebGL render context without splitting the DOM:

```javascript
map.on("style.load", () => {
  map.addLayer({id: "my-layer", slot: "middle"});
  // Slots: 'bottom' | 'middle' | 'top'
});
```

Layers are rendered in slot order: all `bottom` layers first, then `middle`, then `top` — within a single WebGL context.

### 5.2 Implications

- This pattern demonstrates that even experts at Mapbox chose a **slot abstraction inside one WebGL context** rather than DOM splitting for their primary layer ordering solution
- DOM splitting is not used in production WebGL mapping libraries — they manage draw order explicitly within a single WebGL context
- The slot system is limited to predefined positions (bottom/middle/top) in Mapbox, not arbitrary interleavings

---

## 6. deck.gl — Reactive Layer Architecture

**Source:** deck.gl developer guide — Composite Layers, Layer Extensions

### 6.1 Layer Descriptor Model

deck.gl layers are **cheap, immutable descriptors** — creating a new `Layer` instance does not create GPU resources. The GPU state (buffers, textures, shaders) is managed separately and survives layer re-creation via shallow-diffing of props.

### 6.2 CompositeLayer Pattern

```javascript
class LabeledIconLayer extends CompositeLayer {
  renderLayers() {
    return [
      new IconLayer({ ...icon props... }),
      new TextLayer({ ...text props... }),
    ];
  }
}
```

Composite layers solve the "label + icon" problem (multiple primitives per data point) without DOM involvement.

### 6.3 Layer Extensions

`LayerExtension` injects custom shader code (via GLSL injection hooks) into existing layers without subclassing. This is the mechanism for adding per-biome/per-icon-type shader behavior to an `InstancedMesh`-equivalent layer.

### 6.4 Note on Interleaving

The deck.gl interleaving documentation page (`/docs/developer-guide/interleaving`) returned 404. From context, deck.gl integrates with Mapbox/MapLibre by registering a "custom layer" inside the base map's render loop — meaning deck.gl layers participate in the slot system when `interleaved: true` is passed to the `DeckGL` constructor.

---

## 7. CSS will-change and GPU Compositor Layer Promotion

**Source:** MDN Web Docs — `will-change`

### 7.1 Usage

```css
.webgl-relief-layer {
  will-change: transform;
}
```

- Hints browser to promote element to its own GPU compositor layer
- Creates a stacking context (important for z-ordering)
- **Warning**: Use sparingly — each compositor layer consumes GPU memory
- Best practice: set via JS immediately before animation/update, remove (set to `auto`) after

### 7.2 Dynamic Application

```javascript
canvas.style.willChange = "transform";
// ... perform update ...
canvas.style.willChange = "auto";
```

For the FMG use-case (render-on-demand, not continuous animation), manually toggling `will-change` around the render call can reduce compositor overhead.

---

## 8. CSS isolation: isolate

**Source:** MDN Web Docs — `isolation`

```css
.map-container {
  isolation: isolate;
}
```

- `isolation: isolate` **forces** a new stacking context on the element
- Baseline Widely Available (Chrome 41+, Safari 8+)
- Most useful when `mix-blend-mode` is applied to children — `isolation: isolate` on the container prevents blend modes from compositing against elements outside the container
- For FMG map layers: `isolation: isolate` on the map container prevents any child `mix-blend-mode` (e.g., on the heightmap layer) from bleeding into UI elements outside the map

---

## 9. Alternative Approaches Discovered

Beyond the original three options:

### Option D — Render-to-Texture (Snapshot Pattern)

1. Three.js renders relief icons into a `WebGLRenderTarget` (off-screen FBO)
2. The FBO texture is exported as `ImageBitmap` using `gl.readPixels` or `THREE.WebGLRenderer.readRenderTargetPixels`
3. The bitmap is placed into an SVG `<image>` element at the correct layer position
4. This makes the WebGL output a **static image** from SVG's perspective — no special compositing needed

**Trade-off**: Every time icons change (zoom/pan), a re-render + readback is needed. `gl.readPixels` is synchronous and can stall the GPU pipeline. Acceptable for render-on-demand (FMG rarely re-renders all layers simultaneously).

### Option E — Pure InstancedMesh in Single Canvas, Sync Coordinates

The entire map is moved from SVG to a single `<canvas>` with Three.js rendering all layers. SVG-specific features (text labels, vector coastlines) can use Three.js `CSS3DRenderer` overlay.

**Trade-off**: Complete rewrite. Loss of SVG export capability and SVG-level accessibility.

### Option F — WebGL Points/Particles for Relief Icons

Replace Three.js Scene/Mesh with a `THREE.Points` + `PointsMaterial(sizeAttenuation: true)` + custom sprite sheet UVs. Each relief icon is a point particle with:

- Position: `BufferGeometry.setAttribute('position', ...)`
- UV offset into atlas: `BufferGeometry.setAttribute('uv', ...)`
- Custom vertex shader for per-point rotation/scale

Single draw call, extreme simplicity. No instanced matrix overhead.

### Option G — CSS3DRenderer Overlay (Hybrid DOM + WebGL)

Three.js `CSS3DRenderer` creates a `<div>` layer synchronized with the WebGL camera. By embedding SVG content inside `CSS3DObject` instances, SVG elements could theoretically track with map pan/zoom via CSS3D transforms without any canvas at all.

**Trade-off**: CSS 3D transforms are limited (no SVG-level precision), and browser compositing adds overhead. Not suitable for thousands of icons.

---

## 10. Synthesis: Evaluation Matrix

| Option               | Layer Ordering      | GPU Performance                      | Main-Thread Cost | Implementation Complexity | Risk                                |
| -------------------- | ------------------- | ------------------------------------ | ---------------- | ------------------------- | ----------------------------------- |
| A: Canvas beside SVG | ❌ Fixed at outside | ✅ Single canvas                     | Low              | Low                       | None — already tried                |
| B: foreignObject     | ✅ Correct          | ❌ FBO every frame                   | High             | Low                       | Confirmed problematic               |
| C: DOM Split         | ✅ Correct          | ✅ Good (one canvas per WebGL layer) | Medium           | **High**                  | Browser behavior with many canvases |
| D: Render-to-Texture | ✅ SVG-native       | Medium (readPixels stall)            | Low (snapshot)   | Medium                    | Stall on large maps                 |
| E: Pure Canvas       | ✅ (trivial in 3D)  | ✅ Best                              | Low              | Very High                 | Full rewrite + SVG export loss      |
| F: Points/Particles  | ✅ Same as canvas   | ✅ Best single-draw                  | Low              | Low                       | Orthographic camera needed          |
| G: CSS3D Overlay     | ✅ Correct          | Medium                               | Medium           | Medium                    | CSS3D precision limits              |

---

## 11. Key Technical Constraints for Fantasy-Map-Generator

From codebase analysis:

1. **Render-on-demand pattern**: FMG re-renders layers when map data changes (not on every animation frame). This means `requestAnimationFrame` loops are not used.
2. **SVG + D3 coordinate system**: All current layer positions use SVG viewport coordinates. Any WebGL canvas must map to the same coordinate space.
3. **Layer order is significant**: At least these layers must interleave correctly: `terrs` (terrain), `rivers`, `routes`, `relief`, `borders`, `burgIcons`, `markers`.
4. **TypedArray cell data**: The packed graph data is already GPU-friendly (TypedArrays). Uploading to WebGL buffers is straightforward.
5. **Two canvas limit concern**: Browsers typically allow 8-16 WebGL contexts before older ones are lost. Each `<canvas>` using WebGL counts. Option C with multiple WebGL canvases may hit this limit.

---

## 12. Recommended Focus Areas for Brainstorming

Based on research, the three most promising directions for deep exploration:

1. **Option C (DOM Split) — low canvas count variant**: Use a single WebGL canvas for all GPU-accelerated layers (not one per layer). Multiple SVG fragments and one WebGL canvas are interleaved by z-index. The single canvas renders only the union of GPU layers.

2. **Option F (Points/Particles) — single canvas, relief only**: Keep the existing SVG stack intact, add one `<canvas>` element with WebGL `gl.POINTS` rendering relief icons. Position the canvas using `position: absolute` and `z-index` in the correct slot. This is the minimal change.

3. **Option D (Snapshot) — render-to-texture + SVG `<image>`**: Three.js renders into FBO, FMG reads it as ImageBitmap (or uses CanvasTexture trick), injects into SVG `<image>` tag at correct layer. Leverages SVG's native layer ordering.

---

## 13. Wave 2 Research: Single-Canvas WebGL Layer Management

_Added in response to follow-up question: "Can we render all layers into a single WebGL Canvas with sublayers (z-index) inside, toggle them, reorder them, then have 1 SVG on top for interactive elements?"_

### 13.1 Mapbox GL JS — Proof of Concept (Production Scale)

Mapbox GL renders its entire map (ocean, terrain, labels, symbols, raster tiles, lines) in **one single WebGL context**. Layer management APIs:

| API                                                          | Description                                                                                    |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `map.moveLayer(id, beforeId)`                                | Reorders a layer in the draw stack within the same slot; cross-slot moves are silently ignored |
| `map.setLayoutProperty(id, 'visibility', 'none'\|'visible')` | O(1) visibility toggle — GPU buffers (VBOs, textures) stay allocated                           |
| `map.addLayer(layerObj, beforeId)`                           | Inserts a new layer at a specific position in the draw stack                                   |

**Key constraint:** Mapbox's slot system (`bottom`, `middle`, `top`) buckets layers — `moveLayer` only works within a slot. This implies even at production scale, a hierarchical ordering model is needed for complex layer stacks.

**Conclusion:** Single WebGL canvas with full layer ordering is used in production at massive scale. It absolutely works technically.

### 13.2 deck.gl — Layer Management Patterns (Optimal GPU Preservation)

deck.gl uses a declarative layer array (`deck.setProps({ layers: [...] })`). Key learnings:

| Pattern                                       | Mechanism                                                      | GPU Impact                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Toggle visibility**                         | `new Layer({ visible: false })` prop                           | **GPU state preserved** — VBOs, shader programs stay allocated; recommended over conditional rendering |
| **Conditional rendering** (remove from array) | Layer removed from layers array                                | GPU state **destroyed** — expensive re-upload on next show; NOT recommended                            |
| **Reorder layers**                            | Re-order entries in layers array + call `setProps`             | deck.gl diffs by layer `id`, matches existing GPU state; zero re-upload                                |
| **Z-fighting prevention**                     | `getPolygonOffset: ({ layerIndex }) => [0, -layerIndex * 100]` | Automatic polygon offset per layer index; handles coplanar layers                                      |

**Critical insight:** The `visible: false` prop pattern preserves GPU state (avoids costly re-upload on show/hide toggle). This pattern is the correct one to use when designing FMG layer toggles in any WebGL migration.

### 13.3 Three.js — Layer Management APIs

| API                                | Description                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Object3D.visible = false`         | Hides the object; GPU buffers stay allocated; equivalent to deck.gl `visible: false`                                                                                                                                                 |
| `Object3D.renderOrder = n`         | Integer draw order override; lower numbers rendered first (painter's algorithm); works on `Group` objects (all children sorted together)                                                                                             |
| `Object3D.layers` (Layers bitmask) | 32 bitmask slots for **camera culling**, not draw order; `camera.layers.enable(n)` + `object.layers.set(n)` — camera renders only objects sharing at least one layer bit. Useful for selective rendering passes, not for z-ordering. |

**For FMG use case:** `renderOrder` is the correct API for z-ordering multiple logical layers within one Three.js scene. `visible` is the correct API for layer toggles.

```typescript
// In Three.js, assign each FMG layer a Group with renderOrder:
const oceanlayers = new THREE.Group();
oceanlayers.renderOrder = 1; // bottom

const rivers = new THREE.Group();
rivers.renderOrder = 11;

const relief = new THREE.Group();
relief.renderOrder = 12;

const burgIcons = new THREE.Group();
burgIcons.renderOrder = 26;

// Toggle:
burgIcons.visible = false; // GPU buffers stay allocated, instant toggle

// Reorder:
rivers.renderOrder = 15; // Instantly reorders in next frame
```

---

## 14. FMG SVG Architecture Deep Dive (Complete Layer Inventory)

_Confirmed via full codebase analysis of public/main.js and src/index.html._

### 14.1 Container Structure

- `<svg id="map">` — root SVG element; D3 zoom and resize targets it
- `<g id="viewbox">` — single transform container; **ALL map layers live here**; D3 zoom applies `translate(x y) scale(z)` to this element
- `#scaleBar`, `#legend`, `#vignette` — **outside** `#viewbox`; fixed on screen (screen coordinates, not map coordinates)

### 14.2 Complete Layer Stack (32 layers, bottom to top)

| #   | `<g id>`                                                     | Renders                            | SVG Feature Used                                                                        |
| --- | ------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `ocean` + `oceanLayers`, `oceanPattern`                      | Depth gradient, ocean texture      | `<path>`, `<rect>`, `url(#oceanic)` pattern                                             |
| 2   | `lakes` + 6 sublayers                                        | Lake fills by type                 | `<path>`                                                                                |
| 3   | `landmass`                                                   | Base land color                    | `<rect>` + fill color                                                                   |
| 4   | `texture`                                                    | Land texture overlay               | `<image>`                                                                               |
| 5   | `terrs` + `oceanHeights`, `landHeights`                      | Elevation contour bands            | `<path>`                                                                                |
| 6   | `biomes`                                                     | Biome color fills                  | `<path>`                                                                                |
| 7   | `cells`                                                      | Voronoi cell grid                  | Single `<path>`                                                                         |
| 8   | `gridOverlay`                                                | Hex/square grid                    | `<rect>` + `url(#pattern_*)` pattern                                                    |
| 9   | `coordinates` + `coordinateGrid`, `coordinateLabels`         | Lat/lon graticule + labels         | `<path>`, **`<text>`**                                                                  |
| 10  | `compass`                                                    | Compass rose                       | **`<use xlink:href="#defs-compass-rose">`**                                             |
| 11  | `rivers`                                                     | River bezier curves                | `<path>`                                                                                |
| 12  | `terrain`                                                    | Relief icons                       | **`<use href="#defs-relief-*">`** per icon                                              |
| 13  | `relig`                                                      | Religion fills                     | `<path>`                                                                                |
| 14  | `cults`                                                      | Culture fills                      | `<path>`                                                                                |
| 15  | `regions` + `statesBody`, `statesHalo`                       | State fills + halo                 | `<path>`, **`<clipPath>`**                                                              |
| 16  | `provs` + `provincesBody`, `provinceLabels`                  | Province fills + labels            | `<path>`, **`<text>`**                                                                  |
| 17  | `zones`                                                      | Zone fills                         | `<path>`                                                                                |
| 18  | `borders` + `stateBorders`, `provinceBorders`                | Political borders                  | `<path>`                                                                                |
| 19  | `routes` + `roads`, `trails`, `searoutes`                    | Transport routes                   | `<path>`                                                                                |
| 20  | `temperature`                                                | Temperature cells + values         | colored fills, **`<text>`**                                                             |
| 21  | `coastline` + `sea_island`, `lake_island`                    | Coastline shapes                   | `<path>`                                                                                |
| 22  | `ice`                                                        | Glaciers, icebergs                 | `<path>`                                                                                |
| 23  | `prec` + `wind`                                              | Precipitation circles, wind arrows | `<circle>`, **`<text>` (unicode glyphs)**                                               |
| 24  | `population` + `rural`, `urban`                              | Population bars                    | `<line>`                                                                                |
| 25  | `emblems` + `burgEmblems`, `provinceEmblems`, `stateEmblems` | Heraldic CoAs                      | **`<use href="#...">` COA symbols from `#defs-emblems`**                                |
| 26  | `icons` + `burgIcons`, `anchors`                             | Burg icons, port anchors           | **`<use href="#icon-*">` from `#defElements`**                                          |
| 27  | `labels` + `states`, `addedLabels`, `burgLabels`             | All map text labels                | **`<text><textPath xlink:href="#">`** (curved state labels), **`<text>`** (burg labels) |
| 28  | `armies`                                                     | Regiment markers                   | **`<text>` (emoji/icon)**, `<image>` (banner)                                           |
| 29  | `markers`                                                    | Point of interest icons            | `<image href="...">`                                                                    |
| 30  | `fogging-cont`                                               | Fog of war                         | `<rect>` + mask                                                                         |
| 31  | `ruler`                                                      | Measurement tools                  | `<path>`, `<circle>`, **`<text>`**                                                      |
| 32  | `debug`                                                      | Editor overlays                    | temporary                                                                               |

### 14.3 SVG Features that Cannot Trivially Move to WebGL

| Feature                               | Layers Using It                                                                                                         | WebGL Migration Cost                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `<text>` + `<textPath>` (curved text) | `#labels>#states`, `#addedLabels`                                                                                       | **VERY HIGH** — SDF font atlas or DOM overlay required; `<textPath>` has no WebGL equivalent |
| `<text>` (normal)                     | `#burgLabels`, `#coordinateLabels`, `#provinceLabels`, `#temperature`, `#prec>#wind`, `#armies`, `#scaleBar`, `#legend` | HIGH — CSS2DRenderer overlay or SDF atlas                                                    |
| `<use>` + defs symbols                | `#terrain`, `#compass`, `#emblems`, `#icons`, `#burgIcons`, `#anchors`                                                  | HIGH — must pre-rasterize all symbols to texture atlases                                     |
| `<clipPath>`                          | `#regions>#statesHalo`                                                                                                  | MEDIUM — WebGL stencil buffer; doable but different model                                    |
| `fill="url(#pattern*)"`               | `#ocean>#oceanPattern`, `#gridOverlay`                                                                                  | MEDIUM — WebGL texture tiling shader                                                         |
| `fill="url(#hatch*)"`                 | Various political layers                                                                                                | MEDIUM — WebGL texture tiling shader                                                         |
| `<image>`                             | `#texture`, `#markers`, `#armies`                                                                                       | LOW — Three.js `PlaneGeometry` + `TextureLoader`                                             |

### 14.4 SVG Export System (Critical Path)

File: `public/modules/io/export.js` — `exportToSvg()` / `getMapURL()`

The export function:

1. **Clones `#map` SVG element** via `cloneNode(true)`
2. Serializes the entire SVG DOM tree to XML string
3. Copies emblem COA symbols, compass, burg icons, grid patterns, hatch patterns into export defs
4. Converts raster image `href`s to base64 for self-contained export
5. Inlines all computed CSS styles
6. Copies all font face data-URIs as inline `<style>`

**If any layer moves to WebGL canvas:** that canvas pixel data is **not** in the SVG DOM — it would be invisible in the SVG export unless explicitly read back via `canvas.toDataURL()` and injected as a `<image>` element. This produces a rasterized inset, not vectors.

**This is the single most important constraint for any full WebGL migration.**

### 14.5 Interactive Event Architecture

All map interactions route through `public/modules/ui/editors.js` → `clicked()`:

```
click on SVG element → clicked() walks DOM ancestry → dispatches to editor:
  #emblems → editEmblem()
  #rivers  → editRiver(el.id)
  #routes  → editRoute(el.id)
  #labels  → editLabel()
  #burgLabels | #burgIcons → editBurg()
  #ice     → editIce(el)
  #markers → editMarker()
  etc.
```

The SVG overlay approach (one thin SVG on top of WebGL canvas) for interactivity is architecturally sound — `pointer-events:none` on canvas, SVG captures all clicks. However, the SVG hit-test shapes must exactly match the WebGL-rendered visual shapes, which requires keeping both systems in sync.

---

## 15. Single-Canvas Full WebGL Migration: Honest Assessment

### 15.1 What Gets Faster (and by How Much)

| Layer Type                              | Current (SVG)                         | WebGL Estimate                                      | Speedup                           |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------- | --------------------------------- |
| Terrain fills (`terrs`, `biomes`, etc.) | 10k+ SVG polygon paint                | Triangulated `BufferGeometry` fills                 | 20–100×                           |
| Relief icons (`terrain`)                | SVG `<use>` elements, per-element DOM | `InstancedMesh` + texture atlas, 1 draw call        | **100–200×**                      |
| Rivers/borders/coastlines               | SVG `<path>` lines                    | Three.js `LineSegments` `BufferGeometry`            | 10–50×                            |
| State/culture/province fills            | Complex SVG paths + clip masks        | Pre-triangulated WebGL meshes                       | 20–50×                            |
| Labels (all `<text>`)                   | SVG text (fast in SVG)                | CSS2DRenderer DOM overlay (same speed) or SDF atlas | 0× (no gain) or complex migration |
| Emblems COAs                            | SVG `<use>` symbols                   | Pre-rasterized sprite texture (loss of quality)     | Hard                              |
| Map pan/zoom                            | D3 transform on `#viewbox`            | Camera matrix uniform, sub-ms                       | Equivalent                        |

**Bottom line on performance:** The layers consuming the most paint time (10k+ polygons, relief icons) would be **dramatically faster** in WebGL. The overhead layers (labels, emblems) would either stay the same (DOM overlay) or require complex SDF solutions.

### 15.2 What Breaks (Severity)

| Feature                                   | Severity         | Required Solution                                                                                                                        |
| ----------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **SVG export** (editable vector file)     | 🔴 HARD BLOCKER  | Must maintain parallel SVG structure OR rasterize WebGL layers to `<image>` in export (breaks editability) OR build WebGL→SVG serializer |
| **Curved text labels** (`<textPath>`)     | 🔴 HIGH          | No WebGL equivalent; must use DOM overlay (CSS2DRenderer) or SDF font atlas + custom path-text renderer                                  |
| **Emblem `<use>` / COA system**           | 🔴 HIGH          | SVG symbol system is deeply integrated; would need to pre-rasterize all ~1000+ possible charges to texture atlas                         |
| **`<clipPath>` halo effects**             | 🟠 MEDIUM        | WebGL stencil buffer (doable, but different model)                                                                                       |
| **Pattern fills** (halos, grid, hatching) | 🟠 MEDIUM        | WebGL texture tiling shaders                                                                                                             |
| **Click dispatch via DOM ancestry**       | 🟠 MEDIUM        | SVG overlay captures events; thin SVG matching shapes must be maintained                                                                 |
| **All 32 layers must be reimplemented**   | 🔴 TOTAL REWRITE | Months of engineering work                                                                                                               |

### 15.3 Honest Recommendation

**Full single-canvas WebGL migration is technically correct but not advisable for FMG** due to the SVG export blocker. The map's core value proposition to users is downloadable, editable, shareable `.svg` files — beautiful vector maps. Replacing this with PNG-only output would be a fundamental regression.

**Recommended approach instead — Hybrid GPU acceleration:**

1. **Keep the SVG stack** (30 layers, labels, emblems, interactions, export — all stay)
2. **Add one WebGL canvas behind the SVG** for the 3 highest-impact performance layers:
   - Relief icons (`#terrain`) → `InstancedMesh` → 100× faster (**the original goal**)
   - Possibly terrain fills (`#terrs`) → pre-triangulated fills → 30× faster
3. **SVG export** — for WebGL-rendered layers, inject `canvas.toDataURL()` as `<image>` in the SVG export; these layers become rasterized in the exported SVG (acceptable trade-off — terrain fills and relief icons don't need to be editable vectors)
4. **Layer ordering** — use CSS z-index between the WebGL canvas and SVG fragments (Option C-revised from wave 1 research)

This gives **80% of the performance gain at 20% of the migration cost**, without destroying SVG export.

---

## 17. Wave 3 Research: Framework Selection for FMG's Arbitrary Data Model

### 17.1 The Coordinate System Problem

Before evaluating frameworks, the single most decisive factor is **coordinate system compatibility**. FMG uses a pixel-space origin at top-left, Y-increasing downward, with `graphWidth=960` and `graphHeight=540` as the default canvas dimensions. All cell centers, vertex coordinates, burg positions, and relief icon placements are expressed in this space. **No GeoJSON, no latitude/longitude, no Mercator projection anywhere in the codebase.**

This eliminates entire classes of frameworks at a glance.

---

### 17.2 Mapbox GL JS

**Source:** Mapbox GL JS API docs — `Map`, `CustomLayerInterface`, `addLayer`

#### Coordinate System Compatibility

Mapbox GL is architecturally inseparable from the Web Mercator projection. Every map instance requires a `center: [lng, lat]` and zoom level `0–22`. All built-in layers (fill, line, circle, symbol) consume **GeoJSON sources** with WGS84 longitude/latitude values. The `CustomLayerInterface.render(gl, matrix)` method gives access to the raw WebGL context and a projection matrix — but that matrix is a **Mercator warp matrix** (world space → NDC via Mercator projection). Feeding pixel-space coordinates to it would produce wildly incorrect results unless you construct a matching inverse transform, making pixel-space coordinates expensive to work with and requiring constant maintenance as Mapbox's internals evolve.

Theoretically you _could_ treat the Mercator world as a coordinate proxy and map FMG pixel coordinates to geographic coordinates (e.g., map [0,960] → [-180,180] and [0,540] → [-90,90]), but:

1. Mercator is not linear in Y — the grid cells closer to "poles" would be distorted.
2. Every coordinate conversion (bi-directional) would need to happen for all 10,000 cells on every map re-render.
3. Features like `queryRenderedFeatures`, collision detection, and label placement would all behave incorrectly.

#### Additional Costs

- **Requires API key**: Mapbox GL JS requires `mapboxgl.accessToken` set to a valid paid API key. FMG is a free, open-source application. This is a direct financial and licensing concern.
- **Bundle size**: ~900KB gzipped.
- **rAF rendering loop**: Mapbox maintains a continuous WebGL rendering loop; integrating on-demand rendering (FMG's model — render when user makes a change) is awkward.
- **Style system overhead**: Full style specification parsing, tile loading, glyph/sprite management — unused infrastructure for FMG.

**Verdict: ❌ Incompatible. Do not use.**

---

### 17.3 MapLibre GL

**Source:** MapLibre GL is the community-maintained open-source fork of Mapbox GL JS v1.

MapLibre GL shares Mapbox GL's architecture entirely: Mercator projection, GeoJSON tile-based data model, `CustomLayerInterface` with the same projection matrix constraints. It does not require an API key (significant improvement over Mapbox), and its bundle is slightly smaller (~700KB gzipped), but the fundamental geographic data model incompatibility with FMG remains.

**Verdict: ❌ Same data model incompatibility as Mapbox GL. No API key is an improvement, but the coordinate system mismatch is disqualifying.**

---

### 17.4 deck.gl

**Sources:** deck.gl docs — `OrthographicView`, `Views and Projections`, `Performance Optimization` (binary data)

#### Coordinate System Compatibility

deck.gl is **explicitly designed for non-geospatial 2D data** via its `OrthographicView`. The `Views and Projections` guide states directly: _"If using non-geospatial data, you will need to manually create a view that is appropriate for info-vis, e.g.: `new OrthographicView()`"_

The `OrthographicView` view state parameters:

- `target: [480, 270, 0]` — viewport center in world units (FMG pixel space, set to center of map)
- `zoom: 0` — maps **1 world unit to 1 screen pixel** by default; increasing zoom by 1 doubles scale
- `flipY: true` (default) — enables **top-left origin, Y-increases downward**, exactly matching FMG/SVG convention

This means FMG's raw pixel coordinates can be fed directly to deck.gl layers in `OrthographicView` mode without any conversion.

#### Binary / TypedArray Data

deck.gl supports `Float32Array` input at two levels:

**Level 1 — Binary blob with stride accessor** (medium overhead):

```ts
const DATA = {src: Float32Array, length: N};
new ScatterplotLayer({
  data: DATA,
  getPosition: (_, {index, data}) => data.src.subarray(index * 2, index * 2 + 2)
});
```

**Level 2 — Pre-built GPU attributes** (zero CPU overhead):

```ts
// Positions pre-packed as Float32Array: x0,y0,x1,y1,...
new Layer({
  data: {length: N, attributes: {getPosition: {value: positionsFloat32, size: 2}}}
});
```

Level 2 completely bypasses deck.gl's CPU attribute generation. This is directly compatible with FMG's `vertices.p` array (array of `[number, number]` pairs that can be converted to `Float32Array` once at map generation and cached).

#### Standalone (No Basemap) Usage

deck.gl can be used with no geographic basemap:

```ts
new Deck({
  canvas: myCanvas,
  views: new OrthographicView({ flipY: true }),
  viewState: { target: [graphWidth/2, graphHeight/2, 0], zoom: 0 },
  layers: [...]
});
```

No basemap, no map style, no tile server, no API key.

#### Built-in Layers Relevant to FMG

| deck.gl Layer       | FMG Use Case                         | Notes                                                                  |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| `SolidPolygonLayer` | Cell fills (biomes, states, terrain) | CPU earcut triangulation per update                                    |
| `ScatterplotLayer`  | Burgs, markers, icons                | Instanced rendering                                                    |
| `PathLayer`         | Rivers (solid-width stroke), borders | Only uniform width; for variable-width rivers a custom layer is needed |
| `TextLayer`         | Labels                               | WebGL text via SDF glyphs; limited curved-text support                 |
| `BitmapLayer`       | Texture overlays                     | Useful for pre-rendered backgrounds                                    |

**Critical limitation for polygon fills:** `SolidPolygonLayer` accepts `getPolygon` returning `[x, y][]` per-cell. FMG stores vertex rings as indices into `vertices.p`: `cells.v[i].map(v => vertices.p[v])`. Converting this is a `O(totalVertices)` JS array mapping per update. At 10,000 cells it's manageable for single renders but still allocates JS arrays.

**Critical limitation for rivers:** Rivers are variable-width closed polygons (Catmull-Rom + left/right offset arrays). deck.gl's `PathLayer` is uniform-width stroked lines. River rendering would require a custom deck.gl `ShaderLayer`, which is effectively raw luma.gl WebGL code.

#### Rendering Model

deck.gl uses `requestAnimationFrame` internally. Calling `deckInstance.setProps({layers})` triggers a re-render on the next frame. For FMG's on-demand model this is acceptable (1–2ms frame latency) but requires awareness that renders do not happen synchronously.

#### Costs

- **Bundle size**: ~480KB gzipped for `@deck.gl/core` + `@deck.gl/layers`. This is an entirely new dependency on top of Three.js which is already present.
- **Rendering model tension**: rAF-based loop vs. FMG's event-driven renders.
- **Polygon triangulation**: `SolidPolygonLayer` does earcut on CPU on data change — same work as Three.js + earcut, but with the overhead of the deck.gl framework layer.
- **River rendering**: No built-in support; custom layer needed.

**Verdict: ✅ Technically compatible with FMG data model. Excellent API. However, it's a large new dependency on top of Three.js.**

---

### 17.5 Three.js (Already in Project)

**Sources:** Existing FMG codebase — `src/renderers/draw-relief-icons.ts`; Three.js API docs

#### Coordinate System Compatibility

Three.js already uses the **correct coordinate system** for FMG:

```typescript
// From src/renderers/draw-relief-icons.ts
camera = new THREE.OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1);
// top=0, bottom=graphHeight → Y-down, matches perfect SVG/FMG coordinate system
```

This camera setup was established in the existing relief icon renderer. Every future WebGL layer can reuse it as-is.

#### TypedArray / BufferGeometry Data

`THREE.BufferGeometry` accepts typed arrays directly as vertex attributes:

```typescript
const positions = new Float32Array(triangleCount * 6); // x0,y0, x1,y1, x2,y2 ...
// Fill from vertex rings: cells.v[i].map(v => vertices.p[v]) → earcut triangles
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(positions, 2));
```

FMG's `vertices.p` (array of `[x,y]` pairs) maps directly to `Float32Array` with zero coordinate conversion. The only additional step for polygon fills is **earcut triangulation** (a ~3KB dependency outputting flat `[x0,y0,x1,y1,x2,y2,...]` triangle arrays, usable directly as the position buffer).

#### Layer Management

Three.js provides complete layer management:

```typescript
const scene = new THREE.Scene();
// Ordering
mesh.renderOrder = 2; // controls draw order
// Visibility toggle (no re-upload to GPU)
mesh.visible = false;
// Group reordering
scene.children.splice(fromIdx, 1);
scene.children.splice(toIdx, 0, mesh);
```

This is functionally equivalent to deck.gl's `visible` prop and `renderOrder` (as verified in Wave 2 research).

#### On-Demand Rendering

```typescript
// Render ONLY when needed — completely natural in Three.js
function redrawWebGL() {
  renderer.render(scene, camera);
}
// Called by user action, not rAF loop
```

This matches FMG's event-driven model perfectly. Three.js doesn't force a render loop.

#### Custom Shaders

`THREE.ShaderMaterial` provides full GLSL control when built-in materials are insufficient:

```typescript
new THREE.ShaderMaterial({
  vertexShader: `...`,
  fragmentShader: `...`,
  uniforms: {u_colorMap: {value: biomeTexture}}
});
```

Example: biome fills using a 1D color lookup texture (avoids per-vertex color arrays), or contour lines using height-threshold fragment shader.

#### Relevant Three.js Primitives for FMG Layers

| Three.js Primitive                | FMG Use Case                          | Notes                                                                                                   |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `InstancedMesh`                   | Relief icons (`#terrain`)             | **Already implemented**; 100–200× over SVG `<use>`                                                      |
| `Mesh` + `BufferGeometry`         | Cell fills (biomes, states, terrain)  | Earcut triangulation once per generation                                                                |
| `LineSegments` + `BufferGeometry` | Coastlines, rivers (outline), borders | Uniform width; variable-width via geometry                                                              |
| `Mesh` (custom vertex layout)     | Rivers (variable-width polygon)       | Pre-computed Catmull-Rom + offset polygon in existing `layers.js`; just pass vertices to BufferGeometry |
| `ShaderMaterial`                  | Height contours, animated effects     | Full GLSL control                                                                                       |
| `CSS2DRenderer`                   | Text labels (overlay)                 | DOM-based; no GPU acceleration but avoids regression                                                    |

#### Costs

- **Already in project**: Zero new bundle weight.
- **Polygon triangulation**: Needs `earcut` (~3KB); One-time cost per map generation, result cached.
- **No curved text**: Labels with `<textPath>` have no Three.js equivalent; CSS2DRenderer is the workaround (same speed as SVG, no regression).
- **Some manual work**: Scene management, layer add/remove is more explicit than deck.gl's declarative API.

**Verdict: ✅ Best fit for FMG. Already present, already correctly calibrated for pixel-space, natural on-demand rendering model, direct TypedArray data path.**

---

### 17.6 Custom WebGL2 (or via luma.gl)

Custom WebGL2 offers maximum flexibility and zero framework overhead. For FMG's use case, the key primitives are:

- `gl.drawArraysInstanced()` → relief icons (same as `InstancedMesh` but manual)
- `gl.drawElements()` with index buffer → polygon fills
- GLSL uniforms for color tables, zoom transforms

The main cost is maintenance burden: projection matrices, state management, draw-call ordering, shader compilation, context loss/restore handling, and future feature development all require custom WebGL code. Three.js handles all of this with battle-tested infrastructure.

`luma.gl` (the WebGL abstraction underlying deck.gl) would reduce the raw WebGL burden, but adds the same ~480KB bundle as deck.gl itself.

**Verdict: ⚠️ Viable, but Three.js with `ShaderMaterial` captures 95% of custom shader flexibility without abandoning Three.js's infrastructure. Only worth pursuing if Three.js's constraints become blocking.**

---

### 17.7 Cross-Framework Comparison

| Criterion                        | Mapbox GL              | MapLibre GL            | deck.gl                          | **Three.js**                  | Custom WebGL2         |
| -------------------------------- | ---------------------- | ---------------------- | -------------------------------- | ----------------------------- | --------------------- |
| **FMG pixel-space coords**       | ❌ Mercator only       | ❌ Mercator only       | ✅ OrthographicView              | ✅ Already working            | ✅ Full control       |
| **TypedArray data (no GeoJSON)** | ❌ GeoJSON req.        | ❌ GeoJSON req.        | ✅ Binary attributes             | ✅ BufferGeometry             | ✅ Direct VBOs        |
| **Already in project**           | ❌                     | ❌                     | ❌                               | ✅ v0.183.2                   | N/A (no dep)          |
| **Bundle overhead**              | ~900KB                 | ~700KB                 | ~480KB                           | **0** (present)               | 0                     |
| **API key / cost**               | ✅ Required            | ❌ Not required        | ❌ Not required                  | ❌ Not required               | ❌ Not required       |
| **On-demand rendering**          | ⚠️ Loop-based          | ⚠️ Loop-based          | ⚠️ rAF (1-frame lag)             | ✅ Native                     | ✅ Native             |
| **Layer visibility toggle**      | ✅                     | ✅                     | ✅ `visible` prop                | ✅ `.visible`                 | Manual                |
| **Layer draw ordering**          | ✅ Slots / beforeId    | ✅                     | ✅ `renderOrder`                 | ✅ `renderOrder`              | Manual                |
| **Polygon fills**                | GeoJSON fill layer     | GeoJSON fill layer     | `SolidPolygonLayer` (CPU earcut) | `BufferGeometry` + earcut     | VBO + earcut          |
| **Instanced icons**              | Symbol layer           | Symbol layer           | `ScatterplotLayer`               | `InstancedMesh` ✅            | `drawArraysInstanced` |
| **Variable-width rivers**        | ❌ N/A                 | ❌ N/A                 | ❌ Custom layer needed           | ✅ Pre-built polygon → `Mesh` | ✅ VBO                |
| **Custom shaders**               | `CustomLayerInterface` | `CustomLayerInterface` | `ShaderLayer` / luma.gl          | `ShaderMaterial`              | Direct GLSL           |
| **Text labels**                  | Symbol layer           | Symbol layer           | `TextLayer` (limited)            | `CSS2DRenderer`               | Canvas2D texture      |
| **Maintenance overhead**         | Low (managed)          | Low (managed)          | Low-Medium                       | **Medium** (established)      | High                  |
| **FMG data codec needed?**       | Yes (→ GeoJSON WGS84)  | Yes (→ GeoJSON WGS84)  | Minor (→ Float32Array)           | **Minimal** (vertices direct) | None                  |

---

## 18. Final Framework Recommendation

### 18.1 Primary Recommendation: Three.js (Expand Existing Usage)

**Primary recommendation: continue using Three.js. Expand its usage to additional layers.**

Rationale:

1. **Zero new dependency**: Three.js 0.183.2 is already installed and configured. Adding polygon fills to the WebGL scene costs nothing in bundle size.

2. **Coordinate system already correct**: `OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1)` established in `draw-relief-icons.ts` is the exact pixel-space camera needed. No translation layer required.

3. **Direct typed array path**: FMG stores all geometry in `Uint16Array`/`Float32Array`/`number[][]`. These map directly to `BufferGeometry` attributes. The only extra step for fills is earcut triangulation — a single ~3KB library, computed once per map generation.

4. **On-demand render model**: Three.js renders exactly when `renderer.render(scene, camera)` is called. No frame loop, no stale-frame latency. This matches FMG's event-driven update model (map regeneration, layer toggle, user edit).

5. **Variable-width rivers**: Rivers in FMG are already pre-computed as variable-width closed polygons (Catmull-Rom + left/right offsets in `layers.js`). These vertex arrays can be passed directly to `BufferGeometry` — no special framework support needed.

6. **Layer management equivalence**: Three.js's `renderOrder`, `visible`, and `scene.children` ordering provide the same functional layer management as deck.gl's production-proven API — just more explicit.

7. **Custom shaders available**: `ShaderMaterial` with GLSL unlocks height-based contour rendering, animated water effects, biome color ramp textures, etc. — without abandoning Three.js infrastructure.

### 18.2 Why Not deck.gl?

deck.gl's `OrthographicView` is technically compatible with FMG's data model, and its binary attribute API is excellent. However:

- It would add ~480KB to a bundle where Three.js is already present and sufficient
- `SolidPolygonLayer` does CPU earcut triangulation on every data change — the same operation needed in Three.js, with additional framework overhead
- River rendering (variable-width polygon) requires a custom deck.gl `ShaderLayer` — equivalent work to using `ShaderMaterial` in Three.js but with luma.gl's API instead of Three.js's well-documented one
- FMG's on-demand render model requires working around deck.gl's rAF loop
- The declarative API convenience doesn't justify the bundle addition when Three.js already handles the use case

deck.gl would be the correct choice if FMG were starting from scratch with no existing WebGL dependency. Given Three.js is already present and correctly configured, deck.gl adds cost without adding capability.

### 18.3 Why Not Mapbox GL or MapLibre GL?

Both are eliminated by the coordinate system mismatch. Their built-in layers require GeoJSON WGS84 coordinates. FMG's data is arbitrary pixel space. The `CustomLayerInterface` provides low-level WebGL access but against a Mercator projection matrix, making pixel-space rendering a constant source of complexity. Additionally, Mapbox GL requires a paid API key, which is incompatible with an open-source free tool.

### 18.4 Revised Phased Implementation Path (Three.js)

Building on the hybrid recommendation from Section 15.3:

| Phase              | Layer                               | Technique                                                                                      | Est. Speedup | Complexity                   |
| ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------ | ---------------------------- |
| **Phase 0** (done) | Relief icons (`#terrain`)           | `InstancedMesh` + texture atlas                                                                | 100–200×     | ✅ Complete                  |
| **Phase 1**        | Terrain fills (`#terrs`, `#biomes`) | `BufferGeometry` + earcut, per-cell biome colors                                               | 20–50×       | Low                          |
| **Phase 2**        | Heightmap contours                  | `ShaderMaterial` height-threshold, or `LineSegments` from pre-traced chains                    | 30–80×       | Medium                       |
| **Phase 3**        | State/culture/province fills        | `BufferGeometry` + earcut, per-cell state color                                                | 20–50×       | Low (reuse Phase 1 pipeline) |
| **Phase 4**        | Rivers                              | Pass pre-built variable-width polygon vertices to `Mesh` (reuse existing `layers.js` geometry) | 10–30×       | Medium                       |
| **Optional**       | Coastlines/borders                  | `LineSegments` or `ShaderMaterial` anti-aliased lines                                          | 10–40×       | Low-Medium                   |

**Key engineering invariant:** The SVG stack stays intact for all 32 layers. WebGL layers are rendered to a canvas positioned _behind_ the SVG via CSS `z-index`. SVG export injects `canvas.toDataURL()` as `<image>` for WebGL-rendered layers (rasterized in export, acceptable trade-off for terrain/fill layers).

### 18.5 Data Pipeline for Polygon Fills (Phase 1 Reference)

```typescript
// 1. Collect all vertex rings per biome/state group
// cells.v[i] = vertex ring for cell i (array of vertex IDs)
// vertices.p[v] = [x, y] coordinates of vertex v

// 2. One-time triangulation (at map generation, cached)
import Earcut from "earcut"; // 3KB
const rings = cells.v[cellIdx].map(v => vertices.p[v]); // [[x0,y0],[x1,y1],...]
const flatCoords = rings.flat(); // [x0,y0,x1,y1,...]
const triangles = Earcut.triangulate(flatCoords, null, 2); // indices into flatCoords

// 3. Accumulate per-biome into Float32Array position buffer
// Group cells by biome, build one Mesh per biome (batches all draws to 12 draw calls for 12 biomes)

// 4. Create BufferGeometry
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(positionsFloat32, 2));
geo.setIndex(new THREE.BufferAttribute(indexUint32, 1));

// 5. MeshBasicMaterial or ShaderMaterial
const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: biomeColor}));
mesh.renderOrder = LAYER_ORDER.TERRAIN_FILLS; // z-ordering
scene.add(mesh);
```

This reduces 10,000 SVG polygon elements to **≤12 WebGL draw calls** (one per biome), with geometry calculated once and GPU-resident.

---

## 16. Updated Sources

| Topic                             | URL                                                                       |
| --------------------------------- | ------------------------------------------------------------------------- |
| Mapbox moveLayer                  | https://docs.mapbox.com/mapbox-gl-js/api/map/#map#movelayer               |
| Mapbox setLayoutProperty          | https://docs.mapbox.com/mapbox-gl-js/api/map/#map#setlayoutproperty       |
| Mapbox CustomLayerInterface       | https://docs.mapbox.com/mapbox-gl-js/api/properties/#customlayerinterface |
| deck.gl layer `visible` prop      | https://deck.gl/docs/api-reference/core/layer#visible                     |
| deck.gl using layers guide        | https://deck.gl/docs/developer-guide/using-layers                         |
| deck.gl Views and Projections     | https://deck.gl/docs/developer-guide/views                                |
| deck.gl OrthographicView          | https://deck.gl/docs/api-reference/core/orthographic-view                 |
| deck.gl Performance (binary data) | https://deck.gl/docs/developer-guide/performance                          |
| Three.js Object3D                 | https://threejs.org/docs/#api/en/core/Object3D                            |
| Three.js Layers bitmask           | https://threejs.org/docs/#api/en/core/Layers                              |

---

## 13. Sources

| Topic                    | URL                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------- |
| CSS Stacking Context     | https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context |
| WebGL Best Practices     | https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices         |
| OffscreenCanvas API      | https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas                        |
| CSS will-change          | https://developer.mozilla.org/en-US/docs/Web/CSS/will-change                            |
| CSS isolation            | https://developer.mozilla.org/en-US/docs/Web/CSS/isolation                              |
| Mapbox GL v3 Migration   | https://docs.mapbox.com/mapbox-gl-js/guides/migrate-to-v3/                              |
| Three.js InstancedMesh   | https://threejs.org/docs/#api/en/objects/InstancedMesh                                  |
| Three.js Sprite          | https://threejs.org/docs/#api/en/objects/Sprite                                         |
| deck.gl Composite Layers | https://deck.gl/docs/developer-guide/custom-layers/composite-layers                     |
| deck.gl Layer Extensions | https://deck.gl/docs/developer-guide/custom-layers/layer-extensions                     |
