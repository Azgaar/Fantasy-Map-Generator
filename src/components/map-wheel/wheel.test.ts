import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WheelNode } from "./types";
import { renderWheel, resolveLevels, type WheelRoots, type WheelState } from "./wheel";

const leaf = (label: string, extra: Partial<WheelNode> = {}): WheelNode => ({ label, icon: "icon-star", ...extra });

const TREE: WheelNode[] = [
  leaf("Layers", { children: [leaf("Terrain", { children: [leaf("Rivers", { toggle: "rivers" })] })] }),
  leaf("Style", { panel: { host: "styleContent", title: "Style" } }),
  leaf("About", { run: () => {} }),
  leaf("Tools", { children: [leaf("Edit", { run: () => {} })] })
];

const roots: WheelRoots = { menu: () => TREE, here: () => [leaf("Edit burg", { run: () => {} })] };
const state = (over: Partial<WheelState> = {}): WheelState => ({ mode: "menu", path: [], hot: null, ...over });

let container: HTMLElement;
const cb = () => ({
  onState: vi.fn(),
  onPanel: vi.fn(),
  onLeaf: vi.fn(),
  onPick: vi.fn(),
  onToggle: vi.fn()
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
});

describe("resolveLevels", () => {
  it("returns one level for an unopened root", () => {
    expect(resolveLevels(roots, state()).length).toBe(1);
  });

  it("returns one level per open path entry", () => {
    expect(resolveLevels(roots, state({ path: [0] })).length).toBe(2);
    expect(resolveLevels(roots, state({ path: [0, 0] })).length).toBe(3);
  });

  it("stops at the depth cap rather than overflowing the bands", () => {
    const deep = resolveLevels(roots, state({ path: [0, 0, 0, 0, 0] }));
    expect(deep.length).toBeLessThanOrEqual(4);
  });

  it("does not open a level for a node whose children are empty", () => {
    const empty: WheelRoots = { menu: () => [leaf("Empty", { children: [] })], here: () => [] };
    expect(resolveLevels(empty, state({ path: [0] })).length).toBe(1);
  });
});

describe("renderWheel", () => {
  it("draws one path per sector in the root ring", () => {
    renderWheel(container, roots, state(), cb());
    expect(container.querySelectorAll("path.mw-sector").length).toBe(4);
  });

  it("draws a spine for every level below the root", () => {
    renderWheel(container, roots, state({ path: [0] }), cb());
    expect(container.querySelectorAll("line.mw-spine").length).toBe(1);
  });

  it("puts labels in an HTML layer, not in SVG text, so they never intercept clicks", () => {
    renderWheel(container, roots, state(), cb());
    expect(container.querySelectorAll("svg text").length).toBe(0);
    expect(container.querySelectorAll(".mw-label").length).toBe(4);
  });

  it("paints the chosen ancestor dark and dims its siblings", () => {
    renderWheel(container, roots, state({ path: [0] }), cb());
    const [chosen, sibling] = [...container.querySelectorAll("path.mw-sector")];
    expect(chosen.getAttribute("fill")).toBe("#4a3a22");
    expect(sibling.getAttribute("fill")).toBe("rgba(251,247,236,.82)");
  });

  it("marks a node with children so the user can see there is more", () => {
    renderWheel(container, roots, state(), cb());
    expect(container.querySelector(".mw-label")!.textContent).toContain("▸");
  });

  it("opens a child ring when a parent sector is clicked", () => {
    const spies = cb();
    renderWheel(container, roots, state(), spies);
    container.querySelectorAll("path.mw-sector")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spies.onState).toHaveBeenCalledWith(expect.objectContaining({ path: [0] }));
  });

  it("collapses when the already-chosen sector is clicked again", () => {
    const spies = cb();
    renderWheel(container, roots, state({ path: [0] }), spies);
    container.querySelectorAll("path.mw-sector")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spies.onState).toHaveBeenCalledWith(expect.objectContaining({ path: [] }));
  });

  it("swaps branch without disturbing anything when a dimmed sibling is clicked", () => {
    const spies = cb();
    renderWheel(container, roots, state({ path: [0] }), spies);
    container.querySelectorAll("path.mw-sector")[3].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spies.onState).toHaveBeenCalledWith(expect.objectContaining({ path: [3] }));
  });

  it("reports a panel node instead of opening a ring", () => {
    const spies = cb();
    renderWheel(container, roots, state(), spies);
    container.querySelectorAll("path.mw-sector")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spies.onPanel).toHaveBeenCalledWith(expect.objectContaining({ host: "styleContent" }), expect.any(Number));
    expect(spies.onState).toHaveBeenCalledWith(expect.objectContaining({ path: [1] }));
  });

  it("renders both hub tabs and marks the active one", () => {
    renderWheel(container, roots, state(), cb());
    const tabs = container.querySelectorAll(".mw-tab");
    expect(tabs.length).toBe(2);
    expect(tabs[1].classList.contains("is-active")).toBe(true);
  });

  it("renders a breadcrumb whose depth follows the path", () => {
    renderWheel(container, roots, state({ path: [0] }), cb());
    expect(container.querySelectorAll(".mw-crumb").length).toBe(2);
  });

  it("truncates the path when an earlier crumb is clicked", () => {
    const spies = cb();
    renderWheel(container, roots, state({ path: [0, 0] }), spies);
    container.querySelectorAll(".mw-crumb")[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(spies.onState).toHaveBeenCalledWith(expect.objectContaining({ path: [] }));
  });
});
