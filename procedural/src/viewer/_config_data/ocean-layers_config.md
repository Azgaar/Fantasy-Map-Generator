# Config Properties for ocean-layers.js

The refactored `ocean-layers.js` module requires the following configuration properties:

## Required Config Properties

### `outline`
- **Type**: `string`
- **Description**: Defines the ocean layer outline configuration
- **Values**: 
  - `"none"` - No ocean layers will be generated
  - `"random"` - Use randomized outline limits
  - Comma-separated numbers (e.g., `"-1,-2,-3"`) - Specific depth limits for layer generation
- **Original DOM Source**: `oceanLayers.attr("layers")`
- **Usage**: Controls which ocean depth levels should have visible layers drawn

## Example Config Object

```javascript
const config = {
  outline: "-1,-2,-3"  // Generate layers for depths -1, -2, and -3
};
```

## Migration Notes

The original code read this value directly from a DOM element's `layers` attribute. In the refactored version, this configuration must be provided via the `config` parameter to maintain environment independence.