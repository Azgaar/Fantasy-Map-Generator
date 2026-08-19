import { describe, expect, test } from "vitest";
import { getGeozone, toDMS } from "./cell-info";

describe("cell info geographic formatting", () => {
  test.each([
    [90, "Arctic"],
    [66.5, "Temperate North"],
    [35, "Subtropical North"],
    [23.5, "Tropical North"],
    [1, "Equatorial"],
    [-1, "Tropical South"],
    [-23.5, "Subtropical South"],
    [-35, "Temperate South"],
    [-66.5, "Antarctic"]
  ])("assigns latitude %s to %s", (latitude, expected) => {
    expect(getGeozone(latitude)).toBe(expected);
  });

  test.each([
    [52.2297, "lat", "52°13′46″N"],
    [-33.8688, "lat", "33°52′7″S"],
    [151.2093, "lon", "151°12′33″E"],
    [-73.9857, "lon", "73°59′8″W"],
    [0, "lat", "0°0′0″N"],
    [0, "lon", "0°0′0″E"]
  ] as const)("formats %s %s as degrees, minutes, seconds and a cardinal", (coordinate, type, expected) => {
    expect(toDMS(coordinate, type)).toBe(expected);
  });
});
