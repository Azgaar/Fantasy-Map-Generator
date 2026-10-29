import { curveBasis, curveBasisClosed, line } from "d3";
import { CONTOUR_INTERVALS } from "@/data/style-choices";
import type { Point } from "@/types/global";
import { SEA_LEVEL } from "@/utils/height-utils";

const MAJOR_EVERY = 5; // every fifth level is heavier and labeled

interface Crossing {
  point: Point;
  neighbors: string[];
}

/** A contour elevation: the generator height it is traced at and the round value in user units it shows */
export interface ContourLevel {
  height: number;
  value: number;
  major: boolean;
}

interface HeightContour {
  height: number;
  major: boolean;
  path: string;
}

interface HeightContourChain {
  height: number;
  closed: boolean;
  points: Point[];
}

export interface ContourLabel {
  x: number;
  y: number;
  angle: number;
  text: string;
  width: number;
}

/**
 * Levels every `step` user units from sea level up to the extreme value, a height or a depth
 * @param toHeight - generator height of a value in the user unit, a height for land or a depth for water
 */
export function getContourLevels(step: number, extreme: number, toHeight: (value: number) => number): ContourLevel[] {
  const direction = Math.sign(toHeight(extreme) - SEA_LEVEL);
  const levels: ContourLevel[] = [];
  for (let i = 1; i * step <= extreme; i++) {
    const height = toHeight(i * step);
    if ((height - SEA_LEVEL) * direction > 0) levels.push({ height, value: i * step, major: i % MAJOR_EVERY === 0 });
  }
  return levels;
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

/** The offered interval drawing closest to `count` levels up to the extreme value */
export function getContourInterval(count: number, extreme: number): number {
  const target = Math.log(extreme / Math.max(count, 1));
  const distance = (interval: number) => Math.abs(Math.log(interval) - target);
  return CONTOUR_INTERVALS.reduce((best, interval) => (distance(interval) < distance(best) ? interval : best));
}

/** One smooth path per level from its chains */
export function getHeightContours(chains: HeightContourChain[], levels: ContourLevel[]): HeightContour[] {
  const openLine = line<Point>().curve(curveBasis);
  const closedLine = line<Point>().curve(curveBasisClosed);

  return levels
    .map(({ height, major }) => {
      const path = chains
        .filter(chain => chain.height === height)
        .map(({ closed, points }) => (closed ? `${closedLine(points)}Z` : openLine(points)))
        .join("");
      return { height, major, path };
    })
    .filter(contour => contour.path);
}

interface LabelOptions {
  size: number; // font size
  spacing: number; // distance along a line between its labels
  heightAt: (x: number, y: number) => number; // surface elevation, to turn label tops uphill
  probe: number; // how far across the line the elevation is compared
}

/**
 * Labels along the major contours, as on a topographic map: the text follows a straight stretch of
 * the line, its top facing uphill, and keeps clear of the labels already placed
 */
export function getContourLabels(
  chains: HeightContourChain[],
  levels: ContourLevel[],
  { size, spacing, heightAt, probe }: LabelOptions
): ContourLabel[] {
  const texts = new Map(levels.filter(level => level.major).map(level => [level.height, String(level.value)]));
  const labels: ContourLabel[] = [];
  const isClear = (x: number, y: number, width: number) =>
    labels.every(label => Math.hypot(label.x - x, label.y - y) > (label.width + width) / 2 + size);

  const majors = chains.filter(chain => texts.has(chain.height)).map(chain => ({ chain, line: measure(chain) }));
  majors.sort((a, b) => b.line.length - a.line.length); // the longest lines get their labels first

  for (const { chain, line } of majors) {
    const text = texts.get(chain.height)!;
    const width = text.length * size * 0.6;
    if (line.length < width * 4) continue; // too small a loop to carry a label

    const count = Math.max(1, Math.floor(line.length / spacing));
    for (let i = 0; i < count; i++) {
      const target = ((i + 0.5) * line.length) / count;
      // nudge along the line to a straight, uncrowded stretch
      for (const shift of [0, width, -width, 2 * width, -2 * width]) {
        const at = target + shift;
        if (!chain.closed && (at < width || at > line.length - width)) continue;
        const [x0, y0] = line.pointAt(at - width / 2);
        const [x1, y1] = line.pointAt(at + width / 2);
        if (Math.hypot(x1 - x0, y1 - y0) < width * 0.9) continue; // the line bends under the text
        const [x, y] = line.pointAt(at);
        if (!isClear(x, y, width)) continue;

        let angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
        const ux = (y1 - y0) / width; // the text's up direction, on screen
        const uy = -(x1 - x0) / width;
        if (heightAt(x + ux * probe, y + uy * probe) < heightAt(x - ux * probe, y - uy * probe)) angle += 180;
        if (angle > 180) angle -= 360;

        labels.push({ x, y, angle, text, width });
        break;
      }
    }
  }
  return labels;
}

// a chain as a polyline that can be walked by distance, wrapping around a closed one
function measure({ points, closed }: HeightContourChain) {
  const path = closed ? [...points, points[0]] : points;
  const distances = [0];
  for (let i = 1; i < path.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  }
  const length = distances.at(-1)!;

  const pointAt = (distance: number): Point => {
    const d = closed ? ((distance % length) + length) % length : Math.min(Math.max(distance, 0), length);
    let i = 1;
    while (i < distances.length - 1 && distances[i] < d) i++;
    const span = distances[i] - distances[i - 1] || 1;
    const ratio = (d - distances[i - 1]) / span;
    return [
      path[i - 1][0] + (path[i][0] - path[i - 1][0]) * ratio,
      path[i - 1][1] + (path[i][1] - path[i - 1][1]) * ratio
    ];
  };

  return { length, pointAt };
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
