# Story 1.1: Bootstrap Scene Container and Defs Host

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want runtime initialization to create a dedicated scene container and defs host,
so that split layer surfaces can share resources without depending on one map SVG root.

## Acceptance Criteria

1. Given the current runtime starts from one canonical map host, when the layered runtime bootstrap runs, then it creates or reuses a dedicated scene container for layer surfaces and a dedicated defs host outside individual layer surfaces, and the visible map loads without user-facing regressions at startup.
2. Given existing code expects the map to initialize once, when the new bootstrap path is enabled, then the scene container and defs host are available through stable runtime references, and initialization does not require changing user-facing layer controls.

## Tasks / Subtasks

- [ ] Audit the current bootstrap ownership before changing runtime structure.
  - [ ] Confirm which DOM nodes already exist in the HTML shell and which are still assumed to be canonical at runtime.
  - [ ] Inventory the startup and load paths that currently rebind `svg`, `defs`, and `viewbox` globals.
- [ ] Create or reuse the layered runtime hosts.
  - [ ] Establish one scene container under the map host for layer surfaces.
  - [ ] Establish one dedicated runtime defs host outside individual layer surfaces.
  - [ ] Preserve the existing WebGL canvas mount so current relief rendering does not regress during the bootstrap change.
- [ ] Publish stable references for the new hosts.
  - [ ] Expose bootstrap references through one runtime owner instead of scattering raw DOM lookups.
  - [ ] Keep legacy globals working during the transition without making them the new source of truth.
- [ ] Update startup and saved-map reload to reuse the new hosts instead of assuming the initial DOM is always present.
  - [ ] Keep existing layer controls and initial draw order unchanged.
  - [ ] Ensure load-from-file can rebuild host references after replacing the map SVG.
- [ ] Perform manual smoke verification.
  - [ ] Fresh page load renders normally.
  - [ ] Loading an existing map still rebinds all required runtime references.
  - [ ] Relief canvas and fixed UI elements remain correctly mounted.

## Dev Notes

### Context Summary

- The HTML shell already contains a positioned `#map-container`, the main `#map` SVG, and a sibling `#webgl-canvas`. Do not duplicate those elements if they can be reused as the scene bootstrap root.
- The current runtime still treats the map SVG as canonical: `public/main.js` binds `svg = d3.select("#map")`, `defs = svg.select("#deftemp")`, and `viewbox = svg.select("#viewbox")` during startup.
- The saved-map load path tears out and reinserts the SVG, then rebinds all global layer selections in `public/modules/io/load.js`. Any new scene bootstrap must survive that path.
- There is already a second hidden SVG asset host at `#defElements` in the HTML shell. Treat that as a static asset library, not automatically as the new runtime defs host.

### Technical Requirements

- Reuse existing DOM nodes when practical. The acceptance criteria require stable runtime references, not a full DOM redesign in this story.
- Keep the runtime compatible with the current global-variable model. New TypeScript code must use ambient globals directly, not `window` or `globalThis` wrappers.
- New TypeScript modules must follow the project Global Module Pattern: declare global, implement a class, then assign `window.ModuleName = new ModuleClass()`.
- Avoid grouped SVG buckets or speculative abstractions here. The goal is bootstrap ownership only.

### Architecture Compliance

- This story is the Phase 1 foundation from the layered-map architecture: create one scene container, one defs host, and stable references before any layer split begins.
- `svg` and `viewbox` remain compatibility-era globals after this story. They must stop being the architectural source of truth, but they are not removed yet.
- The runtime defs host must live outside individual layer surfaces so later split SVG shells can reference shared resources by stable ID.

### Project Structure Notes

- Expected touch points:
  - `src/index.html`
  - `public/main.js`
  - `public/modules/io/load.js`
  - `src/types/global.ts`
- Expected new module if needed:
  - `src/modules/scene.ts` or a similarly narrow runtime bootstrap owner
- Do not add a separate helper file unless multiple call sites genuinely need it.
- Keep new foundation code in `src/`; do not add new runtime architecture code to `public/modules/`.

### Testing Notes

- The architecture document explicitly defers formal test work for this tranche.
- Do manual verification for fresh load, saved-map load, and relief visibility.
- If a pure helper is extracted while implementing bootstrap ownership, keep it testable, but do not expand scope into a new test suite in this story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 1, Story 1.1]
- [Source: _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md, Core Decisions, Runtime Structure, Migration Plan]
- [Source: docs/architecture-globals.md, main.js globals and module loading order]
- [Source: src/index.html, `#map-container`, `#map`, `#webgl-canvas`, `#defElements`]
- [Source: public/main.js, bootstrap globals and initial layer append order]
- [Source: public/modules/io/load.js, saved-map SVG replacement and global rebinding]

## Dev Agent Record

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

- Story context prepared on 2026-03-13.

### File List
