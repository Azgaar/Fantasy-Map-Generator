# Removed Rendering/UI Logic from resample.js

The following rendering and UI-related code blocks were **removed** from the engine module and should be moved to the Viewer application:

## Removed UI/Rendering Logic

### Statistics Display
```javascript
// Line 117 in original code
showStatistics();
```

**Description:** This function call was responsible for displaying statistics to the user interface after the resampling process completed. This is purely a UI/rendering concern and has been removed from the core engine.

**Location in Original:** Called at the end of the `process()` function (line 117)

**Reason for Removal:** This function updates the DOM/UI to show statistics about the generated map, which violates the separation of concerns principle for the headless engine.

## Notes

The original `resample.js` module was relatively clean in terms of separation of concerns. The only UI-related code was the single `showStatistics()` call, which was a clear DOM/UI interaction that needed to be removed from the core engine.

All other code in the module was focused on data processing and transformation, which aligns well with the headless engine architecture.

## Viewer Integration

The Viewer application should:
1. Call the engine's `process()` function to get the resampled map data
2. Call `showStatistics()` with the returned data to update the UI
3. Handle any other UI updates needed after resampling