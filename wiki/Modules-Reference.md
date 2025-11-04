# Modules Reference

This document provides detailed information about each module in the Fantasy Map Generator, including their purpose, main functions, and usage.

## Module Organization

Modules are located in the `modules/` directory and organized into categories:

```
modules/
├── Core Generators (terrain, water, biomes)
├── Civilization Generators (cultures, states, religions)
├── Utility Generators (names, routes, military)
├── Renderers (visualization)
├── io/ (save/load/export)
├── ui/ (editors and dialogs)
└── dynamic/ (runtime utilities)
```

## Core Generator Modules

### heightmap-generator.js

**Purpose:** Generates terrain elevation for the map.

**Main Functions:**

```javascript
HeightmapGenerator.generate()
// Generates heightmap using selected template or custom image

HeightmapGenerator.applyTemplate(template)
// Applies a specific template (Pangea, Archipelago, etc.)

HeightmapGenerator.fromImage(imageData)
// Creates heightmap from uploaded image
```

**Templates Available:**
- Pangea - Single supercontinent
- Continents - Multiple landmasses
- Archipelago - Many islands
- Atoll - Ring-shaped island
- Volcano - Volcanic island
- High Island - Mountainous island
- Low Island - Flat coral island
- Mediterranean - Central sea with surrounding land
- Peninsula - Land extending into water
- Isthmus - Narrow land bridge

**Usage:**
```javascript
// Generate default heightmap
await HeightmapGenerator.generate();

// Use specific template
HeightmapGenerator.template = "Archipelago";
await HeightmapGenerator.generate();
```

**Location in Pipeline:** Step 3 (after grid generation)

---

### river-generator.js

**Purpose:** Generates realistic river networks based on elevation and precipitation.

**Main Functions:**

```javascript
Rivers.generate()
// Main generation function - creates all rivers

Rivers.calculateFlux()
// Calculates water accumulation in each cell

Rivers.createMainRivers()
// Creates primary river paths

Rivers.createDowncutting()
// Simulates erosion along rivers
```

**Algorithm:**
1. Calculate water flux from precipitation
2. Flow water downhill to adjacent cells
3. Identify high-flux cells as river sources
4. Create river paths following gradients
5. Apply erosion to create valleys
6. Detect confluences and tributaries

**Data Structure:**
```javascript
pack.rivers = [
  {
    i: 0,              // River ID
    source: 1234,      // Source cell
    mouth: 5678,       // Mouth cell
    cells: [...],      // Path cells
    length: 250,       // Length
    width: 8,          // Width
    name: "River Name"
  }
]
```

**Location in Pipeline:** Step 7 (after climate calculation)

---

### biomes.js

**Purpose:** Assigns biome types based on temperature and precipitation.

**Main Functions:**

```javascript
Biomes.define()
// Assigns biomes to all cells based on climate

Biomes.getBiome(temperature, precipitation)
// Returns biome ID for given climate values
```

**Biome Matrix:**

The module uses a matrix mapping climate to biomes:

| Temp\Prec | Very Dry | Dry | Wet | Very Wet |
|-----------|----------|-----|-----|----------|
| **Very Cold** | Glacier | Tundra | Tundra | Tundra |
| **Cold** | Cold Desert | Taiga | Taiga | Wetland |
| **Moderate** | Grassland | Grassland | Temp. Forest | Temp. Rainforest |
| **Warm** | Hot Desert | Savanna | Trop. Forest | Tropical Rainforest |

**Biome Data:**
```javascript
biomesData = {
  i: [1, 2, 3, ...],           // IDs
  name: ["Marine", "Hot desert", ...],
  color: ["#53679f", "#fbe79f", ...],
  habitability: [0, 4, 2, ...], // 0-100
  iconsDensity: [0, 2, 5, ...],
  icons: [[], ["dune"], ...]
}
```

**Location in Pipeline:** Step 8 (after rivers)

---

### lakes.js

**Purpose:** Manages lake creation and grouping.

**Main Functions:**

```javascript
Lakes.defineGroup()
// Groups adjacent lake cells together

Lakes.cleanupLakes()
// Removes small/invalid lakes

Lakes.generateName(lakeId)
// Creates procedural name for lake
```

**Process:**
1. Identify water cells not connected to ocean
2. Group adjacent cells into lakes
3. Calculate lake properties (area, depth)
4. Generate names
5. Store in features array

**Location in Pipeline:** Step 7 (alongside rivers)

---

## Civilization Generator Modules

### cultures-generator.js

**Purpose:** Creates and expands cultures across the map.

**Main Functions:**

```javascript
Cultures.generate()
// Places initial culture centers

Cultures.expand()
// Expands cultures from centers

Cultures.add(culture)
// Adds a new culture

Cultures.remove(cultureId)
// Removes a culture
```

**Culture Object:**
```javascript
{
  i: 1,                    // Culture ID
  name: "Elvari",
  base: 5,                 // Name base index
  type: "Generic",         // Culture type
  center: 1234,            // Origin cell
  color: "#3366cc",
  expansionism: 0.8,       // 0-1 expansion rate
  area: 500,               // Total cells
  rural: 50000,            // Rural population
  urban: 15000,            // Urban population
  code: "EL",              // Two-letter code
  shield: "heater"         // Shield shape for CoA
}
```

**Expansion Algorithm:**
- BFS (breadth-first search) from center
- Prioritizes high-habitability cells
- Respects expansionism rate
- Stops at natural barriers or other cultures

**Location in Pipeline:** Step 10 (after biomes)

---

### burgs-and-states.js

**Purpose:** Generates settlements (burgs) and political states.

**Main Functions:**

```javascript
BurgsAndStates.generate()
// Main generation - creates capitals and states

BurgsAndStates.addBurg(cell)
// Adds a new settlement

BurgsAndStates.removeBurg(burgId)
// Removes a settlement

BurgsAndStates.generateProvinces()
// Divides states into provinces

BurgsAndStates.expandStates()
// Grows state territories
```

**Burg Object:**
```javascript
{
  i: 1,
  cell: 1234,
  x: 150,
  y: 200,
  name: "Oakshire",
  feature: 3,              // Island ID
  state: 5,
  capital: true,           // Is capital
  culture: 2,
  population: 25000,
  type: "City",
  port: 5,                 // Port value
  citadel: true
}
```

**State Object:**
```javascript
{
  i: 1,
  name: "Kingdom of Oakshire",
  color: "#ff6633",
  capital: 1,              // Capital burg ID
  culture: 2,
  religion: 3,
  type: "Kingdom",
  expansionism: 0.7,
  form: "Monarchy",
  area: 1000,              // Total cells
  cells: 1000,
  rural: 100000,
  urban: 30000,
  military: [...],         // Military units
  diplomacy: [...]         // Relations
}
```

**Location in Pipeline:** Step 11 (after cultures)

---

### religions-generator.js

**Purpose:** Creates and spreads religions.

**Main Functions:**

```javascript
Religions.generate()
// Creates religions from cultures

Religions.expand()
// Spreads religions across territory

Religions.add(religion)
// Adds new religion

Religions.remove(religionId)
// Removes religion
```

**Religion Object:**
```javascript
{
  i: 1,
  name: "Church of the Sacred Oak",
  color: "#ffd700",
  type: "Organized",       // Folk, Organized, Cult, Heresy
  form: "Church",
  culture: 2,              // Origin culture
  center: 1234,            // Origin cell
  deity: "Oakfather",      // Deity name (if applicable)
  area: 800,
  cells: 800,
  rural: 80000,
  urban: 25000,
  expansion: "culture",    // Expansion strategy
  expansionism: 0.5,
  code: "SO"
}
```

**Location in Pipeline:** Step 12 (after states)

---

### military-generator.js

**Purpose:** Creates military units for states.

**Main Functions:**

```javascript
Military.generate()
// Generates military units for all states

Military.generateForState(stateId)
// Generates units for specific state

Military.createRegiment(state, type)
// Creates a single military unit
```

**Military Unit:**
```javascript
{
  i: 1,
  state: 5,
  name: "Royal Guard",
  type: "Infantry",        // Infantry, Cavalry, Archers, etc.
  strength: 1000,          // Number of soldiers
  burg: 3,                 // Stationed at burg
  icon: "infantry",
  uIcon: "🗡️"
}
```

**Unit Types:**
- Infantry (foot soldiers)
- Cavalry (mounted)
- Archers (ranged)
- Artillery (siege weapons)
- Fleet (naval)

**Location in Pipeline:** Step 15 (late generation)

---

### routes-generator.js

**Purpose:** Creates road and sea route networks.

**Main Functions:**

```javascript
Routes.generate()
// Generates all routes

Routes.generateRoads()
// Creates land routes between burgs

Routes.generateTrails()
// Creates secondary paths

Routes.generateSeaRoutes()
// Creates maritime routes
```

**Algorithm:**
- Uses modified Dijkstra's algorithm
- Considers terrain difficulty
- Connects burgs within states
- Prioritizes major cities

**Route Types:**
- **Roads** - Major routes between cities
- **Trails** - Minor paths
- **Sea Routes** - Maritime trade routes

**Location in Pipeline:** Step 14 (after provinces)

---

## Utility Modules

### names-generator.js

**Purpose:** Generates procedural names using Markov chains.

**Main Functions:**

```javascript
Names.generate(base, type)
// Generates name from base
// base: name base index (0-99+)
// type: "burg", "state", "river", etc.

Names.addBase(baseName, examples)
// Adds new name base from examples

Names.getBase(culture)
// Gets name base for culture
```

**Name Bases:**

Pre-defined bases for different cultures:
- English, French, German, Italian, Spanish
- Arabic, Chinese, Japanese, Korean
- Norse, Celtic, Slavic
- Fantasy (Elvish, Dwarven, etc.)

**Markov Chain:**
```javascript
// Learns from examples:
["London", "Manchester", "Birmingham"]
// Generates similar:
["Lonchester", "Birmingam", "Manchdon"]
```

**Usage:**
```javascript
// Generate burg name
const name = Names.generate(cultureBase, "burg");

// Generate state name
const stateName = Names.generate(cultureBase, "state");
```

---

### coa-generator.js

**Purpose:** Procedurally generates coats of arms (heraldry).

**Main Functions:**

```javascript
COA.generate(entity, type)
// Generates coat of arms
// entity: state, burg, or province
// type: determines complexity

COA.shield(culture)
// Selects shield shape based on culture

COA.divisions()
// Creates field divisions

COA.charges()
// Selects heraldic charges (symbols)
```

**Heraldic Elements:**
- **Shield shapes** - Heater, French, Spanish, etc.
- **Divisions** - Per pale, per fess, quarterly, etc.
- **Charges** - Lions, eagles, crowns, etc. (200+ options)
- **Tinctures** - Metals (or, argent) and colors (gules, azure, etc.)

**COA Object:**
```javascript
{
  shield: "heater",
  division: "perPale",
  charges: ["lion", "eagle"],
  t1: "gules",            // Tincture 1 (field)
  t2: "or"                // Tincture 2 (charges)
}
```

---

### markers-generator.js

**Purpose:** Places special markers and points of interest.

**Main Functions:**

```javascript
Markers.generate()
// Generates all markers

Markers.add(marker)
// Adds custom marker

Markers.remove(markerId)
// Removes marker
```

**Marker Types:**
- Volcanoes (mountains)
- Ruins (ancient sites)
- Battlefields
- Mines (resources)
- Bridges (river crossings)
- Monuments
- Shrines
- Castles/Fortresses

**Marker Object:**
```javascript
{
  i: 1,
  type: "volcano",
  x: 150,
  y: 200,
  cell: 1234,
  icon: "🌋",
  size: 2,
  note: "Mount Doom"       // Optional note
}
```

**Location in Pipeline:** Step 16 (final generation)

---

### voronoi.js

**Purpose:** Wrapper for Voronoi diagram generation.

**Main Functions:**

```javascript
const voronoi = new Voronoi(delaunay, points);
// Creates Voronoi from Delaunay triangulation

voronoi.toGrid()
// Converts to grid data structure
```

**Dependencies:**
- Delaunator library (Delaunay triangulation)

---

### fonts.js

**Purpose:** Manages custom fonts for labels.

**Main Functions:**

```javascript
Fonts.load(fontName)
// Loads font for use

Fonts.getAvailable()
// Returns list of available fonts
```

**Available Fonts:**
Multiple font families for different map styles (serif, sans-serif, fantasy, etc.)

---

## Renderer Modules

### coa-renderer.js

**Purpose:** Renders coats of arms to SVG.

**Main Functions:**

```javascript
COArenderer.renderCoat(coa, container)
// Renders coat of arms to SVG element

COArenderer.shield(shape, size)
// Draws shield shape

COArenderer.division(type, t1, t2)
// Applies field division

COArenderer.charge(type, position, size, tincture)
// Adds heraldic charge
```

**Output:** SVG graphic of the coat of arms

---

### relief-icons.js

**Purpose:** Renders terrain icons (mountains, forests, etc.)

**Main Functions:**

```javascript
ReliefIcons.draw()
// Draws all relief icons

ReliefIcons.add(type, cell)
// Adds icon at cell
```

**Icon Types:**
- Mountains (peaks)
- Hills
- Forests
- Swamps/wetlands
- Volcanoes
- Oases

---

### ocean-layers.js

**Purpose:** Renders ocean visualization layers.

**Main Functions:**

```javascript
OceanLayers.draw()
// Draws ocean effects

OceanLayers.toggle(layerName)
// Shows/hides ocean layer
```

**Layers:**
- Waves
- Bathymetry (depth)
- Ocean currents

---

## I/O Modules (modules/io/)

### Save/Load

**Functions:**

```javascript
// Save map
downloadMap()
// Downloads .map file

// Load map
uploadMap(file)
// Loads from .map file

loadMapFromURL(url)
// Loads from URL
```

**Format:**
- JSON with all map data
- Compressed using LZ compression
- Extension: `.map`

### Export

**Functions:**

```javascript
exportSVG()
// Exports as SVG vector image

exportPNG()
// Exports as PNG raster image

exportJSON()
// Exports raw data as JSON
```

**Export Formats:**
- SVG (vector)
- PNG (raster)
- JSON (data)

---

## UI Modules (modules/ui/)

41+ specialized editors, each in its own file:

### Key Editors

**heightmap-editor.js** - Edit terrain elevation
**rivers-editor.js** - Modify rivers
**biomes-editor.js** - Edit biome distribution
**states-editor.js** - Manage states
**burgs-editor.js** - Edit settlements
**cultures-editor.js** - Modify cultures
**religions-editor.js** - Edit religions
**provinces-editor.js** - Manage provinces
**routes-editor.js** - Edit routes
**military-overview.js** - Military management
**markers-editor.js** - Place markers
**notes-editor.js** - Annotations
**style-editor.js** - Visual styling
**options-editor.js** - Generation options

Each editor provides:
- Dialog interface
- Data manipulation
- Real-time preview
- Validation

---

## Dynamic Modules (modules/dynamic/)

Loaded on-demand for specific features:

- 3D view components
- Advanced export options
- Specialized tools

---

## Module Communication

### Global State

Modules communicate through global objects:
```javascript
grid   // Terrain data
pack   // Civilization data
seed   // Random seed
options // Settings
```

### Events

Some modules use custom events:
```javascript
// Trigger event
document.dispatchEvent(new CustomEvent('mapUpdated'));

// Listen for event
document.addEventListener('mapUpdated', handleUpdate);
```

### Direct Calls

Most module communication is through direct function calls:
```javascript
Rivers.generate();
Cultures.expand();
BurgsAndStates.generate();
```

---

## Adding New Modules

### Template Structure

```javascript
"use strict";

window.MyModule = (function() {
  // Private variables
  let privateData = {};

  // Private functions
  function privateFunction() {
    // Implementation
  }

  // Public functions
  function publicFunction() {
    // Implementation
  }

  // Public API
  return {
    publicFunction
  };
})();
```

### Integration Steps

1. Create module file in `modules/`
2. Include in `index.html`:
   ```html
   <script src="modules/my-module.js"></script>
   ```
3. Call from main pipeline if needed
4. Add UI editor if appropriate
5. Update save/load if storing data

---

## Module Dependencies

### Core Dependencies

All modules depend on:
- **main.js** - Global state and utilities
- **grid/pack objects** - Data structures

### Common Library Dependencies

- **D3.js** - SVG manipulation
- **jQuery** - DOM operations
- **Delaunator** - Triangulation (for grid)

### Module Dependencies

```
heightmap-generator.js
  ↓
river-generator.js
  ↓
biomes.js
  ↓
cultures-generator.js
  ↓
burgs-and-states.js
  ↓
religions-generator.js
  ↓
routes-generator.js
```

Each module typically depends on previous stages being complete.

---

## Performance Notes

### Expensive Operations

- **River generation** - Flux calculation O(n log n)
- **Culture expansion** - BFS over cells O(n)
- **Pathfinding** - Dijkstra for routes O(E + V log V)

### Optimization Tips

- Use typed arrays
- Minimize D3 updates
- Cache calculations
- Use spatial indexing

---

## Further Reading

- [Data Model](Data-Model.md) - Data structures
- [Generation Process](Generation-Process.md) - Pipeline overview
- [Architecture](Architecture.md) - System design
