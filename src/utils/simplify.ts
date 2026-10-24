// Polyline simplification, ported from mourner/simplify-js (BSD-2-Clause)
type Point = [number, number];

function getSqDist([x1, y1]: Point, [x2, y2]: Point): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSqSegDist([x1, y1]: Point, [x, y]: Point, [x2, y2]: Point): number {
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

function simplifyRadialDist(points: Point[], sqTolerance: number): Point[] {
  let prevPoint = points[0];
  const newPoints = [prevPoint];
  let point: Point | undefined;

  for (let i = 1; i < points.length; i++) {
    point = points[i];
    if (!point) continue;
    if (getSqDist(point, prevPoint) > sqTolerance) {
      newPoints.push(point);
      prevPoint = point;
    }
  }

  if (point && prevPoint !== point) newPoints.push(point);
  return newPoints;
}

function simplifyDPStep(points: Point[], first: number, last: number, sqTolerance: number, simplified: Point[]) {
  let maxSqDist = sqTolerance;
  let index = first;

  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

// Ramer-Douglas-Peucker
function simplifyDouglasPeucker(points: Point[], sqTolerance: number): Point[] {
  const last = points.length - 1;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);
  return simplified;
}

/** Radial-distance pass, then Douglas-Peucker; `highestQuality` skips the radial pass */
export function simplify(points: Point[], tolerance: number, highestQuality = false): Point[] {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const radial = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
  return simplifyDouglasPeucker(radial, sqTolerance);
}
