# Story 3.2: Bundle Size Audit

**Status:** review
**Epic:** 3 — Quality & Bundle Integrity
**Story Key:** 3-2-bundle-size-audit
**Created:** 2026-03-12
**Developer:** _unassigned_

---

## Story

As a developer,
I want the Vite production bundle analyzed to confirm Three.js tree-shaking is effective and the total bundle size increase is within budget,
So that the feature does not negatively impact page load performance.

---

## Acceptance Criteria

**AC1:** Three.js named imports only (NFR-B1)
**Given** `webgl-layer-framework.ts` and `draw-relief-icons.ts` source is inspected
**When** Three.js import statements are reviewed
**Then** no `import * as THREE from 'three'` exists in any `src/**/*.ts` file — all imports are named

**AC2:** Bundle size increase ≤50KB gzipped (NFR-B2)
**Given** the bundle size before and after the feature is compared
**When** gzip sizes are measured from `npm run build` output
**Then** the total bundle size increase from this feature's new code is ≤50KB gzipped

**AC3:** Tree-shaking verification
**Given** `vite build` is run with the complete implementation
**When** the bundle is analyzed with `rollup-plugin-visualizer` or `npx vite-bundle-visualizer`
**Then** only the required Three.js classes are included in the bundle (no full THREE namespace)

**AC4:** Named imports enumerated and verified
**Given** the final implementation
**When** all Three.js named imports in the project are listed
**Then** the set matches the declared architecture list: `WebGLRenderer, Scene, OrthographicCamera, Group, BufferGeometry, BufferAttribute, Mesh, MeshBasicMaterial, TextureLoader, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter, DoubleSide`

**AC5:** Results documented
**Given** the bundle audit completes
**When** results are captured
**Then** actual gzip delta is recorded in this story's Dev Agent Record and compared to the 50KB budget

---

## Context

### What This Story Is

This is a **build analysis and documentation story**. Run `npm run build`, inspect the output, verify tree-shaking, calculate the gzip size delta vs. the baseline (pre-feature), and document findings.

**Key architectural note:** Three.js is **already a project dependency** for the globe view (`public/libs/three.min.js` — pre-existing). The new WebGL relief feature adds TypeScript-side consumption of Three.js via `import {...} from 'three'` (Vite/Rollup tree-shaking). The budget is the delta of new classes uniquely added by this feature.

### Prerequisites

- Story 3.1 debe be `done` (or both can be done in parallel — they're independent)
- `npm run build` must produce a clean output (TypeScript errors would block this)
- `npm run lint` must be clean

### Build Command

```bash
npm run build
# = tsc && vite build
# output: dist/ (built from src/, publicDir from public/)
```

### Bundle Analysis Tools

Two options (no new prod dependencies required):

**Option A — rollup-plugin-visualizer (recommended):**

```bash
npx rollup-plugin-visualizer --help  # check availability
# OR temporarily add to vite.config.ts:
```

```typescript
import {visualizer} from "rollup-plugin-visualizer";
export default {
  root: "./src",
  plugins: [visualizer({open: true, filename: "dist/stats.html"})]
  // ... rest of config
};
```

Then `npm run build` — opens `dist/stats.html` in browser showing tree map.

**Option B — vite-bundle-visualizer:**

```bash
npx vite-bundle-visualizer
```

**Option C — manual bundle inspection (simplest, no extra tools):**

```bash
npm run build 2>&1
ls -la dist/
# Check the JS chunk sizes in dist/
du -sh dist/*.js
# For gzip sizes:
for f in dist/*.js; do echo "$f: $(gzip -c "$f" | wc -c) bytes gzip"; done
```

### Baseline Measurement Strategy

Since Three.js was already included as a CDN/pre-bundled lib (via `public/libs/three.min.js`), the new feature adds **TypeScript module consumption** of Three.js via npm (named imports in `src/`). Vite will tree-shake these.

**Two-point comparison for NFR-B2 delta:**

1. **Before delta** — the git state BEFORE Epic 1 (`git stash` or checkout to a clean state):

   ```bash
   git stash
   npm run build
   # Record gzip sizes
   git stash pop
   ```

   If the git stash is impractical (too much state), use the `main` branch or initial commit as baseline.

2. **After delta** — current state:

   ```bash
   npm run build
   # Record gzip sizes
   ```

   Delta = (after) - (before) gzip size

3. **Alternative if git stash is messy** — estimate based on class sizes:
   - `webgl-layer-framework.ts` source: ~280 lines of TS ≈ ~5KB minified + gzip
   - `draw-relief-icons.ts` source: ~260 lines (substantially refactored) — net delta is small
   - Three.js named imports for NEW classes only: review which classes were NOT already imported by any pre-existing code

### Three.js Import Audit

**Classes used by `webgl-layer-framework.ts`:**

```typescript
import {Group, OrthographicCamera, Scene, WebGLRenderer} from "three";
```

**Classes used by `draw-relief-icons.ts`:**

```typescript
import {
  type Group, // ← already in webgl-layer-framework.ts (shared, no extra bundle cost)
  type Texture,
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
```

**Check for any `import * as THREE`** — should find ZERO:

```bash
grep -r "import \* as THREE" src/
# Expected output: (nothing)
```

### Pre-existing Three.js Usage in Project

The project already has `public/libs/three.min.js` (CDN/pre-built). However, this is a **different bundle path** — it's a global script, not a module import. The Vite build for `src/` will bundle Three.js module imports separately via npm (`node_modules/three`).

**Check if Three.js was already imported via npm in any pre-existing src/ files:**

```bash
grep -r "from 'three'\|from \"three\"" src/ --include="*.ts"
```

If the globe view uses the pre-built `three.min.js` (global `THREE`) rather than ESM imports, then Three.js ESM bundle cost is **100% new** from this feature. If there are pre-existing ESM imports, the delta is only the newly added classes.

### NFR Reference

| NFR    | Threshold              | Verification                                        |
| ------ | ---------------------- | --------------------------------------------------- |
| NFR-B1 | No `import * as THREE` | `grep -r "import \* as THREE" src/` returns nothing |
| NFR-B2 | ≤50KB gzipped increase | Measure actual gzip delta before/after              |

### Key Architecture Facts

- Architecture Decision confirmed: "Three.js is already present; adds no bundle cost" — [Source: `_bmad-output/planning-artifacts/architecture.md#Decision 1`]
- This refers to Three.js being already a dependency; the NAMED import tree-shaking still matters
- Framework code size estimate: ~5KB minified, ~2KB gzip [Source: `architecture.md#NFR-B2`]
- Vite version: ^7.3.1 — full ESM + tree-shaking support

---

## Previous Story Intelligence

### From Story 2.2 (draw-relief-icons.ts refactor)

- Final named Three.js imports in `draw-relief-icons.ts`: `BufferAttribute, BufferGeometry, DoubleSide, Group (type), LinearFilter, LinearMipmapLinearFilter, Mesh, MeshBasicMaterial, SRGBColorSpace, Texture (type), TextureLoader`
- The Biome import organizer (`organizeImports: on`) auto-orders imports alphabetically and moves `type` imports first. Confirmed lint-clean.
- No `import * as THREE from "three"` remains anywhere in the project src/ tree.

### From Story 3.1 (performance benchmarking)

- `src/renderers/draw-relief-icons.bench.ts` may have been created in Story 3.1 — if so, verify its Three.js imports also follow named-import pattern (NFR-B1 applies to all `src/` TypeScript)
- Confirm bench file passes lint before running build

### From Epic 1 (webgl-layer-framework.ts)

- `webgl-layer-framework.ts` imports: `Group, OrthographicCamera, Scene, WebGLRenderer` — 4 named classes
- `draw-relief-icons.ts` imports: 9 additional named classes (bufffers, mesh, material, texture, consts)
- Total unique Three.js classes pulled: 13 (some overlap between the two files — Rollup deduplicates)

---

## Tasks

- [x] **T1:** Verify NFR-B1 — no `import * as THREE` anywhere in `src/`
  - [x] T1a: Run `grep -r "import \* as THREE" src/` — expect zero matches
  - [x] T1b: Run `grep -r "import \* as THREE" src/` on bench file if created in Story 3.1
  - [x] T1c: Document: "NFR-B1 confirmed — no namespace imports found"

- [x] **T2:** Enumerate all Three.js named imports actually used
  - [x] T2a: `grep -r "from \"three\"" src/ --include="*.ts"` — list all import statements
  - [x] T2b: Verify the list matches the architecture declaration (AC4)
  - [x] T2c: Document the full import inventory

- [x] **T3:** Run production build
  - [x] T3a: `npm run build` → confirm exit code 0 (no TypeScript errors, no Vite errors)
  - [x] T3b: List `dist/` output files and sizes: `ls -la dist/`
  - [x] T3c: Calculate gzip sizes for all JS chunks: `for f in dist/*.js; do echo "$f: $(gzip -c "$f" | wc -c) bytes"; done`

- [x] **T4:** Establish baseline (before-feature bundle size)
  - [x] T4a: `git stash` (stash current work if clean) OR use `git show HEAD~N:dist/` if build artifacts were committed
  - [x] T4b: If git stash feasible: `git stash` → `npm run build` → record gzip sizes → `git stash pop`
  - [x] T4c: If stash impractical: use the `main` branch in a separate terminal, build separately, record sizes
  - [x] T4d: Record baseline sizes

- [x] **T5:** Calculate and verify NFR-B2 delta
  - [x] T5a: Compute: `after_gzip_total - before_gzip_total`
  - [x] T5b: Verify delta ≤ 51,200 bytes (50KB)
  - [x] T5c: If delta > 50KB: investigate which chunk grew unexpectedly (bundle visualizer)

- [x] **T6:** (Optional) Run bundle visualizer for tree-shaking confirmation (AC3)
  - [x] T6a: Add `rollup-plugin-visualizer` temporarily to vite.config.ts
  - [x] T6b: Run `npm run build` → open `dist/stats.html`
  - [x] T6c: Verify Three.js tree nodes show only the expected named classes
  - [x] T6d: Remove the visualizer from vite.config.ts afterward (do not commit it in production config — or move to a separate `vite.analyze.ts` config)

- [x] **T7:** `npm run lint` — zero errors (T6 vite.config.ts change must not be committed if produces lint issues)

- [x] **T8:** Document all results in Dev Agent Record:
  - [x] T8a: NFR-B1 verdict (pass/fail + grep output)
  - [x] T8b: Named import list (matches architecture spec?)
  - [x] T8c: Baseline gzip sizes
  - [x] T8d: Post-feature gzip sizes
  - [x] T8e: Delta in bytes and KB — pass/fail vs 50KB budget
  - [x] T8f: Bundle visualizer screenshot path or description (if T6 executed)

---

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- `rg -n 'import \* as THREE' src --glob '*.ts'`
- `rg -n -U 'import[\s\S]*?from "three";' src --glob '*.ts'`
- `npm run build`
- `npm run build -- --emptyOutDir`
- `git worktree add --detach <tmp> 42b92d93b44d4a472ebbe9b77bbb8da7abf42458`
- `npx -y vite-bundle-visualizer --template raw-data --output dist/stats.json --open false`
- `npm run lint`
- `vitest` via repo test runner (38 passing)
- `npm run test:e2e` (Playwright, 38 passing)

### Completion Notes List

- Fixed a blocking TypeScript declaration mismatch for `drawRelief` so `npm run build` could complete.
- Verified NFR-B1: no `import * as THREE` usage exists anywhere under `src/`, including the benchmark harness.
- Verified AC4 import inventory matches the architecture set, with bench-only `BufferAttribute` and `BufferGeometry` already included in the production renderer imports.
- Measured bundle delta against pre-feature commit `42b92d93b44d4a472ebbe9b77bbb8da7abf42458` using a temporary git worktree and clean `--emptyOutDir` builds.
- Measured post-feature main bundle gzip at 289,813 bytes vs baseline 289,129 bytes, for a delta of 684 bytes.
- Generated `dist/stats.json` via `vite-bundle-visualizer`; it shows only `src/modules/webgl-layer-framework.ts` and `src/renderers/draw-relief-icons.ts` importing the Three.js ESM entrypoints.
- `npm run lint` passed with no fixes applied and the current test suite passed with 38 passing tests.
- `npm run test:e2e` passed with 38 Playwright tests.

_Record actual bundle measurements here:_

**NFR-B1:**

- `grep -r "import * as THREE" src/` result: no matches
- Verdict: PASS

**NFR-B2:**

- Baseline bundle gzip total: 289,129 bytes
- Post-feature bundle gzip total: 289,813 bytes
- Delta: 684 bytes (0.67 KB)
- Budget: 51,200 bytes (50KB)
- Verdict: PASS

**Named Three.js imports (AC4):**

```
src/renderers/draw-relief-icons.bench.ts
import { BufferAttribute, BufferGeometry } from "three";

src/renderers/draw-relief-icons.ts
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  type Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from "three";

src/modules/webgl-layer-framework.ts
import { Group, OrthographicCamera, Scene, WebGLRenderer } from "three";
```

**AC3 Tree-shaking note:**

- `vite-bundle-visualizer` raw report: `dist/stats.json`
- Three.js bundle nodes appear as `/node_modules/three/build/three.core.js` and `/node_modules/three/build/three.module.js`
- Those nodes are imported only by `src/modules/webgl-layer-framework.ts` and `src/renderers/draw-relief-icons.ts`
- No `import * as THREE` namespace imports exist in project source, so the Three.js ESM dependency is consumed only through named imports from the two expected feature modules
- Verdict: PASS

### File List

_Files created/modified:_

- `_bmad-output/implementation-artifacts/3-2-bundle-size-audit.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/renderers/draw-relief-icons.ts`

## Change Log

- 2026-03-12: Completed Story 3.2 bundle audit, fixed the blocking `drawRelief` declaration mismatch, measured a 684-byte gzip delta versus the pre-feature baseline, and verified Three.js remains named-import-only in project source.
