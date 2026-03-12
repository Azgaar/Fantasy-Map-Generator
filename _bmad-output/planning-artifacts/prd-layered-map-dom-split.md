---
status: draft
basedOn:
  - "_bmad-output/brainstorming/brainstorming-session-2026-03-12-002.md"
  - "_bmad-output/planning-artifacts/prd.md"
  - "docs/architecture-globals.md"
---

# Product Requirements Draft - Per-Layer SVG Map Architecture

**Author:** Azgaar
**Date:** 2026-03-12

## Executive Summary

Fantasy-Map-Generator currently treats the interactive map as a single `#map` SVG with a shared `#viewbox`, shared `<defs>`, and a broad set of rendering and utility code that assumes one canonical SVG root. This blocks the next stage of the rendering architecture: arbitrary interleaving of SVG and WebGL layers in user-defined order.

This initiative replaces the single-root map DOM model with a per-layer surface architecture. Each logical map layer will own its own render surface, typically one SVG root per SVG layer and one registered surface per WebGL layer, while shared map state remains centralized through shared globals and scene orchestration. Users must continue to experience the same layer controls, visibility behavior, edit workflows, and output quality without needing to know whether a layer is rendered with SVG or WebGL.

## Problem Statement

The current architecture couples business concepts like “map layer,” “layer order,” and “layer visibility” to one concrete implementation detail: a single SVG document. That coupling appears in multiple forms:

- One canonical `#map` root and `#viewbox` transform owner.
- Shared `<defs>` and resource assumptions.
- Utilities that operate on one `SVGSVGElement`.
- Direct DOM access by layer ID or CSS selector.
- Existing WebGL support that is additive rather than fully peer-based.

As a result, the application cannot reliably place SVG and WebGL layers in any arbitrary order without accumulating special cases. Splitting the single map SVG is therefore a prerequisite for a generalized mixed-render layer stack.

## Product Goal

Enable the map to render as a stack of independent layer surfaces, one surface per logical layer, while preserving current user-visible behavior and allowing SVG and WebGL layers to be interleaved in any order.

## Core Product Principles

1. The user-visible contract is the layer stack, not the rendering technology.
2. Business behavior must remain stable across SVG and WebGL implementations.
3. Layer ordering must be driven by one authoritative source of truth.
4. Shared map state must remain available through stable globals or equivalent stable contracts.
5. Export, styles, filters, masks, and text resources are first-class requirements, not cleanup work.

## In Scope

- Replace the single-root `#map` SVG architecture with per-layer SVG roots for SVG-backed layers.
- Introduce a central layer registry that owns order, visibility, technology, and DOM/render handles.
- Preserve shared map globals for camera and scene state, while narrowing or adapting globals that currently point at one concrete SVG root.
- Support arbitrary SVG and WebGL interleaving without grouped rendering buckets.
- Define runtime resource ownership for shared defs, masks, filters, symbols, and text paths.
- Define an export assembly strategy for recomposing a unified SVG artifact from split surfaces.
- Inventory and adapt code that assumes one map SVG or one shared selector scope.

## Out of Scope

- Changing user-facing layer semantics or introducing new layer controls.
- Reworking the globe renderer.
- Rewriting all layers to WebGL.
- Solving every export enhancement beyond preserving current expected export fidelity.
- Automated and manual testing for this update during the implementation phase. Testing is deferred and will be handled later as a separate activity after the architectural change is in place.

## Current Architecture Hotspots

The PRD should explicitly cover at least these dependency classes:

- The map root in `src/index.html` is one SVG with shared `<defs>` and one `#viewbox` group.
- The runtime globals described in `docs/architecture-globals.md` expose `svg` and `viewbox` as core contracts.
- Utilities such as font collection currently accept a single `SVGSVGElement` and query multiple layer subtrees within it.
- Relief rendering already straddles SVG and WebGL, but still assumes a specific parent element and shared scene context.

## Proposed Target Architecture

### 1. Shared Scene Contract

The map camera, zoom, pan, viewport dimensions, and map data remain shared. These contracts stay globally accessible, but they no longer imply one DOM root. The PRD should define which globals remain stable, which are redefined, and which move behind compatibility adapters.

### 2. Layer Registry

The layer registry becomes the authoritative source for:

- layer ID
- display name
- order
- visibility
- render technology
- surface handle
- export participation
- dependency capabilities such as defs, masks, text paths, or interaction ownership

### 3. Layer Surface Model

Each logical layer owns one render surface. For SVG layers this is one dedicated SVG shell. For WebGL layers this is one registered draw surface within the same scene ordering model. The user does not see a distinction.

### 4. Shared Resource Federation

The PRD must define how shared defs-based resources are created, referenced, and exported. This includes symbols, patterns, filters, masks, clip paths, and text paths.

### 5. Export Assembly

The export artifact is no longer assumed to be identical to the live runtime DOM. The PRD should define an explicit export assembly step that reconstructs a unified SVG from the layer registry and shared resources.

## Functional Requirements

1. Users can reorder layers in any sequence supported today, regardless of whether the layer is implemented in SVG or WebGL.
2. Visibility toggles behave exactly as they do now.
3. Editing and pointer interaction remain correct after layer splitting.
4. Shared styles, filters, masks, and text path resources remain available where needed.
5. Existing layer-based workflows continue to function without exposing rendering implementation details.
6. Export produces equivalent output to the current behavior for supported layers.
7. Legacy code paths that depend on `svg`, `viewbox`, or one selector scope have a compatibility path during migration.

## Non-Functional Requirements

1. The architecture must support incremental migration rather than a flag-day rewrite.
2. Test design and execution are out of scope for this implementation tranche and will be handled in a separate follow-up activity.
3. Layer order changes must update all runtime surfaces atomically.
4. Performance must not regress for existing SVG-only layers.
5. The architecture must remain compatible with the existing global-variable runtime model.

## Phased Delivery Strategy

### Phase 1: Orchestration Foundation

- Create the layer registry.
- Define the shared scene contract.
- Add compatibility adapters for single-SVG assumptions.
- Build dependency census and migration classification.

### Phase 2: Initial Layer Splits

- Split selected low-risk SVG layers into standalone SVG shells.
- Validate mixed ordering with at least one WebGL layer.
- Prove visibility, reorder, and interaction parity.

### Phase 3: Resource and Export Hardening

- Implement defs federation and export assembly.
- Validate filters, masks, clip paths, and text paths.
- Expand migration coverage to more complex layers.

## Acceptance Criteria Themes

- There is no architectural requirement that a single `#map` SVG must exist at runtime.
- Layer order, visibility, and interaction semantics remain unchanged from the user perspective.
- Shared camera state drives every layer surface consistently.
- Shared defs-dependent features continue to work for runtime and export.
- Dependency hotspots are cataloged and each has a migration or compatibility strategy.

## Open Questions for the Full PRD

1. Which layers should remain unsplit initially because of high defs or text-path complexity?
2. Should runtime shared defs live in one dedicated hidden SVG host, in a primary scene SVG, or in mirrored per-layer subsets?
3. Which globals should remain named `svg` and `viewbox`, and which should be replaced with more stable abstractions?
4. Should export assemble from layer metadata or from cloned runtime surfaces?
5. What is the minimum viable compatibility layer for existing utilities and third-party integrations?

## Recommended Next Inputs

1. A codebase inventory of direct `#map`, `svg`, `viewbox`, and defs usage.
2. A capability matrix for every existing layer.
3. A first-pass list of low-risk versus high-risk candidate layers for splitting.
4. A design note for shared resource federation.
