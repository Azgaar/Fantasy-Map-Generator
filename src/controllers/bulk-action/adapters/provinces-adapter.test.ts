import { beforeEach, describe, expect, it } from "vitest";
import { createProvincesAdapter } from "./provinces-adapter";

// Minimal world: 2 real provinces (+ placeholder 0).
//   province 1 (state 1): owns cells 1 & 2; cell 1 holds burg 1, cell 2 holds burg 2
//   province 2 (state 1, locked): owns cell 3; cell 3 holds burg 3
function makeWorld() {
  return {
    provinces: [
      0,
      { i: 1, state: 1, color: "#aaa", lock: false },
      { i: 2, state: 1, color: "#bbb", lock: true },
      { i: 3, state: 1, color: "#ccc", lock: false, removed: true } // already removed
    ],
    states: [{ i: 0 }, { i: 1, provinces: [1, 2, 3] }],
    burgs: [0, { i: 1 }, { i: 2 }, { i: 3 }],
    cells: {
      province: [0, 1, 1, 2, 0],
      burg: [0, 1, 2, 3, 0]
    }
  };
}

describe("provincesAdapter", () => {
  let adapter: ReturnType<typeof createProvincesAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createProvincesAdapter(() => {});
  });

  it("excludes the placeholder and removed provinces from deletion", () => {
    expect(adapter.isDeletable(0)).toBe(false); // placeholder
    expect(adapter.isDeletable(1)).toBe(true);
    expect(adapter.isDeletable(2)).toBe(true);
    expect(adapter.isDeletable(3)).toBe(false); // removed
    expect(adapter.isDeletable(99)).toBe(false);
  });

  it("offers color and the burgs child kind", () => {
    expect(adapter.supportsColor).toBe(true);
    expect(adapter.childKind).toBe("burgs");
  });

  it("reads row ids from data-id", () => {
    const row = { dataset: { id: "1" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(1);
  });

  it("reports and sets lock", () => {
    expect(adapter.isLocked(2)).toBe(true);
    expect(adapter.isLocked(1)).toBe(false);
    adapter.setLock?.(1, true);
    expect((globalThis as any).pack.provinces[1].lock).toBe(true);
  });

  it("sets color", () => {
    adapter.setColor?.(1, "#123456");
    expect((globalThis as any).pack.provinces[1].color).toBe("#123456");
  });

  it("describeCascade counts deletable provinces and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([1, 2, 3]); // 1 deletable, 2 locked, 3 removed
    expect(summary.deletable).toBe(1);
    expect(summary.skippedLocked).toBe(1);
    expect(summary.lines.join(" ").includes("1 province")).toBe(true);
  });

  it("describeCascade notes contained burgs are unassigned by default", () => {
    const summary = adapter.describeCascade([1]); // province 1 owns burgs 1 & 2
    const text = summary.lines.join(" ");
    expect(text.includes("2 burgs will be unassigned")).toBe(true);
  });

  it("describeCascade notes contained burgs are removed with deleteChildren", () => {
    const summary = adapter.describeCascade([1], { deleteChildren: true });
    const text = summary.lines.join(" ");
    expect(text.includes("2 burgs will be removed")).toBe(true);
  });
});
