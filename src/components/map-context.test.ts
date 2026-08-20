import { describe, expect, test } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import { buildMapContext } from "./map-context";

function createPack(): PackedGraph {
  return {
    cells: {
      biome: new Uint8Array([1]),
      burg: new Uint16Array([2]),
      culture: new Uint8Array([1]),
      province: new Uint8Array([1]),
      religion: new Uint8Array([1]),
      state: new Uint8Array([1])
    },
    biomes: [
      { i: 0, name: "Marine" },
      { i: 1, name: "Temperate grassland" }
    ],
    burgs: [{ i: 0 }, { i: 1, name: "Elsewhere" }, { i: 2, name: "Westwatch" }],
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Highland" }
    ],
    features: [],
    ice: [],
    markers: [],
    markets: [],
    provinces: [
      { i: 0, name: "" },
      { i: 1, name: "Northmarch", fullName: "Northmarch Province" }
    ],
    religions: [
      { i: 0, name: "No religion" },
      { i: 1, name: "Old Faith" }
    ],
    rivers: [],
    routes: [{ i: 7, name: "King's Road", group: "roads", points: [], feature: 1 }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Aster", fullName: "Kingdom of Aster" }
    ],
    zones: []
  } as unknown as PackedGraph;
}

function createOverlappingHit(): Element {
  const label = {
    dataset: { id: "2", labelType: "burg" },
    textContent: "West|watch"
  } as unknown as SVGTextElement;
  return {
    closest: (selector: string) => {
      if (selector === "#labels text[data-label-type][data-id]") return label;
      return null;
    }
  } as unknown as Element;
}

describe("buildMapContext", () => {
  test("collects and de-duplicates overlapping objects at a cell", () => {
    const pack = createPack();
    pack.cells.routes = [{ 1: 7 }];
    const context = buildMapContext({
      cellId: 0,
      clientX: 400,
      clientY: 300,
      elements: [createOverlappingHit()],
      pack,
      point: [120.25, 84.5]
    });

    expect(context.entities.map(entity => entity.key)).toEqual(["label:burg:2", "burg:2", "route:7"]);
    expect(context.title).toBe("Westwatch label");
    expect(context.entities.find(entity => entity.kind === "route")?.label).toBe("King's Road");
  });

  test("describes the political and environmental data under the pointer", () => {
    const pack = createPack();
    pack.cells.burg[0] = 0;

    const context = buildMapContext({
      cellId: 0,
      clientX: 20,
      clientY: 30,
      elements: [],
      pack,
      point: [10, 15]
    });

    expect(context.title).toBe("Northmarch Province");
    expect(context.areas).toEqual([
      { id: 1, kind: "state", label: "Kingdom of Aster" },
      { id: 1, kind: "province", label: "Northmarch Province" },
      { id: 1, kind: "culture", label: "Highland" },
      { id: 1, kind: "religion", label: "Old Faith" },
      { id: 1, kind: "biome", label: "Temperate grassland" }
    ]);
  });
});
