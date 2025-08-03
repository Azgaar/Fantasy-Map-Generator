# Config Properties for military-generator.js

The refactored military-generator module requires the following configuration properties:

## From options object:
- `military` - Array of military unit configurations (defaults to getDefaultOptions() if not provided)
- `year` - Current calendar year for note generation
- `eraShort` - Short era designation (e.g., "AD", "BC")  
- `era` - Full era designation (e.g., "Anno Domini")

## Usage:
```javascript
const config = {
  military: options.military || getDefaultOptions(),
  year: options.year,
  eraShort: options.eraShort,
  era: options.era
};

generate(pack, config, utils, notes);
```

**Note:** This module did not contain any direct DOM reads (byId() calls), so no additional configuration properties were needed to replace DOM access. All configuration comes from the existing global `options` object.