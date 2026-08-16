import { describe, expect, it } from "vitest";
import { groupOverviewPaths } from "./minimap-overview";

describe("groupOverviewPaths", () => {
  it("builds stable lightweight land and lake path groups", () => {
    const features = [
      undefined,
      { i: 1, type: "ocean" },
      { i: 2, type: "island" },
      { i: 3, type: "lake", group: "salt" },
      { i: 4, type: "lake" },
      { i: 5, type: "island" }
    ];
    const paths = new Map([
      [1, "ocean"],
      [2, "land-a"],
      [3, "salt-a"],
      [4, "fresh-a"]
    ]);

    const overview = groupOverviewPaths(features, paths);

    expect(overview.land).toEqual(["land-a"]);
    expect([...overview.lakes]).toEqual([
      ["salt", ["salt-a"]],
      ["freshwater", ["fresh-a"]]
    ]);
  });
});
