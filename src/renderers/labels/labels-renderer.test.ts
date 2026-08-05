import { describe, expect, it } from "vitest";
import type { PathLabelData, PointLabelData } from "@/types/labels";
import { getLabelAnchor } from "./labels-renderer";

describe("getLabelAnchor", () => {
  it("interpolates path anchors at startOffset and includes label offsets", () => {
    const label: Omit<PathLabelData, "anchor"> = {
      id: "stateLabel1",
      type: "state",
      group: "state",
      text: "A",
      pathPoints: [
        [0, 0],
        [10, 0],
        [10, 10]
      ],
      startOffset: 75,
      dx: 3,
      dy: -2
    };
    expect(getLabelAnchor(label)).toEqual([13, 3]);
  });

  it("uses positioned label coordinates and offsets", () => {
    const label: Omit<PointLabelData, "anchor"> = {
      id: "burgLabel1",
      type: "burg",
      group: "town",
      text: "B",
      x: 10,
      y: 20,
      dx: -2,
      dy: 4
    };
    expect(getLabelAnchor(label)).toEqual([8, 24]);
  });
});
