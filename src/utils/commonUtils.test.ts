import { describe, expect, it } from "vitest";
import { getCoordinates, getLatitude, getLongitude } from "./commonUtils";

describe("getLongitude", () => {
  const mapCoordinates = { lonW: -10, lonT: 20 };
  const graphWidth = 1000;

  it("should calculate longitude at the left edge (x=0)", () => {
    expect(getLongitude(0, mapCoordinates, graphWidth, 2)).toBe(-10);
  });

  it("should calculate longitude at the right edge (x=graphWidth)", () => {
    expect(getLongitude(1000, mapCoordinates, graphWidth, 2)).toBe(10);
  });

  it("should calculate longitude at the center (x=graphWidth/2)", () => {
    expect(getLongitude(500, mapCoordinates, graphWidth, 2)).toBe(0);
  });

  it("should respect decimal precision", () => {
    // 333/1000 * 20 = 6.66, -10 + 6.66 = -3.34
    expect(getLongitude(333, mapCoordinates, graphWidth, 4)).toBe(-3.34);
  });

  it("should handle different map coordinate ranges", () => {
    const wideMap = { lonW: -180, lonT: 360 };
    expect(getLongitude(500, wideMap, graphWidth, 2)).toBe(0);
    expect(getLongitude(0, wideMap, graphWidth, 2)).toBe(-180);
    expect(getLongitude(1000, wideMap, graphWidth, 2)).toBe(180);
  });
});

describe("getLatitude", () => {
  const mapCoordinates = { latN: 60, latT: 40 };
  const graphHeight = 800;

  it("should calculate latitude at the top edge (y=0)", () => {
    expect(getLatitude(0, mapCoordinates, graphHeight, 2)).toBe(60);
  });

  it("should calculate latitude at the bottom edge (y=graphHeight)", () => {
    expect(getLatitude(800, mapCoordinates, graphHeight, 2)).toBe(20);
  });

  it("should calculate latitude at the center (y=graphHeight/2)", () => {
    expect(getLatitude(400, mapCoordinates, graphHeight, 2)).toBe(40);
  });

  it("should respect decimal precision", () => {
    // 60 - (333/800 * 40) = 60 - 16.65 = 43.35
    expect(getLatitude(333, mapCoordinates, graphHeight, 4)).toBe(43.35);
  });

  it("should handle equator-centered maps", () => {
    const equatorMap = { latN: 45, latT: 90 };
    expect(getLatitude(400, equatorMap, graphHeight, 2)).toBe(0);
  });
});

describe("getCoordinates", () => {
  const mapCoordinates = { lonW: -10, lonT: 20, latN: 60, latT: 40 };
  const graphWidth = 1000;
  const graphHeight = 800;

  it("should return [longitude, latitude] tuple", () => {
    const result = getCoordinates(
      500,
      400,
      mapCoordinates,
      graphWidth,
      graphHeight,
      2,
    );
    expect(result).toEqual([0, 40]);
  });

  it("should calculate coordinates at top-left corner", () => {
    const result = getCoordinates(
      0,
      0,
      mapCoordinates,
      graphWidth,
      graphHeight,
      2,
    );
    expect(result).toEqual([-10, 60]);
  });

  it("should calculate coordinates at bottom-right corner", () => {
    const result = getCoordinates(
      1000,
      800,
      mapCoordinates,
      graphWidth,
      graphHeight,
      2,
    );
    expect(result).toEqual([10, 20]);
  });

  it("should respect decimal precision for both coordinates", () => {
    const result = getCoordinates(
      333,
      333,
      mapCoordinates,
      graphWidth,
      graphHeight,
      4,
    );
    expect(result[0]).toBe(-3.34); // longitude
    expect(result[1]).toBe(43.35); // latitude
  });

  it("should use default precision of 2 decimals", () => {
    const result = getCoordinates(
      333,
      333,
      mapCoordinates,
      graphWidth,
      graphHeight,
    );
    expect(result[0]).toBe(-3.34);
    expect(result[1]).toBe(43.35);
  });

  it("should handle global map coordinates", () => {
    const globalMap = { lonW: -180, lonT: 360, latN: 90, latT: 180 };
    const result = getCoordinates(
      500,
      400,
      globalMap,
      graphWidth,
      graphHeight,
      2,
    );
    expect(result).toEqual([0, 0]); // center of the world
  });
});
