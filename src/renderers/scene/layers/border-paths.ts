import type { PackedGraph } from "@/types/PackedGraph";
import {
  type LineBatchPrimitive,
  type LinePathPrimitive,
  mergeSceneBounds,
  type SceneBounds,
  type SceneRevision
} from "../primitives";

export interface BorderPaths {
  province: string;
  state: string;
}

export interface BorderScene {
  province: LineBatchPrimitive;
  state: LineBatchPrimitive;
}

export const buildBorderScene = (
  graph: Pick<PackedGraph, "cells" | "vertices">,
  revision: SceneRevision = 0
): BorderScene => {
  const { cells, vertices } = graph;

  const stateLines: LinePathPrimitive[] = [];
  const provinceLines: LinePathPrimitive[] = [];
  const checkedStates = new Map<number, Set<number>>();
  const checkedProvinces = new Map<number, Set<number>>();

  const isLand = (cellId: number) => cells.h[cellId] >= 20;
  const isChecked = (checked: Map<number, Set<number>>, cellId: number, neighborType: number): boolean =>
    checked.get(cellId)?.has(neighborType) || false;
  const markChecked = (checked: Map<number, Set<number>>, cellId: number, neighborType: number): void => {
    const neighbors = checked.get(cellId);
    if (neighbors) neighbors.add(neighborType);
    else checked.set(cellId, new Set([neighborType]));
  };

  for (let cellId = 0; cellId < cells.i.length; cellId++) {
    if (!cells.state[cellId]) continue;
    const provinceId = cells.province[cellId];
    const stateId = cells.state[cellId];

    if (provinceId) {
      const provToCell = cells.c[cellId].find(neibId => {
        const neibProvinceId = cells.province[neibId];
        return (
          neibProvinceId &&
          provinceId > neibProvinceId &&
          !isChecked(checkedProvinces, cellId, neibProvinceId) &&
          cells.state[neibId] === stateId
        );
      });

      if (provToCell !== undefined) {
        const addToChecked = (checkedCellId: number) => {
          markChecked(checkedProvinces, checkedCellId, cells.province[provToCell]);
        };
        const chain = getBorder({
          type: "province",
          fromCell: cellId,
          toCell: provToCell,
          addToChecked
        });

        if (chain) {
          provinceLines.push(
            createLinePath("province", provinceId, cells.province[provToCell], provinceLines.length, chain)
          );
          cellId--;
          continue;
        }
      }
    }

    const stateToCell = cells.c[cellId].find(neibId => {
      const neibStateId = cells.state[neibId];
      return isLand(neibId) && stateId > neibStateId && !isChecked(checkedStates, cellId, neibStateId);
    });

    if (stateToCell !== undefined) {
      const addToChecked = (checkedCellId: number) => {
        markChecked(checkedStates, checkedCellId, cells.state[stateToCell]);
      };
      const chain = getBorder({
        type: "state",
        fromCell: cellId,
        toCell: stateToCell,
        addToChecked
      });

      if (chain) {
        stateLines.push(createLinePath("state", stateId, cells.state[stateToCell], stateLines.length, chain));
        cellId--;
      }
    }
  }

  function getBorder({
    type,
    fromCell,
    toCell,
    addToChecked
  }: {
    type: "state" | "province";
    fromCell: number;
    toCell: number;
    addToChecked: (cellId: number) => void;
  }): number[] | null {
    const getType = (cellId: number) => cells[type][cellId];
    const isTypeFrom = (cellId: number) => cellId < cells.i.length && getType(cellId) === getType(fromCell);
    const isTypeTo = (cellId: number) => cellId < cells.i.length && getType(cellId) === getType(toCell);

    addToChecked(fromCell);
    const startingVertex = cells.v[fromCell].find(v => vertices.c[v].some(i => isLand(i) && isTypeTo(i)));
    if (startingVertex === undefined) return null;

    const checkVertex = (vertex: number) =>
      vertices.c[vertex].some(isTypeFrom) && vertices.c[vertex].some(c => isLand(c) && isTypeTo(c));
    const chain = getVerticesLine({
      vertices,
      startingVertex,
      checkCell: isTypeFrom,
      checkVertex,
      addToChecked
    });
    if (chain.length > 1) return chain;

    return null;
  }

  function getVerticesLine({
    vertices,
    startingVertex,
    checkCell,
    checkVertex,
    addToChecked
  }: {
    vertices: PackedGraph["vertices"];
    startingVertex: number;
    checkCell: (cellId: number) => boolean;
    checkVertex: (vertex: number) => boolean;
    addToChecked: (cellId: number) => void;
  }): number[] {
    let chain: number[] = [];
    let next = startingVertex;
    const maxIterations = vertices.c.length;

    for (let run = 0; run < 2; run++) {
      chain = [];

      for (let i = 0; i < maxIterations; i++) {
        const previous = chain.at(-1);
        const current = next;
        chain.push(current);

        const [cell1, cell2, cell3] = vertices.c[current];
        addToChecked(cell1);
        addToChecked(cell2);
        addToChecked(cell3);
        const c1 = checkCell(cell1);
        const c2 = checkCell(cell2);
        const c3 = checkCell(cell3);

        const [vertex1, vertex2, vertex3] = vertices.v[current];
        const v1 = checkVertex(vertex1);
        const v2 = checkVertex(vertex2);
        const v3 = checkVertex(vertex3);

        if (v1 && vertex1 !== previous && c1 !== c2) next = vertex1;
        else if (v2 && vertex2 !== previous && c2 !== c3) next = vertex2;
        else if (v3 && vertex3 !== previous && c1 !== c3) next = vertex3;

        if (next === current || next === startingVertex) {
          if (next === startingVertex) chain.push(startingVertex);
          startingVertex = next;
          break;
        }
      }
    }

    return chain;
  }

  function createLinePath(
    type: "province" | "state",
    fromId: number,
    toId: number,
    segment: number,
    vertexIds: readonly number[]
  ): LinePathPrimitive {
    const lowerId = Math.min(fromId, toId);
    const upperId = Math.max(fromId, toId);
    return {
      domainId: `${type}:${lowerId}:${upperId}:${segment}`,
      points: vertexIds.map(vertexId => vertices.p[vertexId])
    };
  }

  return {
    province: createLineBatch(provinceLines, revision),
    state: createLineBatch(stateLines, revision)
  };
};

export const buildBorderPaths = (graph: Pick<PackedGraph, "cells" | "vertices">): BorderPaths => {
  const scene = buildBorderScene(graph);
  return {
    province: toSvgPath(scene.province.paths),
    state: toSvgPath(scene.state.paths)
  };
};

function createLineBatch(paths: readonly LinePathPrimitive[], revision: SceneRevision): LineBatchPrimitive {
  let bounds: SceneBounds | null = null;
  for (const path of paths) {
    for (const [x, y] of path.points) bounds = mergeSceneBounds(bounds, { maxX: x, maxY: y, minX: x, minY: y });
  }
  return {
    bounds,
    domainIds: paths.map(path => path.domainId),
    kind: "line-batch",
    layer: "borders",
    paths,
    revision
  };
}

function toSvgPath(paths: readonly LinePathPrimitive[]): string {
  return paths.map(path => `M${path.points.join(" ")}`).join(" ");
}
