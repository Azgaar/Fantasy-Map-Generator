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

**Decision:** The framework exposes a `register(config: WebGLLayerConfig)` method. Callers provide an `id`, `anchorLayerId` (SVG element ID for z-position reference), `renderOrder` (Three.js scene draw order), `setup(scene)` callback, and `dispose()` callback. The framework manages canvas lifecycle; layer-specific GPU resource creation happens in `setup`.

```typescript
interface WebGLLayerConfig {
  id: string;
  anchorLayerId: string; // e.g. "terrain" — SVG <g> whose DOM position sets z-index
  renderOrder: number; // Three.js renderOrder for objects in this layer
  setup: (scene: THREE.Scene) => void; // called once after WebGL2 context confirmed
  dispose: (scene: THREE.Scene) => void; // called on framework.unregister(id)
}
```

**What the framework manages:**

- Canvas element creation, sizing, positioning
- `THREE.WebGLRenderer` + `THREE.Scene` initialization
- Z-index derivation from anchor SVG layer DOM position
- Visibility toggle (`visible = false/true` on registered `THREE.Object3D` groups)
- Canvas resize via `ResizeObserver`
- D3 zoom/pan → orthographic camera sync

**What each layer module manages:**

- Creating `THREE.Mesh` / `BufferGeometry` / textures in `setup(scene)`
- Clearing and rebuilding geometry when data changes (called by `drawRelief` equivalent)
- Cleaning up GPU objects in `dispose(scene)`

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

**Z-index computation formula (MVP):**

```typescript
function getLayerZIndex(anchorLayerId: string): number {
  const anchor = document.getElementById(anchorLayerId);
  if (!anchor) return 100;
  // Use the element's index in its parent's children as the z-index base
  const siblings = Array.from(anchor.parentElement?.children ?? []);
  const idx = siblings.indexOf(anchor);
  return idx > 0 ? idx : 100;
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

Camera is configured with Y-down convention (top < bottom) to match SVG:
  new OrthographicCamera(left, right, top, bottom, -1, 1)
  where top < bottom (Y increases downward, SVG convention)
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

**Decision:** Framework initialization calls `detectWebGL2()` which attempts `canvas.getContext('webgl2')`. On failure, the framework sets a `hasFallback = true` flag and the relief renderer falls back to `drawSvg()`. All framework methods become no-ops when in fallback mode.

```typescript
function detectWebGL2(): boolean {
  const probe = document.createElement("canvas");
  const ctx = probe.getContext("webgl2");
  if (!ctx) return false;
  const ext = ctx.getExtension("WEBGL_lose_context");
  ext?.loseContext();
  return true;
}
```

**Testable:** The detection function is exported and can be called with a mock canvas in Vitest.

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

- Framework init failures (WebGL2 unavailable): set `hasFallback = true`, log with `WARN` global, no throw
- Missing DOM elements (e.g., `#map` not found on init): early return + `WARN` log
- WebGL context loss mid-session: `renderer.forceContextRestore()` then `renderer.dispose()` + re-init on next draw call (preserves existing pattern from `draw-relief-icons.ts`)
- Unit tests: pure functions throw `Error`s; framework class methods log and return for resilience

### 4.6 Test Patterns

Unit tests co-located with source in `src/modules/`:

```typescript
// src/modules/webgl-layer-framework.test.ts
import {describe, it, expect, vi} from "vitest";
import {buildCameraBounds, detectWebGL2, getLayerZIndex} from "./webgl-layer-framework";

describe("buildCameraBounds", () => {
  it("returns correct bounds for identity transform", () => {
    // viewX=0, viewY=0, scale=1, 960x540
    const b = buildCameraBounds(0, 0, 1, 960, 540);
    expect(b.left).toBe(0);
    expect(b.right).toBe(960);
    expect(b.top).toBe(0);
    expect(b.bottom).toBe(540);
  });

  it("returns correct bounds at 2× zoom centered on origin", () => {
    const b = buildCameraBounds(0, 0, 2, 960, 540);
    expect(b.left).toBe(0);
    expect(b.right).toBe(480);
    expect(b.top).toBe(0);
    expect(b.bottom).toBe(270);
  });

  it("returns correct bounds with pan offset", () => {
    const b = buildCameraBounds(-100, -50, 1, 960, 540);
    expect(b.left).toBe(100);
    expect(b.right).toBe(1060);
  });
});

describe("detectWebGL2", () => {
  it("returns false when getContext returns null", () => {
    const canvas = {getContext: () => null} as unknown as HTMLCanvasElement;
    expect(detectWebGL2(canvas)).toBe(false);
  });
});
```

**Key testability rule:** Pure functions (`buildCameraBounds`, `detectWebGL2`, `getLayerZIndex`) are exported as named exports and tested without DOM/WebGL. The class itself is tested with stub canvases where needed.

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
  anchorLayerId: string;
  renderOrder: number;
  setup: (scene: THREE.Scene) => void;
  dispose: (scene: THREE.Scene) => void;
}

interface RegisteredLayer {
  config: WebGLLayerConfig;
  group: THREE.Group;
}

// ─── Class ───────────────────────────────────────────────────────────────────
export class WebGL2LayerFrameworkClass {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private scene: THREE.Scene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private container: HTMLElement | null = null;
  readonly hasFallback: boolean = false;

  // Public API
  init(containerId?: string): boolean;
  register(config: WebGLLayerConfig): boolean;
  unregister(id: string): void;
  setVisible(id: string, visible: boolean): void;
  requestRender(): void;
  syncTransform(): void;

  // Private
  private render(): void;
  private observeResize(): void;
  private ensureContainer(): HTMLElement | null;
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
// Internal: called by framework's setup callback
function setupReliefLayer(scene: THREE.Scene): void;
// Internal: rebuild geometry from pack.relief data
function buildReliefScene(icons: ReliefIcon[]): void;
// Internal: SVG fallback renderer
function drawSvgRelief(icons: ReliefIcon[], parentEl: HTMLElement): void;

// Public window globals (backward-compatible)
window.drawRelief = (type = "webGL", parentEl = byId("terrain")) => {
  if (WebGL2LayerFramework.hasFallback || type === "svg") {
    drawSvgRelief(icons, parentEl);
  } else {
    buildReliefScene(icons);
    WebGL2LayerFramework.requestRender();
  }
};
window.undrawRelief = () => {
  // Clears geometry but does NOT dispose GPU resources
  disposeScene(); // removes meshes from scene, keeps renderer alive
  if (terrainEl) terrainEl.innerHTML = "";
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
    canvas#terrainCanvas  (NEW; position: absolute; inset: 0; z-index: getLayerZIndex("terrain")+1; pointer-events: none; aria-hidden: true)
```

### 5.6 Framework Initialization Sequence

```
1. Framework module loaded (via src/modules/index.ts import)
2. window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()
   → sets hasFallback = !detectWebGL2()
3. draw-relief-icons.ts loaded (via src/renderers/index.ts import)
   → calls WebGL2LayerFramework.register({ id: "terrain", anchorLayerId: "terrain", ... })
   → if hasFallback: register is a no-op, drawRelief uses SVG path
4. Main map generation completes → window.drawRelief() called by legacy JS
   → if WebGL: builds scene, requestRender() → next RAF → syncTransform + renderer.render
   → if SVG fallback: drawSvgRelief()
5. D3 zoom/pan events → window.rerenderReliefIcons() → framework.requestRender()
6. Layer visibility toggle (legacy JS) → window.undrawRelief() or window.drawRelief()
   → framework.setVisible("terrain", false/true) — NO GPU teardown
```

---

## 6. Architecture Validation

### 6.1 FR Coverage Matrix

| Requirement                                    | Addressed By                                                            | Status                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| FR1: Single WebGL2 context                     | `WebGL2LayerFrameworkClass` owns one `THREE.WebGLRenderer`              | ✅                                                  |
| FR2: Canvas at correct z-index                 | `getLayerZIndex(anchorLayerId)` → canvas z-index                        | ✅ (MVP: above SVG)                                 |
| FR3: Register layer by anchor + callback       | `framework.register(config)`                                            | ✅                                                  |
| FR4: Layer registry                            | `layers: Map<string, RegisteredLayer>`                                  | ✅                                                  |
| FR5: Sync to D3 zoom transform                 | `syncTransform()` reads `viewX, viewY, scale` globals                   | ✅                                                  |
| FR6: Update on D3 change                       | `requestRender()` called from `rerenderReliefIcons`                     | ✅                                                  |
| FR7: Map-space → WebGL clip coordinates        | `buildCameraBounds()` formula                                           | ✅                                                  |
| FR8: Toggle without GPU teardown               | `setVisible()` → `group.visible` only                                   | ✅                                                  |
| FR9: Resize canvas on viewport change          | `ResizeObserver` on container                                           | ✅                                                  |
| FR10: Recalculate z-index on layer reorder     | `getLayerZIndex()` reads live DOM position                              | ✅                                                  |
| FR11: Dispose layer + GPU resources            | `unregister(id)` → disposes GeometryBuffers, removes from scene         | ✅                                                  |
| FR12: All relief icons in one draw call        | Per-set `Mesh` with merged `BufferGeometry` (existing batched approach) | ✅                                                  |
| FR13: Icons at SVG-space coordinates           | Camera in SVG pixel-space; icon positions in `pack.relief` unchanged    | ✅                                                  |
| FR14: Scale with zoom and user setting         | Camera bounds change with zoom; icon size uses `r.s` from relief data   | ✅                                                  |
| FR15: Per-icon rotation                        | Rotation encoded in quad vertex positions during `buildSetMesh`         | ⚠️ Verify rotation support in existing buildSetMesh |
| FR16: Configurable opacity                     | `MeshBasicMaterial.opacity` + `transparent: true`                       | ✅                                                  |
| FR17: Re-render on terrain data change         | `drawRelief()` calls `buildReliefScene()` + `requestRender()`           | ✅                                                  |
| FR18: WebGL2 detection + fallback              | `detectWebGL2()` → `hasFallback` flag                                   | ✅                                                  |
| FR19: SVG fallback visually identical          | Existing `drawSvg()` preserved unchanged                                | ✅                                                  |
| FR20: No pointer-event capture                 | `canvas.style.pointerEvents = "none"`                                   | ✅                                                  |
| FR21: Existing Layers panel unchanged          | `drawRelief`/`undrawRelief` window globals preserved                    | ✅                                                  |
| FR22: Register without z-index knowledge       | `framework.register` derives z-index internally                         | ✅                                                  |
| FR23: Render callback receives D3 transform    | `syncTransform()` reads globals; transforms available in RAF            | ✅                                                  |
| FR24: Same visibility API for all layers       | `framework.setVisible(id, bool)` uniform for all registered layers      | ✅                                                  |
| FR25: Coordinate sync testable in isolation    | `buildCameraBounds` is a pure exported function                         | ✅                                                  |
| FR26: Fallback detection testable              | `detectWebGL2(probeCanvas)` accepts injectable canvas                   | ✅                                                  |
| FR27: Registration testable without real WebGL | `hasFallback = true` path is a no-op; stub renderers in tests           | ✅                                                  |

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

| Risk                                          | Likelihood | Impact | Architecture Mitigation                                                               |
| --------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------- |
| D3 + WebGL coordinate offset at extreme zoom  | Medium     | High   | `buildCameraBounds` is unit-tested at zoom 0.1–50; exact formula documented           |
| FR15: Rotation not in existing `buildSetMesh` | High       | Medium | Flag as pre-MVP verification item; add rotation attribute if missing                  |
| MVP z-ordering: canvas above SVG              | High       | Medium | Accepted tradeoff; documented; Phase 2 DOM-split design provided                      |
| `undrawRelief` callers expect full cleanup    | Low        | Low    | Preserve `undrawRelief` signature; change internals only (no GPU teardown)            |
| Context loss mid-session                      | Low        | High   | Framework inherits existing `forceContextRestore` pattern from `draw-relief-icons.ts` |
| `will-change: transform` memory overhead      | Low        | Low    | Apply only during active zoom/pan; remove after with timing debounce                  |

### 6.4 Decision Coherence Check

| Decision Pair                                                       | Compatible? | Note                                                                           |
| ------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| Single context (D1) + Layer registry (D2)                           | ✅          | `renderOrder` on `THREE.Group` within shared scene                             |
| MVP z-index above SVG (D3) + pointer-events:none (D3)               | ✅          | Interaction preserved regardless of z-stack                                    |
| Camera sync using globals (D4) + testability (FR25)                 | ✅          | `buildCameraBounds` is pure; globals are injected in tests                     |
| No GPU teardown (D5) + `undrawRelief` backward compat (section 5.4) | ✅          | `undrawRelief` calls `disposeScene()` (geometry only) not `renderer.dispose()` |
| On-demand RAF render (D7) + ResizeObserver (D8)                     | ✅          | Both call `requestRender()` which coalesces to one RAF                         |

---

## 7. Implementation Guidance for AI Agents

When implementing this architecture, follow these rules precisely:

### MUST DO

1. **Framework module registers first** — `src/modules/index.ts` import must appear before renderer imports
2. **`window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` is the last line** of the framework module
3. **Export `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex`** as named exports — tests depend on them
4. **`setVisible(id, false)` NEVER calls `renderer.dispose()`** — only sets `group.visible = false`
5. **Canvas element gets**: `pointer-events: none; aria-hidden: true; position: absolute; inset: 0`
6. **Fallback path**: when `hasFallback === true`, all framework methods return silently; `drawRelief` calls `drawSvgRelief`
7. **`window.drawRelief`, `window.undrawRelief`, `window.rerenderReliefIcons`** must remain as window globals (legacy JS calls them)
8. **Verify FR15** (per-icon rotation) in `buildSetMesh` before MVP — add rotation support if missing

### MUST NOT DO

1. **Do NOT** create a second `THREE.WebGLRenderer` — framework owns the only map renderer
2. **Do NOT** move layer `<g>` elements between SVG elements — DOM-split is Phase 2
3. **Do NOT** add any new entries to `public/modules/` — all new code is in `src/`
4. **Do NOT** break the `window.drawRelief(type, parentEl)` signature — legacy callers
5. **Do NOT** use `isNaN()` — use `Number.isNaN()`; or `parseInt()` without radix
6. **Do NOT** import Three.js as `import * as THREE from "three"` — use named imports only

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

**Story 2:** Implement `WebGL2LayerFrameworkClass` core: `init()`, `detectWebGL2()`, canvas creation, `#map-container` wrapper, `ResizeObserver`.

**Story 3:** Implement `register()`, `unregister()`, `setVisible()`, `requestRender()`, `syncTransform()`.

**Story 4:** Refactor `draw-relief-icons.ts` to use `WebGL2LayerFramework.register()` and remove the module-level renderer state. Verify FR15 rotation support.

**Story 5:** Integration testing — generate map, toggle terrain layer, pan/zoom, verify visual output matches SVG baseline.

**Story 6:** Bundle size audit — verify Three.js tree-shaking, confirm ≤50KB gzipped delta.
