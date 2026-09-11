import { polygonArea } from "d3";
import { GraphOverride } from "@/generators/graph-override";
import type { Point } from "@/types/global";
import { minmax } from "@/utils";

const BUDGET = 3; // a vertex may travel this far relative to its average original edge
const AREA_MARGIN = 0.25; // a cell keeps at least this share of the area it had when the stroke started
const FRAME = 0.5; // vertices stay this far inside the map frame

/** movable vertices within the radius: inside the brush and off the map frame */
export function findVertices(center: Point, radius: number): number[] {
  const { vertices, cells } = pack;
  const { width, height } = options.map.graph;

  const found = new Set<number>();
  for (const cellId of Pack.findAll(center[0], center[1], radius + grid.spacing * 2)) {
    for (const id of cells.v[cellId]) {
      const point = vertices.p[id];
      if (!point || found.has(id)) continue;
      const [x, y] = point;
      if (x <= 0 || y <= 0 || x >= width || y >= height) continue;
      if (Math.hypot(x - center[0], y - center[1]) >= radius) continue;
      found.add(id);
    }
  }

  return [...found];
}

export class VertexBrush {
  readonly before = new Map<number, Point>();
  private weights = new Map<number, number>();
  private limits = new Map<number, { origin: Point; distance: number }>();
  private areas = new Map<number, number>();

  constructor(
    private center: Point,
    radius: number
  ) {
    const { vertices, cells } = pack;
    const originals = GraphOverride.state.pack?.vertices?.p;
    const original = (id: number) => (originals?.[id]?.[0] ?? vertices.p[id]) as Point;

    for (const id of findVertices(center, radius)) {
      const point = vertices.p[id];
      const t = 1 - Math.hypot(point[0] - center[0], point[1] - center[1]) / radius;
      this.before.set(id, point);
      this.weights.set(id, t * t * (3 - 2 * t));

      const origin = original(id);
      const edges = vertices.v[id]
        .filter(n => n >= 0 && vertices.p[n])
        .map(n => {
          const neighbor = original(n);
          return Math.hypot(origin[0] - neighbor[0], origin[1] - neighbor[1]);
        });
      const edge = edges.reduce((sum, length) => sum + length, 0) / edges.length; // the shortest one is often a sliver
      const moved = Math.hypot(point[0] - origin[0], point[1] - origin[1]);
      this.limits.set(id, { origin, distance: Math.max(edge * BUDGET, moved) });
      for (const c of vertices.c[id]) if (c >= 0 && c < cells.i.length) this.areas.set(c, 0);
    }

    for (const cell of this.areas.keys()) this.areas.set(cell, polygonArea(Pack.getPolygon(cell)));
  }

  move(point: Point): boolean {
    const dx = point[0] - this.center[0];
    const dy = point[1] - this.center[1];
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return false;

    // every vertex keeps its own budget, so a tight one does not hold the whole brush back
    const targets = new Map<number, Point>();
    for (const [id, from] of this.before) {
      const weight = this.weights.get(id)!;
      targets.set(id, this.allowed(id, [from[0] + dx * weight, from[1] + dy * weight]));
    }

    for (let fraction = 1; fraction >= 1 / 1024; fraction /= 2) {
      const next = new Map<number, Point>();
      for (const [id, target] of targets) {
        const current = pack.vertices.p[id];
        next.set(id, [
          current[0] + (target[0] - current[0]) * fraction,
          current[1] + (target[1] - current[1]) * fraction
        ]);
      }
      if (!this.valid(next)) continue;

      const changed = [...next].filter(([id, p]) => p[0] !== pack.vertices.p[id][0] || p[1] !== pack.vertices.p[id][1]);
      if (!changed.length) return false;
      GraphOverride.movePackVertices(changed);
      return true;
    }

    return false;
  }

  /** the point pulled back into the vertex budget and inside the map frame */
  private allowed(id: number, [x, y]: Point): Point {
    const { width, height } = options.map.graph;
    const { origin, distance } = this.limits.get(id)!;

    const [dx, dy] = [x - origin[0], y - origin[1]];
    const shift = Math.hypot(dx, dy);
    const scale = shift > distance ? distance / shift : 1;
    return [
      minmax(origin[0] + dx * scale, FRAME, width - FRAME),
      minmax(origin[1] + dy * scale, FRAME, height - FRAME)
    ];
  }

  /** no affected cell may fold over itself or shrink away */
  private valid(next: Map<number, Point>): boolean {
    for (const [cell, area] of this.areas) {
      const points = pack.cells.v[cell].map(id => next.get(id) ?? pack.vertices.p[id]);
      if (polygonArea(points) * Math.sign(area) < Math.abs(area) * AREA_MARGIN) return false;
    }

    return true;
  }
}
