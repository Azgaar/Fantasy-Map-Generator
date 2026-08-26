// The packed graph: a second Voronoi diagram built from the grid points that actually matter for the map
import { polygonArea, type Quadtree, quadtree } from "d3";
import type { Point } from "@/types/global";
import type { PackedGraph } from "@/types/PackedGraph";
import { findAllInQuadtree, rn, SEA_LEVEL, TYPED_ARRAY_MAX } from "@/utils";
import { calculateVoronoi } from "./voronoi";

declare global {
  var Pack: PackModule;
}

class PackModule {
  private readonly quadtreeCache = new WeakMap<object, Quadtree<[number, number, number]>>();

  /** deep ocean points dropped and coastal cells split so packed graph has a higher resolution where needed */
  generate(): void {
    const { cells: gridCells, points, features, spacing, boundary } = grid;
    const newCells: { p: Point[]; g: number[]; h: number[] } = { p: [], g: [], h: [] };
    const spacing2 = spacing ** 2;

    const addNewPoint = (gridCellId: number, x: number, y: number, height: number) => {
      newCells.p.push([x, y]);
      newCells.g.push(gridCellId);
      newCells.h.push(height);
    };

    for (const i of gridCells.i) {
      const height = gridCells.h[i];
      const type = gridCells.t[i];

      if (height < SEA_LEVEL && type !== -1 && type !== -2) continue; // exclude all deep ocean points
      if (type === -2 && (i % 4 === 0 || features[gridCells.f[i]].type === "lake")) continue; // exclude non-coastal lake points

      const [x, y] = points[i];
      addNewPoint(i, x, y, height);

      // add additional points for cells along coast
      if (type === 1 || type === -1) {
        if (gridCells.b[i]) continue; // not for near-border cells

        for (const e of gridCells.c[i]) {
          if (i > e) continue;
          if (gridCells.t[e] !== type) continue;

          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) continue; // too close to each other
          addNewPoint(i, rn((x + points[e][0]) / 2, 1), rn((y + points[e][1]) / 2, 1), height);
        }
      }
    }

    const { cells, vertices } = calculateVoronoi(newCells.p, boundary);
    pack.vertices = vertices as PackedGraph["vertices"];
    pack.cells = cells as unknown as PackedGraph["cells"];
    pack.cells.p = newCells.p;
    pack.cells.g = Uint32Array.from(newCells.g) as unknown as number[]; // parent grid cell of every packed cell
    pack.cells.h = Uint8Array.from(newCells.h);
    pack.cells.area = new Uint16Array(cells.i.length).map((_, cellId) =>
      Math.min(Math.abs(polygonArea(this.getPolygon(cellId))), TYPED_ARRAY_MAX.UINT16)
    );
  }

  /** generate does clean pack graph so clear data where required */
  clear(): void {
    pack = {} as PackedGraph;
  }

  /** one quadtree per graph, rebuilt when the cell points are replaced */
  private getQuadtree(graph: PackedGraph) {
    if (!graph.cells?.p) throw new Error("Pack cells not found");

    let qTree = this.quadtreeCache.get(graph.cells.p);
    if (!qTree) {
      qTree = quadtree(graph.cells.p.map(([x, y], cellId) => [x, y, cellId]));
      this.quadtreeCache.set(graph.cells.p, qTree);
    }
    return qTree;
  }

  /** cell closest to the given coordinates, undefined if there is none within the radius */
  findCell(x: number, y: number, radius = Infinity, graph: PackedGraph = pack): number | undefined {
    return this.getQuadtree(graph).find(x, y, radius)?.[2];
  }

  /** cell indexes within the radius from the given coordinates */
  findAll(x: number, y: number, radius: number, graph: PackedGraph = pack): number[] {
    const found = findAllInQuadtree(x, y, radius, this.getQuadtree(graph));
    return found.map(point => point[2]);
  }

  /** cell polygon points */
  getPolygon(cellId: number, graph: PackedGraph = pack): Point[] {
    return graph.cells.v[cellId].map(vertexId => graph.vertices.p[vertexId]);
  }
}

window.Pack = new PackModule();
