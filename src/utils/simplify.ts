/**
 * A typed adaptation of Simplify.js by Vladimir Agafonkin.
 * https://github.com/mourner/simplify-js (BSD-2-Clause)
 */

export type PolylinePoint = [number, number];

export function simplifyPolyline(
  points: readonly PolylinePoint[],
  tolerance: number,
  highestQuality = false
): PolylinePoint[] {
  if (points.length <= 2) return points.map(([x, y]) => [x, y]);

  const squareTolerance = tolerance * tolerance;
  const radial = highestQuality ? [...points] : simplifyRadialDistance(points, squareTolerance);
  return simplifyDouglasPeucker(radial, squareTolerance);
}

function getSquareDistance([x1, y1]: PolylinePoint, [x2, y2]: PolylinePoint): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

function getSquareSegmentDistance([x1, y1]: PolylinePoint, [x, y]: PolylinePoint, [x2, y2]: PolylinePoint): number {
  let dx = x2 - x;
  let dy = y2 - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((x1 - x) * dx + (y1 - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = x2;
      y = y2;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = x1 - x;
  dy = y1 - y;
  return dx * dx + dy * dy;
}

function simplifyRadialDistance(points: readonly PolylinePoint[], squareTolerance: number): PolylinePoint[] {
  let previous = points[0];
  const simplified = [previous];
  let point = previous;

  for (let index = 1; index < points.length; index++) {
    point = points[index];
    if (getSquareDistance(point, previous) <= squareTolerance) continue;
    simplified.push(point);
    previous = point;
  }

  if (previous !== point) simplified.push(point);
  return simplified;
}

function simplifyDouglasPeucker(points: readonly PolylinePoint[], squareTolerance: number): PolylinePoint[] {
  const last = points.length - 1;
  const simplified = [points[0]];
  simplifyDouglasPeuckerStep(points, 0, last, squareTolerance, simplified);
  simplified.push(points[last]);
  return simplified;
}

function simplifyDouglasPeuckerStep(
  points: readonly PolylinePoint[],
  first: number,
  last: number,
  squareTolerance: number,
  simplified: PolylinePoint[]
): void {
  let maxSquareDistance = squareTolerance;
  let furthestIndex = first;

  for (let index = first + 1; index < last; index++) {
    const squareDistance = getSquareSegmentDistance(points[index], points[first], points[last]);
    if (squareDistance <= maxSquareDistance) continue;
    furthestIndex = index;
    maxSquareDistance = squareDistance;
  }

  if (maxSquareDistance <= squareTolerance) return;
  if (furthestIndex - first > 1) {
    simplifyDouglasPeuckerStep(points, first, furthestIndex, squareTolerance, simplified);
  }
  simplified.push(points[furthestIndex]);
  if (last - furthestIndex > 1) {
    simplifyDouglasPeuckerStep(points, furthestIndex, last, squareTolerance, simplified);
  }
}
