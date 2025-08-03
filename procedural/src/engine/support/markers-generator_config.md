# Configuration Properties for markers-generator.js

The refactored `markers-generator.js` module requires the following configuration properties to be passed via the `config` object:

## Required Config Properties

### `culturesSet` (string)
- **Source**: Originally `document.getElementById("culturesSet").value` on line 80
- **Purpose**: Determines the culture set being used for map generation
- **Usage**: Used to detect if Fantasy cultures are enabled, which affects multiplier values for fantasy-themed markers like portals, rifts, and disturbed burials
- **Example**: `"Fantasy European"`, `"Real World"`

## Notes

Only one DOM call was identified in the original code that needed to be converted to a configuration property. The `culturesSet` value is used to determine whether fantasy elements should be included in marker generation by checking if the string contains "Fantasy".

The calling application should read this value from the UI and pass it in the config object when calling the marker generation functions.