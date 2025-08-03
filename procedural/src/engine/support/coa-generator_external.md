# External Dependencies for coa-generator.js

The refactored `coa-generator.js` module requires the following external dependencies to be imported:

## Required Utility Functions

The module expects a `utils` object containing:

- **`P(probability)`** - Probability function that returns true/false based on given probability (0-1)
- **`rw(weightedObject)`** - Random weighted selection function that picks a key from an object based on weighted values

These utilities should be imported from a shared utilities module in the engine.

## Required Data Objects

The following data objects must be passed as parameters:

- **`pack`** - The main game data object containing:
  - `pack.states` - Array of state objects with COA data
  - `pack.cultures` - Array of culture objects with shield preferences

## External Error Handling

The original code referenced a global `ERROR` variable for error logging. The refactored version removes this dependency. Error handling should now be implemented by the calling code or through a logging utility passed in the utils object if needed.

## Removed Global Dependencies

The following global dependencies have been removed:
- `window` object attachment
- `document` object access
- `byId()` DOM utility function
- Global `ERROR` variable