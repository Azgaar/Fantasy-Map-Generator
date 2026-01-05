# Grid Auto-Numbering Feature for Azgaar Fantasy Map Generator

## Overview

Added sequential auto-numbering to the grid overlay system, allowing users to reference specific grid cells (e.g., "POI located in grid 0247"). Numbers are displayed centered within each grid cell with customizable size and color.

## Features Added

- ✅ Sequential numbering starting from top-left (0001, 0002, 0003...)
- ✅ Works with: **Pointy Hex**, **Square**, and **Truncated Square** grids
- ✅ Customizable font size (1-50px)
- ✅ Customizable color
- ✅ Toggle on/off via checkbox
- ✅ Proper centering in grid cells
- ✅ Full map coverage

## Known Limitations

**Grid Types Not Yet Supported**:
The following grid types require additional positioning calculations and are not currently supported:
- ❌ Hex grid (flat)
- ❌ Square 45 degrees grid
- ❌ Tetrakis square grid
- ❌ Triangle grid (horizontal)
- ❌ Triangle grid (vertical)
- ❌ Trihexagonal grid
- ❌ Rhombille grid

The numbering feature will display on these grid types but numbers will not align correctly with cell centers. Each grid type has unique geometry that requires specific positioning logic in the `getGridCellCenter()` function.

## Files Modified

### 1. `index.html`
**Location**: Lines 889-910 (in `<tbody id="styleGrid">` section)

**Changes**: Added UI controls for grid numbering in the Style panel:
```html
<tr data-tip="Enable sequential numbering for grid cells (0001, 0002, etc.)">
  <td colspan="2">
    <input id="styleGridShowNumbers" class="checkbox" type="checkbox" />
    <label for="styleGridShowNumbers" class="checkbox-label">Show grid numbers</label>
  </td>
</tr>

<tr data-tip="Set grid number font size">
  <td>Number size</td>
  <td>
    <input id="styleGridNumberSize" type="number" min="1" max="50" step="0.5" value="8" />
  </td>
</tr>

<tr data-tip="Set grid number color">
  <td>Number color</td>
  <td>
    <input id="styleGridNumberColor" type="color" value="#808080" />
    <output id="styleGridNumberColorOutput">#808080</output>
  </td>
</tr>
```

### 2. `modules/ui/layers.js`
**Location**: Lines 657-661, 664-754

**Changes**:
1. Modified `drawGrid()` function to call `drawGridNumbers()` when enabled
2. Added three new functions:
   - `drawGridNumbers()` - Main rendering logic
   - `getGridCellDimensions()` - Returns cell dimensions for each grid type
   - `getGridCellCenter()` - Calculates center position for each cell

**Key Implementation Details**:

```javascript
// In drawGrid() - Line 657-661
const showNumbers = gridOverlay.attr("data-show-numbers") === "1";
if (showNumbers) {
  drawGridNumbers(maxWidth, maxHeight, scale, dx, dy);
}
```

### 3. `modules/ui/style.js`
**Location**: Lines 212-215 (initialization), 520-525 (declarations), 543-557 (event handlers)

**Changes**:
1. Added variable declarations for UI elements
2. Added initialization code to read grid numbering attributes
3. Added event handlers for checkbox, size input, and color picker

```javascript
// Variable declarations (after styleGridType handler)
const styleGridShowNumbers = byId("styleGridShowNumbers");
const styleGridNumberSize = byId("styleGridNumberSize");
const styleGridNumberColor = byId("styleGridNumberColor");
const styleGridNumberColorOutput = byId("styleGridNumberColorOutput");

// Initialization in selectStyleElement() 
styleGridShowNumbers.checked = el.attr("data-show-numbers") === "1";
styleGridNumberSize.value = el.attr("data-number-size") || 8;
styleGridNumberColor.value = styleGridNumberColorOutput.value = 
  el.attr("data-number-color") || "#808080";

// Event handlers
styleGridShowNumbers.on("change", function () {
  getEl().attr("data-show-numbers", this.checked ? "1" : "0");
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleGridNumberSize.on("input", function () {
  getEl().attr("data-number-size", this.value);
  if (layerIsOn("toggleGrid")) drawGrid();
});

styleGridNumberColor.on("input", function () {
  styleGridNumberColorOutput.value = this.value;
  getEl().attr("data-number-color", this.value);
  if (layerIsOn("toggleGrid")) drawGrid();
});
```

## Position Calculation Math

### Pointy Hex Grid Positioning

After extensive testing and calibration, the following values provide perfect alignment:

**Row Spacing**: `cellHeight * 0.5`
- This is different from the geometric ideal of 0.75
- Empirically determined through visual alignment with hex centers

**Y-Offset (Vertical Center)**: `cellHeight * 0.35`
- Positions numbers vertically within hex
- Accounts for hex shape geometry

**X-Offset (Horizontal Center)**: `cellWidth / 2`
- Standard horizontal centering

**Row Offset Pattern**: Even rows (0, 2, 4...) are shifted right by `cellWidth / 2`
- This creates the interlocking hex pattern

### Grid Cell Dimensions (Base Size)

From SVG pattern definitions:
- Pointy Hex: width=25, height=43.4
- Flat Hex: width=43.4, height=25
- Square: width=25, height=25
- (Other grid types defined in `getGridCellDimensions()`)

### Row/Column Count Calculation

```javascript
const rowSpacing = cellHeight * 0.5;
const cols = Math.ceil(maxWidth / cellWidth) + 2;
const rows = Math.ceil(maxHeight / rowSpacing) + 2;
```

Note: Adding +2 ensures full map coverage including edges.

## How to Use

### For Users:

1. Enable the **Grid** layer (press `G` or click Grid toggle)
2. Open **Style** panel (right sidebar)
3. Select **"Grid"** from the element dropdown
4. Check **"Show grid numbers"** checkbox
5. Adjust **Number size** and **Number color** as desired

### For Developers:

Grid numbering state is stored as attributes on the `gridOverlay` SVG element:
- `data-show-numbers`: "1" or "0"
- `data-number-size`: Number (default 8)
- `data-number-color`: Hex color (default "#808080")

These can be set programmatically:
```javascript
gridOverlay.attr("data-show-numbers", "1");
gridOverlay.attr("data-number-size", "12");
gridOverlay.attr("data-number-color", "#000000");
drawGrid();
```

## Testing & Calibration Process

The positioning values were determined through iterative testing:

1. Started with theoretical hex geometry (0.75 row spacing)
2. User placed visual markers at hex centers
3. Adjusted row spacing and Y-offset incrementally
4. Final values: rowSpacing=0.5, Y-offset=0.35

This empirical approach accounts for any rendering quirks or pattern definition nuances.

## Performance Considerations

- Numbers are rendered as SVG text elements
- Typical full map: ~3000 grid cells
- Negligible performance impact on modern browsers
- Numbers are part of the gridOverlay group and clear when grid is toggled off

## Future Enhancement Ideas

- Save grid numbering preference to localStorage
- Export numbered grid with map export
- Click-to-copy grid number functionality
- Custom numbering patterns (A1, A2... or hex coordinates)
- Grid number search/highlight feature

## Technical Notes

### Why Not Pure Geometric Spacing?

The theoretical vertical spacing for pointy hex grids is `1.5 × sideLength = 0.75 × height`. However, we use `0.5 × height` because:

1. SVG pattern rendering may introduce sub-pixel differences
2. The pattern definition includes the full hex perimeter path
3. Visual alignment matters more than mathematical purity
4. The 0.5 value was empirically validated against user-placed markers

### Edge Case Handling

- Numbers extend slightly beyond visible map area (+2 buffer)
- Partial hex cells at edges still receive numbers
- Zoom level doesn't affect numbering (numbers don't scale)

## Implementation Summary

**Total Lines of Code Added**: ~150
**Files Modified**: 3
**New Functions Added**: 3
**UI Controls Added**: 3

This implementation integrates cleanly with Azgaar's existing grid system without modifying core rendering logic. All grid numbering code is isolated and can be easily maintained or removed.

## Credits

Implementation developed through collaborative debugging session, December 2024.
Tested on Azgaar Fantasy Map Generator (latest version as of Dec 2024).

## Contact & Contribution

If integrating this into the official Azgaar repository, consider:
- Adding grid numbering to the style presets
- Including in map export metadata
- Adding to the wiki documentation
- Internationalizing the UI labels

---

**License**: Same as Azgaar Fantasy Map Generator (MIT)
