// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
import { requireFill } from "@/utils/color-utils";
import { Hatches } from "./hatches";

beforeEach(() => {
  document.body.innerHTML = `<svg><g id="defs-hatching">
    <pattern id="hatch6" patternTransform="rotate(45 0 0)"><circle style="fill: black" /><line style="stroke: black; stroke-width: 2" /></pattern>
  </g></svg><svg id="map"></svg>`;
});

test("black hatchings keep the base pattern id", () => {
  expect(Hatches.fill("hatch6", "#000000")).toBe("url(#hatch6)");
  expect(Hatches.fill("hatch6", "#c0392b")).toBe("url(#hatch6-c0392b)");
  expect(Hatches.fill("hatch6", "#000000", 150)).toBe("url(#hatch6-s150)");
  expect(Hatches.fill("hatch6", "#c0392b", 55)).toBe("url(#hatch6-c0392b-s55)");
  expect(Hatches.parse("url(#hatch6)")).toEqual({ hatch: "hatch6", color: "#000000", size: 100 });
  expect(Hatches.parse("url(#hatch6-c0392b)")).toEqual({ hatch: "hatch6", color: "#c0392b", size: 100 });
  expect(Hatches.parse("url(#hatch6-c0392b-s55)")).toEqual({ hatch: "hatch6", color: "#c0392b", size: 55 });
  expect(Hatches.parse("#c0392b")).toBeNull();
});

test("requireFill accepts colored hatchings", () => {
  expect(requireFill("url(#hatch6-c0392b)")).toBe("url(#hatch6-c0392b)");
  expect(requireFill("url(#hatch6-s200)")).toBe("url(#hatch6-s200)");
  expect(() => requireFill("url(#hatch6-red)")).toThrow();
  expect(() => requireFill("url(#hatch6-s49)")).toThrow();
  expect(() => requireFill("url(#hatch6-s250)")).toThrow();
});

test("ensure recolors a copy of the base pattern once", () => {
  Hatches.ensure("url(#hatch6-c0392b)");
  Hatches.ensure("url(#hatch6-c0392b)");
  const patterns = document.querySelectorAll("#hatch6-c0392b");
  expect(patterns).toHaveLength(1);
  expect(patterns[0].querySelector<SVGElement>("circle")!.style.fill).toBe("rgb(192, 57, 43)");
  expect(patterns[0].querySelector<SVGElement>("line")!.style.stroke).toBe("rgb(192, 57, 43)");
  expect(document.querySelector<SVGElement>("#hatch6 line")!.style.stroke).toBe("black");
});

test("ensure scales a copy of the base tile", () => {
  Hatches.ensure("url(#hatch6-c0392b-s150)");
  const transform = (id: string) => document.getElementById(id)!.getAttribute("patternTransform");
  expect(transform("hatch6-c0392b-s150")).toBe("rotate(45 0 0) scale(1.5)");
  expect(transform("hatch6")).toBe("rotate(45 0 0)");
});

test("sync keeps the derived hatchings the map data uses and removes the rest", () => {
  globalThis.pack = {
    biomes: [{ color: "url(#hatch6-00ff00)" }],
    states: [{ color: "#00ff00" }, { color: "url(#hatch6)" }],
    provinces: [0, { color: "url(#hatch6-00ff00-s150)" }],
    legends: [{ name: "States", items: [[1, "url(#hatch6-0000ff)", "One"]] }],
    ...Object.fromEntries(["cultures", "religions", "zones", "markets"].map(key => [key, []]))
  } as unknown as typeof globalThis.pack;
  Hatches.ensure("url(#hatch6-c0392b)"); // tried in the picker, then dropped
  Hatches.sync();
  const ids = Array.from(document.querySelectorAll("pattern"), ({ id }) => id);
  expect(ids).toEqual(["hatch6", "hatch6-00ff00", "hatch6-00ff00-s150", "hatch6-0000ff"]);
});

test("bases skip the recolored copies", () => {
  Hatches.ensure("url(#hatch6-c0392b)");
  expect(Hatches.bases().map(({ id }) => id)).toEqual(["hatch6"]);
});
