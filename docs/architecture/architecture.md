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

# Project Structure

The four-layer model above (state → generators → editors → renderers) is the *conceptual*
core, but a real application also needs code that is none of those: persistence,
app-shell lifecycle, static content, and shared helpers. The `src/` tree therefore has a
few more folders than the model has layers. This is the **real, intended layout** — not
an aspiration. Each top-level folder is named by **role**, so every file has an obvious
home.

| Folder             | Layer (model)     | Holds                                                         |
| ------------------ | ----------------- | ------------------------------------------------------------- |
| `src/types/`       | State (shape)     | shared TypeScript interfaces / domain models                  |
| `src/utils/`       | —                 | pure, dependency-free helpers                                 |
| `src/modules/`     | Generators (Model)| procedural generators & domain logic (`Goods`, `Markets`, …)  |
| `src/renderers/`   | View              | code that draws SVG / WebGL layers                            |
| `src/controllers/` | Editors / UI      | editors, tools, dialogs, panels, overviews                    |
| `src/io/`          | —                 | save / load / export / serialization                          |
| `src/services/`    | —                 | app-shell & platform lifecycle (PWA install, auto-update)     |
| `src/data/`        | —                 | static content / reference data (supporters, templates)       |

## What a "controller" is

`src/controllers/` is the **UI / interaction layer**, deliberately broader than the
textbook MVC "controller." It holds three kinds of UI:

- **Editors** — user-driven mutations of world data (`coastline-editor`,
  `cultures-editor`, `states-editor`). These are the "C" of the conceptual model.
- **Tools** — interactive map tools and workflows.
- **Overviews / visualizations** — read-only views that *present* map state without
  mutating it (`market-overview`, `charts-overview`, `production-chains`,
  `elevation-profile`).

The unifying rule: *UI that wraps the map and either routes user interaction or presents
map state in a dialog/panel.* A controller does **not** hold pure static data, app-shell
services, or serialization — those have their own folders. (A 3D viewer such as
`view-3d` is effectively an alternate renderer launched from the UI; it currently lives
in `controllers/` for convenience. Reusable UI building blocks like `hierarchy-tree` and
`minimap` may later move to a `controllers/components/` subfolder if they multiply.)

## Why no `core/`

Folders are named by **role**, never by vague importance. A generic `core/` becomes a
junk drawer — everything feels "core," so unrelated code accretes there and the name
stops meaning anything. If a genuinely foundational bucket is ever needed, prefer a
meaningful name like `src/state/` (the `pack`/`grid` container and the serialization
contract) over `core/`.

## Libraries

New bundled code imports third-party dependencies from **npm**; Vite tree-shakes them
into the graph (e.g. d3 v7 via `import { select } from "d3"`). There is **no vendored
`libs/` under `src/`**.

`public/libs/*.min.js` (d3 v5, jQuery, three, …) is loaded via `<script>` tags **only**
for classic `public/**/*.js` that still depend on runtime globals. It is legacy-only and
shrinks as modules migrate: when a feature ports to `src/`, its dependency flips from a
vendored global script to an npm import, and the vendored script is dropped once nothing
classic needs it.

## Legacy → target mapping

As classic code migrates out of `public/`, it lands in the matching `src/` folder:

| Legacy                  | Target            |
| ----------------------- | ----------------- |
| `public/modules/ui/`    | `src/controllers/`|
| `public/modules/io/`    | `src/io/`         |
| `public/config/`        | `src/data/`       |
| `public/modules/dynamic/` (auto-update) | `src/services/` |
| `public/libs/`          | npm imports       |

## Where does my file go?

- Mutates world state from user input → **editor** in `controllers/`
- Presents map state read-only (dialog, chart, list) → **overview** in `controllers/`
- Draws an SVG / WebGL layer → `renderers/`
- Generates or simulates world data → `modules/`
- Serializes, saves, loads, or exports state → `io/`
- Manages browser / app lifecycle (install, update, analytics) → `services/`
- A constant list or template, no behavior → `data/`
- A pure, reusable helper with no domain knowledge → `utils/`
- A shared type / interface → `types/`

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

For the concrete `src/` layout the code actually uses — and a guide to where each new
file belongs — see [Project Structure](#project-structure) below. The transition is
designed to coexist with legacy JavaScript.

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
