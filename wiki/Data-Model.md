# Data Model

This document describes the data structures used by the Fantasy Map Generator. Understanding these structures is essential for contributing to the project or building extensions.

## Overview

The generator maintains two primary data structures:

1. **`grid`** - The initial Voronoi diagram with terrain and climate data
2. **`pack`** - A packed/filtered version with civilizations and derived features

Both are global objects accessible throughout the application. All map data can be serialized to/from these structures for save/load functionality.

## Grid Object

The `grid` object represents the initial Voronoi diagram created from ~10,000 jittered points. It contains the raw terrain and climate data.

### Structure

```javascript
grid = {
  // Core Voronoi data
  points: [[x1, y1], [x2, y2], ...],  // Array of [x, y] coordinates
  cells: {
    i: Uint32Array,      // Cell indices [0, 1, 2, ...]
    v: Array,            // Vertices indices for each cell
    c: Array,            // Adjacent cell indices
    b: Uint8Array,       // Border cell (1) or not (0)
    f: Uint16Array,      // Feature ID (island/ocean/lake)
    t: Int8Array,        // Cell type: -1=ocean, -2=lake, 1=land
    h: Uint8Array,       // Height (0-100, where 20 is sea level)
    temp: Int8Array,     // Temperature (-128 to 127)
    prec: Uint8Array,    // Precipitation (0-255)
    area: Float32Array,  // Cell area in square pixels
  },

  // Vertices
  vertices: {
    p: [[x, y], ...],    // Vertex coordinates
    v: Array,            // Voronoi vertices
    c: Array             // Adjacent cells to each vertex
  },

  // Seeds (feature centers)
  seeds: {
    i: Uint16Array,      // Seed cell indices
  }
}
```

### Key Properties

#### cells.i (Index)
- Unique identifier for each cell
- Values: `0` to `n-1` where `n` is cell count
- Used to reference cells throughout the application

#### cells.h (Height)
- Elevation value for the cell
- Range: `0-100` (typically)
- Convention: `0-20` = water, `20+` = land
- Higher values = higher elevation

#### cells.temp (Temperature)
- Temperature in relative units
- Range: `-128` to `127` (signed 8-bit)
- Calculated based on latitude and other factors
- Affects biome assignment

#### cells.prec (Precipitation)
- Rainfall/moisture level
- Range: `0-255` (unsigned 8-bit)
- Affects river generation and biomes
- Higher near coasts and prevailing winds

#### cells.f (Feature ID)
- Identifies which landmass/ocean/lake the cell belongs to
- Each contiguous land area gets a unique ID
- Used for island detection and feature management

#### cells.t (Type)
- Quick type classification
- Values: `-2` = lake, `-1` = ocean, `0` = coast, `1` = land
- Used for filtering and quick checks

### Grid Methods

The grid doesn't expose many methods directly. Most operations are performed by utility functions in `main.js`:

```javascript
// Generate initial grid
generateGrid();

// Get neighboring cells
const neighbors = grid.cells.c[cellId];

// Check if cell is land
const isLand = grid.cells.h[cellId] >= 20;
```

## Pack Object

The `pack` object is derived from `grid` after initial generation. It contains only land cells and adds civilization data.

### Structure

```javascript
pack = {
  // Cell data (filtered from grid, only land cells)
  cells: {
    i: Uint32Array,       // Cell indices
    p: Array,             // [x, y] coordinates
    v: Array,             // Vertex indices
    c: Array,             // Adjacent cells
    area: Float32Array,   // Cell area

    // Terrain data (from grid)
    h: Uint8Array,        // Height
    temp: Int8Array,      // Temperature
    prec: Uint8Array,     // Precipitation

    // Water features
    r: Uint16Array,       // River ID (0 = no river)
    fl: Uint16Array,      // Water flux (amount of water flowing)
    conf: Uint8Array,     // River confluence count

    // Biomes & terrain
    biome: Uint8Array,    // Biome type ID

    // Civilization
    s: Uint16Array,       // State ID (0 = neutral)
    culture: Uint16Array, // Culture ID
    religion: Uint16Array, // Religion ID (0 = no religion)
    province: Uint16Array, // Province ID
    burg: Uint16Array,    // Burg ID (0 = no settlement)

    // Infrastructure
    road: Uint16Array,    // Road power (0 = no road)
    crossroad: Uint16Array, // Crossroad value

    // Derived properties
    pop: Float32Array,    // Population density
    harbor: Uint8Array,   // Harbor/port status
  },

  // Vertices
  vertices: {
    p: Array,            // [x, y] coordinates
    c: Array,            // Adjacent cells
    v: Array             // Voronoi data
  },

  // Burgs (settlements)
  burgs: [
    {
      i: Number,         // Unique ID
      cell: Number,      // Cell index where burg is located
      x: Number,         // X coordinate
      y: Number,         // Y coordinate
      name: String,      // Settlement name
      feature: Number,   // Feature (island) ID

      // Political
      state: Number,     // State ID
      capital: Boolean,  // Is state capital

      // Cultural
      culture: Number,   // Culture ID

      // Population
      population: Number,     // Total population
      type: String,          // Settlement type (city, town, etc.)

      // Other
      port: Number,      // Port/harbor value
      citadel: Boolean,  // Has citadel/castle
    }
  ],

  // States (political entities)
  states: [
    {
      i: Number,         // Unique ID (0 = neutral)
      name: String,      // State name
      color: String,     // CSS color code
      capital: Number,   // Capital burg ID

      // Cultural
      culture: Number,   // Dominant culture ID
      religion: Number,  // State religion ID

      // Political
      type: String,      // Government type (Kingdom, Empire, etc.)
      expansionism: Number, // Expansion aggressiveness (0-1)
      form: String,      // "Monarchy", "Republic", etc.

      // Geographic
      area: Number,      // Total area in cells
      cells: Number,     // Number of cells

      // Population
      rural: Number,     // Rural population
      urban: Number,     // Urban population

      // Military
      military: Array,   // Military units

      // Diplomacy
      diplomacy: Array,  // Relations with other states

      // Other
      pole: [x, y],      // Pole of inaccessibility (label position)
      alert: Number,     // Alert level
      alive: Number,     // Is state alive (1) or removed (0)
    }
  ],

  // Cultures
  cultures: [
    {
      i: Number,         // Unique ID
      name: String,      // Culture name
      base: Number,      // Base name generation set
      type: String,      // Culture type (Generic, River, etc.)

      // Geographic
      center: Number,    // Origin cell
      color: String,     // CSS color code

      // Area & population
      area: Number,      // Total area
      cells: Number,     // Number of cells
      rural: Number,     // Rural population
      urban: Number,     // Urban population

      // Cultural traits
      expansionism: Number, // Expansion rate
      shield: String,    // Shield shape for CoA
      code: String,      // Two-letter code
    }
  ],

  // Religions
  religions: [
    {
      i: Number,         // Unique ID (0 = no religion)
      name: String,      // Religion name
      color: String,     // CSS color code
      type: String,      // Religion type (Folk, Organized, etc.)
      form: String,      // Form (Cult, Church, etc.)

      // Origins
      culture: Number,   // Origin culture ID
      center: Number,    // Origin cell

      // Geographic
      area: Number,      // Total area
      cells: Number,     // Number of cells
      rural: Number,     // Rural population
      urban: Number,     // Urban population

      // Deities & beliefs
      deity: String,     // Deity name (if applicable)
      expansion: String, // Expansion strategy
      expansionism: Number, // Expansion rate
      code: String,      // Two-letter code
    }
  ],

  // Rivers
  rivers: [
    {
      i: Number,         // Unique ID
      source: Number,    // Source cell
      mouth: Number,     // Mouth cell
      cells: Array,      // Array of cell indices along river
      length: Number,    // River length
      width: Number,     // River width
      name: String,      // River name
      type: String,      // River type
      parent: Number,    // Parent river (for tributaries)
    }
  ],

  // Features (landmasses, oceans, lakes)
  features: [
    {
      i: Number,         // Unique ID
      land: Boolean,     // Is land (true) or water (false)
      border: Boolean,   // Touches map border
      type: String,      // "island", "ocean", "lake"
      cells: Number,     // Number of cells
      firstCell: Number, // First cell of feature
      group: String,     // Group name (for islands)
      area: Number,      // Total area
      height: Number,    // Average height
    }
  ],

  // Provinces
  provinces: [
    {
      i: Number,         // Unique ID
      state: Number,     // State ID
      name: String,      // Province name
      formName: String,  // Form name (e.g., "Duchy of X")
      color: String,     // CSS color code

      // Capital
      burg: Number,      // Capital burg ID
      center: Number,    // Center cell

      // Geography
      area: Number,      // Total area
      cells: Number,     // Number of cells

      // Population
      rural: Number,     // Rural population
      urban: Number,     // Urban population

      // Other
      pole: [x, y],      // Label position
    }
  ],

  // Markers (map annotations)
  markers: [
    {
      i: Number,         // Unique ID
      type: String,      // Marker type (volcano, monument, etc.)
      x: Number,         // X coordinate
      y: Number,         // Y coordinate
      cell: Number,      // Cell index
      icon: String,      // Icon identifier
      size: Number,      // Icon size
      note: String,      // Associated note text
    }
  ]
}
```

## Biomes Data

The `biomesData` object defines biome properties:

```javascript
biomesData = {
  i: [id0, id1, ...],        // Biome IDs
  name: [...],               // Human-readable names
  color: [...],              // Display colors
  habitability: [...],       // How suitable for settlements (0-100)
  iconsDensity: [...],       // Density of relief icons
  icons: [...],              // Icon sets to use
  cost: [...],               // Movement cost multiplier
  biomesMartix: [...]        // Temperature/precipitation mapping
}
```

### Standard Biomes

| ID | Name | Description |
|----|------|-------------|
| 1 | Marine | Ocean biome |
| 2 | Hot desert | Arid, hot regions |
| 3 | Cold desert | Arid, cold regions |
| 4 | Savanna | Grasslands with scattered trees |
| 5 | Grassland | Temperate grasslands |
| 6 | Tropical seasonal forest | Wet/dry tropical forest |
| 7 | Temperate deciduous forest | Moderate climate forests |
| 8 | Tropical rainforest | Dense, wet jungle |
| 9 | Temperate rainforest | Wet coastal forests |
| 10 | Taiga | Boreal forest |
| 11 | Tundra | Treeless cold regions |
| 12 | Glacier | Ice and snow |
| 13 | Wetland | Marshes and swamps |

## Notes Data

User annotations stored separately:

```javascript
notes = [
  {
    id: String,          // Unique identifier
    name: String,        // Note title
    legend: String,      // Legend text
  }
]
```

## Map History

Undo/redo system stores state snapshots:

```javascript
mapHistory = [
  {
    json: String,        // Serialized map state
    options: Object,     // Generation options at time
    version: String      // Generator version
  }
]
```

## Data Relationships

### Cell → Civilization Hierarchy

```
Cell (pack.cells.i[cellId])
  ├─ Burg (pack.cells.burg[cellId] → pack.burgs[burgId])
  ├─ State (pack.cells.s[cellId] → pack.states[stateId])
  ├─ Culture (pack.cells.culture[cellId] → pack.cultures[cultureId])
  ├─ Religion (pack.cells.religion[cellId] → pack.religions[religionId])
  └─ Province (pack.cells.province[cellId] → pack.provinces[provinceId])
```

### State Hierarchy

```
State (pack.states[stateId])
  ├─ Capital Burg (pack.states[stateId].capital → pack.burgs[burgId])
  ├─ Culture (pack.states[stateId].culture → pack.cultures[cultureId])
  ├─ Religion (pack.states[stateId].religion → pack.religions[religionId])
  ├─ Provinces (pack.provinces.filter(p => p.state === stateId))
  └─ Burgs (pack.burgs.filter(b => b.state === stateId))
```

### River Network

```
River (pack.rivers[riverId])
  ├─ Source Cell (pack.rivers[riverId].source)
  ├─ Mouth Cell (pack.rivers[riverId].mouth)
  ├─ Path Cells (pack.rivers[riverId].cells[])
  └─ Parent River (pack.rivers[riverId].parent for tributaries)
```

## Data Access Patterns

### Finding data for a cell

```javascript
// Given a cell index
const cellId = 1234;

// Get basic terrain
const height = pack.cells.h[cellId];
const temperature = pack.cells.temp[cellId];
const biome = pack.cells.biome[cellId];

// Get civilization
const stateId = pack.cells.s[cellId];
const cultureId = pack.cells.culture[cellId];
const burgId = pack.cells.burg[cellId];

// Get full objects
const state = pack.states[stateId];
const culture = pack.cultures[cultureId];
const burg = pack.burgs[burgId];
```

### Finding all cells for an entity

```javascript
// All cells belonging to a state
const stateCells = pack.cells.i.filter(i => pack.cells.s[i] === stateId);

// All cells with a specific biome
const biomeCells = pack.cells.i.filter(i => pack.cells.biome[i] === biomeId);

// All cells with rivers
const riverCells = pack.cells.i.filter(i => pack.cells.r[i] > 0);
```

### Iterating efficiently

```javascript
// Using typed arrays directly (fastest)
for (let i = 0; i < pack.cells.i.length; i++) {
  const cellId = pack.cells.i[i];
  const height = pack.cells.h[i];
  // Process cell...
}

// Using filter + map (more readable)
const mountainCells = pack.cells.i
  .filter(i => pack.cells.h[i] > 70)
  .map(i => ({
    id: i,
    x: pack.cells.p[i][0],
    y: pack.cells.p[i][1]
  }));
```

## Serialization

### Save Format

Maps are saved as JSON with the following structure:

```javascript
{
  info: {
    version: String,      // Generator version
    description: String,  // Map description
    exportedAt: String,   // Timestamp
    mapName: String,      // Map name
    width: Number,        // Map width
    height: Number,       // Map height
    seed: String          // Random seed
  },
  settings: {},           // Generation options
  mapCoordinates: {},     // Coordinate system
  grid: {},              // Grid data
  pack: {},              // Pack data
  biomesData: {},        // Biome definitions
  notes: [],             // User notes
  nameBases: []          // Name generation data
}
```

### Load Process

When loading a map:
1. Parse JSON
2. Restore typed arrays from regular arrays
3. Run version migration if needed (via `versioning.js`)
4. Restore global state
5. Regenerate derived data if necessary
6. Render to SVG

## Performance Considerations

### Memory Usage

Typed arrays provide significant memory savings:
- `Uint8Array`: 1 byte per element (0-255)
- `Uint16Array`: 2 bytes per element (0-65,535)
- `Int8Array`: 1 byte per element (-128-127)
- `Float32Array`: 4 bytes per element

For 10,000 cells:
- Regular array: ~80 KB per property
- Uint8Array: ~10 KB per property
- **80-90% memory reduction**

### Access Speed

Typed arrays provide:
- Faster iteration (predictable memory layout)
- Better cache utilization
- Optimized by JavaScript engines

### Trade-offs

**Pros:**
- Excellent memory efficiency
- Fast array operations
- Type safety for numeric data

**Cons:**
- Less flexible than objects
- Parallel arrays can be confusing
- Requires index synchronization

## Extending the Data Model

When adding new data:

1. **Choose the right location**
   - Cell-level: Add to `pack.cells.*`
   - Entity-level: Add new array like `pack.newEntities[]`

2. **Use appropriate types**
   - IDs: Uint16Array or Uint32Array
   - Small numbers: Uint8Array or Int8Array
   - Decimals: Float32Array
   - Strings/objects: Regular arrays

3. **Update serialization**
   - Add to save format
   - Add to load process
   - Handle versioning in `versioning.js`

4. **Consider relationships**
   - How does it relate to existing data?
   - What indices/lookups are needed?
   - How will it be queried?

### Example: Adding a new cell property

```javascript
// 1. Add to pack.cells
pack.cells.myProperty = new Uint8Array(pack.cells.i.length);

// 2. Initialize during generation
function generateMyProperty() {
  for (let i = 0; i < pack.cells.i.length; i++) {
    pack.cells.myProperty[i] = calculateValue(i);
  }
}

// 3. Update save/load
function saveMap() {
  const data = {
    // ... existing data
    myProperty: Array.from(pack.cells.myProperty)
  };
}

function loadMap(data) {
  // ... load other data
  pack.cells.myProperty = new Uint8Array(data.myProperty);
}

// 4. Use in rendering/editing
function renderMyProperty() {
  d3.select('#myLayer').selectAll('path')
    .data(pack.cells.i)
    .attr('fill', i => getColor(pack.cells.myProperty[i]));
}
```

## Reference Documentation

For more details on specific aspects:
- [Architecture](Architecture.md) - System design and patterns
- [Generation Process](Generation-Process.md) - How data is created
- [Modules Reference](Modules-Reference.md) - Module APIs
