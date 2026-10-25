import { hcl } from "d3";
import { expect, test } from "vitest";
import { getSectorColor, toColorHex, toHEX } from "./colorUtils";

test("toHEX keeps a hex color as it is written", () => {
  expect(toHEX("#abc")).toBe("#abc");
  expect(toHEX("#AABBCC")).toBe("#AABBCC");
  expect(toHEX("#aabbccdd")).toBe("#aabbccdd");
});

test("toHEX converts rgb and rgba, adding the alpha as an 8th digit", () => {
  expect(toHEX("rgb(18, 52, 86)")).toBe("#123456");
  expect(toHEX("rgba(18, 52, 86, 0.5)")).toBe("#12345680");
  expect(toHEX("rgba(18, 52, 86, 1)")).toBe("#123456");
});

test("toHEX takes percentages, color names and hsl through d3-color", () => {
  expect(toHEX("rgb(50%, 20%, 10%)")).toBe("#80331a");
  expect(toHEX("red")).toBe("#ff0000");
  expect(toHEX("hsl(120, 50%, 50%)")).toBe("#40bf40");
  expect(toHEX("transparent")).toBe("#00000000");
});

test("toHEX clamps out-of-range channels and rejects a non-color", () => {
  expect(toHEX("rgb(300, -5, 86)")).toBe("#ff0056");
  expect(toHEX("")).toBe("");
  expect(toHEX("url(#hatch)")).toBe("");
  expect(toHEX("rgb(18, 52)")).toBe("");
  expect(toHEX("rgb(a b c)")).toBe("");
});

test("toColorHex passes a non-color value through unchanged", () => {
  expect(toColorHex("rgb(18, 52, 86)")).toBe("#123456");
  expect(toColorHex("#abc")).toBe("#abc");
  expect(toColorHex("url(#hatch)")).toBe("url(#hatch)");
  expect(toColorHex("none")).toBe("none");
});

test("getSectorColor spins sector hues well clear of the polity hue", () => {
  const polity = hcl("#3b6bd6").h;
  for (let index = 0; index < 5; index++) {
    const hue = hcl(getSectorColor("#3b6bd6", index)).h;
    const distance = Math.abs(hue - polity);
    expect(Math.min(distance, 360 - distance)).toBeGreaterThanOrEqual(65);
  }
});

test("getSectorColor keeps consecutive sectors of one polity apart", () => {
  const hues = [0, 1, 2, 3, 4, 5].map(index => hcl(getSectorColor("#8c564b", index)).h);
  for (let i = 1; i < hues.length; i++) {
    const gap = Math.abs(hues[i] - hues[i - 1]);
    expect(Math.min(gap, 360 - gap)).toBeGreaterThanOrEqual(38);
  }
});

test("getSectorColor is deterministic and falls back for achromatic polities", () => {
  expect(getSectorColor("#3b6bd6", 2)).toBe(getSectorColor("#3b6bd6", 2));
  expect(getSectorColor("#3b6bd6", 0)).toMatch(/^#[\da-f]{6}$/i);
  expect(getSectorColor("#808080", 0)).toMatch(/^#[\da-f]{6}$/i); // gray polity: the blend fallback
  expect(getSectorColor("not-a-color", 0)).toMatch(/^#[\da-f]{6}$/i);
});
