# External Dependencies for heightmap-generator.js

The refactored heightmap-generator module requires the following external dependencies to be imported or provided via the `utils` object:

## Utility Functions
- `aleaPRNG` - Pseudo-random number generator function for seeding
- `createTypedArray` - Creates typed arrays with specified parameters
- `findGridCell` - Finds grid cell at given coordinates
- `getNumberInRange` - Converts range string to numeric value
- `lim` - Limits/clamps values to valid range
- `minmax` - Min/max utility function
- `rand` - Random number generator within range
- `P` - Probability utility function

## Libraries
- `d3` - D3.js library methods:
  - `d3.mean()` - Calculates mean of array
  - `d3.range()` - Creates array of numbers
  - `d3.scan()` - Finds index of minimum/maximum element

## Data Objects
- `heightmapTemplates` - Object containing heightmap template definitions

## Configuration/Global Variables
- `TIME` - Boolean flag for timing operations