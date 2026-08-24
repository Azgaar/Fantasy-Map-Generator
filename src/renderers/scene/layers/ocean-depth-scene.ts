import { curveBasisClosed, line } from "d3";
import type { Grid } from "@/types/grid";
import { clipPoly } from "@/utils";
import type { SceneBounds, SceneRevision } from "../primitives";
import type { OceanLayerStyle } from "../styles";
import type { MapBounds } from "./feature-shapes";

export interface OceanDepthBand {
  color: string;
  depth: number;
  opacity: number;
  path: string;
}

export interface OceanDepthScene {
  bands: readonly OceanDepthBand[];
  bounds: SceneBounds;
  layer: "ocean";
  revision: SceneRevision;
  unsupportedEffects: readonly string[];
}

export interface OceanDepthSource {
  cells: Pick<Grid["cells"], "b" | "c" | "i" | "t" | "v">;
  vertices: Pick<Grid["vertices"], "c" | "p" | "v">;
}

export function buildOceanDepthScene(
  source: OceanDepthSource,
  bounds: MapBounds,
  style: OceanLayerStyle,
  revision: SceneRevision = 0
): OceanDepthScene {
  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error(`Invalid ocean depth bounds: ${bounds.width}x${bounds.height}`);
  }
  const limits = resolveOceanDepthLimits(style.bands.layers, source.cells.t);
  const paths = buildDepthPaths(source, bounds, limits);
  const opacity = limits.length ? style.bands.opacity / limits.length : 0;
  return {
    bands: limits.flatMap(depth => {
      const path = paths.get(depth);
      return path ? [{ color: style.bands.color, depth, opacity, path }] : [];
    }),
    bounds: { maxX: bounds.width, maxY: bounds.height, minX: 0, minY: 0 },
    layer: "ocean",
    revision,
    unsupportedEffects: style.bands.filter ? [`bands:filter:${style.bands.filter}`] : []
  };
}

export function resolveOceanDepthLimits(value: string, cellTypes: ArrayLike<number>): number[] {
  if (value === "none" || !value.trim()) return [];
  if (value !== "random") {
    return [
      ...new Set(
        value
          .split(",")
          .map(Number)
          .filter(depth => Number.isInteger(depth) && depth < 0 && depth >= -9)
      )
    ].sort((left, right) => left - right);
  }

  let seed = 2166136261;
  for (let index = 0; index < cellTypes.length; index++) seed = Math.imul(seed ^ (cellTypes[index] + 17), 16777619);
  const random = () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489917);
    return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
  };
  const limits: number[] = [];
  let probability = 0.2;
  for (let depth = -9; depth < 0; depth++) {
    if (random() < probability) {
      limits.push(depth);
      probability = 0.2;
    } else probability = Math.min(1, probability * 2);
  }
  return limits.length ? limits : [-1];
}

function buildDepthPaths(source: OceanDepthSource, bounds: MapBounds, limits: readonly number[]): Map<number, string> {
  const { cells, vertices } = source;
  const selected = new Set(limits);
  const used = new Uint8Array(cells.i.length);
  const lineGenerator = line<readonly [number, number]>().curve(curveBasisClosed);
  const paths = new Map<number, string>();

  for (const cellId of cells.i) {
    const depth = cells.t[cellId];
    if (depth > 0 || used[cellId] || !selected.has(depth)) continue;
    const start = findStartVertex(cellId, depth, cells, vertices);
    if (start === undefined) continue;
    used[cellId] = 1;
    const chain = connectVertices(start, depth, cells, vertices, used);
    if (chain.length < 4) continue;
    const relax = 1 + depth * -2;
    const relaxed = chain.filter(
      (vertexId, index) => index % relax === 0 || vertices.c[vertexId].some(adjacent => adjacent >= cells.i.length)
    );
    if (relaxed.length < 4) continue;
    const points = clipPoly(
      relaxed.map(vertexId => vertices.p[vertexId]),
      bounds.width,
      bounds.height
    ) as [number, number][];
    const path = lineGenerator(points);
    if (path) paths.set(depth, `${paths.get(depth) ?? ""}${path}`);
  }
  return paths;
}

function findStartVertex(
  cellId: number,
  depth: number,
  cells: OceanDepthSource["cells"],
  vertices: OceanDepthSource["vertices"]
): number | undefined {
  if (cells.b[cellId]) {
    return cells.v[cellId].find(vertexId => vertices.c[vertexId].some(adjacent => adjacent >= cells.i.length));
  }
  const neighborIndex = cells.c[cellId].findIndex(neighbor => cells.t[neighbor] < depth || !cells.t[neighbor]);
  return neighborIndex >= 0 ? cells.v[cellId][neighborIndex] : undefined;
}

function connectVertices(
  start: number,
  depth: number,
  cells: OceanDepthSource["cells"],
  vertices: OceanDepthSource["vertices"],
  used: Uint8Array
): number[] {
  const chain: number[] = [];
  let current = start;
  for (let index = 0; index === 0 || (current !== start && index < vertices.c.length); index++) {
    const previous = chain.at(-1);
    chain.push(current);
    const adjacentCells = vertices.c[current];
    for (const cellId of adjacentCells) if (cellId < cells.i.length && cells.t[cellId] === depth) used[cellId] = 1;
    const previousDepth = adjacentCells.map(cellId => !cells.t[cellId] || cells.t[cellId] === depth - 1);
    const neighbors = vertices.v[current];
    const next =
      neighbors[0] !== undefined && neighbors[0] !== previous && previousDepth[0] !== previousDepth[1]
        ? neighbors[0]
        : neighbors[1] !== undefined && neighbors[1] !== previous && previousDepth[1] !== previousDepth[2]
          ? neighbors[1]
          : neighbors[2] !== undefined && neighbors[2] !== previous && previousDepth[0] !== previousDepth[2]
            ? neighbors[2]
            : current;
    if (next === current) break;
    current = next;
  }
  chain.push(chain[0]);
  return chain;
}
