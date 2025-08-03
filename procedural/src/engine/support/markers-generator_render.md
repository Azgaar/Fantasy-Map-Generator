# Removed Rendering/UI Logic from markers-generator.js

The following DOM manipulation and UI-related code blocks were identified and **removed** from the engine module. This logic should be moved to the Viewer/Client application:

## DOM Element Manipulation

### Marker Element Removal (Line 154)
```javascript
document.getElementById(id)?.remove();
```
**Purpose**: Removes marker DOM elements from the UI when regenerating markers
**Location**: Inside the `regenerate()` function
**Replacement**: The refactored code now returns `removedMarkerIds` array so the viewer can handle DOM cleanup

### Notes Array Manipulation (Lines 155-156)
```javascript
const index = notes.findIndex(note => note.id === id);
if (index != -1) notes.splice(index, 1);
```
**Purpose**: Removes notes from the global `notes` array when markers are deleted
**Location**: Inside the `regenerate()` function  
**Replacement**: The engine now returns a new `notes` array instead of mutating a global one

## Global State Mutations Removed

### Pack Markers Direct Mutation
```javascript
pack.markers = [];
pack.markers.push(marker);
pack.markers = pack.markers.filter(...);
```
**Purpose**: Direct manipulation of the global `pack.markers` array
**Replacement**: Functions now return new marker arrays instead of mutating the input

### Occupied Array Global Access
```javascript
occupied[cell] = true;
```
**Purpose**: Tracking occupied cells in a module-level variable
**Replacement**: `occupied` is now passed as a local parameter and managed within function scope

## Summary

The refactored engine module is now pure and stateless:
- No DOM manipulation
- No global state mutation  
- Returns data objects instead of side effects
- The viewer application must handle:
  - DOM element creation/removal based on returned marker data
  - Note management and display
  - State persistence and updates