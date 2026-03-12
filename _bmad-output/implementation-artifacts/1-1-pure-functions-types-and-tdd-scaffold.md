# Story 1.1: Pure Functions, Types, and TDD Scaffold

Status: review

## Story

As a developer,
I want `buildCameraBounds`, `detectWebGL2`, and `getLayerZIndex` implemented as named-exported pure functions with full Vitest coverage,
So that coordinate sync and WebGL detection logic are verified in isolation before the class is wired up.

## Acceptance Criteria

1. **Given** the file `src/modules/webgl-layer-framework.ts` does not yet exist  
   **When** the developer creates it with `WebGLLayerConfig` interface, `RegisteredLayer` interface, and the three pure exported functions  
   **Then** the file compiles with zero TypeScript errors and `npm run lint` passes

2. **Given** `buildCameraBounds(viewX, viewY, scale, graphWidth, graphHeight)` is implemented  
   **When** called with identity transform `(0, 0, 1, 960, 540)`  
   **Then** it returns `{left: 0, right: 960, top: 0, bottom: 540}` and `top < bottom` (Y-down convention)

3. **Given** `buildCameraBounds` is called with `(0, 0, 2, 960, 540)` (2× zoom)  
   **When** asserting bounds  
   **Then** `right === 480` and `bottom === 270` (viewport shows half the map)

4. **Given** `buildCameraBounds` is called with `(-100, -50, 1, 960, 540)` (panned right/down)  
   **When** asserting bounds  
   **Then** `left === 100` and `top === 50`

5. **Given** `buildCameraBounds` is called with extreme zoom values `(0.1)` and `(50)`  
   **When** asserting results  
   **Then** all returned values are finite (no `NaN` or `Infinity`)

6. **Given** a mock canvas where `getContext('webgl2')` returns `null`  
   **When** `detectWebGL2(mockCanvas)` is called  
   **Then** it returns `false`

7. **Given** a mock canvas where `getContext('webgl2')` returns a mock context object  
   **When** `detectWebGL2(mockCanvas)` is called  
   **Then** it returns `true`

8. **Given** `getLayerZIndex('terrain')` is called  
   **When** the `#terrain` element is not present in the DOM  
   **Then** it returns `2` (safe fallback)

9. **Given** a Vitest test file `src/modules/webgl-layer-framework.test.ts` exists  
   **When** `npx vitest run` is executed  
   **Then** all tests in this file pass and coverage for pure functions is 100%

## Tasks / Subtasks

- [x] Task 1: Create `src/modules/webgl-layer-framework.ts` with types, interfaces, and pure functions (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] 1.1 Define and export `WebGLLayerConfig` interface
  - [x] 1.2 Define `RegisteredLayer` interface (not exported — internal use only in later stories)
  - [x] 1.3 Implement and export `buildCameraBounds` pure function with formula derivation comment
  - [x] 1.4 Implement and export `detectWebGL2` pure function with injectable probe canvas
  - [x] 1.5 Implement and export `getLayerZIndex` pure function with DOM-position lookup and fallback=2
  - [x] 1.6 Add stub/scaffold `WebGL2LayerFrameworkClass` class (private fields declared, no method bodies yet — methods throw `Error("not implemented")` or are left as stubs)
  - [x] 1.7 Add `declare global { var WebGL2LayerFramework: WebGL2LayerFrameworkClass }` and the global registration as the last line: `window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass()`
  - [x] 1.8 Add global type declarations to `src/types/global.ts` for `WebGL2LayerFramework`, `drawRelief`, `undrawRelief`, `rerenderReliefIcons`
  - [x] 1.9 Add side-effect import to `src/modules/index.ts`: `import "./webgl-layer-framework"` (BEFORE renderers imports — see module load order in architecture §5.6)

- [x] Task 2: Create `src/modules/webgl-layer-framework.test.ts` with full Vitest test suite (AC: 9)
  - [x] 2.1 Add `buildCameraBounds` describe block with all 5 test cases (identity, 2× zoom, pan offset, Y-down assertion, extreme zoom)
  - [x] 2.2 Add `detectWebGL2` describe block with 2 test cases (null context, mock context)
  - [x] 2.3 Add `getLayerZIndex` describe block (no DOM — returns fallback of 2)
  - [x] 2.4 Add `WebGL2LayerFrameworkClass` describe block with stub-based tests for: pending queue, setVisible no-dispose, RAF coalescing, clearLayer preserves registration, hasFallback default

- [x] Task 3: Validate (AC: 1, 9)
  - [x] 3.1 Run `npm run lint` — zero errors
  - [x] 3.2 Run `npx vitest run src/modules/webgl-layer-framework.test.ts` — all tests pass

## Dev Notes

### Scope for This Story

**Story 1.1 covers only:**

- The file scaffold (types, interfaces, pure functions, class stub + global registration)
- Test file for pure functions and stub-level class tests

**Story 1.2 will add:** Full `init()` implementation — DOM wrapping of `#map`, canvas creation, `THREE.WebGLRenderer`, ResizeObserver, D3 zoom subscription.

**Story 1.3 will add:** Full implementation of `register()`, `setVisible()`, `clearLayer()`, `requestRender()`, `render()`, `syncTransform()`.

The class scaffold created in this story must declare all private fields so Stories 1.2 and 1.3 can implement method bodies against them without structural changes. Use `private fieldName: type | null = null` patterns so TypeScript is satisfied without real initialization.

### File to Create: `src/modules/webgl-layer-framework.ts`

**Full internal structure (from [architecture.md §5.3](_bmad-output/planning-artifacts/architecture.md)):**

```typescript
import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  Group,
  Mesh
} from "three";
// Note: Import only what this story needs now; additional Three.js classes will be
// added in Stories 1.2 and 1.3. Never use `import * as THREE from "three"` — always
// named imports (NFR-B1). Biome's noRestrictedImports may enforce this.

// ─── Exports (for testability) ───────────────────────────────────────────────
export function buildCameraBounds(...) { ... }
export function detectWebGL2(...) { ... }
export function getLayerZIndex(...) { ... }

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface WebGLLayerConfig { ... }
interface RegisteredLayer { ... }  // internal only — NOT exported

// ─── Class ───────────────────────────────────────────────────────────────────
export class WebGL2LayerFrameworkClass { ... }

// ─── Global registration (MUST be last line) ─────────────────────────────────
declare global {
  var WebGL2LayerFramework: WebGL2LayerFrameworkClass;
}
window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass();
```

### `buildCameraBounds` — Formula and Implementation

**From [architecture.md §Decision 4](_bmad-output/planning-artifacts/architecture.md):**

D3 applies `transform: translate(viewX, viewY) scale(scale)` to `#viewbox`. Inverting:

```
left   = -viewX / scale
right  = (graphWidth - viewX) / scale
top    = -viewY / scale
bottom = (graphHeight - viewY) / scale
```

`top < bottom` because SVG Y-axis points downward. This is the correct Three.js Y-down configuration — **do NOT swap or negate**.

```typescript
/**
 * Converts a D3 zoom transform into orthographic camera bounds.
 *
 * D3 applies: screen = map * scale + (viewX, viewY)
 * Inverting:  map = (screen - (viewX, viewY)) / scale
 *
 * Orthographic bounds (visible map region at current zoom/pan):
 *   left   = -viewX / scale
 *   right  = (graphWidth  - viewX) / scale
 *   top    = -viewY / scale
 *   bottom = (graphHeight - viewY) / scale
 *
 * top < bottom: Y-down matches SVG; origin at top-left of map.
 * Do NOT swap top/bottom or negate — this is correct Three.js Y-down config.
 */
export function buildCameraBounds(
  viewX: number,
  viewY: number,
  scale: number,
  graphWidth: number,
  graphHeight: number
): {left: number; right: number; top: number; bottom: number} {
  return {
    left: -viewX / scale,
    right: (graphWidth - viewX) / scale,
    top: -viewY / scale,
    bottom: (graphHeight - viewY) / scale
  };
}
```

### `detectWebGL2` — Implementation

Must accept an optional injectable `probe` canvas for testability (avoids DOM access in tests):

```typescript
export function detectWebGL2(probe?: HTMLCanvasElement): boolean {
  const canvas = probe ?? document.createElement("canvas");
  const ctx = canvas.getContext("webgl2");
  if (!ctx) return false;
  const ext = ctx.getExtension("WEBGL_lose_context");
  ext?.loseContext(); // immediately return the context to the browser
  return true;
}
```

The `ext?.loseContext()` call releases the probe context immediately, preventing context leaks during testing/init. The `WEBGL_lose_context` extension may not be available in all browsers; optional-chain is the correct guard.

### `getLayerZIndex` — Implementation

Phase-2-ready but MVP-safe: returns the DOM sibling index of the anchor element (offset by 1), or 2 as a safe fallback when the element is not found. In MVP this always returns 2 because `#terrain` is a `<g>` inside `<svg#map>` — not a direct sibling of `#map-container` — so DOM lookup returns the element but `parentElement?.children` gives SVG group siblings, not container-level siblings.

```typescript
export function getLayerZIndex(anchorLayerId: string): number {
  const anchor = document.getElementById(anchorLayerId);
  if (!anchor) return 2;
  const siblings = Array.from(anchor.parentElement?.children ?? []);
  const idx = siblings.indexOf(anchor);
  // idx + 1 so Phase 2 callers get correct interleaving; in MVP always resolves to 2
  return idx > 0 ? idx + 1 : 2;
}
```

### Class Scaffold — Private Fields Required in `WebGL2LayerFrameworkClass`

These fields must be declared now (even as `| null = null`) so Stories 1.2 and 1.3 can implement against them without structural conflicts. Story 1.1 does NOT implement method bodies — leave methods as stubs:

```typescript
export class WebGL2LayerFrameworkClass {
  // Private state
  private canvas: HTMLCanvasElement | null = null;
  private renderer: WebGLRenderer | null = null;
  private camera: OrthographicCamera | null = null;
  private scene: Scene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private pendingConfigs: WebGLLayerConfig[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private container: HTMLElement | null = null;
  private _fallback = false; // MUST be private backing field, NOT readonly — set in init()

  get hasFallback(): boolean {
    return this._fallback;
  }

  // Public API — stub implementations for this story; full bodies in Stories 1.2 & 1.3
  init(): boolean {
    return false;
  }
  register(_config: WebGLLayerConfig): void {
    this.pendingConfigs.push(_config);
  }
  unregister(_id: string): void {
    /* Story 1.3 */
  }
  setVisible(_id: string, _visible: boolean): void {
    /* Story 1.3 */
  }
  clearLayer(_id: string): void {
    /* Story 1.3 */
  }
  requestRender(): void {
    /* Story 1.3 */
  }
  syncTransform(): void {
    /* Story 1.3 */
  }
  private render(): void {
    /* Story 1.3 */
  }
}
```

**CRITICAL:** `_fallback` must be the private backing field pattern, NOT `readonly hasFallback: boolean = false`. TypeScript `readonly` fields can only be assigned in the constructor; `init()` sets `_fallback` post-construction, which would produce a type error with `readonly`. See [architecture.md §Decision 6](_bmad-output/planning-artifacts/architecture.md).

**For the class-level tests in Story 1.1**, the stub implementations above are enough: `register()` pushes to `pendingConfigs`, `requestRender()` can be left as a stub but the test injects `scene` and `layers` directly via `(framework as any).fieldName` to test the stubs.

### `WebGLLayerConfig` Interface

```typescript
export interface WebGLLayerConfig {
  id: string;
  anchorLayerId: string; // SVG <g> id; canvas id derived as `${id}Canvas`
  renderOrder: number; // Three.js renderOrder for this layer's Group
  setup: (group: Group) => void; // called once after WebGL2 confirmed; add meshes to group
  render: (group: Group) => void; // called each frame before renderer.render(); update uniforms/geometry
  dispose: (group: Group) => void; // called on unregister(); dispose all GPU objects in group
}
```

Note: Use `Group` from Three.js named imports — not `THREE.Group` (no `import * as THREE`).

### `RegisteredLayer` Interface (internal, NOT exported)

```typescript
interface RegisteredLayer {
  config: WebGLLayerConfig;
  group: Group; // framework-owned; passed to all callbacks — abstraction boundary
}
```

### Global Type Declarations to Add in `src/types/global.ts`

Add to the `declare global {}` block in the existing file ([src/types/global.ts](src/types/global.ts)):

```typescript
var WebGL2LayerFramework: import("../modules/webgl-layer-framework").WebGL2LayerFrameworkClass;
var drawRelief: (type?: "svg" | "webGL", parentEl?: HTMLElement) => void;
var undrawRelief: () => void;
var rerenderReliefIcons: () => void;
```

### Module Import Order in `src/modules/index.ts`

Add `import "./webgl-layer-framework"` **before** any renderer imports. The architecture specifies the framework must be registered on `window` before `draw-relief-icons.ts` loads and calls `WebGL2LayerFramework.register()`. Since `src/renderers/index.ts` is a separate file, and modules are evaluated in import order, the framework module just needs to be in `src/modules/index.ts`. The renderers index imports the framework module after modules:

Current `src/modules/index.ts` ends at `import "./zones-generator"`. Add the framework import at the **end of the modules list**, before the file ends. This is safe because the framework has no dependency on other modules, and `draw-relief-icons.ts` (renderer) is in `src/renderers/index.ts` which loads after modules.

### Test File: `src/modules/webgl-layer-framework.test.ts`

The architecture document (§4.6) provides the exact test patterns to use. Key points for the Vitest test file:

**Imports:**

```typescript
import {describe, it, expect, vi, beforeEach} from "vitest";
import {buildCameraBounds, detectWebGL2, getLayerZIndex, WebGL2LayerFrameworkClass} from "./webgl-layer-framework";
```

**For class-level tests**, inject stubs using `(framework as any).fieldName`:

- `scene = { add: vi.fn() }` to simulate init-complete state
- `layers = new Map()` already initialized by constructor
- `canvas = { style: { display: "block" } }` for setVisible tests
- `renderer = { render: vi.fn() }` for requestRender tests

**RAF coalescing test** — use `vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1 as any)`. Since `requestRender()` is a stub in this story (Story 1.3 implements it), the test for RAF coalescing should use the stub injection approach OR defer to Story 1.3 once the method is implemented. Include a placeholder test that confirms `requestRender()` doesn't throw until Story 1.3 fills in the body.

**getLayerZIndex DOM test** — since Vitest runs in Node (not browser) by default, `document.getElementById()` returns `null`, so the fallback path (`return 2`) is always hit. This is intentional and tests the no-DOM path correctly.

### Three.js Import Constraint (NFR-B1)

**NEVER** use `import * as THREE from "three"`. All Three.js imports must be named:

```typescript
import {WebGLRenderer, Scene, OrthographicCamera, Group, Mesh} from "three";
```

For Story 1.1, only `Group` is needed in the interface type. Import it as a named import. Do not import the full renderer/scene/camera yet (they'll be added in Stories 1.2 and 1.3 when the methods are implemented).

However, TypeScript will need the type to be resolved at compile time. Import `Group` as a type import to avoid runtime loading if not used in this story:

```typescript
import type {Group} from "three";
```

When the interface is used as a value (setup/render/dispose callbacks), `import type` is fine since it's erased at compile time.

### Lint Rules to Watch

From [project-context.md](project-context.md):

- `Number.isNaN()` not `isNaN()` — no occurrences expected in this story
- `parseInt(str, 10)` — no occurrences expected
- No unused imports (error level) — do not leave unused Three.js imports
- Template literals over string concatenation
- `strict` mode: `noUnusedLocals`, `noUnusedParameters` are enabled — stub method parameters like `_config`, `_id`, `_visible` must be prefixed with `_` to suppress unused parameter errors

### Project Structure Notes

- **New file:** `src/modules/webgl-layer-framework.ts` — follows Global Module Pattern
- **New file:** `src/modules/webgl-layer-framework.test.ts` — co-located unit test (Vitest)
- **Modified:** `src/modules/index.ts` — add side-effect import
- **Modified:** `src/types/global.ts` — add global type declarations

No changes to `public/modules/` or any legacy JS files.

### References

- [architecture.md §2 Technology Stack](_bmad-output/planning-artifacts/architecture.md)
- [architecture.md §3 Core Architectural Decisions §Decision 1-7](_bmad-output/planning-artifacts/architecture.md)
- [architecture.md §4.1 Global Module Pattern](_bmad-output/planning-artifacts/architecture.md)
- [architecture.md §4.6 Test Patterns](_bmad-output/planning-artifacts/architecture.md) — contains exact test code
- [architecture.md §5.1-5.3 Project Structure & Internal Structure](_bmad-output/planning-artifacts/architecture.md)
- [project-context.md §Language-Specific Rules](project-context.md)
- [project-context.md §Naming Conventions](project-context.md)
- [epics.md §Story 1.1 Acceptance Criteria](_bmad-output/planning-artifacts/epics.md) — exact ACs with BDD format

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (GitHub Copilot)

### Debug Log References

- Vitest `toBe(0)` on `buildCameraBounds` identity transform failed due to IEEE 754 `-0` vs `+0`: unary negation `-viewX` with `viewX=0` yields `-0`; fixed by using `(0 - viewX) / scale` which produces `+0`.
- Default Vitest 4 environment is `node` (no `window` global). Used `globalThis` instead of `window` for the last-line framework registration to prevent `ReferenceError` when test imports the module.
- `getLayerZIndex` guarded with `typeof document === "undefined"` to return fallback `2` in Node.js test environment (no DOM).
- Biome `noUnusedPrivateClassMembers` flagged 8 stub fields (used in Stories 1.2/1.3); suppressed with per-field `biome-ignore` comments.

### Completion Notes List

- `buildCameraBounds`: implemented formula `-viewX/scale`, `(graphWidth-viewX)/scale`, `-viewY/scale`, `(graphHeight-viewY)/scale` with full derivation comment; Y-down convention matches SVG.
- `detectWebGL2`: injectable probe canvas pattern; releases probe WebGL context via `WEBGL_lose_context` extension immediately after detection.
- `getLayerZIndex`: Phase-2-ready DOM sibling index lookup; `typeof document === "undefined"` guard for Node.js test compatibility.
- `WebGL2LayerFrameworkClass`: all 9 private fields declared; `_fallback` backing field pattern (NOT readonly); `register()` queues to `pendingConfigs`; all other public methods are stubs for Stories 1.2/1.3.
- Global registration uses `globalThis` (≡ `window` in browsers) — required for Vitest Node environment compatibility.
- `src/types/global.ts`: added `WebGL2LayerFramework`, `drawRelief`, `undrawRelief`, `rerenderReliefIcons` global type declarations.
- `src/modules/index.ts`: added `import "./webgl-layer-framework"` as last entry.
- 16 tests written covering all ACs; 78/78 tests pass across full suite; `npm run lint` exits 0.

### File List

- `src/modules/webgl-layer-framework.ts` — NEW
- `src/modules/webgl-layer-framework.test.ts` — NEW
- `src/modules/index.ts` — MODIFIED (added side-effect import)
- `src/types/global.ts` — MODIFIED (added 4 global type declarations)
