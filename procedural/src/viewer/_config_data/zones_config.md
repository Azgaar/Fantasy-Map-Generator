# Configuration Properties for zones.js

The refactored zones.js module accepts the following configuration properties:

## Configuration Object Properties

### `globalModifier` (optional)
- **Type**: Number
- **Default**: 1
- **Description**: Global modifier for zone generation quantity. Multiplies the base quantity of each zone type.
- **Usage**: Controls overall density of zones generated across the map

### `TIME` (optional)
- **Type**: Boolean
- **Default**: false
- **Description**: Debug flag to enable/disable console timing for performance measurement
- **Usage**: When true, logs execution time of zone generation to console

## Notes

- No DOM-dependent configuration properties were found in the original code
- The original module did not read any values from DOM elements via `byId()`
- All zone generation parameters are internally configured in the `zoneConfig` object
- The module is purely data-driven and does not require UI input for configuration