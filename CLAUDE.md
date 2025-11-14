# CLAUDE.md - AI Assistant Guide for Fantasy Map Generator

## Project Overview

**Fantasy Map Generator** (FMG) is a free web-based application for creating and editing fantasy maps. It's a massive client-side JavaScript application designed for fantasy writers, game masters, and cartographers.

- **Repository**: https://github.com/Azgaar/Fantasy-Map-Generator
- **Live App**: https://azgaar.github.io/Fantasy-Map-Generator
- **Language**: Pure JavaScript (ES6+)
- **License**: MIT
- **Primary Author**: Azgaar (azgaar.fmg@yandex.com)

## Architecture & Technology Stack

### Core Technologies

- **Pure JavaScript (ES6+)**: NO build system, transpilation, or bundling
- **D3.js v7**: SVG manipulation, data visualization, zoom/pan interactions
- **jQuery 3.1.1 + jQuery UI**: DOM manipulation, dialogs, UI components
- **Progressive Web App (PWA)**: Service worker caching, offline support, IndexedDB storage

### Key Libraries (`/libs/`)

```
d3.min.js              # Main visualization library
delaunator.min.js      # Delaunay triangulation for Voronoi mesh
alea.min.js            # Seedable random number generator
three.min.js           # 3D rendering support
jszip.min.js           # ZIP file creation for exports
polylabel.min.js       # Label placement optimization
tinymce/               # Rich text editor for notes
```

### Architecture Pattern

**Global Object Pattern**: No module bundler, everything attached to `window` object:

```javascript
// Global data structures (from main.js:151-158)
let grid = {};           // Initial Voronoi graph
let pack = {};           // Main packed data structure
let seed;                // Map generation seed
let mapId;               // Unique map identifier
let mapHistory = [];     // Undo/redo history
let modules = {};        // Module initialization flags
let notes = [];          // User notes
```

## Directory Structure

```
Fantasy-Map-Generator/
├── index.html           # 8,184-line monolithic HTML (entire UI)
├── main.js              # 1,288 lines - initialization, globals, SVG setup
├── versioning.js        # Version management (currently v1.108.11)
├── sw.js                # Service worker for PWA caching
│
├── modules/             # Core application logic (232 JS files)
│   ├── dynamic/         # Dynamically imported modules
│   │   ├── editors/     # Advanced editors (states, religions, cultures)
│   │   ├── overview/    # Data visualization tools
│   │   └── *.js         # Auto-update, installation, hierarchy-tree
│   ├── io/              # Input/Output operations
│   │   ├── cloud.js     # Cloud storage (Dropbox)
│   │   ├── export.js    # Map export functionality
│   │   ├── load.js      # Map loading
│   │   └── save.js      # Map saving
│   ├── renderers/       # SVG rendering (12 files)
│   │   ├── draw-borders.js
│   │   ├── draw-heightmap.js
│   │   ├── draw-markers.js
│   │   └── ...
│   └── ui/              # UI editors and tools (~35 files)
│       ├── editors.js   # Common editor functions
│       ├── options.js   # Map configuration
│       └── ...
│
├── utils/               # Utility functions (15 files)
│   ├── arrayUtils.js
│   ├── colorUtils.js
│   ├── commonUtils.js   # debounce, throttle
│   ├── graphUtils.js    # Graph algorithms (297 lines)
│   ├── pathUtils.js     # SVG path operations (222 lines)
│   └── ...
│
├── charges/             # 400+ SVG heraldic symbols
├── components/          # Reusable UI components
├── config/              # Heightmap template configurations
├── heightmaps/          # Precreated heightmap resources
├── images/              # Application images/icons
├── styles/              # 12 JSON theme presets (default, night, etc.)
│
└── .github/
    ├── pull_request_template.md
    └── ISSUE_TEMPLATE/
```

## Key Files

### Entry Points

- **index.html** (line 1-8184): Entire UI structure, loads all scripts
- **main.js** (line 1-1288): Initializes globals, SVG layers, data structures
- **versioning.js**: Current version: `1.108.11` (semantic versioning)

### Core Generators

```javascript
modules/burgs-and-states.js       # City/state generation (1,018 lines)
modules/cultures-generator.js     # Culture system (1,039 lines)
modules/names-generator.js        # Name generation (3,371 lines)
modules/heightmap-generator.js    # Terrain generation (445 lines)
modules/river-generator.js        # River systems (507 lines)
modules/routes-generator.js       # Road/trail generation (537 lines)
modules/religions-generator.js    # Religion system (757 lines)
modules/military-generator.js     # Military units (405 lines)
modules/markers-generator.js      # Map markers (1,163 lines)
modules/coa-generator.js          # Coat of arms logic (1,015 lines)
modules/coa-renderer.js           # COA SVG rendering (2,527 lines)
modules/provinces-generator.js    # Province subdivision (302 lines)
modules/zones-generator.js        # Zone assignment (430 lines)
```

## Data Model

### Primary Data Structure: `pack` Object

The `pack` object is the heart of FMG's data model. It contains the entire map state using **typed arrays** for performance:

```javascript
pack = {
  cells: {
    i: Uint32Array,       // Cell indices
    v: Array,             // Adjacent vertices
    c: Array,             // Adjacent cells
    b: Uint8Array,        // Border flags
    h: Uint8Array,        // Height (0-100)
    temp: Int8Array,      // Temperature
    prec: Uint8Array,     // Precipitation
    f: Uint16Array,       // Feature (biome) ID
    t: Int8Array,         // Terrain type
    haven: Uint16Array,   // Harbor ID
    harbor: Uint8Array,   // Harbor presence
    fl: Uint16Array,      // Flux (river flow)
    r: Uint16Array,       // River ID
    conf: Uint8Array,     // River confluence
    pop: Float32Array,    // Population density
    culture: Uint16Array, // Culture ID
    burg: Uint16Array,    // Settlement ID
    road: Uint16Array,    // Road ID
    route: Uint16Array,   // Route ID
    crossroad: Uint16Array,
    province: Uint16Array,
    state: Uint16Array,   // State ownership
    religion: Uint16Array
  },
  vertices: {
    p: Array,             // Point coordinates [x, y]
    v: Array,             // Adjacent vertices
    c: Array              // Adjacent cells
  },
  features: Array,        // Biome/terrain features
  cultures: Array,        // Culture definitions
  states: Array,          // Political states
  burgs: Array,           // Cities/towns/settlements
  religions: Array,       // Religion definitions
  provinces: Array,       // Province data
  rivers: Array,          // River definitions
  markers: Array,         // Map markers
  notes: Array            // User notes
}
```

### Typed Array Constants

```javascript
// From main.js:16-20
const INT8_MAX = 127;
const UINT8_MAX = 255;
const UINT16_MAX = 65535;
const UINT32_MAX = 4294967295;
```

### Map Generation Pipeline

```
Heightmap Generation
  ↓
Voronoi/Delaunay Mesh
  ↓
Biomes & Climate
  ↓
Rivers & Water Features
  ↓
Cultures Assignment
  ↓
States & Capitals
  ↓
Burgs (Cities/Towns)
  ↓
Provinces Subdivision
  ↓
Routes (Roads/Trails)
  ↓
Religions Distribution
  ↓
Military Units
  ↓
Final Rendering
```

## SVG Layer Organization

FMG uses 70+ predefined SVG layer groups in specific render order (from main.js:40-94):

```javascript
// Background to foreground rendering order
ocean → oceanLayers → oceanPattern → lakes → landmass →
texture → terrs → biomes → cells → rivers → terrain →
regions → borders → routes → temperature → coastline →
ice → population → emblems → labels → icons → armies →
markers → fogging → ruler → debug
```

**Important**: When modifying rendering, respect this layer order to avoid z-index issues.

## Code Conventions & Style

### General Style

1. **Strict Mode**: Every file starts with `"use strict";`
2. **No Semicolons**: Generally omitted (but inconsistent)
3. **Naming Conventions**:
   - `camelCase` for variables and functions
   - `PascalCase` for classes
   - `SCREAMING_SNAKE_CASE` for constants
4. **Comments**: Minimal; code is mostly self-documenting
5. **String Quotes**: Mixed single and double quotes (no standard)

### Module Patterns

**IIFE (Immediately Invoked Function Expression)**:

```javascript
// From burgs-and-states.js:3
window.BurgsAndStates = (() => {
  const generate = () => {
    // Implementation
  };

  return { generate };
})();

// Usage elsewhere:
BurgsAndStates.generate();
```

**Global Function Pattern**:

```javascript
// From draw-borders.js:3
function drawBorders() {
  // Direct global function
}
```

**Utility Module Pattern**:

```javascript
// From utils/commonUtils.js
function debounce(func, ms) { /* ... */ }
function throttle(func, ms) { /* ... */ }
// Directly callable globally
```

### Loading Strategy

**index.html** loads scripts in three phases:

1. **Libraries** (D3, jQuery, etc.)
2. **Core Modules** (synchronous, no `defer`)
3. **UI Modules** (with `defer` attribute)
4. **Dynamic Imports** (ES6 `import()` for lazy loading)

Example from index.html:
```html
<!-- Core generators loaded first -->
<script src="modules/names-generator.js?v=1.108.11"></script>
<script src="modules/cultures-generator.js?v=1.108.11"></script>
<script src="modules/burgs-and-states.js?v=1.108.11"></script>
<!-- ... -->
<script src="main.js?v=1.108.11"></script>

<!-- UI modules loaded with defer -->
<script defer src="modules/ui/editors.js?v=1.108.11"></script>
<script defer src="modules/ui/heightmap-editor.js?v=1.108.11"></script>
```

### Debug Flags

```javascript
// From main.js:5-11
const PRODUCTION = location.hostname &&
                   location.hostname !== "localhost" &&
                   location.hostname !== "127.0.0.1";
const DEBUG = JSON.safeParse(localStorage.getItem("debug")) || {};
const INFO = true;
const TIME = true;   // Performance timing
const WARN = true;
const ERROR = true;

// Usage:
TIME && console.time("placeCapitals");
// ... expensive operation ...
TIME && console.timeEnd("placeCapitals");
```

## Development Workflow

### No Build System

- **Zero build configuration**: No webpack, rollup, or bundlers
- **No package.json**: No npm dependencies
- **No transpilation**: No Babel or TypeScript
- **Direct file editing**: Edit JS → Refresh browser → See changes

### Local Development

```bash
# Python simple server
python -m http.server 8080

# PHP built-in server
php -S localhost:8080

# Then visit: http://localhost:8080
```

### Versioning Process

**Manual 3-step versioning** (from pull_request_template.md):

1. **Update VERSION** in `versioning.js`:
   ```javascript
   const VERSION = "1.108.12"; // Increment using semver
   ```

2. **Update file hashes** in `index.html` for all changed files:
   ```html
   <script src="modules/burgs-and-states.js?v=1.108.12"></script>
   ```

3. **Update changelog** in `showUpdateWindow()` function (versioning.js) if user-facing

### Git Workflow

**Commit Message Format** (inferred from git log):

```
<type>(<scope>): <description>

Examples:
fix(v1.108.11): add external icons to export in base64 format
feat(ai-generator): update supported AI models list
refactor: drawReliefIcons, v1.108.4
perf: set text-rendering to optimizeSpeed, v1.108.1
chore: update version to 1.108.8
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `chore`: Maintenance tasks
- `docs`: Documentation changes

**Scopes**: Optional, often includes version number or component name

### Pull Request Requirements

From `.github/pull_request_template.md`:

**Required**:
- [ ] Description of change and motivation
- [ ] Type of change (bug fix, feature, refactor, docs, other)
- [ ] Version updated in `versioning.js`
- [ ] Changed files hash updated in `index.html`

**Before submitting**:
1. Test locally (no automated tests)
2. Check console for errors
3. Verify map generation still works
4. Update version following semver

## Common Development Tasks

### Adding a New Feature

1. **Identify the module type**:
   - Generator? → `modules/`
   - UI Editor? → `modules/ui/`
   - Renderer? → `modules/renderers/`
   - Utility? → `utils/`

2. **Create the module file**:
   ```javascript
   "use strict";

   window.MyNewFeature = (() => {
     const generate = () => {
       TIME && console.time("myNewFeature");
       // Implementation
       TIME && console.timeEnd("myNewFeature");
     };

     return { generate };
   })();
   ```

3. **Add script tag to index.html**:
   ```html
   <script src="modules/my-new-feature.js?v=1.108.12"></script>
   ```

4. **Update versioning**:
   - Increment VERSION in `versioning.js`
   - Update hash in `index.html`
   - Add changelog entry if user-facing

### Modifying the Data Model

1. **Update pack structure** in relevant generator
2. **Update save/load** in `modules/io/save.js` and `modules/io/load.js`
3. **Test with existing .map files** to ensure backward compatibility
4. **Update any renderers** that use the new data

### Adding a New Renderer

1. **Create renderer file** in `modules/renderers/`:
   ```javascript
   "use strict";

   function drawMyFeature() {
     const { cells, myFeatures } = pack;
     const container = svg.select("#myFeatureLayer");

     // D3 rendering logic
     container.selectAll("path")
       .data(myFeatures)
       .join("path")
       .attr("d", d => d.path)
       .attr("fill", d => d.color);
   }
   ```

2. **Create SVG layer** in main.js:
   ```javascript
   let myFeatureLayer = viewbox.append("g")
     .attr("id", "myFeatureLayer");
   ```

3. **Add to render pipeline** in appropriate location

### Debugging Tips

1. **Use DEBUG flags**:
   ```javascript
   DEBUG && console.log("Debug info:", data);
   TIME && console.time("expensiveOperation");
   ```

2. **Check the debug SVG layer**:
   ```javascript
   debug.append("circle")
     .attr("cx", x)
     .attr("cy", y)
     .attr("r", 5)
     .attr("fill", "red");
   ```

3. **Use browser DevTools**:
   - Network tab: Check script loading
   - Console: Look for TIME logs
   - Sources: Set breakpoints

4. **Test map generation**:
   - Generate → Verify no console errors
   - Save → Load → Verify data integrity
   - Export → Check output quality

## Testing Approach

**No formal testing framework**:
- No Jest, Mocha, or automated tests
- Manual testing only
- User reports via GitHub issues

**Manual testing checklist**:
1. Generate new map with default settings
2. Generate with various custom settings
3. Load existing .map files
4. Test all editors (heightmap, states, cultures, etc.)
5. Export in all formats (SVG, PNG, JSON)
6. Check console for errors/warnings
7. Test on multiple browsers (Chrome, Firefox, Safari)

## Performance Considerations

### Optimization Strategies

1. **Typed Arrays**: Use for large datasets
   ```javascript
   cells.h = new Uint8Array(n);  // Heights 0-255
   cells.pop = new Float32Array(n);  // Population
   ```

2. **D3 Data Binding**: Efficient DOM updates
   ```javascript
   container.selectAll("path")
     .data(features, d => d.id)  // Key function
     .join("path")  // Efficient enter/update/exit
   ```

3. **Debouncing/Throttling**: For frequent events
   ```javascript
   const onMouseMove = debounce(handleMouseMove, 100);
   ```

4. **Quadtree for Spatial Queries**:
   ```javascript
   let burgsTree = d3.quadtree();
   burgsTree.add([x, y]);
   const nearest = burgsTree.find(x, y, radius);
   ```

5. **IndexedDB**: For large map storage
   ```javascript
   // See libs/indexedDB.js
   ```

## Important Patterns & Anti-Patterns

### DO:

✅ Use typed arrays for cell data
✅ Respect SVG layer rendering order
✅ Use TIME flags for performance monitoring
✅ Follow IIFE pattern for new modules
✅ Update version numbers consistently
✅ Test backward compatibility with old .map files
✅ Use D3 data binding for DOM updates
✅ Check for null/undefined before accessing pack data

### DON'T:

❌ Add npm dependencies (no build system)
❌ Use ES6 modules (not supported in current architecture)
❌ Modify global data structures directly without updating renderers
❌ Add large libraries (keep bundle size manageable)
❌ Break backward compatibility without migration logic
❌ Add features without updating save/load functionality
❌ Forget to update version hash in index.html
❌ Mix rendering layers (respect z-order)

## Common Patterns in Codebase

### Random Number Generation

```javascript
// Use seeded random for reproducibility
const rand = aleaPRNG(seed);
const value = rand();  // 0-1

// Gaussian distribution
const value = gauss(mean, deviation, min, max, rounds);
```

### Cell Iteration

```javascript
const { cells } = pack;
const n = cells.i.length;

for (let i = 0; i < n; i++) {
  if (cells.h[i] < 20) continue;  // Skip water
  // Process land cells
}
```

### D3 SVG Path Creation

```javascript
const path = d3.line()
  .x(d => d[0])
  .y(d => d[1])
  .curve(d3.curveBasis);

const pathString = path(points);
```

### Graph Traversal

```javascript
// BFS example from graphUtils.js
const queue = [startCell];
const visited = new Uint8Array(cells.i.length);

while (queue.length) {
  const cell = queue.shift();
  if (visited[cell]) continue;
  visited[cell] = 1;

  cells.c[cell].forEach(neighbor => {
    if (!visited[neighbor]) queue.push(neighbor);
  });
}
```

## Key Concepts

### Voronoi/Delaunay Mesh

FMG uses a Voronoi diagram as the base map structure:

- **Cells**: Voronoi regions representing map areas
- **Vertices**: Points where 3+ cells meet
- **Edges**: Borders between cells
- **Delaunay Triangulation**: Dual graph for efficient pathfinding

**Implementation**: Custom `Voronoi` class in `modules/voronoi.js` using Delaunator library

### Heightmap System

Heights stored as `Uint8Array` (0-255):
- **0-19**: Ocean depths
- **20**: Sea level
- **21-99**: Land elevations
- **100+**: Mountains/peaks (clamped to 255)

### Culture & State System

**Cultures**: Linguistic/ethnic groups with naming patterns
**States**: Political entities with territories, capitals, military

Both use expansion algorithms based on cell scoring and distance from capitals.

### Name Generation

Sophisticated system in `modules/names-generator.js` (3,371 lines):
- Cultural naming patterns
- Procedural phoneme generation
- Linguistic rules for realistic names
- Separate generators for burgs, states, cultures, features

## File Modification Guidelines

### When Editing index.html

- **Line count**: 8,184 lines - VERY large file
- **Structure**: UI components inline (not templated)
- **Script tags**: Update version hash when modifying JS files
- **Dialogs**: jQuery UI dialogs defined inline
- **Be careful**: Easy to break HTML structure

### When Editing main.js

- **Global scope**: Everything here is globally accessible
- **SVG layers**: Order matters (lines 40-94)
- **Constants**: Typed array max values defined here
- **Initialization**: Core setup happens here

### When Editing Generators

- **Self-contained**: Each generator should be independent
- **Timing**: Wrap in TIME && console.time/timeEnd
- **Error handling**: Use WARN && console.warn for issues
- **Data mutations**: Update pack object directly

### When Editing Renderers

- **Layer awareness**: Know which SVG layer you're drawing to
- **Clear old content**: Remove previous render before redrawing
- **D3 data binding**: Use .join() for efficient updates
- **Performance**: Large renders should be optimized

## Resources

### Documentation

- **Project Wiki**: https://github.com/Azgaar/Fantasy-Map-Generator/wiki
- **Data Model**: https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Data-model
- **Trello Board**: https://trello.com/b/7x832DG4/fantasy-map-generator
- **Blog**: https://azgaar.wordpress.com

### Community

- **Discord**: https://discordapp.com/invite/X7E84HU
- **Reddit**: https://www.reddit.com/r/FantasyMapGenerator
- **GitHub Issues**: https://github.com/Azgaar/Fantasy-Map-Generator/issues

### Support

- **Patreon**: https://www.patreon.com/azgaar
- **Email**: azgaar.fmg@yandex.com

## Troubleshooting Common Issues

### Map Won't Generate

1. Check console for errors
2. Verify all scripts loaded (Network tab)
3. Check localStorage isn't corrupted
4. Try clearing browser cache

### Save/Load Failures

1. Check IndexedDB quota
2. Verify .map file format (should be valid JSON)
3. Check version compatibility
4. Look for migration errors in console

### Performance Issues

1. Reduce number of cells (Options → Map Size)
2. Disable unused layers
3. Use simpler rendering styles
4. Check for memory leaks in console

### Rendering Glitches

1. Verify SVG layer order
2. Check for NaN values in coordinates
3. Ensure paths are valid SVG syntax
4. Test in different browsers

## Best Practices for AI Assistants

### When Analyzing Code

1. **Start with the data model**: Understand `pack` structure
2. **Check dependencies**: See what functions/modules are used
3. **Look for patterns**: IIFE modules, global functions, D3 usage
4. **Trace data flow**: How data moves through generation pipeline

### When Making Changes

1. **Test locally first**: No CI/CD, manual testing required
2. **Update version properly**: Follow 3-step process
3. **Maintain backward compatibility**: Old .map files should still load
4. **Document complex logic**: Code is under-commented
5. **Check performance**: Use TIME flags to measure

### When Refactoring

1. **Small incremental changes**: Large refactors are risky
2. **Keep the same API**: Don't break existing integrations
3. **Test all features**: Generator, editors, save/load, export
4. **Consider deprecation**: Don't remove features abruptly

### When Adding Features

1. **Check existing code**: Similar features might exist
2. **Follow existing patterns**: IIFE for modules, global for utils
3. **Update save/load**: Persist new data properly
4. **Add UI if needed**: Users should access the feature
5. **Update documentation**: At least in comments/changelog

## Quick Reference

### File to Edit By Task

| Task | Files to Edit |
|------|--------------|
| Add new generator | `modules/my-generator.js`, `index.html` (script tag) |
| Modify UI editor | `modules/ui/my-editor.js` |
| Change rendering | `modules/renderers/draw-my-feature.js` |
| Add utility function | `utils/myUtils.js` |
| Update save format | `modules/io/save.js`, `modules/io/load.js` |
| Change map options | `modules/ui/options.js`, `index.html` (UI) |
| Add SVG layer | `main.js` (lines 40-94), renderer file |
| Update version | `versioning.js`, `index.html` (all script tags) |

### Common Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `rn(value, decimals)` | `utils/numberUtils.js` | Round number |
| `rand(min, max)` | Random utilities | Random in range |
| `gauss(mean, dev, ...)` | `utils/probabilityUtils.js` | Gaussian distribution |
| `debounce(fn, ms)` | `utils/commonUtils.js` | Debounce function |
| `P(probability)` | Probability utils | Random boolean |
| `ra(array)` | Array utils | Random array element |

### Common D3 Patterns

```javascript
// Select SVG layer
const layer = svg.select("#myLayer");

// Data binding
layer.selectAll("path")
  .data(features, d => d.id)
  .join("path")
  .attr("d", d => d.path);

// Zoom/pan
const zoom = d3.zoom()
  .scaleExtent([1, 20])
  .on("zoom", zoomed);

svg.call(zoom);
```

---

## Summary

Fantasy Map Generator is a **unique codebase** that prioritizes:

1. **Accessibility**: Runs anywhere without build tools
2. **Simplicity**: Direct file editing, no complex tooling
3. **Performance**: Typed arrays, efficient algorithms
4. **User experience**: Rich UI with extensive customization

When working on FMG, embrace its philosophy: **pragmatic simplicity over modern complexity**. The lack of build tools is intentional, making it easy for contributors to jump in without setup overhead.

---

*Last Updated: 2025-11-14*
*Current Version: 1.108.11*
*This guide is for AI assistants working on Fantasy Map Generator codebase.*
