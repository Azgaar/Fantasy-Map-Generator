import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COLS, ROWS } from "@/model/political/battle/battle-scale";
import { type Battlefield, Battlefields } from "@/model/political/battle/battlefield";
import { BattleReliefView } from "./draw-battle-relief";

const bump = (col: number, row: number, x: number, y: number) => Math.exp(-((col - x) ** 2 + (row - y) ** 2) / 40);

// a gentle slope east with a knoll in the west and a hollow in the east, rising `relief` metres in all
function getField(
  relief: number,
  shape = (col: number, row: number) => 0.6 * bump(col, row, 30, 30) - 0.4 * bump(col, row, 70, 30)
): Battlefield {
  const field = Battlefields.createEmpty();
  const raw = Array.from({ length: COLS * ROWS }, (_, i) => {
    const [col, row] = [i % COLS, Math.floor(i / COLS)];
    return (0.3 * col) / COLS + shape(col, row);
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
    expect(BattleReliefView.getMarkup(Battlefields.createEmpty(), "#fff")).toBe("");
  });

  it("labels the lines of a low field, every one of them when no index line crosses it", () => {
    const markup = BattleReliefView.getMarkup(getField(3), "#fff");
    const values = labels(markup);
    expect(values.length).toBeGreaterThan(0);
    expect(values.some(value => value % 5)).toBe(true); // 1 m lines, labelled though none is an index line
  });

  it("labels only the index lines of a field two of them cross", () => {
    const values = labels(BattleReliefView.getMarkup(getField(110), "#fff")); // 10 m lines from 110 to 200: index lines at 150 and 200
    expect(values.length).toBeGreaterThan(0);
    expect(values.every(value => value % 50 === 0)).toBe(true); // 10 m lines, every fifth labelled
  });

  it("marks the knoll as a top and the hollow as a hollow, low field or high", () => {
    for (const relief of [3, 100]) {
      const heights = group(BattleReliefView.getHeightsMarkup(getField(relief), "#fff"), "battleHeights");
      expect(heights.match(/stroke="none"/g)).toHaveLength(1); // ▲
      expect(heights.match(/fill="none"/g)).toHaveLength(1); // ▽
    }
  });

  it("takes a shallow dip in high ground for no hollow, but marks the lowest and the highest land", () => {
    const field = getField(30, (col, row) => -0.02 * bump(col, row, 85, 30));
    const heights = group(BattleReliefView.getHeightsMarkup(field, "#fff"), "battleHeights");
    const at = [...heights.matchAll(/translate\(([\d.]+) [\d.]+\)"><path[^>]*(stroke="none"|fill="none")/g)].map(
      ([, x, kind]) => [Math.floor(+x / field.cell), kind]
    );
    expect(at).toEqual([
      [COLS - 3, 'stroke="none"'], // ▲ on the east edge the slope rises to
      [2, 'fill="none"'] // ▽ on the west edge, not in the dip
    ]);
  });

  it("marks the lowest and the highest land of a plain slope", () => {
    const heights = group(
      BattleReliefView.getHeightsMarkup(
        getField(5, () => 0),
        "#fff"
      ),
      "battleHeights"
    );
    expect(heights.match(/stroke="none"/g)).toHaveLength(1);
    expect(heights.match(/fill="none"/g)).toHaveLength(1);
  });

  it("marks nothing on a field under a height unit high", () => {
    expect(
      group(
        BattleReliefView.getHeightsMarkup(
          getField(0.5, () => 0),
          "#fff"
        ),
        "battleHeights"
      )
    ).not.toMatch(/<path/);
  });

  it("draws a low field's hachures and shade fainter than a high one's", () => {
    const opacity = (relief: number) =>
      +group(BattleReliefView.getMarkup(getField(relief), "#fff"), "battleHachures").match(/opacity="([\d.]+)"/)![1];
    expect(opacity(3)).toBeLessThan(opacity(100));
  });

  it("starts and ends every hachure within the field", () => {
    const field = getField(100);
    const strokes = group(BattleReliefView.getMarkup(field, "#fff"), "battleHachures");
    const numbers = [...strokes.matchAll(/[ML](-?\d+) (-?\d+)/g)].map(([, x, y]) => [+x, +y]);
    expect(numbers.length).toBeGreaterThan(0);
    expect(
      numbers.every(([x, y]) => x >= 0 && y >= 0 && x <= Math.round(field.width) && y <= Math.round(field.height))
    ).toBe(true);
  });

  it("draws hachures on a gentle field too", () => {
    expect(group(BattleReliefView.getMarkup(getField(3), "#fff"), "battleHachures")).toContain("<path");
  });
});
