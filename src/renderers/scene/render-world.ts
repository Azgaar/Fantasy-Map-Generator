import type { Grid } from "@/types/grid";
import type { PackedGraph } from "@/types/PackedGraph";
import type { TemperatureScale } from "@/utils/temperature";
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
  markerRenderState?: MarkerRenderState;
}

export function createMapRenderWorld(
  packed: PackedGraph,
  climate: { grid: Grid; requestedCells: number; temperatureScale: TemperatureScale },
  markerRenderState?: MarkerRenderState
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
    markerRenderState
  };
}
