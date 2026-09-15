import { describe, expect, test } from "vitest";
import { getLakeRipples, type LakeEmbellishment } from "./lake-ripples";

const style: LakeEmbellishment = {
  embellishment: "ripples",
  density: 1,
  length: 1,
  halo: 0.2,
  color: "#000000",
  width: 0.3,
  opacity: 0.65
};
const rectangle = (width: number, height: number): [number, number][] => [
  [0, 0],
  [width, 0],
  [width, height],
  [0, height]
];
const starts = (path: string) => [...path.matchAll(/M([\d.-]+),([\d.-]+)/g)].map(m => [+m[1], +m[2]]);

describe("lake ripples", () => {
  test("uses only a few open strokes on small lakes and leaves tiny ponds plain", () => {
    const small = getLakeRipples(rectangle(12, 10), 8, style, "lake");
    expect(starts(small.path).length).toBeGreaterThan(1);
    expect(starts(small.path).length).toBeLessThanOrEqual(5);
    expect(getLakeRipples(rectangle(6, 4), 8, style, "lake").path).toBe("");
    expect(small.path).not.toMatch(/NaN|Infinity/);
    expect(getLakeRipples(rectangle(1, 1), 8, style, "lake").path).toBe("");
    expect(getLakeRipples(rectangle(80, 40), 8, { ...style, embellishment: "none" }, "lake").path).toBe("");
  });

  test("keeps small lake strokes separated even at maximum density", () => {
    const { path } = getLakeRipples(rectangle(24, 20), 8, { ...style, density: 4 }, "lake");
    const marks = starts(path);
    expect(marks.length).toBeLessThanOrEqual(5);
    expect(marks.every(([x, y]) => x > 2 && y > 4 && y < 16)).toBe(true);
    expect([...path.matchAll(/t/g)].length).toBe(marks.length);
    expect(path).toBe(getLakeRipples(rectangle(24, 20), 8, { ...style, density: 4 }, "lake").path);
  });

  test("fits strokes between banks, including separate spans in a concave lake", () => {
    const points: [number, number][] = [
      [0, 0],
      [40, 0],
      [40, 40],
      [30, 40],
      [30, 10],
      [10, 10],
      [10, 40],
      [0, 40]
    ];
    const { path, gap } = getLakeRipples(points, 8, { ...style, embellishment: "lines", length: 4 }, "lake");
    for (const mark of path.matchAll(/M([\d.-]+),([\d.-]+)h([\d.-]+)/g)) {
      const [x, y, length] = mark.slice(1).map(Number);
      expect(x).toBeGreaterThanOrEqual(gap - 0.01);
      expect(x + length).toBeLessThanOrEqual(40 - gap + 0.01);
      if (y > 10) expect(x + length <= 10 - gap + 0.01 || x >= 30 + gap - 0.01).toBe(true);
    }
    expect(starts(path).length).toBeGreaterThan(0);
  });

  test("is deterministic and responds to density and shape edits", () => {
    const points = rectangle(80, 40);
    const first = getLakeRipples(points, 8, style, "lake").path;
    expect(getLakeRipples(points, 8, style, "lake").path).toBe(first);
    expect(getLakeRipples(points, 8, style, "other").path).not.toBe(first);
    expect(getLakeRipples(rectangle(80, 20), 8, style, "lake").path).not.toBe(first);
    expect(starts(getLakeRipples(points, 8, { ...style, density: 2 }, "lake").path).length).toBeGreaterThan(
      starts(first).length
    );
  });

  test("concentrates fine waves near all banks and leaves the centre of a large lake open", () => {
    const { path } = getLakeRipples(rectangle(240, 160), 8, style, "lake");
    const marks = starts(path);
    expect(marks.some(([x, y]) => x > 60 && x < 180 && y < 20)).toBe(true);
    expect(marks.some(([x, y]) => x < 20 && y > 40 && y < 120)).toBe(true);
    expect(marks.some(([x, y]) => x > 60 && x < 180 && y > 40 && y < 120)).toBe(false);
    expect(path).toMatch(/t/);
  });
});
