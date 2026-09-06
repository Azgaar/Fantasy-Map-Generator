import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAWER_WIDTH } from "./drawer";
import { boxRadius, drawerOffset, VIEWPORT_MARGIN } from "./geometry";
import { clampCentre, closeMapWheel, openMapWheel } from "./index";
import { FILLS } from "./palette";
import type { WheelRoots } from "./wheel";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => false } }));

const roots: WheelRoots = {
  menu: () => [{ label: "Layers", icon: "icon-eye", run: () => {} }],
  here: () => [{ label: "Edit burg", icon: "icon-star", run: () => {} }]
};

const rightClick = (x = 400, y = 300) =>
  new MouseEvent("contextmenu", { clientX: x, clientY: y, bubbles: true, cancelable: true });

afterEach(() => closeMapWheel());

// derived from the geometry, never hardcoded: the bands move whenever the labels are re-tuned
const EDGE = boxRadius(1) + VIEWPORT_MARGIN;
/** what a drawer beside a single open ring needs beyond the box, which is where the panels here sit */
const DRAWER_RESERVE = drawerOffset(0, 1) + DRAWER_WIDTH - boxRadius(1);

// a window that can hold the scale-1 box; on a shorter one the wheel is scaled down first, so
// clampCentre never sees a box bigger than the viewport in the app
describe("clampCentre", () => {
  it("leaves a wheel that already fits where it is", () => {
    expect(clampCentre(960, 540, 1920, 1080)).toEqual([960, 540]);
  });

  it("pushes a wheel opened at the top-left corner fully into view", () => {
    const [x, y] = clampCentre(5, 5, 1920, 1080);
    expect(x).toBeGreaterThanOrEqual(EDGE);
    expect(y).toBeGreaterThanOrEqual(EDGE);
  });

  it("pushes a wheel opened at the bottom-right corner fully into view", () => {
    const [x, y] = clampCentre(1915, 1075, 1920, 1080);
    expect(x).toBeLessThanOrEqual(1920 - EDGE);
    expect(y).toBeLessThanOrEqual(1080 - EDGE);
  });

  it("reserves room for an open drawer on the side it opens", () => {
    const [x] = clampCentre(1000, 400, 1920, 1080, "right");
    expect(x).toBeLessThanOrEqual(1920 - EDGE - DRAWER_RESERVE);
  });

  // the drawer hangs off the outermost OPEN ring, so a deeper wheel needs more room beside it
  it("reserves more room for a drawer beside a deeper wheel", () => {
    const shallow = clampCentre(1500, 400, 1920, 1080, "right", 1, 0)[0];
    const deep = clampCentre(1500, 400, 1920, 1080, "right", 1, 3)[0];
    expect(deep).toBeLessThan(shallow);
    expect(shallow - deep).toBeCloseTo(drawerOffset(3, 1) - drawerOffset(0, 1), 6);
  });

  it("clamps against the scaled box, not a fixed radius", () => {
    const [x, y] = clampCentre(5, 5, 1920, 1200, null, 1.6);
    expect(x).toBeCloseTo(boxRadius(1.6) + 8, 6);
    expect(y).toBeCloseTo(boxRadius(1.6) + 8, 6);
    expect(x).toBeGreaterThan(clampCentre(5, 5, 1920, 1200)[0]);
  });
});

describe("openMapWheel", () => {
  it("mounts a single host and centres it on the pointer", () => {
    openMapWheel(rightClick(400, 300), roots);
    const host = document.getElementById("mapWheel")!;
    expect(host).toBeTruthy();
    expect(host.querySelectorAll("path.mw-sector").length).toBe(1);
  });

  // The hub opens on MENU: the five global menus are what most right-clicks want, and the subject
  // stack is resolved on open either way, so HERE is fully populated the moment it is chosen.
  it("opens on the MENU channel with HERE one hub click away", () => {
    const channels: WheelRoots = {
      menu: () => [{ label: "Layers", icon: "icon-eye", run: () => {} }],
      here: () => [
        { label: "Edit burg", icon: "icon-star", run: () => {} },
        { label: "What's here", icon: "icon-search", run: () => {} }
      ]
    };
    openMapWheel(rightClick(), channels);
    const tabs = document.querySelectorAll("#mapWheel .mw-tab");
    expect(tabs[1].classList.contains("is-active")).toBe(true);
    expect(document.querySelectorAll("#mapWheel path.mw-sector").length).toBe(1);

    (tabs[0] as HTMLElement).click();
    expect(document.querySelectorAll("#mapWheel path.mw-sector").length).toBe(2);
  });

  // The dial follows the app's own sizing control, so the box, the drawer offset and every label
  // size are published on .mw-wheel for the stylesheet to pick up.
  it("sizes itself from uiSize, clamped", () => {
    document.body.insertAdjacentHTML("beforeend", '<input id="uiSize" value="1.5">');
    openMapWheel(rightClick(), roots);
    const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
    const scale = Number(wheel.style.getPropertyValue("--mw-ui"));

    // 1.5 was asked for, and a 768px-high jsdom window cannot hold that. Asserted on the OBSERVABLE
    // - the rendered box fills the window bar the 32px margin - rather than by recomputing
    // wheelScale's own arithmetic, which would pass whatever that arithmetic said.
    expect(boxRadius(scale) * 2).toBeCloseTo(768 - 32, 6);
    expect(scale).toBeLessThan(1.5);
    expect(wheel.style.getPropertyValue("--mw-box")).toBe(`${boxRadius(scale) * 2}px`);
    // one ring open, so the drawer sits just outside level 0 - not outside the box
    expect(wheel.style.getPropertyValue("--mw-drawer-offset")).toBe(`${drawerOffset(0, scale)}px`);

    const svg = document.querySelector("#mapWheel svg.mw-svg")!;
    expect(svg.getAttribute("width")).toBe(String(boxRadius(scale) * 2));
    expect(svg.getAttribute("viewBox")).toContain(String(-boxRadius(scale)));

    closeMapWheel();
    document.getElementById("uiSize")!.remove();
  });

  it("falls back to a scale of 1 when uiSize is absent", () => {
    openMapWheel(rightClick(), roots);
    const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
    expect(Number(wheel.style.getPropertyValue("--mw-ui"))).toBe(1);
  });

  it("replaces an existing wheel rather than stacking a second one", () => {
    openMapWheel(rightClick(), roots);
    openMapWheel(rightClick(), roots);
    expect(document.querySelectorAll("#mapWheel").length).toBe(1);
  });

  it("closes on Escape", () => {
    openMapWheel(rightClick(), roots);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.getElementById("mapWheel")).toBeNull();
  });

  it("closes on an outside pointerdown", () => {
    openMapWheel(rightClick(), roots);
    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(document.getElementById("mapWheel")).toBeNull();
  });

  it("stays open for a pointerdown inside itself", () => {
    openMapWheel(rightClick(), roots);
    document.querySelector("path.mw-sector")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(document.getElementById("mapWheel")).toBeTruthy();
  });

  // The user's bug: the first notch of a scroll inside the drawer closed the whole wheel, which
  // detached the drawer mid-gesture and handed the rest of that scroll to the map, zooming it.
  // The ring is deliberately NOT exempt - wheeling over the dial is reaching for the map behind it.
  describe("a wheel event", () => {
    const panelRoots: WheelRoots = {
      menu: () => [{ label: "About", icon: "icon-info-circled", panel: { host: "panelHost", title: "About" } }],
      here: () => []
    };

    const openWithDrawer = (): void => {
      document.body.insertAdjacentHTML("beforeend", '<div id="panelHost"><p>long</p></div>');
      openMapWheel(rightClick(), panelRoots);
      document.querySelector("path.mw-sector")!.dispatchEvent(new MouseEvent("click"));
    };

    // close first: the drawer is holding the host, and removing it under the drawer would leave the
    // restore re-attaching a stray copy for the next test to find
    afterEach(() => {
      closeMapWheel();
      document.getElementById("panelHost")?.remove();
    });

    it("scrolls the drawer instead of dismissing the wheel", () => {
      openWithDrawer();
      const inside = document.querySelector("#mapWheelDrawer p")!;
      inside.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      expect(document.getElementById("mapWheel")).toBeTruthy();
      expect(document.getElementById("panelHost")!.closest("#mapWheelDrawer")).toBeTruthy();
    });

    it("still dismisses the wheel when it lands anywhere else", () => {
      openWithDrawer();
      document.querySelector("path.mw-sector")!.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
      expect(document.getElementById("mapWheel")).toBeNull();
    });
  });

  // The regression guard for the hover redraw loop. Through the real wiring: hovering a sector used
  // to go through onState, which redraws, which removes the node under the pointer - so the browser
  // fired mouseleave, which redrew again. ~62 events/second with the pointer still, and no click
  // ever landed. If hover ever redraws again, the captured element is no longer the one in the DOM.
  it("repaints a hovered sector in place instead of rebuilding the ring", () => {
    openMapWheel(rightClick(), roots);
    const sector = document.querySelector("path.mw-sector")!;
    const label = document.querySelector<HTMLElement>("#mapWheel .mw-label")!;
    const cold = sector.getAttribute("d");

    sector.dispatchEvent(new MouseEvent("mouseenter"));

    expect(document.querySelector("path.mw-sector")).toBe(sector);
    expect(document.querySelector("#mapWheel .mw-label")).toBe(label);
    expect(sector.isConnected).toBe(true);
    expect(sector.getAttribute("d")).not.toBe(cold);

    sector.dispatchEvent(new MouseEvent("mouseleave"));
    expect(document.querySelector("path.mw-sector")).toBe(sector);
    expect(sector.getAttribute("d")).toBe(cold);
  });

  it("keeps the hover in state so the keyboard picks up where the pointer left off", () => {
    openMapWheel(rightClick(), roots);
    const sector = document.querySelector("path.mw-sector")!;
    sector.dispatchEvent(new MouseEvent("mouseenter"));
    // Enter commits whatever the pointer made hot - the leaf closes the wheel
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(document.getElementById("mapWheel")).toBeNull();
  });

  // clampCentre's drawerSide argument used to be passed by nothing but a unit test, so the design's
  // "wheel and drawer clamp as one bounding box" was never actually true on screen.
  it("re-clamps the centre when a drawer opens with no room for it beside the ring", () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="panelHost"></div>');
    const panelRoots: WheelRoots = {
      menu: () => [{ label: "About", icon: "icon-info-circled", panel: { host: "panelHost", title: "About" } }],
      here: () => []
    };

    // 540 in a 1024-wide window: the ring fits where it was clicked (its box needs 369 either side),
    // and there is just enough room on the right for the drawer to open there - but not without the
    // ring giving some of it back, since 369 + 144 + 340 is wider than what is left of the window.
    openMapWheel(rightClick(540, 300), panelRoots);
    const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
    expect(wheel.style.left).toBe("540px");

    document.querySelector("path.mw-sector")!.dispatchEvent(new MouseEvent("click"));
    expect(document.getElementById("mapWheelDrawer")).toBeTruthy();
    expect(Number.parseFloat(wheel.style.left)).toBeLessThan(540);

    // and the room is handed back the moment the drawer goes
    (document.querySelector(".mw-drawer-close") as HTMLElement).click();
    expect(wheel.style.left).toBe("540px");
    document.getElementById("panelHost")!.remove();
  });

  it("keeps the drawer through a redraw that leaves it open", () => {
    document.body.insertAdjacentHTML("beforeend", '<div id="panelHost"></div>');
    const panelRoots: WheelRoots = {
      menu: () => [{ label: "About", icon: "icon-info-circled", panel: { host: "panelHost", title: "About" } }],
      here: () => []
    };

    openMapWheel(rightClick(), panelRoots);
    document.querySelector("path.mw-sector")!.dispatchEvent(new MouseEvent("click"));
    // the last breadcrumb re-issues the same path, which redraws with the panel still chosen
    const crumbs = document.querySelectorAll<HTMLElement>("#mapWheel .mw-crumb");
    crumbs[crumbs.length - 1].click();

    expect(document.getElementById("panelHost")!.closest("#mapWheelDrawer")).toBeTruthy();
    closeMapWheel();
    expect(document.getElementById("panelHost")!.parentElement).toBe(document.body);
    document.getElementById("panelHost")!.remove();
  });

  // The wheel used to sample the theme once per structural redraw, which was defensible while it
  // was a transient ring. The drawer hosts Options → Interface: the user can now sit inside the
  // wheel moving the hue and transparency sliders, watching a stale dial.
  it("repaints when the app rewrites its theme variables", async () => {
    openMapWheel(rightClick(), roots);
    const sector = document.querySelector("path.mw-sector")!;
    const before = sector.getAttribute("fill");

    document.documentElement.style.setProperty("--light-solid", "rgb(255, 255, 255)");
    await new Promise(resolve => setTimeout(resolve, 0)); // MutationObserver delivers on a microtask

    expect(sector.getAttribute("fill")).toBe("rgb(255, 255, 255)");
    expect(sector.getAttribute("fill")).not.toBe(before);
    // repainted, not rebuilt: a rebuild would have replaced this element
    expect(document.querySelector("path.mw-sector")).toBe(sector);
    document.documentElement.style.removeProperty("--light-solid");
  });

  // a closed wheel's observer would hold its handle and its borrowed DOM for the life of the page
  it("stops watching the theme when it closes", async () => {
    openMapWheel(rightClick(), roots);
    const sector = document.querySelector("path.mw-sector")!;
    closeMapWheel();

    document.documentElement.style.setProperty("--light-solid", "rgb(255, 255, 255)");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(sector.getAttribute("fill")).toBe(FILLS.base); // the fallback it was drawn in
    document.documentElement.style.removeProperty("--light-solid");
  });

  it("removes its window listeners on close so a stale wheel cannot swallow Escape", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    openMapWheel(rightClick(), roots);
    closeMapWheel();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function), true);
    remove.mockRestore();
  });
});

describe("onContextMenu", () => {
  const cellId = 0;
  const zeros = [cellId];

  const stubMap = (): HTMLElement => {
    document.body.insertAdjacentHTML("beforeend", '<svg id="map"><g id="viewbox"><g id="target"></g></g></svg>');
    vi.stubGlobal("Pack", { findCell: () => cellId });
    vi.stubGlobal("pack", {
      cells: {
        i: zeros,
        p: [[0, 0]],
        h: [50],
        burg: zeros,
        state: zeros,
        province: zeros,
        culture: zeros,
        religion: zeros,
        biome: zeros,
        r: zeros
      },
      states: [{}],
      provinces: [{}],
      cultures: [{}],
      religions: [{}],
      biomes: [{ name: "temperate" }],
      burgs: [{}],
      rivers: [],
      markets: []
    });
    return document.getElementById("target")!;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    document.getElementById("map")?.remove();
  });

  it("opens the wheel on a right-click over the map", () => {
    stubMap().dispatchEvent(rightClick());
    expect(document.getElementById("mapWheel")).toBeTruthy();
  });

  it("yields to a handler that already claimed the right-click", () => {
    const target = stubMap();
    // journey draw-undo and remove-point bind contextmenu closer to the target and preventDefault
    target.addEventListener("contextmenu", event => event.preventDefault());
    target.dispatchEvent(rightClick());
    expect(document.getElementById("mapWheel")).toBeNull();
  });

  it("stays out of heightmap customization mode", () => {
    const target = stubMap();
    vi.stubGlobal("customization", 1);
    target.dispatchEvent(rightClick());
    expect(document.getElementById("mapWheel")).toBeNull();
  });
});
