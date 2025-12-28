## Grid Numbering Debug Checklist

Looking at your screenshot, I can see the hex grid is displaying but no numbers. Here's what to check:

### Step 1: Open the Style Panel (RIGHT sidebar)

I see the Layers panel on the LEFT in your screenshot, but you need the **Style** panel on the RIGHT.

**Click the "Style" tab** in the top-right area of the screen (next to "Options" and "Tools").

### Step 2: In the Style Panel:

1. From the dropdown that says "Select element", choose **"Grid"**
2. You should see these options appear:
   - Type: (select "Hex grid (pointy)")
   - Scale
   - Shift by axes
   - **☑ Show grid numbers** ← CHECK THIS BOX!
   - Number size
   - Number color

### Step 3: If you DON'T see "Show grid numbers" checkbox:

The JavaScript didn't load. Open browser console (F12) and check for errors:
- Press F12
- Click "Console" tab
- Look for any red error messages
- Take a screenshot and share it

### Quick JavaScript Test

Open browser console (F12) and paste this:

```javascript
// Check if the function exists
console.log("drawGridNumbers function exists:", typeof drawGridNumbers === "function");

// Check grid overlay attributes
console.log("Grid data-show-numbers:", gridOverlay.attr("data-show-numbers"));

// Manually enable grid numbering
gridOverlay.attr("data-show-numbers", "1");
gridOverlay.attr("data-number-size", "12");
gridOverlay.attr("data-number-color", "#000000");
drawGrid();
```

If this makes numbers appear, the code works but the UI isn't connected properly.
