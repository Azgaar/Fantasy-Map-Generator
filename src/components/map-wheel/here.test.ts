import { describe, expect, it, vi } from "vitest";
import type { WheelContext, WheelSubject } from "./context";
import { hereRoot } from "./here";
import { childrenOf } from "./types";

const action = (label: string) => ({ label, icon: "icon-star", verb: "open" as const, run: vi.fn() });

const subject = (name: string, count: number): WheelSubject => ({
  kind: "Burg",
  name,
  detail: "d",
  icon: "icon-star",
  rank: 1,
  actions: Array.from({ length: count }, (_, i) => action(`a${i}`))
});

const ctx = (subjects: WheelSubject[]): WheelContext => ({
  screen: [0, 0],
  map: [0, 0],
  cellId: 1,
  subjects
});

describe("hereRoot", () => {
  it("lists the subject's actions and a What's here sector", () => {
    const root = hereRoot(ctx([subject("Ashvale", 4)]), 0);
    expect(root.map(n => n.label)).toEqual(["a0", "a1", "a2", "a3", "What's here"]);
  });

  it("fills the root exactly when the subject has six actions", () => {
    const root = hereRoot(ctx([subject("Ashvale", 6)]), 0);
    expect(root.length).toBe(7);
    expect(root.at(-1)!.label).toBe("What's here");
  });

  it("folds the tail into More… rather than overflowing the seven-slot root", () => {
    const root = hereRoot(ctx([subject("Ashvale", 9)]), 0);
    expect(root.length).toBe(7);
    expect(root.map(n => n.label).slice(0, 5)).toEqual(["a0", "a1", "a2", "a3", "a4"]);
    expect(root[5].label).toBe("More…");
    expect(childrenOf(root[5]).map(n => n.label)).toEqual(["a5", "a6", "a7", "a8"]);
  });

  it("puts the whole subject stack behind What's here, each pickable", () => {
    const root = hereRoot(ctx([subject("Ashvale", 2), subject("Aldmere", 2)]), 0);
    const stack = childrenOf(root.at(-1)!);
    expect(stack.map(n => n.label)).toEqual(["Ashvale", "Aldmere"]);
    expect(stack.map(n => n.pick)).toEqual([0, 1]);
    expect(stack[0].note).toBe("Burg");
  });

  it("counts the stack in the What's here note", () => {
    const root = hereRoot(ctx([subject("A", 1), subject("B", 1), subject("C", 1)]), 0);
    expect(root.at(-1)!.note).toBe("3 here");
  });

  it("reads actions from the active subject, not always the first", () => {
    const first = subject("Ashvale", 2);
    const second = subject("Aldmere", 2);
    second.actions = [action("edit province")];
    expect(hereRoot(ctx([first, second]), 1)[0].label).toBe("edit province");
  });

  it("survives an empty subject stack", () => {
    expect(() => hereRoot(ctx([]), 0)).not.toThrow();
  });
});
