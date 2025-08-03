# External Module Dependencies for submap.js

The refactored `submap.js` module requires the following external modules to be imported:

## Core Engine Modules
- `Features` - For grid and pack markup operations
- `Rivers` - For river restoration and management
- `BurgsAndStates` - For burg and state restoration
- `Routes` - For route restoration 
- `Provinces` - For province restoration
- `Markers` - For marker management

## Utility Functions (passed via utils object)
- `deepCopy` - For creating deep copies of objects
- `generateGrid` - For generating new grid structure
- `addLakesInDeepDepressions` - For lake generation
- `openNearSeaLakes` - For lake processing
- `OceanLayers` - For ocean layer processing
- `calculateMapCoordinates` - For coordinate calculations
- `calculateTemperatures` - For temperature calculations
- `reGraph` - For graph regeneration
- `createDefaultRuler` - For ruler creation
- `getPolesOfInaccessibility` - For calculating geometric poles
- `isWater` - Utility function to check if cell is water
- `findCell` - Function to find cell by coordinates
- `findAll` - Function to find all cells in radius
- `rn` - Rounding utility function
- `unique` - Array deduplication utility
- `d3` - D3.js library for quadtree operations
- `lineclip` - Line clipping utility
- `WARN` - Warning flag for console output