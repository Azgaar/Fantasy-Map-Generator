import { describe, expect, test } from "vitest";
import { labelSpreadInternals } from "@/controllers/label-spread";

const { getBurgLabelCandidates, optimizeLabelPlacements } = labelSpreadInternals;
type LabelPlacementCandidate = Parameters<typeof optimizeLabelPlacements>[0][number]["candidates"][number];

function current(bounds = { x1: 40, y1: 40, x2: 60, y2: 44 }): LabelPlacementCandidate {
  return { placement: { dx: 0, dy: 0 }, bounds, collisionBounds: bounds, preference: 0 };
}

describe("label spread Burg candidates", () => {
  test("creates six placements around the icon without covering it", () => {
    const iconBounds = { x1: 45, y1: 45, x2: 55, y2: 55 };
    const candidates = getBurgLabelCandidates({
      current: current(),
      iconBounds,
      gap: 2
    });

    expect(candidates).toHaveLength(7);
    for (const { bounds } of candidates) {
      const overlapsIcon =
        Math.min(bounds.x2, iconBounds.x2) > Math.max(bounds.x1, iconBounds.x1) &&
        Math.min(bounds.y2, iconBounds.y2) > Math.max(bounds.y1, iconBounds.y1);
      expect(overlapsIcon).toBe(false);
    }
  });

  test("offers left, centered and right positions both above and below", () => {
    const candidates = getBurgLabelCandidates({
      current: current(),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });
    const snapped = candidates.slice(1);

    expect(new Set(snapped.map(candidate => candidate.bounds.x1))).toEqual(new Set([30, 40, 50]));
    expect(new Set(snapped.map(candidate => candidate.bounds.y1))).toEqual(new Set([39, 57]));
  });

  test("keeps wide diagonal labels close to the icon center", () => {
    const candidates = getBurgLabelCandidates({
      current: current({ x1: 10, y1: 40, x2: 70, y2: 44 }),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });

    const snapped = candidates.slice(1);
    expect(new Set(snapped.map(candidate => candidate.bounds.x1))).toEqual(new Set([-10, 20, 50]));
  });

  test("keeps a collision-free current placement", () => {
    const burgCandidates = getBurgLabelCandidates({
      current: current(),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });
    const solution = optimizeLabelPlacements(
      [
        { id: "burg", candidates: burgCandidates },
        { id: "other", candidates: [current({ x1: 70, y1: 70, x2: 80, y2: 75 })] }
      ],
      { x1: 0, y1: 0, x2: 100, y2: 100 },
      "seed"
    );

    expect(solution.initialOverlaps).toBe(0);
    expect(solution.selected.get("burg")).toBe(burgCandidates[0]);
    expect(solution.selected.get("burg")?.placement).toEqual({ dx: 0, dy: 0 });
  });

  test("keeps the current placement first so the optimizer can judge the collision", () => {
    const candidates = getBurgLabelCandidates({
      current: current({ x1: 40, y1: 40, x2: 60, y2: 50 }),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });

    expect(candidates).toHaveLength(7);
    expect(candidates[0].placement).toEqual({ dx: 0, dy: 0 });
    expect(candidates.slice(1).every(candidate => candidate.preference >= 120)).toBe(true);
  });

  test("ranks Burg slots by screen-space distance", () => {
    const candidates = getBurgLabelCandidates({
      current: current(),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2,
      changePenalty: 300,
      displacementScale: 6
    });
    const bottomLeft = candidates.find(candidate => candidate.placement.dx === -10 && candidate.placement.dy === 17);

    expect(bottomLeft?.preference).toBe(300 + Math.hypot(10, 17) * 6);
  });

  test("uses a free nearby slot instead of retaining a Burg collision", () => {
    const burgCandidates = getBurgLabelCandidates({
      current: current(),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2,
      displacementScale: 6
    });
    const blockingBurg = current({ x1: 40, y1: 40, x2: 60, y2: 44 });
    const solution = optimizeLabelPlacements(
      [
        { id: "moving", kind: "burg", candidates: burgCandidates },
        { id: "blocking", kind: "burg", candidates: [blockingBurg] }
      ],
      { x1: 0, y1: 0, x2: 100, y2: 100 },
      "seed"
    );

    expect(solution.remainingOverlaps).toBe(0);
    expect(solution.selected.get("moving")).not.toBe(burgCandidates[0]);
  });
});
