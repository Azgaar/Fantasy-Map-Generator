# External Dependencies for provinces-generator.js

The refactored `provinces-generator.js` module requires the following external modules and utilities to be imported:

## Core Utilities (passed via `utils` object):
- `TIME` - Debug timing flag
- `generateSeed()` - Random seed generation function
- `aleaPRNG()` - Seeded pseudo-random number generator
- `gauss()` - Gaussian distribution function
- `P()` - Probability function (random true/false with given probability)
- `Names` - Name generation utilities
  - `Names.getState()`
  - `Names.getCultureShort()`
- `rw()` - Weighted random selection function
- `getMixedColor()` - Color mixing utility
- `BurgsAndStates` - Burg and state utilities
  - `BurgsAndStates.getType()`
- `COA` - Coat of Arms generation utilities
  - `COA.generate()`
  - `COA.getShield()`
- `FlatQueue` - Priority queue implementation
- `d3` - D3.js library (specifically `d3.max()`)
- `rand()` - Random integer generation function
- `getPolesOfInaccessibility()` - Pole of inaccessibility calculation function

## Data Dependencies (passed as parameters):
- `pack` - Main data structure containing:
  - `pack.cells` - Cell data arrays
  - `pack.states` - State definitions
  - `pack.burgs` - Settlement data
  - `pack.provinces` - Existing province data (for regeneration)
  - `pack.features` - Geographic feature data
- `config` - Configuration object (see config file for details)