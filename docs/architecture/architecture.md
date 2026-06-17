This document outlines the future architecture of the Fantasy Map Generator. It is intended to guide the development of a new, more consistent and maintainable codebase. The current architecture is a mix of different patterns and styles, which makes it difficult to understand and maintain. The future architecture will be based on clear separation of concerns, modularity and type safety.

## Goals

The proposed FMG 2.0 architecture aims to gradually transform the project from a large, tightly-coupled vanilla JavaScript application into a modular, maintainable, and testable system.

Main goals:

- Separate procedural generation from rendering and UI logic
- Make world data independent from SVG / DOM manipulation
- Reduce hidden global state and implicit side effects
- Enable easier contribution and onboarding
- Support gradual migration from JavaScript to TypeScript
- Improve long-term maintainability without breaking existing `.map` files
- Allow alternative renderers in the future (e.g. WebGL)

---

# Core Architectural Vision

The overall desired architecture model is as below:

````
                 settings
                    │
                    ▼
                GENERATORS
                    │
                    ▼
                  WORLD
           (state: data + style)
                    │
      ┌─────────────┴─────────────┐
      ▼                           ▼
   EDITORS                    RENDERERS
      │                           │
      ▼                           ▼
data mutations            SVG or WebGL Canvas

The architecture is conceptually divided into four major layers:

Or more formally:

```text
world data + styles (state)
        ↑↓
generators (model)
        ↑↓
editors (controllers)
        ↓
renderers (view)
````

All the map-related state should be represented by a single gigantic `map` object. When the `.map` file is saved, the object is transformed into a single json file.

---

# Layer Responsibilities

## 1. World Data Layer (State)

The world data layer is intended to become the central source of truth.

Responsibilities:

- Store all generated world information
- Store rendering style configuration
- Keep normalized data structures
- Provide serialization compatibility with `.map` files
- Remain renderer-agnostic

Important constraints:

- No rendering code (even included style config says what to render, not how to render)
- No DOM elements
- No SVG
- Minimal or no business logic
- Pure data containers

Example stored entities:

- Cells
- Burgs
- States
- Cultures
- Religions
- Rivers
- Biomes
- Routes
- Military
- Zones
- Labels
- Style configuration

The intent is for generators and editors to mutate this state in controlled ways.

---

## 2. Generators Layer (Model)

Generators are responsible for procedural simulation and content creation.

Responsibilities:

- Terrain generation
- Climate simulation
- River generation
- State expansion
- Culture placement
- Burg generation
- Route generation
- Economy simulation
- Military calculations

Key design ideas:

- Generators operate on pure world data
- Inputs and outputs should be deterministic (seeded)
- Generators must not directly manipulate SVG or UI
- Systems should be independently runnable (ideally)
- Pipeline stages should be a composable as possible

Long-term vision:

```text
seed → terrain → climate → hydrology → cultures → states → burgs → routes → economy
```

This creates a clearer simulation pipeline and enables partial regeneration.

---

## 3. Editors Layer (Controllers)

Editors are treated as interactive generators.

Responsibilities:

- User-driven mutations
- Validation and constraints
- Editing workflows
- Tool interactions
- Controlled state updates

Examples:

- River editor
- States editor
- Burg editor
- Religion editor
- Province editor
- Heightmap editor

Important concept: editors should not directly own rendering.

Instead:

```text
User action
    ↓
Editor mutates world state
    ↓
Renderer reacts to updated state
```

This reduces coupling between UI tools and rendering implementation.

---

## 4. Renderer Layer (View)

The renderer becomes a pure visualization step.

Responsibilities:

- Convert world data into SVG / WebGL / canvas output
- Handle layer ordering
- Draw labels and geometry
- Visual styling
- Visual optimizations

Important restrictions:

- Renderer must not modify world state
- Renderer should be idempotent
- Rendering should ideally be stateless

The same world state could theoretically support:

- SVG renderer
- WebGL renderer
- 3D renderer
- External engine export
- Server-side rendering

---

# Migration Strategy

The refactor is explicitly incremental and is already in progress. The project is too large for a full rewrite, so the architecture aims for:

- Progressive extraction
- Compatibility bridges
- Mixed JS/TS operation
- Gradual module isolation
- Step-by-step modernization

Key strategy: old code continues working, while new subsystems adopt cleaner architecture.

---

# TypeScript Adoption

A major direction of the modernization is gradual TypeScript migration.

Goals:

- Strong typing
- Better editor tooling
- Safer refactors
- Explicit contracts between systems
- Better discoverability for contributors

Likely future structure:

```text
src/
  core/
  generators/
  editors/
  renderers/
  state/
  ui/
  utils/
```

The transition is designed to coexist with legacy JavaScript.

---

# Data-Oriented Design

A recurring architectural idea is treating the map as structured simulation data.

Instead of DOM-centric application the project moves toward being a world simulation engine + visualization layer.

---

# Practical Implications for Contributors

The architecture implies future contributions should ideally:

- Avoid direct SVG manipulation inside generators
- Keep state mutations explicit
- Reduce global coupling
- Prefer pure functions where possible
- Separate UI from simulation logic
- Move reusable logic into isolated modules
- Add typings for shared structures
- Design systems to be independently testable
