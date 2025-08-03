# External Dependencies for military-generator.js

The refactored military-generator module requires the following external dependencies to be imported:

## Utility Functions
- `d3` - D3.js library for quadtree operations and array operations (d3.sum, d3.quadtree)
- `minmax` - Utility function to clamp values between min and max
- `rn` - Rounding/number formatting utility function
- `ra` - Random array element selection utility function
- `rand` - Random number generator function
- `gauss` - Gaussian distribution random number generator
- `si` - SI unit formatter utility function
- `nth` - Ordinal number formatter utility function

## Runtime Configuration
- `populationRate` - Global population rate multiplier
- `urbanization` - Global urbanization rate
- `TIME` - Debug timing flag

## Notes System
- `notes` - Global notes array for storing regiment notes

These dependencies need to be provided via the `utils` parameter when calling the `generate` function.