# Config Properties for submap.js

The refactored `submap.js` module requires the following configuration properties:

## Required Config Properties

### `graphWidth` (Number)
- **Purpose**: Width of the map canvas/viewport
- **Usage**: Used in `isInMap()` function to determine if coordinates are within map boundaries
- **Original source**: Global variable `graphWidth`

### `graphHeight` (Number)  
- **Purpose**: Height of the map canvas/viewport
- **Usage**: Used in `isInMap()` function to determine if coordinates are within map boundaries
- **Original source**: Global variable `graphHeight`

## Configuration Object Structure

The config object should be structured as:

```javascript
const config = {
  graphWidth: 1920,    // Map canvas width
  graphHeight: 1080    // Map canvas height
};
```

## Notes

- These properties were originally accessed as global variables in the legacy code
- The `isInMap(x, y, config)` function now uses `config.graphWidth` and `config.graphHeight` instead of global variables
- These values are critical for proper coordinate validation during map resampling operations