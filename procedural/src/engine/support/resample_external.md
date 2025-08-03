# External Module Dependencies for resample.js

The refactored `resample.js` module requires the following external modules to be imported:

## Engine Modules
- `Features` - for `markupGrid()` and `markupPack()` methods
- `Rivers` - for river processing methods like `addMeandering()`, `getBasin()`, `getApproximateLength()`
- `BurgsAndStates` - for `getCloseToEdgePoint()` and `getPoles()` methods
- `Routes` - for `buildLinks()` method
- `Provinces` - for `getPoles()` method
- `Markers` - for `deleteMarker()` method

## Utility Functions Required
The `utils` parameter should include:
- `deepCopy` - for deep copying objects
- `generateGrid` - for generating new grid
- `rn` - for rounding numbers
- `findCell` - for finding cell by coordinates
- `findAll` - for finding all cells in radius
- `isInMap` - for checking if coordinates are within map bounds
- `unique` - for getting unique values from array
- `lineclip` - for line clipping operations
- `WARN` - warning flag for console logging
- `d3` - D3.js library functions (quadtree, mean)
- `isWater` - utility to check if cell is water
- `getPolesOfInaccessibility` - for calculating poles of inaccessibility
- `smoothHeightmap` - for smoothing heightmap data

## Grid Processing Functions
These functions need to be called externally after grid generation:
- `addLakesInDeepDepressions()`
- `openNearSeaLakes()`
- `OceanLayers()`
- `calculateMapCoordinates()`
- `calculateTemperatures()`
- `reGraph()`
- `createDefaultRuler()`

## Library Dependencies
- D3.js - for quadtree operations and mathematical functions