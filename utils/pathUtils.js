"use strict";

// get continuous paths (isolines) for all cells at once based on getType(cellId) comparison
function getIsolines(getType, options = {polygons: false, fill: false, halo: false, waterGap: false}) {
  const {cells, vertices} = pack;
  const isolines = {};

  const checkedCells = new Uint8Array(cells.c.length);
  const addToChecked = cellId => (checkedCells[cellId] = 1);
  const isChecked = cellId => checkedCells[cellId] === 1;

  for (let cellId = 0; cellId < cells.c.length; cellId++) {
    if (isChecked(cellId) || getType(cellId) === 0) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    const ofSameType = cellId => getType(cellId) === type;
    const ofDifferentType = cellId => getType(cellId) !== type;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    const feature = pack.features[cells.f[onborderCell]];
    if (feature.type === "lake") {
      if (!feature.shoreline) Lakes.getShoreline(feature);
      if (feature.shoreline.every(ofSameType)) continue; // inner lake
    }

    const startingVertex = cells.v[cellId].find(v => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    addIsoline(type, vertexChain);
  }

  return Object.entries(isolines);

  function getBorderPath(vertexChain, discontinue) {
    let discontinued = true;
    let lastOperation = "";
    const path = vertexChain.map(vertex => {
      if (discontinue(vertex)) {
        discontinued = true;
        return "";
      }

      const operation = discontinued ? "M" : "L";
      const command = operation === lastOperation ? "" : operation;

      discontinued = false;
      lastOperation = operation;

      return ` ${command}${getVertexPoint(vertex)}`;
    });

    return path.join("").trim();
  }

  function isBorderVertex(vertex) {
    const adjacentCells = vertices.c[vertex];
    return adjacentCells.some(i => cells.b[i]);
  }

  function isLandVertex(vertex) {
    const adjacentCells = vertices.c[vertex];
    return adjacentCells.every(i => cells.h[i] >= 20);
  }

  function addIsoline(index, vertexChain) {
    if (!isolines[index]) isolines[index] = {polygons: [], fill: "", waterGap: "", halo: ""};
    if (options.polygons) isolines[index].polygons.push(vertexChain.map(getVertexPoint));
    if (options.fill) isolines[index].fill += getFillPath(vertexChain);
    if (options.halo) isolines[index].halo += getBorderPath(vertexChain, isBorderVertex);
    if (options.waterGap) isolines[index].waterGap += getBorderPath(vertexChain, isLandVertex);
  }
}

function getVertexPoint(vertexId) {
  return pack.vertices.p[vertexId];
}

function getFillPath(vertexChain) {
  const points = vertexChain.map(getVertexPoint);
  const firstPoint = points.shift();
  return `M${firstPoint} L${points.join(" ")}`;
}

// get single path for an non-continuous array of cells
function getVertexPath(cellsArray) {
  const {cells, vertices} = pack;

  const cellsObj = Object.fromEntries(cellsArray.map(cellId => [cellId, true]));
  const ofSameType = cellId => cellsObj[cellId];
  const ofDifferentType = cellId => !cellsObj[cellId];

  const checkedCells = new Uint8Array(cells.c.length);
  const addToChecked = cellId => (checkedCells[cellId] = 1);
  const isChecked = cellId => checkedCells[cellId] === 1;

  let path = "";

  for (const cellId of cellsArray) {
    if (isChecked(cellId)) continue;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    const feature = pack.features[cells.f[onborderCell]];
    if (feature.type === "lake") {
      if (!feature.shoreline) Lakes.getShoreline(feature);
      if (feature.shoreline.every(ofSameType)) continue; // inner lake
    }

    const startingVertex = cells.v[cellId].find(v => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    path += getFillPath(vertexChain);
  }

  return path;
}

function getPolesOfInaccessibility(getType) {
  const isolines = getIsolines(getType, {polygons: true});

  const poles = isolines.map(([id, isoline]) => {
    const multiPolygon = isoline.polygons.sort((a, b) => b.length - a.length);
    const [x, y] = polylabel(multiPolygon, 20);
    return [id, [rn(x), rn(y)]];
  });

  return Object.fromEntries(poles);
}

function connectVertices({startingVertex, ofSameType, addToChecked, closeRing}) {
  const vertices = pack.vertices;
  const MAX_ITERATIONS = pack.cells.i.length;
  const chain = []; // vertices chain to form a path

  let next = startingVertex;
  for (let i = 0; i === 0 || next !== startingVertex; i++) {
    const previous = chain.at(-1);
    const current = next;
    chain.push(current);

    const neibCells = vertices.c[current];
    if (addToChecked) neibCells.filter(ofSameType).forEach(addToChecked);

    const [c1, c2, c3] = neibCells.map(ofSameType);
    const [v1, v2, v3] = vertices.v[current];

    if (v1 !== previous && c1 !== c2) next = v1;
    else if (v2 !== previous && c2 !== c3) next = v2;
    else if (v3 !== previous && c1 !== c3) next = v3;

    if (next === current) {
      ERROR && console.error("ConnectVertices: next vertex is not found");
      break;
    }

    if (i === MAX_ITERATIONS) {
      ERROR && console.error("ConnectVertices: max iterations reached", MAX_ITERATIONS);
      break;
    }
  }

  if (closeRing) chain.push(startingVertex);
  return chain;
}
