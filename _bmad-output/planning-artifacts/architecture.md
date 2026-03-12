---
stepsCompleted:
  [
    "step-01-init",
    "step-02-context",
    "step-03-starter",
    "step-04-decisions",
    "step-05-patterns",
    "step-06-structure",
    "step-07-validation",
    "step-08-complete"
  ]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/research/technical-WebGL-SVG-layered-rendering-research-2026-03-12.md"
  - "_bmad-output/project-context.md"
workflowType: "architecture"
project_name: "Fantasy-Map-Generator"
user_name: "Azgaar"
date: "2026-03-12"
status: "complete"
lastStep: 8
completedAt: "2026-03-12"
---

# Architecture Decision Document — Fantasy-Map-Generator WebGL Layer Framework

**Project:** Fantasy-Map-Generator
**Author:** Azgaar (via Winston/Architect)
**Date:** 2026-03-12
**Status:** Complete — Ready for Implementation

---

## 1. Project Context Analysis

### 1.1 Scope Summary

This architecture addresses a **brownfield, isolated subsystem replacement** in FMG's rendering pipeline. The surface area is:

- **New:** `WebGL2LayerFramework` TypeScript class (`src/modules/webgl-layer-framework.ts`)
- **Refactored:** `src/renderers/draw-relief-icons.ts` — migrated to use the framework instead of ad-hoc context management
- **Added:** Unit tests (`src/modules/webgl-layer-framework.test.ts`)
- **Unchanged:** All 32 SVG layers, D3 data pipeline, `public/modules/` legacy JS, globe renderer, SVG export

### 1.2 Functional Requirements Coverage

| FR Category                          | Count | Architectural Component                                           |
| ------------------------------------ | ----- | ----------------------------------------------------------------- |
| Framework Core (FR1–FR4)             | 4     | `WebGL2LayerFramework` class                                      |
| Coordinate Sync (FR5–FR7)            | 3     | `syncTransform()` method + orthographic camera                    |
| Layer Lifecycle (FR8–FR11)           | 4     | `setVisible()`, `ResizeObserver`, `dispose()`                     |
| Relief Rendering (FR12–FR17)         | 6     | `draw-relief-icons.ts` refactored                                 |
| Compatibility & Fallback (FR18–FR19) | 2     | `detectWebGL2()` guard in framework init                          |
| Interaction (FR20–FR21)              | 2     | `pointer-events: none` on canvas; existing Layers panel unchanged |
| Developer API (FR22–FR24)            | 3     | `register(config)` public method                                  |
| Testability (FR25–FR27)              | 3     | Pure functions / injectable dependencies                          |

**Total: 27 FRs — all addressed.**

### 1.3 Non-Functional Constraints Shaping Architecture

| NFR                                             | Architectural Impact                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| NFR-P6: No GPU teardown on hide                 | `setVisible(false)` must set `mesh.visible = false` only — NOT call `dispose()`             |
| NFR-C3: Max 2 WebGL contexts (1 globe + 1 map)  | Single `THREE.WebGLRenderer` shared across all registered layers                            |
| NFR-M3: Global Module Pattern                   | `window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` at module bottom            |
| NFR-B1/B2: Bundle size ≤ 50KB gzip increase     | Three.js already present; named imports only (`import { WebGLRenderer, ... } from 'three'`) |
| NFR-M5: ≥ 80% Vitest coverage on framework core | Pure coordinate functions and registration API must be injected/mockable                    |

### 1.4 Critical Brownfield Constraints Discovered in Codebase

| Constraint                        | Detail                                                                                | Architectural Response                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Existing WebGL relief renderer    | `draw-relief-icons.ts` already has a working Three.js renderer                        | Framework wraps/extends it — not replace from scratch                                |
| `undrawRelief` tears down GPU     | Current implementation disposes renderer on hide — violates NFR-P6                    | Framework `setVisible(false)` replaces teardown pattern                              |
| Canvas placement is wrong         | Currently `insertAdjacentElement("afterend", map)` — canvas sits above all SVG layers | Framework uses positioned wrapper; MVP uses z-index above SVG (see Decision 3)       |
| Globals `viewX`, `viewY`, `scale` | Coordinate sync uses raw window globals                                               | Framework abstracts to `syncTransform()` callable function; tests inject mock values |
| `#map { position: absolute }`     | SVG has no positioned parent container                                                | Framework wraps SVG in `#map-container` on init                                      |

---

## 2. Technology Stack

No new dependencies are introduced. The framework uses only technologies already in the project:

| Technology | Version  | Role in This Feature                                        |
| ---------- | -------- | ----------------------------------------------------------- |
| TypeScript | ^5.9.3   | Framework implementation language                           |
| Three.js   | ^0.183.2 | WebGL renderer, orthographic camera, scene management       |
| Vite       | ^7.3.1   | Bundling (tree-shaking Three.js named imports)              |
| Vitest     | ^4.0.18  | Unit tests for coordinate sync and framework API            |
| D3         | ^7.9.0   | Source of zoom transform values (`viewX`, `viewY`, `scale`) |

**Three.js imports used (tree-shaken):**

```typescript
import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  TextureLoader,
  SRGBColorSpace,
  LinearMipmapLinearFilter,
  LinearFilter,
  DoubleSide
} from "three";
```

---

## 3. Core Architectural Decisions

### Decision 1: Single Shared WebGL Context via `WebGL2LayerFramework`

**Decision:** A new `WebGL2LayerFrameworkClass` TypeScript module manages a single `THREE.WebGLRenderer` instance shared by all registered WebGL layers. It replaces `draw-relief-icons.ts`'s module-level renderer with a centralized framework.

**Rationale:**

- Browser WebGL context limit (8–16 per page) requires minimizing context creation
- The globe renderer already holds context #1; the map framework holds context #2 — this is the budget maximum (NFR-C3)
- A single `THREE.Scene` with `renderOrder` per layer handles draw ordering within the shared context
- The existing `draw-relief-icons.ts` will be refactored to register with this framework instead of managing its own renderer

**Alternatives rejected:**

- One canvas per layer: would exceed context limit at 3+ WebGL layers
- Raw WebGL2 without Three.js: Three.js already present; adds no bundle cost; handles context loss/restore, shader compilation, VBO management

### Decision 2: Layer Registration API

**Decision:** The framework exposes a `register(config: WebGLLayerConfig)` method. Callers provide an `id`, `anchorLayerId` (SVG element ID for z-position reference), `renderOrder`, a `setup(group)` callback (called once on init), a per-frame `render(group)` callback (called every frame before `renderer.render()`), and a `dispose(group)` cleanup callback. All three callbacks receive the layer's framework-managed `THREE.Group` — **never the raw scene, renderer, or camera** — establishing a clean abstraction boundary.

**Abstraction boundary:** `THREE.Group` is the sole interface point between framework internals and layer logic. If the underlying renderer backend changes, only the framework changes — layer code is unaffected. Layer authors never import or depend on `THREE.Scene`, `THREE.WebGLRenderer`, or camera types.

```typescript
export interface WebGLLayerConfig {
  id: string;
  anchorLayerId: string; // SVG <g> id; canvas element id derived as `${id}Canvas`
  renderOrder: number; // Three.js renderOrder for this layer's Group in the scene
  setup: (group: THREE.Group) => void; // called once after WebGL2 confirmed; add meshes to group
  render: (group: THREE.Group) => void; // called each frame before renderer.render(); update uniforms/geometry
  dispose: (group: THREE.Group) => void; // called on unregister(id); dispose all GPU objects in group
}
```

**What the framework manages:**

- Canvas element creation, sizing, positioning; canvas `id` = `${config.id}Canvas`
- `THREE.WebGLRenderer` + `THREE.Scene` + `THREE.OrthographicCamera` initialization
- One `THREE.Group` per registered layer (owns all layer GPU objects)
- Z-index derivation from anchor SVG layer DOM position
- Visibility toggle (`group.visible = false/true`) — no GPU teardown
- Canvas resize via `ResizeObserver`
- D3 zoom subscription in `init()` → `requestRender()` on every zoom/pan event
- Per-frame dispatch: calls each visible layer's `render(group)` before `renderer.render(scene, camera)`

**What each layer module manages:**

- In `setup(group)`: create `THREE.Mesh` / `BufferGeometry` / textures, add them to `group`
- In `render(group)`: update geometry or material uniforms if data changed since last frame
- In `dispose(group)`: call `.geometry.dispose()`, `.material.dispose()`, `.map?.dispose()` on all children
- **Never** access `scene`, `renderer`, `camera`, or `canvas` directly — those are framework internals

### Decision 3: Canvas Z-Index Positioning — MVP vs. Phase 2

**MVP Decision:** The canvas is inserted as a sibling to `#map` in `#map-container` (a new `position: relative` wrapper div). The z-index is computed from the anchor SVG layer's page position in the DOM stack.

**Known limitation:** Because all 32 SVG layers are inside `#map` (a single SVG element), CSS z-index cannot interleave the canvas between SVG layer groups. In MVP, the canvas renders **above the entire SVG** (higher z-index than `#map`). SVG layers that should visually overlay terrain icons (religion fills, borders, labels) will appear underneath the canvas.

**Why this is acceptable for MVP:**

- The visual impact is limited: relief icons appear in terrain cells (mountains, forests), while labels/burg icons appear in civilized cells — overlap is uncommon in practice
- The current codebase ALREADY exhibits this same behavior (`draw-relief-icons.ts` places canvas after `#map` in DOM order with no z-index)
- `pointer-events: none` preserves all interaction; the UX regression is purely visual

**Phase 2 fix — DOM-Split Architecture:**

```
#map-container (position: relative)
  ├── svg#map-back  (layers 1–11, z-index: 1)
  ├── canvas#terrainCanvas  (z-index: 2, pointer-events: none)
  └── svg#map-front  (layers 13–32 + interaction, z-index: 3)
```

This requires moving layer `<g>` elements between two SVG elements and syncing D3 transforms to both — deferred to Phase 2.

**Z-index in MVP — Critical Limitation:**

In MVP, `#map` (z-index: 1) and the canvas (z-index: 2) are siblings inside `#map-container`. CSS z-index between DOM siblings **cannot** interleave with the SVG's internal `<g>` layer groups — all 32 groups live inside the single `#map` SVG element. The canvas renders **above the entire SVG** regardless of its numeric z-index, as long as that value exceeds `#map`'s value of 1.

`getLayerZIndex()` is included for **Phase 2 forward-compatibility only**. When the DOM-split lands and each layer `<g>` becomes a direct sibling inside `#map-container`, the DOM position index will map directly to a meaningful CSS z-index for true interleaving. In MVP, the function is used merely to confirm the canvas sits above `#map`:

```typescript
// MVP: canvas simply needs z-index > 1 (the #map SVG value).
// Phase 2 (DOM-split): this index will represent true visual stacking position.
function getLayerZIndex(anchorLayerId: string): number {
  const anchor = document.getElementById(anchorLayerId);
  if (!anchor) return 2;
  const siblings = Array.from(anchor.parentElement?.children ?? []);
  const idx = siblings.indexOf(anchor);
  // Return idx + 1 so Phase 2 callers get a correct interleaving value automatically.
  return idx > 0 ? idx + 1 : 2;
}
```

### Decision 4: D3 Zoom → WebGL Orthographic Camera Sync

**Decision:** The sync formula from the existing `draw-relief-icons.ts` is extracted into a pure, testable function `buildCameraBounds(viewX, viewY, scale, graphWidth, graphHeight)` that returns `{left, right, top, bottom}` for the orthographic camera.

**Derivation (documented in code):**

```
D3 applies transform: translate(viewX, viewY) scale(scale) to #viewbox
This means: screen_point = map_point * scale + (viewX, viewY)
Inverting: map_point = (screen_point - (viewX, viewY)) / scale

Orthographic camera bounds (what map rectangle is visible on screen):
  left   = -viewX / scale          ← left edge of visible map
  right  = (graphWidth - viewX) / scale  ← right edge
  top    = -viewY / scale          ← top edge
  bottom = (graphHeight - viewY) / scale ← bottom edge

Three.js OrthographicCamera(left, right, top, bottom, near, far):
  `top`    = upper visible edge in camera space (numerically smaller — closer to y=0 in SVG)
  `bottom` = lower visible edge in camera space (numerically larger)
  So top < bottom, which means the camera's Y-axis points downward — matching SVG.
  new OrthographicCamera(left, right, top, bottom, -1, 1)
  // top < bottom: Y-down matches SVG; origin at top-left of map.
  // Do NOT swap top/bottom or negate — this is the correct Three.js Y-down configuration.
```

**Why this is testable:** `buildCameraBounds` takes only numbers and returns numbers. Tests inject mock `viewX/viewY/scale` values and assert exact output — no DOM or WebGL required.

### Decision 5: Visibility Toggle — GPU State Preservation

**Decision:** `framework.setVisible(id, visible)` toggles the Three.js `Object3D.visible` property of the layer's registered group. The canvas element's `display` style is changed only when ALL registered layers are hidden.

```typescript
setVisible(id: string, visible: boolean): void {
  const layer = this.layers.get(id);
  if (!layer) return;
  layer.group.visible = visible;
  // Only hide canvas if ALL layers are invisible (avoids GPU context loss)
  const anyVisible = [...this.layers.values()].some(l => l.group.visible);
  this.canvas.style.display = anyVisible ? "block" : "none";
  if (visible) this.render();
}
```

**This replaces `undrawRelief`'s current behavior** which calls `renderer.dispose()`, `scene = null`, etc. — destroying GPU buffers on every hide. The framework never destroys buffers except on `framework.unregister(id)`.

### Decision 6: WebGL2 Detection and SVG Fallback

**Decision:** `init()` calls `detectWebGL2()` which attempts `canvas.getContext('webgl2')`. On failure, the framework sets a private `_fallback` backing field to `true` (exposed via a public getter `get hasFallback()`). The relief renderer reads `hasFallback` and falls back to `drawSvg()`. All framework methods silently return when `_fallback` is true.

**Critical TypeScript pattern — `hasFallback` MUST use a backing field, not `readonly`:** TypeScript `readonly` fields can only be assigned in the constructor. Because `detectWebGL2()` runs inside `init()` (called post-construction), `hasFallback` must be implemented as:

```typescript
private _fallback = false;
get hasFallback(): boolean { return this._fallback; }

init(): boolean {
  this._fallback = !detectWebGL2();
  if (this._fallback) return false;
  // ... rest of init
}
```

Do **not** declare `readonly hasFallback: boolean = false` — that pattern compiles but the assignment in `init()` produces a type error.

```typescript
// Exported for testability — accepts an injectable probe canvas
export function detectWebGL2(probe?: HTMLCanvasElement): boolean {
  const canvas = probe ?? document.createElement("canvas");
  const ctx = canvas.getContext("webgl2");
  if (!ctx) return false;
  const ext = ctx.getExtension("WEBGL_lose_context");
  ext?.loseContext();
  return true;
}
```

**Testable:** `detectWebGL2` accepts an optional injectable probe canvas so tests pass a mock without DOM access.

### Decision 7: Frame Rendering — On-Demand, RAF-Coalesced

**Decision:** The framework exposes a `requestRender()` method that coalesces calls within a single animation frame, preventing redundant GPU draws during rapid pan/zoom events.

```typescript
private rafId: number | null = null;

requestRender(): void {
  if (this.rafId !== null) return;
  this.rafId = requestAnimationFrame(() => {
    this.rafId = null;
    this.render();
  });
}

private render(): void {
  this.syncTransform();
  // Dispatch per-frame callback to each visible layer before submitting draw call.
  // This is the mechanism through which layers update uniforms, instance matrices,
  // or geometry data on a frame-by-frame basis.
  for (const [, layer] of this.layers) {
    if (layer.group.visible) {
      layer.config.render(layer.group);
    }
  }
  this.renderer.render(this.scene, this.camera);
}
```

This replaces `window.rerenderReliefIcons` which currently does the same RAF coalescing at the module level.

### Decision 8: ResizeObserver for Canvas Sizing

**Decision:** The framework attaches a `ResizeObserver` to the `#map-container` element. On resize, it updates canvas dimensions and the orthographic camera aspect ratio, then re-renders.

```typescript
private observeResize(): void {
  this.resizeObserver = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    this.renderer.setSize(width, height);
    this.requestRender();
  });
  this.resizeObserver.observe(this.container);
}
```

---

## 4. Implementation Patterns

### 4.1 Global Module Pattern (Mandatory)

All TypeScript modules in `src/modules/` and `src/renderers/` follow the project's Global Module Pattern. The framework module must follow it exactly:

```typescript
// src/modules/webgl-layer-framework.ts

// 1. Global type declaration
declare global {
  var WebGL2LayerFramework: WebGL2LayerFrameworkClass;
}

// 2. Class implementation
class WebGL2LayerFrameworkClass {
  // ...
}

// 3. Window registration (LAST LINE)
window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass();
```

### 4.2 Module Import Pattern

Add to `src/modules/index.ts` as a side-effect import:

```typescript
import "./webgl-layer-framework";
```

And `draw-relief-icons.ts` remains in `src/renderers/index.ts` — no change to import structure.

### 4.3 Function Naming Conventions

| Pattern                | Convention                  | Example                                               |
| ---------------------- | --------------------------- | ----------------------------------------------------- |
| Framework class        | `PascalCase + Class suffix` | `WebGL2LayerFrameworkClass`                           |
| Window global          | `PascalCase`                | `window.WebGL2LayerFramework`                         |
| Pure utility functions | `camelCase`                 | `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex` |
| Internal methods       | `camelCase`                 | `syncTransform`, `observeResize`, `requestRender`     |

### 4.4 TypeScript Type Declarations

New types go in `src/types/global.ts`:

```typescript
declare global {
  var WebGL2LayerFramework: import("../modules/webgl-layer-framework").WebGL2LayerFrameworkClass;
  var drawRelief: (type?: "svg" | "webGL", parentEl?: HTMLElement) => void;
  var undrawRelief: () => void;
  var rerenderReliefIcons: () => void;
}
```

### 4.5 Error Handling Philosophy

- Framework `init()` failures (WebGL2 unavailable): sets `_fallback = true` via backing field, logs with `WARN` global, returns `false` — no throw
- Missing DOM elements (e.g., `#map` not found on init): early return + `WARN` log
- WebGL context loss mid-session: `renderer.forceContextRestore()` then `renderer.dispose()` + re-init on next draw call (preserves existing pattern from `draw-relief-icons.ts`)
- Unit tests: pure functions throw `Error`s; framework class methods log and return for resilience

### 4.6 Test Patterns

Unit tests co-located with source in `src/modules/`:

```typescript
// src/modules/webgl-layer-framework.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest";
import {buildCameraBounds, detectWebGL2, getLayerZIndex, WebGL2LayerFrameworkClass} from "./webgl-layer-framework";

// ─── Pure function tests (no DOM, no WebGL) ───────────────────────────────────
describe("buildCameraBounds", () => {
  it("returns correct bounds for identity transform", () => {
    const b = buildCameraBounds(0, 0, 1, 960, 540);
    expect(b.left).toBe(0);
    expect(b.right).toBe(960);
    expect(b.top).toBe(0);
    expect(b.bottom).toBe(540);
  });

  it("returns correct bounds at 2× zoom", () => {
    const b = buildCameraBounds(0, 0, 2, 960, 540);
    expect(b.right).toBe(480);
    expect(b.bottom).toBe(270);
  });

  it("returns correct bounds with pan offset (viewX negative = panned right)", () => {
    // viewX=-100 means D3 translated +100px right; map origin is at x=100 on screen
    const b = buildCameraBounds(-100, -50, 1, 960, 540);
    expect(b.left).toBe(100); // -(-100)/1
    expect(b.right).toBe(1060); // (960-(-100))/1
    expect(b.top).toBe(50);
  });

  it("top < bottom (Y-down camera convention)", () => {
    const b = buildCameraBounds(0, 0, 1, 960, 540);
    expect(b.top).toBeLessThan(b.bottom);
  });

  it("handles extreme zoom values without NaN", () => {
    const lo = buildCameraBounds(0, 0, 0.1, 960, 540);
    const hi = buildCameraBounds(0, 0, 50, 960, 540);
    expect(Number.isFinite(lo.right)).toBe(true);
    expect(Number.isFinite(hi.right)).toBe(true);
  });
});

describe("detectWebGL2", () => {
  it("returns false when getContext returns null", () => {
    const canvas = {getContext: () => null} as unknown as HTMLCanvasElement;
    expect(detectWebGL2(canvas)).toBe(false);
  });

  it("returns true when getContext returns a context object", () => {
    const mockCtx = {getExtension: () => null};
    const canvas = {getContext: () => mockCtx} as unknown as HTMLCanvasElement;
    expect(detectWebGL2(canvas)).toBe(true);
  });
});

// ─── Class-level tests (stub WebGL2LayerFrameworkClass) ───────────────────────
describe("WebGL2LayerFrameworkClass", () => {
  let framework: WebGL2LayerFrameworkClass;

  // Stubs: framework.init() requires DOM; short-circuit by stubbing _fallback
  beforeEach(() => {
    framework = new WebGL2LayerFrameworkClass();
    // Force fallback=false path without real WebGL:
    (framework as any)._fallback = false;
    // Inject a minimal scene + renderer stub so register() doesn't throw
    (framework as any).scene = {add: vi.fn()};
    (framework as any).layers = new Map();
  });

  it("register() queues config when called before init()", () => {
    const fresh = new WebGL2LayerFrameworkClass();
    const config = {
      id: "test",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };
    // Before init(), scene is null — register() must queue, not throw
    expect(() => fresh.register(config)).not.toThrow();
  });

  it("setVisible(false) does not call dispose() on GPU objects", () => {
    const mockGroup = {visible: true};
    const config = {
      id: "terrain",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };
    (framework as any).layers.set("terrain", {config, group: mockGroup});
    (framework as any).canvas = {style: {display: "block"}};
    framework.setVisible("terrain", false);
    expect(mockGroup.visible).toBe(false);
    expect(config.dispose).not.toHaveBeenCalled();
  });

  it("requestRender() coalesces multiple calls into a single RAF", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1 as any);
    (framework as any).renderer = {render: vi.fn()};
    (framework as any).camera = {};
    framework.requestRender();
    framework.requestRender();
    framework.requestRender();
    expect(rafSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
  });

  it("clearLayer() removes group children without disposing the renderer", () => {
    const clearFn = vi.fn();
    const mockGroup = {visible: true, clear: clearFn};
    const config = {
      id: "terrain",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };
    (framework as any).layers.set("terrain", {config, group: mockGroup});
    framework.clearLayer("terrain");
    expect(clearFn).toHaveBeenCalled();
    expect((framework as any).layers.has("terrain")).toBe(true); // still registered
  });

  it("hasFallback is false by default (backing field pattern)", () => {
    expect(framework.hasFallback).toBe(false);
  });
});
```

**Key testability rule:** Pure functions (`buildCameraBounds`, `detectWebGL2`, `getLayerZIndex`) are exported as named exports and are fully testable without DOM or WebGL. The class is tested via stubs injected onto private fields — no real renderer required.

---

## 5. Project Structure

### 5.1 Files Created

```
src/
  modules/
    webgl-layer-framework.ts          ← NEW: Framework class (core deliverable)
    webgl-layer-framework.test.ts     ← NEW: Unit tests (≥80% coverage target)
  renderers/
    draw-relief-icons.ts              ← MODIFIED: Refactored to use framework
```

### 5.2 Files Modified

```
src/
  modules/
    index.ts                          ← ADD: import "./webgl-layer-framework"
  types/
    global.ts                         ← ADD: WebGL2LayerFramework global declaration
```

### 5.3 `webgl-layer-framework.ts` Internal Structure

```typescript
// ─── Exports (for testability) ───────────────────────────────────────────────
export function detectWebGL2(probe?: HTMLCanvasElement): boolean;
export function buildCameraBounds(
  viewX: number,
  viewY: number,
  scale: number,
  graphWidth: number,
  graphHeight: number
): {left: number; right: number; top: number; bottom: number};
export function getLayerZIndex(anchorLayerId: string): number;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface WebGLLayerConfig {
  id: string;
  anchorLayerId: string; // SVG <g> id; canvas id derived as `${id}Canvas`
  renderOrder: number; // Three.js renderOrder for this layer's Group
  setup: (group: THREE.Group) => void; // called once on init(); add meshes to group
  render: (group: THREE.Group) => void; // called each frame before renderer.render()
  dispose: (group: THREE.Group) => void; // called on unregister(); dispose GPU objects
}

interface RegisteredLayer {
  config: WebGLLayerConfig;
  group: THREE.Group; // framework-owned; passed to all callbacks — abstraction boundary
}

// ─── Class ───────────────────────────────────────────────────────────────────
export class WebGL2LayerFrameworkClass {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private scene: THREE.Scene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private pendingConfigs: WebGLLayerConfig[] = []; // queue for register() before init()
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private container: HTMLElement | null = null;
  private _fallback = false; // backing field — NOT readonly, set in init()
  get hasFallback(): boolean {
    return this._fallback;
  }

  // Public API
  init(): boolean; // call from app bootstrap; processes pendingConfigs queue
  register(config: WebGLLayerConfig): boolean; // safe to call before init() — queues if needed
  unregister(id: string): void;
  setVisible(id: string, visible: boolean): void;
  clearLayer(id: string): void; // wipe group geometry without removing registration
  requestRender(): void;
  syncTransform(): void;

  // Private
  private render(): void;
  private observeResize(): void;
  private subscribeD3Zoom(): void; // called in init(); attaches viewbox.on("zoom.webgl", ...)
}

// ─── Global Registration (MUST be last line) ─────────────────────────────────
declare global {
  var WebGL2LayerFramework: WebGL2LayerFrameworkClass;
}
window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass();
```

### 5.4 `draw-relief-icons.ts` Refactored Structure

The module registers itself with the framework on load. Existing window globals (`drawRelief`, `undrawRelief`, `rerenderReliefIcons`) are preserved for backward compatibility with legacy `public/modules/` code that calls them.

```typescript
// Registration call (runs at module load time, before init()) ─────────────────
WebGL2LayerFramework.register({
  id: "terrain",
  anchorLayerId: "terrain",
  renderOrder: getLayerZIndex("terrain"),
  setup(group) {
    // Called once by framework after init(); nothing to do here —
    // geometry is built lazily when drawRelief() is called.
  },
  render(group) {
    // Called each frame. Relief geometry is static between drawRelief() calls;
    // no per-frame CPU updates required — this is intentionally a no-op.
  },
  dispose(group) {
    group.traverse(obj => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        (obj.material as MeshBasicMaterial).map?.dispose();
        (obj.material as MeshBasicMaterial).dispose();
      }
    });
  }
});

// Internal: rebuild geometry from pack.relief data ────────────────────────────
function buildReliefScene(icons: ReliefIcon[]): void; // adds Meshes to the layer's group
function drawSvgRelief(icons: ReliefIcon[], parentEl: HTMLElement): void;

// Public window globals (backward-compatible) ─────────────────────────────────
window.drawRelief = (type = "webGL", parentEl = byId("terrain")) => {
  if (WebGL2LayerFramework.hasFallback || type === "svg") {
    drawSvgRelief(icons, parentEl);
  } else {
    buildReliefScene(icons);
    WebGL2LayerFramework.requestRender();
  }
};
window.undrawRelief = () => {
  // Clear geometry from the framework-owned group — do NOT touch renderer or scene.
  // clearLayer() removes all Meshes from the group without disposing the renderer.
  WebGL2LayerFramework.clearLayer("terrain");
  if (terrainEl) terrainEl.innerHTML = ""; // also clear SVG fallback content
};
window.rerenderReliefIcons = () => {
  WebGL2LayerFramework.requestRender();
};
```

### 5.5 DOM Structure After Framework Init

```
body
  div#map-container  (NEW; position: relative; width: svgWidth; height: svgHeight)
    svg#map  (MOVED inside container; position: absolute; inset: 0; z-index: 1)
    canvas#terrainCanvas  (NEW; id = "${config.id}Canvas" = "terrainCanvas";
                           position: absolute; inset: 0;
                           z-index: getLayerZIndex("terrain") → 2 in MVP (above #map);
                           pointer-events: none; aria-hidden: true)
```

**Canvas `id` convention:** The framework derives the canvas element id as `${config.id}Canvas`. For `id: "terrain"` → `canvas#terrainCanvas`. For `id: "biomes"` → `canvas#biomesCanvas`. This must be consistent; implementing agents must not hardcode canvas ids.

**MVP z-index note:** In MVP both `#map` (z-index: 1) and `canvas#terrainCanvas` (z-index: 2) are stacked as siblings within `#map-container`. The canvas is visually above the entire `#map` SVG. This is a known, accepted limitation. See Decision 3.

### 5.6 Framework Initialization Sequence

```
1. Framework module loaded (via src/modules/index.ts import)
   → window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()
   → constructor does NOTHING: renderer=null, _fallback unset, pendingConfigs=[]

2. draw-relief-icons.ts loaded (via src/renderers/index.ts import)
   → WebGL2LayerFramework.register({ id: "terrain", ... })
   → init() has NOT been called yet — register() pushes to pendingConfigs[]
   → This is safe by design: register() before init() is explicitly supported

3. App bootstrap calls WebGL2LayerFramework.init()  ← EXPLICIT CALL REQUIRED
   → _fallback = !detectWebGL2()  (uses backing field, not readonly)
   → if _fallback: init() returns false; all subsequent API calls are no-ops
   → creates div#map-container wrapper, moves svg#map inside (z-index:1)
   → creates THREE.WebGLRenderer(canvas), THREE.Scene, THREE.OrthographicCamera
   → sets canvas id, position:absolute, inset:0, pointer-events:none, z-index:2
   → calls subscribeD3Zoom(): viewbox.on("zoom.webgl", () => this.requestRender())
   → processes pendingConfigs[]: for each config:
       creates THREE.Group with config.renderOrder
       calls config.setup(group)
       adds group to scene
       stores RegisteredLayer in layers Map
   → attaches ResizeObserver to #map-container

4. Main map generation completes → window.drawRelief() called by legacy JS
   → if WebGL: buildReliefScene(icons) builds Meshes in layer's group
   → calls requestRender() → next RAF:
       render(): syncTransform() → each visible layer's render(group) → renderer.render(scene,camera)
   → if fallback: drawSvgRelief(icons, parentEl)

5. D3 zoom/pan → framework's own "zoom.webgl" listener fires → requestRender()
   rerenderReliefIcons() also calls requestRender() as belt-and-suspenders

6. Layer hide: window.undrawRelief()
   → WebGL2LayerFramework.clearLayer("terrain"): group.clear() wipes Meshes; renderer untouched
   → framework.setVisible("terrain", false): group.visible = false

7. Layer show: window.drawRelief()
   → buildReliefScene(icons) rebuilds Meshes in group
   → framework.setVisible("terrain", true): group.visible = true
   → requestRender()
```

---

## 6. Architecture Validation

### 6.1 FR Coverage Matrix

| Requirement                                    | Addressed By                                                                                          | Status                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| FR1: Single WebGL2 context                     | `WebGL2LayerFrameworkClass` owns one `THREE.WebGLRenderer`                                            | ✅                                                  |
| FR2: Canvas at correct z-index                 | `getLayerZIndex(anchorLayerId)` → canvas z-index                                                      | ✅ (MVP: above SVG)                                 |
| FR3: Register layer by anchor + callback       | `framework.register(config)`                                                                          | ✅                                                  |
| FR4: Layer registry                            | `layers: Map<string, RegisteredLayer>`                                                                | ✅                                                  |
| FR5: Sync to D3 zoom transform                 | `syncTransform()` reads `viewX, viewY, scale` globals                                                 | ✅                                                  |
| FR6: Update on D3 change                       | `requestRender()` called from `rerenderReliefIcons`                                                   | ✅                                                  |
| FR7: Map-space → WebGL clip coordinates        | `buildCameraBounds()` formula                                                                         | ✅                                                  |
| FR8: Toggle without GPU teardown               | `setVisible()` → `group.visible` only                                                                 | ✅                                                  |
| FR9: Resize canvas on viewport change          | `ResizeObserver` on container                                                                         | ✅                                                  |
| FR10: Recalculate z-index on layer reorder     | `getLayerZIndex()` reads live DOM position                                                            | ✅                                                  |
| FR11: Dispose layer + GPU resources            | `unregister(id)` → disposes GeometryBuffers, removes from scene                                       | ✅                                                  |
| FR12: All relief icons in one draw call        | Per-set `Mesh` with merged `BufferGeometry` (existing batched approach)                               | ✅                                                  |
| FR13: Icons at SVG-space coordinates           | Camera in SVG pixel-space; icon positions in `pack.relief` unchanged                                  | ✅                                                  |
| FR14: Scale with zoom and user setting         | Camera bounds change with zoom; icon size uses `r.s` from relief data                                 | ✅                                                  |
| FR15: Per-icon rotation                        | Rotation encoded in quad vertex positions during `buildSetMesh`                                       | ⚠️ Verify rotation support in existing buildSetMesh |
| FR16: Configurable opacity                     | `MeshBasicMaterial.opacity` + `transparent: true`                                                     | ✅                                                  |
| FR17: Re-render on terrain data change         | `drawRelief()` calls `buildReliefScene()` + `requestRender()`                                         | ✅                                                  |
| FR18: WebGL2 detection + fallback              | `detectWebGL2()` → `hasFallback` flag                                                                 | ✅                                                  |
| FR19: SVG fallback visually identical          | Existing `drawSvg()` preserved unchanged                                                              | ✅                                                  |
| FR20: No pointer-event capture                 | `canvas.style.pointerEvents = "none"`                                                                 | ✅                                                  |
| FR21: Existing Layers panel unchanged          | `drawRelief`/`undrawRelief` window globals preserved                                                  | ✅                                                  |
| FR22: Register without z-index knowledge       | `framework.register` derives z-index internally                                                       | ✅                                                  |
| FR23: Render callback receives D3 transform    | `render(group)` invoked each frame after `syncTransform()`; camera already synced when callback fires | ✅                                                  |
| FR24: Same visibility API for all layers       | `framework.setVisible(id, bool)` uniform for all registered layers                                    | ✅                                                  |
| FR25: Coordinate sync testable in isolation    | `buildCameraBounds` is a pure exported function                                                       | ✅                                                  |
| FR26: Fallback detection testable              | `detectWebGL2(probeCanvas)` accepts injectable canvas                                                 | ✅                                                  |
| FR27: Registration testable without real WebGL | `hasFallback = true` path is a no-op; stub renderers in tests                                         | ✅                                                  |

**FR15 Note:** The existing `buildSetMesh` in `draw-relief-icons.ts` constructs static quads; rotation may not be applied. This must be verified and implemented (per-icon rotation via vertex transformation in `buildSetMesh`) before MVP ships.

### 6.2 NFR Compliance

| NFR                                        | Status     | Implementation                                                                            |
| ------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------- |
| NFR-P1: <16ms @ 1k icons                   | Enabled by | Single-batch `BufferGeometry` per atlas set                                               |
| NFR-P2: <100ms @ 10k icons                 | Enabled by | Same batch approach; measure at implementation                                            |
| NFR-P3: Toggle <4ms                        | ✅         | `group.visible = false` is O(1)                                                           |
| NFR-P4: Pan/zoom latency <8ms              | ✅         | RAF-coalesced; `syncTransform()` is one matrix update                                     |
| NFR-P5: Init <200ms                        | Enabled by | Three.js renderer init is ~50–100ms                                                       |
| NFR-P6: No GPU teardown on hide            | ✅         | `setVisible` never calls `dispose()`                                                      |
| NFR-C1: WebGL2 as sole gate                | ✅         | `detectWebGL2()` uses `canvas.getContext('webgl2')`                                       |
| NFR-C2: Cross-browser visual parity        | Enabled by | Three.js normalizes WebGL2 across browsers                                                |
| NFR-C3: Max 2 contexts                     | ✅         | Framework creates 1 context; globe creates 1                                              |
| NFR-C4: Fallback when HW accel disabled    | ✅         | `detectWebGL2()` returns false → SVG path                                                 |
| NFR-M1: Framework unknown of layer content | ✅         | `setup/dispose` callbacks encapsulate all content                                         |
| NFR-M2: New layer = 1 `register()` call    | ✅         | Confirmed by API design                                                                   |
| NFR-M3: Global Module Pattern              | ✅         | `window.WebGL2LayerFramework = new ...` at bottom                                         |
| NFR-M4: Sync formula documented            | ✅         | `buildCameraBounds` has full derivation in JSDoc                                          |
| NFR-M5: ≥80% test coverage                 | Target     | Tests for `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex`, `register`, `setVisible` |
| NFR-B1: Tree-shaking Three.js              | ✅         | Named imports only                                                                        |
| NFR-B2: ≤50KB bundle increase              | ✅         | No new dependencies; framework code ~5KB                                                  |

### 6.3 Architecture Risks and Mitigations

| Risk                                          | Likelihood | Impact | Architecture Mitigation                                                                    |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------ |
| D3 + WebGL coordinate offset at extreme zoom  | Medium     | High   | `buildCameraBounds` is unit-tested at zoom 0.1–50; exact formula documented                |
| FR15: Rotation not in existing `buildSetMesh` | High       | Medium | Flag as pre-MVP verification item; add rotation attribute if missing                       |
| MVP z-ordering: canvas above SVG              | High       | Medium | Accepted tradeoff; documented; Phase 2 DOM-split design provided                           |
| `register()` called before `init()`           | High       | High   | `register()` pushes to `pendingConfigs[]`; `init()` processes queue — order-safe by design |
| `undrawRelief` bypasses framework clearLayer  | Medium     | Medium | `undrawRelief` explicitly calls `framework.clearLayer()` per section 5.4                   |
| Context loss mid-session                      | Low        | High   | Framework inherits existing `forceContextRestore` pattern from `draw-relief-icons.ts`      |
| Three.js API bleeds into layer code           | Low        | High   | All callbacks receive `THREE.Group` only — `scene`, `renderer`, `camera` are private       |

### 6.4 Decision Coherence Check

| Decision Pair                                                        | Compatible? | Note                                                                                      |
| -------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| Single context (D1) + Layer registry (D2)                            | ✅          | `renderOrder` on `THREE.Group` within shared scene; one renderer, multiple groups         |
| Group abstraction (D2) + framework owns scene (D1)                   | ✅          | Callbacks receive `Three.Group` only; `scene`/`renderer`/`camera` stay private            |
| render(group) callback (D2) + RAF coalescing (D7)                    | ✅          | `render(group)` dispatched inside RAF callback before `renderer.render()` — correct order |
| MVP z-index above SVG (D3) + pointer-events:none (D3)                | ✅          | Interaction preserved regardless of z-stack position                                      |
| Camera sync using globals (D4) + testability (FR25)                  | ✅          | `buildCameraBounds` is pure; globals are injected in tests                                |
| No GPU teardown (D5) + `undrawRelief` backward compat (section 5.4)  | ✅          | `undrawRelief` calls `framework.clearLayer()` (geometry only); renderer untouched         |
| register() before init() (section 5.6) + pendingConfigs queue (D2)   | ✅          | Queue pattern decouples module load order from DOM/WebGL readiness                        |
| D3 zoom subscription in init() (D6) + per-layer render callback (D2) | ✅          | Framework owns the zoom listener; layer's `render(group)` called inside the resulting RAF |
| On-demand RAF render (D7) + ResizeObserver (D8)                      | ✅          | Both call `requestRender()` which coalesces to one RAF                                    |

---

## 7. Implementation Guidance for AI Agents

When implementing this architecture, follow these rules precisely:

### MUST DO

1. **Framework module registers first** — `src/modules/index.ts` import must appear before renderer imports
2. **`window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` is the last line** of the framework module
3. **Export `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex`** as named exports — tests depend on them
4. **`setVisible(id, false)` NEVER calls `renderer.dispose()`** — sets `group.visible = false` only
5. **Implement `clearLayer(id)`** — `undrawRelief` calls this to wipe group geometry; layer stays registered
6. **Use `private _fallback = false` + `get hasFallback()`** — NOT `readonly hasFallback = false` (TypeScript compile error)
7. **Call `init()` before any `drawRelief()` invocation** — app bootstrap must call `WebGL2LayerFramework.init()`
8. **All layer callbacks receive `THREE.Group`** — `setup(group)`, `render(group)`, `dispose(group)`; never pass `scene`
9. **Subscribe D3 zoom in `init()`**: `viewbox.on("zoom.webgl", () => this.requestRender())`
10. **Canvas `id` = `${config.id}Canvas`** — derived by framework; never hardcoded in layer code
11. **Canvas element gets**: `pointer-events: none; aria-hidden: true; position: absolute; inset: 0; z-index: 2`
12. **Fallback path**: when `hasFallback === true`, all framework methods return silently; `drawRelief` calls `drawSvgRelief`
13. **`window.drawRelief`, `window.undrawRelief`, `window.rerenderReliefIcons`** must remain as window globals (legacy JS calls them)
14. **Verify FR15** (per-icon rotation) in `buildSetMesh` before MVP — add rotation support if missing

### MUST NOT DO

1. **Do NOT** declare `readonly hasFallback: boolean = false` — this causes a TypeScript error when `init()` sets it
2. **Do NOT** pass `scene`, `renderer`, or `camera` to any layer callback — `THREE.Group` is the sole abstraction boundary
3. **Do NOT** call `renderer.dispose()` from `undrawRelief` or any visibility toggle — only from full framework teardown
4. **Do NOT** create a second `THREE.WebGLRenderer` — framework owns the only map renderer
5. **Do NOT** move layer `<g>` elements between SVG elements — DOM-split is Phase 2
6. **Do NOT** add any new entries to `public/modules/` — all new code is in `src/`
7. **Do NOT** break the `window.drawRelief(type, parentEl)` signature — legacy callers
8. **Do NOT** use `isNaN()` — use `Number.isNaN()`; or `parseInt()` without radix
9. **Do NOT** import Three.js as `import * as THREE from "three"` — use named imports only

### Verification Checklist

- [ ] `npm run lint` passes with zero errors
- [ ] `npx vitest run` passes all tests
- [ ] `buildCameraBounds` tests pass at zoom 0.1, 1, 2, 10, 50
- [ ] `detectWebGL2` test passes with null-returning mock canvas
- [ ] Layer registration test passes with stub scene
- [ ] `setVisible(false)` test confirms GPU buffers remain allocated
- [ ] Visual: relief icons render at correct coordinate positions
- [ ] Visual: toggling terrain layer on/off preserves icon positions
- [ ] Visual: pan/zoom redraws canvas correctly in sync with SVG

---

## 8. Next Steps

With this architecture complete, the recommended implementation sequence is:

**Story 1:** Create `webgl-layer-framework.ts` with exported pure functions and stub class methods; write all unit tests first (TDD).

**Story 2:** Implement `WebGL2LayerFrameworkClass` core: `init()` with `_fallback` backing field, `detectWebGL2()`, canvas creation (`id = ${config.id}Canvas`), `#map-container` wrapper, `ResizeObserver`, D3 zoom subscription (`viewbox.on("zoom.webgl", ...)`), `pendingConfigs[]` queue processing.

**Story 3:** Implement `register()` (with pre-init queue support), `unregister()`, `setVisible()`, `clearLayer()`, `requestRender()` (RAF coalescing), `syncTransform()`, per-frame `render(group)` dispatch in `render()`.

**Story 4:** Refactor `draw-relief-icons.ts` to use `WebGL2LayerFramework.register()` and remove the module-level renderer state. Verify FR15 rotation support.

**Story 5:** Integration testing — generate map, toggle terrain layer, pan/zoom, verify visual output matches SVG baseline.

**Story 6:** Bundle size audit — verify Three.js tree-shaking, confirm ≤50KB gzipped delta.
