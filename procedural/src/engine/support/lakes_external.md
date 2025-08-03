# External Dependencies for lakes.js

The refactored `lakes.js` module requires the following external modules to be imported:

## Required Imports

1. **Names module** - for generating lake names
   - Used in: `getName()` function
   - Dependency: `Names.getCulture(culture)`

## Utility Dependencies

The module also requires utility functions passed via a `utils` object parameter:

1. **d3 utilities**
   - `d3.min()` - for finding minimum values in arrays
   - `d3.mean()` - for calculating averages
   - Used in: `defineClimateData()`, `getHeight()` functions

2. **rn() function** - rounding utility
   - Used for rounding numerical values to specified decimal places
   - Used in: `defineClimateData()`, `getHeight()` functions

## Import Structure

```javascript
import { Names } from './names.js';

// Usage in function calls:
// defineClimateData(pack, grid, heights, config, { d3, rn })
// getHeight(feature, pack, { d3, rn })
// getName(feature, pack, Names)
```

## Notes

- The `utils` object containing `d3` and `rn` should be passed as function parameters
- The `Names` module should be imported and passed to the `getName()` function
- All other dependencies have been eliminated through dependency injection