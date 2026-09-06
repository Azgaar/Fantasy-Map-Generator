import { beforeEach, describe, expect, it, vi } from "vitest";
import { FILLS } from "./palette";
import type { WheelNode } from "./types";
import { type HotRef, renderWheel, resolveLevels, type WheelRoots, type WheelState } from "./wheel";

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
  onHot: vi.fn(),
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

  // The mark used to be a "▸" note line, which cost every parent label a whole line of the band's
  // radial depth. It is a tick in the SVG now, so it costs the label nothing.
  it("marks a node with children with a tick rather than a line of text", () => {
    renderWheel(container, roots, state(), cb());
    const labels = [...container.querySelectorAll(".mw-label")];
    expect(labels[0].textContent).toBe("Layers");
    expect(labels[0].querySelector(".mw-note")).toBeNull();
    // one per parent in TREE: Layers and Tools
    expect(container.querySelectorAll("path.mw-mark").length).toBe(2);
  });

  it("gives a note line only to a node that has something to say in it", () => {
    renderWheel(container, roots, state({ path: [0, 0] }), cb());
    const notes = [...container.querySelectorAll(".mw-note")].map(n => n.textContent);
    expect(notes).toEqual(["off"]); // the rivers toggle; nothing else carries a note
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

  it("paints the hot sector of the state it is given", () => {
    renderWheel(container, roots, state({ hot: { level: 0, index: 2 } }), cb());
    const sectors = [...container.querySelectorAll("path.mw-sector")];
    expect(sectors[2].getAttribute("fill")).toBe(FILLS.hot);
    expect(sectors[0].getAttribute("fill")).toBe(FILLS.base);
  });
});

// The whole class of bug this guards: hover used to go through onState, onState redraws, and the
// redraw deleted the node under the pointer - which fires mouseleave/mouseenter and redraws again.
// ~62 events/second with the pointer held still, the entry animation restarting each time (so the
// ring was invisible) and no mousedown/mouseup/click ever landing on a sector.
describe("hover", () => {
  /** wire the spies the way index.ts does: onHot repaints through the handle, never redraws */
  const hovering = (over: Partial<WheelState> = {}) => {
    const spies = cb();
    const handle = renderWheel(container, roots, state(over), spies);
    spies.onHot.mockImplementation((hot: HotRef | null) => handle.applyHot(hot));
    return spies;
  };

  it("reports hover through onHot and never through onState", () => {
    const spies = hovering();
    container.querySelector("path.mw-sector")!.dispatchEvent(new MouseEvent("mouseenter"));
    expect(spies.onHot).toHaveBeenCalledWith({ level: 0, index: 0 });
    expect(spies.onState).not.toHaveBeenCalled();
  });

  it("clears the hover on mouseleave", () => {
    const spies = hovering();
    container.querySelector("path.mw-sector")!.dispatchEvent(new MouseEvent("mouseleave"));
    expect(spies.onHot).toHaveBeenCalledWith(null);
    expect(spies.onState).not.toHaveBeenCalled();
  });

  it("mutates the hovered sector in place instead of rebuilding the ring", () => {
    hovering();
    const sector = container.querySelector("path.mw-sector")!;
    const label = container.querySelector<HTMLElement>(".mw-label")!;
    const cold = { d: sector.getAttribute("d"), fill: sector.getAttribute("fill"), ink: label.style.color };

    sector.dispatchEvent(new MouseEvent("mouseenter"));

    // the guard: the very element under the pointer is still the one in the DOM
    expect(container.querySelectorAll("path.mw-sector")[0]).toBe(sector);
    expect(container.querySelectorAll(".mw-label")[0]).toBe(label);
    expect(sector.isConnected).toBe(true);
    expect(sector.getAttribute("fill")).toBe(FILLS.hot);
    expect(sector.getAttribute("d")).not.toBe(cold.d);
    expect(label.style.color).not.toBe(cold.ink);

    sector.dispatchEvent(new MouseEvent("mouseleave"));
    expect(container.querySelectorAll("path.mw-sector")[0]).toBe(sector);
    expect(sector.getAttribute("d")).toBe(cold.d);
    expect(sector.getAttribute("fill")).toBe(cold.fill);
    expect(label.style.color).toBe(cold.ink);
  });

  it("grows the outer radius only, leaving the inner edge where it was", () => {
    hovering();
    const sector = container.querySelector("path.mw-sector")!;
    const start = (d: string) => d.slice(2).split(" L ")[0];
    const cold = sector.getAttribute("d")!;
    sector.dispatchEvent(new MouseEvent("mouseenter"));
    const hot = sector.getAttribute("d")!;

    expect(start(hot)).toBe(start(cold)); // the arc still opens on the inner radius
    const radius = (d: string) =>
      Math.hypot(...(d.split(" L ")[1].split(" ").slice(0, 2).map(Number) as [number, number]));
    expect(radius(hot) - radius(cold)).toBeCloseTo(5, 1); // HOVER_GROW
  });

  it("moves the hover from one sector to another without touching the rest", () => {
    const spies = hovering();
    const [first, second] = [...container.querySelectorAll("path.mw-sector")];
    first.dispatchEvent(new MouseEvent("mouseenter"));
    first.dispatchEvent(new MouseEvent("mouseleave"));
    second.dispatchEvent(new MouseEvent("mouseenter"));

    expect(first.getAttribute("fill")).toBe(FILLS.base);
    expect(second.getAttribute("fill")).toBe(FILLS.hot);
    expect(spies.onState).not.toHaveBeenCalled();
  });

  it("lights a destructive sector in the danger fill", () => {
    const danger: WheelRoots = { menu: () => [leaf("Erase", { danger: true, run: () => {} })], here: () => [] };
    const spies = cb();
    const handle = renderWheel(container, danger, state(), spies);
    spies.onHot.mockImplementation((hot: HotRef | null) => handle.applyHot(hot));

    const sector = container.querySelector("path.mw-sector")!;
    sector.dispatchEvent(new MouseEvent("mouseenter"));
    expect(sector.getAttribute("fill")).toBe(FILLS.hotDanger);
  });

  it("leaves a chosen ancestor dark when the pointer rests on it", () => {
    const spies = cb();
    const handle = renderWheel(container, roots, state({ path: [0] }), spies);
    spies.onHot.mockImplementation((hot: HotRef | null) => handle.applyHot(hot));

    const sector = container.querySelector("path.mw-sector")!;
    sector.dispatchEvent(new MouseEvent("mouseenter"));
    expect(sector.getAttribute("fill")).toBe(FILLS.chosen);
  });
});
