import polylabel from "polylabel";
import { rn } from "./numberUtils";

/**
 * Generates SVG path data for filling a shape defined by a chain of vertices.
 * @param {object} vertices - The vertices object containing positions.
 * @param {number[]} vertexChain - An array of vertex IDs defining the shape.
 * @returns {string} SVG path data for the filled shape.
 */
const getFillPath = (vertices: any, vertexChain: number[]) => {
  const points = vertexChain.map(vertexId => vertices.p[vertexId]);
  const firstPoint = points.shift();
  return `M${firstPoint} L${points.join(" ")} Z`;
}

/**
 * Generates SVG path data for borders based on a chain of vertices and a discontinuation condition.
 * @param {object} vertices - The vertices object containing positions.
 * @param {number[]} vertexChain - An array of vertex IDs defining the border.
 * @param {(vertexId: number) => boolean} discontinue - A function that determines if the path should discontinue at a vertex.
 * @returns {string} SVG path data for the border.
 */
const getBorderPath = (vertices: any, vertexChain: number[], discontinue: (vertexId: number) => boolean) => {
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

/**
 * Restores the path from exit to start using the 'from' mapping.
 * @param {number} exit - The ID of the exit cell.
 * @param {number} start - The ID of the starting cell.
 * @param {number[]} from - An array mapping each cell ID to the cell ID it came from.
 * @returns {number[]} An array of cell IDs representing the path from start to exit.
 */
const restorePath = (exit: number, start: number, from: number[]) => {
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

/**
 * Returns isolines (borders) for different types of cells in the graph.
 * @param {object} graph - The graph object containing cells and vertices.
 * @param {(cellId: number) => any} getType - A function that returns the type of a cell given its ID.
 * @param {object} [options] - Options to specify which isoline formats to generate.
 * @param {boolean} [options.polygons=false] - Whether to generate polygons for each type.
 * @param {boolean} [options.fill=false] - Whether to generate fill paths for each type.
 * @param {boolean} [options.halo=false] - Whether to generate halo paths for each type.
 * @param {boolean} [options.waterGap=false] - Whether to generate water gap paths for each type.
 * @returns {object} An object containing isolines for each type based on the specified options.
 */
export const getIsolines = (graph: any, getType: (cellId: number) => any, options: {polygons?: boolean, fill?: boolean, halo?: boolean, waterGap?: boolean} = {polygons: false, fill: false, halo: false, waterGap: false}): any => {
  const {cells, vertices} = graph;
  const isolines: any = {};

  const checkedCells = new Uint8Array(cells.i.length);
  const addToChecked = (cellId: number) => (checkedCells[cellId] = 1);
  const isChecked = (cellId: number) => checkedCells[cellId] === 1;

  for (const cellId of cells.i) {
    if (isChecked(cellId) || !getType(cellId)) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    const ofSameType = (cellId: number) => getType(cellId) === type;
    const ofDifferentType = (cellId: number) => getType(cellId) !== type;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    // check if inner lake. Note there is no shoreline for grid features
    const feature = graph.features[cells.f[onborderCell]];
    if (feature.type === "lake" && feature.shoreline?.every(ofSameType)) continue;

    const startingVertex = cells.v[cellId].find((v: number) => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    addIsolineTo(type, vertices, vertexChain, isolines, options);
  }

  return isolines;

  function addIsolineTo(type: any, vertices: any, vertexChain: number[], isolines: any, options: any) {
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
      const isLandVertex = (vertexId: number) => vertices.c[vertexId].every((i: number) => cells.h[i] >= 20);
      isolines[type].waterGap += getBorderPath(vertices, vertexChain, isLandVertex);
    }

    if (options.halo) {
      if (!isolines[type].halo) isolines[type].halo = "";
      const isBorderVertex = (vertexId: number) => vertices.c[vertexId].some((i: number) => cells.b[i]);
      isolines[type].halo += getBorderPath(vertices, vertexChain, isBorderVertex);
    }
  }
}


/**
 * Generates SVG path data for the border of a shape defined by a chain of vertices.
 * @param {number[]} cellsArray - An array of cell IDs defining the shape.
 * @param {object} packedGraph - The packed graph object containing cells and vertices.
 * @returns {string} SVG path data for the border of the shape.
 */
export const getVertexPath = (cellsArray: number[], packedGraph: any = {}) => {
  const {cells, vertices} = packedGraph;

  const cellsObj = Object.fromEntries(cellsArray.map(cellId => [cellId, true]));
  const ofSameType = (cellId: number) => cellsObj[cellId];
  const ofDifferentType = (cellId: number) => !cellsObj[cellId];

  const checkedCells = new Uint8Array(cells.c.length);
  const addToChecked = (cellId: number) => (checkedCells[cellId] = 1);
  const isChecked = (cellId: number) => checkedCells[cellId] === 1;
  let path = "";

  for (const cellId of cellsArray) {
    if (isChecked(cellId)) continue;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    const feature = packedGraph.features[cells.f[onborderCell]];
    if (feature.type === "lake" && feature.shoreline) {
      if (feature.shoreline.every(ofSameType)) continue; // inner lake
    }

    const startingVertex = cells.v[cellId].find((v: number) => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({vertices, startingVertex, ofSameType, addToChecked, closeRing: true});
    if (vertexChain.length < 3) continue;

    path += getFillPath(vertices, vertexChain);
  }

  return path;
}

/**
 * Finds the poles of inaccessibility for each type of cell in the graph.
 * @param {object} graph - The graph object containing cells and vertices.
 * @param {(cellId: number) => any} getType - A function that returns the type of a cell given its ID.
 * @returns {object} An object mapping each type to its pole of inaccessibility coordinates [x, y].
 */
export const getPolesOfInaccessibility = (graph: any, getType: (cellId: number) => any) => {
  const isolines = getIsolines(graph, getType, {polygons: true});

  const poles = Object.entries(isolines).map(([id, isoline]) => {
    const multiPolygon = (isoline as any).polygons.sort((a: any, b: any) => b.length - a.length);
    const [x, y] = polylabel(multiPolygon, 20);
    return [id, [rn(x), rn(y)]];
  });

  return Object.fromEntries(poles);
}

/**
 * Connects vertices to form a closed path based on cell type.
 * @param {object} options - Options for connecting vertices.
 * @param {object} options.vertices - The vertices object containing connections.
 * @param {number} options.startingVertex - The ID of the starting vertex.
 * @param {(cellId: number) => boolean} options.ofSameType - A function that checks if a cell is of the same type.
 * @param {(cellId: number) => void} [options.addToChecked] - A function to mark cells as checked.
 * @param {boolean} [options.closeRing=false] - Whether to close the path into a ring.
 * @returns {number[]} An array of vertex IDs forming the connected path.
 */
export const connectVertices = ({vertices, startingVertex, ofSameType, addToChecked, closeRing}: {vertices: any, startingVertex: number, ofSameType: (cellId: number) => boolean, addToChecked?: (cellId: number) => void, closeRing?: boolean}) => {
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
      window.ERROR && console.error("ConnectVertices: next vertex is out of bounds");
      break;
    }

    if (next === current) {
      window.ERROR && console.error("ConnectVertices: next vertex is not found");
      break;
    }

    if (i === MAX_ITERATIONS) {
      window.ERROR && console.error("ConnectVertices: max iterations reached", MAX_ITERATIONS);
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
 * @param {object} packedGraph - The packed graph object containing cells and their connections.
 * @returns {number[] | null} An array of cell IDs of the path from start to exit, or null if no path is found or start and exit are the same.
 */
export const findPath = (start: number, isExit: (id: number) => boolean, getCost: (current: number, next: number) => number, packedGraph: any = {}): number[] | null => {
  if (isExit(start)) return null;

  const from = [];
  const cost = [];
  const queue = new window.FlatQueue();
  queue.push(start, 0);

  while (queue.length) {
    const currentCost = queue.peekValue();
    const current = queue.pop();

    for (const next of packedGraph.cells.c[current]) {
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

declare global {
  interface Window {
    ERROR: boolean;
    FlatQueue: any;

    getIsolines: typeof getIsolines;
    getPolesOfInaccessibility: typeof getPolesOfInaccessibility;
    connectVertices: typeof connectVertices;
    findPath: typeof findPath;
    getVertexPath: typeof getVertexPath;
  }
}