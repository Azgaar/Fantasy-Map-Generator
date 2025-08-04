# Config Properties for resample.js

The refactored `resample.js` module requires the following configuration properties to be passed in the `config` object:

## Required Config Properties

### Map Dimensions
- `graphWidth` (Number) - The width of the map/graph canvas
- `graphHeight` (Number) - The height of the map/graph canvas

## Usage Context

These configuration properties replace the original global variables that were accessed directly:

### Original Global Access → Config Property
- `graphWidth` → `config.graphWidth`
- `graphHeight` → `config.graphHeight`

## Notes

The `graphWidth` and `graphHeight` properties are used extensively throughout the module for:
- Boundary checking with `isInMap()` function calls
- Creating bounding boxes for route clipping
- Determining if projected coordinates fall within the map area

These values were previously accessed as global variables but are now properly injected as configuration parameters following the dependency injection pattern.