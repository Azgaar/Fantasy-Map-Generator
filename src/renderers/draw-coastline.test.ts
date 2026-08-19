// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { Layer } from "@/components/layers";
import { drawCoastline } from "./draw-coastline";

const createLayer = (groups: string[]) => {
  document.body.innerHTML = /* html */ `<svg><g id="coastline">${groups
    .map(id => `<g id="${id}"></g>`)
    .join("")}</g></svg>`;
  return { getEl: () => document.getElementById("coastline") } as unknown as Layer;
};

const feature = (i: number, subtype: string, group = "sea_island") => ({
  i,
  type: "island",
  subtype,
  group
});

beforeEach(() => {
  globalThis.pack = {
    features: [
      0,
      feature(1, "continent"),
      feature(2, "lake_island", "lake_island"),
      feature(3, "island", "archipelago"),
      feature(4, "island", "removed_group")
    ]
  } as unknown as typeof globalThis.pack;
});

describe("drawCoastline", () => {
  it("groups features by the custom group the user assigned, falling back to the default one", () => {
    const layer = createLayer(["sea_island", "lake_island", "archipelago"]);

    drawCoastline(layer);

    const groupOf = (i: number) => document.querySelector(`use[data-f="${i}"]`)?.parentElement?.id;
    expect(groupOf(1)).toBe("sea_island");
    expect(groupOf(2)).toBe("lake_island");
    expect(groupOf(3)).toBe("archipelago");
    expect(groupOf(4)).toBe("sea_island"); // the group is gone, the feature falls back
  });

  it("keeps every feature drawn once", () => {
    const layer = createLayer(["sea_island", "lake_island", "archipelago"]);

    drawCoastline(layer);
    drawCoastline(layer); // redraw must be idempotent

    expect(document.querySelectorAll("#coastline use")).toHaveLength(4);
  });
});
