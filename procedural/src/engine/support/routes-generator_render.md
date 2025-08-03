# Removed Rendering/UI Logic from routes-generator.js

The following DOM manipulation and SVG rendering code blocks were **removed** from the engine module and should be moved to the Viewer application:

## 1. Route Path Generation (SVG)
**Location:** `getPath()` function (lines 675-680)
```javascript
const ROUTE_CURVES = {
  roads: d3.curveCatmullRom.alpha(0.1),
  trails: d3.curveCatmullRom.alpha(0.1),
  searoutes: d3.curveCatmullRom.alpha(0.5),
  default: d3.curveCatmullRom.alpha(0.1)
};

function getPath({group, points}) {
  const lineGen = d3.line();
  lineGen.curve(ROUTE_CURVES[group] || ROUTE_CURVES.default);
  const path = round(lineGen(points.map(p => [p[0], p[1]])), 1);
  return path;
}
```

## 2. Route Length Measurement (DOM Access)
**Location:** `getLength()` function (lines 682-685)
```javascript
function getLength(routeId) {
  const path = routes.select("#route" + routeId).node();
  return path.getTotalLength();
}
```

## 3. Route Removal from SVG (DOM Manipulation)
**Location:** `remove()` function (line 707)
```javascript
// From the original remove() function:
viewbox.select("#route" + route.i).remove();
```

## 4. Console Timing (UI Feedback)
**Location:** Throughout generation functions
```javascript
// Lines 121, 139, 144, 162, 167, 185
TIME && console.time("generateMainRoads");
TIME && console.timeEnd("generateMainRoads");
TIME && console.time("generateTrails");
TIME && console.timeEnd("generateTrails");
TIME && console.time("generateSeaRoutes");
TIME && console.timeEnd("generateSeaRoutes");
```

## Summary
- **SVG path generation using D3** - Should be handled by the Viewer
- **DOM element selection and manipulation** - Should be handled by the Viewer
- **Console timing output** - Should be handled by the Viewer for debugging
- **Direct access to SVG elements** - Should be handled by the Viewer

The engine now returns pure data that the Viewer can use to create SVG paths and handle all rendering operations.