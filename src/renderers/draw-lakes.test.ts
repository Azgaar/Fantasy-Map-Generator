// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import type { Layer } from "@/components/layers";
import { drawLakes } from "./draw-lakes";

const createLayer = (groups: string[]) => {
  document.body.innerHTML = /* html */ `<svg><g id="lakes">${groups.map(id => `<g id="${id}"></g>`).join("")}</g></svg>`;
  return { getEl: () => document.getElementById("lakes") } as unknown as Layer;
};

beforeEach(() => {
  globalThis.pack = {
    features: [
      0,
      { i: 1, type: "lake", group: "salt" },
      { i: 2, type: "lake", group: "salt", renderingGroup: "my_lakes" },
      { i: 3, type: "lake", group: "frozen", renderingGroup: "removed_group" },
      { i: 4, type: "island", group: "continent" }
    ]
  } as unknown as typeof globalThis.pack;
});

describe("drawLakes", () => {
  it("draws a lake in its type group unless the user moved it elsewhere", () => {
    const layer = createLayer(["freshwater", "salt", "frozen", "my_lakes"]);

    drawLakes(layer);

    const groupOf = (i: number) => document.querySelector(`use[data-f="${i}"]`)?.parentElement?.id;
    expect(groupOf(1)).toBe("salt");
    expect(groupOf(2)).toBe("my_lakes");
    expect(groupOf(3)).toBe("freshwater"); // the group is gone, the lake falls back instead of vanishing
    expect(groupOf(4)).toBeUndefined(); // not a lake
  });
});
