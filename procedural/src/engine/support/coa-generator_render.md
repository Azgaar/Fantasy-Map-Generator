# Removed Rendering/UI Logic from coa-generator.js

The following DOM manipulation and UI-related code blocks have been **removed** from the core engine module and should be moved to the Viewer application:

## DOM Element Access - Lines 2269-2271

**Removed Code:**
```javascript
const emblemShape = document.getElementById("emblemShape");
const shapeGroup = emblemShape.selectedOptions[0]?.parentNode.label || "Diversiform";
if (shapeGroup !== "Diversiform") return emblemShape.value;
```

**Location**: Originally in `getShield()` function (lines 2269-2271)
**Reason**: Direct DOM access via `document.getElementById()` and manipulation of select element options
**Replacement**: These values should be read by the Viewer and passed via the `config` parameter

## DOM Value Reading - Line 2273

**Removed Code:**
```javascript
if (emblemShape.value === "state" && state && pack.states[state].coa) return pack.states[state].coa.shield;
```

**Location**: Originally in `getShield()` function (line 2273)  
**Reason**: Direct access to DOM element `.value` property
**Replacement**: The `emblemShape` value should be passed via `config.emblemShape`

## Error Console Logging - Line 2275

**Removed Code:**
```javascript
ERROR && console.error("Shield shape is not defined on culture level", pack.cultures[culture]);
```

**Location**: Originally in `getShield()` function (line 2275)
**Reason**: Global `ERROR` variable dependency and console error logging
**Replacement**: Error handling should be implemented by the calling Viewer code

## Summary

All removed code was related to:
1. **DOM Element Selection**: `document.getElementById("emblemShape")`
2. **DOM Property Access**: `.selectedOptions[0]?.parentNode.label`, `.value`
3. **Global Variable Dependencies**: `ERROR` variable
4. **Direct Console Logging**: `console.error()` calls

These UI concerns should now be handled by the Viewer application, which will read the DOM values and pass them to the core engine via the config parameter.