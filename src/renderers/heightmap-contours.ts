import { curveBasis, curveBasisClosed, line } from "d3";
import type { Point } from "@/types/global";

interface Crossing {
  point: Point;
  neighbors: string[];
}

export interface HeightContour {
  height: number;
  major: boolean;
  path: string;
}

export interface HeightContourChain {
  height: number;
  closed: boolean;
  points: Point[];
}

/** Remove single-cell steps from the displayed surface without changing terrain data. */
export function smoothContourHeights(heights: ArrayLike<number>, neighbors: number[][]): Float64Array {
  return Float64Array.from(heights, (height, i) => {
    const adjacent = neighbors[i];
    if (!adjacent.length) return height;
    const mean = adjacent.reduce((sum, cell) => sum + heights[cell], 0) / adjacent.length;
    return (height + mean) / 2;
  });
}

/** Smooth contour paths from the chains, every fifth level flagged as major */
export function getHeightContours(
  points: Point[],
  heights: ArrayLike<number>,
  triangles: number[][],
  thresholds: number[],
  interval: number
): HeightContour[] {
  const openLine = line<Point>().curve(curveBasis);
  const closedLine = line<Point>().curve(curveBasisClosed);
  const chains = getHeightContourChains(points, heights, triangles, thresholds);

  return thresholds
    .map(height => {
      const path = chains
        .filter(chain => chain.height === height)
        .map(({ closed, points }) => (closed ? `${closedLine(points)}Z` : openLine(points)))
        .join("");
      return { height, major: Math.round((height - 20) / interval) % 5 === 0, path };
    })
    .filter(contour => contour.path);
}

/** March the Delaunay triangles, interpolating heights along their shared edges */
export function getHeightContourChains(
  points: Point[],
  heights: ArrayLike<number>,
  triangles: number[][],
  thresholds: number[]
): HeightContourChain[] {
  return thresholds.flatMap(height => {
    const crossings = new Map<string, Crossing>();
    for (const triangle of triangles) {
      const above = heights[triangle[0]] >= height;
      if (above === heights[triangle[1]] >= height && above === heights[triangle[2]] >= height) continue;
      const edges: string[] = [];
      for (let i = 0; i < 3; i++) {
        const a = triangle[i];
        const b = triangle[(i + 1) % 3];
        if (heights[a] >= height === heights[b] >= height) continue;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (!crossings.has(key)) {
          const ratio = (height - heights[a]) / (heights[b] - heights[a]);
          const point: Point = [
            points[a][0] + (points[b][0] - points[a][0]) * ratio,
            points[a][1] + (points[b][1] - points[a][1]) * ratio
          ];
          crossings.set(key, { point, neighbors: [] });
        }
        edges.push(key);
      }
      if (edges.length !== 2) continue;
      crossings.get(edges[0])!.neighbors.push(edges[1]);
      crossings.get(edges[1])!.neighbors.push(edges[0]);
    }

    const visited = new Set<string>();
    const chains: HeightContourChain[] = [];
    function trace(start: string): void {
      const chain: Point[] = [];
      let current: string | undefined = start;
      let closed = false;
      while (current !== undefined && !visited.has(current)) {
        visited.add(current);
        const crossing: Crossing = crossings.get(current)!;
        chain.push(crossing.point);
        const next: string | undefined = crossing.neighbors.find(key => !visited.has(key));
        closed = next === undefined && chain.length > 2 && crossing.neighbors.includes(start);
        current = next;
      }
      if (chain.length >= 2) chains.push({ height, closed, points: chain });
    }

    // Start open chains at their endpoints; otherwise a midpoint would split them in two.
    for (const [key, crossing] of crossings) {
      if (crossing.neighbors.length === 1 && !visited.has(key)) trace(key);
    }
    for (const key of crossings.keys()) {
      if (!visited.has(key)) trace(key);
    }
    return chains;
  });
}
