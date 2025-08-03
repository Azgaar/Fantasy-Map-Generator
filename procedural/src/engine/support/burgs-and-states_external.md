# Burgs and States Module - External Dependencies

The refactored `burgs-and-states.js` module requires the following external dependencies to be injected via the `utils` parameter:

## Required Utilities

### Core Utilities
- **`TIME`** - Global timing flag for performance monitoring (boolean)
- **`WARN`** - Warning logging flag (boolean)
- **`ERROR`** - Error logging flag (boolean)
- **`d3`** - D3.js library for mathematical functions and data structures
  - `d3.quadtree()` - Spatial data structure for efficient proximity searches
  - `d3.mean()` - Calculate mean values
  - `d3.median()` - Calculate median values
  - `d3.sum()` - Calculate sum of arrays
- **`rn`** - Rounding utility function for numerical precision
- **`P`** - Probability utility function for random boolean generation
- **`gauss`** - Gaussian/normal distribution random number generator
- **`ra`** - Random array element selector
- **`rw`** - Weighted random selector
- **`minmax`** - Min/max clamping utility
- **`each`** - Utility for creating interval checkers
- **`rand`** - Random number generator

### External Modules
- **`Names`** - Name generation module
  - `Names.getCultureShort()` - Generate short cultural names
  - `Names.getState()` - Generate state names
  - `Names.getCulture()` - Generate cultural names
- **`COA`** - Coat of Arms generation module
  - `COA.generate()` - Generate coat of arms
  - `COA.getShield()` - Generate shield designs
- **`biomesData`** - Biome data containing cost arrays
- **`options`** - Global options object containing year settings
- **`FlatQueue`** - Priority queue implementation for pathfinding

### Color Utilities
- **`getColors`** - Generate color palettes
- **`getRandomColor`** - Generate random colors
- **`getMixedColor`** - Create color variations

### String Utilities
- **`getAdjective`** - Convert nouns to adjectives
- **`trimVowels`** - Remove vowels from strings

### Geometric Utilities
- **`getPolesOfInaccessibility`** - Calculate pole of inaccessibility for polygons

### Graph Properties
- **`graphWidth`** - Width of the generated graph
- **`graphHeight`** - Height of the generated graph

## Import Structure

When integrating this module, the calling code should provide these utilities:

```javascript
import { generate, expandStates, specifyBurgs, /* other functions */ } from './burgs-and-states.js';

const utils = {
  TIME: globalTimeFlag,
  WARN: warnFlag,
  ERROR: errorFlag,
  d3: d3Library,
  rn: roundingFunction,
  P: probabilityFunction,
  gauss: gaussianRandom,
  ra: randomArrayElement,
  rw: weightedRandom,
  minmax: minMaxClamp,
  each: intervalChecker,
  rand: randomGenerator,
  Names: namesModule,
  COA: coaModule,
  biomesData: biomesDataObject,
  options: globalOptions,
  FlatQueue: flatQueueClass,
  getColors: colorGenerator,
  getRandomColor: randomColorGenerator,
  getMixedColor: colorMixer,
  getAdjective: adjectiveConverter,
  trimVowels: vowelTrimmer,
  getPolesOfInaccessibility: poleCalculator,
  graphWidth: mapWidth,
  graphHeight: mapHeight
};

// Usage
const result = generate(pack, grid, config, utils);
```