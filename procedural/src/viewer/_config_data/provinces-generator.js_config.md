# Config Properties for provinces-generator.js

The refactored `provinces-generator.js` module requires the following configuration properties:

## Required Config Properties:

### `provincesRatio` (Number)
- **Original DOM source**: `byId("provincesRatio").value`
- **Description**: Ratio determining the number of provinces to generate (0-100)
- **Usage**: Controls how many provinces are created relative to the number of burgs in each state
- **Type**: Number (typically 0-100)

### `seed` (String/Number)
- **Description**: Random seed for province generation
- **Usage**: Used when `regenerate` parameter is false to maintain consistent generation
- **Type**: String or Number
- **Note**: This replaces the global `seed` variable access

## Config Object Structure:
```javascript
const config = {
  provincesRatio: 50,  // 0-100, percentage of burgs to become province centers
  seed: "some-seed-value"  // Random seed for reproducible generation
};
```