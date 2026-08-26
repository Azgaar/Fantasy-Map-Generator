// User edits applied on top of the generated graph
import { polygonArea } from "d3";
import type { Point } from "@/types/global";
import type { PackedGraph } from "@/types/PackedGraph";
import { clipPoly, rn, TYPED_ARRAY_MAX, unique } from "@/utils";

type OverrideValue = number | number[];
/** property name → element id → [original value, custom value] */
type PropOverrides = Record<string, Record<number, [OverrideValue, OverrideValue]>>;

export interface GraphOverrides {
  pack?: { cells?: PropOverrides; vertices?: PropOverrides };
  grid?: { cells?: PropOverrides; vertices?: PropOverrides };
}

class GraphOverrideModule {
  private vertices: PackedGraph["vertices"] | null = null; // only pack.vertices can be changed for now
  private overrides: GraphOverrides = {};

  movePackVertex(vertexId: number, point: Point): void {
    if (this.vertices !== pack.vertices) this.reset();

    const [from] = this.movedVertices[vertexId] ?? [pack.vertices.p[vertexId]];
    this.movedVertices[vertexId] = [from, point];
    pack.vertices.p[vertexId] = point;

    refreshDerivedData([vertexId]);
  }

  get state(): GraphOverrides {
    return this.vertices === pack.vertices ? this.overrides : {};
  }

  /** apply overrides on top of a rebuilt graph, dropping the ones it no longer fits */
  restore(state: GraphOverrides = this.overrides): void {
    const movedVertices = Object.entries(state.pack?.vertices?.p ?? {});
    this.reset();

    const restored: number[] = [];
    for (const [id, [from, to]] of movedVertices) {
      const vertexId = Number(id);
      const current = pack.vertices.p[vertexId];
      if (!current || String(current) !== String(from)) continue; // the graph changed, the id means another point

      pack.vertices.p[vertexId] = to as Point;
      this.movedVertices[vertexId] = [from, to];
      restored.push(vertexId);
    }

    refreshDerivedData(restored);
  }

  clear(): void {
    this.reset();
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
    const area = Math.abs(polygonArea(Pack.getPolygon(cellId)));
    cells.area[cellId] = Math.min(rn(area), TYPED_ARRAY_MAX.UINT16);
  }

  const featureIds = unique(cellIds.map(cellId => cells.f[cellId]));
  for (const featureId of featureIds) {
    const feature = features[featureId];
    if (!feature?.vertices) continue;

    const points = clipPoly(
      feature.vertices.map(vertexId => vertices.p[vertexId]),
      graphWidth,
      graphHeight
    );
    feature.area = Math.abs(rn(polygonArea(points)));
  }
}

export const GraphOverride = new GraphOverrideModule();
