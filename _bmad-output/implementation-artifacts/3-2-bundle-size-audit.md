# Story 3.2: Bundle Size Audit

**Status:** backlog
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

- [ ] **T1:** Verify NFR-B1 — no `import * as THREE` anywhere in `src/`
  - [ ] T1a: Run `grep -r "import \* as THREE" src/` — expect zero matches
  - [ ] T1b: Run `grep -r "import \* as THREE" src/` on bench file if created in Story 3.1
  - [ ] T1c: Document: "NFR-B1 confirmed — no namespace imports found"

- [ ] **T2:** Enumerate all Three.js named imports actually used
  - [ ] T2a: `grep -r "from \"three\"" src/ --include="*.ts"` — list all import statements
  - [ ] T2b: Verify the list matches the architecture declaration (AC4)
  - [ ] T2c: Document the full import inventory

- [ ] **T3:** Run production build
  - [ ] T3a: `npm run build` → confirm exit code 0 (no TypeScript errors, no Vite errors)
  - [ ] T3b: List `dist/` output files and sizes: `ls -la dist/`
  - [ ] T3c: Calculate gzip sizes for all JS chunks: `for f in dist/*.js; do echo "$f: $(gzip -c "$f" | wc -c) bytes"; done`

- [ ] **T4:** Establish baseline (before-feature bundle size)
  - [ ] T4a: `git stash` (stash current work if clean) OR use `git show HEAD~N:dist/` if build artifacts were committed
  - [ ] T4b: If git stash feasible: `git stash` → `npm run build` → record gzip sizes → `git stash pop`
  - [ ] T4c: If stash impractical: use the `main` branch in a separate terminal, build separately, record sizes
  - [ ] T4d: Record baseline sizes

- [ ] **T5:** Calculate and verify NFR-B2 delta
  - [ ] T5a: Compute: `after_gzip_total - before_gzip_total`
  - [ ] T5b: Verify delta ≤ 51,200 bytes (50KB)
  - [ ] T5c: If delta > 50KB: investigate which chunk grew unexpectedly (bundle visualizer)

- [ ] **T6:** (Optional) Run bundle visualizer for tree-shaking confirmation (AC3)
  - [ ] T6a: Add `rollup-plugin-visualizer` temporarily to vite.config.ts
  - [ ] T6b: Run `npm run build` → open `dist/stats.html`
  - [ ] T6c: Verify Three.js tree nodes show only the expected named classes
  - [ ] T6d: Remove the visualizer from vite.config.ts afterward (do not commit it in production config — or move to a separate `vite.analyze.ts` config)

- [ ] **T7:** `npm run lint` — zero errors (T6 vite.config.ts change must not be committed if produces lint issues)

- [ ] **T8:** Document all results in Dev Agent Record:
  - [ ] T8a: NFR-B1 verdict (pass/fail + grep output)
  - [ ] T8b: Named import list (matches architecture spec?)
  - [ ] T8c: Baseline gzip sizes
  - [ ] T8d: Post-feature gzip sizes
  - [ ] T8e: Delta in bytes and KB — pass/fail vs 50KB budget
  - [ ] T8f: Bundle visualizer screenshot path or description (if T6 executed)

---

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

_Record actual bundle measurements here:_

**NFR-B1:**

- `grep -r "import * as THREE" src/` result: _tbd_
- Verdict: _tbd_

**NFR-B2:**

- Baseline bundle gzip total: _tbd_ bytes
- Post-feature bundle gzip total: _tbd_ bytes
- Delta: _tbd_ bytes (_tbd_ KB)
- Budget: 51,200 bytes (50KB)
- Verdict: _tbd_

**Named Three.js imports (AC4):**

```
_tbd — paste grep output here_
```

### File List

_Files created/modified (to be filled by dev agent):_

- `vite.config.ts` — TEMPORARY: add/remove visualizer plugin for T6 (do not commit)
