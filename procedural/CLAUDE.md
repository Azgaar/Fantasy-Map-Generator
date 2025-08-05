# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies
npm install

# Development server (Vite)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Generate map via CLI (work in progress)
node cli.js --preset default --output map.json
node cli.js --config myconfig.json --seed myseed --output mymap.json
```

## High-Level Architecture

This project is being ported from a tightly-coupled browser application to a headless procedural generation engine with separate presentation layer.

### Project Structure

```
/procedural
├── src/
│   ├── engine/           # Headless map generation engine
│   │   ├── main.js      # Orchestrator - exports generate(config) function
│   │   ├── modules/     # Generation modules (biomes, cultures, rivers, etc.)
│   │   └── utils/       # Environment-agnostic utilities
│   │
│   └── viewer/          # Web viewer application
│       ├── config-*.js  # Configuration management
│       └── libs/        # Browser-specific libraries
│
├── cli.js               # Command-line interface
├── main.js              # Viewer entry point (Vite)
└── index.html           # Web app HTML
```

### Core Architecture Flow

1. **Configuration** → `generate(config)` → **MapData**
   - Config object defines all generation parameters (see `src/viewer/config-schema.md`)
   - Engine is pure JavaScript with no browser dependencies
   - Returns serializable MapData object

2. **Module Pattern**
   - Each module exports pure functions
   - No global state manipulation
   - Receives data, returns new data
   - No IIFE wrappers or window dependencies

### Key Modules

- **Heightmap**: Generates terrain elevation
- **Features**: Marks geographic features (land, ocean, lakes)
- **Rivers**: Generates river systems
- **Biomes**: Assigns biomes based on climate
- **Cultures**: Places and expands cultures
- **BurgsAndStates**: Generates settlements and political entities
- **Routes**: Creates trade and travel routes

## Configuration System

Configuration drives the entire generation process. See `src/viewer/config-schema.md` for complete TypeScript interface.

Key sections:
- `graph`: Canvas dimensions and cell count
- `heightmap`: Terrain template selection
- `cultures`: Number and type of cultures
- `burgs`: States and settlements
- `debug`: Logging flags (TIME, WARN, INFO)

## Important Development Notes

1. **Ongoing Port**: Moving from DOM/SVG manipulation to pure data generation per `PORT_PLAN.md`

2. **Module Refactoring Pattern**:
   ```javascript
   // OLD: window.Module = (function() { ... })();
   // NEW: export function generateModule(data, config, utils) { ... }
   ```

3. **No Browser Dependencies in Engine**: 
   - No `window`, `document`, or DOM access
   - No direct SVG/D3 manipulation
   - All rendering logic stays in viewer

4. **Utility Organization**:
   - Generic utilities in `src/engine/utils/`
   - Specialized utilities imported as needed
   - PRNG (Alea) for reproducible generation

5. **Data Flow**:
   - Grid (coarse Voronoi mesh) → Pack (refined mesh)
   - Sequential module execution builds up complete map
   - Each module adds its data to the growing structure

## Testing Approach

Currently no formal test suite. When adding tests:
- Focus on engine modules (pure functions)
- Test with known seeds for reproducibility
- Validate output data structures