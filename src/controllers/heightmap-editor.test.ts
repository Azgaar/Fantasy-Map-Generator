import { describe, expect, it } from "vitest";

(globalThis as Record<string, unknown>).ERROR = false;
(globalThis as Record<string, unknown>).changeViewMode = () => {};
const originalGetElementById = document.getElementById;
document.getElementById = (() =>
  ({
    on: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {}
  }) as unknown as HTMLElement) as typeof document.getElementById;
const { createAvailableLandCellFinder } = await import("./heightmap-editor");
document.getElementById = originalGetElementById;

describe("createAvailableLandCellFinder", () => {
  const cells: Parameters<typeof createAvailableLandCellFinder>[0] = {
    h: [25, 30, 18, 40],
    p: [
      [0, 0],
      [10, 0],
      [5, 0],
      [100, 0]
    ]
  };

  it("returns the nearest land cell and removes it from later assignments", () => {
    const findCell = createAvailableLandCellFinder(cells);

    expect(findCell(1, 0)).toBe(0);
    expect(findCell(1, 0)).toBe(1);
    expect(findCell(1, 0)).toBe(3);
  });

  it("never returns water cells", () => {
    const findCell = createAvailableLandCellFinder(cells);

    expect(findCell(5, 0)).not.toBe(2);
  });

  it("returns undefined when no land cell remains", () => {
    const findCell = createAvailableLandCellFinder({ h: [10], p: [[0, 0]] });

    expect(findCell(0, 0)).toBeUndefined();
  });
});
