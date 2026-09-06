import { afterEach, describe, expect, it, vi } from "vitest";
import { clampCentre, closeMapWheel, openMapWheel } from "./index";
import type { WheelRoots } from "./wheel";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => false } }));

const roots: WheelRoots = {
  menu: () => [{ label: "Layers", icon: "icon-eye", run: () => {} }],
  here: () => [{ label: "Edit burg", icon: "icon-star", run: () => {} }]
};

const rightClick = (x = 400, y = 300) =>
  new MouseEvent("contextmenu", { clientX: x, clientY: y, bubbles: true, cancelable: true });

afterEach(() => closeMapWheel());

describe("clampCentre", () => {
  it("leaves a centred wheel alone", () => {
    expect(clampCentre(600, 400, 1280, 720)).toEqual([600, 400]);
  });

  it("pushes a wheel opened at the top-left corner fully into view", () => {
    const [x, y] = clampCentre(5, 5, 1280, 720);
    expect(x).toBeGreaterThanOrEqual(258);
    expect(y).toBeGreaterThanOrEqual(258);
  });

  it("pushes a wheel opened at the bottom-right corner fully into view", () => {
    const [x, y] = clampCentre(1275, 715, 1280, 720);
    expect(x).toBeLessThanOrEqual(1280 - 258);
    expect(y).toBeLessThanOrEqual(720 - 258);
  });

  it("reserves room for an open drawer on the side it opens", () => {
    const [x] = clampCentre(1000, 400, 1280, 720, "right");
    expect(x).toBeLessThanOrEqual(1280 - 258 - 354);
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

    // 500 in a 1024-wide window: the ring fits where it was clicked, the ring plus a drawer does not
    openMapWheel(rightClick(500, 300), panelRoots);
    const wheel = document.querySelector<HTMLElement>("#mapWheel .mw-wheel")!;
    expect(wheel.style.left).toBe("500px");

    document.querySelector("path.mw-sector")!.dispatchEvent(new MouseEvent("click"));
    expect(document.getElementById("mapWheelDrawer")).toBeTruthy();
    expect(Number.parseFloat(wheel.style.left)).toBeLessThan(500);

    // and the room is handed back the moment the drawer goes
    (document.querySelector(".mw-drawer-close") as HTMLElement).click();
    expect(wheel.style.left).toBe("500px");
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
