/** minimal land elevation: cells below it are water */
export const SEA_LEVEL = 20;

type HeightedGraph = { cells: { h: ArrayLike<number> } };

/** Checks if a cell is land based on its height. Works for both the grid and the packed graph */
export const isLand = (i: number, graph: HeightedGraph) => graph.cells.h[i] >= SEA_LEVEL;

/** Checks if a cell is water based on its height. Works for both the grid and the packed graph */
export const isWater = (i: number, graph: HeightedGraph) => graph.cells.h[i] < SEA_LEVEL;
