# Config Properties for lakes.js

The refactored `lakes.js` module identified the following DOM reads that have been converted to config properties:

## Config Properties

### 1. lakeElevationLimit
- **Original DOM read:** `+byId("lakeElevationLimitOutput").value`
- **Config property:** `config.lakeElevationLimit`
- **Used in:** `detectCloseLakes()` function
- **Type:** Number
- **Description:** The elevation limit used to determine if a lake can be potentially open (not in deep depression)

### 2. heightExponent
- **Original DOM read:** `heightExponentInput.value`
- **Config property:** `config.heightExponent`
- **Used in:** `defineClimateData()` function (specifically in `getLakeEvaporation()`)
- **Type:** Number
- **Description:** The height exponent used in evaporation calculations for lakes

## Config Object Structure

```javascript
const config = {
  lakeElevationLimit: 50,  // Example value - was read from "lakeElevationLimitOutput" element
  heightExponent: 2        // Example value - was read from "heightExponentInput" element
};
```

## Function Signatures

Functions that require the config object:

```javascript
detectCloseLakes(pack, grid, heights, config)
defineClimateData(pack, grid, heights, config, utils)
```

## Notes

- Both config properties are numeric values used in mathematical calculations
- `lakeElevationLimit` affects lake classification logic
- `heightExponent` affects evaporation rate calculations
- These values were previously read directly from DOM input elements