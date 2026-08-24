import Alea from "alea";
import { describe, expect, it } from "vitest";
import { buildGrid } from "./grid-builder";
import "./heightmap-generator";

describe("lone island heightmap", () => {
  it.each([
    "lone-island-a",
    "lone-island-b",
    "lone-island-c"
  ])("creates one small connected landmass for seed %s", seed => {
    globalThis.graphWidth = 960;
    globalThis.graphHeight = 540;
    Math.random = Alea(seed);

    const graph = buildGrid({ cellsDesired: 4000, graphHeight, graphWidth, seed });
    const heights = window.HeightmapGenerator.fromTemplate(graph, "loneIsland");
    expect(heights).not.toBeNull();

    const land = new Set(graph.cells.i.filter(cell => (heights?.[cell] ?? 0) >= 20));
    const landShare = land.size / graph.cells.i.length;
    expect(landShare).toBeGreaterThan(0.01);
    expect(landShare).toBeLessThan(0.2);

    const start = land.values().next().value as number;
    const connected = new Set([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      for (const neighbor of graph.cells.c[queue[head]]) {
        if (!land.has(neighbor) || connected.has(neighbor)) continue;
        connected.add(neighbor);
        queue.push(neighbor);
      }
    }

    expect(connected.size).toBe(land.size);
  });
});
