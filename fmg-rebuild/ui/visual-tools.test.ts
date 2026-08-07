import { describe, it, expect } from "vitest";
import { celsiusToFahrenheit } from "../renderer/canvas-renderer";

describe("Visuals, Exporter, & Paint helper units", () => {
  it("should correctly convert temperature scales from Celsius to Fahrenheit", () => {
    expect(celsiusToFahrenheit(0)).toBe(32.0);
    expect(celsiusToFahrenheit(25)).toBe(77.0);
    expect(celsiusToFahrenheit(-10)).toBe(14.0);
  });
});
