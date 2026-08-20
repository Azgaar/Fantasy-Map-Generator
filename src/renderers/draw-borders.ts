import { select } from "d3";
import { invalidatePixiRendererLayer, pixiRendererOwnsLayer } from "@/renderers/pixi/pixi-renderer-controller";
import type { PackedGraph } from "@/types/PackedGraph";

declare global {
  var drawBorders: () => void;
}

export interface BorderPaths {
  province: string;
  state: string;
}

export const buildBorderPaths = (graph: Pick<PackedGraph, "cells" | "vertices">): BorderPaths => {
  const { cells, vertices } = graph;

  const statePath: string[] = [];
  const provincePath: string[] = [];
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

    // bordering cell of another province
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
        const addToChecked = (cellId: number) => {
          markChecked(checkedProvinces, cellId, cells.province[provToCell]);
        };
        const border = getBorder({
          type: "province",
          fromCell: cellId,
          toCell: provToCell,
          addToChecked
        });

        if (border) {
          provincePath.push(border);
          cellId--; // check the same cell again
          continue;
        }
      }
    }

    // if cell is on state border
    const stateToCell = cells.c[cellId].find(neibId => {
      const neibStateId = cells.state[neibId];
      return isLand(neibId) && stateId > neibStateId && !isChecked(checkedStates, cellId, neibStateId);
    });

    if (stateToCell !== undefined) {
      const addToChecked = (cellId: number) => {
        markChecked(checkedStates, cellId, cells.state[stateToCell]);
      };
      const border = getBorder({
        type: "state",
        fromCell: cellId,
        toCell: stateToCell,
        addToChecked
      });

      if (border) {
        statePath.push(border);
        cellId--; // check the same cell again
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
  }): string | null {
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
    if (chain.length > 1) return `M${chain.map(cellId => vertices.p[cellId]).join(" ")}`;

    return null;
  }

  // connect vertices to chain to form a border
  function getVerticesLine({
    vertices,
    startingVertex,
    checkCell,
    checkVertex,
    addToChecked
  }: {
    vertices: typeof pack.vertices;
    startingVertex: number;
    checkCell: (cellId: number) => boolean;
    checkVertex: (vertex: number) => boolean;
    addToChecked: (cellId: number) => void;
  }) {
    let chain = []; // vertices chain to form a path
    let next = startingVertex;
    const MAX_ITERATIONS = vertices.c.length;

    for (let run = 0; run < 2; run++) {
      // first run: from any vertex to a border edge
      // second run: from found border edge to another edge
      chain = [];

      for (let i = 0; i < MAX_ITERATIONS; i++) {
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

  return { province: provincePath.join(" "), state: statePath.join(" ") };
};

const bordersRenderer = () => {
  TIME && console.time("drawBorders");
  if (pixiRendererOwnsLayer("borders")) {
    select("#map").select("#borders").selectAll("path").remove();
    invalidatePixiRendererLayer("borders");
    TIME && console.timeEnd("drawBorders");
    return;
  }

  const paths = buildBorderPaths(pack);
  select("#map").select("#borders").attr("fill", "none").selectAll("path").remove();
  select("#map").select("#stateBorders").append("path").attr("d", paths.state);
  select("#map").select("#provinceBorders").append("path").attr("d", paths.province);
  TIME && console.timeEnd("drawBorders");
};

window.drawBorders = bordersRenderer;

export { bordersRenderer as drawBorders };
