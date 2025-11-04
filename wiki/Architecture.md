# System Architecture

This document describes the high-level architecture of the Fantasy Map Generator, including its design patterns, component organization, and key technical decisions.

## Overview

The Fantasy Map Generator is a client-side web application built with vanilla JavaScript. It uses a modular architecture where each major feature is encapsulated in its own module, communicating through shared global state objects.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         index.html                          │
│                    (Main Entry Point)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   main.js    │  │ versioning.js│  │ index.css    │
│ (Core Logic) │  │(Version Mgmt)│  │  (Styles)    │
└──────┬───────┘  └──────────────┘  └──────────────┘
       │
       │ Loads & Coordinates
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                    modules/                             │
│  ┌────────────────┬────────────────┬─────────────────┐  │
│  │   Generators   │   Renderers    │       UI        │  │
│  │                │                │                 │  │
│  │ • heightmap    │ • coa-renderer │ • editors/ (41) │  │
│  │ • rivers       │ • relief-icons │ • dialogs       │  │
│  │ • cultures     │ • ocean-layers │ • tools         │  │
│  │ • burgs/states │                │                 │  │
│  │ • religions    │                │                 │  │
│  │ • routes       │                │                 │  │
│  │ • military     │                │                 │  │
│  │ • markers      │                │                 │  │
│  │ • names        │                │                 │  │
│  │ • coa          │                │                 │  │
│  │ • biomes       │                │                 │  │
│  └────────────────┴────────────────┴─────────────────┘  │
│  ┌────────────────┬────────────────┐                    │
│  │      I/O       │    Dynamic     │                    │
│  │ • save/load    │ • editors      │                    │
│  │ • export       │ • utilities    │                    │
│  └────────────────┴────────────────┘                    │
└─────────────────────────────────────────────────────────┘
       │
       │ Uses
       ▼
┌─────────────────────────────────────────────────────────┐
│                      libs/                              │
│  • d3.min.js        (Data visualization & SVG)          │
│  • delaunator.min.js (Delaunay triangulation)           │
│  • jquery.min.js    (DOM manipulation)                  │
│  • jquery-ui.min.js (UI widgets)                        │
└─────────────────────────────────────────────────────────┘
       │
       │ Manipulates
       ▼
┌─────────────────────────────────────────────────────────┐
│                   Global State                          │
│  • grid    (Voronoi diagram + terrain data)             │
│  • pack    (Civilizations + derived data)               │
│  • seed    (Random seed)                                │
│  • options (Generation parameters)                      │
│  • notes   (User annotations)                           │
│  • mapHistory (Undo/redo state)                         │
└─────────────────────────────────────────────────────────┘
       │
       │ Renders to
       ▼
┌─────────────────────────────────────────────────────────┐
│                    SVG Canvas                           │
│  30+ layered groups for different map elements          │
│  (oceans, terrain, rivers, borders, labels, etc.)       │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Entry Point (index.html + main.js)

**index.html** serves as the application shell, containing:
- SVG canvas with ~30 layered groups (see SVG Layer Structure below)
- UI controls and dialogs
- Script includes for libraries and modules

**main.js** (67KB+) is the application core, containing:
- Initialization and bootstrapping logic
- Main generation workflow (`generate()` function)
- Global state management
- Event handlers and UI coordination
- Utility functions used throughout the app

### 2. Module Organization

All modules follow the **Revealing Module Pattern**:

```javascript
window.ModuleName = (function() {
  // Private variables and functions
  const privateData = {};

  function privateFunction() {
    // Implementation
  }

  // Public API
  function publicFunction() {
    // Implementation
  }

  return {
    publicFunction
  };
})();
```

This provides:
- **Encapsulation** - Private implementation details
- **Namespace management** - Clean global scope
- **Explicit interfaces** - Clear public APIs

### 3. Module Categories

#### Generators (`modules/`)

These modules create map data procedurally:

- **heightmap-generator.js** - Terrain elevation using templates or images
- **river-generator.js** - Water flow simulation and river networks
- **cultures-generator.js** - Culture placement and expansion
- **burgs-and-states.js** - Capitals, towns, and political boundaries
- **religions-generator.js** - Religion creation and spread
- **routes-generator.js** - Road and trade route networks
- **military-generator.js** - Military units and regiments
- **markers-generator.js** - Map markers and POIs
- **names-generator.js** - Procedural name generation using Markov chains
- **coa-generator.js** - Coat of arms generation
- **biomes.js** - Biome assignment based on climate
- **lakes.js** - Lake creation and management

#### Renderers (`modules/renderers/`)

These modules handle visualization:

- **coa-renderer.js** - Renders coats of arms to SVG
- **relief-icons.js** - Terrain icon rendering
- **ocean-layers.js** - Ocean visualization

#### UI Modules (`modules/ui/`)

41+ specialized editors, including:
- Heightmap editor, coastline editor, rivers editor
- Biomes editor, relief editor, temperature/precipitation graphs
- Burg editor, states editor, cultures editor, religions editor
- Provinces editor, routes editor, military overview
- Markers editor, notes editor, zones editor
- Style editors, options editor, tools

Each editor is a separate file that creates a dialog interface for editing specific map aspects.

#### I/O Modules (`modules/io/`)

Handle data persistence and export:
- Save/load functionality (.map format)
- Export to various formats (JSON, SVG, PNG, etc.)
- Cloud storage integration

#### Dynamic Modules (`modules/dynamic/`)

Runtime utilities and helpers loaded dynamically as needed.

### 4. SVG Layer Structure

The map is rendered to an SVG canvas with ~30 named groups, organized by z-index:

```xml
<svg id="map">
  <!-- Background -->
  <g id="oceanLayers"></g>
  <g id="oceanPattern"></g>

  <!-- Terrain -->
  <g id="landmass"></g>
  <g id="texture"></g>
  <g id="terrs"></g>
  <g id="biomes"></g>

  <!-- Water Features -->
  <g id="ice"></g>
  <g id="lakes"></g>
  <g id="coastline"></g>
  <g id="rivers"></g>

  <!-- Political Boundaries -->
  <g id="regions"></g>
  <g id="statesBody"></g>
  <g id="statesHalo"></g>
  <g id="provs"></g>
  <g id="borders"></g>

  <!-- Population & Infrastructure -->
  <g id="zones"></g>
  <g id="population"></g>
  <g id="routes"></g>
  <g id="roads"></g>
  <g id="trails"></g>
  <g id="searoutes"></g>

  <!-- Settlements & Icons -->
  <g id="temp"></g>
  <g id="military"></g>
  <g id="icons"></g>
  <g id="burgIcons"></g>
  <g id="burgLabels"></g>

  <!-- Information Layers -->
  <g id="labels"></g>
  <g id="markers"></g>
  <g id="prec"></g>
  <g id="temperature"></g>
  <g id="ruler"></g>
  <g id="grid"></g>
  <g id="coordinates"></g>
  <g id="compass"></g>
  <g id="legend"></g>

  <!-- Overlays -->
  <g id="debug"></g>
  <g id="overlay"></g>
</svg>
```

Each layer can be toggled on/off independently. Elements are drawn to specific layers based on their type, allowing for proper z-ordering and selective rendering.

## Design Patterns

### 1. Global State Pattern

The application uses several global objects to store state:

```javascript
// Main data structures
let grid = {};    // Voronoi diagram + terrain
let pack = {};    // Civilizations + derived data
let seed = "";    // Random seed for reproducibility
let options = {}; // Generation parameters

// Additional state
let notes = [];        // User annotations
let mapHistory = [];   // Undo/redo states
let customization = 0; // Customization level
```

**Benefits:**
- Simple communication between modules
- Easy serialization for save/load
- No complex state management library needed

**Drawbacks:**
- Global namespace pollution
- Implicit dependencies between modules
- Harder to reason about data flow

### 2. Typed Arrays for Performance

To handle large datasets efficiently, the application uses JavaScript Typed Arrays:

```javascript
pack.cells = {
  i: new Uint32Array(cells),      // Cell indices
  h: new Uint8Array(cells),       // Height (0-255)
  s: new Uint16Array(cells),      // State ID
  culture: new Uint16Array(cells), // Culture ID
  // ... etc
}
```

**Benefits:**
- 50-90% memory reduction vs regular arrays
- Faster iteration and access
- Enforced data types prevent bugs

### 3. Seeded Random Generation

Uses **aleaPRNG** for reproducible randomness:

```javascript
Math.random = aleaPRNG(seed);
```

Any map can be regenerated identically using the same seed, enabling:
- Sharing maps by seed string
- Debugging reproducibility
- Procedural generation consistency

### 4. Event-Driven UI Updates

UI editors trigger updates through event listeners:

```javascript
$('#someInput').on('change', function() {
  updateMapElement();
  drawLayers();
});
```

Changes immediately reflect on the map, providing real-time feedback.

### 5. D3.js Data Binding

Uses D3.js for declarative data-to-DOM binding:

```javascript
const cells = d3.select('#biomes').selectAll('polygon')
  .data(pack.cells.i.filter(i => pack.cells.h[i] >= 20))
  .enter().append('polygon')
  .attr('points', d => getCellPolygonPoints(d))
  .attr('fill', d => biomesData.color[pack.cells.biome[d]]);
```

This pattern allows efficient updates when data changes.

## Data Flow

### Generation Pipeline

```
User Input (seed, options)
  ↓
Generate Grid (Voronoi)
  ↓
Heightmap Generation
  ↓
Feature Detection (land/water)
  ↓
Climate Calculation (temp/prec)
  ↓
Repack Grid → Pack
  ↓
Rivers & Lakes
  ↓
Biome Assignment
  ↓
Culture Generation
  ↓
State Generation
  ↓
Settlement Generation
  ↓
Route Generation
  ↓
Rendering to SVG
  ↓
User Interaction (editing)
```

### Edit-Render Cycle

```
User Edits Data
  ↓
Update Global State (grid/pack)
  ↓
Trigger Render Function
  ↓
D3.js Updates SVG Elements
  ↓
Browser Renders Changes
```

## Performance Considerations

### 1. Cell Count

Default: **~10,000 cells** in the grid
- More cells = higher detail + slower generation
- Fewer cells = lower detail + faster generation
- Configurable in options

### 2. Rendering Optimization

- **Selective Layer Drawing** - Only redraw changed layers
- **D3 Data Binding** - Efficient DOM updates
- **Typed Arrays** - Memory-efficient storage
- **Debounced Updates** - Prevent excessive redraws during editing

### 3. Lazy Loading

Some modules are loaded on-demand:
- 3D view components
- Export utilities
- Advanced editors

## Technology Stack

### Core Technologies

- **JavaScript (ES6+)** - Core language
- **SVG** - Vector graphics rendering
- **HTML5 Canvas** - Some bitmap operations
- **CSS3** - Styling and layout

### Key Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **D3.js** | v7+ | Data visualization, SVG manipulation |
| **Delaunator** | Latest | Fast Delaunay triangulation |
| **jQuery** | 3.x | DOM manipulation, AJAX |
| **jQuery UI** | 1.x | Dialogs, sliders, sortable |

### Algorithms & Techniques

- **Voronoi Diagrams** - Spatial partitioning for cells
- **Delaunay Triangulation** - Dual graph for Voronoi
- **Markov Chains** - Procedural name generation
- **Heightmap Templates** - Terrain generation patterns
- **Flux-based River Simulation** - Realistic water flow
- **Expansion Algorithms** - Culture and state growth
- **Dijkstra's Algorithm** - Route pathfinding

## Browser Compatibility

**Recommended:** Modern evergreen browsers
- Chrome/Edge (Chromium) - Best performance
- Firefox - Good performance
- Safari - Good performance

**Required Features:**
- ES6 JavaScript support
- SVG 1.1
- Canvas API
- Local Storage API
- File API for save/load

## Deployment

The application is:
- **Static** - No server-side processing required
- **Client-side** - Runs entirely in the browser
- **Portable** - Can run from local filesystem or any web server
- **GitHub Pages** - Official deployment at azgaar.github.io

## Future Architecture Considerations

The codebase is acknowledged to be "messy and requires re-design" (per README). Potential improvements:

1. **Module Bundling** - Use webpack/rollup for better dependency management
2. **State Management** - Consider Redux/MobX for clearer data flow
3. **TypeScript** - Type safety and better IDE support
4. **Component Framework** - Vue/React for more maintainable UI
5. **Web Workers** - Offload heavy generation to background threads
6. **WASM** - Performance-critical sections in Rust/C++

However, the current architecture works well for its purpose and maintains accessibility for contributors familiar with vanilla JavaScript.
