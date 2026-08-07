# Design & Implementation Plan: High-Performance FMG Replication

This plan outlines the design, architecture, and phased implementation schedule to rebuild the existing **Fantasy Map Generator (FMG)** in a highly responsive, modern full-stack format. The goal is 100% feature and workflow parity, keeping the visual interface identical, while dramatically increasing performance, reliability, and code modularity.

---

## 1. Core Architectural Pillars

To avoid inter-communication bottlenecks, spaghetti code, and performance lag, we adopt a **Modular Data-Driven Architecture**:

```mermaid
graph TD
    subgraph Client View [Renderer & UI]
        UI[Modular UI / React or Svelte]
        Canvas[GPU Canvas Renderer]
    end

    subgraph Central State [The Source of Truth]
        Store[Central State Store / Redux or Zustand]
    end

    subgraph Simulation Modules [Pure Logic Layers]
        Grid[1. Grid & Heightmap]
        Hydro[2. Hydrology & Climate]
        Geo[3. Biomes & Geography]
        Civ[4. Cultures & Religions]
        Pol[5. States & Provinces]
        Set[6. Burgs & Routes]
        Econ[7. Goods & Economy]
    end

    Store -->|State Subscriptions| Client View
    UI -->|Dispatches Actions| Store
    Store -->|Read/Write Map State| SimulationModules
```

### 1.1 Separation of Concerns
1. **The State Store (Data):** A single source of truth containing raw map data arrays (e.g. `cells.h`, `cells.biome`, `burgs`, `states`) and style configurations.
2. **Simulation Modules (Model):** Independent, stateless mathematical modules. For example, `Hydrology` only reads coordinates and heights, then returns water flow updates. It knows nothing about canvas rendering or UI buttons.
3. **The Renderer (View):** Draws the state on a high-performance WebGL/HTML5 Canvas layer. It is idempotent; if the state doesn't change, the frame doesn't re-render.
4. **The UI (Controller):** Reacts to changes and triggers specific, isolated store actions.

### 1.2 Eliminating Bottlenecks
* **Decoupled Updates:** Modules write to the Central State Store. The UI and Renderer listen to specific state slices. This prevents cascading updates (re-drawing the whole map when editing a single burg name).
* **Asynchronous Operations:** Grid generation, pathfinding (routes), and economic cycles run in background Web Workers or backend server tasks, keeping the UI at 60 FPS.

---

## 2. Component Design & Modularity

Each generator/editor is isolated into its own folder structure inside `fmg-rebuild/`:

| Module | Core Responsibility | Input Dependencies | Output States |
| :--- | :--- | :--- | :--- |
| **Grid** | Voronoi layout, heightmap brushes | Graph sizes, seeds | `grid.cells.x`, `y`, `h` |
| **Hydrology** | Flow accumulation, lakes, rivers | Heights, precipitation | `pack.rivers`, `cells.fl` |
| **Climate** | Wind, temperature, moisture | Latitudes, heights | `cells.temp`, `cells.prec` |
| **Biomes** | Ecological zones determination | Temp, prec, heights | `cells.biome` |
| **Cultures** | Culture placement and growth | Biomes, habitability | `cells.culture`, `cultures` |
| **Political** | State/Province borders and expansion | Cultures, distance metrics| `cells.state`, `states` |
| **Burgs/Routes**| Settlement coordinates & road paths | Rivers, coastlines, states | `burgs`, `routes` |
| **Economy** | Goods, production, and tax ledger | Population, routes, biomes| `markets`, `deals`, `treasuries` |

---

## 3. Step-by-Step Build Schedule

### Phase 1: Infrastructure & State Engine (Week 1)
* [ ] Scaffold the project file structure with clear folder boundaries and Readmes.
* [ ] Setup TypeScript, linting, build pipelines (Vite/Uvicorn), and state management library.
* [ ] Implement serialization schemas to guarantee full backwards compatibility with old `.map` files.

### Phase 2: Procedural Simulation Core (Weeks 2-3)
* [ ] Port Voronoi triangulation and heightmap generation logic.
* [ ] Port hydrology, temperature, precipitation, and biome definitions.
* [ ] Port cultural, religious, and political expansion engines.
* [ ] Port burg placement, pathfinding routes (A* search), and economics (goods, production, taxes).

### Phase 3: High-Performance Canvas Renderer (Week 4)
* [ ] Build the interactive map viewport supporting infinite zoom and pan.
* [ ] Implement optimized canvas layers for biomes, heightmaps, borders, labels, and routes.
* [ ] Add dynamic SVG exporting tools.

### Phase 4: UI replication & Editor Modals (Weeks 5-6)
* [ ] Split the 9000-line monolithic index.html layout into modular components.
* [ ] Replicate all original editing tables (Burg Editor, State Editor, Route Painter).
* [ ] Integrate WebSocket server for real-time multiplayer map collaboration.

---

## 4. Verification Plan

### Automated Verification
* Unit tests for each simulation module using mock state inputs.
* Integration test verifying that exporting a generated map state to JSON and reloading it yields an identical visual and logical representation.

### Manual Verification
* Visual side-by-side comparison with the original FMG tool.
* Inspect zoom and pan responsiveness using browser performance profilers (targeting `> 55 FPS` during interactions).
