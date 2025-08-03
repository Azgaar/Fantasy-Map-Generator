# External Dependencies for markers-generator.js

The refactored `markers-generator.js` module requires the following external modules to be imported:

## Core Modules
- `Names` - Used for generating culture-specific names and toponyms
- `Routes` - Used for checking crossroads, connections, and road availability
- `BurgsAndStates` - Used for generating campaign data for battlefields

## Utility Functions
The following utility functions need to be passed in the `utils` object:

### Random/Math Utilities
- `P(probability)` - Probability function (returns true with given probability)
- `rw(weights)` - Random weighted selection from object
- `ra(array)` - Random array element selection  
- `rand(min, max)` - Random integer between min and max
- `gauss(mean, deviation, min, max)` - Gaussian distribution random number
- `rn(number)` - Round number function
- `last(array)` - Get last element of array

### Data Processing
- `d3` - D3.js library (specifically `d3.mean()` for bridge generation)
- `getFriendlyHeight(point)` - Convert height coordinates to readable format
- `convertTemperature(value)` - Temperature conversion utility
- `getAdjective(name)` - Generate adjective form of name
- `capitalize(string)` - String capitalization utility
- `generateDate(start, end)` - Date generation utility

### Global Configuration
- `populationRate` - Population calculation rate
- `urbanization` - Urbanization factor
- `heightUnit` - Height measurement unit object with `.value` property
- `biomesData` - Biome data object with `.habitability` array
- `options` - Global options object with `.era` property
- `seed` - Global random seed
- `TIME` - Debug timing flag

## Notes
All external dependencies are injected through function parameters to maintain the engine's environment-agnostic design. The calling code is responsible for providing these dependencies.