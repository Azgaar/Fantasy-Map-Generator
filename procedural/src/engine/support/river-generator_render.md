# Removed Rendering/UI Logic from river-generator.js

## Removed DOM Manipulation Code

The following rendering and DOM manipulation code blocks were identified and **removed** from the engine module:

### 1. River SVG Element Removal (Line 553)

**Original Code:**
```javascript
riversToRemove.forEach(r => rivers.select("#river" + r).remove());
```

**Location:** In the `remove` function
**Purpose:** Direct DOM manipulation to remove SVG river elements from the display
**Removal Reason:** This is pure rendering logic that manipulates the DOM/SVG directly

### 2. Debug SVG Line Drawing (Lines 173-179)

**Original Code:**
```javascript
// debug
//   .append("line")
//   .attr("x1", pack.cells.p[i][0])
//   .attr("y1", pack.cells.p[i][1])
//   .attr("x2", pack.cells.p[min][0])
//   .attr("y2", pack.cells.p[min][1])
//   .attr("stroke", "#333")
//   .attr("stroke-width", 0.2);
```

**Location:** In the `drainWater` function
**Purpose:** Debug visualization showing water flow directions as SVG lines
**Removal Reason:** SVG rendering code for debugging visualization

## Code Blocks That Were NOT Removed

The following code blocks might appear to be rendering-related but were **retained** because they are computational:

### `getRiverPath` Function
- **Retained:** This function generates SVG path data as strings, but it's computational geometry
- **Reasoning:** Path generation is part of the data model - the engine provides the path data, the viewer renders it

### `lineGen` Usage
- **Retained:** Used for mathematical path interpolation and curve generation
- **Reasoning:** This is geometric computation, not direct DOM manipulation

## Impact on Viewer Application

The Viewer application will need to implement the following rendering features that were removed:

### 1. River SVG Management
```javascript
// Viewer will need to implement:
function removeRiverFromDOM(riverId) {
  rivers.select(`#river${riverId}`).remove();
}
```

### 2. Debug Visualization
```javascript
// Viewer can optionally implement debug lines:
function renderDebugFlowLines(flowData) {
  svg.selectAll('.debug-flow')
    .data(flowData)
    .enter()
    .append('line')
    .attr('class', 'debug-flow')
    .attr('x1', d => d.from[0])
    .attr('y1', d => d.from[1])
    .attr('x2', d => d.to[0])
    .attr('y2', d => d.to[1])
    .attr('stroke', '#333')
    .attr('stroke-width', 0.2);
}
```

## Clean Separation Achieved

The refactored module now maintains perfect separation:

- **Engine Responsibilities:**
  - River path computation and geometry
  - Flow calculations and physics
  - Data structure generation
  - Mathematical algorithms

- **Viewer Responsibilities (to be implemented):**
  - SVG river rendering
  - DOM element management
  - Debug visualization
  - User interface interactions

## Summary

**Total removed code blocks:** 2
- 1 direct DOM manipulation (river element removal)
- 1 debug SVG rendering (commented flow lines)

The module is now completely headless and environment-agnostic, with all rendering logic successfully extracted for implementation in the Viewer application.