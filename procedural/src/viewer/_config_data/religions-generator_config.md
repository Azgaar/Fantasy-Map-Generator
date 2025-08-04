# Config Properties for religions-generator.js

The refactored module requires the following configuration properties:

## Required Config Properties

### `religionsNumber`
- **Type**: `number`
- **Source**: Previously read from `religionsNumber.value` (DOM element)
- **Description**: The desired number of organized religions to generate
- **Usage**: Used in `generateOrganizedReligions()` to determine how many religions to create

### `growthRate`
- **Type**: `number`
- **Source**: Previously read from `byId("growthRate").valueAsNumber` (DOM element)
- **Description**: Growth rate multiplier that affects how far religions can expand
- **Usage**: Used in `expandReligions()` to calculate `maxExpansionCost = (cells.i.length / 20) * config.growthRate`

## Config Object Structure

The config object should be structured as:

```javascript
const config = {
  religionsNumber: 5,    // Number of organized religions to generate
  growthRate: 1.0       // Growth rate multiplier for religion expansion
};
```

These properties replace the original DOM-based configuration reads and allow the engine to be run in any environment without browser dependencies.