# External Dependencies for routes-generator.js

The refactored `routes-generator.js` module requires the following external dependencies to be imported:

## Utility Functions
- `dist2` - Distance calculation function
- `findPath` - Pathfinding algorithm function
- `findCell` - Cell lookup function by coordinates
- `rn` - Number rounding utility
- `ra` - Random array element selection
- `rw` - Weighted random selection
- `getAdjective` - Name transformation utility

## External Libraries
- `Delaunator` - Delaunay triangulation library for Urquhart edge calculation

## Data Dependencies
- `biomesData` - Object containing biome information with habitability data

## Grid Data
- `grid` - Grid object containing temperature data for cells

These dependencies should be passed through a `utils` object parameter that contains:
```javascript
{
  dist2,
  findPath,
  findCell,
  rn,
  ra,
  rw,
  getAdjective,
  Delaunator,
  biomesData
}
```