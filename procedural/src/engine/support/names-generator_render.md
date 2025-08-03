# Removed Rendering/UI Logic from names-generator.js

The following rendering and UI logic was removed from the `names-generator.js` module and should be implemented in the Viewer/Client application:

## DOM Manipulation

### Map Name Storage
**Original Code (lines 325):**
```javascript
mapName.value = name;
```

**Location**: `getMapName()` function
**Description**: Direct DOM manipulation to set the value of a map name input field
**Replacement**: The `getMapName()` function now returns the generated name instead of setting it directly

## UI Feedback and State Management

### Lock State Checks
**Original Code (lines 314-315):**
```javascript
if (!force && locked("mapName")) return;
if (force && locked("mapName")) unlock("mapName");
```

**Location**: `getMapName()` function  
**Description**: UI state management for locking/unlocking map name generation
**Replacement**: These checks should be handled by the Viewer/Client before calling `getMapName()`

### User Notifications
**Original Code (lines 149, 318):**
```javascript
tip("Namesbase " + base + " is incorrect. Please check in namesbase editor", false, "error");
tip("Namebase is not found", false, "error");
```

**Location**: `getBase()` and `getMapName()` functions
**Description**: UI notifications/tooltips to inform user of errors
**Replacement**: Error handling should be done by the Viewer/Client based on return values or thrown errors

## Implementation Notes for Viewer/Client

1. **Map Name Generation**: Call `getMapName()` and handle the returned value by setting it to the appropriate DOM element
2. **Lock State Management**: Implement lock/unlock logic in the UI layer before calling name generation functions  
3. **Error Display**: Handle error states and display appropriate user feedback when name generation fails
4. **State Persistence**: Handle saving/loading of generated names as needed by the application