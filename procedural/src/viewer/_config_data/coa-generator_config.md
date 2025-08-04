# Configuration Properties for coa-generator.js

The refactored `coa-generator.js` module requires a `config` object with the following properties:

## Required Config Properties

### emblemShape
- **Type**: String
- **Description**: The selected emblem shape value from the UI dropdown
- **Original DOM Call**: `document.getElementById("emblemShape").value`
- **Usage**: Used in `getShield()` function to determine shield type

### emblemShapeGroup  
- **Type**: String
- **Description**: The parent group label of the selected emblem shape option
- **Original DOM Call**: `emblemShape.selectedOptions[0]?.parentNode.label`
- **Default**: "Diversiform" when no parent group exists
- **Usage**: Used in `getShield()` function to determine if custom shield logic should be applied

## Config Object Structure

The config object should be structured as follows:

```javascript
const config = {
  emblemShape: "heater",        // Value from emblem shape selector
  emblemShapeGroup: "Basic"     // Parent group of the selected option
};
```

## Function Signatures

### getShield(pack, culture, state, config)
The `getShield` function now accepts the config object as the fourth parameter instead of reading from the DOM directly.

## Migration Notes

- The original code read these values directly from the DOM using `byId("emblemShape")`
- The refactored version receives these values through the config parameter
- The calling code (Viewer/Client) is responsible for reading from the DOM and passing these values to the engine