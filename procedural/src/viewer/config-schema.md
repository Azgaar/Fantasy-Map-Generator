# Fantasy Map Generator - Configuration Schema

This document defines the complete TypeScript-style interface for the FMG configuration object.

## Complete Configuration Interface

```typescript
interface FMGConfig {
  // Core generation parameters
  seed?: string;                    // Random seed for reproducible generation
  
  // Graph/Grid generation
  graph: {
    width: number;                 // Canvas width (default: 1920)
    height: number;                // Canvas height (default: 1080)
    cellsDesired?: number;         // Target number of cells (default: 10000)
    cellsNumber?: number;          // Actual number of cells generated
    points?: number;               // Number of voronoi points
    boundary?: string;             // Boundary type: "box", "circle", etc.
  };
  
  // Map dimensions and coordinates
  map: {
    coordinatesSize?: number;      // Size factor for map coordinates
    latitude?: number;             // Central latitude for temperature calculations
  };
  
  // Heightmap generation
  heightmap: {
    templateId: string;            // Template: "continents", "archipelago", "highland", "inland", etc.
    template?: string;             // Alternative name for templateId
  };
  
  // Temperature configuration
  temperature: {
    heightExponent?: number;       // Height influence on temperature (default: 1.8)
    temperatureScale?: string;     // Temperature scale: "C" or "F"
    temperatureBase?: number;      // Base temperature value
  };
  
  // Precipitation configuration
  precipitation: {
    winds?: any[];                 // Wind patterns configuration
    moisture?: number;             // Base moisture level
  };
  
  // Feature configuration
  features: {
    // Currently no user-configurable parameters
  };
  
  // Biomes configuration  
  biomes: {
    // Currently no user-configurable parameters
  };
  
  // Lakes configuration
  lakes: {
    lakeElevationLimit: number;   // Elevation limit for open lakes (default: 50)
    heightExponent: number;        // Exponent for lake evaporation (default: 2)
  };
  
  // River generation
  rivers: {
    resolveDepressionsSteps: number;  // Max iterations for depression resolution (default: 1000)
    cellsCount?: number;               // Total number of cells (for calculations)
  };
  
  // Ocean layers
  oceanLayers: {
    outline: string;               // "none", "random", or comma-separated depths ("-1,-2,-3")
  };
  
  // Cultures configuration
  cultures: {
    culturesInput: number;         // Number of cultures to generate (default: 12)
    culturesInSetNumber: number;   // Max cultures in selected set
    culturesSet: string;           // Culture set: "european", "oriental", "english", "antique", "highFantasy", "darkFantasy", "random"
    sizeVariety: number;           // Culture size variety (default: 1)
    neutralRate?: number;          // Neutral expansion rate (default: 1)
    emblemShape: string;           // Shield shape for emblems
    emblemShapeGroup?: string;     // Shield shape group category
  };
  
  // Burgs and States configuration
  burgs: {
    statesNumber: number;          // Number of states to generate (default: 15)
    sizeVariety: number;           // State size variety factor (default: 1)
    manorsInput: number;           // Number of towns (1000 = auto-calculate)
    growthRate: number;            // Global growth rate multiplier (default: 1)
    statesGrowthRate?: number;     // State-specific growth rate (default: 1)
  };
  
  // Religions configuration
  religions: {
    religionsNumber: number;       // Number of religions to generate (default: 5)
    growthRate: number;            // Religion expansion rate (default: 1)
  };
  
  // Provinces configuration
  provinces: {
    provincesRatio: number;        // Ratio of burgs to provinces (0-100, default: 50)
  };
  
  // Military configuration
  military: {
    military?: any[];              // Military unit configurations
    year?: number;                 // Current calendar year
    eraShort?: string;             // Short era designation (e.g., "AD")
    era?: string;                  // Full era designation (e.g., "Anno Domini")
  };
  
  // Markers configuration
  markers: {
    culturesSet?: string;          // Culture set (affects fantasy markers)
  };
  
  // Zones configuration
  zones: {
    globalModifier?: number;       // Zone density modifier (default: 1)
  };
  
  // Debugging and logging
  debug?: {
    TIME?: boolean;                // Enable timing logs
    WARN?: boolean;                // Enable warning logs
    INFO?: boolean;                // Enable info logs
    ERROR?: boolean;               // Enable error logs
  };
}

// Preset type definitions
type HeightmapTemplate = 
  | "continents"
  | "archipelago" 
  | "highland"
  | "inland"
  | "lakes"
  | "islands"
  | "atoll"
  | "volcano"
  | "crater";

type CultureSet = 
  | "european"
  | "oriental"
  | "english"
  | "antique"
  | "highFantasy"
  | "darkFantasy"
  | "random"
  | "all-world";

type EmblemShape = 
  | "random"
  | "heater"
  | "spanish"
  | "french"
  | "horsehead"
  | "horsehead2"
  | "polish"
  | "hessen"
  | "swiss"
  | "boeotian"
  | "roman"
  | "kite"
  | "oldFrench"
  | "renaissance"
  | "baroque"
  | "targe"
  | "targe2"
  | "pavise"
  | "wedged"
  | "round"
  | "oval"
  | "square"
  | "diamond"
  | "flag"
  | "pennon"
  | "guidon"
  | "banner"
  | "dovetail"
  | "gonfalon"
  | "pennant"
  | "fantasy1"
  | "fantasy2"
  | "fantasy3"
  | "fantasy4"
  | "fantasy5"
  | "noldor"
  | "gondor"
  | "easterling"
  | "erebor"
  | "ironHills"
  | "urukHai"
  | "moriaOrc";

type OceanOutline = 
  | "none"
  | "random"
  | string; // Comma-separated depth values

// Validation interfaces
interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ConfigRange {
  min?: number;
  max?: number;
  default: number;
}
```

## Default Values

```typescript
const DEFAULT_CONFIG: Partial<FMGConfig> = {
  seed: undefined, // Will be auto-generated if not provided
  
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 10000,
    boundary: "box"
  },
  
  map: {
    coordinatesSize: 1,
    latitude: 0
  },
  
  heightmap: {
    templateId: "continents"
  },
  
  temperature: {
    heightExponent: 1.8,
    temperatureScale: "C",
    temperatureBase: 25
  },
  
  precipitation: {
    moisture: 1
  },
  
  features: {},
  
  biomes: {},
  
  lakes: {
    lakeElevationLimit: 50,
    heightExponent: 2
  },
  
  rivers: {
    resolveDepressionsSteps: 1000
  },
  
  oceanLayers: {
    outline: "-1,-2,-3"
  },
  
  cultures: {
    culturesInput: 12,
    culturesInSetNumber: 15,
    culturesSet: "european",
    sizeVariety: 1,
    neutralRate: 1,
    emblemShape: "random"
  },
  
  burgs: {
    statesNumber: 15,
    sizeVariety: 1,
    manorsInput: 1000, // Auto-calculate
    growthRate: 1,
    statesGrowthRate: 1
  },
  
  religions: {
    religionsNumber: 5,
    growthRate: 1
  },
  
  provinces: {
    provincesRatio: 50
  },
  
  military: {
    year: 1400,
    eraShort: "AD",
    era: "Anno Domini"
  },
  
  markers: {},
  
  zones: {
    globalModifier: 1
  },
  
  debug: {
    TIME: false,
    WARN: true,
    INFO: false,
    ERROR: true
  }
};
```

## Validation Rules

### Required Properties
- `graph.width` - Must be positive number
- `graph.height` - Must be positive number
- `heightmap.templateId` - Must be valid template name

### Range Constraints
- `graph.width`: 100 - 8192
- `graph.height`: 100 - 8192
- `graph.cellsDesired`: 1000 - 100000
- `cultures.culturesInput`: 0 - 99
- `burgs.statesNumber`: 0 - 999
- `burgs.manorsInput`: 0 - 10000
- `religions.religionsNumber`: 0 - 99
- `provinces.provincesRatio`: 0 - 100
- `lakes.lakeElevationLimit`: 0 - 100
- `rivers.resolveDepressionsSteps`: 100 - 10000
- All growth rates: 0.1 - 10
- All variety factors: 0 - 5

### Type Constraints
- All numeric properties must be valid numbers (not NaN)
- String enums must match predefined values
- Optional properties can be undefined but not null

## Usage Examples

### Minimal Configuration
```typescript
const minimalConfig: FMGConfig = {
  graph: {
    width: 1920,
    height: 1080
  },
  heightmap: {
    templateId: "continents"
  }
  // All other properties will use defaults
};
```

### Fantasy World Configuration
```typescript
const fantasyConfig: FMGConfig = {
  seed: "fantasy-world-123",
  graph: {
    width: 2560,
    height: 1440,
    cellsDesired: 20000
  },
  heightmap: {
    templateId: "archipelago"
  },
  cultures: {
    culturesInput: 20,
    culturesInSetNumber: 30,
    culturesSet: "highFantasy",
    sizeVariety: 2,
    emblemShape: "fantasy1"
  },
  burgs: {
    statesNumber: 25,
    sizeVariety: 1.5,
    manorsInput: 1000,
    growthRate: 1.2
  },
  religions: {
    religionsNumber: 12,
    growthRate: 1.5
  }
};
```

### Realistic Earth-like Configuration
```typescript
const realisticConfig: FMGConfig = {
  seed: "earth-like-456",
  graph: {
    width: 1920,
    height: 1080,
    cellsDesired: 15000
  },
  heightmap: {
    templateId: "continents"
  },
  temperature: {
    heightExponent: 2,
    temperatureBase: 20
  },
  cultures: {
    culturesInput: 8,
    culturesInSetNumber: 15,
    culturesSet: "european",
    sizeVariety: 1,
    emblemShape: "heater"
  },
  burgs: {
    statesNumber: 10,
    sizeVariety: 0.8,
    manorsInput: 1000,
    growthRate: 0.8
  },
  religions: {
    religionsNumber: 3,
    growthRate: 0.7
  }
};
```