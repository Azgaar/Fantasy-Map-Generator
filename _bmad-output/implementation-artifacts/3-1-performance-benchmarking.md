# Story 3.1: Performance Benchmarking

**Status:** ready-for-dev
**Epic:** 3 — Quality & Bundle Integrity
**Story Key:** 3-1-performance-benchmarking
**Created:** 2026-03-12
**Developer:** _unassigned_

---

## Story

As a developer,
I want baseline and post-migration render performance measured and documented,
So that we can confirm the WebGL implementation meets all NFR performance targets.

---

## Acceptance Criteria

**AC1:** Initial render — 1,000 icons
**Given** a map generated with 1,000 terrain icons (relief cells)
**When** `window.drawRelief()` is called and render time is measured via `performance.now()`
**Then** WebGL render completes in <16ms (NFR-P1)

**AC2:** Initial render — 10,000 icons
**Given** a map generated with 10,000 terrain icons
**When** `window.drawRelief()` is called
**Then** render completes in <100ms (NFR-P2)

**AC3:** Layer visibility toggle
**Given** the terrain layer is currently visible
**When** `WebGL2LayerFramework.setVisible('terrain', false)` is called and measured
**Then** toggle completes in <4ms (NFR-P3)

**AC4:** D3 zoom latency
**Given** a D3 zoom event fires
**When** the transform update propagates through to the WebGL canvas
**Then** latency is <8ms (NFR-P4)

**AC5:** Framework initialization
**Given** `WebGL2LayerFramework.init()` is called cold
**When** measured via `performance.now()`
**Then** initialization completes in <200ms (NFR-P5)

**AC6:** GPU state preservation on hide
**Given** the terrain layer is hidden via `setVisible(false)`
**When** the browser GPU memory profiler is observed
**Then** VBO and texture memory is NOT released (NFR-P6)

**AC7:** SVG vs WebGL baseline comparison
**Given** benchmark results are collected for both render paths
**When** documented
**Then** baseline SVG render time vs. WebGL render time is recorded with >80% reduction for 5,000+ icons confirmed

**AC8:** Results documented
**When** all measurements are taken
**Then** actual timings are recorded in this story's Dev Agent Record, annotated with pass/fail against NFR targets

---

## Context

### What This Story Is

This is a **measurement and documentation story**. The code is complete (Epics 1 and 2 done). This story runs the implementation against all performance NFRs, records actual measurements, and produces an evidence record.

There are two components:

1. **Automated bench test** (`src/renderers/draw-relief-icons.bench.ts`) — Vitest `bench()` for geometry build time (`buildSetMesh` proxy). Runs in node env with Three.js mocked (same mock as framework tests). Measures CPU cost of geometry construction, not GPU cost. Partial proxy for NFR-P1/P2.

2. **Manual browser validation** — Run the app locally (`npm run dev`), measure `init()`, `drawRelief()`, `setVisible()`, zoom latency, and GPU memory via browser DevTools. Record results in completion notes.

### Why Split Automated vs Manual

- `draw-relief-icons.ts` internal functions (`buildSetMesh`, `buildReliefScene`) are not exported. They run inside `window.drawRelief()`.
- GPU render time (`renderer.render(scene, camera)`) requires a real WebGL2 context — unavailable in node env.
- Browser-mode Vitest (`vitest.browser.config.ts`) could bench real GPU calls, but has setup overhead and flaky timing. Manual DevTools profiling is the gold standard for GPU frame time.
- Geometry build time (the JS part: Float32Array construction, BufferGeometry setup) CAN be measured in node env via a standalone bench harness.

### Prerequisites

- Epic 1 done ✅: `WebGL2LayerFramework` fully implemented
- Epic 2 done ✅: `draw-relief-icons.ts` refactored to use framework
- `npm run lint` → clean ✅
- `npx vitest run` → 43 tests passing ✅

### Key Source Files (Read-Only)

| File                                   | Purpose                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `src/modules/webgl-layer-framework.ts` | Framework — `init()`, `requestRender()`, `setVisible()`, `clearLayer()`  |
| `src/renderers/draw-relief-icons.ts`   | Renderer — `window.drawRelief()`, `buildSetMesh()`, `buildReliefScene()` |
| `src/config/relief-config.ts`          | `RELIEF_SYMBOLS` — icon atlas registry (9 icons in "simple" set)         |
| `src/modules/relief-generator.ts`      | `generateRelief()` — produces `ReliefIcon[]` from terrain cells          |

---

## Dev Notes

### Automated Bench Test

Create `src/renderers/draw-relief-icons.bench.ts`. Use Vitest's `bench()` function (built into Vitest 4.x via tinybench). The test must mock Three.js the same way `webgl-layer-framework.test.ts` does.

**Problem:** `buildSetMesh()` and `buildReliefScene()` are not exported from `draw-relief-icons.ts`. To bench them without modifying the source file, use a **standalone harness** that re-implements the geometry-build logic (copy-imports only) or refactor the bench to call `window.drawRelief()` after setting up all required globals.

**Recommended approach** — standalone geometry harness (no source changes required):

```typescript
// src/renderers/draw-relief-icons.bench.ts
import {bench, describe, vi} from "vitest";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader
} from "three";
import {RELIEF_SYMBOLS} from "../config/relief-config";
import type {ReliefIcon} from "../modules/relief-generator";

// Re-implement buildSetMesh locally for benchmarking (mirrors the production impl)
function buildSetMeshBench(entries: Array<{icon: ReliefIcon; tileIndex: number}>, set: string, texture: any): any {
  const ids = RELIEF_SYMBOLS[set] ?? [];
  const n = ids.length || 1;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const positions = new Float32Array(entries.length * 4 * 3);
  const uvs = new Float32Array(entries.length * 4 * 2);
  const indices = new Uint32Array(entries.length * 6);
  let vi = 0,
    ii = 0;
  for (const {icon: r, tileIndex} of entries) {
    const col = tileIndex % cols;
    const row = Math.floor(tileIndex / cols);
    const u0 = col / cols,
      u1 = (col + 1) / cols;
    const v0 = row / rows,
      v1 = (row + 1) / rows;
    const x0 = r.x,
      x1 = r.x + r.s;
    const y0 = r.y,
      y1 = r.y + r.s;
    const base = vi;
    positions.set([x0, y0, 0], vi * 3);
    uvs.set([u0, v0], vi * 2);
    vi++;
    positions.set([x1, y0, 0], vi * 3);
    uvs.set([u1, v0], vi * 2);
    vi++;
    positions.set([x0, y1, 0], vi * 3);
    uvs.set([u0, v1], vi * 2);
    vi++;
    positions.set([x1, y1, 0], vi * 3);
    uvs.set([u1, v1], vi * 2);
    vi++;
    indices.set([base, base + 1, base + 3, base, base + 3, base + 2], ii);
    ii += 6;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("uv", new BufferAttribute(uvs, 2));
  geo.setIndex(new BufferAttribute(indices, 1));
  return geo; // skip material for geometry-only bench
}

// Generate N synthetic icons (no real pack/generateRelief needed)
function makeIcons(n: number): Array<{icon: ReliefIcon; tileIndex: number}> {
  return Array.from({length: n}, (_, i) => ({
    icon: {i, href: "#relief-mount-1", x: (i % 100) * 10, y: Math.floor(i / 100) * 10, s: 8},
    tileIndex: i % 9
  }));
}

describe("draw-relief-icons geometry build benchmarks", () => {
  bench("buildSetMesh — 1,000 icons (NFR-P1 proxy)", () => {
    buildSetMeshBench(makeIcons(1000), "simple", null);
  });

  bench("buildSetMesh — 10,000 icons (NFR-P2 proxy)", () => {
    buildSetMeshBench(makeIcons(10000), "simple", null);
  });
});
```

> **Note:** This bench measures JS geometry construction only (Float32Array allocation + BufferGeometry setup). GPU rendering cost is NOT measured here — that requires a real browser DevTools profile. The bench is a regression guard: if geometry build time grows by >5× on a future refactor, the bench will flag it.

**Run bench:** `npx vitest bench src/renderers/draw-relief-icons.bench.ts`

**Three.js mock:** Add the same `vi.mock("three", () => { ... })` block from `webgl-layer-framework.test.ts`. The bench uses `BufferGeometry` and `BufferAttribute` which need the mock's stubs, or just use the real Three.js (no GPU needed for geometry).

> **Simplification:** Do NOT mock Three.js for the bench file. `BufferGeometry`, `BufferAttribute` have no GPU dependency — they're pure JS objects. Only `WebGLRenderer`, `Scene`, `OrthographicCamera` need mocking. The bench can import real Three.js and create real buffer geometries without any DOM/GPU.

### Manual Browser Measurement Protocol

Run `npm run dev` in a terminal. Open the app at `http://localhost:5173/Fantasy-Map-Generator/`.

**NFR-P5: init() time (<200ms)**

```javascript
// In browser console before map load:
const t0 = performance.now();
WebGL2LayerFramework.init();
console.log("init time:", performance.now() - t0, "ms");
```

**NFR-P1: drawRelief 1k icons (<16ms)**

```javascript
// Generate a small map, then:
const icons1k = pack.relief.slice(0, 1000);
const t0 = performance.now();
window.drawRelief("webGL", document.getElementById("terrain"));
requestAnimationFrame(() => console.log("drawRelief 1k:", performance.now() - t0, "ms"));
```

**NFR-P2: drawRelief 10k icons (<100ms)**

```javascript
const icons10k = pack.relief.slice(0, 10000);
// Repeat as above with 10k icons
```

**NFR-P3: setVisible toggle (<4ms)**

```javascript
const t0 = performance.now();
WebGL2LayerFramework.setVisible("terrain", false);
console.log("toggle:", performance.now() - t0, "ms");
```

**NFR-P4: Zoom latency (<8ms)**

- Open DevTools → Performance tab → Record
- Pan/zoom the map
- Measure time from D3 zoom event to last WebGL draw call in the flame graph
- Target: <8ms from event dispatch to `gl.drawArrays`

**NFR-P6: GPU state on hide**

- Open DevTools → Memory tab → GPU profiler (Chrome: `chrome://tracing` or Memory tab in DevTools)
- Call `WebGL2LayerFramework.setVisible('terrain', false)`
- Confirm texture and VBO memory sizes do NOT decrease
- Expected: `clearLayer()` is NOT called on `setVisible(false)` — GPU memory preserved

**SVG vs WebGL comparison (AC7)**

```javascript
// SVG path:
const s = performance.now();
window.drawRelief("svg", document.getElementById("terrain"));
console.log("SVG render:", performance.now() - s, "ms");

// WebGL path (after undrawing SVG):
window.undrawRelief();
const w = performance.now();
window.drawRelief("webGL", document.getElementById("terrain"));
requestAnimationFrame(() => console.log("WebGL render:", performance.now() - w, "ms"));
```

### Vitest Config Note

The existing `vitest.browser.config.ts` uses Playwright for browser tests. The bench file uses the default `vitest.config.ts` (node env). Three.js geometries (BufferGeometry, BufferAttribute) work in node without mocks — they're pure JS objects. No browser or mock needed for geometry benchmarks.

### NFR Reference

| NFR    | Threshold               | Measurement Method                                   |
| ------ | ----------------------- | ---------------------------------------------------- |
| NFR-P1 | <16ms for 1k icons      | `performance.now()` around `drawRelief()` + next RAF |
| NFR-P2 | <100ms for 10k icons    | Same as P1                                           |
| NFR-P3 | <4ms toggle             | `performance.now()` around `setVisible(false)`       |
| NFR-P4 | <8ms zoom latency       | DevTools Performance tab flame graph                 |
| NFR-P5 | <200ms init             | `performance.now()` around `framework.init()`        |
| NFR-P6 | No GPU teardown on hide | DevTools Memory / GPU profiler                       |

---

## Previous Story Intelligence

### From Story 2.2 (draw-relief-icons.ts refactor)

- `window.drawRelief("webGL")` → calls `loadTexture(set).then(() => { buildReliefScene(icons); WebGL2LayerFramework.requestRender(); })`
- `requestRender()` is RAF-coalesced: only one GPU draw per animation frame. Measurement must wait for the RAF callback.
- `window.undrawRelief()` → calls `WebGL2LayerFramework.clearLayer("terrain")` which calls `group.clear()` — does NOT dispose GPU resources (NFR-P6 compliant)
- `window.rerenderReliefIcons()` → single `WebGL2LayerFramework.requestRender()` call — this is the zoom path

### From Story 2.3 (fallback verification)

- `WebGL2LayerFramework.hasFallback` → true if WebGL2 unavailable; all methods are no-ops
- For benchmarking, ensure WebGL2 IS available (test on a supported browser)
- Test setup baseline: 43 unit tests passing, 88.51% statement coverage

### From Story 1.3 (lifecycle & render loop)

- `render()` method calls `syncTransform()` (updates camera bounds from D3 viewX/viewY/scale) then per-layer `render` callbacks then `renderer.render(scene, camera)`
- RAF ID is set on `requestRender()` call and cleared in the callback — coalescing is confirmed working
- `setVisible(id, false)` sets `group.visible = false` immediately — O(1) operation

---

## Tasks

- [ ] **T1:** Create `src/renderers/draw-relief-icons.bench.ts`
  - [ ] T1a: Implement standalone `buildSetMeshBench` mirroring production logic (avoids exporting from source)
  - [ ] T1b: Add `makeIcons(n)` helper to generate synthetic `ReliefIcon` entries
  - [ ] T1c: Add `bench("buildSetMesh — 1,000 icons")` and `bench("buildSetMesh — 10,000 icons")`
  - [ ] T1d: Run `npx vitest bench src/renderers/draw-relief-icons.bench.ts` — record results

- [ ] **T2:** Measure NFR-P5 (init time) in browser
  - [ ] Use `performance.now()` before/after `WebGL2LayerFramework.init()` call
  - [ ] Record: actual init time in ms → target <200ms

- [ ] **T3:** Measure NFR-P1 and NFR-P2 (render time) in browser
  - [ ] Run app with 1,000 icons → record `drawRelief()` time
  - [ ] Run app with 10,000 icons → record `drawRelief()` time
  - [ ] Use RAF-aware measurement (measure from call to next `requestAnimationFrame` callback)
  - [ ] Record: P1 actual (target <16ms), P2 actual (target <100ms)

- [ ] **T4:** Measure NFR-P3 (toggle time) in browser
  - [ ] Wrap `WebGL2LayerFramework.setVisible('terrain', false)` in `performance.now()`
  - [ ] Record: toggle time in ms → target <4ms

- [ ] **T5:** Measure NFR-P4 (zoom latency) in browser
  - [ ] Use DevTools Performance tab — capture pan/zoom interaction
  - [ ] Measure from D3 zoom event to WebGL draw call completion
  - [ ] Record: latency in ms → target <8ms

- [ ] **T6:** Verify NFR-P6 (GPU state preservation) in browser
  - [ ] After calling `setVisible(false)`, check DevTools Memory that textures/VBOs are NOT released
  - [ ] Structural verification: `clearLayer("terrain")` is NOT called on `setVisible()` (confirmed by code inspection of `webgl-layer-framework.ts` line 193)
  - [ ] Document: pass/fail with evidence

- [ ] **T7:** Measure SVG vs WebGL comparison (AC7)
  - [ ] Time `window.drawRelief("svg")` for 5,000+ icons
  - [ ] Time `window.drawRelief("webGL")` for same icon set
  - [ ] Calculate % reduction → target >80%

- [ ] **T8:** `npm run lint` — zero errors (bench file must be lint-clean)

- [ ] **T9:** `npx vitest run` — all 43 existing tests still pass (bench file must not break unit tests)

- [ ] **T10:** Document all results in Dev Agent Record completion notes:
  - [ ] Bench output (T1d)
  - [ ] Browser measurements for P1–P6 (T2–T6)
  - [ ] SVG vs WebGL comparison (T7)
  - [ ] Pass/fail verdict for each NFR

---

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

_Record actual measured timings for each NFR here:_

| NFR                   | Target         | Actual | Pass/Fail |
| --------------------- | -------------- | ------ | --------- |
| NFR-P1 (1k icons)     | <16ms          | _tbd_  | _tbd_     |
| NFR-P2 (10k icons)    | <100ms         | _tbd_  | _tbd_     |
| NFR-P3 (toggle)       | <4ms           | _tbd_  | _tbd_     |
| NFR-P4 (zoom latency) | <8ms           | _tbd_  | _tbd_     |
| NFR-P5 (init)         | <200ms         | _tbd_  | _tbd_     |
| NFR-P6 (GPU state)    | no teardown    | _tbd_  | _tbd_     |
| AC7 (SVG vs WebGL)    | >80% reduction | _tbd_  | _tbd_     |

### File List

_Files created/modified (to be filled by dev agent):_

- `src/renderers/draw-relief-icons.bench.ts` — NEW: geometry build benchmarks (vitest bench)
