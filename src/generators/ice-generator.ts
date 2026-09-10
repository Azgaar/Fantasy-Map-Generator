import Alea from "alea";
import { min } from "d3";
import { redrawIce } from "@/renderers/draw-ice";
import { clipPoly, getIsolines, lerp, minmax, normalize, P, ra, rand, rn } from "../utils";
import type { Point } from "./voronoi";

declare global {
  var Ice: IceModule;
}

export type Ice = Glacier | Iceberg;

interface Glacier {
  type: "glacier";
  i: number;
  points: Point[];
  offset?: Point;
}

interface Iceberg {
  type: "iceberg";
  i: number;
  points: Point[];
  cellId: number;
  size: number;
  offset?: Point;
}

export const getNextFreeId = (ids: number[]): number => {
  const existing = new Set(ids);
  let id = 0;
  while (existing.has(id)) id++;
  return id;
};

class IceModule {
  public regenerate(): void {
    this.generate();
  }

  // Generate glaciers and icebergs based on temperature and height
  public generate() {
    this.clear();
    const { cells, features } = grid;
    const { temp, h } = cells;
    Math.random = Alea(options.map.seed);

    const ICEBERG_MAX_TEMP = 0;
    const GLACIER_MAX_TEMP = -8;
    const minMaxTemp = min<number>(temp)!;
    let nextId = 0; // sequential IDs since we start from clear()

    // Generate glaciers on cold land
    {
      const type: string = "iceShield";
      const getType = (cellId: number) => (h[cellId] >= 20 && temp[cellId] <= GLACIER_MAX_TEMP ? type : null);
      const isolines = getIsolines(grid, getType, { polygons: true });

      if (isolines[type]?.polygons) {
        isolines[type].polygons.forEach((points: Point[]) => {
          const clipped = clipPoly(points, options.map.graph.width, options.map.graph.height);
          pack.ice.push({
            i: nextId++,
            points: clipped,
            type: "glacier"
          });
        });
      }
    }

    // Generate icebergs on cold water
    for (const cellId of grid.cells.i) {
      const t = temp[cellId];
      if (h[cellId] >= 20) continue; // no icebergs on land
      if (t > ICEBERG_MAX_TEMP) continue; // too warm: no icebergs
      if (features[cells.f[cellId]].type === "lake") continue; // no icebergs on lakes
      if (P(0.8)) continue; // skip most of eligible cells

      const randomFactor = 0.8 + rand() * 0.4; // random size factor
      let baseSize = (1 - normalize(t, minMaxTemp, 1)) * 0.8; // size: 0 = zero, 1 = full
      if (cells.t[cellId] === -1) baseSize /= 1.3; // coastline: smaller icebergs
      const size = minmax(rn(baseSize * randomFactor, 2), 0.1, 1);

      const [cx, cy] = grid.points[cellId];
      const points = Grid.getPolygon(cellId).map(
        ([x, y]): Point => [rn(lerp(cx, x, size), 2), rn(lerp(cy, y, size), 2)]
      );

      pack.ice.push({
        i: nextId++,
        points,
        type: "iceberg",
        cellId,
        size
      });
    }
  }

  // Find next available id for new ice element idealy filling gaps
  private getNextId() {
    return getNextFreeId(pack.ice.map(e => e.i));
  }

  private clear() {
    pack.ice = [];
  }

  addIceberg(cellId: number, size: number) {
    const [cx, cy] = grid.points[cellId];
    const points = Grid.getPolygon(cellId).map(([x, y]): Point => [rn(lerp(cx, x, size), 2), rn(lerp(cy, y, size), 2)]);
    const id = this.getNextId();
    const ice: Iceberg = { i: id, points, type: "iceberg", cellId, size };
    pack.ice.push(ice);
    redrawIce(id);
  }

  removeIce(id: number) {
    const ice = pack.ice.find(ice => ice.i === id);
    if (ice) {
      const index = pack.ice.indexOf(ice);
      pack.ice.splice(index, 1);
      redrawIce(id);
    }
  }

  randomizeIcebergShape(id: number) {
    const iceberg = pack.ice.find(ice => ice.i === id);
    if (iceberg?.type !== "iceberg") return;

    const cellId = iceberg.cellId;
    const size = iceberg.size;
    const [cx, cy] = grid.points[cellId];

    // Get a different random cell for the polygon template
    const i: number = ra(grid.cells.i);
    const cn: Point = grid.points[i];
    const poly = Grid.getPolygon(i).map((p): Point => [p[0] - cn[0], p[1] - cn[1]]);
    const points = poly.map((p): Point => [rn(cx + p[0] * size, 2), rn(cy + p[1] * size, 2)]);

    iceberg.points = points;
  }

  changeIcebergSize(id: number, newSize: number) {
    const iceberg = pack.ice.find(ice => ice.i === id);
    if (iceberg?.type !== "iceberg") return;

    const cellId = iceberg.cellId;
    const [cx, cy] = grid.points[cellId];
    const oldSize = iceberg.size;

    const pairs = iceberg.points;
    const poly = pairs.map(p => [(p[0] - cx) / oldSize, (p[1] - cy) / oldSize]);
    const points = poly.map(p => [rn(cx + p[0] * newSize, 2), rn(cy + p[1] * newSize, 2)] satisfies Point);

    iceberg.points = points;
    iceberg.size = newSize;
  }
}

window.Ice = new IceModule();
