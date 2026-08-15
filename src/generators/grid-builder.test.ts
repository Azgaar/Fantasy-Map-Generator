import { describe, expect, it } from "vitest";
import { buildGrid } from "./grid-builder";
import { GridGeneration } from "./grid-generation";

describe("buildGrid", () => {
  const request = { seed: "worker-grid", graphWidth: 1000, graphHeight: 600, cellsDesired: 1000 };

  it("is deterministic and produces a complete Voronoi grid", () => {
    const first = buildGrid(request);
    const second = buildGrid(request);

    expect(first.points).toEqual(second.points);
    expect(first.cells.c).toEqual(second.cells.c);
    expect(first.vertices.p).toEqual(second.vertices.p);
    expect(first.cells.i).toEqual(second.cells.i);
    expect(first.cells.i.length).toBe(first.points.length);
    expect(first.cells.i[0]).toBe(0);
    expect(first.cells.i.at(-1)).toBe(first.points.length - 1);
  });

  it("uses a compact index array when the map has fewer than 65,536 cells", () => {
    expect(buildGrid(request).cells.i).toBeInstanceOf(Uint16Array);
  });

  it("falls back to the shared pure builder when workers are unavailable", async () => {
    const previousWorker = globalThis.Worker;
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });
    await expect(GridGeneration.generate(request)).resolves.toMatchObject({ seed: request.seed });
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: previousWorker });
  });
});
