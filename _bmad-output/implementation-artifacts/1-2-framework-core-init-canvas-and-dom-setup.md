# Story 1.2: Framework Core — Init, Canvas, and DOM Setup

**Status:** review
**Epic:** 1 — WebGL Layer Framework Module
**Story Key:** 1-2-framework-core-init-canvas-and-dom-setup
**Created:** (SM workflow)
**Developer:** Amelia (Dev Agent)

---

## Story

As a developer,
I want `init()` to set up the WebGL2 canvas, wrap `svg#map` in `div#map-container`, create the Three.js renderer/scene/camera, attach the ResizeObserver, and subscribe to D3 zoom events,
So that the framework owns the single shared WebGL context and the canvas is correctly positioned in the DOM alongside the SVG map.

---

## Context

### Prior Art (Story 1.1 — Complete)

Story 1.1 delivered the scaffold in `src/modules/webgl-layer-framework.ts`:

- Pure exports: `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex`
- Interfaces: `WebGLLayerConfig` (exported), `RegisteredLayer` (internal)
- Class: `WebGL2LayerFrameworkClass` with all 9 private fields (stubs)
- All Seven public API methods: `init()`, `register()`, `unregister()`, `setVisible()`, `clearLayer()`, `requestRender()`, `syncTransform()` — stubs only
- `_fallback` backing field + `get hasFallback()` getter
- `register()` currently pushes to `pendingConfigs[]`
- Global: `globalThis.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` (last line)
- 16 tests in `src/modules/webgl-layer-framework.test.ts` — all passing

### Files to Modify

- `src/modules/webgl-layer-framework.ts` — implement `init()`, `observeResize()`, `subscribeD3Zoom()`, `syncTransform()` (partial), change `import type` → value imports for WebGLRenderer/Scene/OrthographicCamera/Group
- `src/modules/webgl-layer-framework.test.ts` — add Story 1.2 tests for `init()` paths

---

## Acceptance Criteria

**AC1:** `init()` called + WebGL2 available
→ `div#map-container` wraps `svg#map` (position:relative, z-index:1 for svg), `canvas#terrainCanvas` is sibling to `#map` inside container (position:absolute; inset:0; pointer-events:none; aria-hidden:true; z-index:2)

**AC2:** `detectWebGL2()` returns false
→ `init()` returns `false`, `hasFallback === true`, all subsequent API calls are no-ops (guard on `_fallback`)

**AC3:** `hasFallback` uses backing field `_fallback` (NOT `readonly`) — already implemented in Story 1.1; verify pattern remains correct

**AC4:** After successful `init()`
→ exactly one `WebGLRenderer`, `Scene`, `OrthographicCamera` exist as instance fields (non-null)

**AC5:** `ResizeObserver` on `#map-container`
→ calls `renderer.setSize(width, height)` and `requestRender()` on resize events

**AC6:** D3 zoom subscription
→ `viewbox.on("zoom.webgl", () => this.requestRender())` called in `init()`; guarded with `typeof globalThis.viewbox !== "undefined"` for Node test env

**AC7:** Constructor has no side effects
→ all of canvas/renderer/scene/camera/container are null after construction; only `_fallback=false`, `layers=new Map()`, `pendingConfigs=[]` are initialized

**AC8:** `init()` completes in <200ms (NFR-P5) — no explicit test; implementation must avoid blocking operations

**AC9:** Global pattern unchanged — `globalThis.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` remains as last line

---

## Technical Notes

### `init()` Sequence (step-by-step)

1. `this._fallback = !detectWebGL2()` — use probe-less call; `document.createElement("canvas")` is fine at init time (only called when browser runs `init()`)
2. If `_fallback`: return `false` immediately (no DOM mutation)
3. Find `#map` via `document.getElementById("map")` — if not found, log WARN, return false
4. Create `div#map-container`: `style.position = "relative"; id = "map-container"` — insert before `#map` in parent, then move `#map` inside
5. Build `canvas#terrainCanvas`: set styles (position:absolute; inset:0; pointer-events:none; aria-hidden:true; z-index:2)
6. Size canvas: `canvas.width = container.clientWidth || 960; canvas.height = container.clientHeight || 540`
7. Create `new WebGLRenderer({ canvas, antialias: false, alpha: true })`
8. Create `new Scene()`
9. Create `new OrthographicCamera(0, canvas.width, 0, canvas.height, -1, 1)` — initial ortho bounds; will be updated on first `syncTransform()`
10. Store all in instance fields
11. Call `subscribeD3Zoom()`
12. Process `pendingConfigs[]` → for each, create `new Group()`, set `group.renderOrder = config.renderOrder`, call `config.setup(group)`, `scene.add(group)`, store in `layers` Map
13. Clear `pendingConfigs = []`
14. Call `observeResize()`
15. Return `true`

### Three.js Import Change

Converting from `import type` → value imports:

```typescript
import type {Group} from "three"; // Group stays type-only until Story 1.3 uses it at runtime
import {WebGLRenderer, Scene, OrthographicCamera} from "three";
// Note: Group is created in init() → must also be a value import in 1.2
```

→ Final: `import { Group, WebGLRenderer, Scene, OrthographicCamera } from "three";`
→ Remove `import type` line

### `subscribeD3Zoom()` Implementation

```typescript
private subscribeD3Zoom(): void {
  if (typeof (globalThis as any).viewbox === "undefined") return;
  (globalThis as any).viewbox.on("zoom.webgl", () => this.requestRender());
}
```

### `observeResize()` Implementation

```typescript
private observeResize(): void {
  if (!this.container || !this.renderer) return;
  this.resizeObserver = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    if (this.renderer && this.canvas) {
      this.renderer.setSize(width, height);
      this.requestRender();
    }
  });
  this.resizeObserver.observe(this.container);
}
```

### Fallback Guard Pattern

All public methods of the class must guard against `_fallback` (and against null init state). For Story 1.2, `register()` already works pre-init; `init()` has the primary guard. Story 1.3 lifecycle methods will add `_fallback` guards.

### `syncTransform()` (Partial — Story 1.2)

Story 1.3 implements the full `syncTransform()`. Story 1.2 may leave stub. Story 1.3 reads `globalThis.viewX`, `globalThis.viewY`, `globalThis.scale`, `globalThis.graphWidth`, `globalThis.graphHeight` and calls `buildCameraBounds()`.

### `requestRender()` — Story 1.2 transition

Current stub in Story 1.1 calls `this.render()` directly. Story 1.2 still leaves `requestRender()` as-is (direct render call) since `render()` private impl is Story 1.3. Just remove the direct `this.render()` call from `requestRender()` stub or leave it — tests will tell us.

Actually, `requestRender()` stub currently calls `this.render()` which is also a stub (no-op). This is fine for Story 1.2. Story 1.3 will replace `requestRender()` with RAF-coalescing.

---

## Tasks

- [ ] **T1:** Implement `init()` in `webgl-layer-framework.ts` following the sequence above
  - [ ] T1a: Change `import type { Group, ... }` to value imports `import { Group, WebGLRenderer, Scene, OrthographicCamera } from "three"`
  - [ ] T1b: `detectWebGL2()` fallback guard
  - [ ] T1c: DOM wrap (`#map` → `#map-container > #map + canvas#terrainCanvas`)
  - [ ] T1d: Renderer/Scene/Camera creation
  - [ ] T1e: `subscribeD3Zoom()` call
  - [ ] T1f: `pendingConfigs[]` queue processing
  - [ ] T1g: `observeResize()` call
- [ ] **T2:** Implement private `subscribeD3Zoom()` method
- [ ] **T3:** Implement private `observeResize()` method
- [ ] **T4:** Remove `biome-ignore` comments for fields now fully used (`canvas`, `renderer`, `camera`, `scene`, `container`, `resizeObserver`)
- [ ] **T5:** Add Story 1.2 tests for `init()` to `webgl-layer-framework.test.ts`:
  - [ ] T5a: `init()` with failing WebGL2 probe → hasFallback=true, returns false
  - [ ] T5b: `init()` with missing `#map` element → returns false, no DOM mutation
  - [ ] T5c: `init()` success: renderer/scene/camera all non-null after init
  - [ ] T5d: `init()` success: `pendingConfigs[]` processed (setup called, layers Map populated)
  - [ ] T5e: `observeResize()` ResizeObserver callback calls `renderer.setSize()`
- [ ] **T6:** `npm run lint` clean
- [ ] **T7:** `npx vitest run modules/webgl-layer-framework.test.ts` all pass
- [ ] **T8:** Set story status to `review`

---

## Dev Agent Record

_To be filled by Dev Agent_

### Implementation Notes

(pending)

### Files Modified

(pending)

### Test Results

(pending)
