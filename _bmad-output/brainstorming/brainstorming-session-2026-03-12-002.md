---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "docs/architecture-globals.md"
session_topic: "Per-layer SVG architecture replacing the single #map SVG, with shared globals and broad dependency updates across the app"
session_goals: "Generate PRD-ready scope, architectural options, dependency impact themes, migration strategy, acceptance criteria, and key risks for splitting the map into one SVG per layer while preserving current user-facing behavior"
selected_approach: "ai-recommended"
techniques_used:
  - "First Principles Thinking"
  - "Morphological Analysis"
  - "Reversal Inversion"
ideas_generated: 18
context_file: ""
session_active: false
workflow_completed: true
technique_execution_complete: true
facilitation_notes: "Focused on preserving the user-visible layer stack contract while identifying codebase dependencies on the single #map SVG, shared defs, viewbox, and direct DOM selection patterns."
---

# Brainstorming Session Results

**Facilitator:** Azgaar
**Date:** 2026-03-12

## Session Overview

**Topic:** Per-layer SVG architecture replacing the single `#map` SVG, with shared globals and broad dependency updates across the app.

**Goals:** Generate PRD-ready scope, architectural options, dependency impact themes, migration strategy, acceptance criteria, and key risks for splitting the map into one SVG per layer while preserving current user-facing behavior.

### Session Setup

This session was framed as a brownfield architectural expansion of the current WebGL layer initiative. The problem is not changing business behavior for users. The problem is changing the rendering substrate so SVG layers and WebGL layers can be interleaved in any order without exposing implementation details to users.

Key observed constraints from the current codebase:

- The map currently renders as a single `#map` SVG with shared `<defs>` and a single `#viewbox` group.
- Shared globals such as `svg`, `viewbox`, `scale`, `viewX`, and `viewY` are part of the runtime contract.
- Existing code already mixes SVG and WebGL for relief, but still assumes one primary map SVG and one shared canvas stack.
- Several utilities operate on a concrete `SVGSVGElement`, not an abstract layer model, so the dependency surface is broader than rendering alone.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Per-layer SVG map architecture with focus on preserving current behavior while splitting DOM ownership and dependency contracts.

**Recommended Techniques:**

- **First Principles Thinking:** Strip the problem back to the real user contract: visible layer order, editability, exportability, and shared map state.
- **Morphological Analysis:** Enumerate architecture axes such as defs ownership, zoom ownership, layer identity, export assembly, and compatibility mode to avoid premature fixation on one implementation.
- **Reversal Inversion:** Deliberately invert current assumptions like “there is one map SVG” and “all code can touch `svg` directly” to expose hidden dependencies and migration traps.

**AI Rationale:** These techniques fit a brownfield architecture problem better than purely generative methods. The hard part is not imagining layers. The hard part is separating stable user-facing contracts from unstable internal assumptions and then sequencing the migration so existing code continues to work while the DOM model changes underneath it.

## Technique Execution

### Technique 1: First Principles Thinking

**[Category #1]**: Layer Contract Before DOM
_Concept_: Treat the authoritative product contract as “a stack of visible, reorderable map layers driven by shared map state,” not “a single SVG named `#map`.” Every architectural decision should preserve this contract regardless of whether a layer is SVG or WebGL.
_Novelty_: It reframes the migration away from DOM surgery toward contract preservation, which makes mixed rendering a natural consequence instead of a special case.

**[Category #2]**: Shared Camera Bus
_Concept_: Make zoom, pan, viewport size, and world bounds a first-class shared camera contract consumed by all rendering layers. SVG layers, WebGL layers, and future export assemblers subscribe to the same state instead of inferring it from one DOM node.
_Novelty_: This shifts `viewbox` from being both model and renderer into being just one consumer of shared map camera state.

**[Category #3]**: One Layer, One Surface
_Concept_: Each map layer gets its own surface: an SVG root for vector layers or a registered WebGL draw surface for GPU layers. No grouped “all SVG below, all WebGL above” buckets are allowed.
_Novelty_: It enforces full interleaving capability as a core rule, not an optional enhancement.

**[Category #4]**: Layer Registry as Source of Truth
_Concept_: Introduce a central layer registry that owns IDs, ordering, visibility, render technology, DOM handles, and export participation. UI controls and renderers query the registry instead of hard-coding DOM positions or selector assumptions.
_Novelty_: The registry becomes the migration seam that decouples business layer semantics from concrete DOM structure.

**[Category #5]**: Shared Resource Federation
_Concept_: Filters, masks, patterns, symbols, and text paths cannot stay implicitly attached to one SVG root. They need a deliberate resource federation model with ownership, namespacing, and lookup rules.
_Novelty_: This identifies `<defs>` as a product requirement, not a markup convenience, which prevents late-stage export and filter regressions.

**[Category #6]**: Interaction Ownership Split
_Concept_: Pointer handling should belong to interaction layers and tools, not whichever visual surface happens to be on top. The rendering stack must remain visually reorderable without changing editing semantics.
_Novelty_: It prevents the common failure mode where DOM stacking accidentally rewrites input behavior.

### Technique 2: Morphological Analysis

**[Category #7]**: Compatibility Adapter Layer
_Concept_: Create an adapter that exposes legacy globals like `svg`, `viewbox`, and layer selectors through a compatibility API while the underlying implementation transitions to multiple SVG roots.
_Novelty_: Instead of a flag day rewrite, older code can keep working while dependency hotspots are migrated on a controlled schedule.

**[Category #8]**: SVG Shell Per Layer
_Concept_: Each SVG layer gets a minimal shell with its own `<svg>` root, width, height, viewBox, and a predictable internal group layout. Layer-local drawing code targets its shell, while global orchestration manages ordering and visibility.
_Novelty_: This preserves familiar SVG authoring patterns while removing the single-root bottleneck.

**[Category #9]**: Shared Defs Host Plus Layer Mirrors
_Concept_: Maintain one dedicated defs host for reusable symbols and filter resources, while layer SVGs reference those assets through stable IDs or cloned subsets when export requires local materialization.
_Novelty_: It separates runtime rendering efficiency from export correctness instead of forcing one mechanism to serve both poorly.

**[Category #10]**: Layer Capability Metadata
_Concept_: Annotate each layer with capabilities such as “needs defs,” “needs clip paths,” “participates in export,” “interactive,” and “supports WebGL.” The PRD can then classify migration complexity by capability instead of by layer name alone.
_Novelty_: This creates a scalable planning tool for future migrations beyond relief.

**[Category #11]**: Export Assembler Pipeline
_Concept_: Stop assuming the live DOM is already the export document. Introduce an export assembler that composes a temporary unified SVG from layer surfaces and shared resources.
_Novelty_: It breaks the hidden coupling between editing DOM and export DOM, which becomes increasingly important once rendering surfaces diverge.

**[Category #12]**: Layer Reorder Transaction Model
_Concept_: Reordering should update one registry transaction that fans out to SVG z-order, WebGL render order, control panel state, and persistence. No subsystem should infer order independently.
_Novelty_: This turns layer order into a single atomic business event rather than a series of DOM manipulations.

### Technique 3: Reversal Inversion

**[Category #13]**: Assume `#map` Disappears Entirely
_Concept_: Design the system as if there is no canonical map SVG anymore. What remains must still support current tools, visibility toggles, exports, screenshots, and font discovery.
_Novelty_: This immediately exposes hidden dependencies like utilities that accept a single `SVGSVGElement`, direct `#map` selectors, and code that expects one shared query scope.

**[Category #14]**: Make Direct DOM Access Illegal
_Concept_: Invert the current pattern by requiring code to ask the layer system for a surface, resource, or selector scope instead of directly querying `#map`, `#viewbox`, or concrete layer groups.
_Novelty_: This surfaces the real root cause of brittleness: implicit global DOM reachability.

**[Category #15]**: Treat WebGL as Normal, Not Special
_Concept_: Instead of “insert canvas into SVG stack,” define a render-surface model where SVG and WebGL are just different surface kinds attached to the same layer registry and camera contract.
_Novelty_: This prevents the architecture from ossifying around relief as a one-off exception.

**[Category #16]**: Push Shared Globals Up a Level
_Concept_: Globals like `svg` and `viewbox` should stop meaning “the map DOM node” and start meaning “the active map scene controller” or be replaced with narrower globals for camera, layer lookup, and resource lookup.
_Novelty_: This retains the legacy global pattern where necessary but redefines it around stable concepts rather than unstable implementation details.

**[Category #17]**: Invert Dependency Discovery into a Migration Gate
_Concept_: Before any layer is split, require a dependency census for direct `svg`, `viewbox`, `#map`, `<defs>`, and DOM-order usage. A layer cannot migrate until its dependency class is known.
_Novelty_: This turns unknown dependency spread from an implementation surprise into an explicit planning artifact.

**[Category #18]**: Design for the Hard Layers First
_Concept_: Plan as if labels, borders with text paths, masks, and filtered overlays must eventually fit the model, even if the first implementation only migrates simpler layers. The architecture should not dead-end on easy layers.
_Novelty_: It keeps the PRD honest by forcing early accommodation of the very SVG features most likely to break in a split-root model.

## Idea Organization and Prioritization

### Thematic Organization

**Theme 1: Core Layer Model**

- Layer Contract Before DOM
- Shared Camera Bus
- One Layer, One Surface
- Layer Registry as Source of Truth
- Layer Capability Metadata

**Pattern Insight:** The project should be specified as a scene-graph and orchestration problem, not a markup rewrite.

**Theme 2: Shared Dependency Refactoring**

- Shared Resource Federation
- Compatibility Adapter Layer
- Shared Defs Host Plus Layer Mirrors
- Interaction Ownership Split
- Push Shared Globals Up a Level
- Make Direct DOM Access Illegal

**Pattern Insight:** Most complexity comes from shared assumptions around global selectors, defs, and input behavior rather than from layer drawing itself.

**Theme 3: Migration and Persistence**

- SVG Shell Per Layer
- Layer Reorder Transaction Model
- Export Assembler Pipeline
- Invert Dependency Discovery into a Migration Gate

**Pattern Insight:** A successful migration needs operational scaffolding: discovery, compatibility, export assembly, and atomic order management.

**Theme 4: Future-Proofing for Mixed Rendering**

- Treat WebGL as Normal, Not Special
- Assume `#map` Disappears Entirely
- Design for the Hard Layers First

**Pattern Insight:** The architecture should be generic enough for arbitrary SVG and WebGL interleaving without creating a second special-case stack later.

### Prioritization Results

**Top Priority Ideas:**

1. **Layer Registry as Source of Truth** because arbitrary SVG/WebGL ordering cannot be implemented safely if DOM order, UI order, and renderer order are maintained separately.
2. **SVG Shell Per Layer** because the PRD needs a concrete target DOM model, not just an abstract service layer.
3. **Shared Resource Federation** because `<defs>`, masks, filters, and text paths are the highest-probability regression area in a split-SVG architecture.
4. **Compatibility Adapter Layer** because layers are used across the codebase and a flag-day migration is too risky.
5. **Export Assembler Pipeline** because a multi-SVG live scene will otherwise break assumptions that the export artifact is already present in the DOM.

**Quick Win Opportunities:**

- Build a dependency census for all direct references to `svg`, `viewbox`, `#map`, `querySelector`, and layer group IDs.
- Define the layer registry schema and capability metadata before touching any render code.
- Prototype a two-layer split with one pure SVG layer and one existing WebGL layer to validate reorder semantics.

**Breakthrough Concepts:**

- Reframing globals as scene-controller contracts rather than DOM-node shortcuts.
- Decoupling runtime scene composition from export document composition.
- Treating render technology as metadata on a layer, not as a separate subsystem.

## Action Planning

### Immediate Next Steps for the New PRD

1. **Write the problem statement around architectural constraints, not user behavior changes.**
   The PRD should state that business requirements remain the same while the implementation contract changes from one SVG root to a multi-surface layer scene.

2. **Define the target architecture in three explicit contracts.**
   The PRD should separate:
   - shared scene/camera globals,
   - layer registry and ordering,
   - resource federation and export assembly.

3. **Add a dependency inventory section.**
   Capture hotspot classes already visible in the codebase: single `#map` assumptions, one `#viewbox` transform owner, shared `<defs>`, and utilities that take a single `SVGSVGElement`.

4. **Scope the rollout as phased migration.**
   Phase 1 should establish orchestration and compatibility. Phase 2 should split selected low-risk SVG layers. Phase 3 should support fully arbitrary SVG/WebGL interleaving and export assembly.

5. **Specify acceptance criteria around behavior parity.**
   Reordering, visibility, interaction, styles, export, and performance must remain correct whether a layer is SVG or WebGL.

### Resources Needed

- A codebase-wide dependency audit for layer and SVG assumptions.
- A target list of candidate low-risk layers and high-risk layers.
- A design decision on runtime defs hosting versus per-layer defs cloning for export.
- A test strategy covering render order, selectors, export output, and zoom/pan synchronization.

### Success Indicators

- The PRD can describe a target architecture without using “single map SVG” as a prerequisite.
- Each existing layer can be classified by capability and migration complexity.
- There is an explicit compatibility story for code that currently depends on `svg` and `viewbox`.
- Export and shared defs are handled as first-class requirements rather than deferred cleanup.

## Session Summary and Insights

**Key Achievements:**

- Identified the true product contract as mixed-render layer orchestration, not a single-root SVG DOM.
- Surfaced the highest-risk dependency classes: shared defs, direct DOM queries, single-SVG utilities, and interaction ownership.
- Produced a migration frame that can seed a dedicated PRD for per-layer SVG splitting.

**Session Reflections:**

The main architectural danger is treating this as a rendering refactor only. It is also a state ownership, resource ownership, and export ownership refactor. The cleanest path is to introduce an explicit layer registry and compatibility adapter before splitting many layers. Without that seam, the codebase will accumulate brittle one-off exceptions for every migrated layer.
