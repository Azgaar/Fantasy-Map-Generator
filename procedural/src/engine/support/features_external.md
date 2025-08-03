# External Dependencies for features.js

The refactored `features.js` module requires the following external dependencies to be imported:

## Module Dependencies

### `Lakes` module
- **Functions used:**
  - `Lakes.getHeight(feature)` - Calculate height for lake features
  - `Lakes.getName(feature)` - Generate names for lake features

## Utility Functions Required

The following utility functions need to be passed via the `utils` parameter:

### Core Utilities
- `INT8_MAX` - Maximum value for Int8 arrays
- `rn(value)` - Rounding function
- `isLand(cellId)` - Check if a cell is land
- `isWater(cellId)` - Check if a cell is water
- `dist2(point1, point2)` - Calculate squared distance between two points
- `clipPoly(vertices)` - Clip polygon vertices
- `unique(array)` - Remove duplicates from array
- `createTypedArray({maxValue, length})` - Create appropriately typed array
- `connectVertices({vertices, startingVertex, ofSameType, closeRing})` - Connect vertices to form paths

### D3.js Integration
- `d3.polygonArea(points)` - Calculate polygon area (accessed via `utils.d3.polygonArea`)

## Configuration Dependencies

The following configuration values need to be passed via the `config` parameter:

### Timing and Randomization
- `TIME` - Boolean flag to enable/disable timing logs
- `seed` - Random seed value for reproducible generation
- `aleaPRNG` - Pseudo-random number generator function

## Module Integration

The module should be imported and used as follows:

```javascript
import { markupGrid, markupPack, specify } from './features.js';
import { Lakes } from './lakes.js';

// Usage example
const updatedGrid = markupGrid(grid, config, utils);
const updatedPack = markupPack(pack, grid, config, utils, { Lakes });
const finalPack = specify(updatedPack, grid, { Lakes });
```