import { describe, expect, it } from "vitest";
import { buildCellFillBatches, normalizeFillColor } from "./pixi-map-data";

describe("buildCellFillBatches", () => {
  it("groups land polygons and skips water and neutral cells", () => {
    const batches = buildCellFillBatches({
      cellIds: [0, 1, 2, 3],
      cellVertices: [
        [0, 1, 2],
        [0, 2, 3],
        [1, 2, 3],
        [0, 1, 3]
      ],
      colors: [{}, { color: "#112233" }],
      groups: Uint8Array.from([1, 1, 0, 1]),
      heights: Uint8Array.from([20, 19, 40, 25]),
      vertexPoints: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ]
    });

    expect(batches).toEqual([
      {
        color: "#112233",
        groupId: 1,
        polygons: [
          [0, 0, 1, 0, 1, 1],
          [0, 0, 1, 0, 0, 1]
        ]
      }
    ]);
  });

  it("drops polygons with missing vertices", () => {
    const batches = buildCellFillBatches({
      cellIds: [0],
      cellVertices: [[0, 1, 9]],
      colors: [{}, { color: "#fff" }],
      groups: Uint8Array.from([1]),
      heights: Uint8Array.from([20]),
      vertexPoints: [
        [0, 0],
        [1, 0]
      ]
    });

    expect(batches).toEqual([]);
  });
});

describe("normalizeFillColor", () => {
  it("uses a stable fallback for SVG paint servers", () => {
    expect(normalizeFillColor("url(#hatch1)")).toBe("#888888");
    expect(normalizeFillColor("#abcdef")).toBe("#abcdef");
  });
});
