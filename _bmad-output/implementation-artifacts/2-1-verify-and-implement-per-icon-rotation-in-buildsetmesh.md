# Story 2.1: Verify and Implement Per-Icon Rotation in buildSetMesh

**Status:** done
**Epic:** 2 — Relief Icons Layer Migration
**Story Key:** 2-1-verify-and-implement-per-icon-rotation-in-buildsetmesh
**Created:** 2026-03-12
**Developer:** _unassigned_

---

## Story

As a developer,
I want to verify that `buildSetMesh` in `draw-relief-icons.ts` correctly applies per-icon rotation from terrain data, and add rotation support if missing,
So that relief icons render with correct orientations matching the SVG baseline (FR15).

---

## Acceptance Criteria

**AC1:** Verify rotation status in `buildSetMesh`
**Given** the existing `buildSetMesh` implementation in `draw-relief-icons.ts`
**When** the developer reviews the vertex construction code
**Then** it is documented whether `r.i` (rotation angle) is currently applied to quad vertex positions

**AC2:** Add rotation if missing (conditional — only if a rotation value exists in the data)
**Given** rotation is NOT applied in the current `buildSetMesh`
**When** the developer adds per-icon rotation via vertex transformation (rotate the quad around its center point using the angle from `pack.relief[n].i`)
**Then** `buildSetMesh` produces correctly oriented quads and `npm run lint` passes

**AC3:** Rotation already present (skip code change)
**Given** rotation IS already applied in the current `buildSetMesh`
**When** verified
**Then** no code change is needed and this is documented in a code comment

**AC4:** Visual parity
**Given** the rotation fix is applied (if needed)
**When** a visual comparison is made between WebGL-rendered icons and SVG-rendered icons for a map with rotated terrain icons
**Then** orientations are visually indistinguishable

---

## Context

### What This Story Is

This is a **verification-first story**. The primary job is to inspect the current code and data structures, document the findings, and only make code changes if rotation support is genuinely missing AND the terrain dataset actually contains rotation values.

### Prerequisites

- Epic 1 (Stories 1.1–1.3) is complete. `WebGL2LayerFramework` is fully implemented in `src/modules/webgl-layer-framework.ts` with 85% test coverage.
- `draw-relief-icons.ts` still uses its own module-level `THREE.WebGLRenderer` (the full framework refactor happens in Story 2.2). This story only touches `buildSetMesh`.

### Files to Touch

| File                                 | Change                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderers/draw-relief-icons.ts` | ONLY `buildSetMesh` — add rotation if missing; add comment documenting verification                                                       |
| `src/modules/relief-generator.ts`    | ADD `rotation?: number` to `ReliefIcon` interface and populate in `generateRelief()` — only if the investigation shows rotation is needed |

**Do NOT touch:**

- `src/modules/webgl-layer-framework.ts` — not this story's concern
- `window.drawRelief`, `window.undrawRelief`, `window.rerenderReliefIcons` — Story 2.2 concern
- Any test file — Story 2.3 adds fallback tests; this story is investigation-only (no new tests required)

---

## Dev Notes

### Step 1: What You Will Find in the Code

**`ReliefIcon` interface (`src/modules/relief-generator.ts`)**:

```typescript
export interface ReliefIcon {
  i: number; // sequential icon index (= reliefIcons.length at push time)
  href: string; // e.g. "#relief-mount-1"
  x: number; // top-left x of the icon quad in map units
  y: number; // top-left y of the icon quad in map units
  s: number; // size: width = height (square icon)
}
```

**`generateRelief()` (`src/modules/relief-generator.ts`)** populates `i` as:

```typescript
reliefIcons.push({
  i: reliefIcons.length,   // ← sequential 0-based index; NOT a rotation angle
  href: icon,
  x: ..., y: ..., s: ...,
});
```

**`buildSetMesh()` (`src/renderers/draw-relief-icons.ts`)** uses:

```typescript
const x0 = r.x,
  x1 = r.x + r.s;
const y0 = r.y,
  y1 = r.y + r.s;
// r.i is NOT read anywhere in this function — only r.x, r.y, r.s, and tileIndex
```

**`drawSvg()`** uses `r.i` only as a DOM attribute:

```html
<use href="${r.href}" data-id="${r.i}" x="${r.x}" y="${r.y}" width="${r.s}" height="${r.s}" />
```

The SVG renderer applies NO rotation transform. `r.i` is used only as `data-id` for interactive editing (legacy editor uses it to click-select icons).

### Step 2: Expected Finding

`r.i` is a **sequential icon index** (0, 1, 2, …), not a rotation angle. The terrain dataset has no rotation field. Neither `buildSetMesh` (WebGL) nor `drawSvg` (SVG fallback) applies per-icon rotation.

**Consequence for FR15 and FR19:**

- FR15 states "rotation as defined in the terrain dataset" — with no rotation field in the dataset, zero rotation is both the current and correct behavior.
- FR19 (visual parity) is fully satisfied: both paths produce identical unrotated icons.
- No rotation code change is required for MVP.

### Step 3: Documentation Requirement (Mandatory)

Add a code comment in `buildSetMesh` at the point where vertex positions are calculated, documenting the verification result:

```typescript
// FR15 rotation verification (Story 2.1): r.i is a sequential icon index (0-based),
// NOT a rotation angle. pack.relief entries contain no rotation field.
// Both the WebGL path (this function) and the SVG fallback (drawSvg) produce
// unrotated icons — visual parity maintained per FR19.
// If per-icon rotation is required in a future story, add `rotation: number` (radians)
// to ReliefIcon and apply quad rotation around center (r.x + r.s/2, r.y + r.s/2).
```

### Step 4: IF Rotation Field Exists (Edge Case Handling)

If, during investigation, you find that the **browser's live `pack.relief` data** (the global `pack` object from legacy JS) contains a rotation angle in a field that isn't typed in `ReliefIcon`, then add rotation support as follows:

**A. Update `ReliefIcon` interface:**

```typescript
export interface ReliefIcon {
  i: number;
  href: string;
  x: number;
  y: number;
  s: number;
  rotation?: number; // ADD: rotation angle in radians (0 = no rotation)
}
```

**B. Update `generateRelief()` to populate rotation:**

```typescript
reliefIcons.push({
  i: reliefIcons.length,
  href: icon,
  x: rn(cx - h, 2),
  y: rn(cy - h, 2),
  s: rn(h * 2, 2),
  rotation: 0 // Currently always 0; field added for FR15 forward-compatibility
});
```

**C. Implement quad rotation in `buildSetMesh`:**

```typescript
for (const {icon: r, tileIndex} of entries) {
  // ... UV calculation unchanged ...

  const cx = r.x + r.s / 2; // quad center X
  const cy = r.y + r.s / 2; // quad center Y
  const angle = r.rotation ?? 0; // radians; 0 = no rotation
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Helper: rotate point (px, py) around (cx, cy)
  const rot = (px: number, py: number): [number, number] => [
    cx + (px - cx) * cos - (py - cy) * sin,
    cy + (px - cx) * sin + (py - cy) * cos
  ];

  const [ax, ay] = rot(r.x, r.y); // top-left
  const [bx, by] = rot(r.x + r.s, r.y); // top-right
  const [ex, ey] = rot(r.x, r.y + r.s); // bottom-left
  const [fx, fy] = rot(r.x + r.s, r.y + r.s); // bottom-right

  const base = vi;
  positions.set([ax, ay, 0], vi * 3);
  uvs.set([u0, v0], vi * 2);
  vi++;
  positions.set([bx, by, 0], vi * 3);
  uvs.set([u1, v0], vi * 2);
  vi++;
  positions.set([ex, ey, 0], vi * 3);
  uvs.set([u0, v1], vi * 2);
  vi++;
  positions.set([fx, fy, 0], vi * 3);
  uvs.set([u1, v1], vi * 2);
  vi++;
  indices.set([base, base + 1, base + 3, base, base + 3, base + 2], ii);
  ii += 6;
}
```

**D. Update `drawSvg` to maintain parity (REQUIRED if WebGL gets rotation):**

```html
<use
  href="${r.href}"
  data-id="${r.i}"
  x="${r.x}"
  y="${r.y}"
  width="${r.s}"
  height="${r.s}"
  transform="${r.rotation ? `rotate(${(r.rotation * 180 / Math.PI).toFixed(1)},${r.x + r.s/2},${r.y + r.s/2})` : ''}"
/>
```

> **Critical:** SVG and WebGL must always match. If rotation is added to WebGL, it MUST also be added to SVG. Asymmetric rotation breaks FR19.

### Lint Rules to Follow

- `import * as THREE from "three"` — **Do NOT touch import style in this story.** The full import refactor is Story 2.2's job. Only touch `buildSetMesh` vertex code.
- `Number.isNaN()` not `isNaN()`
- All math: use `const` for intermediate values; use `rn(val, 2)` for rounded map coordinates if storing in the `ReliefIcon` object

### What NOT to Do

- Do NOT touch `ensureRenderer()`, `renderFrame()`, `drawWebGl()`, or window globals — Story 2.2
- Do NOT add Vitest tests — this story has no test deliverable
- Do NOT change the Three.js import style — Story 2.2
- Do NOT remove the module-level `renderer` variable — Story 2.2

---

## Tasks

- [x] **T1:** Read and understand `src/modules/relief-generator.ts`
  - [x] T1a: Read `ReliefIcon` interface — document what `i` field contains
  - [x] T1b: Read `generateRelief()` function — confirm `i: reliefIcons.length` (sequential index, not rotation)

- [x] **T2:** Read and understand `buildSetMesh` in `src/renderers/draw-relief-icons.ts`
  - [x] T2a: Confirm `r.i` is NOT read in vertex construction code
  - [x] T2b: Confirm rotation is absent from both positions and UV arrays

- [x] **T3:** Read `drawSvg` — confirm SVG renderer also applies zero rotation (no `transform` attribute on `<use>`)

- [x] **T4:** Decision branch
  - [x] T4a: If NO rotation field in dataset → proceed to T5 (documentation only, no code change)
  - [ ] T4b: If rotation field EXISTS in live browser `pack.relief` data → implement rotation per Dev Notes Step 4 (N/A — no rotation field found)

- [x] **T5:** Add verification comment in `buildSetMesh` documenting the FR15 investigation finding (see Dev Notes Step 3 for exact comment text)

- [x] **T6:** `npm run lint` — zero errors

- [x] **T7:** Update this story status to `done`

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (GitHub Copilot)

### Debug Log References

_None — no implementation errors encountered._

### Completion Notes List

- **T1–T3 (Investigation):** `ReliefIcon.i` is a sequential 0-based index (`reliefIcons.length` at push time). Never read in `buildSetMesh` vertex construction. `drawSvg` uses `r.i` only as `data-id` — no rotation transform applied.
- **T4 Decision (T4a):** No rotation field in terrain dataset. Path T4b is N/A. Visual parity (FR19) maintained — both renderers produce identical unrotated icons.
- **T5:** Added 5-line FR15 verification comment in `buildSetMesh` immediately before vertex position declarations.
- **T6:** `npm run lint` → `Checked 80 files in 98ms. No fixes applied.` ✅
- **AC1 ✅** — documented that `r.i` is sequential index, not rotation angle
- **AC2 N/A** — rotation field absent; no code change needed
- **AC3 ✅** — documented in comment: no rotation in code, no rotation in data
- **AC4 ✅** — visual parity confirmed: both paths produce identical unrotated icons

### File List

- `src/renderers/draw-relief-icons.ts` — FR15 verification comment added to `buildSetMesh` vertex loop
