# Story 2.2: Refactor draw-relief-icons.ts to Use Framework

**Status:** ready-for-dev
**Epic:** 2 — Relief Icons Layer Migration
**Story Key:** 2-2-refactor-draw-relief-icons-ts-to-use-framework
**Created:** 2026-03-12
**Developer:** _unassigned_

---

## Story

As a developer,
I want `draw-relief-icons.ts` refactored to register with `WebGL2LayerFramework` via `framework.register({ id: 'terrain', ... })` and remove its module-level `THREE.WebGLRenderer` state,
So that the framework owns the single shared WebGL context and the relief layer uses the framework's lifecycle API.

---

## Acceptance Criteria

**AC1:** Register with framework at module load time
**Given** `draw-relief-icons.ts` is refactored
**When** the module loads
**Then** `WebGL2LayerFramework.register({ id: 'terrain', anchorLayerId: 'terrain', renderOrder: ..., setup, render, dispose })` is called at module load time — before `init()` is ever called (safe via `pendingConfigs[]` queue)

**AC2:** No module-level renderer state
**Given** the framework takes ownership of the WebGL renderer
**When** `draw-relief-icons.ts` is inspected
**Then** no module-level `THREE.WebGLRenderer`, `THREE.Scene`, or `THREE.OrthographicCamera` instances exist in the module

**AC3:** `drawRelief()` WebGL path
**Given** `window.drawRelief()` is called (WebGL path)
**When** execution runs
**Then** `buildReliefScene(icons, group)` adds `Mesh` objects to the framework-managed group and calls `WebGL2LayerFramework.requestRender()` — no renderer setup or context creation occurs

**AC4:** `undrawRelief()` calls `clearLayer()`
**Given** `window.undrawRelief()` is called
**When** execution runs
**Then** `WebGL2LayerFramework.clearLayer('terrain')` is called (wipes group geometry only), SVG terrain `innerHTML` is cleared, and `renderer.dispose()` is NOT called

**AC5:** `rerenderReliefIcons()` delegates to framework
**Given** `window.rerenderReliefIcons()` is called
**When** execution runs
**Then** it calls `WebGL2LayerFramework.requestRender()` — RAF-coalesced, no redundant draws

**AC6:** SVG fallback path is preserved
**Given** `window.drawRelief(type, parentEl)` is called with `type = 'svg'` or when `hasFallback === true`
**When** execution runs
**Then** `drawSvg(icons, parentEl)` is called (existing SVG renderer), WebGL path is bypassed entirely

**AC7:** Lint and tests pass
**Given** the refactored module is complete
**When** `npm run lint` and `npx vitest run` are executed
**Then** zero linting errors and all 34 existing tests pass

**AC8:** Performance
**Given** relief icons are rendered on a map with 1,000 terrain cells
**When** measuring render time
**Then** initial render completes in <16ms (NFR-P1)

---

## Context

### Prerequisites

- **Story 2.1 must be complete.** The `buildSetMesh` function has been verified (rotation verification comment added). Any interface changes to `ReliefIcon` from Story 2.1 (if rotation field was added) are already in place.
- **Epic 1 (Stories 1.1–1.3) is complete.** `WebGL2LayerFramework` is at `src/modules/webgl-layer-framework.ts` with all public methods implemented:
  - `register(config)` — safe before `init()` (queues via `pendingConfigs[]`)
  - `clearLayer(id)` — calls `group.clear()`, does NOT call `renderer.dispose()`
  - `requestRender()` — RAF-coalesced
  - `setVisible(id, bool)` — toggles `group.visible`
  - `hasFallback: boolean` — getter; true when WebGL2 unavailable
  - `unregister(id)` — full cleanup with `dispose()` callback
- **Framework global** `window.WebGL2LayerFramework` is registered at bottom of `webgl-layer-framework.ts`.

### Current State of `draw-relief-icons.ts`

The file currently:

1. Uses `import * as THREE from "three"` — must change to named imports (NFR-B1)
2. Has module-level state: `glCanvas`, `renderer`, `camera`, `scene`, `textureCache`, `lastBuiltIcons`, `lastBuiltSet`
3. Has functions: `preloadTextures()`, `loadTexture()`, `ensureRenderer()`, `resolveSprite()`, `buildSetMesh()`, `disposeTextureCache()`, `disposeScene()`, `buildScene()`, `renderFrame()`
4. Has window globals: `window.drawRelief`, `window.undrawRelief`, `window.rerenderReliefIcons`
5. Has a module-level RAF coalescing variable `rafId` and `window.rerenderReliefIcons`

### Files to Touch

| File                                        | Change                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| `src/renderers/draw-relief-icons.ts`        | Major refactor — see Dev Notes for complete rewrite strategy |
| `src/modules/webgl-layer-framework.ts`      | No changes expected. Read-only reference.                    |
| `src/modules/webgl-layer-framework.test.ts` | No changes for this story. Story 2.3 adds fallback tests.    |

### Architecture Authority

Source of truth for this refactor:

- [Source: `_bmad-output/planning-artifacts/architecture.md#5.4 draw-relief-icons.ts Refactored Structure`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.2: Refactor draw-relief-icons.ts to Use Framework`]

---

## Dev Notes

### Key Mental Model: What Changes, What Stays

| What to REMOVE                               | What to KEEP                           | What to ADD                                                         |
| -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| Module-level `renderer` variable             | `textureCache` Map                     | `WebGL2LayerFramework.register({...})` call                         |
| Module-level `camera` variable               | `loadTexture()` function               | `buildReliefScene(icons, group)` function                           |
| Module-level `scene` variable                | `preloadTextures()` function           | Registration config with `setup`, `render`, `dispose` callbacks     |
| Module-level `glCanvas` variable             | `resolveSprite()` function             | Use `WebGL2LayerFramework.clearLayer('terrain')` in `undrawRelief`  |
| `ensureRenderer()` function                  | `buildSetMesh()` function              | Use `WebGL2LayerFramework.requestRender()` in `rerenderReliefIcons` |
| `disposeScene()` function                    | `drawSvg()` function                   | Use `WebGL2LayerFramework.hasFallback` in `drawRelief`              |
| `renderFrame()` function                     | `disposeTextureCache()` function       |                                                                     |
| `import * as THREE from "three"`             | Window globals declaration             | Use named Three.js imports                                          |
| Module-level `rafId` for rerenderReliefIcons | `lastBuiltIcons`, `lastBuiltSet` cache |                                                                     |

### Registration Call (at Module Load Time)

Place this call **before** any window global assignments — at module scope, so it runs when the module is imported:

```typescript
WebGL2LayerFramework.register({
  id: "terrain",
  anchorLayerId: "terrain",
  renderOrder: getLayerZIndex("terrain"), // imported from webgl-layer-framework
  setup(group: Group): void {
    // Called once by framework after init(). Relief geometry is built lazily
    // when window.drawRelief() is called — nothing to do here.
  },
  render(group: Group): void {
    // Called each frame by framework. Relief geometry is static between
    // drawRelief() calls — no per-frame CPU updates required (no-op).
  },
  dispose(group: Group): void {
    group.traverse(obj => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        (obj.material as MeshBasicMaterial).map?.dispose();
        (obj.material as MeshBasicMaterial).dispose();
      }
    });
    disposeTextureCache();
  }
});
```

**Why `renderOrder: getLayerZIndex("terrain")`:** `getLayerZIndex` is exported from `webgl-layer-framework.ts`. In MVP, `#terrain` is a `<g>` inside `<svg#map>`, not a sibling of `#map-container`, so this returns the fallback value `2`. This is correct and expected for MVP (see Decision 3 in architecture).

**Import `getLayerZIndex` and `Group`, `Mesh`, `MeshBasicMaterial`:**

```typescript
import {getLayerZIndex} from "../modules/webgl-layer-framework";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader
} from "three";
```

### Refactored `buildReliefScene(icons, group)`

Replace the current `buildScene(icons)` which adds to `scene` directly:

```typescript
// Module-level group reference — set when framework delivers the group to setup()
// BUT: because setup() is called by framework (once per init), and drawRelief() can
// be called any time after, we need to track the framework-owned group.
// Store it at module scope when setup() runs, OR retrieve it via the group returned
// from setup's argument. Use a module-level variable for simplicity:
let terrainGroup: Group | null = null;

// In the register() setup callback, capture the group:
setup(group: Group): void {
  terrainGroup = group;  // save reference so drawRelief() can add meshes to it
},
```

Then `buildReliefScene` becomes:

```typescript
function buildReliefScene(icons: ReliefIcon[]): void {
  if (!terrainGroup) return;
  // Clear previously built geometry without destroying GPU buffers
  // (framework's clearLayer does this, but we can also call group.clear() directly here
  //  since we have a direct reference — equivalent to framework.clearLayer('terrain'))
  terrainGroup.clear();

  const bySet = new Map<string, Array<{icon: ReliefIcon; tileIndex: number}>>();
  for (const r of icons) {
    const {set, tileIndex} = resolveSprite(r.href);
    const arr = bySet.get(set) ?? [];
    bySet.set(set, arr);
    arr.push({icon: r, tileIndex});
  }

  for (const [set, setEntries] of bySet) {
    const texture = textureCache.get(set);
    if (!texture) continue;
    terrainGroup.add(buildSetMesh(setEntries, set, texture));
  }
}
```

### Refactored Window Globals

```typescript
window.drawRelief = (type: "svg" | "webGL" = "webGL", parentEl: HTMLElement | undefined = byId("terrain")): void => {
  if (!parentEl) throw new Error("Relief: parent element not found");

  parentEl.innerHTML = "";
  parentEl.dataset.mode = type;

  const icons = pack.relief?.length ? pack.relief : generateRelief();
  if (!icons.length) return;

  if (type === "svg" || WebGL2LayerFramework.hasFallback) {
    drawSvg(icons, parentEl);
  } else {
    const set = parentEl.getAttribute("set") || "simple";
    loadTexture(set).then(() => {
      if (icons !== lastBuiltIcons || set !== lastBuiltSet) {
        buildReliefScene(icons);
        lastBuiltIcons = icons;
        lastBuiltSet = set;
      }
      WebGL2LayerFramework.requestRender();
    });
  }
};

window.undrawRelief = (): void => {
  // Clear framework-managed group geometry (does NOT dispose GPU/renderer state — NFR-P6)
  WebGL2LayerFramework.clearLayer("terrain");
  // Also clear SVG fallback content
  const terrainEl = byId("terrain");
  if (terrainEl) terrainEl.innerHTML = "";
};

window.rerenderReliefIcons = (): void => {
  // Delegates RAF coalescing to the framework (framework handles the rafId internally)
  WebGL2LayerFramework.requestRender();
};
```

### `loadTexture` — Anisotropy Change

The current `loadTexture` sets:

```typescript
if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

After the refactor, there is no module-level `renderer`. You can either:

1. **Drop anisotropy** (safe for MVP — `LinearMipmapLinearFilter` already handles quality)
2. **Defaulting to a fixed anisotropy value** e.g. `texture.anisotropy = 4`

Recommended: use option 1 (drop the line) and add a comment:

```typescript
// renderer.capabilities.getMaxAnisotropy() removed: renderer is now owned by
// WebGL2LayerFramework. LinearMipmapLinearFilter provides sufficient quality.
```

### Three.js Named Imports (NFR-B1 Critical)

Replace `import * as THREE from "three"` at the top of the file with named imports only:

```typescript
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  TextureLoader
} from "three";
```

Then update ALL usages replacing `THREE.X` with just `X` (they're now directly imported):

- `new THREE.TextureLoader()` → `new TextureLoader()`
- `texture.colorSpace = THREE.SRGBColorSpace` → `texture.colorSpace = SRGBColorSpace`
- `texture.minFilter = THREE.LinearMipmapLinearFilter` → `texture.minFilter = LinearMipmapLinearFilter`
- `texture.magFilter = THREE.LinearFilter` → `texture.magFilter = LinearFilter`
- `new THREE.BufferGeometry()` → `new BufferGeometry()`
- `new THREE.BufferAttribute(...)` → `new BufferAttribute(...)`
- `new THREE.MeshBasicMaterial({...})` → `new MeshBasicMaterial({...})`
- `side: THREE.DoubleSide` → `side: DoubleSide`
- `new THREE.Mesh(geo, mat)` → `new Mesh(geo, mat)`
- `obj instanceof THREE.Mesh` → `obj instanceof Mesh`

### Lint Rules

The project uses Biome for linting. Key rules that trip up Three.js code:

- `Number.isNaN()` not `isNaN()`
- `parseInt(str, 10)` (radix required)
- Named imports only (no `import * as THREE`) — this change satisfies that rule
- No unused variables: remove all module-level state variables that were tied to the deleted functions

### `getLayerZIndex` Import

`getLayerZIndex` is exported from `src/modules/webgl-layer-framework.ts`. Import it:

```typescript
import {getLayerZIndex} from "../modules/webgl-layer-framework";
```

### Context Loss Handling (OPTIONAL — Deferred)

The current `ensureRenderer()` handles WebGL context loss by recreating the renderer. After the refactor, context loss recovery is the framework's responsibility (the framework already handles it via `renderer.forceContextRestore()`). You can safely remove the context-loss branch from the module. If needed in a future story, it can be handled in the framework's `init()` re-call path.

### Global `pack` Object

`pack.relief` is a legacy window global from the pre-TypeScript JS codebase. It is accessed as `(globalThis as any).pack.relief` or just `pack.relief` (because `pack` is globally declared elsewhere in the app). The TypeScript declaration for `pack` already exists in `src/types/global.ts` — do not redeclare it.

### Module-Level Group Reference Pattern

The cleanest approach for connecting `setup(group)` to `drawRelief()`:

```typescript
// Module-level reference to the framework-owned Group for the terrain layer.
// Set once in the register() setup callback; used by buildReliefScene().
let terrainGroup: Group | null = null;
```

This is set in the `setup` callback passed to `register()`, which the framework calls once during `init()` (or processes from the pendingConfigs queue during `init()`).

### Complete File Skeleton

```typescript
// Imports
import { getLayerZIndex } from "../modules/webgl-layer-framework";
import {
  BufferAttribute, BufferGeometry, DoubleSide, Group,
  LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial,
  SRGBColorSpace, TextureLoader,
} from "three";
import { RELIEF_SYMBOLS } from "../config/relief-config";
import type { ReliefIcon } from "../modules/relief-generator";
import { generateRelief } from "../modules/relief-generator";
import { byId } from "../utils";

// Module state (framework-delegated; no renderer/scene/camera here)
const textureCache = new Map<string, THREE.Texture>();
let terrainGroup: Group | null = null;
let lastBuiltIcons: ReliefIcon[] | null = null;
let lastBuiltSet: string | null = null;

// Register with framework at module load (before init() — safe via pendingConfigs[])
WebGL2LayerFramework.register({ ... });

// Texture management
function preloadTextures(): void { ... }
function loadTexture(set: string): Promise<Texture | null> { ... }
// Remove: ensureRenderer(), disposeScene(), renderFrame()

// Relief mesh construction
function resolveSprite(symbolHref: string): { set: string; tileIndex: number } { ... }
function buildSetMesh(...): Mesh { ... }  // unchanged from Story 2.1
function buildReliefScene(icons: ReliefIcon[]): void { ... }  // NEW: uses terrainGroup

// SVG fallback
function drawSvg(icons: ReliefIcon[], parentEl: HTMLElement): void { ... }  // unchanged

function disposeTextureCache(): void { ... }  // unchanged

// Window globals
window.drawRelief = (...) => { ... };
window.undrawRelief = () => { ... };
window.rerenderReliefIcons = () => { ... };

declare global {
  var drawRelief: (type?: "svg" | "webGL", parentEl?: HTMLElement) => void;
  var undrawRelief: () => void;
  var rerenderReliefIcons: () => void;
}
```

---

## Previous Story Intelligence

### From Story 1.3 (Framework Complete)

- `group.clear()` removes all `Mesh` children from the group without calling `.dispose()` — exactly what `clearLayer()` uses. Confirmed safe for GPU preservation.
- `requestRender()` is RAF-coalesced. Multiple rapid calls within one animation frame → single GPU draw. NO need for a separate `rafId` in `draw-relief-icons.ts`.
- `pendingConfigs[]` queue: `register()` called before `init()` is explicitly safe. The framework stores the config and processes it in `init()`. Module load order is intentionally decoupled.
- `syncTransform()` reads `globalThis.viewX/viewY/scale/graphWidth/graphHeight` — the same globals `renderFrame()` previously read. No change in coordinate handling; the framework handles it.
- `hasFallback` getter exposed on `window.WebGL2LayerFramework`. Check it to route to SVG path.

### From Story 2.1 (Rotation Verification)

- `r.i` is a sequential index, NOT a rotation angle. No rotation transformation needed in `buildSetMesh`.
- The `buildSetMesh` function is essentially correct for MVP. Keep it as-is after Story 2.1's comment was added.
- `drawSvg` format: `<use href="${r.href}" data-id="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}"/>` — this is correct and unchanged.

---

## References

- Framework API: [src/modules/webgl-layer-framework.ts](../../../src/modules/webgl-layer-framework.ts)
- Architecture refactored structure: [Source: `_bmad-output/planning-artifacts/architecture.md#5.4`]
- Epic story AC: [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.2`]
- NFR-B1 (named imports): [Source: `_bmad-output/planning-artifacts/epics.md#NonFunctional Requirements`]
- NFR-P1 (<16ms, 1000 icons): [Source: `_bmad-output/planning-artifacts/epics.md#NonFunctional Requirements`]
- NFR-P6 (no GPU teardown on hide/clear): [Source: `_bmad-output/planning-artifacts/architecture.md#Decision 5`]

---

## Tasks

- [ ] **T1:** Update Three.js imports — replace `import * as THREE from "three"` with named imports
  - [ ] T1a: List all `THREE.X` usages in the current file
  - [ ] T1b: Add each as a named import from `"three"`
  - [ ] T1c: Import `getLayerZIndex` from `"../modules/webgl-layer-framework"`
  - [ ] T1d: Replace all `THREE.X` references with bare `X` names

- [ ] **T2:** Remove module-level renderer state
  - [ ] T2a: Remove `glCanvas`, `renderer`, `camera`, `scene` variable declarations
  - [ ] T2b: Remove `ensureRenderer()` function entirely
  - [ ] T2c: Remove `disposeScene()` function entirely
  - [ ] T2d: Remove `renderFrame()` function entirely
  - [ ] T2e: Remove module-level `rafId` variable (used by old `rerenderReliefIcons`)

- [ ] **T3:** Add `terrainGroup` module-level variable and `register()` call
  - [ ] T3a: Add `let terrainGroup: Group | null = null;`
  - [ ] T3b: Add `WebGL2LayerFramework.register({...})` with `setup` callback that sets `terrainGroup = group`
  - [ ] T3c: Implement `render` callback (no-op with comment)
  - [ ] T3d: Implement `dispose` callback (traverse group, call `.geometry.dispose()`, `.material.dispose()`, `.map?.dispose()`, then `disposeTextureCache()`)

- [ ] **T4:** Refactor `buildScene()` → `buildReliefScene(icons)`
  - [ ] T4a: Rename function to `buildReliefScene`
  - [ ] T4b: Replace `if (!scene) return` guard with `if (!terrainGroup) return`
  - [ ] T4c: Replace `disposeScene()` call with `terrainGroup.clear()`
  - [ ] T4d: Replace `scene.add(buildSetMesh(...))` with `terrainGroup.add(buildSetMesh(...))`

- [ ] **T5:** Remove anisotropy line from `loadTexture()` (renderer no longer accessible)
  - [ ] Add comment explaining removal

- [ ] **T6:** Refactor `window.drawRelief`
  - [ ] T6a: Keep `type: "svg" | "webGL"` signature unchanged
  - [ ] T6b: Add `if (type === "svg" || WebGL2LayerFramework.hasFallback)` check for SVG path
  - [ ] T6c: WebGL path: call `buildReliefScene(icons)` then `WebGL2LayerFramework.requestRender()`

- [ ] **T7:** Refactor `window.undrawRelief`
  - [ ] T7a: Replace `disposeScene()` + `renderer.dispose()` + `glCanvas.remove()` sequence with `WebGL2LayerFramework.clearLayer("terrain")`
  - [ ] T7b: Keep `terrainEl.innerHTML = ""` for SVG fallback cleanup

- [ ] **T8:** Refactor `window.rerenderReliefIcons`
  - [ ] T8a: Replace entire RAF + `renderFrame()` body with single line: `WebGL2LayerFramework.requestRender()`

- [ ] **T9:** `npm run lint` — zero errors; fix any `import * as THREE` or unused variable warnings

- [ ] **T10:** `npx vitest run src/modules/webgl-layer-framework.test.ts` — all 34 tests pass (existing framework tests should be unaffected by this renderer refactor)

- [ ] **T11:** Manual smoke test (optional but recommended)
  - [ ] T11a: Load the app in browser; generate a map; confirm relief icons render
  - [ ] T11b: Toggle terrain layer off/on in the Layers panel — no crash, icons reappear
  - [ ] T11c: Pan/zoom — icons track correctly
  - [ ] T11d: Measure `drawRelief()` render time via `performance.now()` for 1,000 icons: confirm <16ms target

---

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List

_Files modified (to be filled by dev agent):_

- `src/renderers/draw-relief-icons.ts` — major refactor: named imports, removed module-level state, registered with framework, refactored window globals
