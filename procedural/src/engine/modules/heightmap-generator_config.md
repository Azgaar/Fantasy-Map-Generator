# Config Properties for heightmap-generator.js

The refactored heightmap generator module requires the following config properties:

## Required Config Properties

### `heightmap.templateId` (string)
- **Original DOM source**: `byId("templateInput").value`
- **Purpose**: Specifies which heightmap template to use for generation
- **Example values**: `"continents"`, `"archipelago"`, `"volcano"`, `"atoll"`
- **Usage**: Determines the template key to look up in `heightmapTemplates[templateId]`

### `seed` (string|number, optional)
- **Original DOM source**: Global `seed` variable
- **Purpose**: Seed for the pseudorandom number generator to ensure reproducible heightmaps
- **Example values**: `"myseed123"`, `42`, `"continent_seed"`
- **Usage**: Passed to `aleaPRNG()` to initialize deterministic random generation

## Config Object Structure

```javascript
const config = {
  heightmap: {
    templateId: "continents"     // Template ID to use
  },
  seed: "reproducible_seed",     // Optional: PRNG seed for reproducibility
  // ... other config properties for other modules
};
```

## Notes

- The `heightmap.templateId` property replaces the direct DOM access `byId("templateInput").value`
- The `seed` property ensures reproducible generation when the same seed is used
- Both properties should be validated by the calling code before passing to the generator