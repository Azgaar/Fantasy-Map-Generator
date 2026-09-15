// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { Layer } from "@/components/layers";
import defaults from "@/generators/default-styles.json";
import { stylesSchema } from "@/generators/styles-schema";
import { drawLakes } from "./draw-lakes";

const createLayer = (groups: string[]) => {
  document.body.innerHTML = /* html */ `<svg><g id="lakes">${groups.map(id => `<g id="${id}"></g>`).join("")}</g></svg>`;
  return { getEl: () => document.getElementById("lakes") } as unknown as Layer;
};

beforeEach(() => {
  globalThis.pack = {
    features: [
      0,
      { i: 1, type: "lake", subtype: "salt", group: "salt" },
      { i: 2, type: "lake", subtype: "salt", group: "my_lakes" },
      { i: 3, type: "lake", subtype: "frozen", group: "removed_group" },
      { i: 5, type: "lake", subtype: "freshwater", group: "freshwater" },
      { i: 4, type: "island", subtype: "continent", group: "sea_island" }
    ]
  } as unknown as typeof globalThis.pack;
});

describe("drawLakes", () => {
  it("draws a lake in the group assigned to it, defaulting to freshwater", () => {
    const layer = createLayer(["freshwater", "salt", "frozen", "my_lakes"]);

    drawLakes(layer);

    const groupOf = (i: number) => document.querySelector(`use[data-f="${i}"]`)?.parentElement?.id;
    expect(groupOf(1)).toBe("salt");
    expect(groupOf(2)).toBe("my_lakes");
    expect(groupOf(3)).toBe("freshwater"); // the group is gone, the lake falls back instead of vanishing
    expect(groupOf(5)).toBe("freshwater");
    expect(groupOf(4)).toBeUndefined(); // not a lake
  });
});

describe("lake embellishment rendering", () => {
  const setup = () => {
    const layer = createLayer(["freshwater", "salt", "dry"]);
    document.querySelector("svg")!.insertAdjacentHTML("afterbegin", '<defs id="deftemp"></defs>');
    globalThis.styles = stylesSchema.parse(defaults);
    styles.lakes.groups.freshwater.options.embellishment = "ripples";
    globalThis.grid = { spacing: 8 } as typeof grid;
    globalThis.pack = {
      features: [
        { i: 0, type: "ocean" },
        { i: 1, type: "lake", group: "freshwater", vertices: [0, 1, 2, 3] },
        { i: 2, type: "island", land: true, subtype: "lake_island", group: "custom_islands" }
      ],
      vertices: {
        p: [
          [0, 0],
          [80, 0],
          [80, 40],
          [0, 40]
        ]
      }
    } as unknown as typeof pack;
    return layer;
  };

  it("masks the real shoreline and islands, preserving lake selection", () => {
    drawLakes(setup());
    const path = document.querySelector("#freshwater path")!;
    expect(path.getAttribute("pointer-events")).toBe("none");
    expect(path.getAttribute("mask")).toBe("url(#lake-ripples-1)");
    expect(document.querySelector('#lake-ripples-1 use[href="#feature_1"]')?.getAttribute("fill")).toBe("white");
    expect(document.querySelector('#lake-ripples-1 use[href="#feature_2"]')?.getAttribute("fill")).toBe("black");
    expect(document.querySelectorAll("#lakes use[data-f]")).toHaveLength(1);
  });

  it("redraws without duplicate resources and removes embellishments when disabled", () => {
    const layer = setup();
    drawLakes(layer);
    const first = document.querySelector("svg")!.innerHTML;
    const selected = document.querySelector("#lakes use[data-f]");
    drawLakes(layer);
    expect(document.querySelector("svg")!.innerHTML).toBe(first);
    expect(document.querySelector("#lakes use[data-f]")).toBe(selected);
    styles.lakes.groups.freshwater.options.embellishment = "none";
    drawLakes(layer);
    expect(document.querySelectorAll("[data-lake-embellishment]")).toHaveLength(0);
    expect(document.querySelectorAll("#lakes use[data-f]")).toHaveLength(1);
  });

  it("uses the current lake group settings after reassignment", () => {
    const layer = setup();
    drawLakes(layer);
    pack.features[1].group = "dry";
    drawLakes(layer);
    expect(document.querySelectorAll("[data-lake-embellishment]")).toHaveLength(0);
    expect(document.querySelector('#dry use[data-f="1"]')).not.toBeNull();
  });
});
