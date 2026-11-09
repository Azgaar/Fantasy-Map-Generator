// User edits applied on top of the generated graph
import { polygonArea, type Quadtree, quadtree } from "d3";
import type { Point } from "@/types/global";
import type { PackedGraph } from "@/types/packed-graph";
import { TYPED_ARRAY_MAX, unique } from "@/utils/array-utils";
import { clipPoly } from "@/utils/common-utils";
import { rn } from "@/utils/number-utils";
import { Pack } from "./pack-generator";

type OverrideValue = number | number[];
/** property name → element id → [original value, custom value] */
type PropOverrides = Record<string, Record<number, [OverrideValue, OverrideValue]>>;
const POSITION_TOLERANCE = 0.001; // circumcenters of the same cells can differ by float rounding

export interface GraphOverrides {
  pack?: { cells?: PropOverrides; vertices?: PropOverrides };
  grid?: { cells?: PropOverrides; vertices?: PropOverrides };
}

class GraphOverrideModule {
  private vertices: PackedGraph["vertices"] | null = null; // only pack.vertices can be changed for now
  private overrides: GraphOverrides = {};

  movePackVertex(vertexId: number, point: Point): void {
    this.movePackVertices([[vertexId, point]]);
  }

  movePackVertices(points: Iterable<[number, Point]>): void {
    if (this.vertices !== pack.vertices) this.reset();
    const changed: number[] = [];
    for (const [vertexId, point] of points) {
      const [from] = this.movedVertices[vertexId] ?? [pack.vertices.p[vertexId]];
      if (String(from) === String(point)) delete this.movedVertices[vertexId];
      else this.movedVertices[vertexId] = [from, point];
      pack.vertices.p[vertexId] = point;
      changed.push(vertexId);
    }
    refreshDerivedData(changed);
  }

  get state(): GraphOverrides {
    return this.vertices === pack.vertices ? this.overrides : {};
  }

  /** apply overrides on top of a rebuilt graph, dropping the ones it no longer fits */
  restore(state: GraphOverrides = this.overrides): void {
    const movedVertices = Object.entries(state.pack?.vertices?.p ?? {});
    this.reset();

    const restored: number[] = [];
    let byPosition: Quadtree<[number, number, number]> | null = null;
    for (const [id, [from, to]] of movedVertices) {
      let vertexId = Number(id);
      const current = pack.vertices.p[vertexId];
      if (!current || String(current) !== String(from)) {
        // the rebuild renumbered the vertices: find the one still generated at the original point
        byPosition ??= quadtree(pack.vertices.p.map(([x, y], i) => [x, y, i] as [number, number, number]));
        const [x, y] = from as Point;
        const match = byPosition.find(x, y, POSITION_TOLERANCE);
        if (!match || this.movedVertices[match[2]]) continue; // the graph changed around it
        vertexId = match[2];
      }

      pack.vertices.p[vertexId] = to as Point;
      this.movedVertices[vertexId] = [from, to];
      restored.push(vertexId);
    }

    refreshDerivedData(restored);
  }

  /** put every moved vertex back where the generator placed it */
  revert(): void {
    if (this.vertices !== pack.vertices) {
      this.reset();
      return;
    }

    const moved = Object.entries(this.movedVertices);
    for (const [id, [from]] of moved) pack.vertices.p[Number(id)] = from as Point;

    this.reset();
    refreshDerivedData(moved.map(([id]) => Number(id)));
  }

  /** take back the overrides of a graph put back as it was, after a rebuild that failed */
  adopt(state: GraphOverrides): void {
    this.vertices = pack.vertices;
    this.overrides = state;
  }

  /** drop the reference to the world being replaced; the next move/restore starts a fresh baseline */
  clear(): void {
    this.vertices = null;
    this.overrides = {};
  }

  private reset(): void {
    this.vertices = pack.vertices;
    this.overrides = {};
  }

  private get movedVertices(): Record<number, [OverrideValue, OverrideValue]> {
    this.overrides.pack ??= {};
    this.overrides.pack.vertices ??= {};
    this.overrides.pack.vertices.p ??= {};
    return this.overrides.pack.vertices.p;
  }
}

/** cell and feature areas are derived from vertex positions, keep them in sync */
function refreshDerivedData(vertexIds: number[]): void {
  if (!vertexIds.length) return;
  const { cells, vertices, features } = pack;

  const cellIds = unique(vertexIds.flatMap(vertexId => vertices.c[vertexId])).filter(cellId => cellId < cells.i.length);
  for (const cellId of cellIds) {
    const area = Math.min(rn(Math.abs(polygonArea(Pack.getPolygon(cellId)))), TYPED_ARRAY_MAX.UINT16);
    const feature = features[cells.f[cellId]];
    if (feature?.type === "ocean") feature.area += area - cells.area[cellId]; // ocean area is the sum of its cells
    cells.area[cellId] = area;
  }

  const featureIds = unique(cellIds.map(cellId => cells.f[cellId]));
  for (const featureId of featureIds) {
    const feature = features[featureId];
    if (feature?.type !== "ocean" && feature?.vertices?.length) {
      const points = clipPoly(
        feature.vertices.map(vertexId => vertices.p[vertexId]),
        options.map.graph.width,
        options.map.graph.height
      );
      feature.area = Math.abs(rn(polygonArea(points)));
    }
  }
}

export const GraphOverride = new GraphOverrideModule();
