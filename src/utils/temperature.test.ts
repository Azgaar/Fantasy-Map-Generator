import { describe, expect, it } from "vitest";
import { formatTemperature } from "./temperature";

describe("formatTemperature", () => {
  it("formats every supported scale without reading application globals", () => {
    expect(formatTemperature(20, "°C")).toBe("20°C");
    expect(formatTemperature(20, "°F")).toBe("68°F");
    expect(formatTemperature(20, "K")).toBe("293K");
    expect(formatTemperature(20, "°R")).toBe("528°R");
    expect(formatTemperature(20, "°De")).toBe("120°De");
    expect(formatTemperature(20, "°N")).toBe("7°N");
    expect(formatTemperature(20, "°Ré")).toBe("16°Ré");
    expect(formatTemperature(20, "°Rø")).toBe("18°Rø");
  });
});
