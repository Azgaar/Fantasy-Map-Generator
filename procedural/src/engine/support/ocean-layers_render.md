# Removed Rendering Logic from ocean-layers.js

The following DOM manipulation and SVG rendering code blocks were removed from the engine module and should be implemented in the Viewer application:

## Removed DOM/SVG Rendering Code

### 1. DOM Configuration Reading
**Original Code (Line 79):**
```javascript
const outline = oceanLayers.attr("layers");
```
**Reason for Removal**: Direct DOM element access for reading configuration

### 2. SVG Path Creation and Styling
**Original Code (Line 113):**
```javascript
if (path) oceanLayers.append("path").attr("d", path).attr("fill", "#ecf2f9").attr("fill-opacity", opacity);
```
**Reason for Removal**: Direct SVG DOM manipulation for rendering ocean layer paths

### 3. Performance Timing (Debug)
**Original Code (Lines 81, 122):**
```javascript
TIME && console.time("drawOceanLayers");
// ... at end of function ...
TIME && console.timeEnd("drawOceanLayers");
```
**Reason for Removal**: Debug/timing logic should be handled by the viewer application

## Viewer Implementation Guidance

The Viewer application should:

1. **Configuration**: Read the `layers` attribute from the `oceanLayers` DOM element and pass it as `config.outline`
2. **Rendering**: Take the returned `layers` array and create SVG `<path>` elements with:
   - `d` attribute set to each path string
   - `fill` attribute set to `#ecf2f9`  
   - `fill-opacity` attribute set to the calculated opacity value
3. **Performance**: Optionally implement timing logic using `console.time/timeEnd` if needed

## Data Structure Returned by Engine

The engine now returns a structured object instead of directly manipulating the DOM:

```javascript
{
  layers: [
    {
      type: -1,           // depth level
      paths: ["M10,20L30,40..."], // array of SVG path strings
      opacity: 0.13       // calculated opacity value
    }
  ]
}
```