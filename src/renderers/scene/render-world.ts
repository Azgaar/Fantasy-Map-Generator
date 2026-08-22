import type { Grid } from "@/types/grid";
import type { PackedGraph } from "@/types/PackedGraph";
import type { TemperatureScale } from "@/utils/temperature";
import type { GoodsProductionSource } from "./layers/economic-ice-scene";
import type { LabelRenderState } from "./layers/label-scene";
import type { MarkerRenderState } from "./layers/point-symbol-scene";

export interface ClimateRenderGrid {
  cells: Grid["cells"];
  points: Grid["points"];
  requestedCells: number;
  temperatureScale: TemperatureScale;
  vertices: Grid["vertices"];
}

export interface MapRenderWorld extends PackedGraph {
  climate?: ClimateRenderGrid;
  goodsProduction?: GoodsProductionSource;
  labelRenderState?: LabelRenderState;
  markerRenderState?: MarkerRenderState;
  urbanization?: number;
}

export function createMapRenderWorld(
  packed: PackedGraph,
  climate: { grid: Grid; requestedCells: number; temperatureScale: TemperatureScale },
  markerRenderState?: MarkerRenderState,
  goodsProduction?: GoodsProductionSource,
  urbanization?: number,
  labelRenderState?: LabelRenderState
): MapRenderWorld {
  return {
    ...packed,
    climate: {
      cells: climate.grid.cells,
      points: climate.grid.points,
      requestedCells: climate.requestedCells,
      temperatureScale: climate.temperatureScale,
      vertices: climate.grid.vertices
    },
    goodsProduction,
    labelRenderState,
    markerRenderState,
    urbanization
  };
}
