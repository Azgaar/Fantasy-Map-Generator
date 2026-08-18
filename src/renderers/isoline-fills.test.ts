import { describe, expect, test } from "vitest";
import { buildFillPaths } from "./isoline-fills";

const colors = ["#000000", "#abcdef", "url(#hatch1)"];
const build = (isolines: Parameters<typeof buildFillPaths>[1]) =>
  buildFillPaths("biome", isolines, index => colors[index]);

describe("buildFillPaths", () => {
  test("renders fills and water gaps with the area color", () => {
    expect(build({ 1: { fill: "M1,1Z", waterGap: "M1,2L3,4" }, 2: { fill: "M5,5Z" } })).toBe(
      '<path d="M1,1Z" fill="#abcdef" id="biome1" />' +
        '<path d="M1,2L3,4" fill="none" stroke="#abcdef" stroke-width="3" id="biome-gap1" />' +
        '<path d="M5,5Z" fill="url(#hatch1)" id="biome2" />'
    );
  });

  test("does not emit paths for an empty isoline", () => {
    expect(build({ 1: {} })).toBe("");
  });
});
