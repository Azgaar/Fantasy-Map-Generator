import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLS, ROWS } from "@/model/political/battle/battle-scale";
import { type Battlefield, createEmptyBattlefield } from "@/model/political/battle/battlefield";
import { getReliefMarkup } from "./draw-battle-relief";

// a gentle slope east with a knoll in the west and a hollow in the east, rising `relief` metres in all
function getField(relief: number): Battlefield {
  const field = createEmptyBattlefield();
  const bump = (col: number, row: number, x: number, y: number) => Math.exp(-((col - x) ** 2 + (row - y) ** 2) / 40);
  const raw = Array.from({ length: COLS * ROWS }, (_, i) => {
    const [col, row] = [i % COLS, Math.floor(i / COLS)];
    return (0.3 * col) / COLS + 0.6 * bump(col, row, 30, 30) - 0.4 * bump(col, row, 70, 30);
  });
  const [low, high] = [Math.min(...raw), Math.max(...raw)];
  return { ...field, base: 100, relief, elevation: raw.map(v => (v - low) / (high - low)) };
}

const group = (markup: string, name: string): string => markup.split(`class="${name}"`)[1]?.split("</g>\n")[0] ?? "";
const labels = (markup: string): number[] =>
  [...group(markup, "battleContourLabels").matchAll(/>(-?\d+)<\/text>/g)].map(match => +match[1]);

describe("battle relief", () => {
  beforeEach(() => {
    options.map.units.height.unit = "m";
    vi.stubGlobal("document", { ...document, createElement: () => ({ getContext: () => null }) }); // no canvas: no shade
  });
  afterEach(() => vi.unstubAllGlobals());

  it("draws nothing on a level field", () => {
    expect(getReliefMarkup(createEmptyBattlefield(), "#fff")).toBe("");
  });

  it("labels the lines of a low field, every one of them when no index line crosses it", () => {
    const markup = getReliefMarkup(getField(3), "#fff");
    const values = labels(markup);
    expect(values.length).toBeGreaterThan(0);
    expect(values.some(value => value % 5)).toBe(true); // 1 m lines, labelled though none is an index line
  });

  it("labels only the index lines of a field two of them cross", () => {
    const values = labels(getReliefMarkup(getField(110), "#fff")); // 10 m lines from 110 to 200: index lines at 150 and 200
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(value => value % 50 === 0)).toBe(true); // 10 m lines, every fifth labelled
  });

  it("marks the knoll as a top and the hollow as a hollow, low field or high", () => {
    for (const relief of [3, 100]) {
      const heights = group(getReliefMarkup(getField(relief), "#fff"), "battleHeights");
      expect(heights.match(/stroke="none"/g)).toHaveLength(1); // ▲
      expect(heights.match(/fill="none"/g)).toHaveLength(1); // ▽
    }
  });

  it("draws hachures on a gentle field too", () => {
    expect(group(getReliefMarkup(getField(3), "#fff"), "battleHachures")).toContain("<path");
  });
});
