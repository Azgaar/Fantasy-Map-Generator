# External Dependencies for cultures-generator.js

The refactored `cultures-generator.js` module requires the following external dependencies to be imported or passed via the `utils` object:

## Core Utility Functions
- `TIME` - Boolean flag for timing operations
- `WARN` - Boolean flag for warning messages  
- `ERROR` - Boolean flag for error messages
- `rand(max)` - Random number generator function
- `rn(value, precision)` - Round number function
- `P(probability)` - Probability function
- `minmax(value, min, max)` - Min/max clamp function
- `biased(min, max, bias)` - Biased random function
- `rw(array)` - Random weighted selection function
- `abbreviate(name, existingCodes)` - Name abbreviation function

## External Modules/Objects
- `d3` - D3.js library (specifically `d3.quadtree()`, `d3.max()`, `d3.range()`)
- `Names` - Names generation module with methods:
  - `Names.getNameBases()`
  - `Names.getCulture(culture, min, max, suffix)`
  - `Names.getBase(base, min, max, suffix, index)`
  - `Names.getBaseShort(index)`
- `COA` - Coat of Arms data object with shield types:
  - `COA.shields.types`
  - `COA.shields[type]`
- `FlatQueue` - Priority queue implementation
- `biomesData` - Biome cost data object with `cost` array
- `nameBases` - Array of name bases

## Data Structures
- `grid` - Grid data structure with `cells.temp` array
- `getRandomColor()` - Function to generate random colors (optional utility)

## Notes
- All these dependencies should be passed through the `utils` parameter to maintain the module's pure, headless nature
- The `grid` parameter should be passed separately as it's core map data
- Some utility functions like `getRandomColor` may need to be implemented if not available in the existing codebase