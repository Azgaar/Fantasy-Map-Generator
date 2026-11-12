import { describe, expect, it } from "vitest";
import { getStepBit, isClear, spread, trace } from "./pathfinding";

// a map drawn in rows: "." open, "#" cannot be entered, "~" dear
const grid = (rows: string[]) => {
  const cols = rows[0].length;
  const costs = [...rows.join("")].map(char => (char === "#" ? Infinity : char === "~" ? 8 : 1));
  const node = (col: number, row: number): number => row * cols + col;
  return { cols, rows: rows.length, costs, node };
};

describe("pathfinding", () => {
  it("goes straight over open ground, a diagonal step a root of two", () => {
    const g = grid([".....", ".....", "....."]);
    const reach = spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    expect(reach.cost[g.node(4, 0)]).toBeCloseTo(4);
    expect(reach.cost[g.node(2, 2)]).toBeCloseTo(2 * Math.SQRT2);
    expect(trace(reach, g.node(4, 0))).toEqual([0, 1, 2, 3, 4]);
  });

  it("goes round what cannot be entered and through the gap in it", () => {
    const g = grid([".....", "####.", "....."]);
    const reach = spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    const way = trace(reach, g.node(0, 2));
    expect(way).toContain(g.node(4, 1));
    expect(way.every(node => g.costs[node] === 1)).toBe(true);
    expect(reach.cost[g.node(0, 2)]).toBeGreaterThan(8);
  });

  it("does not cut the corner of dearer ground", () => {
    const g = grid(["..", ".~"]);
    const reach = spread(g.cols, g.rows, [g.node(0, 1)], g.costs);
    expect(reach.cost[g.node(1, 0)]).toBeCloseTo(2); // up and along, not across the corner
    const open = grid(["..", ".."]);
    expect(spread(2, 2, [open.node(0, 1)], open.costs).cost[open.node(1, 0)]).toBeCloseTo(Math.SQRT2);
  });

  it("does not squeeze between two nodes that cannot be entered", () => {
    const g = grid([".#", "#."]);
    const reach = spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    expect(reach.cost[g.node(1, 1)]).toBe(Infinity);
    expect(trace(reach, g.node(1, 1))).toEqual([]);
  });

  it("takes the cheap way round rather than the dear one through", () => {
    const wide = grid([".....", ".~~~.", "....."]);
    const reach = spread(wide.cols, wide.rows, [wide.node(2, 0)], wide.costs);
    expect(trace(reach, wide.node(2, 2)).every(node => wide.costs[node] === 1)).toBe(true);

    const long = grid(["...", "~~~", "..."]);
    const across = spread(long.cols, long.rows, [long.node(1, 0)], long.costs);
    expect(across.cost[long.node(1, 2)]).toBeCloseTo(4.5 + 4.5); // in and out of the dear node, half a node each way
  });

  it("keeps to the steps that are not closed", () => {
    const g = grid(["...", "..."]);
    // a wall between the first and the second column, with no gap
    const closed = new Array(g.costs.length).fill(0);
    for (const row of [0, 1]) {
      for (const dy of [-1, 0, 1]) {
        closed[g.node(0, row)] |= getStepBit(1, dy);
        closed[g.node(1, row)] |= getStepBit(-1, dy);
      }
    }
    expect(spread(g.cols, g.rows, [g.node(0, 0)], g.costs, closed).cost[g.node(2, 0)]).toBe(Infinity);

    closed[g.node(0, 1)] &= ~getStepBit(1, 0); // a gate in the second row
    const reach = spread(g.cols, g.rows, [g.node(0, 0)], g.costs, closed);
    expect(trace(reach, g.node(2, 0))).toEqual([g.node(0, 0), g.node(0, 1), g.node(1, 1), g.node(2, 0)]);
  });

  it("lets a source leave a node it could not enter", () => {
    const g = grid(["#.."]);
    const reach = spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    expect(reach.cost[g.node(2, 0)]).toBeCloseTo(2);
  });

  it("spreads from several sources at once", () => {
    const g = grid(["......."]);
    const reach = spread(g.cols, g.rows, [0, 6], g.costs);
    expect([...reach.cost]).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it("tells whether a straight way is clear", () => {
    const g = grid([".....", "..#..", "....."]);
    const inWay = (node: number): boolean => g.costs[node] === Infinity;
    expect(isClear(g.cols, g.rows, 10, [5, 15], [45, 15], inWay)).toBe(false);
    expect(isClear(g.cols, g.rows, 10, [5, 5], [45, 5], inWay)).toBe(true);
  });
});
