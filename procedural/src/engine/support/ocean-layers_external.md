# External Dependencies for ocean-layers.js

The refactored `ocean-layers.js` module requires the following external utilities to be imported:

## Required Utilities (from utils object)

- `lineGen` - D3 line generator for creating SVG path strings from point arrays
- `clipPoly` - Function to clip polygons, likely for map boundary handling
- `round` - Rounding utility function for numeric precision
- `rn` - Random number utility function 
- `P` - Probability utility function for random boolean generation

These utilities should be passed in via the `utils` parameter when calling `generateOceanLayers()`.

## Note on D3 Dependency

The `lineGen` utility appears to be a D3.js line generator that was previously accessed globally. The engine module now receives this as a dependency, maintaining separation from browser-specific D3 imports.