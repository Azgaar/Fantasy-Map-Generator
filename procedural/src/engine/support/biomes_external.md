# Biomes Module - External Dependencies

The refactored `biomes.js` module requires the following external dependencies to be injected via the `utils` parameter:

## Required Utilities

- **`TIME`** - Global timing flag for performance monitoring (boolean)
- **`d3`** - D3.js library for mathematical functions
  - `d3.mean()` - Used for calculating average moisture values
- **`rn`** - Rounding utility function for numerical precision

## Import Structure

When integrating this module, the calling code should provide these utilities:

```javascript
import { define, getId, getDefault } from './biomes.js';

const utils = {
  TIME: globalTimeFlag,
  d3: d3Library,
  rn: roundingFunction
};

// Usage
const result = define(pack, grid, config, utils);
```

## Notes

- No additional external modules need to be imported by the biomes module itself
- All dependencies are injected rather than directly imported
- The module maintains compatibility with the original d3.range functionality by using `Array.from()` instead