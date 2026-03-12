# Story 2.3: WebGL2 Fallback Integration Verification

**Status:** ready-for-dev
**Epic:** 2 — Relief Icons Layer Migration
**Story Key:** 2-3-webgl2-fallback-integration-verification
**Created:** 2026-03-12
**Developer:** _unassigned_

---

## Story

As a developer,
I want the WebGL2 → SVG fallback path end-to-end verified,
So that users on browsers without WebGL2 (or with hardware acceleration disabled) see identical map output via the SVG renderer.

---

## Acceptance Criteria

**AC1:** Framework init with no WebGL2 → hasFallback
**Given** a Vitest test that mocks `canvas.getContext('webgl2')` to return `null`
**When** `WebGL2LayerFramework.init()` is called
**Then** `hasFallback === true`, `init()` returns `false`, and the framework DOM setup (map-container wrapping, canvas insertion) does NOT occur

**AC2:** All framework methods are no-ops when `hasFallback === true`
**Given** `hasFallback === true`
**When** `WebGL2LayerFramework.register()`, `setVisible()`, `clearLayer()`, and `requestRender()` are called
**Then** all calls are silent no-ops — no exceptions thrown

**AC3:** `drawRelief()` routes to SVG when `hasFallback === true`
**Given** `window.drawRelief()` is called and `hasFallback === true`
**When** execution runs
**Then** `drawSvgRelief(icons, parentEl)` is invoked and SVG nodes are appended to the terrain layer — visually identical to the current implementation (FR19)

**AC4:** SVG fallback visual parity
**Given** SVG fallback is active
**When** a visually rendered map is compared against the current SVG baseline
**Then** icon positions, sizes, and orientations are pixel-indistinguishable (FR19)

**AC5:** Fallback tests pass
**Given** the fallback test is added to `webgl-layer-framework.test.ts`
**When** `npx vitest run` executes
**Then** the fallback detection test passes (FR26) and all 34+ tests pass

---

## Context

### Prerequisites

- **Story 2.2 must be complete.** The refactored `draw-relief-icons.ts` uses `WebGL2LayerFramework.hasFallback` to route to `drawSvg()`. The fallback path _exists_ in code; this story _verifies_ it via tests.
- **Stories 1.1–1.3 complete.** Framework tests at 34 passing, 85.13% statement coverage.

### What This Story Is

This is a **test coverage and verification story**. The fallback path already exists in:

1. `detectWebGL2()` — exported pure function (already tested in Story 1.1 with 2 tests)
2. `WebGL2LayerFrameworkClass.init()` — sets `_fallback = !detectWebGL2()`
3. `draw-relief-icons.ts` — `if (WebGL2LayerFramework.hasFallback) drawSvg(...)` (added in Story 2.2)

This story adds **integration-level tests** that walk the full fallback path end-to-end and confirms visual parity by reviewing the SVG output structure.

### Files to Touch

| File                                        | Change                                                          |
| ------------------------------------------- | --------------------------------------------------------------- |
| `src/modules/webgl-layer-framework.test.ts` | ADD new `describe` block: `WebGL2LayerFramework fallback path`  |
| `src/renderers/draw-relief-icons.ts`        | READ ONLY — verify hasFallback check exists (no changes needed) |

**Do NOT touch:**

- `src/modules/webgl-layer-framework.ts` — framework implementation is complete; fallback is already there
- Business logic functions in `draw-relief-icons.ts` — Story 2.2 already covered those

---

## Dev Notes

### Existing Fallback Tests (Do Not Duplicate)

Story 1.1 already added tests in `webgl-layer-framework.test.ts` for `detectWebGL2`:

```typescript
describe("detectWebGL2", () => {
  it("returns false when getContext returns null", () => { ... });  // FR26
  it("returns true when getContext returns a context object", () => { ... });
});
```

And Story 1.2 added `init()` tests including one for the fallback path:

```typescript
describe("WebGL2LayerFrameworkClass — init()", () => {
  it("init() returns false and sets hasFallback when detectWebGL2 returns false", () => { ... });
```

**Do not duplicate these.** The new tests in this story focus on:

1. Framework no-ops after fallback is set
2. The integration with `draw-relief-icons.ts` — verifying `hasFallback` routes to SVG

### Framework No-Op Tests

These tests verify that ALL public framework methods handle `hasFallback === true` gracefully. The pattern: inject `_fallback = true` onto the framework instance, then call every public method and assert no exception is thrown.

```typescript
describe("WebGL2LayerFramework — fallback no-op path (Story 2.3)", () => {
  let framework: WebGL2LayerFrameworkClass;

  beforeEach(() => {
    framework = new WebGL2LayerFrameworkClass();
    (framework as any)._fallback = true;
  });

  it("register() is a no-op when fallback is active (pending queue not used)", () => {
    const config = {
      id: "terrain",
      anchorLayerId: "terrain",
      renderOrder: 2,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };
    // register() before init() uses pendingConfigs[] — not gated by _fallback.
    // After init() with _fallback=true, scene is null, so register() re-queues.
    // The key assertion: no exception thrown, no setup() called.
    expect(() => framework.register(config)).not.toThrow();
    expect(config.setup).not.toHaveBeenCalled();
  });

  it("setVisible() is a no-op when fallback is active", () => {
    expect(() => framework.setVisible("terrain", false)).not.toThrow();
    expect(() => framework.setVisible("terrain", true)).not.toThrow();
  });

  it("clearLayer() is a no-op when fallback is active", () => {
    expect(() => framework.clearLayer("terrain")).not.toThrow();
  });

  it("requestRender() is a no-op when fallback is active", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1 as any);
    expect(() => framework.requestRender()).not.toThrow();
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it("unregister() is a no-op when fallback is active", () => {
    expect(() => framework.unregister("terrain")).not.toThrow();
  });

  it("syncTransform() is a no-op when fallback is active", () => {
    expect(() => framework.syncTransform()).not.toThrow();
  });

  it("hasFallback getter returns true when _fallback is set", () => {
    expect(framework.hasFallback).toBe(true);
  });
});
```

### `init()` Fallback DOM Non-Mutation Test

Story 1.2 added a test for `init() returns false when detectWebGL2 returns false` but may not have verified that the DOM was NOT mutated. Add this more specific test:

```typescript
it("init() with fallback does NOT create #map-container or canvas", () => {
  const fresh = new WebGL2LayerFrameworkClass();
  // Mock detectWebGL2 by spying on the canvas.getContext call in detectWebGL2
  // The cleanest way: stub document.createElement so probe canvas returns null context
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      return {getContext: () => null} as unknown as HTMLCanvasElement;
    }
    return origCreate(tag);
  });

  const result = fresh.init();

  expect(result).toBe(false);
  expect(fresh.hasFallback).toBe(true);
  expect(document.getElementById("map-container")).toBeNull();
  expect(document.getElementById("terrainCanvas")).toBeNull();

  vi.restoreAllMocks();
});
```

> **Note:** This test only works if `dom` environment is configured in Vitest. Check `vitest.config.ts` for `environment: "jsdom"` or `environment: "happy-dom"`. If not configured, check `vitest.browser.config.ts`. If tests run in node environment without DOM, skip this test or mark it appropriately.

### What to Check in draw-relief-icons.ts (Read-Only Verification)

After Story 2.2 is complete, verify these lines exist in `draw-relief-icons.ts`:

```typescript
// In window.drawRelief:
if (type === "svg" || WebGL2LayerFramework.hasFallback) {
  drawSvg(icons, parentEl); // ← SVG path taken when hasFallback is true
}

// In window.undrawRelief:
WebGL2LayerFramework.clearLayer("terrain"); // ← no-op in fallback mode (returns early)
```

No code change is needed here — just document the verification in this story's completion notes.

### Visual Parity Verification (AC4)

**AC4 is verified manually or via browser test**, not a Vitest unit test. The SVG fallback path uses the existing `drawSvg()` function which is unchanged from the pre-refactor implementation. Visual parity is therefore structural (same code path → same output). Document this in completion notes.

Vitest unit coverage for AC4: you can add a unit test that verifies `drawSvg()` produces the expected `<use>` element HTML structure:

```typescript
// This test requires draw-relief-icons.ts to export drawSvg for testability,
// OR tests it indirectly via window.drawRelief with hasFallback=true.
// The latter is an integration test that exercises the full SVG path:

it("window.drawRelief() calls drawSvg when hasFallback is true", () => {
  // Stub: force hasFallback=true on the global framework
  Object.defineProperty(window.WebGL2LayerFramework, "hasFallback", {
    get: () => true,
    configurable: true
  });

  const parentEl = document.createElement("g");
  parentEl.setAttribute("set", "simple");

  // Stub pack and generateRelief
  (globalThis as any).pack = {relief: []};
  // Note: generateRelief() will be called since pack.relief is empty — it needs
  // the full browser environment (cells, biomes, etc.). For unit testing, it's
  // simpler to stub the icons directly via pack.relief:
  (globalThis as any).pack = {
    relief: [
      {i: 0, href: "#relief-mount-1", x: 100, y: 100, s: 20},
      {i: 1, href: "#relief-hill-1", x: 200, y: 150, s: 15}
    ]
  };

  window.drawRelief("webGL", parentEl); // type=webGL but hasFallback forces SVG path

  // SVG path: parentEl.innerHTML should contain <use> elements
  expect(parentEl.innerHTML).toContain('<use href="#relief-mount-1"');
  expect(parentEl.innerHTML).toContain('data-id="0"');

  // Restore hasFallback
  Object.defineProperty(window.WebGL2LayerFramework, "hasFallback", {
    get: () => false,
    configurable: true
  });
});
```

> **Caution:** This integration test has significant setup requirements (global `pack`, `window.WebGL2LayerFramework` initialized, DOM element available). If the test environment doesn't support these, write a lighter version that just tests `drawSvg()` output format directly after exporting it (if needed). The primary goal is AC5 — all existing 34 tests still pass. The integration test here is bonus coverage.

### NFR-C1 Verification

NFR-C1: "WebGL2 context is the sole gating check; if null, SVG fallback activates automatically with no user-visible error."

The existing `detectWebGL2()` tests in `describe("detectWebGL2")` already cover the gating check. Add a test confirming no `console.error` is emitted during the fallback path:

```typescript
it("fallback activation produces no console.error", () => {
  const errorSpy = vi.spyOn(console, "error");
  const fresh = new WebGL2LayerFrameworkClass();
  (fresh as any)._fallback = true;
  fresh.register({id: "x", anchorLayerId: "x", renderOrder: 1, setup: vi.fn(), render: vi.fn(), dispose: vi.fn()});
  fresh.setVisible("x", false);
  fresh.clearLayer("x");
  fresh.requestRender();
  fresh.unregister("x");
  expect(errorSpy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
```

### Coverage Target

After Story 2.3, the target remains ≥80% statement coverage for `webgl-layer-framework.ts` (NFR-M5). The fallback guard branches (`if (this._fallback) return`) may already be partially covered by existing Class tests that set `_fallback = false`. The new tests explicitly set `_fallback = true` which flips the coverage on the early-return branches. This should push statement coverage higher (currently 85.13% — these tests will add 2-4%).

### Vitest Environment

Check the existing test config:

- `vitest.config.ts` — base config
- `vitest.browser.config.ts` — browser mode config

If tests run in node environment (no DOM), DOM-dependent tests in the `init() fallback DOM non-mutation` section should be skipped or adapted to not use `document.getElementById`. Existing tests use the pattern `vi.spyOn(globalThis, ...)` and direct instance field injection — this pattern works in node.

---

## Previous Story Intelligence

### From Stories 1.1–1.3

- `detectWebGL2()` pure function test pattern (inject probe canvas): fully established
- `WebGL2LayerFrameworkClass` test pattern (inject `_fallback`, inject `scene`, `layers`): established
- `requestRender()` RAF anti-pattern: uses `vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1 as any)` — the RAF spy MUST be restored after each test
- Private field injection with `(framework as any)._fieldName = value` — established pattern for all framework tests
- **Test count baseline:** 34 tests, 85.13% statement coverage after Story 1.3

### From Story 2.2

- `WebGL2LayerFramework.hasFallback` is checked in `window.drawRelief` to route to SVG path
- `WebGL2LayerFramework.clearLayer("terrain")` is a no-op when `_fallback === true` (returns early at top of method)
- `WebGL2LayerFramework.requestRender()` is a no-op when `_fallback === true`
- `drawSvg(icons, parentEl)` is the SVG path — unchanged from pre-refactor; produces `<use>` elements in `parentEl.innerHTML`

---

## References

- FR18: WebGL2 unavailability detection — [Source: `_bmad-output/planning-artifacts/epics.md#FR18`]
- FR19: Visually identical SVG fallback — [Source: `_bmad-output/planning-artifacts/epics.md#FR19`]
- FR26: detectWebGL2 testability — [Source: `_bmad-output/planning-artifacts/epics.md#FR26`]
- NFR-C1: WebGL2 sole gating check — [Source: `_bmad-output/planning-artifacts/epics.md#NonFunctional Requirements`]
- NFR-C4: Hardware acceleration disabled = SVG fallback — [Source: `_bmad-output/planning-artifacts/epics.md#NonFunctional Requirements`]
- Architecture Decision 6 (fallback pattern): [Source: `_bmad-output/planning-artifacts/architecture.md#Decision 6`]

---

## Tasks

- [ ] **T1:** Read current `webgl-layer-framework.test.ts` — understand existing test structure and count (34 tests baseline)

- [ ] **T2:** Read current `draw-relief-icons.ts` (post-Story 2.2) — verify `WebGL2LayerFramework.hasFallback` check exists in `window.drawRelief`

- [ ] **T3:** Add `describe("WebGL2LayerFramework — fallback no-op path (Story 2.3)")` block to `webgl-layer-framework.test.ts`
  - [ ] T3a: `register()` — no exception, `setup` not called
  - [ ] T3b: `setVisible()` — no exception (both true and false)
  - [ ] T3c: `clearLayer()` — no exception
  - [ ] T3d: `requestRender()` — no exception, RAF not called
  - [ ] T3e: `unregister()` — no exception
  - [ ] T3f: `syncTransform()` — no exception
  - [ ] T3g: `hasFallback` getter returns `true`
  - [ ] T3h: NFR-C1 — no `console.error` emitted during fallback operations

- [ ] **T4:** Add `init()` fallback DOM non-mutation test (only if environment supports `document.getElementById`)
  - [ ] T4a: Check Vitest environment config (`vitest.config.ts`)
  - [ ] T4b: If jsdom/happy-dom: add test asserting `#map-container` and `#terrainCanvas` do NOT exist after fallback `init()`
  - [ ] T4c: If node-only environment: skip DOM assertion; rely on `init() returns false` and `hasFallback === true` tests

- [ ] **T5:** (Optional/Bonus) Add integration test verifying `window.drawRelief()` SVG output when `hasFallback === true`
  - [ ] T5a: Stub `hasFallback` on global framework instance
  - [ ] T5b: Create DOM element, populate `pack.relief` stub data
  - [ ] T5c: Call `window.drawRelief("webGL", element)` — assert SVG output contains `<use>` elements
  - [ ] T5d: Restore stubs

- [ ] **T6:** `npx vitest run src/modules/webgl-layer-framework.test.ts`
  - [ ] T6a: All existing 34 tests pass (no regressions)
  - [ ] T6b: All new fallback tests pass
  - [ ] T6c: Statement coverage remains ≥80% (NFR-M5)

- [ ] **T7:** `npm run lint` — zero errors

- [ ] **T8:** Document completion:
  - [ ] T8a: Record actual test count after new tests
  - [ ] T8b: Record final statement coverage percentage
  - [ ] T8c: Verify AC4 (SVG visual parity) by manual or structural analysis — document finding

---

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List

_Files modified (to be filled by dev agent):_

- `src/modules/webgl-layer-framework.test.ts` — new describe block with 8+ fallback tests
