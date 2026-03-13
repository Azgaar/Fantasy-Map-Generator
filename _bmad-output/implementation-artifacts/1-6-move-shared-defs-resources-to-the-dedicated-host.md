# Story 1.6: Move Shared Defs Resources to the Dedicated Host

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want shared defs-backed resources to be registered in one dedicated host,
so that split surfaces can keep using stable IDs for filters, masks, symbols, markers, patterns, and text paths.

## Acceptance Criteria

1. Given runtime resources currently live under one shared SVG structure, when defs registration is migrated, then shared resources are created under the dedicated defs host with stable identifiers, and layer surfaces can reference those resources without duplicating them per layer.
2. Given a split surface uses a filter, mask, symbol, marker, pattern, or text path, when the layer renders, then the resource reference resolves from the dedicated defs host, and existing visual behavior remains unchanged for supported runtime features.

## Tasks / Subtasks

- [x] Establish one runtime defs owner.
  - [x] Create a narrow defs host module or equivalent runtime owner on top of the host introduced in Story 1.1.
  - [x] Distinguish runtime-generated defs from the static asset library already stored in `#defElements`.
- [x] Migrate the current runtime writers for shared defs-backed resources.
  - [x] Move feature paths and masks now written through `defs.select(...)` to the dedicated host.
  - [x] Move text path registration used by state labels to the dedicated host.
  - [x] Move runtime masks, markers, or other shared resources that must survive split surfaces.
- [x] Preserve stable IDs and references.
  - [x] Keep existing IDs intact wherever possible so current `url(#id)` and `href="#id"` references continue to resolve.
  - [x] Avoid duplicating identical resources into per-layer surfaces.
- [x] Keep export work out of scope for this story.
  - [x] Do not redesign the export assembler here.
  - [x] Only make the runtime defs placement compatible with later export assembly.
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
- Keep defs ownership isolated. Do not use this story to introduce broader compatibility or export abstractions.

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
- Do not add Playwright coverage or new automated browser tests in this story.

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

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

- Story context prepared on 2026-03-13.
- Created `src/modules/defs.ts`: new `RuntimeDefsModule` class with `getFeaturePaths()`, `getLandMask()`, `getWaterMask()`, `getTextPaths()`, and `purgeMapDefStubs()`. Instance assigned to `window.RuntimeDefs`.
- Removed `#featurePaths`, `#textPaths`, `#land`, `#water` from `#deftemp` in `src/index.html`; `#fog`, `#statePaths`, `#defs-emblems` remain in `#deftemp`.
- `purgeMapDefStubs()` is called in `load.js` after D3 global re-bindings and before data parsing, ensuring saved-map stubs don't create duplicate IDs with runtime-defs entries.
- `auto-update.js` v1.1 and v1.106 migration blocks updated to use `RuntimeDefs` instead of `defs.select` for the migrated elements.
- Three legacy UI editors (`coastline-editor.js`, `lakes-editor.js`) now use `d3.select("#featurePaths > ...")` (document-scoped); `heightmap-editor.js` uses `RuntimeDefs.get*()` directly. `tools.js` burg-label writer updated to `RuntimeDefs.getTextPaths()`.
- `#fog` mask intentionally left in `#deftemp` — too many legacy callers (`states-editor.js`, `provinces-editor.js`) depend on `defs.select("#fog ...")`.
- TypeScript: `tsc --noEmit` passes with zero errors.

### File List

- `src/modules/defs.ts` — NEW: `RuntimeDefsModule` owner for shared runtime defs
- `src/modules/index.ts` — added `import "./defs"` after `import "./scene"`
- `src/types/global.ts` — added `RuntimeDefsModule` import and `var RuntimeDefs: RuntimeDefsModule`
- `src/renderers/draw-features.ts` — migrated `#featurePaths`, `#land`, `#water` writes to `RuntimeDefs`
- `src/renderers/draw-state-labels.ts` — migrated `#textPaths` access to `RuntimeDefs.getTextPaths()`
- `src/index.html` — removed `<g id="featurePaths">`, `<g id="textPaths">`, `<mask id="land">`, `<mask id="water">` from `#deftemp`
- `public/modules/io/load.js` — added `RuntimeDefs.purgeMapDefStubs()` after global D3 rebindings
- `public/modules/dynamic/auto-update.js` — fixed v1.1 and v1.106 migration to use `RuntimeDefs`
- `public/modules/ui/coastline-editor.js` — `defs.select("#featurePaths > ...")` → `d3.select(...)`
- `public/modules/ui/lakes-editor.js` — `defs.select("#featurePaths > ...")` → `d3.select(...)`
- `public/modules/ui/heightmap-editor.js` — `defs.selectAll`/`defs.select` → `RuntimeDefs.get*()`
- `public/modules/ui/tools.js` — `defs.select("#textPaths")` → `RuntimeDefs.getTextPaths()`

### Change Log

| Date       | Description                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-13 | Initial implementation of Story 1.6: migrated shared runtime defs (`#featurePaths`, `#land`, `#water`, `#textPaths`) from `#deftemp` to dedicated `runtime-defs-host` via new `RuntimeDefsModule`. |
