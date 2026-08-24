import { describe, expect, it } from "vitest";
import { buildCellFillAttributes, parseColor, updateCellFillAttributes } from "./cell-fill-attributes";
import { buildRetainedCellTopology } from "./retained-cell-topology";

const topology = buildRetainedCellTopology({
  cellIds: [0, 1],
  cellVertices: [
    [0, 1, 2],
    [1, 3, 2]
  ],
  revision: 1,
  vertexPoints: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ]
});

describe("cell fill attributes", () => {
  it("duplicates semantic group colors over each retained cell vertex", () => {
    const attributes = buildCellFillAttributes(topology, {
      assignments: Uint8Array.from([1, 2]),
      colors: [{}, { color: "#ff0000" }, { color: "#00ff00" }],
      fallbackColor: "#888888",
      heights: Uint8Array.from([20, 20])
    });

    expect([...attributes.slice(0, 12)]).toEqual([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
    expect([...attributes.slice(12)]).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
  });

  it("updates only requested cells and makes water or neutral cells transparent", () => {
    const attributes = new Float32Array(topology.vertexCount * 4).fill(1);
    const update = updateCellFillAttributes(
      attributes,
      topology,
      {
        assignments: Uint8Array.from([1, 0]),
        colors: [{}, { color: "#123456" }],
        fallbackColor: "#888888",
        heights: Uint8Array.from([20, 20])
      },
      [1]
    );

    expect(update).toEqual({ vertexCount: 3, vertexOffset: 3 });
    expect([...attributes.slice(0, 12)]).toEqual(new Array(12).fill(1));
    expect([...attributes.slice(12)]).toEqual(new Array(12).fill(0));
  });

  it("uses the fallback for SVG paint servers and parses legacy computed rgb colors", () => {
    const attributes = buildCellFillAttributes(topology, {
      assignments: Uint8Array.from([1, 1]),
      colors: [{}, { color: "url(#hatch1)" }],
      fallbackColor: "rgb(128, 64, 0)",
      heights: Uint8Array.from([20, 19])
    });

    expect(attributes[0]).toBeCloseTo(128 / 255);
    expect(attributes[1]).toBeCloseTo(64 / 255);
    expect([...attributes.slice(2, 4)]).toEqual([0, 1]);
    expect([...attributes.slice(12, 16)]).toEqual([0, 0, 0, 0]);
    expect(parseColor("#abc")).toEqual([170 / 255, 187 / 255, 204 / 255]);
  });
});
