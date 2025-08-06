# Config Structure Reference

Based on `src/viewer/config-builder.js`, the config object has this nested structure:

```javascript
config = {
  seed: String,                    // Random seed for generation
  
  graph: {
    width: Number,                 // Canvas width (default: 1920)
    height: Number,                // Canvas height (default: 1080)
    cellsDesired: Number           // Target number of cells (default: 10000)
  },
  
  map: {
    coordinatesSize: Number,       // Coordinate display size (default: 1)
    latitude: Number               // Map latitude (default: 0)
  },
  
  heightmap: {
    templateId: String             // Template ID (default: "continents")
  },
  
  temperature: {
    heightExponent: Number,        // Height effect on temp (default: 1.8)
    temperatureScale: String,      // "C" or "F" (default: "C")
    temperatureBase: Number        // Base temperature (default: 25)
  },
  
  precipitation: {
    winds: Array,                  // Wind patterns (default: [])
    moisture: Number               // Moisture level (default: 1)
  },
  
  features: {},                    // No UI config
  biomes: {},                      // No UI config
  
  lakes: {
    lakeElevationLimit: Number,    // Max lake elevation (default: 50)
    heightExponent: Number         // Height exponent (default: 2)
  },
  
  rivers: {
    resolveDepressionsSteps: Number, // Depression resolution steps (default: 1000)
    cellsCount: Number             // Cell count for rivers
  },
  
  oceanLayers: {
    outline: String                // Ocean layer outline (default: "-1,-2,-3")
  },
  
  cultures: {
    culturesInput: Number,         // Number of cultures (default: 12)
    culturesInSetNumber: Number,   // Cultures in set (default: 15)
    culturesSet: String,           // Culture set name (default: "european")
    sizeVariety: Number,           // Size variety (default: 1)
    neutralRate: Number,           // Neutral expansion rate (default: 1)
    emblemShape: String,           // Emblem shape (default: "random")
    emblemShapeGroup: String       // Emblem shape group (default: "Diversiform")
  },
  
  burgs: {
    statesNumber: Number,          // Number of states (default: 15)
    sizeVariety: Number,           // Size variety (default: 1)
    manorsInput: Number,           // Number of manors (default: 1000)
    growthRate: Number,            // Burg growth rate (default: 1)
    statesGrowthRate: Number       // State growth rate (default: 1)
  },
  
  religions: {
    religionsNumber: Number,       // Number of religions (default: 5)
    growthRate: Number             // Religion growth rate (default: 1)
  },
  
  provinces: {
    provincesRatio: Number         // Provinces ratio (default: 50)
  },
  
  military: {
    year: Number,                  // Year (default: 1400)
    eraShort: String,              // Short era name (default: "AD")
    era: String                    // Full era name (default: "Anno Domini")
  },
  
  markers: {
    culturesSet: String            // Culture set for markers (default: "european")
  },
  
  zones: {
    globalModifier: Number         // Global zone modifier (default: 1)
  },
  
  debug: {
    TIME: Boolean,                 // Time debugging (default: false)
    WARN: Boolean,                 // Warning messages (default: true)
    INFO: Boolean,                 // Info messages (default: false)
    ERROR: Boolean                 // Error messages (default: true)
  }
}
```

## Common Access Patterns

### ❌ Wrong (flat access):
- `config.culturesInput` → Should be `config.cultures.culturesInput`
- `config.statesNumber` → Should be `config.burgs.statesNumber`
- `config.religionsNumber` → Should be `config.religions.religionsNumber`

### ✅ Correct (nested access):
- `config.cultures.culturesInput`
- `config.burgs.statesNumber`
- `config.religions.religionsNumber`
- `config.debug.TIME`