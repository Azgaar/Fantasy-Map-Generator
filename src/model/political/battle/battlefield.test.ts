import { describe, expect, it } from "vitest";
import { BattleScale, COLS, ROWS, SURROUND } from "./battle-scale";
import { type Battlefield, Battlefields } from "./battlefield";

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
