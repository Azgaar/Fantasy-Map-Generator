# External Dependencies for zones.js

The refactored zones.js module requires the following external dependencies to be imported:

## Utility Functions (utils.random)
- `gauss` - Gaussian random number generator
- `ra` - Random array element selector
- `rw` - Weighted random selector
- `P` - Probability function
- `rand` - Random number generator with min/max
- `getAdjective` - Function to get adjective form of names

## Data Structures and Libraries (utils)
- `Names` - Name generation utilities (specifically `Names.getCultureShort()`)
- `Routes` - Route utilities (`Routes.getRoute()`, `Routes.isConnected()`)
- `FlatQueue` - Priority queue data structure for pathfinding
- `d3` - D3.js library (specifically `d3.mean()`, `d3.max()`)

## Global Dependencies (passed as parameters)
- `pack` - Main game data object containing cells, states, religions, burgs, markers, features
- `notes` - Array of notes objects (used in eruption generation)
- `config` - Configuration object for runtime settings