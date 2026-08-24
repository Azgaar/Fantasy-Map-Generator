import type { PolygonBatchPrimitive, SceneRevision } from "../primitives";
import { buildCellFillAttributes, type CellFillAttributeSource } from "./cell-fill-attributes";
import type { RetainedCellTopology } from "./retained-cell-topology";

export type CellLayerId =
  | "biomes"
  | "cells"
  | "cultures"
  | "height"
  | "precipitation"
  | "provinces"
  | "religions"
  | "states"
  | "temperature"
  | "zones";

export interface CellFillScene extends PolygonBatchPrimitive {
  colors: Float32Array;
  layer: CellLayerId;
}

export function buildCellFillScene(
  topology: RetainedCellTopology,
  source: CellFillAttributeSource,
  layer: CellLayerId,
  revision: SceneRevision = topology.revision
): CellFillScene {
  return {
    bounds: topology.bounds,
    colors: buildCellFillAttributes(topology, source),
    domainIds: topology.cellRanges.map(range => range.cellId),
    indices: topology.indices,
    kind: "polygon-batch",
    layer,
    positions: topology.positions,
    revision
  };
}
