"use strict";

const pointsGenerators = {
  jittered: generateJitteredPoints,
  hexFlat: generateHexFlatPoints,
  hexPointy: generateHexPointyPoints,
  square: generateSquarePoints
};

function generatePoints() {
  TIME && console.time("placePoints");
  const cellsDesired = +byId("pointsInput").dataset.cells;
  const spacing = Math.sqrt((graphWidth * graphHeight) / cellsDesired); // spacing between points
  const boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);

  const type = byId("gridType").value;
  const {points, cellsX, cellsY} = pointsGenerators[type](graphWidth, graphHeight, spacing);
  TIME && console.timeEnd("placePoints");

  return {spacing, cellsDesired, type, boundary, points, cellsX, cellsY};
}

function generateJitteredPoints(width, height, spacing) {
  return generateSquareJitteredPoints(0.9, width, height, spacing);
}

function generateSquarePoints(width, height, spacing) {
  return generateSquareJitteredPoints(0, width, height, spacing);
}

function generateSquareJitteredPoints(jittering, width, height, spacing) {
  const radius = spacing / 2;
  const maxDeviation = radius * jittering;
  const jitter = () => (jittering ? Math.random() * maxDeviation * 2 - maxDeviation : 0);

  let points = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }

  const cellsX = Math.floor((width + 0.5 * spacing - 1e-10) / spacing);
  const cellsY = Math.floor((height + 0.5 * spacing - 1e-10) / spacing);
  return {points, cellsX, cellsY};
}

function generateHexFlatPoints(width, height, spacing) {
  return generateHexPoints(false, width, height, spacing);
}

function generateHexPointyPoints(width, height, spacing) {
  return generateHexPoints(true, width, height, spacing);
}

function generateHexPoints(isPointy, width, height, spacing) {
  const hexRatio = Math.sqrt(3) / 2;
  const spacingX = isPointy ? spacing / hexRatio : spacing * 2;
  const spacingY = isPointy ? spacing : spacing / hexRatio / 2;
  const maxWidth = width + spacingX / 2;
  const maxHeight = height + spacingY / 2;
  const indentionX = spacingX / 2;

  let points = [];
  for (let y = 0, row = 0; y < maxHeight; y += spacingY, row++) {
    for (let x = row % 2 ? 0 : indentionX; x < maxWidth; x += spacingX) {
      if (x > width) x = width;
      if (y > height) y = height;
      points.push([rn(x, 2), rn(y, 2)]);
    }
  }

  const cellsX = Math.ceil(width / spacingX);
  const cellsY = Math.ceil(height / spacingY);
  return {points, cellsX, cellsY};
}

// add points along map edge to pseudo-clip voronoi cells
function getBoundaryPoints(width, height, spacing) {
  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  const points = [];

  for (let i = 0.5; i < numberX; i++) {
    let x = Math.ceil((w * i) / numberX + offset);
    points.push([x, offset], [x, h + offset]);
  }

  for (let i = 0.5; i < numberY; i++) {
    let y = Math.ceil((h * i) / numberY + offset);
    points.push([offset, y], [w + offset, y]);
  }

  return points;
}
