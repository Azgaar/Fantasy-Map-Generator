import { describe, expect, it } from "vitest";
import {
  createRegionLabel,
  getEffectiveCharacterWidth,
  getRegionLabelPath,
  selectRegionLabelName
} from "./region-label-layout";

describe("region label layout", () => {
  it("selects short, full, and fitting automatic names", () => {
    expect(selectRegionLabelName("North", "North Province", "short")).toBe("North");
    expect(selectRegionLabelName("North", "North Province", "full")).toBe("North Province");
    expect(selectRegionLabelName("North", "North Province", "auto", 20)).toBe("North Province");
    expect(selectRegionLabelName("North", "North Province", "auto", 8)).toBe("North");
  });

  it("preserves explicit Province text and path overrides", () => {
    const label = createRegionLabel({
      id: 7,
      prefix: "province",
      name: "North",
      fullName: "North Province",
      pole: [10, 10],
      cellsNumber: 2,
      regionIds: new Uint16Array(),
      mode: "full",
      override: {
        text: "The Reach",
        pathPoints: [
          [1, 2],
          [3, 4]
        ],
        dx: 2,
        startOffset: 40
      }
    });

    expect(label).toMatchObject({
      id: "provinceLabel7",
      text: "The Reach",
      pathPoints: [
        [1, 2],
        [3, 4]
      ],
      dx: 2,
      startOffset: 40
    });
  });

  it("returns no generated path for an empty region", () => {
    expect(getRegionLabelPath(1, new Uint16Array([0, 0]), [10, 10], 0)).toEqual([]);
  });

  it("accounts for per-label relative size and explicit zero letter spacing", () => {
    const groupTypography = { averageCharacterWidth: 7, letterSpacing: 2 };

    expect(getEffectiveCharacterWidth(groupTypography, { fontSize: 200, letterSpacing: 0 })).toBe(10);
    expect(getEffectiveCharacterWidth(groupTypography, undefined)).toBe(7);
  });
});
