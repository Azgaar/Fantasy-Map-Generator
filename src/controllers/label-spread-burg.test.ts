import { describe, expect, test } from "vitest";
import { labelSpreadInternals } from "@/controllers/label-spread";

const { getBurgLabelCandidates, isDrawnOn, optimizeLabelPlacements } = labelSpreadInternals;
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

  test("offers a centered slot above and below plus the four diagonals", () => {
    const candidates = getBurgLabelCandidates({
      current: current(),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });
    const slots = candidates.slice(1).map(candidate => [candidate.bounds.x1, candidate.bounds.y1]);

    expect(new Set(slots.map(String))).toEqual(
      new Set(
        [
          [40, 39], // top: centered on the icon, one gap above it
          [40, 57], // bottom: centered, one gap below
          [23, 46], // top-left
          [57, 46], // top-right
          [23, 50], // bottom-left
          [57, 50] // bottom-right
        ].map(String)
      )
    );
  });

  test("measures the gap from the text ink rather than the text box", () => {
    const bounds = { x1: 40, y1: 36, x2: 60, y2: 48 }; // box padded by font ascent and descent
    const candidates = getBurgLabelCandidates({
      current: {
        placement: { dx: 0, dy: 0 },
        bounds,
        collisionBounds: bounds,
        preference: 0,
        inkBounds: [{ x1: 40, y1: 40, x2: 60, y2: 44 }]
      },
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });
    const top = candidates.find(candidate => candidate.placement.dy === -1);

    // ink bottom (44) lands one gap above the icon top (45), so the box hangs 4 lower than the ink
    expect(top?.bounds).toEqual({ x1: 40, y1: 35, x2: 60, y2: 47 });
  });

  test("keeps wide diagonal labels close to the icon center", () => {
    const candidates = getBurgLabelCandidates({
      current: current({ x1: 10, y1: 40, x2: 70, y2: 44 }),
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });

    const snapped = candidates.slice(1);
    expect(new Set(snapped.map(candidate => candidate.bounds.x1))).toEqual(new Set([20, -17, 57]));
  });

  test("moves a Burg name off the icon it is covering", () => {
    const covering = current({ x1: 40, y1: 46, x2: 60, y2: 54 });
    const burgCandidates = getBurgLabelCandidates({
      current: covering,
      iconBounds: { x1: 45, y1: 45, x2: 55, y2: 55 },
      gap: 2
    });
    const icon = { x1: 45, y1: 45, x2: 55, y2: 55 };
    const solution = optimizeLabelPlacements(
      [
        { id: "name", kind: "burg", candidates: burgCandidates },
        {
          id: "icon",
          obstacle: true,
          candidates: [{ placement: {}, bounds: icon, collisionBounds: icon, preference: 0 }]
        }
      ],
      { x1: 0, y1: 0, x2: 100, y2: 100 },
      "seed"
    );

    expect(solution.initialOverlaps).toBe(1);
    expect(solution.remainingOverlaps).toBe(0);
    expect(solution.selected.get("name")).not.toBe(burgCandidates[0]);
  });

  test("only accepts an icon that is drawn on its own Burg", () => {
    const icon = { x1: 45, y1: 45, x2: 55, y2: 55 };

    expect(isDrawnOn(icon, 50, 50)).toBe(true); // on the point it is placed at
    expect(isDrawnOn(icon, 58, 62)).toBe(true); // artwork hanging off the point still counts
    expect(isDrawnOn(icon, 700, 50)).toBe(false); // left over from an earlier map
    expect(isDrawnOn(icon, 50, 700)).toBe(false);
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
    const bottomRight = candidates.find(candidate => candidate.placement.dx === 17 && candidate.placement.dy === 10);

    expect(bottomRight?.preference).toBe(300 + Math.hypot(17, 10) * 6);
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
