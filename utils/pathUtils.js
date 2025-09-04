"use strict";

// get continuous paths (isolines) for all cells at once based on getType(cellId) comparison
function getIsolines(graph, getType, options = {polygons: false, fill: false, halo: false, waterGap: false}) {
  const {cells, vertices} = graph;
  const isolines = {};

  const checkedCells = new Uint8Array(cells.i.length);
  const addToChecked = cellId => (checkedCells[cellId] = 1);
  const isChecked = cellId => checkedCells[cellId] === 1;

  for (const cellId of cells.i) {
    if (isChecked(cellId) || !getType(cellId)) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    const ofSameType = cellId => getType(cellId) === type;
    const ofDifferentType = cellId => getType(cellId) !== type;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    // check if inner lake. Note there is no shoreline for grid features
    const feature = graph.features[cells.f[onborderCell]];
    if (feature.type === "lake" && feature.shoreline?.every(ofSameType)) continue;

    const startingVertex = cells.v[cellId].find(v => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    addIsoline(type, vertices, vertexChain);
  }

  return isolines;

  function addIsoline(type, vertices, vertexChain) {
    if (!isolines[type]) isolines[type] = {};

    if (options.polygons) {
      if (!isolines[type].polygons) isolines[type].polygons = [];
      isolines[type].polygons.push(vertexChain.map(vertexId => vertices.p[vertexId]));
    }

    if (options.fill) {
      if (!isolines[type].fill) isolines[type].fill = "";
      isolines[type].fill += getFillPath(vertices, vertexChain);
    }

    if (options.waterGap) {
      if (!isolines[type].waterGap) isolines[type].waterGap = "";
      const isLandVertex = vertexId => vertices.c[vertexId].every(i => cells.h[i] >= 20);
      isolines[type].waterGap += getBorderPath(vertices, vertexChain, isLandVertex);
    }

    if (options.halo) {
      if (!isolines[type].halo) isolines[type].halo = "";
      const isBorderVertex = vertexId => vertices.c[vertexId].some(i => cells.b[i]);
      isolines[type].halo += getBorderPath(vertices, vertexChain, isBorderVertex);
    }
  }
}

function getFillPath(vertices, vertexChain) {
  const points = vertexChain.map(vertexId => vertices.p[vertexId]);
  const firstPoint = points.shift();
  return `M${firstPoint} L${points.join(" ")} Z`;
}

function getBorderPath(vertices, vertexChain, discontinue) {
  let discontinued = true;
  let lastOperation = "";
  const path = vertexChain.map(vertexId => {
    if (discontinue(vertexId)) {
      discontinued = true;
      return "";
    }

    const operation = discontinued ? "M" : "L";
    discontinued = false;
    lastOperation = operation;

    const command = operation === "L" && operation === lastOperation ? "" : operation;
    return ` ${command}${vertices.p[vertexId]}`;
  });

  return path.join("").trim();
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
    if (feature.type === "lake" && feature.shoreline) {
      if (feature.shoreline.every(ofSameType)) continue; // inner lake
    }

    const startingVertex = cells.v[cellId].find(v => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    path += getFillPath(vertices, vertexChain);
  }

  return path;
}

function getPolesOfInaccessibility(graph, getType) {
  const isolines = getIsolines(graph, getType, {polygons: true});

  const poles = Object.entries(isolines).map(([id, isoline]) => {
    const multiPolygon = isoline.polygons.sort((a, b) => b.length - a.length);
    const [x, y] = polylabel(multiPolygon, 20);
    return [id, [rn(x), rn(y)]];
  });

  return Object.fromEntries(poles);
}

function connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing}) {
  const MAX_ITERATIONS = vertices.c.length;
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

    if (next >= vertices.c.length) {
      ERROR && console.error("ConnectVertices: next vertex is out of bounds");
      break;
    }

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

/**
 * Finds the shortest path between two cells using a cost-based pathfinding algorithm.
 * @param {number} start - The ID of the starting cell.
 * @param {(id: number) => boolean} isExit - A function that returns true if the cell is the exit cell.
 * @param {(current: number, next: number) => number} getCost - A function that returns the path cost from current cell to the next cell. Must return `Infinity` for impassable connections.
 * @returns {number[] | null} An array of cell IDs of the path from start to exit, or null if no path is found or start and exit are the same.
 */
function findPath(start, isExit, getCost) {
  if (isExit(start)) return null;

  const from = [];
  const cost = [];
  const queue = new FlatQueue();
  queue.push(start, 0);

  while (queue.length) {
    const currentCost = queue.peekValue();
    const current = queue.pop();

    for (const next of pack.cells.c[current]) {
      if (isExit(next)) {
        from[next] = current;
        return restorePath(next, start, from);
      }

      const nextCost = getCost(current, next);
      if (nextCost === Infinity) continue; // impassable cell
      const totalCost = currentCost + nextCost;

      if (totalCost >= cost[next]) continue; // has cheaper path
      from[next] = current;
      cost[next] = totalCost;
      queue.push(next, totalCost);
    }
  }

  return null;
}

/**
 * A* shortest path between two cells using an admissible heuristic.
 * Uses a reusable FlatQueue and typed arrays to minimize allocations.
 * @param {number} start - start cell id
 * @param {number} goal - goal cell id
 * @param {(current:number,next:number)=>number} getCost - edge cost; return Infinity for impassable
 * @param {(id:number)=>number} heuristic - estimated remaining cost from id to goal; must be admissible
 * @returns {number[]|null}
 */
function findPathAStar(start, goal, getCost, heuristic) {
  if (start === goal) return null;

  // reusable arrays sized to pack.cells.c.length
  const n = pack.cells.c.length;
  if (!findPathAStar._g || findPathAStar._g.length !== n) {
    findPathAStar._g = new Float64Array(n);
    findPathAStar._f = new Float64Array(n);
    findPathAStar._from = new Int32Array(n);
  }
  const g = findPathAStar._g;
  const f = findPathAStar._f;
  const from = findPathAStar._from;
  for (let i = 0; i < n; i++) { g[i] = Infinity; f[i] = Infinity; from[i] = -1; }

  const open = new FlatQueue();
  g[start] = 0;
  f[start] = heuristic(start);
  open.push(start, f[start]);

  // simple safety cap to avoid pathological searches
  const maxPops = n * 4;
  let pops = 0;
  while (open.length) {
    if (pops++ > maxPops) return null;
    const currentF = open.peekValue();
    const current = open.pop();
    if (current === goal) return restorePath(goal, start, from);
    if (currentF > f[current]) continue; // stale entry

    const neigh = pack.cells.c[current];
    for (let k = 0; k < neigh.length; k++) {
      const next = neigh[k];
      const edge = getCost(current, next);
      if (edge === Infinity) continue;
      const tentativeG = g[current] + edge;
      if (tentativeG >= g[next]) continue;
      from[next] = current;
      g[next] = tentativeG;
      f[next] = tentativeG + heuristic(next);
      open.push(next, f[next]);
    }
  }

  return null;
}

// supplementary function for findPath
function restorePath(exit, start, from) {
  const pathCells = [];

  let current = exit;
  let prev = exit;

  while (current !== start) {
    pathCells.push(current);
    prev = from[current];
    current = prev;
  }

  pathCells.push(current);

  return pathCells.reverse();
}
