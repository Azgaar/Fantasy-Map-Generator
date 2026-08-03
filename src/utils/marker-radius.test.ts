import { describe, expect, it } from "vitest";
import { radiusPxFor } from "./marker-radius";

describe("radiusPxFor", () => {
  it("converts a distance (in the map unit) to pixels via distanceScale", () => {
    expect(radiusPxFor(24, 3)).toBe(8); // 24 units / 3 units-per-px
    expect(radiusPxFor(678, 3)).toBe(226);
  });

  it("is unit-agnostic — the value is already in the map's unit", () => {
    expect(radiusPxFor(24, 4)).toBe(6);
  });
});
