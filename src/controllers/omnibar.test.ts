// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  highlight: vi.fn(),
  show: vi.fn(),
  toggle: vi.fn(),
  zoom: vi.fn((_x: number, _y: number, _scale: number, _duration: number, onEnd?: () => void) => onEnd?.()),
  labels: vi.fn(() => []),
  tip: vi.fn()
}));
vi.mock("@/components/layers", () => ({
  Layers: { draw: vi.fn(), show: mocks.show, toggle: mocks.toggle, has: () => true, isOn: () => false }
}));
vi.mock("@/components/options/tabs/layers-tab", () => ({
  LAYER_TOGGLES: new Map([["rivers", { label: "Ri<u>v</u>ers" }]]),
  LAYER_PRESETS: {}
}));
vi.mock("@/components/app-info", () => ({ showInfo: vi.fn() }));
vi.mock("@/components/layers-presets", () => ({ applyPreset: vi.fn(), savePreset: vi.fn() }));
vi.mock("@/components/lifecycle", () => ({ regeneratePrompt: vi.fn() }));
vi.mock("@/components/options/io-panes", () => ({}));
vi.mock("@/components/options/options-panel", () => ({ openTab: vi.fn(), toggleOptions: vi.fn() }));
vi.mock("@/components/seed", () => ({ showSeedHistoryDialog: vi.fn() }));
vi.mock("@/services", () => ({ Services: {} }));
vi.mock("@/services/autosave", () => ({ toggleSaveReminder: vi.fn() }));
vi.mock("@/services/url-params", () => ({ copyMapURL: vi.fn() }));
vi.mock("@/services/versioning", () => ({ cleanupData: vi.fn() }));
vi.mock("@/renderers/overlays/highlight", () => ({ highlightElement: mocks.highlight }));
vi.mock("@/components/zoom", () => ({ zoomTo: mocks.zoom }));
vi.mock("@/components/viewport", () => ({ viewport: { width: 1000, height: 800, scale: 1 } }));
vi.mock("@/renderers/labels/label-data", () => ({ getLabelsData: mocks.labels }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ refreshEditors: vi.fn() }));
vi.mock("@/components/tooltips", () => ({ tip: mocks.tip }));
vi.mock("@/controllers", () => ({
  Controllers: new Proxy({}, { get: () => ({ open: mocks.open, toggle: mocks.open, openDefault: mocks.open }) })
}));

import { Omnibar } from "./omnibar";

function input(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>("#omnibar-input")!;
}
function search(query: string): void {
  input().value = query;
  input().dispatchEvent(new Event("input", { bubbles: true }));
}
function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("#omnibar-list [role=option]"));
}
function key(code: string, key = code): void {
  input().dispatchEvent(new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code, key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  document.body.innerHTML =
    '<svg id="map"></svg><button id="addBurgTool">Add burg</button><button id="regenerateRivers">Regenerate rivers</button>';
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.animate = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.labels.mockReturnValue([]);
  globalThis.customization = 0;
  globalThis.pack = {
    cells: {
      i: [0, 1],
      p: [
        [10, 20],
        [30, 40]
      ],
      state: [0, 1],
      province: [0, 0],
      culture: [0, 0],
      religion: [0, 0]
    },
    burgs: [
      { i: 0 },
      { i: 1, name: "Aldor", x: 10, y: 20, state: 1 },
      { i: 2, name: "Ruins", x: 30, y: 40, note: "<p>Ancient <b>temple</b></p>" }
    ],
    states: [{ i: 0 }, { i: 1, name: "Westreach", fullName: "Kingdom of Westreach" }],
    provinces: [],
    cultures: [],
    religions: [],
    rivers: [],
    routes: [],
    markers: [],
    features: [],
    zones: [],
    journeys: [],
    markets: [],
    goods: [],
    biomes: [],
    addedLabels: []
  } as unknown as typeof pack;
});
afterEach(() => {
  window.dispatchEvent(new Event("blur"));
  Omnibar.dismiss(true);
  vi.restoreAllMocks();
});

describe("Omnibar public behavior", () => {
  it("opens an empty focused bar, then restores focus and consumes Escape's release", () => {
    document.getElementById("addBurgTool")!.focus();
    Omnibar.open();
    expect(document.activeElement).toBe(input());
    expect(input().value).toBe("");
    expect(rows()).toHaveLength(0);
    expect(document.getElementById("omnibar-status")?.textContent).toBe("");
    const release = vi.fn();
    document.addEventListener("keyup", release, { once: true });
    key("Escape");
    expect(document.querySelector("#omnibar")).toBeNull();
    expect(document.activeElement?.id).toBe("addBurgTool");
    expect(release).not.toHaveBeenCalled();
    document.removeEventListener("keyup", release);
  });

  it("swallows Space into the empty input, so a held opening Space types nothing", () => {
    Omnibar.open();
    const space = new KeyboardEvent("keydown", {
      code: "Space",
      key: " ",
      repeat: true,
      bubbles: true,
      cancelable: true
    });
    input().dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(input().value).toBe("");
  });

  it("ranks names above note matches and renders note excerpts as text", () => {
    pack.burgs[1].name = "Temple";
    Omnibar.open();
    search("temple");
    expect(rows()[0].textContent).toContain("Temple");
    expect(rows()[1].textContent).toContain("Ancient temple");
    expect(rows()[1].querySelector("b")).toBeNull();
    expect(rows()[1].children).toHaveLength(3);
    expect(rows()[1].querySelector(".omnibar-detail")?.textContent).toContain("Ancient temple");
  });

  it("searches literal partial names and isolates commands with >", () => {
    Omnibar.open();
    search("ald");
    expect(rows().some(row => row.textContent?.includes("Aldor"))).toBe(true);
    search("> burg");
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().every(row => row.textContent?.startsWith(">"))).toBe(true);
  });

  it("rejects scattered-letter and punctuation-only matches", () => {
    pack.routes = [
      { i: 1, name: "The Misty Serran pass", group: "roads", feature: 1, points: [] }
    ] as typeof pack.routes;
    Omnibar.open();
    for (const query of ["test", "."]) {
      search(query);
      expect(rows()).toHaveLength(0);
    }
    search("aldr");
    expect(rows().some(row => row.querySelector(".omnibar-name")?.textContent === "Aldor")).toBe(false);
    search("serran misty");
    expect(rows()[0].querySelector(".omnibar-name")?.textContent).toBe("The Misty Serran pass");
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toBe("Route · roads");
    expect(
      Array.from(rows()[0].querySelectorAll("mark"))
        .map(mark => mark.textContent)
        .join("")
    ).toBe("MistySerran");
  });

  it("shows the river basin name instead of an internal ID", () => {
    pack.rivers = [
      { i: 1, name: "Lora", type: "River", basin: 1 },
      { i: 2, name: "Rill", type: "Stream", basin: 1 }
    ] as typeof pack.rivers;
    Omnibar.open();
    search("Rill");
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toBe("River · Lora basin");
  });

  it("always previews marker notes from the beginning, even for a match near the end", () => {
    pack.markers = [
      {
        i: 0,
        name: "Hot Springs",
        note: `<p>A peaceful spring. ${"Warm water and woodland. ".repeat(12)}Ancient temple.</p>`
      }
    ] as typeof pack.markers;
    Omnibar.open();
    search("temple");
    const marker = rows().find(row => row.querySelector(".omnibar-name")?.textContent === "Hot Springs")!;
    expect(marker.querySelector(".omnibar-detail")?.textContent).toMatch(/^Marker · A peaceful spring/);
    expect(marker.querySelector(".omnibar-detail")?.textContent).not.toContain("#0");
    search("Hot Springs");
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toMatch(/^Marker · A peaceful spring/);
  });

  it("keeps disabled commands visible without activating them", () => {
    globalThis.customization = 1;
    Omnibar.open();
    search("> add burg");
    expect(rows()[0].getAttribute("aria-disabled")).toBe("true");
    expect(rows()[0].textContent).toContain("Exit customization mode");
    key("Enter");
    expect(mocks.open).not.toHaveBeenCalled();
    expect(document.querySelector("#omnibar")).not.toBeNull();
  });

  it("calls generation directly and remembers only command IDs", async () => {
    const action = vi.fn();
    vi.stubGlobal("Rivers", { regenerate: action });
    sessionStorage.setItem("regenerateFeatureDontAsk", "true");
    document.getElementById("regenerateRivers")!.remove();
    Omnibar.open();
    search("> regenerate rivers");
    key("Enter");
    await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(JSON.parse(localStorage.getItem("fmg-omnibar-history")!)).toEqual(["regenerateRivers"]);
    Omnibar.open();
    expect(input().value).toBe("");
    expect(rows()[0].textContent).toContain("Regenerate Rivers");
  });

  it("runs creation commands without a corresponding button", async () => {
    document.getElementById("addBurgTool")!.remove();
    Omnibar.open();
    search("> add burg");
    key("Enter");
    await vi.waitFor(() => expect(mocks.open).toHaveBeenCalledOnce());
    expect(JSON.parse(localStorage.getItem("fmg-omnibar-history")!)).toEqual(["addBurgTool"]);
  });

  it("navigates and highlights a feature without opening an editor", () => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "use");
    icon.id = "burg1";
    document.getElementById("map")!.append(icon);
    Omnibar.open();
    search("Aldor");
    expect(rows()[0].querySelector(".icon-home")).not.toBeNull();
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toBe("Burg · Kingdom of Westreach");
    key("Enter");
    expect(mocks.show).toHaveBeenCalledWith("burgIcons", "labels");
    expect(mocks.zoom).toHaveBeenCalledWith(10, 20, 8, 1500, expect.any(Function));
    expect(mocks.highlight).toHaveBeenCalledWith(icon);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(localStorage.getItem("fmg-omnibar-history")).toBeNull();
  });

  it("waits for zoom completion before locating and highlighting the destination", () => {
    mocks.zoom.mockImplementationOnce(() => {});
    Omnibar.open();
    search("Aldor");
    key("Enter");
    expect(mocks.highlight).not.toHaveBeenCalled();

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "use");
    icon.id = "burg1";
    document.getElementById("map")!.append(icon);
    mocks.zoom.mock.calls[0][4]!();
    expect(mocks.highlight).toHaveBeenCalledWith(icon);
  });

  it("uses route endpoints for context and fits its full geometry", () => {
    pack.cells.burg = new Uint16Array([1, 2]);
    pack.routes = [
      {
        i: 0,
        name: "Old road",
        group: "roads",
        points: [
          [10, 20, 0],
          [310, 40, 1]
        ]
      }
    ] as typeof pack.routes;
    Omnibar.open();
    search("Old road");
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toBe("Route · roads · Aldor – Ruins");
    key("Enter");
    expect(mocks.show).toHaveBeenCalledWith("routes");
    expect(mocks.zoom).toHaveBeenCalledWith(160, 30, 650 / 300, 1500, expect.any(Function));
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it.each(["lake", "island"] as const)("reveals and highlights a %s using its boundary", type => {
    pack.features = [
      { i: 1, name: "Silverwater", type, subtype: "Freshwater", vertices: [0, 1] }
    ] as typeof pack.features;
    pack.vertices = {
      p: [
        [10, 20],
        [50, 60]
      ]
    } as typeof pack.vertices;
    const shape = document.createElementNS("http://www.w3.org/2000/svg", "use");
    shape.dataset.f = "1";
    document.getElementById("map")!.append(shape);

    Omnibar.open();
    search("Silverwater");
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toBe(`${type} · Freshwater`);
    key("Enter");
    expect(mocks.show).toHaveBeenCalledWith(type === "lake" ? "lakes" : "coastline");
    expect(mocks.zoom).toHaveBeenCalledWith(30, 40, 3, 1500, expect.any(Function));
    expect(mocks.highlight).toHaveBeenCalledWith(shape);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("locates a label separately from its owner without opening an editor", () => {
    mocks.labels.mockReturnValue([
      { id: "burgLabel1", type: "burg", entityId: 1, text: "Aldor", group: "burg", anchor: [50, 60] }
    ] as never[]);
    Omnibar.open();
    search("Aldor");
    expect(rows().filter(row => row.querySelector(".omnibar-name")?.textContent === "Aldor")).toHaveLength(2);
    const label = rows().find(row => row.textContent?.includes("Label · Burg"))!;
    expect(label.querySelector(".icon-font")).not.toBeNull();
    label.click();
    expect(mocks.zoom).toHaveBeenCalledWith(50, 60, 8, 1500, expect.any(Function));
    expect(mocks.highlight).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("uses a wider scale for territories than settlements", () => {
    Omnibar.open();
    search("Kingdom of Westreach");
    key("Enter");
    expect(mocks.zoom).toHaveBeenCalledWith(30, 40, 2, 1500, expect.any(Function));
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("reports non-spatial definitions without opening an editor", () => {
    pack.goods = [{ i: 1, name: "Copper" }] as typeof pack.goods;
    Omnibar.open();
    search("Copper");
    key("Enter");
    expect(mocks.tip).toHaveBeenCalledWith("This element has no map location", false, "warn", 4000);
    expect(mocks.zoom).not.toHaveBeenCalled();
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("rejects stale targets after map replacement or regeneration", () => {
    Omnibar.open();
    search("Aldor");
    pack = { ...pack, burgs: [...pack.burgs] };
    key("Enter");
    expect(mocks.open).not.toHaveBeenCalled();
    expect(document.querySelector("#omnibar-status")?.textContent).toContain("Map changed");
    pack.burgs[1] = { ...pack.burgs[1], name: "Replacement" };
    key("Enter");
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("ignores malformed history and removes stale or duplicate command IDs", () => {
    localStorage.setItem("fmg-omnibar-history", "bad JSON");
    Omnibar.open();
    expect(rows()).toHaveLength(0);
    Omnibar.dismiss(true);
    localStorage.setItem("fmg-omnibar-history", JSON.stringify(["gone", "addBurgTool", "addBurgTool", 1]));
    Omnibar.open();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Add Burg");
  });

  it("allows command execution when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    Omnibar.open();
    search("> toggle rivers");

    key("Enter");
    await vi.waitFor(() => expect(mocks.toggle).toHaveBeenCalledWith("rivers"));
    expect(mocks.tip).not.toHaveBeenCalled();
  });

  it("navigates results with arrows and keeps Tab inside the palette", () => {
    Omnibar.open();
    search(">");
    const initial = input().getAttribute("aria-activedescendant");
    key("ArrowDown");
    expect(input().getAttribute("aria-activedescendant")).not.toBe(initial);
    key("ArrowUp");
    expect(input().getAttribute("aria-activedescendant")).toBe(initial);
    key("Tab");
    expect(document.activeElement).toBe(input());
  });
});
