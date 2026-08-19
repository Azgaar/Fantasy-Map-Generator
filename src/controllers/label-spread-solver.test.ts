import { describe, expect, test } from "vitest";
import { labelSpreadInternals } from "@/controllers/label-spread";

const { optimizeLabelPlacements } = labelSpreadInternals;
type LabelPlacementItem = Parameters<typeof optimizeLabelPlacements>[0][number];
type LabelPlacementCandidate = LabelPlacementItem["candidates"][number];

const MAP = { x1: 0, y1: 0, x2: 100, y2: 100 };

/** A 10×10 label box placed at x, kept on a single row so overlaps are easy to reason about */
function box(x: number, preference = 0): LabelPlacementCandidate {
  const bounds = { x1: x, y1: 0, x2: x + 10, y2: 10 };
  return { placement: { dx: x, dy: 0 }, bounds, collisionBounds: bounds, preference };
}

function solve(items: LabelPlacementItem[]) {
  return optimizeLabelPlacements(items, MAP, "seed");
}

describe("label spread solver", () => {
  test("counts and clears a partial overlap that a hard ratio threshold would have ignored", () => {
    const movable = [box(7.5), box(10, 50)]; // covers a quarter of the blocking label
    const solution = solve([
      { id: "blocking", candidates: [box(0)] },
      { id: "movable", candidates: movable }
    ]);

    expect(solution.initialOverlaps).toBe(1);
    expect(solution.remainingOverlaps).toBe(0);
    expect(solution.selected.get("movable")).toBe(movable[1]);
  });

  test("leaves hairline contact alone", () => {
    const movable = [box(9.8), box(20, 50)];
    const solution = solve([
      { id: "blocking", candidates: [box(0)] },
      { id: "movable", candidates: movable }
    ]);

    expect(solution.initialOverlaps).toBe(0);
    expect(solution.selected.get("movable")).toBe(movable[0]);
  });

  test("moves a collision-free neighbour out of the way to unblock a chain", () => {
    // "middle" only escapes "blocking" by taking the slot "last" sits in, and "last" starts clean
    const middle = [box(5), box(15, 100)];
    const last = [box(15), box(25, 100)];
    const solution = solve([
      { id: "blocking", candidates: [box(0)] },
      { id: "middle", candidates: middle },
      { id: "last", candidates: last }
    ]);

    expect(solution.initialOverlaps).toBe(1);
    expect(solution.remainingOverlaps).toBe(0);
    expect(solution.selected.get("middle")).toBe(middle[1]);
    expect(solution.selected.get("last")).toBe(last[1]);
  });

  test("keeps every label put when nothing overlaps", () => {
    const items = [0, 20, 40].map(x => ({ id: `label${x}`, candidates: [box(x), box(x + 10, 50)] }));
    const solution = solve(items);

    expect(solution.initialOverlaps).toBe(0);
    expect(solution.remainingOverlaps).toBe(0);
    for (const item of items) expect(solution.selected.get(item.id)).toBe(item.candidates[0]);
  });
});
