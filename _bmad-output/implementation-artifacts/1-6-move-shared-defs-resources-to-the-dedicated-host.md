# Story 1.6: Move Shared Defs Resources to the Dedicated Host

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want shared defs-backed resources to be registered in one dedicated host,
so that split surfaces can keep using stable IDs for filters, masks, symbols, markers, patterns, and text paths.

## Acceptance Criteria

1. Given runtime resources currently live under one shared SVG structure, when defs registration is migrated, then shared resources are created under the dedicated defs host with stable identifiers, and layer surfaces can reference those resources without duplicating them per layer.
2. Given a split surface uses a filter, mask, symbol, marker, pattern, or text path, when the layer renders, then the resource reference resolves from the dedicated defs host, and existing visual behavior remains unchanged for supported runtime features.

## Tasks / Subtasks

- [ ] Establish one runtime defs owner.
  - [ ] Create a narrow defs host module or equivalent runtime owner on top of the host introduced in Story 1.1.
  - [ ] Distinguish runtime-generated defs from the static asset library already stored in `#defElements`.
- [ ] Migrate the current runtime writers for shared defs-backed resources.
  - [ ] Move feature paths and masks now written through `defs.select(...)` to the dedicated host.
  - [ ] Move text path registration used by state labels to the dedicated host.
  - [ ] Move runtime masks, markers, or other shared resources that must survive split surfaces.
- [ ] Preserve stable IDs and references.
  - [ ] Keep existing IDs intact wherever possible so current `url(#id)` and `href="#id"` references continue to resolve.
  - [ ] Avoid duplicating identical resources into per-layer surfaces.
- [ ] Keep export work out of scope for this story.
  - [ ] Do not redesign the export assembler here.
  - [ ] Only make the runtime defs placement compatible with later export assembly.
- [ ] Perform manual smoke verification.
  - [ ] Filters, masks, symbols, markers, patterns, and text-path-backed labels still render.
  - [ ] Mixed runtime resources still resolve after startup and after loading a saved map.

## Dev Notes

### Context Summary

- The current runtime writes shared resources into the main map defs tree. `public/main.js` binds `defs = svg.select("#deftemp")`.
- Current high-risk shared defs writers include:
  - `src/renderers/draw-features.ts` writing `#featurePaths`, `#land`, and `#water`
  - `src/renderers/draw-state-labels.ts` writing text paths under `defs > g#deftemp > g#textPaths`
  - `public/modules/dynamic/auto-update.js` appending masks such as `#fog`
  - `src/modules/emblem/renderer.ts` and export code that rely on stable symbol/pattern IDs
- The HTML shell also contains `#defElements`, a hidden SVG used as a static resource library for markers, relief symbols, and similar assets. Do not collapse static asset storage and runtime-generated shared defs into one accidental abstraction.

### Technical Requirements

- Keep resource IDs stable. The migration should change ownership, not the externally referenced names.
- The dedicated defs host must be reachable by all layer surfaces after the map DOM is split.
- Prefer one focused defs owner module over scattered DOM writes.
- Avoid changing export behavior in this story beyond what is necessary to keep runtime resources consistent for later work.

### Architecture Compliance

- This story implements the architecture decision that runtime shared defs live in a dedicated host separate from layer surfaces.
- Shared defs are a first-class requirement for later split layers and export assembly.
- Runtime and export are separate pipelines; this story only handles runtime ownership.

### Previous Story Intelligence

- Story 1.1 should already establish the dedicated runtime defs host. Reuse that host instead of creating another hidden SVG container.
- Story 1.5 should already provide compatibility lookups for legacy defs consumers. Use that bridge for remaining migration-era callers rather than leaving direct `svg.select("#deftemp")` assumptions behind.
- Story 1.3 and Story 1.4 should already make surface ownership explicit. Keep defs ownership separate from layer lifecycle ownership.

### Project Structure Notes

- Expected touch points:
  - `src/modules/defs.ts` or equivalent narrow owner
  - `src/modules/index.ts`
  - `src/types/global.ts`
  - `public/main.js`
  - `src/renderers/draw-features.ts`
  - `src/renderers/draw-state-labels.ts`
  - `public/modules/dynamic/auto-update.js`
  - `public/modules/io/export.js`
- Keep changes focused on shared defs ownership. Do not start split-layer rendering in this story.
- Keep static resource assets in the existing HTML asset library and move only runtime-generated shared defs into the new owner.

### Testing Notes

- Manual validation is sufficient.
- Check at least one feature path mask, one text-path label case, one marker or symbol reference, and fogging/filter behavior.

### Dependencies

- Story 1.1 must establish the dedicated runtime defs host first.
- Story 1.5 should land before or alongside this story if compatibility callers still search the old defs tree.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 1, Story 1.6]
- [Source: _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md, Decision 2, Decision 4, Shared Resource Strategy, Migration Plan]
- [Source: public/main.js, current `defs = svg.select("#deftemp")` binding]
- [Source: src/renderers/draw-features.ts, feature paths and masks in defs]
- [Source: src/renderers/draw-state-labels.ts, text paths in defs]
- [Source: public/modules/dynamic/auto-update.js, runtime mask creation]
- [Source: src/index.html, `#deftemp` and `#defElements`]
- [Source: public/modules/io/export.js, current defs cloning and cleanup]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

- Story context prepared on 2026-03-13.

### File List
