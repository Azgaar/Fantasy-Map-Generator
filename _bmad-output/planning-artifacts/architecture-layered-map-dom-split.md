---
status: complete
workflowType: architecture
project_name: Fantasy-Map-Generator
user_name: Azgaar
date: 2026-03-12
inputDocuments:
  - _bmad-output/planning-artifacts/prd-layered-map-dom-split.md
  - docs/architecture-globals.md
---

# Architecture Decision Document - Per-Layer SVG Map Architecture

**Project:** Fantasy-Map-Generator
**Author:** Azgaar (via Winston/Architect)
**Date:** 2026-03-12
**Status:** Complete

## 1. Architectural Intent

The current map is one SVG with one `#viewbox`, one shared `<defs>` space, and many callers that treat that structure as the application model. The new architecture separates those concerns. The application model becomes a **layered map scene**. Rendering is only one implementation detail of that scene.

The solution is deliberately simple:

- one authoritative layer registry
- one shared scene state for camera and map data
- one surface per logical layer
- one compatibility layer for legacy single-SVG assumptions
- one export assembler that rebuilds a unified SVG when needed

This avoids over-engineering. We do not introduce a generic rendering engine, a plugin DSL, or a second parallel layer system.

## 2. Core Decisions

### Decision 1: Introduce `Layers` as the Single Source of Truth

Every logical layer is registered once with:

- `id`
- `kind`: `svg` or `webgl`
- `order`
- `visible`
- `surface`

All reordering, toggling, and lookup operations go through this registry. No feature code should infer order from DOM position.

### Decision 2: Replace One Map SVG with a Scene Container and Layer Surfaces

`#layers` remains the outer host. Inside it, the runtime scene is a stack of independent surfaces.

- SVG-backed layers render into their own `<svg data-layer="..."></svg>` shell
- WebGL-backed layers render into registered canvas surfaces
- a dedicated defs host is kept separate from individual layer surfaces

This makes SVG and WebGL peers in the same scene instead of special cases.

### Decision 3: Move Shared Transform Ownership from `#viewbox` to Scene State

Zoom, pan, viewport size, graph bounds, and scale remain shared globals because the project already depends on that runtime model. What changes is their meaning.

- `scale`, `viewX`, `viewY`, `graphWidth`, `graphHeight` remain authoritative scene values (all available on `window` as before)
- `svg` and `viewbox` stop being the architectural source of truth
- legacy code that still needs them is routed through a temporary compatibility layer until it can move to scene or layer lookups

The clean-code rule here is narrow ownership: scene state owns transforms, surfaces consume transforms. High-level scene orchestration manages the rest. No direct DOM queries for camera state, no direct `viewbox` manipulation outside of the compatibility layer. Clean non-leaking abstractions that do one thing.

### Decision 4: Add a Thin Compatibility Layer for Existing Single-SVG Callers

The current codebase depends heavily on single-root access patterns. That is a migration problem, not a reason to keep the old architecture.

Add a minimal compatibility layer that exposes:

- `getLayerSvg(id)`
- `getLayerSurface(id)`
- `queryMap(selector)` for controlled cross-layer queries

This layer exists only to support migration. New code should talk to `Layers`, not to old DOM shortcuts.

### Decision 5: Runtime Rendering and Export Rendering Are Different Pipelines

The live DOM no longer needs to be the export document. Moveover, after the change DOM becomes just an implementation detail of the runtime, not the application model. Save files (.map) won't contain svg anymore, just data and registry state.

- runtime uses split surfaces for layering flexibility and simpler ownership
- export assembles one SVG from registry order, layer outputs, and shared defs resources

This is the only clean way to preserve export fidelity once the runtime is no longer a single SVG.

## 3. Runtime Structure

The target runtime shape is:

```html
<div id="map">
  <div id="scene">
    <svg data-layer="ocean"></svg>
    <svg data-layer="lakes"></svg>
    <canvas data-layer="terrain"></canvas>
    <svg data-layer="routes"></svg>
    <svg data-layer="labels"></svg>
    <div data-layer="fog"></div>
  </div>
  <div id="fixed-elements">
    <div id="scaleBar"></div>
    <div id="legend"></div>
    <div id="vignette"></div>
  </div>
  <svg id="defs" aria-hidden="true"></svg>
</div>
```

Important constraint: no grouped SVG buckets. Each logical layer gets its own surface so user-defined ordering stays arbitrary.

## 4. Shared Resource Strategy

The architecture uses a **dedicated defs host** at runtime.

- filters, patterns, masks, symbols, markers, and text paths are registered there
- layer SVGs reference those resources by stable IDs
- export clones only the resources actually used by exported layers into the final assembled SVG

This keeps runtime simple and export deterministic.

## 5. Clean Code Rules for This Change

This solution follows a simple clean-code approach:

- keep abstractions narrow and named after graphical software concepts: scene, camera, layer, surface, defs, export assembler
- do not let abstractions leak implementation details such as DOM structure, render technology, or shared state management
- do not add generic factories, strategy trees, or metadata schemas beyond what the current migration needs
- do not let feature code query random DOM globally when a layer or defs lookup exists
- do not hide behavior behind flags when two separate concepts deserve two separate functions
- keep layer modules responsible only for drawing their own surface
- use simple JS-style names, prefer 1-2 words

Preferred module ownership:

- `scene`: shared runtime state
- `layers`: layer registry
- `layer`: one layer surface and local lifecycle
- `defs`: shared SVG resources

## 6. Migration Plan

### Phase 1: Foundation

- migrate shared svg element resources to a dedicated defs host
- create `Scene` module for shared runtime state and camera management
- create `Layers` module for layer registry
- create `Layer` module for individual layer state and surface ownership
- add compatibility lookups for current `svg`, `viewbox`, and shared query patterns

### Phase 2: First Split Layers

- move low-risk SVG layers to standalone SVG shells
- keep their visual behavior unchanged
- validate reorder, toggle, and pointer behavior against the registry

### Phase 3: Mixed Rendering

- register WebGL layers through the same ordering model
- keep SVG and WebGL layers reorderable through one control path

### Phase 4: Export [low priority]

- build unified SVG export from registry state
- clone only required defs resources
- validate text paths, masks, and filtered layers

## 7. Testing Clause

Testing is intentionally out of scope for this update.

Reason:

- the change is architectural and cross-cutting
- intermediate states are not reliable test targets
- partial testing during the split would produce high noise and low confidence

Implementation should focus on completing the runtime architecture first. Automated tests, manual verification, and regression coverage will be planned and executed later as a separate activity once the new layer model is stable enough to test meaningfully.
