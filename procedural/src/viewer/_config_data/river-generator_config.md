# Configuration Properties for river-generator.js

## DOM-Based Configuration Parameters Identified

The refactored `river-generator.js` module identified the following DOM reads that were converted to config properties:

### `resolveDepressionsSteps`
- **Original DOM read:** `document.getElementById("resolveDepressionsStepsOutput").value` (line 330)
- **Purpose:** Maximum number of iterations for the depression resolution algorithm
- **Type:** Number (integer)
- **Default suggestion:** 1000

### Derived Configuration Parameters

Additionally, the following parameters were extracted from global variables that should be configurable:

### `cellsCount`
- **Original source:** `pointsInput.dataset.cells` (lines 111, 240)
- **Purpose:** Total number of cells in the map for calculations
- **Type:** Number (integer)
- **Usage:** Used in cellsNumberModifier calculations and width factor calculations

### Graph Dimensions
- **Original source:** Global `graphWidth` and `graphHeight` (lines 449, 453)
- **Purpose:** Map boundaries for border point calculations
- **Type:** Number
- **Properties:** `graphWidth`, `graphHeight`

### Flags and Constants
- **Original source:** Global variables
- **Properties:**
  - `TIME` - Boolean flag for timing logs
  - `WARN` - Boolean flag for warning messages
  - `seed` - Random seed for reproducible generation
  - `aleaPRNG` - Pseudo-random number generator function

## Configuration Object Structure

```javascript
const config = {
  // DOM-derived parameters
  resolveDepressionsSteps: 1000,    // Max iterations for depression resolution
  
  // System parameters
  cellsCount: 10000,                // Total number of map cells
  graphWidth: 1920,                 // Map width
  graphHeight: 1080,                // Map height
  
  // Flags and utilities
  TIME: true,                       // Enable timing logs
  WARN: true,                       // Enable warning messages
  seed: 'map_seed_123',             // Random seed
  aleaPRNG: seedrandom              // PRNG function
};
```

## Usage Notes

1. **`resolveDepressionsSteps`** is critical for terrain depression resolution - higher values provide more accurate results but take longer to compute
2. **`cellsCount`** affects river width calculations and flux modifiers
3. **Graph dimensions** are essential for proper border calculations when rivers flow off the map
4. **Timing flags** should be configurable for debugging and performance monitoring

## Migration Impact

This conversion removes the last DOM dependency from the river generation system, making it fully headless and environment-agnostic while maintaining all original functionality through proper configuration injection.