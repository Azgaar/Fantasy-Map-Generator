# Config Properties for names-generator.js

The refactored `names-generator.js` module identified the following configuration properties that were previously read from the DOM:

## Configuration Properties

Currently, no direct config properties were identified in this module, as the original code had minimal DOM interaction. The main DOM interaction was:

- **Map Name Storage**: The original code wrote to `mapName.value` but this was rendering logic that has been removed.

## Notes

- The `getMapName()` function previously wrote directly to a DOM element (`mapName.value = name`)
- This has been removed and the function now returns the generated name instead
- The calling code (Viewer/Client) should handle storing or displaying the generated map name
- All name generation functions now operate purely on the data passed to them as parameters

## Function Signature Changes

Functions that previously read global state now require data to be passed as parameters:

- `getCulture()` now requires `cultures` parameter  
- `getCultureShort()` now requires `cultures` parameter
- `getState()` now requires `cultures` parameter
- All functions now require `nameBases` and `utils` parameters