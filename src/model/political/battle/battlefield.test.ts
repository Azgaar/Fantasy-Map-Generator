import { describe, expect, it } from "vitest";
import type { MilitaryUnit } from "@/types/military";
import { type BattleRegiment, Battles } from "./battle";
import { BattleScale, COLS, ROWS, SURROUND } from "./battle-scale";
import { type Battlefield, Battlefields, type FieldWork } from "./battlefield";
import { Works } from "./works";

const [ACROSS, DOWN] = SURROUND;
const size = BattleScale.getFieldSize(355); // COLS × cell misses its width in floating point

/** A flat scene of land round a field of the size, as `build` lays it out */
function createScene(): Battlefield {
  const [cols, rows] = [COLS + ACROSS * 2, ROWS + DOWN * 2];
  const scene = Battlefields.createEmpty(null, cols, rows);
  return { ...scene, ...size, site: [0, 0], width: size.cell * cols, height: size.cell * rows };
}

describe("cut", () => {
  it("keeps the size the scene was built for", () => {
    const field = Battlefields.cut(createScene(), size);
    expect([field.width, field.height, field.cell, field.cols, field.rows]).toEqual([
      size.width,
      size.height,
      size.cell,
      COLS,
      ROWS
    ]);
  });

  it("takes the middle nodes of the scene", () => {
    const scene = createScene();
    const at = (col: number, row: number): number => (row + DOWN) * scene.cols + col + ACROSS;
    scene.wood[at(0, 0)] = 1;
    scene.wood[at(COLS - 1, ROWS - 1)] = 1;
    scene.wood[at(-1, 0)] = 1; // round the field
    const field = Battlefields.cut(scene, size);
    expect(field.wood[0]).toBe(1);
    expect(field.wood[COLS * ROWS - 1]).toBe(1);
    expect(field.wood.filter(Boolean)).toHaveLength(2);
  });

  it("measures heights from the field's own lowest land", () => {
    const scene = createScene();
    [scene.base, scene.relief] = [100, 50];
    scene.elevation.fill(1);
    scene.elevation[0] = 0; // the lowest of the scene lies round the field
    scene.elevation[DOWN * scene.cols + ACROSS] = 0.5;
    const field = Battlefields.cut(scene, size);
    expect([field.base, field.relief]).toEqual([125, 25]);
    expect(field.elevation[0]).toBe(0);
    expect(field.elevation[1]).toBe(1);
  });

  it("keeps the burgs that reach the field and the cliffs over it, run just past its edge", () => {
    const scene = createScene();
    const [dx, dy] = [ACROSS * size.cell, DOWN * size.cell];
    const burg = (x: number, radius: number) => ({
      x,
      y: scene.height / 2,
      radius,
      name: "",
      group: "",
      walled: false,
      outline: []
    });
    scene.burgs = [burg(dx / 2, dx), burg(dx / 4, dx / 8)]; // the first reaches the field
    scene.cliffs = [{ a: [0, dy + 50], b: [scene.width, dy + 50], height: 10 }];
    const field = Battlefields.cut(scene, size);
    expect(field.burgs.map(({ x }) => x)).toEqual([-dx / 2]);
    expect(field.cliffs).toHaveLength(1);
    const [{ a, b }] = field.cliffs;
    expect(a[0]).toBeCloseTo(-size.cell);
    expect(b[0]).toBeCloseTo(size.width + size.cell);
    expect(a[1]).toBeCloseTo(50);
  });
});

describe("leadWay", () => {
  const field = (): Battlefield => ({ ...Battlefields.createEmpty(), ...size });
  const line = (f: Battlefield): [number, number][] => [
    [f.cell, f.height / 2],
    [f.width - f.cell, f.height / 2]
  ];
  const free = (): number => 0;

  it("goes straight over level open ground", () => {
    const f = field();
    const way = Battlefields.leadWay(f, line(f), free)!;
    expect(way[0]).toEqual(line(f)[0]);
    expect(way.at(-1)).toEqual(line(f)[1]);
    for (const [, y] of way) expect(Math.abs(y - f.height / 2)).toBeLessThan(f.cell);
  });

  it("goes round a hill rather than over it", () => {
    const f = field();
    f.relief = 60;
    f.elevation = f.elevation.map((_, node) => {
      const [x, y] = Battlefields.nodeCentre(f, node);
      return Math.exp(-((x - f.width / 2) ** 2 + (y - f.height / 2) ** 2) / (2 * (2.5 * f.front) ** 2));
    });
    const way = Battlefields.leadWay(f, line(f), free)!;
    const highest = Math.max(...way.map(([x, y]) => Battlefields.terrainAt(f, x, y).height));
    expect(highest).toBeLessThan(0.6); // the line the map draws goes over the top, at 1
    expect(Math.max(...way.map(([, y]) => Math.abs(y - f.height / 2)))).toBeGreaterThan(2 * f.front);
  });

  it("keeps off what its toll bars, crosses what is dear once, and finds no way where there is none", () => {
    const f = field();
    const col = Math.floor(COLS / 2);
    const gap = 12; // the row of the only way through
    const lake = (node: number): number => (node % COLS === col && Math.floor(node / COLS) !== gap ? Infinity : 0);
    const through = Battlefields.leadWay(f, line(f), lake)!;
    for (const [x, y] of through) expect(lake(Battlefields.nodeAt(f, x, y))).toBe(0);
    expect(Battlefields.leadWay(f, line(f), node => (node % COLS === col ? Infinity : 0))).toBeNull();

    const river = (node: number): number => (Math.abs((node % COLS) - col) < 2 ? 8 : 0);
    const over = Battlefields.leadWay(f, line(f), river)!.map(([x, y]) => river(Battlefields.nodeAt(f, x, y)) > 0);
    expect(over.filter((wet, i) => wet && !over[i - 1])).toHaveLength(1);
    expect(over.filter(Boolean).length).toBeLessThanOrEqual(4); // square to it
  });
});

describe("squareCrossings", () => {
  type Inside = { squareCrossings: (field: Battlefield, road: [number, number][]) => [number, number][] };
  const square = (field: Battlefield, road: [number, number][]) =>
    (Battlefields as unknown as Inside).squareCrossings(field, road);

  it("lays a road straight across a river it crosses askew, and leaves the rest of it alone", () => {
    const f: Battlefield = { ...Battlefields.createEmpty(), ...size };
    const [mx, my] = [f.width / 2, f.height / 2];
    f.rivers = [
      {
        ...{ width: 30, name: "", brook: false },
        points: [
          [mx - my, 0],
          [mx + my, f.height]
        ] // at 45° to the road
      }
    ];
    const road = Battlefields.densify(
      [
        [0, my],
        [f.width, my]
      ],
      f.cell / 2
    );
    const led = square(f, road);
    const at = led.findIndex(([x, y]) => Math.abs(x - mx) < 1e-6 && Math.abs(y - my) < 1e-6);
    expect(at).toBeGreaterThan(0);
    const [[ax, ay], [bx, by]] = [led[at - 1], led[at + 1]];
    expect(Math.abs((bx - ax) * 1 + (by - ay) * 1)).toBeLessThan(1e-6); // square to the stream, which runs along (1, 1)
    expect(Math.hypot(bx - ax, by - ay)).toBeGreaterThan(30 + 28); // from beyond a bridge's end to beyond the other
    expect(led.slice(0, 10)).toEqual(road.slice(0, 10));
    expect(led.slice(-10)).toEqual(road.slice(-10));
    // a road with no river to cross is not touched
    expect(square({ ...f, rivers: [] }, road)).toBe(road);
  });
});

describe("wagon ring", () => {
  const unit = (name: string, type: string, speed: number, range: number): MilitaryUnit => ({
    ...{ icon: "", name, rural: 0, urban: 0, crew: 1, attack: 1, defense: 1, morale: 1, separate: 0 },
    ...{ type, speed, range }
  });
  const units = [
    unit("infantry", "melee", 4.3, 0),
    unit("archers", "ranged", 4.3, 160),
    unit("cavalry", "mounted", 12.6, 0)
  ];
  const regiment = (state: number, troops: Record<string, number>): BattleRegiment => ({
    ...{ state, i: 0, name: `Regiment ${state}`, icon: "", troops },
    ...{ upkeep: 1, stability: 0.5, distance: 0 }
  });
  const inside = ([x, y]: [number, number], works: FieldWork[]): boolean => {
    let within = false;
    for (const { a, b } of works)
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) within = !within;
    return within;
  };

  it("keeps the corners of every battalion on the ring within its wagons, the gaps between them wide or not", () => {
    for (const defenders of [
      { infantry: 600, archers: 100 },
      { infantry: 900, archers: 300 }
    ]) {
      const b = Battles.create({
        ...{
          type: "field",
          name: "Test",
          place: null,
          x: 0,
          y: 0,
          cell: 0,
          axis: 0,
          field: Battlefields.createEmpty()
        },
        ...{ units, populationScale: 1000 },
        attackers: [regiment(1, { infantry: 900, archers: 300, cavalry: 1600 })],
        defenders: [regiment(2, defenders)]
      });
      Battles.intervene(b, { tick: 0, kind: "tactic", side: "defenders", tactic: "wagenburg" });
      Battles.tick(b);
      b.field.works = [];
      Works.layWorks(b, "defenders");
      const wagons = b.field.works.filter(work => work.side === "defenders");
      const ring = b.battalions.filter(battalion => battalion.side === "defenders" && battalion.order.rank === 0);
      expect(ring.length).toBe(3);
      for (const wagon of wagons) expect(wagons.filter(other => other.a === wagon.b)).toHaveLength(1); // closed
      for (const { order, depth, width, key } of ring) {
        const [fx, fy] = [Math.cos(order.facing), Math.sin(order.facing)];
        for (const [ahead, aside] of [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1]
        ]) {
          const corner: [number, number] = [
            order.x + (fx * depth * ahead - fy * width * aside) / 2,
            order.y + (fy * depth * ahead + fx * width * aside) / 2
          ];
          expect(inside(corner, wagons), key).toBe(true);
        }
      }
    }
  });
});
