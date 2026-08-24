import type { CurveFactory } from "d3";
import {
  color,
  curveBasis,
  curveBasisClosed,
  curveBasisOpen,
  curveCardinal,
  curveCardinalClosed,
  curveCardinalOpen,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveCatmullRomOpen,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  interpolateGreens,
  interpolateGreys,
  interpolateRdYlGn,
  interpolateRgbBasis,
  interpolateSpectral,
  line,
  scaleSequential
} from "d3";
import type { Grid } from "@/types/grid";
import type { SceneBounds, SceneRevision } from "../primitives";
import type { HeightBandStyle, HeightLayerStyle } from "../styles";
import type { MapBounds } from "./feature-shapes";

const CURVES: Readonly<Record<string, CurveFactory>> = {
  curveBasis,
  curveBasisClosed,
  curveBasisOpen,
  curveCardinal,
  curveCardinalClosed,
  curveCardinalOpen,
  curveCatmullRom,
  curveCatmullRomClosed,
  curveCatmullRomOpen,
  curveLinear,
  curveLinearClosed,
  curveMonotoneX,
  curveMonotoneY,
  curveNatural,
  curveStep,
  curveStepAfter,
  curveStepBefore
};

const COLOR_SCHEMES: Readonly<Record<string, (value: number) => string>> = {
  bright: scaleSequential(interpolateSpectral),
  green: scaleSequential(interpolateGreens),
  light: scaleSequential(interpolateRdYlGn),
  livid: scaleSequential(interpolateRgbBasis(["#BBBBDD", "#2A3440", "#17343B", "#0A1E24"])),
  monochrome: scaleSequential(interpolateGreys),
  natural: scaleSequential(interpolateRgbBasis(["white", "#EEEECC", "tan", "green", "teal"])),
  olive: scaleSequential(interpolateRgbBasis(["#ffffff", "#cea48d", "#d5b085", "#0c2c19", "#151320"]))
};

export interface HeightContourBand {
  color: string;
  height: number;
  path: string;
  terraceColor: string | null;
}

export interface HeightContourGroup {
  bands: readonly HeightContourBand[];
  baseColor: string | null;
  filter: string | null;
  opacity: number;
  scope: "land" | "ocean";
}

export interface HeightContourScene {
  bounds: SceneBounds;
  groups: readonly [HeightContourGroup, HeightContourGroup];
  layer: "height";
  revision: SceneRevision;
  unsupportedEffects: readonly string[];
}

export interface HeightContourSource {
  cells: Pick<Grid["cells"], "c" | "h" | "i" | "v">;
  vertices: Pick<Grid["vertices"], "c" | "p" | "v">;
}

export function buildHeightContourScene(
  source: HeightContourSource,
  mapBounds: MapBounds,
  style: HeightLayerStyle,
  revision: SceneRevision = 0
): HeightContourScene {
  if (mapBounds.width <= 0 || mapBounds.height <= 0) {
    throw new Error(`Invalid height contour bounds: ${mapBounds.width}x${mapBounds.height}`);
  }

  const paths = buildContourPaths(source, style);
  const ocean = buildGroup(
    "ocean",
    style.ocean,
    paths,
    style.ocean.render ? getHeightColor(0, style.ocean.scheme) : null
  );
  const land = buildGroup("land", style.land, paths, getHeightColor(20, style.land.scheme));
  const unsupportedEffects = [
    ...(style.ocean.filter ? [`ocean:filter:${style.ocean.filter}`] : []),
    ...(style.land.filter ? [`land:filter:${style.land.filter}`] : [])
  ];

  return {
    bounds: { maxX: mapBounds.width, maxY: mapBounds.height, minX: 0, minY: 0 },
    groups: [ocean, land],
    layer: "height",
    revision,
    unsupportedEffects
  };
}

export function getHeightColor(height: number, schemeName = "bright"): string {
  const scheme = getHeightColorScheme(schemeName);
  return scheme(1 - (height < 20 ? height - 5 : height) / 100);
}

export function getHeightColorScheme(name: string): (value: number) => string {
  if (COLOR_SCHEMES[name]) return COLOR_SCHEMES[name];
  const stops = name
    .split(",")
    .map(stop => stop.trim())
    .filter(Boolean);
  return scaleSequential(interpolateRgbBasis(stops.length > 1 ? stops : ["#ffffff", "#000000"]));
}

function buildGroup(
  scope: HeightContourGroup["scope"],
  style: HeightBandStyle,
  paths: readonly (string | undefined)[],
  baseColor: string | null
): HeightContourGroup {
  const bands: HeightContourBand[] = [];
  const start = scope === "ocean" ? 0 : 20;
  const end = scope === "ocean" ? 19 : 100;
  const terracing = Math.max(0, style.terracing) / 10;
  for (let height = start; height <= end; height++) {
    const path = paths[height];
    if (!path || path.length < 10) continue;
    const fill = getHeightColor(height, style.scheme);
    bands.push({
      color: fill,
      height,
      path,
      terraceColor: terracing ? (color(fill)?.darker(terracing).toString() ?? fill) : null
    });
  }
  return { bands, baseColor, filter: style.filter, opacity: style.opacity, scope };
}

function buildContourPaths(
  { cells, vertices }: HeightContourSource,
  style: HeightLayerStyle
): readonly (string | undefined)[] {
  const paths: (string | undefined)[] = new Array(101);
  const used = new Uint8Array(cells.i.length);
  const heights = orderCellsByHeight(cells.i, cells.h);
  appendScopePaths("ocean", style.ocean, heights, cells, vertices, used, paths);
  appendScopePaths("land", style.land, heights, cells, vertices, used, paths);
  return paths;
}

function orderCellsByHeight(cellIds: ArrayLike<number>, heights: ArrayLike<number>): number[] {
  const buckets = Array.from({ length: 101 }, () => [] as number[]);
  for (let index = 0; index < cellIds.length; index++) {
    const cellId = Number(cellIds[index]);
    buckets[Math.max(0, Math.min(100, Number(heights[cellId]) || 0))].push(cellId);
  }
  return buckets.flat();
}

function appendScopePaths(
  scope: "land" | "ocean",
  style: HeightBandStyle,
  heights: readonly number[],
  cells: HeightContourSource["cells"],
  vertices: HeightContourSource["vertices"],
  used: Uint8Array,
  paths: (string | undefined)[]
): void {
  if (scope === "ocean" && !("render" in style && style.render)) return;
  const skip = Math.max(0, Number(style.skip) || 0) + 1;
  const lineGenerator = line<readonly [number, number]>().curve(CURVES[style.curve] ?? curveBasisClosed);
  let currentLayer = scope === "ocean" ? 0 : 20;

  for (const cellId of heights) {
    const height = cells.h[cellId];
    if (height > currentLayer) currentLayer += skip;
    if (height < currentLayer) continue;
    if ((scope === "ocean" && currentLayer >= 20) || (scope === "land" && currentLayer > 100)) break;
    if (used[cellId] || !cells.c[cellId].some(neighbor => cells.h[neighbor] < height)) continue;
    const startVertex = cells.v[cellId].find(vertexId =>
      vertices.c[vertexId].some(neighbor => neighbor >= cells.i.length || cells.h[neighbor] < height)
    );
    if (startVertex === undefined) continue;
    const chain = connectVertices(cells, vertices, startVertex, height, used);
    if (chain.length < 3) continue;
    const simplification = Math.max(0, Math.floor(style.relax)) + 1;
    const points = chain
      .filter((_vertex, index) => index % simplification === 0)
      .map(vertexId => vertices.p[vertexId] as readonly [number, number]);
    const path = lineGenerator(points);
    if (path) paths[height] = `${paths[height] ?? ""}${path}`;
  }
}

function connectVertices(
  cells: HeightContourSource["cells"],
  vertices: HeightContourSource["vertices"],
  start: number,
  height: number,
  used: Uint8Array
): number[] {
  const chain: number[] = [];
  const cellCount = cells.i.length;
  for (let index = 0, current = start; index === 0 || (current !== start && index < vertices.c.length); index++) {
    const previous = chain.at(-1);
    chain.push(current);
    const adjacentCells = vertices.c[current];
    for (const cellId of adjacentCells) if (cellId < cellCount && cells.h[cellId] === height) used[cellId] = 1;
    const below = adjacentCells.map(cellId => cellId >= cellCount || cells.h[cellId] < height);
    const neighbors = vertices.v[current];
    const next =
      neighbors[0] !== previous && below[0] !== below[1]
        ? neighbors[0]
        : neighbors[1] !== previous && below[1] !== below[2]
          ? neighbors[1]
          : neighbors[2] !== previous && below[0] !== below[2]
            ? neighbors[2]
            : current;
    if (next === current || next === undefined) break;
    current = next;
  }
  return chain;
}
