# External Dependencies for heightmap-generator.js

The refactored heightmap generator module requires the following external imports:

## From Utils Package
- `heightmapTemplates` - Object containing heightmap template definitions
- `aleaPRNG` - Pseudorandom number generator for reproducible results
- `getNumberInRange` - Utility to parse and generate numbers from range strings
- `findGridCell` - Function to find grid cell at given coordinates
- `lim` - Function to limit values to valid range (0-100)
- `d3` - D3.js utilities (specifically `d3.mean`, `d3.range`, `d3.scan`)
- `P` - Probability function (returns true/false based on probability)
- `rand` - Random number generator within range
- `ERROR` - Error logging flag
- `TIME` - Time logging flag
- `createTypedArray` - Factory function for creating typed arrays
- `minmax` - Utility to clamp values between min and max

## Internal Functions
- `getPointInRange` - Utility to generate coordinates within specified ranges (defined within the module)

## Template System
The module expects `heightmapTemplates` to be an object where each key is a template ID and each value has a `template` property containing newline-separated steps.

Example structure:
```javascript
const heightmapTemplates = {
  "default": {
    template: "Hill 5 50 10-30 10-30\nSmooth 2\nMask 1"
  },
  "archipelago": {
    template: "Hill 20 30 0-100 0-100\nMask -0.5"
  }
};
```