# Config Properties for cultures-generator.js

The refactored `cultures-generator.js` module requires the following configuration properties to be passed via the `config` object parameter:

## Required Configuration Properties

### Culture Generation Settings
- **`culturesInput`** (number) - Number of cultures requested by user
  - *Replaces:* `+byId("culturesInput").value`
  - *Usage:* Determines how many cultures to generate

- **`culturesInSetNumber`** (number) - Maximum cultures available in selected culture set
  - *Replaces:* `+byId("culturesSet").selectedOptions[0].dataset.max`
  - *Usage:* Limits the number of cultures that can be generated based on the selected culture set

- **`culturesSet`** (string) - Selected culture set type
  - *Replaces:* `byId("culturesSet").value`
  - *Usage:* Determines which predefined culture set to use
  - *Valid values:* `"european"`, `"oriental"`, `"english"`, `"antique"`, `"highFantasy"`, `"darkFantasy"`, `"random"`, or default (all-world)

### Map Dimensions
- **`graphWidth`** (number) - Width of the map/graph
  - *Usage:* Used for calculating culture center spacing
  - *Note:* This should be derived from the map generation settings

- **`graphHeight`** (number) - Height of the map/graph  
  - *Usage:* Used for calculating culture center spacing
  - *Note:* This should be derived from the map generation settings

### Culture Expansion Settings
- **`sizeVariety`** (number) - Variety factor for culture expansionism
  - *Replaces:* `byId("sizeVariety").value`
  - *Usage:* Controls how much culture expansionism varies from base values
  - *Typical range:* 0-2, where 1 is default variety

- **`neutralRate`** (number, optional) - Rate modifier for culture expansion
  - *Replaces:* `byId("neutralRate")?.valueAsNumber || 1`
  - *Usage:* Affects maximum expansion cost calculations
  - *Default:* 1 if not provided

### Visual Settings
- **`emblemShape`** (string) - Shield/emblem shape setting
  - *Replaces:* `document.getElementById("emblemShape").value`
  - *Usage:* Determines shield shapes for cultures
  - *Valid values:* `"random"` for random shield selection, or specific shield type names

## Usage Example

```javascript
const config = {
  culturesInput: 8,
  culturesInSetNumber: 15,
  culturesSet: "european",
  graphWidth: 2048,
  graphHeight: 1024,
  sizeVariety: 1.2,
  neutralRate: 1.0,
  emblemShape: "random"
};

const result = generate(pack, grid, config, utils);
```

## Notes
- All numeric values should be validated before passing to ensure they are valid numbers
- The `graphWidth` and `graphHeight` should match the actual map dimensions
- Optional properties will use sensible defaults if not provided
- The config object enables the engine to be completely independent of DOM/UI elements