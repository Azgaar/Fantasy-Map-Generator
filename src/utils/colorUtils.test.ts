import { expect, test } from "vitest";
import { toColorHex, toHEX } from "./colorUtils";

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
