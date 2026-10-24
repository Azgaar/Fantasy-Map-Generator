// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
import { requireFill } from "@/utils/color-utils";
import { Hatches } from "./hatches";

beforeEach(() => {
  document.body.innerHTML = `<svg><g id="defs-hatching">
    <pattern id="hatch6"><circle style="fill: black" /><line style="stroke: black; stroke-width: 2" /></pattern>
  </g></svg><svg id="map"></svg>`;
});

test("black hatchings keep the base pattern id", () => {
  expect(Hatches.fill("hatch6", "#000000")).toBe("url(#hatch6)");
  expect(Hatches.fill("hatch6", "#c0392b")).toBe("url(#hatch6-c0392b)");
  expect(Hatches.parse("url(#hatch6)")).toEqual({ hatch: "hatch6", color: "#000000" });
  expect(Hatches.parse("url(#hatch6-c0392b)")).toEqual({ hatch: "hatch6", color: "#c0392b" });
  expect(Hatches.parse("#c0392b")).toBeNull();
});

test("requireFill accepts colored hatchings", () => {
  expect(requireFill("url(#hatch6-c0392b)")).toBe("url(#hatch6-c0392b)");
  expect(() => requireFill("url(#hatch6-red)")).toThrow();
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

test("ensureAll covers the colored fills among the given ones", () => {
  Hatches.ensureAll(["url(#hatch6-00ff00)", "url(#hatch6)", "#00ff00", undefined, "url(#hatch6-00ff00)"]);
  expect(document.getElementById("hatch6-00ff00")).not.toBeNull();
  expect(document.querySelectorAll("pattern")).toHaveLength(2);
});

test("bases skip the recolored copies", () => {
  Hatches.ensure("url(#hatch6-c0392b)");
  expect(Hatches.bases().map(({ id }) => id)).toEqual(["hatch6"]);
});
