# External Dependencies for river-generator.js

The refactored `river-generator.js` module requires the following external dependencies to be imported:

## Module Dependencies

### `Lakes` module
- **Functions used:**
  - `Lakes.detectCloseLakes(h)` - Detect lakes close to each other
  - `Lakes.defineClimateData(h)` - Define climate data for lakes
  - `Lakes.cleanupLakeData()` - Clean up lake data after processing

### `Names` module
- **Functions used:**
  - `Names.getCulture(cultureId)` - Get cultural names for rivers

## Utility Functions Required

The following utility functions need to be passed via the `utils` parameter:

### Core Utilities
- `rn(value, precision)` - Rounding function with precision
- `rw(weightedObject)` - Random weighted selection from object
- `each(n)` - Function that returns a function checking if value is divisible by n
- `round(value, precision)` - General rounding function

### D3.js Integration
- `d3.mean(array)` - Calculate array mean
- `d3.sum(array)` - Calculate array sum
- `d3.min(array)` - Find minimum value in array
- `d3.curveCatmullRom.alpha(value)` - D3 curve interpolation
- `lineGen` - D3 line generator for creating SVG paths

## Configuration Dependencies

The following configuration values need to be passed via the `config` parameter:

### Core Configuration
- `TIME` - Boolean flag to enable/disable timing logs
- `seed` - Random seed value for reproducible generation
- `aleaPRNG` - Pseudo-random number generator function
- `resolveDepressionsSteps` - Maximum iterations for depression resolution algorithm
- `cellsCount` - Total number of cells in the map
- `graphWidth` - Width of the map graph
- `graphHeight` - Height of the map graph
- `WARN` - Boolean flag to enable/disable warning messages

## Module Integration

The module should be imported and used as follows:

```javascript
import { 
  generate, 
  alterHeights, 
  resolveDepressions, 
  addMeandering,
  getRiverPath,
  specify,
  getName,
  getType,
  getBasin,
  getWidth,
  getOffset,
  getSourceWidth,
  getApproximateLength,
  getRiverPoints,
  remove,
  getNextId
} from './river-generator.js';
import { Lakes } from './lakes.js';
import { Names } from './names.js';

// Usage example
const config = {
  TIME: true,
  seed: 'map_seed_123',
  aleaPRNG: seedrandom,
  resolveDepressionsSteps: 1000,
  cellsCount: 10000,
  graphWidth: 1920,
  graphHeight: 1080,
  WARN: true
};

const utils = {
  rn, rw, each, round,
  d3: { mean: d3.mean, sum: d3.sum, min: d3.min, curveCatmullRom: d3.curveCatmullRom },
  lineGen: d3.line()
};

const modules = { Lakes, Names };

const result = generate(pack, grid, config, utils, modules, true);
```