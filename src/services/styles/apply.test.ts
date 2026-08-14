import { describe, expect, test } from "vitest";
import { buildAttributeOps } from "./apply";

describe("buildAttributeOps", () => {
  test("flattens presentation and children into pathed ops, stringifying numbers", () => {
    const ops = buildAttributeOps({
      presentation: { opacity: 0.9, mask: "url(#land)" },
      children: {
        roads: { presentation: { "stroke-width": 0.7 } },
        trails: { presentation: { filter: null }, children: { inner: { presentation: { stroke: "#fff" } } } }
      }
    });
    expect(ops).toEqual([
      { path: [], attr: "opacity", value: "0.9" },
      { path: [], attr: "mask", value: "url(#land)" },
      { path: ["roads"], attr: "stroke-width", value: "0.7" },
      { path: ["trails"], attr: "filter", value: null },
      { path: ["trails", "inner"], attr: "stroke", value: "#fff" }
    ]);
  });

  test("options never produce attribute ops", () => {
    expect(buildAttributeOps({ options: { set: "simple", size: 2 } })).toEqual([]);
  });

  test("empty node produces no ops", () => {
    expect(buildAttributeOps({})).toEqual([]);
  });
});
