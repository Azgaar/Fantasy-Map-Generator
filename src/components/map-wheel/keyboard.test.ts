import { describe, expect, it, vi } from "vitest";
import type { WheelNode } from "./types";
import type { WheelRoots, WheelState } from "./wheel";
import { handleKey } from "./wheel";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => false } }));

const leaf = (label: string, extra: Partial<WheelNode> = {}): WheelNode => ({ label, icon: "icon-star", ...extra });
const roots: WheelRoots = {
  menu: () => [
    leaf("A", { children: [leaf("A1", { run: () => {} })] }),
    leaf("B", { run: () => {} }),
    leaf("C", { run: () => {} })
  ],
  here: () => []
};
const state = (over: Partial<WheelState> = {}): WheelState => ({ mode: "menu", path: [], hot: null, ...over });
const key = (k: string) => new KeyboardEvent("keydown", { key: k });

const spies = () => ({ onState: vi.fn(), onPanel: vi.fn(), onLeaf: vi.fn(), onPick: vi.fn(), onToggle: vi.fn() });

describe("handleKey", () => {
  it("starts at the first sector when nothing is hot", () => {
    const cb = spies();
    handleKey(key("ArrowRight"), roots, state(), cb);
    expect(cb.onState).toHaveBeenCalledWith(expect.objectContaining({ hot: { level: 0, index: 0 } }));
  });

  it("steps around the ring and wraps", () => {
    const cb = spies();
    handleKey(key("ArrowRight"), roots, state({ hot: { level: 0, index: 2 } }), cb);
    expect(cb.onState).toHaveBeenCalledWith(expect.objectContaining({ hot: { level: 0, index: 0 } }));

    const back = spies();
    handleKey(key("ArrowLeft"), roots, state({ hot: { level: 0, index: 0 } }), back);
    expect(back.onState).toHaveBeenCalledWith(expect.objectContaining({ hot: { level: 0, index: 2 } }));
  });

  it("drills outward into an open child ring", () => {
    const cb = spies();
    handleKey(key("ArrowDown"), roots, state({ path: [0], hot: { level: 0, index: 0 } }), cb);
    expect(cb.onState).toHaveBeenCalledWith(expect.objectContaining({ hot: { level: 1, index: 0 } }));
  });

  it("moves back inward toward the hub", () => {
    const cb = spies();
    handleKey(key("ArrowUp"), roots, state({ path: [0], hot: { level: 1, index: 0 } }), cb);
    expect(cb.onState).toHaveBeenCalledWith(expect.objectContaining({ hot: { level: 0, index: 0 } }));
  });

  it("commits the hot sector on Enter", () => {
    const cb = spies();
    handleKey(key("Enter"), roots, state({ hot: { level: 0, index: 1 } }), cb);
    expect(cb.onLeaf).toHaveBeenCalled();
  });

  it("reports whether it consumed the key so the caller knows to preventDefault", () => {
    expect(handleKey(key("ArrowRight"), roots, state(), spies())).toBe(true);
    expect(handleKey(key("q"), roots, state(), spies())).toBe(false);
  });
});
