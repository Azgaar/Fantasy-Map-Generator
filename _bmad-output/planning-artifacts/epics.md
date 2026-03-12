---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd-layered-map-dom-split.md
  - _bmad-output/planning-artifacts/architecture-layered-map-dom-split.md
---

# Fantasy-Map-Generator - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Fantasy-Map-Generator, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can reorder layers in any sequence supported today, regardless of whether the layer is implemented in SVG or WebGL.
FR2: Visibility toggles behave exactly as they do now.
FR3: Editing and pointer interaction remain correct after layer splitting.
FR4: Shared styles, filters, masks, and text path resources remain available where needed.
FR5: Existing layer-based workflows continue to function without exposing rendering implementation details.
FR6: Export produces equivalent output to the current behavior for supported layers.
FR7: Legacy code paths that depend on svg, viewbox, or one selector scope have a compatibility path during migration.

### NonFunctional Requirements

NFR1: The architecture must support incremental migration rather than a flag-day rewrite.
NFR2: Test design and execution are out of scope for this implementation tranche and will be handled in a separate follow-up activity.
NFR3: Layer order changes must update all runtime surfaces atomically.
NFR4: Performance must not regress for existing SVG-only layers.
NFR5: The architecture must remain compatible with the existing global-variable runtime model.

### Additional Requirements

- The layer registry is the single source of truth and each layer must register id, kind, order, visible state, and surface.
- The runtime scene must use one independent surface per logical layer, including dedicated SVG shells for SVG layers and registered canvas surfaces for WebGL layers.
- Shared transform ownership moves from the old viewbox DOM element to scene state, while scale, viewX, viewY, graphWidth, and graphHeight remain authoritative globals.
- svg and viewbox must stop being architectural source-of-truth globals and instead be supported only through a temporary compatibility layer during migration.
- The compatibility layer must provide getLayerSvg(id), getLayerSurface(id), and queryMap(selector).
- Runtime shared defs resources must live in a dedicated defs host separate from layer surfaces.
- Filters, patterns, masks, symbols, markers, and text paths must use stable IDs and remain available across split surfaces.
- Export must use a separate assembly pipeline that rebuilds a unified SVG from registry order, layer outputs, and only the required defs resources.
- Runtime structure must allow arbitrary ordering of SVG and WebGL layers without grouped SVG buckets.
- Layer modules should own only their own drawing surface; scene owns shared runtime state; defs owns shared SVG resources.
- The migration should proceed in phases: foundation, initial split layers, mixed rendering, then export hardening.
- No starter template requirement was identified in the architecture document.
- No UX document was provided, so no UX-specific requirements were added in this step.

### FR Coverage Map

FR1: Epic 2 and Epic 3 - Reordering remains correct first for split SVG layers and then for mixed SVG and WebGL layers.
FR2: Epic 2 and Epic 3 - Visibility behavior remains unchanged for split layers and mixed rendering.
FR3: Epic 2 and Epic 3 - Pointer and editing workflows remain correct through the split-layer and mixed-render transitions.
FR4: Epic 1 and Epic 4 - Shared defs-backed resources are preserved in runtime and in unified export output.
FR5: Epic 1, Epic 2, and Epic 3 - Existing workflows continue to work while the runtime architecture changes underneath them.
FR6: Epic 4 - Export output remains equivalent for supported layers after the runtime moves to split surfaces.
FR7: Epic 1 - Legacy single-SVG callers keep a compatibility path during migration.

## Epic List

### Epic 1: Foundation for Layered Runtime

Establish the shared scene, defs, layer registry, layer lifecycle, and compatibility contracts so the runtime can migrate away from one canonical SVG root without breaking existing map behavior.
**FRs covered:** FR4, FR5, FR7

### Epic 2: First Split SVG Layers

Move approved low-risk SVG layers into standalone SVG shells while preserving visual behavior, layer controls, and editing interactions.
**FRs covered:** FR1, FR2, FR3, FR5

### Epic 3: Mixed SVG and WebGL Ordering

Register WebGL surfaces under the same ordering and visibility model so users can interleave SVG and WebGL layers through one control path.
**FRs covered:** FR1, FR2, FR3, FR5

### Epic 4: Unified Export Assembly

Assemble a unified SVG export from registry state and shared defs resources so supported layered maps export with equivalent output quality.
**FRs covered:** FR4, FR6

## Epic 1: Foundation for Layered Runtime

Establish the shared scene, defs, layer registry, layer lifecycle, and compatibility contracts so the runtime can migrate away from one canonical SVG root without breaking existing map behavior.

### Story 1.1: Bootstrap Scene Container and Defs Host

As a map maintainer,
I want runtime initialization to create a dedicated scene container and defs host,
So that split layer surfaces can share resources without depending on one map SVG root.

**Implements:** FR4, FR5; NFR1, NFR5.

**Acceptance Criteria:**

**Given** the current runtime starts from one canonical map host
**When** the layered runtime bootstrap runs
**Then** it creates or reuses a dedicated scene container for layer surfaces and a dedicated defs host outside individual layer surfaces
**And** the visible map loads without user-facing regressions at startup.

**Given** existing code expects the map to initialize once
**When** the new bootstrap path is enabled
**Then** the scene container and defs host are available through stable runtime references
**And** initialization does not require changing user-facing layer controls.

### Story 1.2: Add Scene Module for Shared Camera State

As a map maintainer,
I want a Scene module to own shared camera and viewport state,
So that all layer surfaces consume one authoritative transform contract.

**Implements:** FR5; NFR1, NFR5.

**Acceptance Criteria:**

**Given** shared globals such as scale, viewX, viewY, graphWidth, and graphHeight already exist
**When** the Scene module is introduced
**Then** it exposes a single runtime contract for camera and viewport state
**And** existing global values remain authoritative and usable during migration.

**Given** multiple surfaces will render the same map
**When** camera state changes
**Then** the Scene module provides one consistent state source for all registered surfaces
**And** no feature code needs to read transforms from DOM structure directly.

### Story 1.3: Add Layers Registry as the Ordering Source of Truth

As a map maintainer,
I want a centralized Layers registry,
So that visibility, order, and surface ownership are managed consistently instead of inferred from DOM position.

**Implements:** FR5; NFR1, NFR3, NFR5.

**Acceptance Criteria:**

**Given** logical map layers currently rely on DOM placement and ad hoc lookups
**When** a layer is registered
**Then** the registry stores its id, kind, order, visible state, and surface handle
**And** callers can query layer state without inferring it from DOM order.

**Given** runtime layer order changes
**When** reorder operations are applied through the registry
**Then** all registered layer surfaces receive the updated ordering atomically
**And** the registry remains the single source of truth for visibility and order.

### Story 1.4: Add Layer Surface Lifecycle Ownership

As a map maintainer,
I want a Layer abstraction to own each surface lifecycle,
So that individual layers can be created, mounted, updated, and disposed without leaking renderer-specific details.

**Implements:** FR5; NFR1, NFR5.

**Acceptance Criteria:**

**Given** the runtime needs one surface per logical layer
**When** a layer is instantiated
**Then** the Layer abstraction owns creation, mount, update, and teardown for that surface
**And** caller code interacts with the layer through a stable contract rather than direct DOM assumptions.

**Given** both SVG and WebGL layers will exist
**When** a surface is registered with the Layer abstraction
**Then** surface lifecycle handling works without exposing renderer-specific branching to feature modules
**And** layer modules remain responsible only for drawing their own surface.

### Story 1.5: Add Compatibility Lookups for Legacy Single-SVG Callers

As a map maintainer,
I want compatibility helpers for legacy single-SVG access patterns,
So that existing workflows keep working while code migrates to the new scene and layer contracts.

**Implements:** FR5, FR7; NFR1, NFR5.

**Acceptance Criteria:**

**Given** legacy code still expects svg, viewbox, or one shared selector scope
**When** compatibility helpers are introduced
**Then** the runtime provides getLayerSvg(id), getLayerSurface(id), and queryMap(selector)
**And** callers can continue to function during migration without depending on one canonical map SVG.

**Given** new code is added after the compatibility layer exists
**When** it needs layer or scene access
**Then** it can use the new layer and scene contracts directly
**And** the compatibility layer remains a migration bridge rather than the new source of truth.

### Story 1.6: Move Shared Defs Resources to the Dedicated Host

As a map maintainer,
I want shared defs-backed resources to be registered in one dedicated host,
So that split surfaces can keep using stable IDs for filters, masks, symbols, markers, patterns, and text paths.

**Implements:** FR4, FR5; NFR1, NFR5.

**Acceptance Criteria:**

**Given** runtime resources currently live under one shared SVG structure
**When** defs registration is migrated
**Then** shared resources are created under the dedicated defs host with stable identifiers
**And** layer surfaces can reference those resources without duplicating them per layer.

**Given** a split surface uses a filter, mask, symbol, marker, pattern, or text path
**When** the layer renders
**Then** the resource reference resolves from the dedicated defs host
**And** existing visual behavior remains unchanged for supported runtime features.

## Epic 2: First Split SVG Layers

Move approved low-risk SVG layers into standalone SVG shells while preserving visual behavior, layer controls, and editing interactions.

### Story 2.1: Create Reusable Standalone SVG Shell Mounting

As a map maintainer,
I want low-risk SVG layers to mount into dedicated SVG shells,
So that selected layers can leave the single-root SVG without changing their visible behavior.

**Implements:** FR5; NFR1, NFR5.

**Acceptance Criteria:**

**Given** a low-risk SVG layer is selected for migration
**When** its surface is created through the layered runtime
**Then** the layer mounts into its own dedicated SVG shell inside the scene container
**And** the shell can participate in registry-controlled ordering and visibility.

**Given** the shell mounting path is in place
**When** another approved low-risk SVG layer is migrated
**Then** the same mounting mechanism can be reused without introducing layer-specific bootstrap hacks
**And** the migration remains incremental.

### Story 2.2: Migrate a Representative Low-Risk SVG Layer to a Dedicated Shell

As a map maintainer,
I want one representative low-risk SVG layer migrated first,
So that the split-surface path is proven on a contained layer before broader rollout.

**Implements:** FR3, FR5; NFR1, NFR4.

**Acceptance Criteria:**

**Given** the standalone shell path exists
**When** the first approved low-risk SVG layer is migrated
**Then** it renders from its dedicated shell with unchanged visual output for supported behavior
**And** its feature workflow continues to operate through the new scene and layer contracts.

**Given** the representative layer is split out
**When** users interact with that layer through existing tools
**Then** pointer targeting and editing behavior remain correct
**And** the migration does not require unrelated layers to move at the same time.

### Story 2.3: Migrate Remaining Approved Low-Risk SVG Layers

As a map maintainer,
I want the remaining approved low-risk SVG layers moved through the same split-layer path,
So that the runtime can prove multi-layer SVG splitting before mixed rendering begins.

**Implements:** FR3, FR5; NFR1, NFR4.

**Acceptance Criteria:**

**Given** the representative migration pattern has been established
**When** additional approved low-risk SVG layers are migrated
**Then** each layer renders from its own SVG shell using the shared scene, layer, and defs contracts
**And** each migrated layer preserves its existing visible behavior for supported workflows.

**Given** more than one low-risk SVG layer has been split
**When** they coexist in the runtime
**Then** they can render independently without grouped SVG buckets
**And** layer modules remain responsible only for their own surfaces.

### Story 2.4: Drive Reorder and Visibility for Split SVG Layers from the Registry

As a map user,
I want reordered and toggled split SVG layers to behave exactly as before,
So that layer management remains familiar while the runtime architecture changes.

**Implements:** FR1, FR2, FR5; NFR3, NFR5.

**Acceptance Criteria:**

**Given** one or more low-risk SVG layers have been split into standalone shells
**When** a user reorders those layers through existing controls
**Then** the registry updates the shell ordering atomically
**And** the visible stacking order matches the updated control order.

**Given** a user toggles visibility for a split SVG layer
**When** the layer state changes
**Then** the registry applies the visible state to the correct shell
**And** toggle behavior matches existing user expectations.

### Story 2.5: Preserve Pointer and Editing Workflows for Split SVG Layers

As a map user,
I want editing and pointer interactions to remain correct on split SVG layers,
So that the architectural migration does not break existing map workflows.

**Implements:** FR3, FR5; NFR4, NFR5.

**Acceptance Criteria:**

**Given** a split SVG layer supports pointer or editing workflows today
**When** a user clicks, hovers, drags, or edits through the existing UI
**Then** events reach the correct standalone layer surface
**And** the workflow behaves the same way it did before the split.

**Given** multiple split SVG layers can overlap in the scene
**When** the active tool resolves pointer targets
**Then** targeting respects the registry-driven order and layer visibility state
**And** no workflow depends on a future mixed-render story to function.

## Epic 3: Mixed SVG and WebGL Ordering

Register WebGL surfaces under the same ordering and visibility model so users can interleave SVG and WebGL layers through one control path.

### Story 3.1: Register WebGL Surfaces in the Shared Layer Model

As a map maintainer,
I want WebGL surfaces registered in the same Layers model as SVG layers,
So that render technology no longer determines whether a layer can participate in the ordered scene.

**Implements:** FR1, FR5; NFR1, NFR5.

**Acceptance Criteria:**

**Given** the Layers registry already manages SVG layer surfaces
**When** a WebGL layer is registered
**Then** it receives the same core metadata contract of id, kind, order, visible state, and surface handle
**And** the registry can treat SVG and WebGL layers as peers in the same scene.

**Given** existing WebGL behavior already depends on shared scene context
**When** registration is moved into the shared layer model
**Then** WebGL layers keep access to the required scene and camera state
**And** they no longer rely on special ordering paths outside the registry.

### Story 3.2: Unify Mixed-Layer Ordering and Visibility Controls

As a map user,
I want one layer control path to reorder and toggle both SVG and WebGL layers,
So that I can manage the full layer stack without caring how any layer is rendered.

**Implements:** FR1, FR2, FR5; NFR3, NFR5.

**Acceptance Criteria:**

**Given** both SVG and WebGL layers are registered in the scene
**When** a user changes layer order through the existing controls
**Then** the registry applies the new order across both render technologies atomically
**And** the visible stack matches the requested mixed order.

**Given** a user toggles visibility for an SVG or WebGL layer
**When** the control state changes
**Then** the runtime updates the correct surface regardless of renderer type
**And** visibility behavior remains consistent across the mixed stack.

### Story 3.3: Keep Scene Transforms and Interaction Correct in Mixed Rendering

As a map user,
I want zoom, pan, and interactions to stay aligned across SVG and WebGL layers,
So that the map behaves as one coherent scene after mixed rendering is enabled.

**Implements:** FR3, FR5; NFR4, NFR5.

**Acceptance Criteria:**

**Given** the scene contains both SVG and WebGL surfaces
**When** camera state changes through zoom or pan
**Then** all registered surfaces consume the same scene transform state
**And** the map remains visually aligned across renderer boundaries.

**Given** a user interacts with mixed-render content through existing tools
**When** the runtime resolves those interactions
**Then** the correct layer surface handles the interaction in scene order
**And** mixed rendering does not degrade the expected behavior of existing workflows.

### Story 3.4: Preserve Atomic Updates and No-Regressions Guardrails in Mixed Mode

As a map maintainer,
I want mixed-layer updates applied through one controlled pipeline,
So that the runtime preserves atomic layer changes and avoids regressions for existing SVG-heavy maps.

**Implements:** FR1, FR2, FR5; NFR3, NFR4.

**Acceptance Criteria:**

**Given** layer order or visibility changes affect both SVG and WebGL surfaces
**When** the runtime applies an update
**Then** all affected surfaces transition through one coordinated update path
**And** partial mixed-stack states are not exposed to the user.

**Given** an existing SVG-heavy map uses no new mixed-render features
**When** it runs on the layered runtime
**Then** the runtime preserves current behavior for supported workflows
**And** the migration does not introduce avoidable performance regressions for SVG-only scenarios.

## Epic 4: Unified Export Assembly

Assemble a unified SVG export from registry state and shared defs resources so supported layered maps export with equivalent output quality.

### Story 4.1: Add Export Participation Metadata to the Layer Registry

As a map maintainer,
I want each registered layer to declare how it participates in export,
So that unified SVG assembly can rebuild export output from registry state instead of the live runtime DOM.

**Implements:** FR6; NFR1, NFR5.

**Acceptance Criteria:**

**Given** the export pipeline can no longer assume the runtime DOM is the final SVG document
**When** a layer is registered for export
**Then** the registry stores the metadata needed to include, order, or skip that layer during export assembly
**And** export logic reads registry state rather than scraping one runtime SVG root.

**Given** supported layers have different render technologies
**When** export participation metadata is evaluated
**Then** the assembler can determine which layers contribute to the final SVG output
**And** unsupported layers can be excluded intentionally rather than failing implicitly.

### Story 4.2: Assemble Unified SVG Export from Registry Order

As a map user,
I want export output assembled from the layered runtime state,
So that my exported map preserves supported layer order after the DOM is split into separate surfaces.

**Implements:** FR6; NFR1, NFR5.

**Acceptance Criteria:**

**Given** the runtime scene is composed of multiple registered surfaces
**When** a user exports the map
**Then** the export pipeline assembles one unified SVG document using registry order
**And** the supported exported layer stack matches the user-visible order.

**Given** the runtime no longer uses one canonical map SVG as its model
**When** export runs
**Then** the export pipeline treats the live DOM as an implementation detail rather than the export source of truth
**And** supported layers still produce equivalent SVG output.

### Story 4.3: Clone Only Required Defs Resources into Export

As a map user,
I want exported SVG files to include only the defs resources they actually use,
So that exported maps remain correct without dragging along unrelated runtime resources.

**Implements:** FR4, FR6; NFR1, NFR5.

**Acceptance Criteria:**

**Given** the runtime defs host may contain resources for many layers
**When** export assembly runs
**Then** the pipeline includes only defs resources referenced by the exported layers
**And** exported resources preserve the stable IDs required by those layers.

**Given** an exported layer references shared defs-backed assets
**When** the export document is opened independently of the runtime
**Then** those references resolve correctly within the assembled SVG
**And** unrelated defs content is not copied by default.

### Story 4.4: Preserve Text Paths, Masks, and Filtered Layers in Export

As a map user,
I want exported maps to preserve supported advanced SVG features,
So that split-surface runtime changes do not degrade final output quality.

**Implements:** FR4, FR6; NFR1, NFR5.

**Acceptance Criteria:**

**Given** supported exported layers use text paths, masks, filters, symbols, markers, or patterns
**When** export assembly completes
**Then** the unified SVG preserves those features with correct references and ordering
**And** output remains equivalent for supported layers.

**Given** advanced defs-backed features participate in export
**When** the assembler processes them
**Then** it clones the required resources and wiring needed for those features to render correctly outside the runtime
**And** export hardening remains isolated from runtime ordering logic.
