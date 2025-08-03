# Config Properties for heightmap-generator.js

The refactored heightmap-generator module requires the following configuration properties:

## Core Configuration
- `templateId` - String identifier for the heightmap template to use (replaces `byId("templateInput").value`)
- `seed` - Random seed value for deterministic generation
- `graphWidth` - Width of the graph/map area
- `graphHeight` - Height of the graph/map area

## Original DOM Reads Converted
- **`byId("templateInput").value`** → **`config.templateId`**
  - Used in the `generate()` function to determine which heightmap template or precreated heightmap to use

## Global Variables Now in Config
- **`graphWidth`** - Previously a global variable, now passed via config
- **`graphHeight`** - Previously a global variable, now passed via config  
- **`seed`** - Previously a global variable, now passed via config