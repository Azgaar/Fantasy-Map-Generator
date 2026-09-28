// Geometry on a map whose west and east edges meet: coordinates stay in [0, width), neighbors may sit across the seam
import type { Point } from "@/types/global";
import { clipPoly } from "./commonUtils";

/** width of the band joined into a cylinder, 0 for a flat map */
export const getWrapWidth = (): number => (typeof grid !== "undefined" && grid?.wrap ? grid.cellsX * grid.spacing : 0);

/** x moved to its image nearest to the reference x */
export const nearX = (x: number, refX: number, width = getWrapWidth()): number =>
  width ? x - Math.round((x - refX) / width) * width : x;

/** point moved to its image nearest to the reference x */
export const nearPoint = ([x, y]: Point, refX: number, width = getWrapWidth()): Point => [nearX(x, refX, width), y];

/** x moved into the map */
export const wrapX = (x: number, width = getWrapWidth()): number => (width ? x - Math.floor(x / width) * width : x);

/** points of a polygon or line made continuous: each one at its image nearest to the previous one */
export function unwrapPoints<T extends number[]>(points: T[], width = getWrapWidth(), refX = points[0]?.[0]): T[] {
  if (!width || !points.length) return points;
  let prevX = refX;
  return points.map(point => {
    if (!point) return point; // gaps stay gaps
    prevX = nearX(point[0], prevX, width);
    return shiftX(point, prevX - point[0]);
  });
}

const shiftX = <T extends number[]>(point: T, shift: number): T => {
  const shifted = point.slice() as T;
  shifted[0] += shift;
  return shifted;
};

/** a continuous shape plus its copies shifted a map width back for the parts that stick out over the edges */
export function getWrappedCopies<T extends number[]>(points: T[], width = getWrapWidth()): T[][] {
  if (!width || !points.length) return [points];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const [x] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }

  const copies = [points];
  for (const shift of [-width, width]) {
    if (maxX + shift > 0 && minX + shift < width) copies.push(points.map(point => shiftX(point, shift)));
  }
  return copies;
}

/** a closed ring made continuous. A ring around the cylinder is closed through the far north: with its pair
 * running the other way, it fills the band between them under both fill rules */
export function unwrapRing(points: Point[], width = getWrapWidth()): Point[] {
  const ring = unwrapPoints(points, width);
  if (!width || ring.length < 2) return ring;

  const [firstX] = ring[0];
  const [lastX] = ring[ring.length - 1];
  if (Math.abs(lastX - firstX) < width / 2) return ring;
  return [...ring, [lastX, -width], [firstX, -width]];
}

/** a ring made continuous and clipped to the map; on a wrapped map only the north and south edges clip */
export function clipToMap(points: Point[], secure?: number, width = getWrapWidth()): Point[] {
  const { height } = options.map.graph;
  if (!width) return clipPoly(points, options.map.graph.width, height, secure);
  return clipPoly(unwrapRing(points, width), width * 2, height, secure, -width);
}
