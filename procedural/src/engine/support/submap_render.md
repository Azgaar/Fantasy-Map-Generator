# Removed Rendering/UI Logic from submap.js

The following UI/DOM manipulation code was **removed** from the engine module and should be moved to the Viewer application:

## Removed Code Blocks

### 1. Statistics Display (Line 116)
```javascript
showStatistics();
```

**Description**: This function call displays statistics to the user interface, likely updating DOM elements to show information about the submap map.

**Reason for removal**: This is pure UI logic that renders information to the user interface and has no place in a headless engine.

**Viewer implementation needed**: The Viewer application should call `showStatistics()` after receiving the processed map data from the engine.

## Summary

Only **one** piece of rendering/UI logic was found and removed from this module:

- **UI Statistics Display**: The `showStatistics()` function call that displays map statistics to the user interface

The refactored engine module now returns the processed map data (`{grid, pack, notes}`) and leaves all UI responsibilities to the calling Viewer application.