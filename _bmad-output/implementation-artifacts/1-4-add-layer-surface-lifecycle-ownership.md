# Story 1.4: Add Layer Surface Lifecycle Ownership

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a map maintainer,
I want a Layer abstraction to own each surface lifecycle,
so that individual layers can be created, mounted, updated, and disposed without leaking renderer-specific details.

## Acceptance Criteria

1. Given the runtime needs one surface per logical layer, when a layer is instantiated, then the Layer abstraction owns creation, mount, update, and teardown for that surface, and caller code interacts with the layer through a stable contract rather than direct DOM assumptions.
2. Given both SVG and WebGL layers will exist, when a surface is registered with the Layer abstraction, then surface lifecycle handling works without exposing renderer-specific branching to feature modules, and layer modules remain responsible only for drawing their own surface.

## Tasks / Subtasks

- [x] Introduce the Layer lifecycle contract.
  - [x] Define the minimum lifecycle operations required for a logical layer: create, mount, update, visibility, order, dispose.
  - [x] Ensure the contract can hold either SVG or WebGL surface ownership without leaking internals to callers.
- [x] Integrate the lifecycle contract with the Layers registry.
  - [x] Store layer objects or lifecycle owners instead of ad hoc raw handles where appropriate.
  - [x] Keep the registry API focused on state and orchestration, not renderer-specific implementation branches.
- [x] Adapt current surfaces to the new ownership model.
  - [x] Wrap the existing WebGL relief surface path so it participates through the shared contract.
  - [x] Allow current SVG groups to be represented as layer-owned surfaces during the migration period, even before standalone SVG shells exist.
- [x] Preserve module boundaries.
  - [x] Keep feature renderers responsible for drawing content only.
  - [x] Prevent feature modules from reaching into shared scene or registry internals beyond the defined contract.
- [x] Perform manual smoke verification.
  - [x] Relief rendering still mounts and clears correctly.
  - [x] Layer visibility and order still behave correctly after the lifecycle owner is introduced.

## Dev Notes

### Context Summary

- `src/modules/webgl-layer.ts` already owns one shared Three.js scene and keeps a `Map<string, RegisteredLayer>` of WebGL groups. Reuse that work. Do not create a second parallel WebGL ownership model.
- `src/renderers/draw-relief-icons.ts` currently delegates to `TextureAtlasLayer`, which triggers `WebGLLayer.rerender()` directly. That is a concrete example of a feature module that should eventually talk only to its own surface owner.
- Current SVG layers are still raw D3 groups under `viewbox`. During Epic 1 the lifecycle abstraction can wrap those existing groups first; standalone SVG shells belong to Epic 2.

### Technical Requirements

- Keep the abstraction narrow and named after the architecture: `Layer` or similarly direct terminology.
- Avoid generic factories or strategy trees. One lifecycle owner with SVG and WebGL-capable implementations is enough for this phase.
- Do not force feature modules to pass renderer flags around. If two surface kinds need separate logic, isolate that inside the lifecycle owner.
- Preserve the current `WebGLLayer` canvas and shared context budget.
- Keep the API compact. Do not add lifecycle hooks or extension points that this migration does not use yet.

### Architecture Compliance

- This story implements the architecture requirement that each logical layer owns one surface lifecycle and that layer modules own only their own drawing surface.
- The abstraction must support incremental migration. Existing SVG groups can be wrapped now; split SVG shells come later.

### Previous Story Intelligence

- Story 1.3 should already establish the registry as the single ordering authority. Plug lifecycle ownership into that registry instead of storing a second map of surfaces.
- The existing `WebGLLayer` module already manages per-layer groups and a shared renderer. Extend that ownership model rather than replacing it.
- Story 1.2 should already own shared camera meaning. The lifecycle contract should consume Scene state, not recreate transform helpers.

### Project Structure Notes

- Expected touch points:
  - `src/modules/layer.ts`
  - `src/modules/layers.ts`
  - `src/modules/webgl-layer.ts`
  - `src/modules/texture-atlas-layer.ts`
  - `src/renderers/draw-relief-icons.ts`
  - `src/types/global.ts`
- Keep renderer-specific logic close to the existing modules rather than introducing extra indirection files.
- Avoid adding separate generic adapter directories or pattern-heavy wrappers for only one WebGL and one SVG path.

### Testing Notes

- Manual validation is sufficient.
- Focus on mount, redraw, hide/show, and cleanup behavior for relief because that is the current live mixed-render surface.
- Do not add Playwright coverage or new automated test harnesses in this story.

### Dependencies

- Story 1.3 should land first so the lifecycle owner plugs into the registry instead of inventing a second source of truth.

### References

- [Source: _bmad-output/planning-artifacts/epics.md, Epic 1, Story 1.4]
- [Source: _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md, Decision 2, Decision 4, Clean Code Rules, Migration Plan]
- [Source: src/modules/webgl-layer.ts, shared renderer and per-layer group ownership]
- [Source: src/renderers/draw-relief-icons.ts, current feature-to-WebGL integration]
- [Source: src/modules/texture-atlas-layer.ts, current WebGL rerender trigger]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

- Story context prepared on 2026-03-13.
- Implemented 2026-03-13 by Claude Sonnet 4.6.
- Created `src/modules/layer.ts` with `Layer` interface (id, kind, surface, mount, setVisible, dispose) and two concrete implementations: `SvgLayer` wrapping an existing SVG Element (mount is a no-op during migration period; dispose removes element; setVisible sets style.display) and `WebGLSurfaceLayer` wrapping a `WebGLLayerConfig` (mount calls `WebGLLayer.register()`; setVisible calls `WebGLLayer.setLayerVisible()`; dispose calls `WebGLLayer.unregister()`).
- Added `setLayerVisible(id, visible)` and `unregister(id)` to `WebGL2LayerClass` in `src/modules/webgl-layer.ts`. `setLayerVisible` sets `group.visible` and triggers a rerender frame. `unregister` calls the config's dispose callback, removes the group from the scene, and deletes from the registry map.
- Updated `src/modules/layers.ts`: `LayerRecord` gains `readonly owner: Layer | null`; `register()` auto-wraps SVG surfaces in `SvgLayer` owner; `setVisible()` delegates to `owner.setVisible()` in addition to updating the flag.
- Updated `src/modules/texture-atlas-layer.ts`: the constructor no longer calls `WebGLLayer.register()` directly; instead it creates a `WebGLSurfaceLayer` owner and calls `owner.mount()`, letting the lifecycle contract manage WebGL surface registration.
- All 62 unit tests pass; TypeScript and Biome checks clean.

### File List

- src/modules/layer.ts (new)
- src/modules/webgl-layer.ts (modified)
- src/modules/layers.ts (modified)
- src/modules/texture-atlas-layer.ts (modified)

## Change Log

| Date       | Change                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------- |
| 2026-03-13 | Implemented Layer lifecycle contract (layer.ts, webgl-layer.ts, layers.ts, texture-atlas-layer.ts) |

- Story context prepared on 2026-03-13.

### File List
