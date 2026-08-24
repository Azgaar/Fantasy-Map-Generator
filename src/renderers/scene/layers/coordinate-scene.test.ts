import { describe, expect, it } from "vitest";
import { buildCoordinateScene, formatCoordinate, selectCoordinateStep } from "./coordinate-scene";

describe("coordinate scene", () => {
  const state = {
    extent: { latN: 50, latS: 40, latT: 10, lonE: 20, lonT: 20, lonW: 0 },
    height: 100,
    width: 200
  };

  it("precomputes deterministic camera-neutral graticule groups", () => {
    const scene = buildCoordinateScene(state, "coordinates:3");
    const tenDegree = scene.groups.find(group => group.step === 10);

    expect(scene).toMatchObject({
      bounds: { maxX: 200, maxY: 100, minX: 0, minY: 0 },
      revision: "coordinates:3",
      valid: true
    });
    expect(tenDegree?.paths).toEqual([
      {
        domainId: "coordinate:longitude:10:0",
        points: [
          [0, 0],
          [0, 100]
        ]
      },
      {
        domainId: "coordinate:longitude:10:10",
        points: [
          [100, 0],
          [100, 100]
        ]
      },
      {
        domainId: "coordinate:longitude:10:20",
        points: [
          [200, 0],
          [200, 100]
        ]
      },
      {
        domainId: "coordinate:latitude:10:40",
        points: [
          [0, 100],
          [200, 100]
        ]
      },
      {
        domainId: "coordinate:latitude:10:50",
        points: [
          [0, 0],
          [200, 0]
        ]
      }
    ]);
    expect(tenDegree?.labels.map(label => label.text)).toEqual(["0", "10°E", "20°E", "40°N", "50°N"]);
  });

  it("selects the legacy density step from longitude span and camera scale", () => {
    expect(selectCoordinateStep(120, 1)).toBe(10);
    expect(selectCoordinateStep(120, 4)).toBe(2);
    expect(selectCoordinateStep(120, 20)).toBe(0.5);
  });

  it("formats hemispheres and suppresses fractional labels", () => {
    expect(formatCoordinate(-15, "longitude")).toBe("15°W");
    expect(formatCoordinate(-5, "latitude")).toBe("5°S");
    expect(formatCoordinate(0, "latitude")).toBe("0");
    expect(formatCoordinate(0.5, "longitude")).toBe("");
  });

  it("rejects incomplete or inconsistent extents", () => {
    expect(buildCoordinateScene({ ...state, extent: { lonT: 20 } }).valid).toBe(false);
    expect(buildCoordinateScene({ ...state, extent: { ...state.extent, latT: 0 } }).valid).toBe(false);
  });
});
