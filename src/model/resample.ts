import { mean, quadtree } from "d3";
import { getPointsNumber } from "@/data/graph-density";
import { Measurers } from "@/model/annotations/measurers-generator";
import { Grid } from "@/model/graph/grid-generator";
import { Pack } from "@/model/graph/pack-generator";
import { MapRestoration } from "@/model/map-restoration";
import { Coordinates } from "@/model/physical/coordinates";
import { Features } from "@/model/physical/features-generator";
import { Ice } from "@/model/physical/ice-generator";
import { Temperature } from "@/model/physical/temperature-generator";
import type { GridGraph } from "@/types/GridGraph";
import type { PackedGraph } from "@/types/PackedGraph";
import { isWater } from "@/utils";

interface ResamplerProcessOptions {
  projection: (x: number, y: number) => [number, number];
  inverse: (x: number, y: number) => [number, number];
  scale: number;
}

class Resampler {
  private smoothHeightmap() {
    grid.cells.h.forEach((height: number, newGridCell: number) => {
      const heights = [height, ...grid.cells.c[newGridCell].map((c: number) => grid.cells.h[c])];
      const meanHeight = mean(heights) as number;
      grid.cells.h[newGridCell] = isWater(newGridCell, grid) ? Math.min(meanHeight, 19) : Math.max(meanHeight, 20);
    });
  }

  private resamplePrimaryGridData(
    parentGrid: GridGraph,
    parentPack: PackedGraph,
    inverse: (x: number, y: number) => [number, number],
    scale: number
  ) {
    grid.cells.h = new Uint8Array(grid.points.length);
    grid.cells.temp = new Int8Array(grid.points.length);
    grid.cells.prec = new Uint8Array(grid.points.length);

    const parentPackQ = quadtree(parentPack.cells.p.map(([x, y], i) => [x, y, i]));
    grid.points.forEach(([x, y]: [number, number], newGridCell: number) => {
      const [parentX, parentY] = inverse(x, y);
      const parentPackCell = parentPackQ.find(parentX, parentY, Infinity)?.[2];
      if (parentPackCell === undefined) return;
      const parentGridCell = parentPack.cells.g[parentPackCell];

      grid.cells.h[newGridCell] = parentGrid.cells.h[parentGridCell];
      grid.cells.temp[newGridCell] = parentGrid.cells.temp[parentGridCell];
      grid.cells.prec[newGridCell] = parentGrid.cells.prec[parentGridCell];
    });

    if (scale >= 2) this.smoothHeightmap();
  }

  process(config: ResamplerProcessOptions): void {
    const { projection, inverse, scale } = config;
    const parentGrid = structuredClone(grid);
    const snapshot = MapRestoration.snapshot();

    options.map.graph.points = getPointsNumber(options.generation.graph.density);
    grid = Grid.generate(options.map.seed);
    pack = {} as PackedGraph;

    this.resamplePrimaryGridData(parentGrid, snapshot.pack, inverse, scale);

    Features.markupGrid();
    Grid.addDeepDepressionLakes();
    Grid.openNearSeaLakes();

    Coordinates.calculate();
    Temperature.generate();

    Pack.generate();
    Features.markupPack();
    Ice.generate();
    Measurers.createDefaultRuler();

    // relief is placed anew for the new scale on the first draw
    MapRestoration.restore(snapshot, { projection, inverse, scale, rivers: "restore", relief: false });
  }
}

export const Resample = new Resampler();
