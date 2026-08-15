import Alea from "alea";
import Delaunator from "delaunator";
import { Voronoi, type Cells, type Point, type Vertices } from "./voronoi";

export interface GridBuildRequest {
  seed: string;
  graphWidth: number;
  graphHeight: number;
  cellsDesired: number;
}

export interface GeneratedGrid {
  spacing: number;
  cellsDesired: number;
  boundary: Point[];
  points: Point[];
  cellsX: number;
  cellsY: number;
  seed: string;
  cells: Cells;
  vertices: Vertices;
}

const round = (value: number, digits = 0): number => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

export function buildGrid({ seed, graphWidth, graphHeight, cellsDesired }: GridBuildRequest): GeneratedGrid {
  const random = Alea(seed);
  const spacing = round(Math.sqrt((graphWidth * graphHeight) / cellsDesired), 2);
  const boundary = getBoundaryPoints(graphWidth, graphHeight, spacing);
  const points = getJitteredGrid(graphWidth, graphHeight, spacing, random);
  const cellsX = Math.floor((graphWidth + 0.5 * spacing - 1e-10) / spacing);
  const cellsY = Math.floor((graphHeight + 0.5 * spacing - 1e-10) / spacing);
  const { cells, vertices } = buildVoronoi(points, boundary);
  return { spacing, cellsDesired, boundary, points, cellsX, cellsY, seed, cells, vertices };
}

function getBoundaryPoints(width: number, height: number, spacing: number): Point[] {
  const offset = round(-spacing);
  const boundarySpacing = spacing * 2;
  const expandedWidth = width - offset * 2;
  const expandedHeight = height - offset * 2;
  const pointsX = Math.ceil(expandedWidth / boundarySpacing) - 1;
  const pointsY = Math.ceil(expandedHeight / boundarySpacing) - 1;
  const boundary: Point[] = [];

  for (let x = 0.5; x < pointsX; x++) {
    const coordinate = Math.ceil((expandedWidth * x) / pointsX + offset);
    boundary.push([coordinate, offset], [coordinate, expandedHeight + offset]);
  }
  for (let y = 0.5; y < pointsY; y++) {
    const coordinate = Math.ceil((expandedHeight * y) / pointsY + offset);
    boundary.push([offset, coordinate], [expandedWidth + offset, coordinate]);
  }
  return boundary;
}

function getJitteredGrid(width: number, height: number, spacing: number, random: () => number): Point[] {
  const radius = spacing / 2;
  const jittering = radius * 0.9;
  const points: Point[] = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      points.push([Math.min(round(x + random() * jittering * 2 - jittering, 2), width), Math.min(round(y + random() * jittering * 2 - jittering, 2), height)]);
    }
  }
  return points;
}

function buildVoronoi(points: Point[], boundary: Point[]): { cells: Cells; vertices: Vertices } {
  const allPoints = points.concat(boundary);
  const voronoi = new Voronoi(Delaunator.from(allPoints), allPoints, points.length);
  const CellsIndex = points.length <= 65535 ? Uint16Array : Uint32Array;
  const indexes = new CellsIndex(points.length);
  for (let i = 0; i < indexes.length; i++) indexes[i] = i;
  voronoi.cells.i = indexes;
  return { cells: voronoi.cells, vertices: voronoi.vertices };
}
