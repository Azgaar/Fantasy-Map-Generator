import { afterEach, describe, expect, it } from "vitest";
import { convertSpeed, convertTemperature, formatSpeed, getDistanceUnitRatio, parseSpeed } from "./unitUtils";

// The default (no targetScale) path reads the #temperatureScale select and is
// covered end-to-end in tests/e2e/temperature-units.spec.ts

describe("convertTemperature", () => {
  it("converts Celsius to each supported scale", () => {
    expect(convertTemperature(20, "°C")).toBe("20°C");
    expect(convertTemperature(20, "°F")).toBe("68°F");
    expect(convertTemperature(20, "K")).toBe("293K");
    expect(convertTemperature(20, "°R")).toBe("528°R");
    expect(convertTemperature(20, "°De")).toBe("120°De");
    expect(convertTemperature(20, "°N")).toBe("7°N");
    expect(convertTemperature(20, "°Ré")).toBe("16°Ré");
    expect(convertTemperature(20, "°Rø")).toBe("18°Rø");
  });

  it("handles negative temperatures", () => {
    expect(convertTemperature(-40, "°F")).toBe("-40°F");
    expect(convertTemperature(-40, "°C")).toBe("-40°C");
  });
});

// The #distanceUnitInput select doesn't exist under Node, so stub the lookup the helpers use
const setDistanceUnit = (value: string) => {
  document.getElementById = ((id: string) =>
    id === "distanceUnitInput" ? { value } : null) as typeof document.getElementById;
};

describe("distance unit conversion", () => {
  afterEach(() => {
    document.getElementById = (() => null) as typeof document.getElementById;
  });

  it("keeps km/h speeds as they are for a kilometer map", () => {
    setDistanceUnit("km");
    expect(getDistanceUnitRatio()).toBe(1);
    expect(convertSpeed(4.5)).toBe(4.5);
    expect(formatSpeed(4.5)).toBe("4.5 km/h");
  });

  it("converts a stored km/h speed into the user distance unit, rounded to 1 decimal", () => {
    setDistanceUnit("mi");
    expect(convertSpeed(8)).toBe(5); // 8 km/h = 4.97 mi/h
    expect(formatSpeed(3)).toBe("1.9 mi/h");

    setDistanceUnit("nmi");
    expect(formatSpeed(10)).toBe("5.4 nmi/h");
  });

  it("parses a speed typed in the user unit back into km/h", () => {
    setDistanceUnit("mi");
    expect(parseSpeed(5)).toBeCloseTo(8.047, 3);
    expect(convertSpeed(parseSpeed(4.5))).toBe(4.5); // round-trips at display precision
  });

  it("treats an unknown custom unit as kilometers", () => {
    setDistanceUnit("Marches");
    expect(getDistanceUnitRatio()).toBe(1);
    expect(formatSpeed(6)).toBe("6 Marches/h");
  });
});
