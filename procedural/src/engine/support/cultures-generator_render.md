# Removed Rendering/UI Logic from cultures-generator.js

The following UI and rendering logic was removed from the legacy `cultures-generator.js` and needs to be implemented in the Viewer/Client application:

## Alert Dialog System

### Extreme Climate Warning Dialog
**Location:** Lines 96-109 in original code
**Removed Code:**
```javascript
alertMessage.innerHTML = /* html */ `The climate is harsh and people cannot live in this world.<br />
  No cultures, states and burgs will be created.<br />
  Please consider changing climate settings in the World Configurator`;

$("#alert").dialog({
  resizable: false,
  title: "Extreme climate warning",
  buttons: {
    Ok: function () {
      $(this).dialog("close");
    }
  }
});
```

**Replacement Strategy:** The engine now returns an error object with type `"extreme_climate"` that the UI can use to display the appropriate dialog.

### Insufficient Population Warning Dialog  
**Location:** Lines 112-124 in original code
**Removed Code:**
```javascript
alertMessage.innerHTML = /* html */ ` There are only ${populated.length} populated cells and it's insufficient livable area.<br />
  Only ${count} out of ${culturesInput.value} requested cultures will be generated.<br />
  Please consider changing climate settings in the World Configurator`;
$("#alert").dialog({
  resizable: false,
  title: "Extreme climate warning",
  buttons: {
    Ok: function () {
      $(this).dialog("close");
    }
  }
});
```

**Replacement Strategy:** The engine can return a warning object that the UI can use to display this information.

## DOM Element Access

### Removed DOM Queries
All `byId()` and `document.getElementById()` calls were removed:

1. **`byId("culturesInput").value`** → Replaced with `config.culturesInput`
2. **`byId("culturesSet").selectedOptions[0].dataset.max`** → Replaced with `config.culturesInSetNumber`  
3. **`byId("culturesSet").value`** → Replaced with `config.culturesSet`
4. **`byId("sizeVariety").value`** → Replaced with `config.sizeVariety`
5. **`document.getElementById("emblemShape").value`** → Replaced with `config.emblemShape`
6. **`byId("neutralRate")?.valueAsNumber`** → Replaced with `config.neutralRate`

### Additional DOM Reference Removed
- **`culturesInput.value`** (Line 113) → Should use `config.culturesInput`

## Implementation Notes for Viewer/Client

### Error Handling
The refactored engine returns structured error/warning information instead of directly showing UI dialogs:

```javascript
// Example error return structure
{
  cultures: [...],
  cells: { culture: [...] },
  error: {
    type: "extreme_climate", 
    message: "The climate is harsh...",
    populated: 150
  }
}
```

### Warning Handling
For non-fatal warnings (insufficient population), the Viewer should:
1. Check if the returned culture count is less than requested
2. Display appropriate warning message to user
3. Allow user to proceed or modify settings

### Dialog Implementation
The Viewer should implement:
1. **Alert dialog system** using modern UI framework (React/Vue/etc.) instead of jQuery UI
2. **Error message formatting** with HTML support for multi-line messages
3. **User confirmation handling** for proceeding with warnings
4. **Settings modification links** to help users fix configuration issues

### Configuration Reading
The Viewer is responsible for:
1. Reading all DOM input values
2. Assembling the `config` object
3. Passing the config to the engine
4. Handling any validation of config values before engine calls