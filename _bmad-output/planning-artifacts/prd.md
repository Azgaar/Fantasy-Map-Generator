---
stepsCompleted:
  [
    "step-01-init",
    "step-02-discovery",
    "step-02b-vision",
    "step-02c-executive-summary",
    "step-03-success",
    "step-04-journeys",
    "step-05-domain",
    "step-06-innovation",
    "step-07-project-type",
    "step-08-scoping",
    "step-09-functional",
    "step-10-nonfunctional",
    "step-11-polish",
    "step-12-complete"
  ]
inputDocuments:
  - "_bmad-output/planning-artifacts/research/technical-WebGL-SVG-layered-rendering-research-2026-03-12.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-03-12-001.md"
  - "_bmad-output/project-context.md"
workflowType: "prd"
classification:
  projectType: "web_app"
  domain: "general"
  complexity: "high"
  projectContext: "brownfield"
outOfScope:
  - "SVG export compatibility (will be addressed in a separate branch)"
  - "3D globe view / Three.js globe renderer (leave as-is)"
  - "Playwright / E2E testing (deferred to later)"
---

# Product Requirements Document - Fantasy-Map-Generator

**Author:** Azgaar
**Date:** 2026-03-12

---

## Executive Summary

Fantasy-Map-Generator (FMG) is a browser-based procedural world map generator used by worldbuilders, game designers, and writers to create and edit detailed fantasy maps. The entire map is rendered as a single SVG document with 32 named layer groups managed by D3. As map complexity grows — larger worlds, higher cell counts, denser terrain coverage — the SVG relief icons layer (`#terrain`) becomes the primary rendering bottleneck: each icon is an individual `<use>` DOM node, producing linear DOM growth and main-thread layout cost that degrades perceived map responsiveness.

This project introduces a **WebGL 2D layer framework** to replace SVG-based rendering for GPU-suitable layers, with the **relief icons layer as the MVP**. The framework inserts a `<canvas>` element into the existing SVG layer stack at the correct z-position using CSS `position: absolute` and `z-index`, rendering WebGL content that is visually indistinguishable from the current SVG output. All existing layer toggle, reorder, and visibility semantics are preserved. The framework is designed as a generic, extensible foundation for future layer migrations.

### What Makes This Special

The key architectural insight is that the user-visible contract is the _layer stack_ — correct ordering, correct visibility, correct visual output — not the rendering technology underneath. By decoupling render technology from layer position (via DOM z-index rather than SVG document order), any layer can be migrated from SVG to WebGL independently, without disrupting adjacent layers or requiring a full rewrite.

The relief icons layer is the ideal MVP: it is icon-heavy (thousands of `<use>` instances on large maps), visually self-contained (no `<text>`, no `<textPath>`, no filter dependencies on neighbouring layers), and currently the most user-visible performance bottleneck. A single WebGL draw call with instanced rendering replaces O(N) DOM nodes. The framework established here can subsequently accelerate biomes, regions, borders, and other path-heavy layers.

### Project Classification

| Field               | Value                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Project Type**    | Web App (Browser SPA, no server)                                                                          |
| **Domain**          | General creative tooling                                                                                  |
| **Complexity**      | High — novel WebGL/SVG interleaving, multiple architectural trade-offs, regression risk on layer ordering |
| **Project Context** | Brownfield — isolated subsystem replacement in a large existing codebase                                  |
| **Out of Scope**    | SVG export compatibility; 3D globe view; Playwright/E2E testing                                           |

---

## Success Criteria

### User Success

- Relief icons render on a 1,000-cell map in under 100ms perceived time on a mid-range GPU — users experience no lag when the terrain layer is active
- Map visual output is pixel-indistinguishable from the current SVG version: same icon positions, sizes, orientations, and colors
- Toggling the terrain layer on/off is instantaneous — no pop-in, no stutter, no GPU state teardown
- All existing layer visibility controls, show/hide toggles, and layer reorder operations work identically to the SVG version
- Large maps (10,000+ cells with dense terrain) are usable without browser tab lag or unresponsive UI

### Business Success

- Relief rendering time reduced by >80% on maps with 5,000+ terrain icons versus the current SVG implementation
- The WebGL layer framework is extensible: at least 3 additional layers can be migrated using the same framework without refactoring the core
- Zero regressions to non-terrain layers — all 31 other SVG layers continue to function correctly after the migration
- The implementation ships as a TypeScript module in `src/` following the existing Global Module Pattern

### Technical Success

- A single `<canvas>` element is inserted into the map DOM at the correct z-index position (between `#rivers` and `#relig` layers), absolutely positioned and coextensive with the SVG viewport
- WebGL renders relief icons via instanced rendering (InstancedMesh or `gl.POINTS`) in a single draw call regardless of icon count
- The WebGL canvas maintains coordinate alignment with the SVG viewport through D3 zoom/pan transforms — no manual coordinate offset calculations needed at render time
- Layer toggle preserves GPU state (`visible = false` / `canvas.style.display = 'none'`) — no buffer teardown on hide
- No WebGL context limit violations — a single WebGL context handles all WebGL layers via `renderOrder` / draw order management
- Vitest unit tests cover framework core: canvas insertion, z-index calculation, coordinate sync, and visibility toggle logic

### Measurable Outcomes

| Metric                         | Baseline                         | Target                    |
| ------------------------------ | -------------------------------- | ------------------------- |
| Relief render time @ 1k icons  | Measured at implementation start | < 16ms (1 frame at 60fps) |
| Relief render time @ 10k icons | Measured at implementation start | < 100ms                   |
| DOM node delta (terrain layer) | O(N) `<use>` elements            | 1 `<canvas>` element      |
| WebGL contexts open            | 1 (globe)                        | 2 (globe + map)           |
| Layer regression count         | 0                                | 0                         |

---

## User Journeys

### Journey 1: The Worldbuilder — Dense Continent (Happy Path)

**Persona:** Katrin, a fantasy novelist who has been using FMG for 2 years to create the world for her book series. Her current project is a continent-spanning empire with multiple mountain ranges.

**Opening Scene:** Katrin generates a new map with 8,000 cells and turns on the terrain layer. With the old SVG renderer, the browser UI freezes for 3 seconds every time she enables terrain icons. She's gotten used to working around it — toggling terrain off while editing, then turning it back on for screenshots.

**Rising Action:** With the WebGL relief layer active, Katrin enables terrain for the first time on her new map. The icons appear on screen without any perceptible delay. She zooms into the northern mountain range — the icons scale correctly, stay perfectly positioned over the terrain cells, and the canvas tracks the D3 pan/zoom exactly.

**Climax:** Katrin opens the Style panel and adjusts the icon opacity and scale. The WebGL layer responds to the same style parameters as before. She switches between terrain view and no-terrain view a dozen times while fine-tuning — each toggle is instant. She never once thinks about the rendering technology.

**Resolution:** Katrin now leaves terrain icons on during her entire editing session. She can evaluate composition decisions with terrain visible — something she avoided before because the performance made it impractical.

**Revealed Requirements:** Canvas inserted at correct z-index; D3 zoom/pan synced to WebGL camera; layer toggle is instant (GPU state preserved); visual parity with SVG icons; style parameters (opacity, scale) respected.

---

### Journey 2: The Worldbuilder — Layer Toggle During Edit (Edge Case)

**Persona:** Same as Katrin, mid-session editing.

**Opening Scene:** Katrin has terrain icons visible. She selects a burg to edit its name. The editor panel opens over the map. She wants to hide terrain icons to see the underlying cell grid more clearly.

**Rising Action:** She clicks the terrain visibility toggle. The canvas disappears. She edits the burg. She clicks toggle again — canvas reappears, all icons in exactly the same positions as before. No flicker, no reload, no icon repositioning.

**Climax:** Katrin zooms out, pans to a different region, then zooms back in. Relief icons render at the new zoom level instantly. She modifies a river by dragging it — the terrain layer doesn't interfere with the SVG interaction layer above it.

**Resolution:** The canvas and SVG layers are completely independent in their interaction model. The canvas is visually present but never intercepts mouse/pointer events on SVG layers above it.

**Revealed Requirements:** Canvas must have `pointer-events: none` — all interaction remains on the SVG layer; canvas visibility toggle must not reset GPU buffers; re-show must resume from exact previous state.

---

### Journey 3: The Developer — Migrating a Second Layer (Framework Extension)

**Persona:** Alex, a contributor to FMG who wants to migrate the `#biomes` layer to WebGL after the relief MVP ships.

**Opening Scene:** Alex reads the relief layer implementation in `src/`. The framework has a clear API: register a layer with a z-index anchor, provide a render function that receives the current D3 transform, and the framework handles canvas lifecycle. Alex creates a new file `biomes-webgl.ts`.

**Rising Action:** Alex calls `WebGLLayerFramework.register({ id: 'biomes', anchorLayerId: 'biomes', render: renderBiomesLayer })`. The framework inserts a canvas at the correct DOM position automatically. Alex implements the `renderBiomesLayer` function using the same instanced patterns from the relief renderer.

**Climax:** Alex toggles biomes visibility — the framework's visibility API maps to the same toggle mechanism as relief. Layer ordering between biomes and relief is correct because the framework uses z-index derived from the SVG layer stack positions.

**Resolution:** The biomes layer migrates in ~200 lines of new code. No changes to the framework core. The pattern is consistent, documented, and testable.

**Revealed Requirements:** Framework exposes a public `register(config)` API; z-index is derived automatically from the anchor SVG layer's DOM position; render callback receives D3 transform; framework has no knowledge of specific layer content.

---

### Journey 4: The Developer — Debugging a Visual Regression

**Persona:** Alex, investigating a bug report: "relief icons appear offset at high zoom levels."

**Opening Scene:** Alex opens the browser dev tools. The offset only appears when D3 zoom scale > 10. The SVG viewbox and the canvas size are both correct. The transform is being applied — but to the wrong origin point.

**Rising Action:** Alex checks the coordinate sync code. The D3 zoom transform (`translate(x, y) scale(k)`) is applied to the SVG `#viewbox` group. The WebGL camera must replicate this exactly: translate by `(x, y)`, then scale by `k`, with the same origin. Alex identifies that the WebGL projection matrix was using canvas center as origin instead of `(0, 0)`.

**Climax:** The fix is a one-line change to the projection matrix construction. Alex adds a Vitest unit test asserting that for a given D3 transform, the projected icon position matches the expected SVG coordinate.

**Resolution:** The regression is caught by the new test. The framework's coordinate sync logic is now explicitly tested and documented.

**Revealed Requirements:** Coordinate sync logic must be unit-testable in isolation; the transform pipeline must have a clear, documented contract between D3 zoom state and WebGL projection; Vitest tests for coordinate sync are part of MVP.

---

### Journey Requirements Summary

| Capability                                                       | Revealed By     |
| ---------------------------------------------------------------- | --------------- |
| Canvas inserted at correct z-index, coextensive with SVG         | Journey 1, 2, 3 |
| D3 zoom/pan transform synchronized to WebGL camera               | Journey 1, 4    |
| `pointer-events: none` on canvas — SVG layers remain interactive | Journey 2       |
| Layer visibility toggle preserves GPU state                      | Journey 2       |
| Public framework registration API for new layers                 | Journey 3       |
| Z-index auto-derived from SVG layer DOM position                 | Journey 3       |
| Coordinate sync unit-testable in isolation                       | Journey 4       |
| Vitest tests for framework core                                  | Journey 4       |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. WebGL Canvas Injected into SVG Layer Stack via CSS Z-Index**

The core architectural innovation: a `<canvas>` element can be placed at any arbitrary position _within_ the visual stacking of an existing SVG document by using `position: absolute; inset: 0; z-index: N` on the canvas and wrapping the SVG in a positioned container. This allows WebGL-rendered content to appear correctly between SVG layer groups without any DOM restructuring, foreignObject usage, or FBO compositing overhead.

This pattern is non-obvious. Standard approaches either place the canvas below/above the SVG (losing interleaving) or nest it inside the SVG via `<foreignObject>` (triggering full FBO compositing on every frame). The CSS z-index approach escapes both penalties: the browser compositor stacks the canvas at the correct visual depth while the SVG renders independently.

**2. Generic GPU Layer Registration Framework for D3 SVG Maps**

No existing library solves the exact problem of: "I have a D3-managed SVG with named layer groups, and I want to incrementally replace individual layers with WebGL renderers while preserving the layer stack contract." Mapbox GL and deck.gl both assume full WebGL ownership of the viewport. This framework inverts that assumption — SVG is the primary renderer, and WebGL is inserts itself as a peer.

The framework derives z-index values automatically from the DOM position of anchor SVG layer elements, making the WebGL layer self-positioning: if SVG layer order changes, the WebGL canvas z-index updates automatically.

**3. D3 Zoom/Pan → WebGL Orthographic Camera Synchronization**

The D3 zoom transform (`translate(x, y) scale(k)`) is a 2D affine transform applied to an SVG group. Replicating it in WebGL as an orthographic projection matrix — where the viewport dimensions are the SVG dimensions, the camera origin is `(0, 0)` in SVG space, and scale maps directly to camera zoom — is a precise mathematical correspondence that enables pixel-perfect alignment between SVG and WebGL rendered content at all zoom levels.

### Validation Approach

| Innovation                 | Validation Method                                                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS z-index interleaving   | Visual regression: screenshot comparison at 5 zoom levels with terrain layer at positions 5, 12, 20 in the 32-layer stack                      |
| GPU layer framework        | Integration: register 2 layers (relief + biomes stub), verify z-index ordering, toggle each independently, confirm no cross-layer interference |
| D3 → WebGL coordinate sync | Unit test: for 20 (transform, icon-position) pairs, assert WebGL projected screen position matches expected SVG coordinate within 0.5px        |

### Risk Mitigation

| Risk                                                        | Mitigation                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| WebGL context limit (browser allows 8–16 contexts)          | Single WebGL context for all WebGL layers; `renderOrder` manages draw order within the context        |
| Canvas z-index drifts when SVG layers are reordered by user | Z-index recalculated from live DOM position of anchor layer on every re-render                        |
| D3 transform sync breaks at extreme zoom levels             | Unit tests cover zoom scale 0.1 to 50; coordinate sync verified against SVG transform matrix directly |
| `will-change: transform` GPU memory overhead                | Applied only to the canvas element; removed after initial render stabilizes                           |

---

## Web App Specific Requirements

### Browser Support Matrix

| Browser | Minimum Version | Gating Feature             |
| ------- | --------------- | -------------------------- |
| Chrome  | 69              | WebGL2, OffscreenCanvas    |
| Firefox | 105             | OffscreenCanvas in Workers |
| Safari  | 16.4            | OffscreenCanvas            |
| Edge    | 79              | WebGL2                     |

The minimum bar is **WebGL2** context support. If `canvas.getContext('webgl2')` returns null, the framework must gracefully fall back to the existing SVG relief renderer with no user-visible error.

### Responsiveness & Layout

- FMG is a desktop-first application; no mobile/touch optimization required for this feature
- Canvas dimensions must update on SVG viewport resize (window resize, panel open/close)
- The `ResizeObserver` pattern is used to react to SVG container size changes

### Interaction Model

- Canvas must have `pointer-events: none` — the entire interaction model (drag, click, hover, editor panels) remains on the SVG layers
- No new keyboard shortcuts or UI controls are introduced by the framework itself
- The existing layer visibility toggle (checkbox/button per layer in the Layers panel) is reused — the framework hooks into the existing toggle mechanism

### Accessibility

- The `<canvas>` element has `aria-hidden="true"` — it is purely decorative/visual
- No ARIA roles, labels, or keyboard navigation are added to the canvas
- All existing accessibility attributes on SVG elements are unaffected

---

## Project Scoping & Phased Development

### MVP Strategy

**MVP Approach:** Platform MVP — prove the generic framework architecture is sound by shipping one complete, production-quality layer migration. The relief icons layer is the proving ground, not the destination.

**Rationale:** A narrow one-off solution (SVG → WebGL just for relief) would solve the immediate performance problem but leave the codebase with an ad-hoc integration that doesn't generalize. A platform MVP establishes the framework contract (registration API, coordinate sync, z-index management, visibility toggle) so that future layer migrations are straightforward rather than bespoke.

**Resource Requirement:** Single developer. No specialized WebGL expertise required beyond what the research documents already provide — Three.js handles the WebGL abstraction layer.

### Phase 1 — MVP

**Core Journeys Supported:** Journey 1 (worldbuilder, happy path), Journey 2 (layer toggle edge case)

**Must-Have Capabilities:**

| Capability                                                            | Justification                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| `WebGL2LayerFramework` TypeScript class in `src/`                     | Core deliverable — all other capabilities depend on it |
| Canvas insertion at correct z-index                                   | Without this, layer ordering breaks                    |
| D3 zoom/pan → WebGL camera synchronization                            | Without this, icons appear at wrong positions          |
| `pointer-events: none` on canvas                                      | Without this, map interaction breaks                   |
| WebGL2 → SVG fallback when WebGL2 unavailable                         | Without this, users on unsupported browsers are broken |
| Relief icons layer migrated to WebGL (`InstancedMesh` or `gl.POINTS`) | MVP deliverable — proves the framework                 |
| Layer visibility toggle (GPU state preserved)                         | Without this, toggling terrain destroys GPU buffers    |
| Canvas resize on SVG viewport change                                  | Without this, canvas misaligns after window resize     |
| Vitest unit tests for coordinate sync and framework core              | Required per project quality standards                 |

**Out of MVP:**

- SVG export compatibility (separate branch)
- 3D globe view (untouched)
- Playwright/E2E tests (deferred)
- OffscreenCanvas / Worker thread rendering
- Any layer migration beyond `#terrain`

### Phase 2 — Growth (Post-MVP)

- Migrate `#biomes` layer to WebGL (largest path-heavy layer after terrain)
- Migrate `#regions` and `#borders` to WebGL
- OffscreenCanvas + Worker thread: move WebGL render loop off main thread
- Dynamic level-of-detail: reduce icon instance count at small zoom scales

### Phase 3 — Vision

- All GPU-suitable 2D layers rendered via WebGL
- SVG retained only for: text labels, `<textPath>`, interactive elements, `<use>` symbol layers (compass, emblems, burg icons)
- Sub-16ms full-map re-render at continent scale
- Framework pattern documented as a contribution guide for future layers

### Risk Assessment

| Risk                                                       | Likelihood | Impact | Mitigation                                                                 |
| ---------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| D3 + WebGL coordinate sync offset at edge zoom levels      | Medium     | High   | Unit tests at zoom 0.1–50 before MVP ships                                 |
| WebGL2 fallback path not tested before release             | Medium     | High   | Explicit fallback test in Vitest (mock `getContext('webgl2')` → null)      |
| Relief icon atlas UV mapping incorrect for some icon types | Low        | Medium | Visual regression: render all atlas tiles in isolation during development  |
| Canvas z-index incorrect after SVG layer reorder           | Low        | Medium | Z-index recalculation on every render from live DOM position               |
| Three.js bundle size regression                            | Low        | Low    | Tree-shaking via `three/addons` imports only; check bundle size diff in CI |

---

## Functional Requirements

### WebGL Layer Framework Core

- **FR1:** The system can initialize a single WebGL2 rendering context that is shared across all registered WebGL layers
- **FR2:** The framework can insert a `<canvas>` element into the map container at a z-index position corresponding to a named anchor SVG layer's position in the visual stack
- **FR3:** The framework can register a new WebGL layer by accepting an anchor SVG layer ID and a render callback function
- **FR4:** The framework can maintain a registry of all registered WebGL layers and their current z-index positions

### Coordinate & Transform Synchronization

- **FR5:** The framework can synchronize the WebGL rendering viewport to the current D3 zoom transform (translate x, translate y, scale k) applied to the SVG viewbox group
- **FR6:** The framework can update the WebGL transform when the D3 zoom or pan state changes
- **FR7:** The framework can convert any map-space coordinate (SVG viewport space) to the correct WebGL clip-space coordinate at any zoom level

### Layer Lifecycle Management

- **FR8:** Users can toggle individual WebGL layer visibility on and off without destroying GPU buffer state or requiring a re-upload of vertex/instance data
- **FR9:** The framework can resize the canvas element and update the WebGL viewport to match the SVG viewport dimensions when the browser window or map container is resized
- **FR10:** The framework can recalculate a WebGL layer's z-index to account for changes in the SVG layer stack order
- **FR11:** The framework can dispose of a registered WebGL layer and release its associated GPU resources

### Relief Icons Rendering (MVP Layer)

- **FR12:** The system can render all relief icon types from the existing relief atlas texture using instanced rendering in a single GPU draw call
- **FR13:** The system can position each relief icon at the SVG-space coordinate of its corresponding terrain cell
- **FR14:** The system can scale each relief icon according to the current map zoom level and the user's configured icon scale setting
- **FR15:** The system can apply per-icon rotation as defined in the terrain dataset
- **FR16:** The system can render relief icons with a configurable opacity value
- **FR17:** The relief layer can re-render when the terrain dataset changes (cells added, removed, or type changed)

### Browser Compatibility & Fallback

- **FR18:** The system can detect when WebGL2 is unavailable in the current browser and automatically fall back to the existing SVG-based relief renderer
- **FR19:** The SVG fallback renderer produces visually identical output to the WebGL renderer from the user's perspective

### Interaction Preservation

- **FR20:** Users can interact with all SVG map layers (click, drag, hover, editor panels) without the WebGL canvas intercepting pointer or touch events
- **FR21:** Users can control WebGL-rendered layer visibility and style properties using the existing Layers panel controls with no change to the UI

### Developer Extension API

- **FR22:** A developer can register a new WebGL layer by providing only an anchor SVG layer ID and a render callback — no knowledge of z-index calculation or canvas lifecycle is required
- **FR23:** A render callback receives the current D3 transform state so it can apply coordinate synchronization without accessing global state
- **FR24:** A developer can use the same visibility toggle and dispose APIs for custom registered layers as for the built-in relief layer

### Testability

- **FR25:** The coordinate synchronization logic can be exercised in a Vitest unit test by passing a mock D3 transform and asserting the resulting WebGL projection values
- **FR26:** The WebGL2 fallback detection can be exercised in a Vitest unit test by mocking `canvas.getContext('webgl2')` to return null
- **FR27:** The layer registration API can be exercised in a Vitest unit test without a real browser WebGL context using a stub renderer

---

## Non-Functional Requirements

### Performance

| NFR    | Requirement                                                              | Measurement Method                                                       |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| NFR-P1 | Relief layer initial render (1,000 icons) completes in < 16ms            | Vitest benchmark / browser DevTools frame timing                         |
| NFR-P2 | Relief layer initial render (10,000 icons) completes in < 100ms          | Vitest benchmark / browser DevTools frame timing                         |
| NFR-P3 | Layer visibility toggle (show/hide) completes in < 4ms                   | `performance.now()` measurement around toggle call                       |
| NFR-P4 | D3 zoom/pan event → WebGL canvas transform update latency < 8ms          | Measured from zoom event callback to `gl.drawArraysInstanced` completion |
| NFR-P5 | WebGL context initialization (one-time) completes in < 200ms             | `performance.now()` on first map load                                    |
| NFR-P6 | No GPU state teardown on layer hide — VBO/texture memory stays allocated | Verified via browser GPU memory profiler (Chrome DevTools Memory panel)  |

### Compatibility

| NFR    | Requirement                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-C1 | WebGL2 context (`canvas.getContext('webgl2')`) is the sole gating check; if null, SVG fallback activates automatically with no user-visible error |
| NFR-C2 | The framework produces identical visual output across Chrome 69+, Firefox 105+, Safari 16.4+, Edge 79+                                            |
| NFR-C3 | No more than 2 WebGL contexts are open simultaneously (1 for globe, 1 for map) — the browser 8–16 context limit is not approached                 |
| NFR-C4 | The framework does not break if the user has hardware acceleration disabled (falls back to SVG)                                                   |

### Maintainability & Extensibility

| NFR    | Requirement                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-M1 | The framework core (`WebGL2LayerFramework` class) has no knowledge of any specific layer's content — all layer-specific logic lives in the layer's render callback |
| NFR-M2 | Adding a new WebGL layer requires only: one call to `framework.register(config)` and implementing the render callback — no changes to framework internals          |
| NFR-M3 | The TypeScript module follows the existing project Global Module Pattern (`declare global { var WebGL2LayerFramework: ... }`)                                      |
| NFR-M4 | The coordinate sync formula (D3 transform → WebGL orthographic projection) is documented in code comments with the mathematical derivation                         |
| NFR-M5 | Vitest unit test coverage ≥ 80% for the framework core module (`src/modules/webgl-layer-framework.ts`)                                                             |

### Bundle Size

| NFR    | Requirement                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-B1 | Three.js import uses tree-shaking — only required classes imported (`import { WebGLRenderer, ... } from 'three'`), not the full bundle |
| NFR-B2 | Total Vite bundle size increase from this feature ≤ 50KB gzipped (Three.js is already a project dependency for the globe view)         |
