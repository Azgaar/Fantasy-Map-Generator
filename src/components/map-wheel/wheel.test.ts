import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BANDS, CRUMB_CLEAR } from "./geometry";
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
    expect(chosen.getAttribute("fill")).toBe(FILLS.chosen);
    // a dimmed sibling is an opaque colour of its own, not a lower alpha of the default fill
    expect(sibling.getAttribute("fill")).toBe(FILLS.dim);
    expect(sibling.getAttribute("fill")).not.toBe(FILLS.base);
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

  // The tick and the note are independent - "What's here" in the HERE channel has children AND a
  // count to show, and suppressing the tick left the one sector that always opens a ring unmarked.
  it("gives a node with both children and a note the tick and the note", () => {
    const noted: WheelRoots = {
      menu: () => [leaf("What's here", { note: "9 here", children: [leaf("Burg", { pick: 0 })] })],
      here: () => []
    };
    renderWheel(container, noted, state(), cb());
    expect(container.querySelector(".mw-note")?.textContent).toBe("9 here");
    expect(container.querySelectorAll("path.mw-mark").length).toBe(1);
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

  // The bug: the bar was pinned to the corner of the BOX, which is sized for a drill to level 3.
  // With two rings open that put it ~150px from the ring, in a large window in the screen's corner.
  it("anchors the breadcrumb above the outermost ring that is open", () => {
    const topOf = (path: number[]): string => {
      renderWheel(container, roots, state({ path }), cb());
      return container.querySelector<HTMLElement>(".mw-crumbs")!.style.top;
    };
    expect(topOf([])).toBe(`calc(50% - ${BANDS[0][1] + CRUMB_CLEAR}px)`);
    expect(topOf([0])).toBe(`calc(50% - ${BANDS[1][1] + CRUMB_CLEAR}px)`);
    expect(container.querySelector<HTMLElement>(".mw-crumbs")!.style.left).toBe("50%");
  });

  it("scales the breadcrumb's offset with the dial", () => {
    renderWheel(container, roots, state(), cb(), 2);
    expect(container.querySelector<HTMLElement>(".mw-crumbs")!.style.top).toBe(
      `calc(50% - ${(BANDS[0][1] + CRUMB_CLEAR) * 2}px)`
    );
  });

  // what index.ts hangs the drawer off, and what it reserves viewport room for
  it("reports the outermost open level with the handle", () => {
    expect(renderWheel(container, roots, state(), cb()).openLevel).toBe(0);
    expect(renderWheel(container, roots, state({ path: [0] }), cb()).openLevel).toBe(1);
    expect(renderWheel(container, roots, state({ path: [0, 0] }), cb()).openLevel).toBe(2);
    // a panel node has no child ring, so the drawer's own sector is the outermost open level
    expect(renderWheel(container, roots, state({ path: [1] }), cb()).openLevel).toBe(0);
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

// The theme is the app's to change while the wheel is open: Options → Interface is one of the
// drawers, so the user can sit inside the wheel moving the hue and transparency sliders. The
// palette used to be sampled per structural redraw only, which left the dial stale for as long as
// they stayed there. Repainting must not rebuild: that is the hover loop above all over again.
describe("repaint", () => {
  const THEME = {
    "--light-solid": "rgb(255, 255, 255)",
    "--dark-solid": "rgb(0, 0, 0)",
    "--header-active": "rgb(232, 232, 232)"
  };

  afterEach(() => {
    for (const name of Object.keys(THEME)) document.documentElement.style.removeProperty(name);
  });

  it("follows a theme change without replacing a single element", () => {
    const handle = renderWheel(container, roots, state(), cb());
    const sector = container.querySelector("path.mw-sector")!;
    const label = container.querySelector<HTMLElement>(".mw-label")!;
    expect(sector.getAttribute("fill")).toBe(FILLS.base);

    for (const [name, value] of Object.entries(THEME)) document.documentElement.style.setProperty(name, value);
    handle.repaint();

    expect(sector.getAttribute("fill")).toBe("rgb(255, 255, 255)");
    expect(container.querySelector("path.mw-sector")).toBe(sector);
    expect(container.querySelector(".mw-label")).toBe(label);
    expect(container.style.getPropertyValue("--mw-fill-base")).toBe("rgb(255, 255, 255)");
  });

  // the hovered sector is mid-skin when the theme moves, and it has to stay in that skin
  it("keeps a hovered sector hot through a theme change", () => {
    const spies = cb();
    const handle = renderWheel(container, roots, state(), spies);
    spies.onHot.mockImplementation((hot: HotRef | null) => handle.applyHot(hot));
    const sector = container.querySelector("path.mw-sector")!;
    sector.dispatchEvent(new MouseEvent("mouseenter"));
    const grown = sector.getAttribute("d");

    for (const [name, value] of Object.entries(THEME)) document.documentElement.style.setProperty(name, value);
    handle.repaint();

    expect(sector.getAttribute("d")).toBe(grown);
    expect(sector.getAttribute("fill")).toBe("rgba(232,232,232,1)"); // the themed hover fill, its alphaReduced stripped
    sector.dispatchEvent(new MouseEvent("mouseleave"));
    expect(sector.getAttribute("fill")).toBe("rgb(255, 255, 255)");
  });
});
