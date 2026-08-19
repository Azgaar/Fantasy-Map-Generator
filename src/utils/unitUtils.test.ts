import { describe, expect, it } from "vitest";
import { convertTemperature } from "./unitUtils";

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
