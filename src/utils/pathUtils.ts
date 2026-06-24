import polylabel from "polylabel";
import type { Point, Vertices } from "../generators/voronoi";
import type { PackedGraph } from "../types/PackedGraph";
import { rn } from "./numberUtils";

/**
 * Generates SVG path data for filling a shape defined by a chain of vertices.
 * @param {object} vertices - The vertices object containing positions.
 * @param {number[]} vertexChain - An array of vertex IDs defining the shape.
 * @returns {string} SVG path data for the filled shape.
 */
const getFillPath = (vertices: Vertices, vertexChain: number[]): string => {
  const points = vertexChain.map(vertexId => vertices.p[vertexId]);
  const firstPoint = points.shift();
  return `M${firstPoint} L${points.join(" ")} Z`;
};

/**
 * Generates SVG path data for borders based on a chain of vertices and a discontinuation condition.
 * @param {object} vertices - The vertices object containing positions.
 * @param {number[]} vertexChain - An array of vertex IDs defining the border.
 * @param {(vertexId: number) => boolean} discontinue - A function that determines if the path should discontinue at a vertex.
 * @returns {string} SVG path data for the border.
 */
const getBorderPath = (
  vertices: Vertices,
  vertexChain: number[],
  discontinue: (vertexId: number) => boolean
): string => {
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
};

/**
 * Restores the path from exit to start using the 'from' mapping.
 * @param {number} exit - The ID of the exit cell.
 * @param {number} start - The ID of the starting cell.
 * @param {number[]} from - An array mapping each cell ID to the cell ID it came from.
 * @returns {number[]} An array of cell IDs representing the path from start to exit.
 */
const restorePath = (exit: number, start: number, from: number[]): number[] => {
  const pathCells: number[] = [];

  let current = exit;
  let prev = exit;

  while (current !== start) {
    pathCells.push(current);
    prev = from[current];
    current = prev;
  }

  pathCells.push(current);

  return pathCells.reverse();
};

/**
 * Returns isolines (borders) for different types of cells in the graph.
 * @param {object} graph - The graph object containing cells and vertices.
 * @param {(cellId: number) => string | number} getType - A function that returns the type of a cell given its ID.
 * @param {object} [options] - Options to specify which isoline formats to generate.
 * @param {boolean} [options.polygons=false] - Whether to generate polygons for each type.
 * @param {boolean} [options.fill=false] - Whether to generate fill paths for each type.
 * @param {boolean} [options.halo=false] - Whether to generate halo paths for each type.
 * @param {boolean} [options.waterGap=false] - Whether to generate water gap paths for each type.
 * @returns {object} An object containing isolines for each type based on the specified options.
 */
export const getIsolines = (
  { cells, vertices, features }: PackedGraph,
  getType: (cellId: number) => string | number | null,
  options: {
    polygons?: boolean;
    fill?: boolean;
    halo?: boolean;
    waterGap?: boolean;
  } = {
    polygons: false,
    fill: false,
    halo: false,
    waterGap: false
  }
): Isolines => {
  const isolines: Isolines = {};

  const checkedCells = new Uint8Array(cells.i.length);
  const addToChecked = (cellId: number) => {
    checkedCells[cellId] = 1;
  };
  const isChecked = (cellId: number) => checkedCells[cellId] === 1;

  for (const cellId of cells.i) {
    if (isChecked(cellId) || !getType(cellId)) continue;
    addToChecked(cellId);

    const type = getType(cellId);
    if (type === null) continue;

    const ofSameType = (cellId: number) => getType(cellId) === type;
    const ofDifferentType = (cellId: number) => getType(cellId) !== type;

    const onborderCell = cells.c[cellId].find(ofDifferentType);
    if (onborderCell === undefined) continue;

    // check if inner lake. Note there is no shoreline for grid features
    const feature = features[cells.f[onborderCell]];
    if (feature.type === "lake" && feature.shoreline?.every(ofSameType)) continue;

    const startingVertex = cells.v[cellId].find((v: number) => vertices.c[v].some(ofDifferentType));
    if (startingVertex === undefined) throw new Error(`Starting vertex for cell ${cellId} is not found`);

    const vertexChain = connectVertices({
      vertices,
      startingVertex,
      ofSameType,
      addToChecked,
      closeRing: true
    });
    if (vertexChain.length < 3) continue;

    addIsolineTo(type, vertices, vertexChain, isolines, options);
  }

  return isolines;

  function addIsolineTo(
    type: string | number,
    vertices: Vertices,
    vertexChain: number[],
    isolines: Isolines,
    options: {
      polygons?: boolean;
      fill?: boolean;
      halo?: boolean;
      waterGap?: boolean;
    }
  ): void {
    if (!isolines[type]) isolines[type] = {};

    if (options.polygons) {
      if (!isolines[type].polygons) isolines[type].polygons = [];
      isolines[type].polygons.push(vertexChain.map(vertexId => vertices.p[vertexId]));
    }

    if (options.fill) {
      if (!isolines[type].fill) isolines[type].fill = "";
      isolines[type].fill = isolines[type].fill + getFillPath(vertices, vertexChain);
    }

    if (options.waterGap) {
      if (!isolines[type].waterGap) isolines[type].waterGap = "";
      const isLandVertex = (vertexId: number): boolean => vertices.c[vertexId].every((i: number) => cells.h[i] >= 20);
      isolines[type].waterGap = isolines[type].waterGap + getBorderPath(vertices, vertexChain, isLandVertex);
    }

    if (options.halo) {
      if (!isolines[type].halo) isolines[type].halo = "";
      const isBorderVertex = (vertexId: number): boolean => vertices.c[vertexId].some((i: number) => cells.b[i]);
      isolines[type].halo = isolines[type].halo + getBorderPath(vertices, vertexChain, isBorderVertex);
    }
  }
};

type Isolines = Record<string, { polygons?: Point[][]; fill?: string; halo?: string; waterGap?: string }>;

/**
 * Generates SVG path data for the border of a shape defined by a chain of vertices.
 * @param {number[]} cellsArray - An array of cell IDs defining the shape.
 * @param {object} packedGraph - The packed graph object containing cells and vertices.
 * @returns {string} SVG path data for the border of the shape.
 */
export const getVertexPath = (cellsArray: number[], packedGraph: PackedGraph = {} as PackedGraph): string => {
  const { cells, vertices } = packedGraph;

  const cellsObj = Object.fromEntries(cellsArray.map(cellId => [cellId, true]));
  const ofSameType = (cellId: number) => cellsObj[cellId];
  const ofDifferentType = (cellId: number) => !cellsObj[cellId];

  const checkedCells = new Uint8Array(cells.c.length);
  const addToChecked = (cellId: number) => {
    checkedCells[cellId] = 1;
  };
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

    const vertexChain = connectVertices({
      vertices,
      startingVertex,
      ofSameType,
      addToChecked,
      closeRing: true
    });
    if (vertexChain.length < 3) continue;

    path += getFillPath(vertices, vertexChain);
  }

  return path;
};

/**
 * Finds the poles of inaccessibility for each type of cell in the graph.
 * @param {object} graph - The graph object containing cells and vertices.
 * @param {(cellId: number) => any} getType - A function that returns the type of a cell given its ID.
 * @returns {object} An object mapping each type to its pole of inaccessibility coordinates [x, y].
 */
export const getPolesOfInaccessibility = (
  graph: PackedGraph,
  getType: (cellId: number) => string | number
): Record<string, [number, number]> => {
  const isolines = getIsolines(graph, getType, { polygons: true });

  const poles = Object.entries(isolines).map(([id, isoline]) => {
    const multiPolygon = (isoline.polygons as unknown as number[][][]).sort((a, b) => b.length - a.length);
    const [x, y] = polylabel(multiPolygon, 20);
    return [id, [rn(x), rn(y)]];
  });

  return Object.fromEntries(poles);
};

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
export const connectVertices = ({
  vertices,
  startingVertex,
  ofSameType,
  addToChecked,
  closeRing
}: {
  vertices: Vertices;
  startingVertex: number;
  ofSameType: (cellId: number) => boolean;
  addToChecked?: (cellId: number) => void;
  closeRing?: boolean;
}): number[] => {
  const MAX_ITERATIONS = vertices.c.length;
  const chain: number[] = []; // vertices chain to form a path

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
};

/**
 * Finds the shortest path between two cells using a cost-based pathfinding algorithm.
 * @param {number} start - The ID of the starting cell.
 * @param {(id: number, current?: number) => boolean} isExit - Returns true if `id` is the exit cell. The second argument is the cell we are stepping from; it is undefined for the initial start-cell check, letting callers veto invalid approaches (e.g. forbid arriving at a sea port via a land neighbor).
 * @param {(current: number, next: number) => number} getCost - A function that returns the path cost from current cell to the next cell. Must return `Infinity` for impassable connections.
 * @param {object} packedGraph - The packed graph object containing cells and their connections.
 * @returns {number[] | null} An array of cell IDs of the path from start to exit, or null if no path is found or start and exit are the same.
 */
export const findPath = (
  start: number,
  isExit: (id: number, current?: number) => boolean,
  getCost: (current: number, next: number) => number,
  packedGraph: PackedGraph = {} as PackedGraph
): number[] | null => {
  if (isExit(start)) return null;

  const from: number[] = [];
  const cost: number[] = [];
  const queue = new window.FlatQueue();
  queue.push(start, 0);

  while (queue.length) {
    const currentCost = queue.peekValue();
    const current = queue.pop();

    for (const next of packedGraph.cells.c[current]) {
      if (isExit(next, current)) {
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
};

type MeanderOptions = {
  anchors?: Point[];
  meandering?: number;
  startStep?: number;
  cellCount?: number;
  isWaterCell?: boolean[];
  bounds?: { width: number; height: number };
};

const WATER_MEANDER_SCALE = 0.25;
const RELAX_ITERATIONS = 4;

export const meander = (cells: number[], cellPositions: Point[], options: MeanderOptions = {}) => {
  const meandering = options.meandering ?? 0.5;
  const customAnchors = options.anchors;
  const bounds = options.bounds;
  const startStep = options.startStep ?? 10;
  const cellCount = options.cellCount ?? cells.length;
  const isWaterCell = options.isWaterCell;

  const anchorPoints: Point[] = cells.map((cell, i) => {
    if (customAnchors) return customAnchors[i];
    if (cell === -1) {
      const prevCell = cells[i - 1];
      const prev: Point = prevCell !== undefined && prevCell >= 0 ? cellPositions[prevCell] : [0, 0];
      if (!bounds) return prev;
      return projectToNearestEdge(prev, bounds.width, bounds.height);
    }
    return cellPositions[cell];
  });

  const points: Point[] = [];
  const anchorIndices: number[] = [];
  const lastStep = cells.length - 1;
  let step = startStep;

  for (let i = 0; i <= lastStep; i++, step++) {
    const [x1, y1] = anchorPoints[i];
    anchorIndices.push(points.length);
    points.push([x1, y1]);

    if (i === lastStep) break;

    const nextCell = cells[i + 1];
    if (nextCell === -1) continue; // boundary anchor will be emitted on next iter without interpolation

    const [x2, y2] = anchorPoints[i + 1];
    const dist2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (dist2 <= 25 && cellCount >= 6) continue;

    let meanderVal = meandering + 1 / step + Math.max(meandering - step / 100, 0);
    if (isWaterCell && (isWaterCell[i] || isWaterCell[i + 1])) meanderVal *= WATER_MEANDER_SCALE;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const sinMeander = Math.sin(angle) * meanderVal;
    const cosMeander = Math.cos(angle) * meanderVal;

    if (step < 20 && (dist2 > 64 || (dist2 > 36 && cellCount < 5))) {
      const p1x = (x1 * 2 + x2) / 3 + -sinMeander;
      const p1y = (y1 * 2 + y2) / 3 + cosMeander;
      const p2x = (x1 + x2 * 2) / 3 + sinMeander / 2;
      const p2y = (y1 + y2 * 2) / 3 - cosMeander / 2;
      points.push([p1x, p1y], [p2x, p2y]);
    } else if (dist2 > 25 || cellCount < 6) {
      const p1x = (x1 + x2) / 2 + -sinMeander;
      const p1y = (y1 + y2) / 2 + cosMeander;
      points.push([p1x, p1y]);
    }
  }

  relaxAcuteAngles(points, anchorIndices);
  return { points, anchorIndices };
};

function cornerCos(a: Point, b: Point, c: Point): number {
  const ax = a[0] - b[0];
  const ay = a[1] - b[1];
  const cx = c[0] - b[0];
  const cy = c[1] - b[1];
  const la = Math.hypot(ax, ay);
  const lc = Math.hypot(cx, cy);
  if (la === 0 || lc === 0) return -1;
  return (ax * cx + ay * cy) / (la * lc);
}

function reflectAcrossLine(m: Point, P: Point, Q: Point): Point {
  const dx = Q[0] - P[0];
  const dy = Q[1] - P[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [m[0], m[1]];
  const t = ((m[0] - P[0]) * dx + (m[1] - P[1]) * dy) / len2;
  const footX = P[0] + t * dx;
  const footY = P[1] + t * dy;
  return [2 * footX - m[0], 2 * footY - m[1]];
}

function relaxAcuteAngles(points: Point[], anchorIndices: number[]): void {
  const n = points.length;
  if (n < 3) return;

  const isAnchor = new Uint8Array(n);
  for (const idx of anchorIndices) isAnchor[idx] = 1;

  // The two anchors bounding each meander point define its segment baseline (the axis to flip about).
  const prevAnchor = new Int32Array(n).fill(-1);
  const nextAnchor = new Int32Array(n).fill(-1);
  for (let i = 0, last = -1; i < n; i++) {
    prevAnchor[i] = last;
    if (isAnchor[i]) last = i;
  }
  for (let i = n - 1, last = -1; i >= 0; i--) {
    nextAnchor[i] = last;
    if (isAnchor[i]) last = i;
  }

  // Penalty for an acute corner at vertex i
  const acuteCost = (pos: (k: number) => Point, i: number): number => {
    if (i <= 0 || i >= n - 1) return 0; // endpoints have no corner
    const cos = cornerCos(pos(i - 1), pos(i), pos(i + 1));
    return cos > 0 ? cos : 0;
  };

  for (let iter = 0; iter < RELAX_ITERATIONS; iter++) {
    const snapshot = points.map(p => [p[0], p[1]] as Point);
    const at = (k: number) => snapshot[k];
    let flippedAny = false;

    for (let i = 1; i < n - 1; i++) {
      if (isAnchor[i]) continue; // never move a real control point
      const p = prevAnchor[i];
      const q = nextAnchor[i];
      if (p < 0 || q < 0) continue;

      const flipped = reflectAcrossLine(snapshot[i], snapshot[p], snapshot[q]);
      const withFlip = (k: number) => (k === i ? flipped : snapshot[k]);

      // Score the three corners this point participates in (at i-1, i, i+1) before and after the flip.
      const before = acuteCost(at, i - 1) + acuteCost(at, i) + acuteCost(at, i + 1);
      const after = acuteCost(withFlip, i - 1) + acuteCost(withFlip, i) + acuteCost(withFlip, i + 1);

      if (after < before - 1e-6) {
        points[i][0] = flipped[0];
        points[i][1] = flipped[1];
        flippedAny = true;
      }
    }

    if (!flippedAny) break; // converged — no beneficial flip left
  }
}

// Snap a point to the closest edge of the [0,width]×[0,height] rectangle
export function projectToNearestEdge(point: Point, width: number, height: number): Point {
  const [x, y] = point;
  const minDist = Math.min(y, height - y, x, width - x);
  if (minDist === y) return [x, 0];
  if (minDist === height - y) return [x, height];
  if (minDist === x) return [0, y];
  return [width, y];
}

declare global {
  interface Window {
    getIsolines: typeof getIsolines;
    getPolesOfInaccessibility: typeof getPolesOfInaccessibility;
    connectVertices: typeof connectVertices;
    findPath: typeof findPath;
    getVertexPath: typeof getVertexPath;
  }
}
