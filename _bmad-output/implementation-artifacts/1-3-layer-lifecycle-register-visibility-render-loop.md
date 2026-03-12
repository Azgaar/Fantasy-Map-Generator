# Story 1.3: Layer Lifecycle — Register, Visibility, Render Loop

**Status:** done
**Epic:** 1 — WebGL Layer Framework Module
**Story Key:** 1-3-layer-lifecycle-register-visibility-render-loop
**Created:** 2026-03-12
**Developer:** Amelia (Dev Agent)

---

## Story

As a developer,
I want `register()`, `unregister()`, `setVisible()`, `clearLayer()`, `requestRender()`, `syncTransform()`, and the private per-frame `render()` fully implemented,
So that multiple layers can be registered, rendered each frame, toggled visible/invisible, and cleaned up without GPU state loss.

---

## Context

### Prior Art (Stories 1.1 & 1.2 — Complete)

Stories 1.1 and 1.2 delivered the complete scaffold in `src/modules/webgl-layer-framework.ts`:

- **Pure exports:** `buildCameraBounds`, `detectWebGL2`, `getLayerZIndex` — fully implemented and tested
- **`init()`:** Fully implemented — DOM wrapping, canvas creation, Three.js renderer/scene/camera, ResizeObserver, D3 zoom subscription, pendingConfigs processing
- **`register()`:** Fully implemented — queues pre-init, creates Group and registers post-init
- **`requestRender()`:** Stub (calls `this.render()` directly — no RAF coalescing yet)
- **`syncTransform()`:** Stub (no-op)
- **`setVisible()`:** Stub (no-op)
- **`clearLayer()`:** Stub (no-op)
- **`unregister()`:** Stub (no-op)
- **`render()` private:** Stub (no-op)
- **21 tests passing**; lint clean

### Files to Modify

- `src/modules/webgl-layer-framework.ts` — implement all stub methods listed above
- `src/modules/webgl-layer-framework.test.ts` — add Story 1.3 tests (RAF coalescing, syncTransform, render order, setVisible, clearLayer, unregister)

---

## Acceptance Criteria

**AC1:** `register(config)` before `init()`
→ config is queued in `pendingConfigs[]` and processed by `init()` without error _(already implemented in Story 1.2; verify remains correct)_

**AC2:** `register(config)` after `init()`
→ a `THREE.Group` with `config.renderOrder` is created, `config.setup(group)` is called once, the group is added to `scene`, and the registration is stored in `layers: Map`

**AC3:** `setVisible('terrain', false)`
→ `layer.group.visible === false`; `config.dispose` is NOT called (no GPU teardown, NFR-P6); canvas is hidden only if ALL layers are invisible

**AC4:** `setVisible('terrain', true)` after hiding
→ `layer.group.visible === true`; `requestRender()` is triggered; toggle completes in <4ms (NFR-P3)

**AC5:** `clearLayer('terrain')`
→ `group.clear()` is called (removes all Mesh children); layer registration in `layers: Map` remains intact; `renderer.dispose()` is NOT called

**AC6:** `requestRender()` called three times in rapid succession
→ only one `requestAnimationFrame` is scheduled (RAF coalescing confirmed); `rafId` is reset to `null` after the frame executes

**AC7:** `render()` private execution order
→ `syncTransform()` is called first; then each visible layer's `config.render(group)` callback is dispatched (invisible layer callbacks are skipped); then `renderer.render(scene, camera)` is called last

**AC8:** `syncTransform()` with globals `viewX=0, viewY=0, scale=1, graphWidth=960, graphHeight=540`
→ camera `left/right/top/bottom` match `buildCameraBounds(0, 0, 1, 960, 540)` exactly; `camera.updateProjectionMatrix()` is called

**AC9:** `unregister('terrain')`
→ `config.dispose(group)` is called; the id is removed from `layers: Map`; if the unregistered layer was the last one, `canvas.style.display` is set to `"none"`

**AC10:** Framework coverage ≥80% (NFR-M5)
→ `npx vitest run --coverage src/modules/webgl-layer-framework.test.ts` reports ≥80% statement coverage for `webgl-layer-framework.ts`

**AC11:** `THREE.Group` is the sole abstraction boundary (NFR-M1)
→ `scene`, `renderer`, and `camera` are never exposed to layer callbacks; all three callbacks receive only `group: THREE.Group`

---

## Technical Notes

### `requestRender()` — RAF Coalescing

Replace the direct `this.render()` call (Story 1.2 stub) with the RAF-coalesced pattern:

```typescript
requestRender(): void {
  if (this._fallback) return;
  if (this.rafId !== null) return;           // already scheduled — coalesce
  this.rafId = requestAnimationFrame(() => {
    this.rafId = null;
    this.render();
  });
}
```

**Why coalescing matters:** D3 zoom fires many events per second; `ResizeObserver` also calls `requestRender()`. Without coalescing, every event triggers a `renderer.render()` call. With coalescing, all calls within the same frame collapse to one GPU draw.

### `syncTransform()` — D3 → Camera Sync

Reads window globals (`viewX`, `viewY`, `scale`, `graphWidth`, `graphHeight`) and applies `buildCameraBounds()` to the orthographic camera:

```typescript
syncTransform(): void {
  if (this._fallback || !this.camera) return
  const bounds = buildCameraBounds(viewX, viewY, scale, graphWidth, graphHeight);
  this.camera.left = bounds.left;
  this.camera.right = bounds.right;
  this.camera.top = bounds.top;
  this.camera.bottom = bounds.bottom;
  this.camera.updateProjectionMatrix();
}
```

**Guard note:** `globalThis as any` is required because `viewX`, `viewY`, `scale`, `graphWidth`, `graphHeight` are legacy window globals from the pre-TypeScript codebase. They are not typed. Use `?? 0` / `?? 1` / `?? 960` / `?? 540` defaults so tests can run in Node without setting them.

### `render()` — Per-Frame Dispatch

```typescript
private render(): void {
  if (this._fallback || !this.renderer || !this.scene || !this.camera) return;
  this.syncTransform();
  for (const layer of this.layers.values()) {
    if (layer.group.visible) {
      layer.config.render(layer.group);
    }
  }
  this.renderer.render(this.scene, this.camera);
}
```

**Order is enforced:** syncTransform → per-layer render callbacks → renderer.render. Never swap.

### `setVisible()` — GPU-Preserving Toggle

```typescript
setVisible(id: string, visible: boolean): void {
  if (this._fallback) return;
  const layer = this.layers.get(id);
  if (!layer) return;
  layer.group.visible = visible;
  const anyVisible = [...this.layers.values()].some(l => l.group.visible);
  if (this.canvas) this.canvas.style.display = anyVisible ? "block" : "none";
  if (visible) this.requestRender();
}
```

**Critical:** `config.dispose` must NOT be called here. No GPU teardown. Only `group.visible` is toggled (Three.js skips invisible objects in draw dispatch automatically).

### `clearLayer()` — Wipe Geometry, Preserve Registration

```typescript
clearLayer(id: string): void {
  if (this._fallback) return;
  const layer = this.layers.get(id);
  if (!layer) return;
  layer.group.clear();  // removes all Mesh children; Three.js Group.clear() does NOT dispose GPU memory
}
```

**Note:** `group.clear()` does NOT call `.dispose()` on children. Story 2.x's `undrawRelief` calls this to empty geometry without GPU teardown — preserving VBO/texture memory per NFR-P6.

### `unregister()` — Full Cleanup

```typescript
unregister(id: string): void {
  if (this._fallback) return;
  const layer = this.layers.get(id);
  if (!layer || !this.scene) return;
  layer.config.dispose(layer.group);   // caller disposes GPU memory (geometry, material, texture)
  this.scene.remove(layer.group);
  this.layers.delete(id);
  const anyVisible = [...this.layers.values()].some(l => l.group.visible);
  if (this.canvas && !anyVisible) this.canvas.style.display = "none";
}
```

### Removing `biome-ignore` Comments (T7)

Story 1.2 retained `biome-ignore lint/correctness/noUnusedPrivateClassMembers` on `camera` and `rafId`. Both are now fully used in this story:

- `camera` is read in `syncTransform()` and `render()`
- `rafId` is read and written in `requestRender()`

Remove both `biome-ignore` comments as part of this story.

### Test Strategy — Story 1.3 Tests

All new tests inject stub state onto private fields (same pattern as Stories 1.1 and 1.2). No real WebGL context needed.

**RAF coalescing test:** `vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1 as any)` to assert it is called only once for three rapid `requestRender()` calls.

**syncTransform test:** Stub `camera` with a plain object; set `globalThis.viewX = 0` etc. via `vi.stubGlobal()`; call `syncTransform()`; assert camera bounds match `buildCameraBounds(0,0,1,960,540)`.

**render() order test:** Spy on `syncTransform`, a layer's `render` callback, and `renderer.render`. Assert call order.

**setVisible test:** Already partially covered in Story 1.1; Story 1.3 adds the "canvas hidden when ALL invisible" edge case and the "requestRender triggered on show" case.

**unregister test:** Verify `dispose()` called, layer removed from Map, scene.remove() called.

---

## Tasks

- [x] **T1:** Implement `requestRender()` with RAF coalescing (replace Story 1.2 stub)
  - [x] T1a: Guard on `_fallback`
  - [x] T1b: Early return if `rafId !== null`
  - [x] T1c: `requestAnimationFrame` call storing ID in `rafId`; reset to `null` in callback before calling `render()`

- [x] **T2:** Implement `syncTransform()` reading window globals
  - [x] T2a: Guard on `_fallback` and `!this.camera`
  - [x] T2b: Read `globalThis.viewX/viewY/scale/graphWidth/graphHeight` with `?? defaults`
  - [x] T2c: Call `buildCameraBounds()` and write all four camera bounds
  - [x] T2d: Call `this.camera.updateProjectionMatrix()`

- [x] **T3:** Implement private `render()` with ordered dispatch
  - [x] T3a: Guard on `_fallback`, `!this.renderer`, `!this.scene`, `!this.camera`
  - [x] T3b: Call `this.syncTransform()`
  - [x] T3c: Loop `this.layers.values()` dispatching `layer.config.render(group)` for visible layers only
  - [x] T3d: Call `this.renderer.render(this.scene, this.camera)` (via local const captures for TypeScript type safety)

- [x] **T4:** Implement `setVisible(id, visible)`
  - [x] T4a: Guard on `_fallback`
  - [x] T4b: Toggle `layer.group.visible`
  - [x] T4c: Check if ANY layer is still visible; update `canvas.style.display`
  - [x] T4d: Call `requestRender()` when `visible === true`

- [x] **T5:** Implement `clearLayer(id)`
  - [x] T5a: Guard on `_fallback`
  - [x] T5b: Call `layer.group.clear()` — do NOT call `renderer.dispose()`

- [x] **T6:** Implement `unregister(id)`
  - [x] T6a: Guard on `_fallback`
  - [x] T6b: Call `layer.config.dispose(layer.group)`
  - [x] T6c: Call `scene.remove(layer.group)` (via local const capture)
  - [x] T6d: Delete from `this.layers`
  - [x] T6e: Update canvas display if no layers remain visible

- [x] **T7:** Remove remaining `biome-ignore lint/correctness/noUnusedPrivateClassMembers` comments from `camera` and `rafId` fields

- [x] **T8:** Add Story 1.3 tests to `webgl-layer-framework.test.ts`:
  - [x] T8a: `requestRender()` — RAF coalescing: 3 calls → only 1 `requestAnimationFrame()`
  - [x] T8b: `requestRender()` — `rafId` resets to `null` after frame executes
  - [x] T8c: `syncTransform()` — camera bounds match `buildCameraBounds(0,0,1,960,540)`
  - [x] T8d: `syncTransform()` — uses `?? defaults` when globals absent
  - [x] T8e: `render()` — `syncTransform()` called before layer callbacks, `renderer.render()` called last
  - [x] T8f: `render()` — invisible layer's `config.render()` NOT called
  - [x] T8g: `setVisible(false)` — `group.visible = false`; `dispose` NOT called (NFR-P6)
  - [x] T8h: `setVisible(false)` for ALL layers — canvas `display = "none"`
  - [x] T8i: `setVisible(true)` — `requestRender()` triggered
  - [x] T8j: `clearLayer()` — `group.clear()` called; layer remains in `layers` Map
  - [x] T8k: `clearLayer()` — `renderer.dispose()` NOT called (NFR-P6)
  - [x] T8l: `unregister()` — `dispose()` called; `scene.remove()` called; id removed from Map
  - [x] T8m: `unregister()` last layer — canvas `display = "none"`
  - [x] Also updated existing Story 1.1 test `requestRender() does not throw` to stub RAF globally

- [x] **T9:** `npm run lint` — zero errors

- [x] **T10:** `npx vitest run src/modules/webgl-layer-framework.test.ts` — all 34 tests pass; statement coverage 85.13% ≥ 80% (NFR-M5 ✓)

- [x] **T11:** Set story status to `review`

---

## Dev Notes

### Globals Referenced

| Global        | Type     | Default in tests | Source                        |
| ------------- | -------- | ---------------- | ----------------------------- |
| `viewX`       | `number` | `0`              | D3 zoom transform X translate |
| `viewY`       | `number` | `0`              | D3 zoom transform Y translate |
| `scale`       | `number` | `1`              | D3 zoom scale                 |
| `graphWidth`  | `number` | `960`            | Map canvas logical width      |
| `graphHeight` | `number` | `540`            | Map canvas logical height     |

All accessed via `(globalThis as any).NAME ?? default` — never destructure or assume presence (guard for Node test env).

### What Story 1.3 Does NOT Cover

- `draw-relief-icons.ts` refactor → Story 2.2
- Performance benchmarking → Story 3.1
- E2E / browser tests → out of scope for Epic 1

### Coverage Target

NFR-M5 requires ≥80% statement coverage. After Story 1.3, all public methods and critical private paths are exercised. The remaining uncovered lines should be limited to edge cases in platform-specific paths (ResizeObserver callbacks, WebGL context loss handlers).

---

## Dev Agent Record

### Implementation Notes

- **`render()` TypeScript type safety:** Used local const captures (`const renderer = this.renderer; const scene = this.scene; const camera = this.camera;`) immediately after the null-guard, before calling `this.syncTransform()`. This is required because TypeScript re-widens class instance field types after any method call — local consts preserve the narrowed (non-null) types for the final `renderer.render(scene, camera)` call.
- **`unregister()` local capture:** Same pattern used for `scene` — captured before `layer.config.dispose()` call to preserve TypeScript narrowing.
- **`syncTransform()` local capture:** `const camera = this.camera;` captured after guard, before variable assignments. No function calls between guard and camera use, so TypeScript narrows correctly; the capture is an additional safety measure.
- **Existing test update (T8 extra):** The Story 1.1 test `requestRender() does not throw when called multiple times` was updated to add `vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(0))` since the stub method previously directly called `render()` (a no-op), but the real implementation now calls `requestAnimationFrame` which is absent in the Node.js test environment.
- **Uncovered lines (15%):** Line 88 (`|| 960` fallback in `init()` clientWidth branch) and lines 256/262-265 (ResizeObserver callback body). Both require real DOM resize events — not testable in Node unit tests. These represent expected coverage gaps acceptable per NFR-M5.

### Files Modified

- `src/modules/webgl-layer-framework.ts` — implemented `requestRender()`, `syncTransform()`, `render()`, `setVisible()`, `clearLayer()`, `unregister()`; removed 2 `biome-ignore` comments (`camera`, `rafId`)
- `src/modules/webgl-layer-framework.test.ts` — updated 1 existing test (RAF stub); added new describe block `WebGL2LayerFrameworkClass — lifecycle & render loop (Story 1.3)` with 13 tests

### Test Results

```
✓ modules/webgl-layer-framework.test.ts (34 tests) 9ms
  ✓ buildCameraBounds (5)
  ✓ detectWebGL2 (3)
  ✓ getLayerZIndex (1)
  ✓ WebGL2LayerFrameworkClass (7)
  ✓ WebGL2LayerFrameworkClass — init() (5)
  ✓ WebGL2LayerFrameworkClass — lifecycle & render loop (Story 1.3) (13)
Test Files  1 passed (1) | Tests  34 passed (34)

Coverage (v8):
  webgl-layer-framework.ts | 85.13% Stmts | 70.73% Branch | 84.21% Funcs | 91.26% Lines
  NFR-M5 (≥80% statement coverage): ✓ PASS
```

`npm run lint`: Checked 80 files — no fixes applied.
