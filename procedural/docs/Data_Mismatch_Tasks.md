
# Simplified Plan to Fix Data Mismatches in Fantasy Map Generator

This document outlines a practical plan to address the four common data mismatches identified in the MAP_GENERATION_TRACE.md:

1. **Modules expecting properties that don't exist yet**
2. **Config sections missing expected fields**
3. **Pack/Grid structure differences**
4. **Module dependencies**

## Problem Analysis

### 1. Modules Expecting Properties That Don't Exist Yet

**Current Issue**: Modules access properties like `cells.culture` before the Cultures module has run, causing undefined references and potential crashes.

**Root Cause**: Modules don't check if required properties exist before accessing them.

### 2. Config Sections Missing Expected Fields

**Current Issue**: Modules expect certain configuration fields that may not be present, even after validation.

**Root Cause**: The existing config validator may not catch all missing fields that modules expect.

### 3. Pack/Grid Structure Differences

**Current Issue**: Pack is a refined version of grid, but modules sometimes confuse which structure they're working with.

**Root Cause**: Similar naming and structure between pack and grid, but different levels of detail and available properties.

### 4. Module Dependencies

**Current Issue**: Some modules require data from other modules (e.g., Rivers needs Lakes, Cultures needs Names) but these dependencies aren't formally tracked.

**Root Cause**: No explicit dependency management system; modules assume previous modules have run successfully.

## Fix Plan

### Fix 1: Add Simple Property Checks to Each Module

Instead of complex wrappers or validators, add simple checks at the start of each module:

**Example for burgs-and-states.js:**
```javascript
export const generate = (pack, grid, config, utils) => {
  // Check required properties exist
  if (!pack.cells.culture) {
    throw new Error("BurgsAndStates module requires cells.culture from Cultures module");
  }
  if (!pack.cells.s) {
    throw new Error("BurgsAndStates module requires cells.s (suitability) from Cell ranking");
  }

  // Continue with existing code...
}
```

**Benefits:**
- Clear error messages
- No complex infrastructure
- Easy to add to existing modules
- Fail fast with helpful information

### Fix 2: Enhance Existing Config Validator

Update the existing `src/viewer/config-validator.js` to ensure all required fields are present:

```javascript
// Add to existing validator
const requiredFields = {
  'cultures.culturesInSetNumber': (config) => {
    // Ensure this field exists based on culturesSet
    const maxCultures = getCultureSetMax(config.cultures.culturesSet);
    return maxCultures;
  },
  'rivers.cellsCount': (config) => {
    // Ensure this matches the actual cell count
    return config.graph.cellsDesired || 10000;
  }
};
```

**Benefits:**
- Uses existing infrastructure
- No duplication
- Config is complete before engine runs

### Fix 3: Document Property Timeline in Existing Docs

Add a section to the existing `docs/FMG Data Model.md`:

```markdown
## Property Availability Timeline

Properties are added to grid/pack progressively:

### Grid Properties (coarse mesh ~10K cells)
- `cells.h` - Available after: heightmap module
- `cells.t` - Available after: features module
- `cells.temp` - Available after: geography module
- `cells.prec` - Available after: geography module

### Pack Properties (refined mesh)
- `cells.biome` - Available after: biomes module
- `cells.s` - Available after: cell ranking
- `cells.pop` - Available after: cell ranking
- `cells.culture` - Available after: cultures module
- `cells.state` - Available after: states module
- `cells.burg` - Available after: burgs module
- `cells.religion` - Available after: religions module
- `cells.province` - Available after: provinces module
```

+ Add mermaid flow diagram

**Benefits:**
- Uses existing documentation
- Clear reference for developers
- No new files or folders

### Fix 4: Add Module Requirements as Comments

At the top of each module, clearly document what it requires:

```javascript
// src/engine/modules/burgs-and-states.js
"use strict";

/**
 * Generates burgs (settlements) and states (political entities)
 *
 * REQUIRES:
 *   - pack.cells.culture (from cultures module)
 *   - pack.cells.s (from cell ranking)
 *   - pack.cultures (from cultures module)
 *
 * PROVIDES:
 *   - pack.burgs
 *   - pack.states
 *   - pack.cells.burg
 *   - pack.cells.state
 */
export const generate = (pack, grid, config, utils) => {
  // ... module code
}
```

**Benefits:**
- Self-documenting
- No runtime overhead
- Clear for developers

### Optional: Debug Mode for Dependency Checking

Add to `src/engine/main.js`:

```javascript
// Only if debug flag is set
if (config.debug.CHECK_DEPENDENCIES) {
  // Simple property existence checks before each module
  if (!pack.cells.culture && moduleNeedsCulture) {
    console.error("Missing required property: cells.culture");
  }
}
```

## Notes for tasks.

Please log all completed activities in docs/Data_Mismatch_Task_Activity.md.
For each task, log the files you altered witrh the changes made in that file.

## Implementation Steps

1. **Task 1**: Add property checks to all modules
2. **Task 2**: Update config validator for missing fields
3. **Task 3**: Update documentation with property timeline, including a mermaid flow diagram
4. **Task 4**: Add requirement comments to all modules
