import { beforeEach, describe, expect, it } from "vitest";
import { createStatesAdapter } from "./states-adapter";

function makeWorld() {
  return {
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Alpha", provinces: [1], military: [{ i: 0 }], neighbors: [2], lock: false },
      { i: 2, name: "Beta", provinces: [2], neighbors: [1, 3], lock: false },
      { i: 3, name: "Gamma", neighbors: [2], lock: true }
    ],
    burgs: [
      0,
      { i: 1, state: 1, capital: 1, cell: 1 },
      { i: 2, state: 1, capital: 0, cell: 2 },
      { i: 3, state: 2, capital: 0, cell: 3 },
      { i: 4, state: 3, capital: 0, cell: 4 }
    ],
    provinces: [0, { i: 1, state: 1 }, { i: 2, state: 2 }],
    cells: { state: [0, 1, 1, 2, 3, 0], province: [0, 1, 1, 2, 0, 0], burg: [0, 1, 2, 3, 4, 0] }
  };
}

describe("statesAdapter", () => {
  let adapter: ReturnType<typeof createStatesAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    (globalThis as any).notes = [{ id: "regiment1-0" }, { id: "note-keep" }];
    adapter = createStatesAdapter(() => {});
  });

  it("treats the neutral state and removed states as non-deletable", () => {
    expect(adapter.isDeletable(0)).toBe(false);
    expect(adapter.isDeletable(1)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false);
  });

  it("reports lock status", () => {
    expect(adapter.isLocked(1)).toBe(false);
    expect(adapter.isLocked(3)).toBe(true);
  });

  it("supports color and reads row ids from data-id", () => {
    expect(adapter.supportsColor).toBe(true);
    const row = { dataset: { id: "2" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(2);
  });

  it("describeCascade counts states, reassigned burgs and removed provinces", () => {
    const summary = adapter.describeCascade([1, 2]);
    const text = summary.lines.join(" ");
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(text.includes("2 states")).toBe(true);
    expect(text.includes("3 burgs")).toBe(true); // burgs 1,2 (state1) + 3 (state2)
    expect(text.includes("2 provinces")).toBe(true);
  });

  it("describeCascade excludes the neutral state and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([0, 1, 3]); // 0 not deletable, 3 locked
    expect(summary.deletable).toBe(1); // only state 1
    expect(summary.skippedLocked).toBe(1); // state 3
  });

  it("deleteEntity over a multi-state selection mutates pack like single-delete", () => {
    adapter.deleteEntity(1);
    adapter.deleteEntity(2);
    const { states, burgs, provinces, cells } = (globalThis as any).pack;
    expect(states[1].removed).toBe(true);
    expect(states[2].removed).toBe(true);
    expect(burgs.slice(1).map((b: any) => b.state)).toEqual([0, 0, 0, 3]);
    expect(provinces[1].removed).toBe(true);
    expect(provinces[2].removed).toBe(true);
    expect(cells.state).toEqual([0, 0, 0, 0, 3, 0]);
  });

  it("declares burgs as its child kind", () => {
    expect(adapter.childKind).toBe("burgs");
  });

  it("describeCascade reflects the deleteChildren option", () => {
    const reassign = adapter.describeCascade([1, 2]);
    expect(reassign.lines.join(" ").includes("reassigned to neutral")).toBe(true);

    const withChildren = adapter.describeCascade([1, 2], { deleteChildren: true });
    const text = withChildren.lines.join(" ");
    expect(text.includes("3 burgs")).toBe(true);
    expect(text.includes("removed")).toBe(true);
    expect(text.includes("reassigned to neutral")).toBe(false);
  });

  it("deleteEntity with deleteChildren removes contained burgs", () => {
    adapter.deleteEntity(1, { deleteChildren: true });
    const { burgs } = (globalThis as any).pack;
    expect(burgs[1].removed).toBe(true);
    expect(burgs[2].removed).toBe(true);
  });

  it("setLock locks and unlocks a state", () => {
    adapter.setLock?.(1, true);
    expect((globalThis as any).pack.states[1].lock).toBe(true);
    expect(adapter.isLocked(1)).toBe(true);
    adapter.setLock?.(1, false);
    expect((globalThis as any).pack.states[1].lock).toBe(false);
  });

  it("a state locked via setLock then resists bulk delete (counted as skipped)", () => {
    adapter.setLock?.(1, true);
    const summary = adapter.describeCascade([1, 2]);
    expect(summary.deletable).toBe(1); // only state 2
    expect(summary.skippedLocked).toBe(1); // state 1 now locked
  });

  it("setColor sets a state's color", () => {
    adapter.setColor?.(2, "#abcdef");
    expect((globalThis as any).pack.states[2].color).toBe("#abcdef");
  });

  it("invokes the injected redraw", () => {
    let redrawn = 0;
    const a = createStatesAdapter(() => {
      redrawn += 1;
    });
    a.redraw();
    expect(redrawn).toBe(1);
  });
});
