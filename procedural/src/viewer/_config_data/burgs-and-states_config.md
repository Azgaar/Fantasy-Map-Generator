# Burgs and States Module - Configuration Properties

The refactored `burgs-and-states.js` module requires the following configuration properties to be passed via the `config` object:

## Required Config Properties

### State Generation Configuration
- **`statesNumber`** - Number of states to generate
  - **Original DOM call:** `byId("statesNumber").value`
  - **Line reference:** Line 98 in original code
  - **Usage:** Determines how many capital cities and states to create

- **`sizeVariety`** - Variety factor for state sizes  
  - **Original DOM call:** `byId("sizeVariety").value`
  - **Line reference:** Line 159 in original code
  - **Usage:** Controls randomization of state expansionism values

### Settlement Configuration
- **`manorsInput`** - Number of towns/settlements to generate
  - **Original DOM call:** `manorsInput.value` and `manorsInput.valueAsNumber`
  - **Line references:** Lines 193, 195, 220 in original code
  - **Usage:** Controls the number of secondary settlements (towns) to place

### Growth Rate Configuration
- **`growthRate`** - Global growth rate multiplier
  - **Original DOM call:** `byId("growthRate").valueAsNumber`
  - **Line reference:** Line 363 in original code
  - **Usage:** Controls how aggressively states expand during the expansion phase

- **`statesGrowthRate`** - State-specific growth rate multiplier
  - **Original DOM call:** `byId("statesGrowthRate")?.valueAsNumber`
  - **Line reference:** Line 364 in original code  
  - **Usage:** Additional multiplier specifically for state expansion behavior

## Config Object Structure

```javascript
const config = {
  statesNumber: 15,        // Number of states to generate
  sizeVariety: 1,          // State size variety factor
  manorsInput: 1000,       // Number of towns (1000 = auto-calculate)
  growthRate: 1,           // Global growth rate multiplier
  statesGrowthRate: 1      // State growth rate multiplier
};
```

## Usage Notes

- **`manorsInput`**: When set to `1000`, the system auto-calculates the number of towns based on available populated cells
- **Growth rates**: Both growth rate properties default to `1` if not provided
- **`statesGrowthRate`**: Uses optional chaining (`?.`) in original code, indicating it might not always be present
- All numeric values are converted using `+` operator or `.valueAsNumber` in the original DOM calls