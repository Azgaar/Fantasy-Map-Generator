import { describe, expect, it } from "vitest";
import { Pathfinding } from "./pathfinding";

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
    const reach = Pathfinding.spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    expect(reach.cost[g.node(4, 0)]).toBeCloseTo(4);
    expect(reach.cost[g.node(2, 2)]).toBeCloseTo(2 * Math.SQRT2);
    expect(Pathfinding.trace(reach, g.node(4, 0))).toEqual([0, 1, 2, 3, 4]);
  });

  it("goes round what cannot be entered and through the gap in it", () => {
    const g = grid([".....", "####.", "....."]);
    const reach = Pathfinding.spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    const way = Pathfinding.trace(reach, g.node(0, 2));
    expect(way).toContain(g.node(4, 1));
    expect(way.every(node => g.costs[node] === 1)).toBe(true);
    expect(reach.cost[g.node(0, 2)]).toBeGreaterThan(8);
  });

  it("does not cut the corner of dearer ground", () => {
    const g = grid(["..", ".~"]);
    const reach = Pathfinding.spread(g.cols, g.rows, [g.node(0, 1)], g.costs);
    expect(reach.cost[g.node(1, 0)]).toBeCloseTo(2); // up and along, not across the corner
    const open = grid(["..", ".."]);
    expect(Pathfinding.spread(2, 2, [open.node(0, 1)], open.costs).cost[open.node(1, 0)]).toBeCloseTo(Math.SQRT2);
  });

  it("does not squeeze between two nodes that cannot be entered", () => {
    const g = grid([".#", "#."]);
    const reach = Pathfinding.spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    expect(reach.cost[g.node(1, 1)]).toBe(Infinity);
    expect(Pathfinding.trace(reach, g.node(1, 1))).toEqual([]);
  });

  it("takes the cheap way round rather than the dear one through", () => {
    const wide = grid([".....", ".~~~.", "....."]);
    const reach = Pathfinding.spread(wide.cols, wide.rows, [wide.node(2, 0)], wide.costs);
    expect(Pathfinding.trace(reach, wide.node(2, 2)).every(node => wide.costs[node] === 1)).toBe(true);

    const long = grid(["...", "~~~", "..."]);
    const across = Pathfinding.spread(long.cols, long.rows, [long.node(1, 0)], long.costs);
    expect(across.cost[long.node(1, 2)]).toBeCloseTo(4.5 + 4.5); // in and out of the dear node, half a node each way
  });

  it("keeps to the steps that are not closed", () => {
    const g = grid(["...", "..."]);
    // a wall between the first and the second column, with no gap
    const closed = new Array(g.costs.length).fill(0);
    for (const row of [0, 1]) {
      for (const dy of [-1, 0, 1]) {
        closed[g.node(0, row)] |= Pathfinding.getStepBit(1, dy);
        closed[g.node(1, row)] |= Pathfinding.getStepBit(-1, dy);
      }
    }
    expect(Pathfinding.spread(g.cols, g.rows, [g.node(0, 0)], g.costs, closed).cost[g.node(2, 0)]).toBe(Infinity);

    closed[g.node(0, 1)] &= ~Pathfinding.getStepBit(1, 0); // a gate in the second row
    const reach = Pathfinding.spread(g.cols, g.rows, [g.node(0, 0)], g.costs, closed);
    expect(Pathfinding.trace(reach, g.node(2, 0))).toEqual([g.node(0, 0), g.node(0, 1), g.node(1, 1), g.node(2, 0)]);
  });

  it("lets a source leave a node it could not enter", () => {
    const g = grid(["#.."]);
    const reach = Pathfinding.spread(g.cols, g.rows, [g.node(0, 0)], g.costs);
    expect(reach.cost[g.node(2, 0)]).toBeCloseTo(2);
  });

  it("spreads from several sources at once", () => {
    const g = grid(["......."]);
    const reach = Pathfinding.spread(g.cols, g.rows, [0, 6], g.costs);
    expect([...reach.cost]).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it("spreads lazily only as far as asked, and toward a node as cheap a way as all round", () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let round = 0; round < 30; round++) {
      const [cols, rows] = [40, 25];
      const costs = Float32Array.from({ length: cols * rows }, () => (random() < 0.15 ? Infinity : 0.8 + random() * 3));
      const source = Math.floor(random() * cols * rows);
      const all = Pathfinding.spread(cols, rows, [source], costs);
      const lazy = Pathfinding.spread(cols, rows, [source], costs, undefined, true);
      for (let k = 0; k < 10; k++) {
        const goal = Math.floor(random() * cols * rows);
        expect(lazy.costTo(goal)).toBe(all.cost[goal]);
        expect(Pathfinding.trace(lazy, goal)).toEqual(Pathfinding.trace(all, goal));
        const toward = Pathfinding.spread(cols, rows, [source], costs, undefined, true, goal);
        if (all.cost[goal] === Infinity) expect(toward.costTo(goal)).toBe(Infinity);
        else expect(toward.costTo(goal)).toBeCloseTo(all.cost[goal], 9);
      }
      expect(lazy.cost.filter(cost => cost !== Infinity).length).toBeLessThanOrEqual(
        all.cost.filter(cost => cost !== Infinity).length
      );
    }
  });

  it("tells whether a straight way is clear", () => {
    const g = grid([".....", "..#..", "....."]);
    const inWay = (node: number): boolean => g.costs[node] === Infinity;
    expect(Pathfinding.isClear(g.cols, g.rows, 10, [5, 15], [45, 15], inWay)).toBe(false);
    expect(Pathfinding.isClear(g.cols, g.rows, 10, [5, 5], [45, 5], inWay)).toBe(true);
  });

  it("does not let a straight way slip between two nodes in the way that touch at a corner", () => {
    const g = grid(["#..", ".#.", "..#"]);
    const inWay = (node: number): boolean => g.costs[node] === Infinity;
    expect(Pathfinding.spread(g.cols, g.rows, [g.node(1, 0)], g.costs).cost[g.node(0, 1)]).toBe(Infinity);
    for (const shift of [-2, -1, 0, 1, 2])
      expect(Pathfinding.isClear(g.cols, g.rows, 10, [15 + shift, 5 - shift], [5 - shift, 15 + shift], inWay)).toBe(
        false
      );
    expect(Pathfinding.isClear(g.cols, g.rows, 10, [15, 5], [25, 5], inWay)).toBe(true); // beside the chain, not over it
  });
});
