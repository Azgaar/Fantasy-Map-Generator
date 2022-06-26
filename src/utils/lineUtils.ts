import {polygon} from "lineclip";

// clip polygon by graph bbox
export function clipPoly(points: TPoints) {
  // @ts-expect-error graphWidth/graphWidth are global variables
  return polygon(points, [0, 0, graphWidth, graphWidth]);
}

// get segment of any point on polyline
export function getSegmentId(points: TPoints, point: TPoint, step = 10) {
  if (points.length === 2) return 1;
  const d2 = (p1: TPoint, p2: TPoint) => (p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2;

  let minSegment = 1;
  let minDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const length = Math.sqrt(d2(p1, p2));
    const segments = Math.ceil(length / step);
    const dx = (p2[0] - p1[0]) / segments;
    const dy = (p2[1] - p1[1]) / segments;

    for (let s = 0; s < segments; s++) {
      const x = p1[0] + s * dx;
      const y = p1[1] + s * dy;
      const dist2 = d2(point, [x, y]);

      if (dist2 >= minDist) continue;
      minDist = dist2;
      minSegment = i + 1;
    }
  }

  return minSegment;
}

// return center point of common edge of 2 pack cells
export function getMiddlePoint(cell1: number, cell2: number) {
  // @ts-expect-error pack is global variable
  const {cells, vertices} = pack;

  const commonVertices = cells.v[cell1].filter((vertex: number) =>
    vertices.c[vertex].some((cellId: number) => cellId === cell2)
  );

  const [x1, y1] = vertices.p[commonVertices[0]];
  const [x2, y2] = vertices.p[commonVertices[1]];

  const x = (x1 + x2) / 2;
  const y = (y1 + y2) / 2;

  return [x, y];
}
