# Story 1.2: Add Scene Module for Shared Camera State

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want a Scene module to own shared camera and viewport state,
so that all layer surfaces consume one authoritative transform contract.

## Acceptance Criteria

1. Given shared globals such as `scale`, `viewX`, `viewY`, `graphWidth`, and `graphHeight` already exist, when the Scene module is introduced, then it exposes a single runtime contract for camera and viewport state, and existing global values remain authoritative and usable during migration.
2. Given multiple surfaces will render the same map, when camera state changes, then the Scene module provides one consistent state source for all registered surfaces, and no feature code needs to read transforms from DOM structure directly.

## Tasks / Subtasks

- [x] Create a narrow Scene runtime module.
  - [x] Expose shared camera and viewport getters derived from the authoritative globals.
  - [x] Expose scene-host references established in Story 1.1 through the same contract.
- [x] Centralize transform ownership.
  - [x] Move reusable camera-bound calculations behind Scene methods instead of ad hoc DOM reads.
  - [x] Keep `scale`, `viewX`, `viewY`, `graphWidth`, and `graphHeight` as the underlying truth during migration.
- [x] Update runtime consumers that already operate across surfaces.
  - [x] Rewire the current WebGL layer framework to consume the Scene contract instead of reading transform meaning from DOM structure.
  - [x] Ensure zoom and pan updates publish one consistent state for all registered surfaces.
- [x] Keep compatibility intact.
  - [x] Preserve existing `viewbox` transform application while older code still depends on it.
  - [x] Do not break callers that still read the existing globals directly.
- [ ] Perform manual smoke verification.
  - [ ] Zoom and pan keep SVG and WebGL content aligned.
  - [ ] Startup and resize continue to use the correct viewport bounds.

## Dev Notes

### Context Summary

- `public/main.js` owns the current zoom flow: `onZoom` updates `scale`, `viewX`, and `viewY`, then `handleZoom` applies `viewbox.attr("transform", ...)` and triggers `WebGLLayer.rerender()`.
- `src/modules/webgl-layer.ts` already has `syncTransform()` logic that computes camera bounds from those globals. That logic is the best initial candidate to move behind a shared Scene contract instead of duplicating it elsewhere.
- The architecture requires Scene to own shared transform meaning while keeping the global values authoritative. This story should centralize interpretation, not rename the underlying globals.

### Technical Requirements

- Implement the Scene module in `src/` as a TypeScript global module and register it through `src/modules/index.ts`.
- Use bare ambient globals declared in `src/types/global.ts`. Do not introduce `window.scale` or `globalThis.viewX` usage.
- Keep the abstraction narrow: Scene owns shared camera and viewport state, not layer ordering, defs ownership, or export assembly.
- Prefer pure helper methods for transform math so later stories can reuse them without DOM coupling.
- Keep the module terse. Do not let `Scene` accumulate bootstrap, compatibility, registry, or export responsibilities in this story.

### Architecture Compliance

- This story implements the architecture decision that transform ownership moves from `#viewbox` to scene state.
- `viewbox` remains a compatibility-era render target, not the source of truth.
- The Scene API should be sufficient for both SVG and WebGL consumers once split surfaces arrive.
- Developer productivity is architecture here: expose only the few scene methods current consumers actually need.

### Previous Story Intelligence

- Story 1.1 should leave the runtime with stable scene-host and defs-host references. Reuse those references here instead of letting Scene rediscover DOM nodes on every call.
- Do not fold bootstrap ownership and camera ownership into one large module. Story 1.1 is about host setup; this story is about transform semantics.

### Project Structure Notes

- Expected touch points:
  - `src/modules/scene.ts`
  - `src/modules/index.ts`
  - `src/modules/webgl-layer.ts`
  - `public/main.js`
  - `src/types/global.ts`
- Keep any math helpers inside the Scene module unless there are multiple concrete callers that justify extraction.
- Keep the scene contract in `src/`; legacy `public/main.js` should consume it, not own a second parallel source of truth.

### Testing Notes

- Formal automated test work is out of scope for this tranche.
- Keep transform calculation logic pure enough for later coverage.
- Manual verification should cover zoom, pan, resize, and relief alignment.
- Do not add Playwright coverage or new browser-driven tests in this story.

### Dependencies

- Build on the runtime references introduced in Story 1.1.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 1, Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md, Decision 3, Runtime Structure, Migration Plan]
- [Source: docs/architecture-globals.md, `scale`, `viewX`, `viewY`, `graphWidth`, `graphHeight` globals]
- [Source: public/main.js, zoom pipeline and `handleZoom`]
- [Source: src/modules/webgl-layer.ts, `syncTransform()` and current camera ownership]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

### Completion Notes List

- Story context prepared on 2026-03-13.
- Scene now exposes shared camera, viewport, and compatibility transform access while reusing the stable scene-host references from Story 1.1.
- WebGL camera sync now consumes `Scene.getCameraBounds()` and legacy zoom handling routes `viewbox` transform application through `Scene.applyViewboxTransform()`.
- Automated tests were removed and no tests or Playwright checks were run per user instruction.
- Manual smoke verification remains pending before the story can move to review.

### File List

- public/main.js
- src/modules/scene.ts
- src/modules/webgl-layer.ts
- src/modules/scene.test.ts (removed)
