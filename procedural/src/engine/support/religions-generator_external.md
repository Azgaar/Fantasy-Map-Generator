# External Dependencies for religions-generator.js

The refactored module requires the following external dependencies to be imported or provided via the `utils` parameter:

## Core Utilities
- `TIME` - Boolean flag for timing console outputs
- `WARN` - Boolean flag for warning console outputs  
- `ERROR` - Boolean flag for error console outputs
- `rand(min, max)` - Random number generator
- `ra(array)` - Random array element selector
- `rw(weightedObject)` - Random weighted selection
- `gauss(mean, deviation, min, max, step)` - Gaussian random number generator
- `each(n)` - Function that returns a function checking if number is divisible by n

## Data Structure Utilities
- `d3.quadtree()` - D3 quadtree for spatial indexing
- `FlatQueue` - Priority queue implementation
- `Uint16Array` - Typed array constructor

## Helper Functions
- `getRandomColor()` - Generates random color
- `getMixedColor(baseColor, saturation, lightness)` - Mixes colors
- `abbreviate(name, existingCodes)` - Creates abbreviation codes
- `trimVowels(string)` - Removes vowels from string
- `getAdjective(string)` - Converts string to adjective form
- `isWater(cellId)` - Checks if cell is water

## External Modules
- `Names.getCulture(culture, param1, param2, param3, param4)` - Name generation system
- `Routes.getRoute(cellId1, cellId2)` - Route finding system
- `biomesData.cost[biomeId]` - Biome traversal cost data

All of these dependencies should be provided through the `utils` parameter when calling the exported functions.