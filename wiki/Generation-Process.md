# Map Generation Process

This document explains how the Fantasy Map Generator creates maps, describing each step of the generation pipeline in detail.

## Overview

Map generation is a multi-stage process where each stage builds upon the previous one. The entire process is orchestrated by the `generate()` function in `main.js`.

## Generation Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                  1. Initialization                      │
│  • Set random seed                                      │
│  • Apply map size and options                           │
│  • Initialize data structures                           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  2. Grid Generation                     │
│  • Create jittered point grid                           │
│  • Generate Voronoi diagram via Delaunay triangulation  │
│  • ~10,000 cells by default                             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               3. Heightmap Generation                   │
│  • Generate terrain elevation (0-100)                   │
│  • Use templates or custom heightmaps                   │
│  • Sea level typically at 20                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                4. Feature Detection                     │
│  • Identify land vs water                               │
│  • Detect islands, continents, oceans                   │
│  • Mark coastal cells                                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              5. Climate Calculation                     │
│  • Calculate temperature (latitude-based)               │
│  • Generate precipitation patterns                      │
│  • Wind and moisture simulation                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 6. Repack Grid                          │
│  • Filter land cells from grid                          │
│  • Create pack structure                                │
│  • Add additional cell properties                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                7. Water Features                        │
│  • Draw coastlines                                      │
│  • Generate rivers (flux calculation + flow)            │
│  • Create lakes in depressions                          │
│  • Define lake groups                                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               8. Biome Assignment                       │
│  • Map temperature + precipitation to biomes            │
│  • 13 biome types (desert, forest, tundra, etc.)        │
│  • Store in pack.cells.biome                            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  9. Cell Ranking                        │
│  • Calculate cell suitability for settlement            │
│  • Based on terrain, biome, rivers, coasts              │
│  • Used for placement of towns/cities                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               10. Culture Generation                    │
│  • Place culture centers                                │
│  • Expand cultures across suitable cells                │
│  • Assign name generation bases                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│             11. Burgs and States                        │
│  • Place capital cities                                 │
│  • Generate states around capitals                      │
│  • Add secondary towns                                  │
│  • Define state boundaries                              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              12. Religion Generation                    │
│  • Create religions from cultures                       │
│  • Spread religions across territories                  │
│  • Assign state religions                               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                13. Provinces                            │
│  • Divide states into provinces                         │
│  • Assign provincial capitals                           │
│  • Define provincial boundaries                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               14. Route Generation                      │
│  • Create road networks between burgs                   │
│  • Generate sea routes                                  │
│  • Add trails to secondary locations                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              15. Military Generation                    │
│  • Create military units for states                     │
│  • Assign regiments to burgs                            │
│  • Calculate military strength                          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│               16. Marker Generation                     │
│  • Place special markers (volcanoes, ruins, etc.)       │
│  • Add points of interest                               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 17. Rendering                           │
│  • Draw all map layers to SVG                           │
│  • Render states, borders, labels                       │
│  • Apply styling                                        │
│  • Add UI elements (scale, compass, legend)             │
└─────────────────────────────────────────────────────────┘
```

## Detailed Stage Descriptions

### 1. Initialization

**File:** `main.js`
**Function:** `generate()`

```javascript
async function generate(options) {
  seed = generateSeed();
  Math.random = aleaPRNG(seed); // Set seeded RNG
  applyGraphSize(); // Set SVG dimensions
  randomizeOptions(); // Initialize generation parameters
}
```

**Purpose:**
- Establishes random seed for reproducibility
- Sets map dimensions (width, height)
- Initializes generation options (templates, settings)

**Seed:**
- Can be user-specified or randomly generated
- Ensures identical maps can be regenerated
- Format: Short string (e.g., "abc123")

### 2. Grid Generation

**File:** `main.js`
**Function:** `generateGrid()`

```javascript
function generateGrid() {
  const points = generateJitteredPoints(cellsDesired);
  const delaunay = Delaunator.from(points);
  const voronoi = new Voronoi(delaunay, points);
  grid = voronoi.toGrid();
}
```

**Purpose:**
- Creates the spatial data structure for the map
- Divides map into cells using Voronoi diagram

**Process:**
1. Generate ~10,000 points in a jittered grid pattern
2. Create Delaunay triangulation from points
3. Compute dual Voronoi diagram
4. Store in `grid` object

**Why Voronoi?**
- Natural-looking irregular cells
- Efficient neighbor lookups
- Well-suited for procedural generation

### 3. Heightmap Generation

**File:** `modules/heightmap-generator.js`
**Module:** `HeightmapGenerator`

```javascript
await HeightmapGenerator.generate();
```

**Templates Available:**
- **Pangea** - Single large continent
- **Archipelago** - Many islands
- **Atoll** - Ring-shaped island
- **Continents** - Multiple landmasses
- **High Island** - Volcanic island
- **Low Island** - Flat coral island
- **And more...**

**Process:**
1. Select template or use custom heightmap
2. Apply template algorithm to assign elevations
3. Smooth and add noise for realism
4. Normalize values to 0-100 range
5. Store in `grid.cells.h`

**Height Conventions:**
- `0-19`: Water (ocean/lakes)
- `20`: Sea level
- `20-30`: Coastal lowlands
- `30-50`: Plains
- `50-70`: Hills
- `70+`: Mountains

### 4. Feature Detection

**File:** `main.js`
**Function:** `markFeatures()`

```javascript
function markFeatures() {
  detectIslands();
  markOceans();
  markLakes();
  markCoastalCells();
}
```

**Purpose:**
- Identifies distinct geographic features
- Labels landmasses and water bodies
- Detects borders and coastlines

**Feature Types:**
- **Islands/Continents**: Contiguous land areas
- **Oceans**: Large water bodies touching borders
- **Lakes**: Enclosed water bodies on land

Each feature gets a unique ID stored in `grid.cells.f`.

### 5. Climate Calculation

**File:** `main.js`
**Functions:** `calculateTemperatures()`, `generatePrecipitation()`

**Temperature:**
```javascript
// Based on latitude
const latitude = y / mapHeight; // 0 = north, 1 = south
const temp = temperatureCurve(latitude, elevation);
grid.cells.temp[i] = temp;
```

Factors affecting temperature:
- **Latitude** - Colder at poles, warmer at equator
- **Elevation** - Decreases with height
- **Ocean proximity** - Moderating effect

**Precipitation:**
```javascript
// Moisture from oceans, modified by prevailing winds
const prec = calculateMoisture(cell, windDirection);
grid.cells.prec[i] = prec;
```

Factors affecting precipitation:
- **Ocean proximity** - Higher near coasts
- **Wind direction** - Prevailing winds bring moisture
- **Elevation** - Rain shadow effects
- **Temperature** - Warmer air holds more moisture

### 6. Repack Grid

**File:** `main.js`
**Function:** `reGraph()`

```javascript
function reGraph() {
  pack.cells = filterLandCells(grid.cells);
  pack.vertices = grid.vertices;
  // Add additional properties...
}
```

**Purpose:**
- Creates optimized structure for land-only operations
- Removes ocean cells to save memory
- Adds civilization-related properties

**New Properties Added:**
- `s` - State ID
- `culture` - Culture ID
- `religion` - Religion ID
- `burg` - Settlement ID
- `province` - Province ID
- `road` - Road network
- `pop` - Population density

### 7. Water Features

#### Coastline Drawing

**File:** `main.js`
**Function:** `drawCoastline()`

Renders coastlines to SVG for visualization.

#### River Generation

**File:** `modules/river-generator.js`
**Module:** `Rivers.generate()`

```javascript
Rivers.generate() {
  calculateFlux();       // Water accumulation
  createRiverPaths();    // Route rivers downhill
  applyDowncutting();    // Erosion simulation
  detectConfluence();    // Identify river junctions
}
```

**Flux Calculation:**
- Each cell receives water from precipitation
- Water flows to lowest adjacent cell
- Accumulates creating river strength

**River Pathing:**
- Start from high-flux cells
- Follow elevation gradient downward
- Terminate at ocean or lake
- Tributaries merge into larger rivers

**Downcutting:**
- Rivers erode terrain over time
- Lowers elevation along river paths
- Creates valleys and canyons

#### Lake Creation

**File:** `modules/lakes.js`
**Module:** `Lakes.defineGroup()`

- Identifies water cells not connected to ocean
- Groups adjacent lake cells
- Names lakes
- Calculates lake areas

### 8. Biome Assignment

**File:** `modules/biomes.js`
**Module:** `Biomes.define()`

```javascript
Biomes.define() {
  for (const cell of pack.cells.i) {
    const temp = pack.cells.temp[cell];
    const prec = pack.cells.prec[cell];
    const biome = biomeMatrix[temp][prec];
    pack.cells.biome[cell] = biome;
  }
}
```

**Biome Matrix:**
Maps temperature + precipitation to biome types:

```
              Precipitation →
              Low        Medium      High
         ┌──────────┬──────────┬──────────┐
T   Hot  │  Desert  │ Savanna  │ Tropical │
e        ├──────────┼──────────┼──────────┤
m   Warm │Grassland │  Forest  │Rainforest│
p        ├──────────┼──────────┼──────────┤
↓  Cold  │  Tundra  │  Taiga   │  Wetland │
         └──────────┴──────────┴──────────┘
```

**13 Biome Types:**
1. Marine (ocean)
2. Hot desert
3. Cold desert
4. Savanna
5. Grassland
6. Tropical seasonal forest
7. Temperate deciduous forest
8. Tropical rainforest
9. Temperate rainforest
10. Taiga
11. Tundra
12. Glacier
13. Wetland

### 9. Cell Ranking

**File:** `main.js`
**Function:** `rankCells()`

```javascript
function rankCells() {
  for (const cell of pack.cells.i) {
    let score = 0;
    score += biomeHabitability[pack.cells.biome[cell]];
    score += riverBonus[pack.cells.r[cell]];
    score += coastalBonus[isCoastal(cell)];
    score -= elevationPenalty[pack.cells.h[cell]];
    pack.cells.s[cell] = score;
  }
}
```

**Factors:**
- **Biome habitability** - Forests good, deserts bad
- **River proximity** - Rivers provide water and trade
- **Coastal location** - Access to fishing and trade
- **Elevation** - Lowlands preferred over mountains

**Used For:**
- Selecting locations for towns and cities
- Expanding cultures and states
- Calculating population density

### 10. Culture Generation

**File:** `modules/cultures-generator.js`
**Module:** `Cultures.generate()` and `Cultures.expand()`

**Generation Process:**

```javascript
Cultures.generate() {
  const count = rn(5, 10); // 5-10 cultures
  for (let i = 0; i < count; i++) {
    const center = selectHighRankCell();
    const culture = createCulture(center);
    pack.cultures.push(culture);
  }
}

Cultures.expand() {
  // Expand from centers using expansion algorithm
  for (const culture of pack.cultures) {
    expandFromCenter(culture, culture.expansionism);
  }
}
```

**Placement:**
- Cultures start at high-rank cells
- Multiple cultures per map (5-10 typical)

**Expansion:**
- Spreads outward from origin
- Prefers habitable terrain
- Stops at natural barriers (oceans, mountains)
- Fills until meeting other cultures

**Properties:**
- Name (procedurally generated)
- Color (for map display)
- Name base (for generating place names)
- Type (Generic, River, Lake, Naval, etc.)
- Shield shape (for coat of arms)

### 11. Burgs and States

**File:** `modules/burgs-and-states.js`
**Module:** `BurgsAndStates.generate()`

**Capital Placement:**

```javascript
BurgsAndStates.generate() {
  // 1. Place capitals
  for (const culture of pack.cultures) {
    const capital = placeCapital(culture);
    pack.burgs.push(capital);
  }

  // 2. Create states from capitals
  for (const capital of capitals) {
    const state = createState(capital);
    expandState(state);
    pack.states.push(state);
  }

  // 3. Add secondary towns
  addSecondaryBurgs();
}
```

**Burg Types:**
- **Capital** - State capital (largest city)
- **City** - Major urban center
- **Town** - Smaller settlement

**Burg Properties:**
- Name (from culture's name base)
- Population (based on rank + surroundings)
- Type (city, town, etc.)
- Port status (if coastal)
- Citadel (defensive structures)

**State Creation:**
- Each capital becomes center of a state
- State expands to fill territory
- Boundaries form where states meet
- Neutral areas remain unclaimed

**State Properties:**
- Name (from capital + government form)
- Color (randomly assigned)
- Type (Kingdom, Empire, Republic, etc.)
- Culture (dominant culture)
- Religion (state religion)
- Expansionism (aggressiveness)

### 12. Religion Generation

**File:** `modules/religions-generator.js`
**Module:** `Religions.generate()`

```javascript
Religions.generate() {
  const count = rn(5, 10);
  for (let i = 0; i < count; i++) {
    const culture = selectRandomCulture();
    const religion = createReligion(culture);
    pack.religions.push(religion);
    expandReligion(religion);
  }
  assignStateReligions();
}
```

**Religion Types:**
- Folk religions (localized)
- Organized religions (widespread)
- Cults (small followings)

**Expansion:**
- Spreads from origin culture
- Can cross state borders
- Expansion rate varies by type
- Some states adopt as official religion

### 13. Province Generation

**File:** `modules/burgs-and-states.js`
**Module:** `BurgsAndStates.generateProvinces()`

```javascript
BurgsAndStates.generateProvinces() {
  for (const state of pack.states) {
    const provinceCount = calculateProvinceCount(state.area);
    divideIntoProvinces(state, provinceCount);
  }
}
```

**Process:**
- Larger states divided into provinces
- Each province has a capital burg
- Province boundaries respect state borders
- Names generated from capitals + titles

### 14. Route Generation

**File:** `modules/routes-generator.js`
**Module:** `Routes.generate()`

```javascript
Routes.generate() {
  generateRoads();    // Land routes between burgs
  generateTrails();   // Secondary paths
  generateSeaRoutes(); // Maritime trade routes
}
```

**Road Generation:**
- Connects burgs within states
- Pathfinding considers terrain
- Major roads between large cities
- Secondary roads to smaller towns

**Sea Routes:**
- Connects coastal burgs
- Maritime trade routes
- Follows coastlines or crosses seas

**Route Properties:**
- Width/importance
- Points along route
- Connected burgs

### 15. Military Generation

**File:** `modules/military-generator.js`
**Module:** `Military.generate()`

```javascript
Military.generate() {
  for (const state of pack.states) {
    const unitCount = calculateUnits(state.population);
    for (let i = 0; i < unitCount; i++) {
      const unit = createMilitaryUnit(state);
      state.military.push(unit);
    }
  }
}
```

**Military Units:**
- Based on state population
- Assigned to burgs
- Types: infantry, cavalry, archers, etc.
- Used for calculating state strength

### 16. Marker Generation

**File:** `modules/markers-generator.js`
**Module:** `Markers.generate()`

```javascript
Markers.generate() {
  placeVolcanoes();
  placeRuins();
  placeBattlefields();
  // ... other marker types
}
```

**Marker Types:**
- Volcanoes (on mountains)
- Ruins (ancient sites)
- Battlefields (historical locations)
- Monuments
- Mines
- Bridges
- And more...

**Placement:**
- Based on terrain suitability
- Random with constraints
- Can be manually added by users

### 17. Rendering

**File:** `main.js`
**Multiple Functions:** `drawStates()`, `drawRivers()`, `drawLabels()`, etc.

```javascript
function renderMap() {
  drawOcean();
  drawTerrain();
  drawBiomes();
  drawRivers();
  drawLakes();
  drawStates();
  drawBorders();
  drawRoutes();
  drawBurgs();
  drawLabels();
  drawIcons();
  drawScaleBar();
  drawCompass();
}
```

**Rendering Process:**
- Uses D3.js for SVG manipulation
- Layers drawn in order (back to front)
- Styling applied from templates
- Interactive elements attached

**Performance:**
- Selective layer updates
- Efficient D3 data binding
- Minimal redraws during editing

## Generation Options

Users can customize generation through various options:

### Heightmap Options
- **Template** - Select terrain type
- **Custom Image** - Upload heightmap
- **Seed** - Reproducible generation

### World Options
- **Cell Count** - Map detail level
- **Map Size** - Width and height
- **Randomize** - Randomize all settings

### Culture Options
- **Culture Count** - Number of cultures
- **Name Bases** - Language/naming styles

### State Options
- **State Count** - Number of states
- **Expansionism** - Aggression levels

### Population Options
- **Urban Density** - City frequency
- **Rural Density** - Population spread

## Procedural Name Generation

**File:** `modules/names-generator.js`
**Algorithm:** Markov Chains

```javascript
Names.generate(base, type) {
  const chain = nameBases[base];
  const name = markovGenerate(chain, type);
  return name;
}
```

**Name Bases:**
Each culture has a name base (e.g., "English", "Arabic", "Chinese") used to generate:
- Burg names (e.g., "Oakshire", "Riverton")
- Province names
- Character names
- Geographic feature names

**Markov Chains:**
- Learns patterns from example names
- Generates new names matching the style
- Produces authentic-sounding results

## Randomization & Seeds

**Seed Format:**
- Short alphanumeric string
- Example: "abc123"

**Determinism:**
- Same seed = identical map
- Allows sharing maps by seed
- Useful for debugging

**Randomization:**
Uses custom PRNG (Alea) for:
- Cross-platform consistency
- Save/load reliability
- Reproducible generation

## Performance Optimization

### Generation Speed

**Fast Operations:**
- Grid generation (~100ms)
- Heightmap (~200ms)
- Climate (~50ms)

**Slow Operations:**
- River generation (~500ms+)
- Culture expansion (~300ms)
- State generation (~400ms)

**Total Time:** ~2-5 seconds for full map

### Optimization Techniques

1. **Typed Arrays** - Memory-efficient storage
2. **Minimal Reflows** - Batch DOM updates
3. **Incremental Rendering** - Progressive display
4. **Spatial Indexing** - Fast neighbor lookups
5. **Caching** - Reuse calculated values

## Troubleshooting Generation Issues

### Common Problems

**No Rivers Generating:**
- Check precipitation settings
- Ensure adequate elevation gradients
- Verify template allows rivers

**States Not Forming:**
- Increase culture count
- Check biome habitability
- Ensure enough land area

**Performance Issues:**
- Reduce cell count
- Simplify heightmap
- Disable unused features

For more help, see [Performance Tips](https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Tips#performance-tips).

## Next Steps

- [Data Model](Data-Model.md) - Understanding the data structures
- [Modules Reference](Modules-Reference.md) - Detailed module documentation
- [Architecture](Architecture.md) - System design overview
