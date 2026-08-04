import { describe, expect, it } from "vitest";
import { getPathLabel } from "./path-label-layout";

describe("getPathLabel", () => {
  it("uses the entity path and keeps generated text upright", () => {
    expect(
      getPathLabel({ i: 7, name: "Silver Road" }, "route", [
        [30, 10, 1],
        [20, 15, 2],
        [10, 20, 3]
      ])
    ).toEqual({
      id: "routeLabel7",
      type: "route",
      text: "Silver Road",
      group: "route",
      startOffset: 50,
      pathPoints: [
        [10, 20],
        [20, 15],
        [30, 10]
      ]
    });
  });

  it("preserves explicit label overrides", () => {
    const pathPoints: [number, number][] = [
      [1, 2],
      [3, 4]
    ];
    const label = getPathLabel(
      {
        i: 3,
        name: "Amber",
        label: { text: "Amber River", group: "waterways", pathPoints, fontSize: 120 }
      },
      "river",
      [
        [20, 20],
        [10, 10]
      ]
    );

    expect(label).toMatchObject({
      id: "riverLabel3",
      type: "river",
      text: "Amber River",
      group: "waterways",
      pathPoints,
      startOffset: 50,
      fontSize: 120
    });
  });
});
