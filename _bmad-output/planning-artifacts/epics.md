---
stepsCompleted:
  - "step-01-validate-prerequisites"
  - "step-02-design-epics"
  - "step-03-create-stories-epic1"
  - "step-03-create-stories-epic2"
  - "step-03-create-stories-epic3"
  - "step-04-final-validation"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
---

# Fantasy-Map-Generator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Fantasy-Map-Generator, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The system can initialize a single WebGL2 rendering context that is shared across all registered WebGL layers
FR2: The framework can insert a `<canvas>` element into the map container at a z-index position corresponding to a named anchor SVG layer's position in the visual stack
FR3: The framework can register a new WebGL layer by accepting an anchor SVG layer ID and a render callback function
FR4: The framework can maintain a registry of all registered WebGL layers and their current z-index positions
FR5: The framework can synchronize the WebGL rendering viewport to the current D3 zoom transform (translate x, translate y, scale k) applied to the SVG viewbox group
FR6: The framework can update the WebGL transform when the D3 zoom or pan state changes
FR7: The framework can convert any map-space coordinate (SVG viewport space) to the correct WebGL clip-space coordinate at any zoom level
FR8: Users can toggle individual WebGL layer visibility on and off without destroying GPU buffer state or requiring a re-upload of vertex/instance data
FR9: The framework can resize the canvas element and update the WebGL viewport to match the SVG viewport dimensions when the browser window or map container is resized
FR10: The framework can recalculate a WebGL layer's z-index to account for changes in the SVG layer stack order
FR11: The framework can dispose of a registered WebGL layer and release its associated GPU resources
FR12: The system can render all relief icon types from the existing relief atlas texture using instanced rendering in a single GPU draw call
FR13: The system can position each relief icon at the SVG-space coordinate of its corresponding terrain cell
FR14: The system can scale each relief icon according to the current map zoom level and the user's configured icon scale setting
FR15: The system can apply per-icon rotation as defined in the terrain dataset
FR16: The system can render relief icons with a configurable opacity value
FR17: The relief layer can re-render when the terrain dataset changes (cells added, removed, or type changed)
FR18: The system can detect when WebGL2 is unavailable in the current browser and automatically fall back to the existing SVG-based relief renderer
FR19: The SVG fallback renderer produces visually identical output to the WebGL renderer from the user's perspective
FR20: Users can interact with all SVG map layers (click, drag, hover, editor panels) without the WebGL canvas intercepting pointer or touch events
FR21: Users can control WebGL-rendered layer visibility and style properties using the existing Layers panel controls with no change to the UI
FR22: A developer can register a new WebGL layer by providing only an anchor SVG layer ID and a render callback — no knowledge of z-index calculation or canvas lifecycle is required
FR23: A render callback receives the current D3 transform state so it can apply coordinate synchronization without accessing global state
FR24: A developer can use the same visibility toggle and dispose APIs for custom registered layers as for the built-in relief layer
FR25: The coordinate synchronization logic can be exercised in a Vitest unit test by passing a mock D3 transform and asserting the resulting WebGL projection values
FR26: The WebGL2 fallback detection can be exercised in a Vitest unit test by mocking `canvas.getContext('webgl2')` to return null
FR27: The layer registration API can be exercised in a Vitest unit test without a real browser WebGL context using a stub renderer

### NonFunctional Requirements

NFR-P1: Relief layer initial render (1,000 icons) completes in <16ms — measured via Vitest benchmark / browser DevTools frame timing
NFR-P2: Relief layer initial render (10,000 icons) completes in <100ms — measured via Vitest benchmark / browser DevTools frame timing
NFR-P3: Layer visibility toggle (show/hide) completes in <4ms — measured via `performance.now()` around toggle call
NFR-P4: D3 zoom/pan event → WebGL canvas transform update latency <8ms — measured from zoom event callback to draw call completion
NFR-P5: WebGL context initialization (one-time) completes in <200ms — measured via `performance.now()` on first map load
NFR-P6: No GPU state teardown on layer hide — VBO/texture memory stays allocated; verified via browser GPU memory profiler
NFR-C1: WebGL2 context (`canvas.getContext('webgl2')`) is the sole gating check; if null, SVG fallback activates automatically with no user-visible error
NFR-C2: The framework produces identical visual output across Chrome 69+, Firefox 105+, Safari 16.4+, Edge 79+
NFR-C3: No more than 2 WebGL contexts are open simultaneously (1 for globe, 1 for map)
NFR-C4: The framework does not break if the user has hardware acceleration disabled (falls back to SVG)
NFR-M1: The framework core (`WebGL2LayerFramework` class) has no knowledge of any specific layer's content — all layer-specific logic lives in the layer's render callback
NFR-M2: Adding a new WebGL layer requires only: one call to `framework.register(config)` and implementing the render callback — no changes to framework internals
NFR-M3: The TypeScript module follows the existing project Global Module Pattern (`declare global { var WebGL2LayerFramework: ... }`)
NFR-M4: The coordinate sync formula (D3 transform → WebGL orthographic projection) is documented in code comments with the mathematical derivation
NFR-M5: Vitest unit test coverage ≥80% for the framework core module (`src/modules/webgl-layer-framework.ts`)
NFR-B1: Three.js import uses tree-shaking — only required classes imported (`import { WebGLRenderer, ... } from 'three'`), not the full bundle
NFR-B2: Total Vite bundle size increase from this feature ≤50KB gzipped (Three.js is already a project dependency for the globe view)

### Additional Requirements

- **Brownfield integration**: No starter template; the framework is inserted into an existing codebase. `public/modules/` legacy JS must not be modified.
- **Global Module Pattern (mandatory)**: `window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` must be the last line of the framework module; module added to `src/modules/index.ts` as side-effect import before renderer imports.
- **Canvas id convention**: Framework derives canvas element id as `${config.id}Canvas` (e.g., `id: "terrain"` → `canvas#terrainCanvas`). Never hardcoded by layer code.
- **DOM wrapper required**: Framework wraps existing `svg#map` in a new `div#map-container` (`position: relative`) on `init()`. Canvas is sibling to `#map` inside this container.
- **Canvas styling (mandatory)**: `position: absolute; inset: 0; pointer-events: none; aria-hidden: true; z-index: 2`
- **`hasFallback` backing field pattern**: Must use `private _fallback = false` + `get hasFallback(): boolean` — NOT `readonly hasFallback: boolean = false` (TypeScript compile error if set in `init()`).
- **`pendingConfigs[]` queue**: `register()` before `init()` is explicitly supported by queueing configs; `init()` processes the queue. Module load order is intentionally decoupled from DOM/WebGL readiness.
- **Window globals preserved**: `window.drawRelief`, `window.undrawRelief`, `window.rerenderReliefIcons` must remain as window globals for backward compatibility with legacy JS callers.
- **`undrawRelief` must call `clearLayer()`**: Does NOT call `renderer.dispose()`. Wipes group geometry only; layer remains registered.
- **Exported pure functions for testability**: `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex` must be named exports testable without DOM or WebGL.
- **FR15 rotation pre-verification**: Per-icon rotation support in `buildSetMesh` must be verified before MVP ships; rotation attribute must be added if missing.
- **TypeScript linting**: `Number.isNaN()` not `isNaN()`; `parseInt()` requires radix; named Three.js imports only — no `import * as THREE`.
- **ResizeObserver**: Attached to `#map-container` in `init()`; calls `requestRender()` on resize.
- **D3 zoom subscription**: `viewbox.on("zoom.webgl", () => this.requestRender())` established in `init()`.

### FR Coverage Map

| Epic                                 | Story                                         | FRs Covered                                                 | NFRs Addressed                         |
| ------------------------------------ | --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| Epic 1: WebGL Layer Framework Module | Story 1.1: Pure Functions & Types             | FR7, FR25, FR26                                             | NFR-M4, NFR-M5                         |
| Epic 1: WebGL Layer Framework Module | Story 1.2: Framework Init & DOM Setup         | FR1, FR2, FR9, FR18                                         | NFR-P5, NFR-C1, NFR-C3, NFR-C4, NFR-M3 |
| Epic 1: WebGL Layer Framework Module | Story 1.3: Layer Lifecycle & Render Loop      | FR3, FR4, FR5, FR6, FR8, FR10, FR11, FR22, FR23, FR24, FR27 | NFR-P3, NFR-P4, NFR-P6, NFR-M1, NFR-M2 |
| Epic 2: Relief Icons Layer Migration | Story 2.1: buildSetMesh Rotation Verification | FR15                                                        | —                                      |
| Epic 2: Relief Icons Layer Migration | Story 2.2: Refactor draw-relief-icons.ts      | FR12, FR13, FR14, FR15, FR16, FR17, FR19, FR20, FR21        | NFR-P1, NFR-P2, NFR-C2                 |
| Epic 2: Relief Icons Layer Migration | Story 2.3: WebGL2 Fallback Integration        | FR18, FR19                                                  | NFR-C1, NFR-C4                         |
| Epic 3: Quality & Bundle Integrity   | Story 3.1: Performance Benchmarking           | —                                                           | NFR-P1, NFR-P2, NFR-P3, NFR-P4, NFR-P5 |
| Epic 3: Quality & Bundle Integrity   | Story 3.2: Bundle Size Audit                  | —                                                           | NFR-B1, NFR-B2                         |

## Epic List

- **Epic 1:** WebGL Layer Framework Module
- **Epic 2:** Relief Icons Layer Migration
- **Epic 3:** Quality & Bundle Integrity

---

## Epic 1: WebGL Layer Framework Module

**Goal:** Implement the generic `WebGL2LayerFrameworkClass` TypeScript module that provides canvas lifecycle management, z-index positioning, D3 zoom/pan synchronization, layer registration API, visibility toggle, and all supporting infrastructure. This is the platform foundation — all future layer migrations depend on it.

### Story 1.1: Pure Functions, Types, and TDD Scaffold

As a developer,
I want `buildCameraBounds`, `detectWebGL2`, and `getLayerZIndex` implemented as named-exported pure functions with full Vitest coverage,
So that coordinate sync and WebGL detection logic are verified in isolation before the class is wired up.

**Acceptance Criteria:**

**Given** the file `src/modules/webgl-layer-framework.ts` does not yet exist
**When** the developer creates it with `WebGLLayerConfig` interface, `RegisteredLayer` interface, and the three pure exported functions
**Then** the file compiles with zero TypeScript errors and `npm run lint` passes

**Given** `buildCameraBounds(viewX, viewY, scale, graphWidth, graphHeight)` is implemented
**When** called with identity transform `(0, 0, 1, 960, 540)`
**Then** it returns `{left: 0, right: 960, top: 0, bottom: 540}` and `top < bottom` (Y-down convention)

**Given** `buildCameraBounds` is called with `(0, 0, 2, 960, 540)` (2× zoom)
**When** asserting bounds
**Then** `right === 480` and `bottom === 270` (viewport shows half the map)

**Given** `buildCameraBounds` is called with `(-100, -50, 1, 960, 540)` (panned right/down)
**When** asserting bounds
**Then** `left === 100` and `top === 50`

**Given** `buildCameraBounds` is called with extreme zoom values `(0.1)` and `(50)`
**When** asserting results
**Then** all returned values are finite (no `NaN` or `Infinity`)

**Given** a mock canvas where `getContext('webgl2')` returns `null`
**When** `detectWebGL2(mockCanvas)` is called
**Then** it returns `false`

**Given** a mock canvas where `getContext('webgl2')` returns a mock context object
**When** `detectWebGL2(mockCanvas)` is called
**Then** it returns `true`

**Given** `getLayerZIndex('terrain')` is called
**When** the `#terrain` element is not present in the DOM
**Then** it returns `2` (safe fallback)

**Given** a Vitest test file `src/modules/webgl-layer-framework.test.ts` exists
**When** `npx vitest run` is executed
**Then** all tests in this file pass and coverage for pure functions is 100%

---

### Story 1.2: Framework Core — Init, Canvas, and DOM Setup

As a developer,
I want `WebGL2LayerFrameworkClass.init()` to set up the WebGL2 renderer, wrap `#map` in `#map-container`, insert the canvas, attach a `ResizeObserver`, and subscribe to D3 zoom events,
So that any registered layer can render correctly at any zoom level on any screen size.

**Acceptance Criteria:**

**Given** `WebGL2LayerFramework.init()` is called and WebGL2 is available
**When** the DOM is inspected
**Then** `div#map-container` exists with `position: relative`, `svg#map` is a child at `z-index: 1`, and `canvas#terrainCanvas` is a sibling at `z-index: 2` with `pointer-events: none` and `aria-hidden: true`

**Given** `WebGL2LayerFramework.init()` is called
**When** `detectWebGL2()` returns `false` (WebGL2 unavailable)
**Then** `init()` returns `false`, `framework.hasFallback === true`, and all subsequent API calls on the framework are no-ops

**Given** `hasFallback` is declared as a private backing field `private _fallback = false` with public getter `get hasFallback(): boolean`
**When** `init()` sets `_fallback = !detectWebGL2()`
**Then** the TypeScript compiler produces zero errors (compared to `readonly` which would fail)

**Given** `WebGL2LayerFramework.init()` completes successfully
**When** the framework's private state is inspected
**Then** exactly one `THREE.WebGLRenderer` instance exists, one `THREE.Scene`, and one `THREE.OrthographicCamera` — no duplicates

**Given** a `ResizeObserver` is attached to `#map-container` during `init()`
**When** the container's dimensions change
**Then** `renderer.setSize(width, height)` is called and `requestRender()` is triggered

**Given** D3 zoom subscription `viewbox.on("zoom.webgl", ...)` is established in `init()`
**When** a D3 zoom or pan event fires
**Then** `requestRender()` is called, coalescing into a single RAF

**Given** `WebGL2LayerFrameworkClass` is instantiated (constructor runs)
**When** `init()` has NOT been called yet
**Then** `renderer`, `scene`, `camera`, and `canvas` are all `null` — constructor performs no side effects

**Given** `init()` is called
**When** measuring elapsed time via `performance.now()`
**Then** initialization completes in <200ms (NFR-P5)

**Given** `window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()` is the last line of the module
**When** the module is loaded via `src/modules/index.ts`
**Then** the global is immediately accessible as `window.WebGL2LayerFramework` following the Global Module Pattern

---

### Story 1.3: Layer Lifecycle — Register, Visibility, Render Loop

As a developer,
I want `register()`, `unregister()`, `setVisible()`, `clearLayer()`, `requestRender()`, `syncTransform()`, and the per-frame render dispatch implemented,
So that multiple layers can be registered, rendered, shown/hidden, and cleaned up without GPU state loss.

**Acceptance Criteria:**

**Given** `register(config)` is called before `init()`
**When** `init()` is subsequently called
**Then** the config is queued in `pendingConfigs[]` and processed by `init()` without error — `register()` before `init()` is explicitly safe

**Given** `register(config)` is called after `init()`
**When** the framework state is inspected
**Then** a `THREE.Group` with `config.renderOrder` is created, `config.setup(group)` is called once, the group is added to the scene, and the registration is stored in `layers: Map`

**Given** `setVisible('terrain', false)` is called
**When** the framework internals are inspected
**Then** `layer.group.visible === false`, `config.dispose` is NOT called (no GPU teardown), and the canvas is hidden only if ALL layers are invisible

**Given** `setVisible('terrain', true)` is called after hiding
**When** the layer is toggled back on
**Then** `layer.group.visible === true` and `requestRender()` is triggered — toggle completes in <4ms (NFR-P3)

**Given** `clearLayer('terrain')` is called
**When** the group state is inspected
**Then** `group.clear()` has been called (all Mesh children removed), the layer registration in `layers: Map` remains intact, and `renderer.dispose()` is NOT called

**Given** `requestRender()` is called three times in rapid succession
**When** `requestAnimationFrame` spy is observed
**Then** only one RAF is scheduled (coalescing confirmed)

**Given** `render()` private method is invoked (via RAF callback)
**When** executing the frame
**Then** `syncTransform()` is called first, then each visible layer's `render(group)` callback is dispatched, then `renderer.render(scene, camera)` is called — order is enforced

**Given** `syncTransform()` is called with `viewX = 0, viewY = 0, scale = 1` globals
**When** the camera bounds are applied
**Then** the orthographic camera's left/right/top/bottom match `buildCameraBounds(0, 0, 1, graphWidth, graphHeight)` exactly (D3 transform → camera sync formula)

**Given** a Vitest test exercises `register()`, `setVisible()`, and `requestRender()` with stub scene/renderer
**When** `npx vitest run` is executed
**Then** all tests pass; framework coverage ≥80% (NFR-M5)

**Given** layer callbacks receive a `THREE.Group` from `register()`
**When** layer code is written
**Then** `scene`, `renderer`, and `camera` are never exposed to layer callbacks — `THREE.Group` is the sole abstraction boundary (NFR-M1)

---

## Epic 2: Relief Icons Layer Migration

**Goal:** Refactor `src/renderers/draw-relief-icons.ts` to register with the `WebGL2LayerFramework` instead of managing its own `THREE.WebGLRenderer`. Verify and implement per-icon rotation (FR15). Preserve all existing window globals (`drawRelief`, `undrawRelief`, `rerenderReliefIcons`) for backward compatibility with legacy callers.

### Story 2.1: Verify and Implement Per-Icon Rotation in buildSetMesh

As a developer,
I want to verify that `buildSetMesh` in `draw-relief-icons.ts` correctly applies per-icon rotation from terrain data, and add rotation support if missing,
So that relief icons render with correct orientations matching the SVG baseline (FR15).

**Acceptance Criteria:**

**Given** the existing `buildSetMesh` implementation in `draw-relief-icons.ts`
**When** the developer reviews the vertex construction code
**Then** it is documented whether `r.i` (rotation angle) is currently applied to quad vertex positions

**Given** rotation is NOT applied in the current `buildSetMesh`
**When** the developer adds per-icon rotation via vertex transformation (rotate the quad around its center point using the angle from `pack.relief[n].i`)
**Then** `buildSetMesh` produces correctly oriented quads and `npm run lint` passes

**Given** rotation IS already applied in the current `buildSetMesh`
**When** verified
**Then** no code change is needed and this is documented in a code comment

**Given** the rotation fix is applied (if needed)
**When** a visual comparison is made between WebGL-rendered icons and SVG-rendered icons for a map with rotated terrain icons
**Then** orientations are visually indistinguishable

---

### Story 2.2: Refactor draw-relief-icons.ts to Use Framework

As a developer,
I want `draw-relief-icons.ts` refactored to register with `WebGL2LayerFramework` via `framework.register({ id: 'terrain', ... })` and remove its module-level `THREE.WebGLRenderer` state,
So that the framework owns the single shared WebGL context and the relief layer uses the framework's lifecycle API.

**Acceptance Criteria:**

**Given** `draw-relief-icons.ts` is refactored
**When** the module loads
**Then** `WebGL2LayerFramework.register({ id: 'terrain', anchorLayerId: 'terrain', renderOrder: ..., setup, render, dispose })` is called at module load time — before `init()` is ever called (safe via `pendingConfigs[]` queue)

**Given** the framework takes ownership of the WebGL renderer
**When** `draw-relief-icons.ts` is inspected
**Then** no module-level `THREE.WebGLRenderer`, `THREE.Scene`, or `THREE.OrthographicCamera` instances exist in the module

**Given** `window.drawRelief()` is called (WebGL path)
**When** execution runs
**Then** `buildReliefScene(icons)` adds `Mesh` objects to the framework-managed group and calls `WebGL2LayerFramework.requestRender()` — no renderer setup or context creation occurs

**Given** `window.undrawRelief()` is called
**When** execution runs
**Then** `WebGL2LayerFramework.clearLayer('terrain')` is called (wipes group geometry only), SVG terrain innerHTML is cleared, and `renderer.dispose()` is NOT called

**Given** `window.rerenderReliefIcons()` is called
**When** execution runs
**Then** it calls `WebGL2LayerFramework.requestRender()` — RAF-coalesced, no redundant draws

**Given** `window.drawRelief(type, parentEl)` is called with `type = 'svg'` or when `hasFallback === true`
**When** execution runs
**Then** `drawSvgRelief(icons, parentEl)` is called (existing SVG renderer), WebGL path is bypassed entirely

**Given** the refactored module is complete
**When** `npm run lint` and `npx vitest run` are executed
**Then** zero linting errors and all tests pass

**Given** relief icons are rendered on a map with 1,000 terrain cells
**When** measuring render time
**Then** initial render completes in <16ms (NFR-P1)

---

### Story 2.3: WebGL2 Fallback Integration Verification

As a developer,
I want the WebGL2 → SVG fallback path end-to-end verified,
So that users on browsers without WebGL2 (or with hardware acceleration disabled) see identical map output via the SVG renderer.

**Acceptance Criteria:**

**Given** a Vitest test that mocks `canvas.getContext('webgl2')` to return `null`
**When** `WebGL2LayerFramework.init()` is called
**Then** `hasFallback === true`, `init()` returns `false`, and the framework DOM setup (map-container wrapping, canvas insertion) does NOT occur

**Given** `hasFallback === true`
**When** `WebGL2LayerFramework.register()`, `setVisible()`, `clearLayer()`, and `requestRender()` are called
**Then** all calls are silent no-ops — no exceptions thrown

**Given** `window.drawRelief()` is called and `hasFallback === true`
**When** execution runs
**Then** `drawSvgRelief(icons, parentEl)` is invoked and SVG nodes are appended to the terrain layer — visually identical to the current implementation (FR19)

**Given** SVG fallback is active
**When** a visually rendered map is compared against the current SVG baseline
**Then** icon positions, sizes, and orientations are pixel-indistinguishable (FR19)

**Given** the fallback test is added to `webgl-layer-framework.test.ts`
**When** `npx vitest run` executes
**Then** the fallback detection test passes (FR26)

---

## Epic 3: Quality & Bundle Integrity

**Goal:** Validate that all performance, bundle size, and compatibility NFRs are met. Measure baseline performance, verify tree-shaking, confirm the Vite bundle delta is within budget, and document test results.

### Story 3.1: Performance Benchmarking

As a developer,
I want baseline and post-migration render performance measured and documented,
So that we can confirm the WebGL implementation meets all NFR performance targets.

**Acceptance Criteria:**

**Given** a map generated with 1,000 terrain icons (relief cells)
**When** `window.drawRelief()` is called and render time is measured via `performance.now()`
**Then** initial render time is recorded as the baseline and the WebGL render completes in <16ms (NFR-P1)

**Given** a map generated with 10,000 terrain icons
**When** `window.drawRelief()` is called
**Then** render time is recorded and completes in <100ms (NFR-P2)

**Given** the terrain layer is currently visible
**When** `framework.setVisible('terrain', false)` is called and measured
**Then** toggle completes in <4ms (NFR-P3)

**Given** a D3 zoom event fires
**When** the transform update propagates through to `gl.drawArraysInstanced`
**Then** latency is <8ms (NFR-P4)

**Given** `WebGL2LayerFramework.init()` is called cold (first page load)
**When** measured via `performance.now()`
**Then** initialization completes in <200ms (NFR-P5)

**Given** the terrain layer is hidden (via `setVisible(false)`)
**When** the browser GPU memory profiler is observed
**Then** VBO and texture memory is NOT released — GPU state preserved (NFR-P6)

**Given** benchmark results are collected
**When** documented
**Then** baseline SVG render time vs. WebGL render time is recorded with >80% reduction for 5,000+ icons confirmed

---

### Story 3.2: Bundle Size Audit

As a developer,
I want the Vite production bundle analyzed to confirm Three.js tree-shaking is effective and the total bundle size increase is within budget,
So that the feature does not negatively impact page load performance.

**Acceptance Criteria:**

**Given** `vite build` is run with the complete implementation
**When** the bundle output is analyzed (e.g., `npx vite-bundle-visualizer` or `rollup-plugin-visualizer`)
**Then** Three.js named imports confirm only the required classes are included: `WebGLRenderer, Scene, OrthographicCamera, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, TextureLoader, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter, DoubleSide`

**Given** the bundle size before and after the feature is compared
**When** gzip sizes are measured
**Then** the total bundle size increase is ≤50KB gzipped (NFR-B2)

**Given** `webgl-layer-framework.ts` source is inspected
**When** Three.js imports are reviewed
**Then** no `import * as THREE from 'three'` exists — all imports are named (NFR-B1)

**Given** the bundle audit completes
**When** results are documented
**Then** actual gzip delta is recorded and compared to the 50KB budget
