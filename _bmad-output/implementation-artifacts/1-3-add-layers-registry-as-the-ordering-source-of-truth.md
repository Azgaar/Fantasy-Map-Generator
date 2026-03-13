# Story 1.3: Add Layers Registry as the Ordering Source of Truth

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want a centralized Layers registry,
so that visibility, order, and surface ownership are managed consistently instead of inferred from DOM position.

## Acceptance Criteria

1. Given logical map layers currently rely on DOM placement and ad hoc lookups, when a layer is registered, then the registry stores its `id`, `kind`, `order`, `visible` state, and surface handle, and callers can query layer state without inferring it from DOM order.
2. Given runtime layer order changes, when reorder operations are applied through the registry, then all registered layer surfaces receive the updated ordering atomically, and the registry remains the single source of truth for visibility and order.

## Tasks / Subtasks

- [ ] Create the Layers registry module.
  - [ ] Define the minimum record shape: `id`, `kind`, `order`, `visible`, `surface`.
  - [ ] Expose lookup and mutation APIs that are narrow enough to become the single ordering contract.
- [ ] Bootstrap the current layer stack into the registry.
  - [ ] Register the existing logical SVG layers in their current order.
  - [ ] Register the current WebGL surface path so mixed rendering already has a place in the model.
- [ ] Move order and visibility mutations behind the registry.
  - [ ] Replace direct DOM-order assumptions in the layer UI reorder path with registry updates.
  - [ ] Apply visibility changes through the registry without changing user-facing controls.
  - [ ] Ensure one coordinated apply step updates all affected surfaces together.
- [ ] Preserve compatibility for migration-era callers.
  - [ ] Keep existing layer IDs and toggle IDs stable.
  - [ ] Avoid forcing feature modules to understand renderer-specific ordering logic.
- [ ] Perform manual smoke verification.
  - [ ] Reordering through the existing Layers UI still changes the visible stack correctly.
  - [ ] Visibility toggles still map to the correct runtime surface.

## Dev Notes

### Context Summary

- The current reorder path is still DOM-driven. `public/modules/ui/layers.js` maps toggle IDs to concrete DOM groups in `getLayer(id)` and then calls `insertAfter` or `insertBefore` directly in `moveLayer`.
- The initial stack order is created in `public/main.js` by appending groups to `viewbox` in sequence. Older-map migration code in `public/modules/dynamic/auto-update.js` also inserts groups relative to concrete siblings such as `#terrain` and `#borders`.
- The registry has to become the source of truth without breaking those legacy IDs immediately. This story is about authoritative state ownership, not yet about fully removing all DOM-based insertion helpers.

### Technical Requirements

- Implement the registry in `src/` as a global module, likely `src/modules/layers.ts`.
- Keep the public contract minimal. Do not add export metadata yet; that belongs to Epic 4.
- Store actual surface handles, not just selectors, so later stories can mount independent SVG shells and WebGL surfaces under one contract.
- Ensure reorder application is atomic from the user perspective. Avoid partial states where one surface has moved and another has not.
- Keep the registry boring. No factory layers, schema systems, or speculative metadata beyond `id`, `kind`, `order`, `visible`, and `surface`.

### Architecture Compliance

- This story implements Decision 1 from the architecture: the Layers registry is the single source of truth for ordering and visibility.
- The runtime must support arbitrary future ordering of SVG and WebGL layers. Do not hard-code separate ordering buckets.
- The registry should own state; individual layer modules should not infer state from the DOM.

### Previous Story Intelligence

- Story 1.1 introduces stable runtime hosts; the registry should refer to those hosts rather than embedding DOM queries in each layer record.
- Story 1.2 centralizes shared transform state; do not mix camera ownership into the registry API.
- The current sortable UI already maps toggle IDs to concrete layer IDs in `getLayer(id)`. Preserve those IDs so Story 1.5 can bridge legacy callers cleanly.

### Project Structure Notes

- Expected touch points:
  - `src/modules/layers.ts`
  - `src/modules/index.ts`
  - `src/types/global.ts`
  - `public/modules/ui/layers.js`
  - `public/main.js`
  - `public/modules/dynamic/auto-update.js`
- Keep migration focused. Do not rewrite every legacy caller in this story.
- Keep the registry implementation in `src/` and expose only the smallest legacy-facing hooks needed in `public/modules/ui/layers.js`.

### Testing Notes

- Manual verification is sufficient for this tranche.
- Verify the existing sortable Layers UI still works and that no layer disappears from the visible stack after a reorder.
- Do not add Playwright coverage or new automated test infrastructure in this story.

### Dependencies

- Story 1.1 provides runtime host references.
- Story 1.2 provides the shared Scene contract that registry-managed surfaces will consume.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 1, Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md, Decision 1, Decision 2, Migration Plan]
- [Source: public/modules/ui/layers.js, `moveLayer` and `getLayer`]
- [Source: public/main.js, layer append order]
- [Source: public/modules/dynamic/auto-update.js, compatibility inserts relative to existing siblings]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

- Story context prepared on 2026-03-13.

### File List
