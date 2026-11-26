// Battlefields built on real generated maps
import { beforeAll, describe, expect, it, vi } from "vitest";
import { generateMap } from "@/model/real-map.testing";
import { BattleScale, COLS, ROWS } from "./battle-scale";
import { BattleSite } from "./battle-site";
import { Battlefields } from "./battlefield";
import { CLIFFS } from "./cliffs";

beforeAll(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));
const size = BattleScale.getFieldSize(300);
const MIDDLE = (ROWS / 2) * COLS + COLS / 2;

/** Land cells whose centre is within so many map pixels of the map's edge */
const byEdge = (reach: number): number[] => {
  const { width, height } = options.map.graph;
  return pack.cells.i.filter(i => {
    const [x, y] = pack.cells.p[i];
    return pack.cells.h[i] >= 20 && Math.min(x, y, width - x, height - y) < reach;
  });
};

describe("battlefield on a real map", () => {
  it("keeps an island in a lake land, as the map draws it", async () => {
    await generateMap({ seed: "probe-1", template: "mediterranean", points: 4000 });
    const { cells } = pack;
    const islands = pack.features.filter(f => f?.land && f.subtype === "lake_island");
    expect(islands.length).toBeGreaterThan(0);
    for (const island of islands) {
      const cell = cells.i.find(i => cells.f[i] === island.i && !cells.burg[i] && !cells.r[i]);
      if (cell === undefined) continue;
      const field = Battlefields.cut(Battlefields.build(...cells.p[cell], size), size);
      expect(field.water[MIDDLE], `island ${island.i}`).toBe(0);
      expect(field.lake[MIDDLE] ?? 0).toBe(0);
    }
  });

  it("lays the ground by the map's edge without jumps, the same every time", async () => {
    await generateMap({ seed: "probe-1", template: "mediterranean", points: 4000 });
    CLIFFS.on = false;
    try {
      for (const cell of byEdge(BattleSite.getSpacing() * 0.8)) {
        const field = Battlefields.cut(Battlefields.build(...pack.cells.p[cell], size), size);
        const height = (node: number): number => field.base + field.elevation[node] * field.relief;
        let worst = 0;
        for (let node = 0; node < COLS * ROWS; node++) {
          for (const next of [node % COLS < COLS - 1 ? node + 1 : -1, node + COLS < COLS * ROWS ? node + COLS : -1]) {
            if (next < 0 || field.water[node] === 1 || field.water[next] === 1) continue;
            if ((field.lake[node] ?? 0) !== (field.lake[next] ?? 0)) continue; // a dry lake's bed is flat
            worst = Math.max(worst, Math.abs(height(node) - height(next)));
          }
        }
        expect(worst, `cell ${cell}`).toBeLessThan(10);
      }
      const [x, y] = pack.cells.p[14];
      expect(JSON.stringify(Battlefields.build(x, y, size))).toBe(JSON.stringify(Battlefields.build(x, y, size)));
    } finally {
      CLIFFS.on = true;
    }
  });

  it("sites an ambush on the road of its cell, and bridges every river square to the stream", async () => {
    await generateMap({ seed: "probe-1", template: "mediterranean", points: 4000 });
    const { cells } = pack;
    const land = Array.from(cells.i).filter(i => cells.h[i] >= 20 && !cells.burg[i]);
    const roads = land.filter(i => BattleSite.hasRoad(i));
    expect(roads.length).toBeGreaterThan(20);
    expect(land.some(i => !BattleSite.hasRoad(i))).toBe(true);

    const middle: [number, number] = [size.width / 2, size.height / 2];
    for (const cell of roads.filter(i => !cells.r[i]).slice(0, 12)) {
      const [x, y] = cells.p[cell];
      const off = BattleSite.getSpacing() / 4; // a regiment stands where it likes in its cell
      const field = Battlefields.cut(Battlefields.build(x + off, y - off, size, "ambush"), size);
      const nearest = Math.min(...field.roads.map(road => Battlefields.distanceToLine(middle, road)));
      expect(nearest, `cell ${cell}`).toBeLessThan(size.height / 4); // led over the ground, it is still the column's road
    }

    let bridges = 0;
    for (const cell of roads.filter(i => cells.r[i])) {
      const field = Battlefields.cut(Battlefields.build(...cells.p[cell], size), size);
      for (const bridge of field.bridges) {
        const at: [number, number] = [bridge.x, bridge.y];
        const stretches = field.rivers.flatMap(river => river.points.slice(1).map((b, j) => [river.points[j], b]));
        const [a, b] = stretches.reduce((best, next) =>
          Battlefields.distanceToLine(at, next) < Battlefields.distanceToLine(at, best) ? next : best
        );
        const skew = Math.abs(Math.cos(bridge.angle - Math.atan2(b[1] - a[1], b[0] - a[0]))); // 0 square to the stream
        expect(skew, `cell ${cell}`).toBeLessThan(Math.sin((15 * Math.PI) / 180));
        bridges++;
      }
    }
    expect(bridges).toBeGreaterThan(3);
  });

  it("finds no shore on the map's edge", async () => {
    await generateMap({ seed: "probe-2", template: "taklamakan", points: 4000 });
    const { width, height } = options.map.graph;
    const cells = byEdge(BattleSite.getSpacing() * 0.8);
    expect(cells.length).toBeGreaterThan(10);
    for (const cell of cells) {
      const shore = BattleSite.getShore(pack.cells.p[cell]);
      if (shore)
        expect(Math.min(shore[0], shore[1], width - shore[0], height - shore[1]), `cell ${cell}`).toBeGreaterThan(0.01);
    }
  });
});
