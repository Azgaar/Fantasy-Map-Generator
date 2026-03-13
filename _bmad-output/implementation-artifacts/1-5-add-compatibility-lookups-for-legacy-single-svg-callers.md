# Story 1.5: Add Compatibility Lookups for Legacy Single-SVG Callers

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want compatibility helpers for legacy single-SVG access patterns,
so that existing workflows keep working while code migrates to the new scene and layer contracts.

## Acceptance Criteria

1. Given legacy code still expects `svg`, `viewbox`, or one shared selector scope, when compatibility helpers are introduced, then the runtime provides `getLayerSvg(id)`, `getLayerSurface(id)`, and `queryMap(selector)`, and callers can continue to function during migration without depending on one canonical map SVG.
2. Given new code is added after the compatibility layer exists, when it needs layer or scene access, then it can use the new layer and scene contracts directly, and the compatibility layer remains a migration bridge rather than the new source of truth.

## Tasks / Subtasks

- [x] Add the compatibility bridge API.
  - [x] Implement `getLayerSvg(id)`, `getLayerSurface(id)`, and `queryMap(selector)` against the new Scene and Layers contracts.
  - [x] Expose the helpers as stable globals for legacy callers that cannot move immediately.
- [x] Type and document the bridge.
  - [x] Add ambient global declarations for the new helpers.
  - [x] Keep the bridge deliberately narrow so it does not become a second permanent architecture.
- [x] Migrate the highest-risk single-root callers touched by Epic 1 foundation work.
  - [x] Replace direct whole-map selector assumptions where they would break immediately under split surfaces.
  - [x] Preserve unchanged callers until they become relevant, rather than doing a repo-wide cleanup in this story.
- [x] Verify legacy workflows still function.
  - [x] Saved-map load and export paths still find required map elements.
  - [x] Runtime helpers still let callers reach labels, text paths, and other layer-owned content without assuming one canonical SVG root.

## Dev Notes

### Context Summary

- The codebase has many single-SVG assumptions. Current hotspots include:
  - `public/main.js` and `public/modules/io/load.js` rebinding `svg`, `defs`, and `viewbox`
  - `public/modules/io/save.js` and `public/modules/io/export.js` operating on `svg.node()` and `#viewbox`
  - `src/modules/fonts.ts`, where `getUsedFonts(svg)` queries `#labels` and `#legend` inside a single SVG root
  - `src/renderers/draw-state-labels.ts`, which appends text paths to `defs > g#deftemp > g#textPaths`
  - `public/modules/dynamic/auto-update.js`, which uses selectors such as `#viewbox > #routes > g`
- This story is a bridge. New code written for the layered runtime should use Scene and Layers directly.

### Technical Requirements

- Implement the compatibility API in `src/` so it is typed and globally available to both TypeScript and legacy JS.
- Return real layer surfaces or layer-local SVG roots where available. Do not fake a new canonical SVG document.
- `queryMap(selector)` should be controlled and predictable. It must not silently reintroduce global DOM coupling as a hidden permanent pattern.
- Preserve current IDs and selectors where possible so callers can migrate incrementally.
- Keep the bridge thin and temporary. Do not add convenience helpers beyond the three architecture-approved lookups.

### Architecture Compliance

- This story implements Decision 4 from the architecture: a thin compatibility layer for migration-era callers.
- The compatibility API must not become the new source of truth. Scene and Layers remain authoritative.
- The goal is operational continuity for legacy workflows while the map DOM is being split.

### Previous Story Intelligence

- Story 1.3 should already provide registry-backed layer lookup. Build `getLayerSurface(id)` on that instead of re-querying the DOM.
- Story 1.4 should already wrap surfaces in lifecycle ownership. Compatibility helpers should return current owned surfaces, not bypass the lifecycle layer.
- Story 1.1 should already provide stable host references after load and reload. Reuse those references for `queryMap(selector)` resolution order.

### Project Structure Notes

- Expected touch points:
  - `src/modules` or `src/utils` compatibility bridge module
  - `src/types/global.ts`
  - `src/modules/fonts.ts`
  - `src/renderers/draw-state-labels.ts`
  - `public/modules/io/save.js`
  - `public/modules/io/export.js`
  - `public/modules/io/load.js`
- Only migrate the callers that the new foundation stories would otherwise break.
- Keep the bridge in one place in `src/`; do not sprinkle ad hoc fallback selector logic across legacy files.

### Testing Notes

- Manual verification is sufficient.
- Validate save/export, labels/text paths, and at least one legacy selector-heavy workflow after the helpers are introduced.
- Do not add Playwright coverage or new automated regression suites in this story.

### Dependencies

- Requires Scene and Layers to exist first so the compatibility helpers can delegate to the real runtime contracts.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 1, Story 1.5]
- [Source: _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md, Decision 3, Decision 4]
- [Source: public/modules/io/load.js, global rebinding after map replacement]
- [Source: public/modules/io/export.js, single-SVG export assumptions]
- [Source: public/modules/io/save.js, `getUsedFonts(svg.node())` and `#viewbox` assumptions]
- [Source: src/modules/fonts.ts, single-SVG font collection]
- [Source: src/renderers/draw-state-labels.ts, defs and text path assumptions]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

- Story context prepared on 2026-03-13.
- Created `src/modules/map-compat.ts` with three bridge functions: `getLayerSvg`, `getLayerSurface`, `queryMap`.
- `getLayerSvg(id)` delegates to `Layers.get(id)?.surface` and walks up to the SVG root via `closest("svg")`.
- `getLayerSurface(id)` delegates directly to `Layers.get(id)?.surface`.
- `queryMap(selector)` scopes the CSS selector to `Scene.getMapSvg()` instead of the whole document.
- Added `import "./map-compat"` to `src/modules/index.ts` after `layers` (dependency order).
- Migrated `src/renderers/draw-state-labels.ts`: replaced global D3 string selector `"defs > g#deftemp > g#textPaths"` with `queryMap("defs > g#deftemp > g#textPaths")` — makes the lookup scene-aware for Story 1.6 defs relocation.
- Legacy callers in `save.js`, `export.js`, and `load.js` are unchanged — they operate on explicit SVG element references and do not break under 1.1–1.4 foundation work.
- All TypeScript checks pass with zero errors on changed files.

### File List

- `src/modules/map-compat.ts` — created (compatibility bridge)
- `src/modules/index.ts` — import added
- `src/renderers/draw-state-labels.ts` — pathGroup selector migrated to `queryMap`
