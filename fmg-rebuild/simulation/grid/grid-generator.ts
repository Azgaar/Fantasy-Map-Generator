import Delaunator from "delaunator";
import { Grid, GridCells, GridVertices } from "../../core/types";
import { createPRNG, PRNG } from "../../core/random";

// Round number to decimals
function rn(n: number, decimals = 2): number {
  return parseFloat(n.toFixed(decimals));
}

// Generate boundary points on a regular square grid
export function getBoundaryPoints(width: number, height: number, spacing: number): [number, number][] {
  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  const points: [number, number][] = [];

  for (let i = 0.5; i < numberX; i++) {
    const x = Math.ceil((w * i) / numberX + offset);
    points.push([x, offset], [x, h + offset]);
  }

  for (let i = 0.5; i < numberY; i++) {
    const y = Math.ceil((h * i) / numberY + offset);
    points.push([offset, y], [w + offset, y]);
  }

  return points;
}

// Generate points on a jittered square grid
export function getJitteredGrid(width: number, height: number, spacing: number, rng: PRNG): [number, number][] {
  const radius = spacing / 2;
  const jittering = radius * 0.9;
  const doubleJittering = jittering * 2;
  const jitter = () => rng() * doubleJittering - jittering;

  const points: [number, number][] = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      const xj = Math.min(rn(x + jitter(), 2), width);
      const yj = Math.min(rn(y + jitter(), 2), height);
      points.push([xj, yj]);
    }
  }
  return points;
}

// Calculate the circumcenter of three points
export function circumcenter(
  a: [number, number],
  b: [number, number],
  c: [number, number]
): [number, number] {
  const [ax, ay] = a;
  const [bx, by] = b;
  const [cx, cy] = c;
  const ad = ax * ax + ay * ay;
  const bd = bx * bx + by * by;
  const cd = cx * cx + cy * cy;
  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-9) {
    return [rn((ax + bx + cx) / 3), rn((ay + by + cy) / 3)];
  }
  return [
    Math.floor((1 / D) * (ad * (by - cy) + bd * (cy - ay) + cd * (ay - by))),
    Math.floor((1 / D) * (ad * (cx - bx) + bd * (ax - cx) + cd * (bx - ax)))
  ];
}

export function buildVoronoi(
  points: [number, number][],
  boundary: [number, number][],
  pointsN: number
): { cells: GridCells; vertices: GridVertices } {
  const allPoints = points.concat(boundary);
  const delaunay = Delaunator.from(allPoints);

  const nextHalfedge = (e: number) => (e % 3 === 2 ? e - 2 : e + 1);
  const triangleOfEdge = (e: number) => Math.floor(e / 3);
  const edgesOfTriangle = (t: number): [number, number, number] => [3 * t, 3 * t + 1, 3 * t + 2];
  const pointsOfTriangle = (t: number): [number, number, number] => {
    return edgesOfTriangle(t).map(e => delaunay.triangles[e]) as [number, number, number];
  };

  const edgesAroundPoint = (start: number): number[] => {
    const result: number[] = [];
    let incoming = start;
    do {
      result.push(incoming);
      const outgoing = nextHalfedge(incoming);
      incoming = delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start && result.length < 20);
    return result;
  };

  const trianglesAdjacentToTriangle = (t: number): number[] => {
    return edgesOfTriangle(t).map(e => triangleOfEdge(delaunay.halfedges[e]));
  };

  const cellsV: number[][] = [];
  const cellsC: number[][] = [];
  const cellsB = new Uint8Array(pointsN);
  const cellsI = new Uint32Array(pointsN);

  for (let i = 0; i < pointsN; i++) {
    cellsI[i] = i;
  }

  const verticesP: [number, number][] = [];
  const verticesC: number[][] = [];
  const verticesV: number[][] = [];

  for (let e = 0; e < delaunay.triangles.length; e++) {
    const p = delaunay.triangles[nextHalfedge(e)];
    if (p < pointsN && !cellsC[p]) {
      const edges = edgesAroundPoint(e);
      cellsV[p] = edges.map(e => triangleOfEdge(e));
      cellsC[p] = edges.map(e => delaunay.triangles[e]).filter(c => c < pointsN);
      cellsB[p] = edges.length > cellsC[p].length ? 1 : 0;
    }

    const t = triangleOfEdge(e);
    if (!verticesP[t]) {
      const pts = pointsOfTriangle(t).map(idx => allPoints[idx]);
      verticesP[t] = circumcenter(pts[0] as [number, number], pts[1] as [number, number], pts[2] as [number, number]);
      verticesV[t] = trianglesAdjacentToTriangle(t);
      verticesC[t] = pointsOfTriangle(t);
    }
  }

  return {
    cells: {
      i: cellsI,
      v: cellsV,
      c: cellsC,
      b: cellsB
    },
    vertices: {
      p: verticesP,
      c: verticesC,
      v: verticesV
    }
  };
}

export function generateJitteredGrid(
  width: number,
  height: number,
  cellsDesired: number,
  seed: string
): Grid {
  const rng = createPRNG(seed);
  const spacing = rn(Math.sqrt((width * height) / cellsDesired), 2);
  const boundary = getBoundaryPoints(width, height, spacing);
  const points = getJitteredGrid(width, height, spacing, rng);

  const cellCountX = Math.floor((width + 0.5 * spacing - 1e-10) / spacing);
  const cellCountY = Math.floor((height + 0.5 * spacing - 1e-10) / spacing);

  const { cells, vertices } = buildVoronoi(points, boundary, points.length);

  return {
    cellsDesired,
    spacing,
    cellsX: cellCountX,
    cellsY: cellCountY,
    points,
    boundary,
    cells,
    vertices
  };
}
