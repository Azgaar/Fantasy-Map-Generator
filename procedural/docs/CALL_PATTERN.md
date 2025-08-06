# Call Pattern Issues in Engine Refactoring

## Overview

During the refactoring of the Fantasy Map Generator from a browser-dependent application to a headless engine, we've encountered systematic issues with how modules are called and how they access their dependencies. This document catalogues these patterns and provides a systematic approach to identifying and fixing them.

## The Problem

The original codebase used global variables and browser-specific APIs. The refactored engine uses dependency injection, but there are mismatches between:

1. **Function signatures** - What parameters functions expect
2. **Function calls** - What parameters are actually passed
3. **Data access patterns** - How modules access configuration and utilities

## Common Anti-Patterns Found

### 1. Config Nesting Mismatch

**Problem**: Modules expect config properties at the root level, but they're nested under specific sections.

**Example**:
```javascript
// ❌ Module expects:
config.culturesInput
config.culturesInSetNumber

// ✅ But config actually has:
config.cultures.culturesInput  
config.cultures.culturesInSetNumber
```

**Pattern**: `config.{property}` vs `config.{section}.{property}`

### 2. Missing Config Parameter

**Problem**: Modules expect full `config` object but are passed only a subsection.

**Example**:
```javascript
// ❌ Incorrect call:
Biomes.define(pack, grid, config.biomes, Utils)

// ✅ Correct call (module needs config.debug):
Biomes.define(pack, grid, config, Utils)
```

**Pattern**: Modules need `config.debug` but receive `config.{section}`

### 3. Missing Module Dependencies

**Problem**: Function signature doesn't include `modules` parameter but code tries to access module dependencies.

**Example**:
```javascript
// ❌ Function signature:
function generate(pack, grid, config, utils) {
  // Code tries to use Names module
  utils.Names.getNameBases()  // ❌ Names not in utils
}

// ✅ Correct signature:
function generate(pack, grid, config, utils, modules) {
  const { Names } = modules;
  Names.getNameBases()  // ✅ Correct access
}
```


### 4. Missing Parameter Propagation

**Problem**: Functions call other functions without passing required parameters.

**Example**:
```javascript
// ❌ Missing parameters:
Lakes.defineClimateData(h)

// ✅ Should pass all required params:
Lakes.defineClimateData(pack, grid, h, config, utils)
```


### 5. Global Variable References

**Problem**: Functions reference global variables that don't exist in headless environment.

**Example**:
```javascript
// ❌ References undefined globals:
function clipPoly(points, secure = 0) {
  return polygonclip(points, [0, 0, graphWidth, graphHeight], secure);
  //                              ^^^^^^^^^^^ ^^^^^^^^^^^^ undefined
}

// ✅ Get from config:
function clipPoly(points, config, secure = 0) {
  const graphWidth = config.graph.width || 1000;
  const graphHeight = config.graph.height || 1000;
  return polygonclip(points, [0, 0, graphWidth, graphHeight], secure);
}
```


### 6. Context-Aware Wrappers

**Problem**: Utility functions expect parameters that aren't available in calling context.

**Example**:
```javascript
// ❌ isLand expects pack but called without it:
neighbors[cellId].filter(isLand)

// ✅ Create context-aware wrapper or pass explicitly:
neighbors[cellId].filter(i => isLand(i, pack))
```


## Systematic Detection Strategy

### 1. Function Signature Analysis

For each exported function, check:
```bash
# Find function exports
grep -n "export.*function\|export const.*=" src/engine/modules/*.js

# Check what parameters they expect vs receive
```

### 2. Config Access Pattern Audit

```bash
# Find config property access
grep -rn "config\." src/engine/modules/ | grep -v "config\.debug"

# Check if properties exist in config structure
```

### 3. Module Dependency Check

```bash
# Find modules object usage
grep -rn "modules\." src/engine/modules/

# Find utils object access to modules
grep -rn "utils\.[A-Z]" src/engine/modules/
```

### 4. Global Reference Detection

```bash
# Find potential global references
grep -rn "\b[A-Z_][A-Z_]*\b" src/engine/ | grep -v "import\|export\|const\|let\|var"
```

### 5. Function Call Parameter Mismatch

```bash
# Find function calls and compare with signatures
grep -rn "\.generate\|\.define\|\.markup" src/engine/main.js
```

## Systematic Fix Pattern

Document actual config structure from `config-builder.js` into CONFIG_STRUCTURE.md. 

Then take every file in `javascript_files_list.md` through these four steps. 
### Step 1: Audit Function Signatures
1. List all exported functions in modules
2. Document expected parameters
3. Check all call sites
4. Identify mismatches

### Step 2: Config Structure Mapping
1. Find all `config.{property}` accesses in modules
2. Map correct paths (`config.section.property`)
3. Ensure every single module/parameter/path related to config is resolved.

### Step 3: Dependency Injection Fix
1. Ensure all functions receive required parameters
2. Add `modules` parameter where needed
3. Update all call sites to pass correct parameters

### Step 4: Global Reference Elimination
1. Find all global variable references
2. Determine correct source (config, utils, passed parameters)
3. Update function signatures if needed

For each file (log this detail into `javascript_files_list.md`):
- [ ] Every function signature matches all call sites
- [ ] All required parameters are passed
- [ ] Config properties accessed via correct path
- [ ] No global variable references
- [ ] Module dependencies properly injected
- [ ] Error handling for missing dependencies

## Example Systematic Fix

```javascript
// 1. Document current signature
function someModule(pack, config, utils) { ... }

// 2. Document all call sites
someModule(pack, config.section, utils)  // ❌ Wrong config
someModule(pack, grid, config, utils)    // ❌ Missing grid param

// 3. Determine correct signature
function someModule(pack, grid, config, utils, modules) { ... }

// 4. Update all call sites
someModule(pack, grid, config, utils, modules)  // ✅ Correct

// 5. Update internal property access
// config.property → config.section.property
// utils.Module → modules.Module
```

This systematic approach will help identify and fix all parameter passing issues before they cause runtime errors.