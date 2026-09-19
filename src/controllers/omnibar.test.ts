// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  highlight: vi.fn(),
  highlightArea: vi.fn(),
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
vi.mock("@/renderers/overlays/highlight", () => ({
  highlightElement: mocks.highlight,
  highlightArea: mocks.highlightArea
}));
vi.mock("@/components/zoom", () => ({ zoomTo: mocks.zoom }));
vi.mock("@/components/viewport", () => ({ viewport: { width: 1000, height: 800, scale: 1 } }));
vi.mock("@/renderers/labels/label-data", () => ({ getLabelsIndex: mocks.labels }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ refreshEditors: vi.fn() }));
vi.mock("@/components/tooltips", () => ({ tip: mocks.tip }));
vi.mock("@/controllers", () => ({
  Controllers: new Proxy({}, { get: () => ({ open: mocks.open, toggle: mocks.open, openDefault: mocks.open }) })
}));

import { MAP_COMMANDS } from "@/components/map-commands";
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
  vi.useFakeTimers(); // the palette highlights during the zoom, so its timing is part of its behavior
  document.body.innerHTML =
    '<svg id="map"></svg><button id="addBurgTool">Add burg</button><button id="regenerateRivers">Regenerate rivers</button>';
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.animate = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  mocks.open.mockResolvedValue(undefined);
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
  Omnibar.close();
  vi.useRealTimers();
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
      { i: 1, name: "The Misty Serran pass", group: "roads", feature: 1, points: [[10, 20, 0]] }
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

  it("routes questions and ? to the assistant", async () => {
    Omnibar.open();
    const assistant = () => rows().find(row => row.querySelector(".omnibar-name")?.textContent?.includes("Assistant"));
    for (const query of ["?", "help", "how", "assistant", "How do I add a river", "add a river?"]) {
      search(query);
      expect(assistant(), query).toBeDefined();
    }
    search("river");
    expect(assistant()).toBeUndefined();

    search("How do I add a river?");
    expect(rows()).toHaveLength(1);
    key("Enter");
    await vi.runAllTimersAsync();
    expect(mocks.open).toHaveBeenCalledOnce();
  });

  it("shows the river basin name instead of an internal ID", () => {
    pack.rivers = [
      { i: 1, name: "Lora", type: "River", basin: 1, cells: [0] },
      { i: 2, name: "Rill", type: "Stream", basin: 1, cells: [1] }
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
        x: 10,
        y: 20,
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

  it("navigates and highlights a feature without opening an editor", async () => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "use");
    icon.id = "burg1";
    document.getElementById("map")!.append(icon);
    Omnibar.open();
    search("Aldor");
    expect(rows()[0].querySelector(".icon-home")).not.toBeNull();
    expect(rows()[0].querySelector(".omnibar-detail")?.textContent).toBe("Burg · Kingdom of Westreach");
    key("Enter");
    expect(mocks.show).toHaveBeenCalledWith("burgIcons", "labels");
    expect(mocks.zoom).toHaveBeenCalledWith(10, 20, 8, 1500);

    await vi.advanceTimersByTimeAsync(750);
    expect(mocks.highlight).toHaveBeenCalledWith(icon);
    expect(mocks.open).not.toHaveBeenCalled();
    expect(localStorage.getItem("fmg-omnibar-history")).toBeNull();
  });

  it("starts the highlight while the view is still moving, not after the zoom settles", async () => {
    mocks.zoom.mockImplementationOnce(() => {});
    Omnibar.open();
    search("Aldor");

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "use");
    icon.id = "burg1";
    document.getElementById("map")!.append(icon);

    key("Enter");
    await vi.advanceTimersByTimeAsync(749);
    expect(mocks.highlight).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
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
    expect(mocks.zoom).toHaveBeenCalledWith(160, 30, 650 / 300, 1500);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it.each(["lake", "island"] as const)("reveals and highlights a %s using its boundary", async type => {
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
    expect(mocks.zoom).toHaveBeenCalledWith(30, 40, 3, 1500);
    expect(mocks.highlight).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(750);
    expect(mocks.highlight).toHaveBeenCalledWith(shape);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("locates a label separately from its owner without opening an editor", async () => {
    mocks.labels.mockReturnValue([
      { id: "burgLabel1", type: "burg", entityId: 1, text: "Aldor", group: "burg", anchor: [50, 60] }
    ] as never[]);
    Omnibar.open();
    search("Aldor");
    expect(rows().filter(row => row.querySelector(".omnibar-name")?.textContent === "Aldor")).toHaveLength(2);
    const label = rows().find(row => row.textContent?.includes("Label · Burg"))!;
    expect(label.querySelector(".icon-font")).not.toBeNull();
    label.click();
    expect(mocks.zoom).toHaveBeenCalledWith(50, 60, 8, 1500);
    await vi.advanceTimersByTimeAsync(750);
    expect(mocks.highlight).not.toHaveBeenCalled(); // not drawn yet: the viewport renders labels after the zoom
    expect(mocks.highlightArea).toHaveBeenCalledWith({ x: 50, y: 60, width: 0, height: 0 });
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("outlines a culled river by its own geometry when its path is not in the DOM yet", async () => {
    pack.rivers = [{ i: 1, name: "Lora", type: "River", cells: [0, 1] }] as unknown as typeof pack.rivers;
    Omnibar.open();
    search("Lora");
    key("Enter");
    await vi.advanceTimersByTimeAsync(750);
    expect(mocks.highlight).not.toHaveBeenCalled();
    expect(mocks.highlightArea).toHaveBeenCalledWith({ x: 10, y: 20, width: 20, height: 20 });
  });

  it("uses a wider scale for territories than settlements", () => {
    Omnibar.open();
    search("Kingdom of Westreach");
    key("Enter");
    expect(mocks.zoom).toHaveBeenCalledWith(30, 40, 2, 1500);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("opens the Goods editor filtered to the chosen good instead of zooming", () => {
    pack.goods = [{ i: 1, name: "Copper" }] as typeof pack.goods;
    Omnibar.open();
    search("Copper");
    key("Enter");
    expect(mocks.open).toHaveBeenCalledWith(1);
    expect(mocks.zoom).not.toHaveBeenCalled();
    expect(mocks.tip).not.toHaveBeenCalled();
  });

  it("reports an editor that fails to load instead of failing silently", async () => {
    pack.goods = [{ i: 1, name: "Copper" }] as typeof pack.goods;
    mocks.open.mockRejectedValueOnce(new Error("chunk failed"));
    Omnibar.open();
    search("Copper");
    key("Enter");
    await vi.waitFor(() =>
      expect(mocks.tip).toHaveBeenCalledWith(expect.stringContaining("Could not open"), false, "error")
    );
  });

  it("ranks unnamed entities below every named match and titles them by their kind", () => {
    pack.routes = Array.from({ length: 3 }, (_, index) => ({
      i: index,
      group: "trails",
      points: [[10, 20, 0]]
    })) as unknown as typeof pack.routes;
    Omnibar.open();
    search("route");
    const names = rows().map(row => row.querySelector(".omnibar-name")?.textContent);
    expect(names.at(-1)).toBe("Route");
    expect(names.indexOf("Route")).toBeGreaterThan(names.lastIndexOf("Open Routes Overview")); // commands come first
    expect(names.filter(name => name === "Route")).toHaveLength(3);
  });

  it("lists entities only when they have a place on the map", () => {
    pack.rivers = [{ i: 1, name: "Waterless", type: "River", cells: [] }] as unknown as typeof pack.rivers;
    pack.features = [
      0,
      { i: 1, type: "ocean", firstCell: 0 },
      { i: 2, type: "lake" }
    ] as unknown as typeof pack.features;
    Omnibar.open();
    search("waterless");
    expect(rows()).toHaveLength(0);
    search("lake 2"); // no firstCell, so nowhere to jump to
    expect(rows().every(row => row.textContent?.startsWith(">"))).toBe(true);
    search("ocean 1"); // oceans are features like any other, placed at their first cell
    expect(rows()[0].textContent).toContain("ocean 1");
  });

  it("keeps accented letters whole in note excerpts and highlights them", () => {
    pack.burgs[2].note = `<p>${"Long ago. ".repeat(6)}Une très vieille église sur la colline.</p>`;
    Omnibar.open();
    search("tres vieille eglise");
    const detail = rows()[0].querySelector(".omnibar-detail")!;
    expect(detail.textContent).toContain("très vieille église");
    expect(
      Array.from(detail.querySelectorAll("mark"))
        .map(mark => mark.textContent)
        .join("")
    ).toBe("trèsvieilleéglise");
  });

  it("counts the matches the cap hides", () => {
    pack.burgs = [
      { i: 0 },
      ...Array.from({ length: 60 }, (_, index) => ({ i: index + 1, name: `Burg ${index + 1}`, x: 1, y: 1, state: 1 }))
    ] as typeof pack.burgs;
    Omnibar.open();
    search("burg");
    expect(rows()).toHaveLength(50);
    expect(document.getElementById("omnibar-status")?.textContent).toMatch(/^50 of \d+ results/);
  });

  it("keeps the browser's save dialog and help keys out while it is open", () => {
    Omnibar.open();
    const save = new KeyboardEvent("keydown", {
      code: "KeyS",
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    input().dispatchEvent(save);
    expect(save.defaultPrevented).toBe(true);
    const help = new KeyboardEvent("keydown", { code: "F1", key: "F1", bubbles: true, cancelable: true });
    input().dispatchEvent(help);
    expect(help.defaultPrevented).toBe(true);
    const copy = new KeyboardEvent("keydown", {
      code: "KeyC",
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    input().dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(false); // copying the query stays possible
  });

  it("refuses a target the current map no longer holds", () => {
    Omnibar.open();
    search("Aldor");
    const before = mocks.zoom.mock.calls.length;

    // a map mutated in place without announcing itself: the record still points at the old entity
    pack.burgs[1] = { i: 1, name: "Aldor", x: 10, y: 20, state: 1, removed: true } as (typeof pack.burgs)[number];
    key("Enter");

    expect(mocks.zoom.mock.calls.length).toBe(before);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("refreshes its records when a new map arrives while it is open", () => {
    Omnibar.open();
    expect(rows().some(row => row.textContent?.includes("Aldor"))).toBe(false);

    pack.burgs.push({ i: 3, name: "Newstead", x: 5, y: 5, state: 1 } as (typeof pack.burgs)[number]);
    window.dispatchEvent(new Event("map:generated"));

    search("Newstead");
    expect(rows().some(row => row.textContent?.includes("Newstead"))).toBe(true);
  });

  it("ignores malformed history and removes stale or duplicate command IDs", () => {
    localStorage.setItem("fmg-omnibar-history", "bad JSON");
    Omnibar.open();
    expect(rows()).toHaveLength(0);
    Omnibar.close();
    localStorage.setItem("fmg-omnibar-history", JSON.stringify(["gone", "addBurgTool", "addBurgTool", 1]));
    Omnibar.open();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Add Burg");
  });

  it("lists every command on a bare >, the recent ones first", () => {
    localStorage.setItem("fmg-omnibar-history", JSON.stringify(["zoomIn", "showInfo"]));
    Omnibar.open();
    search(">");
    const names = rows().map(row => row.querySelector(".omnibar-name")?.textContent);
    expect(names.slice(0, 2)).toEqual(["Zoom In", "Show App Info"]);
    expect(names.length).toBe(MAP_COMMANDS.length);
  });

  it("ranks a name match above entities that only mention the query in their context", () => {
    pack.provinces = Array.from({ length: 60 }, (_, index) => ({
      i: index + 1,
      name: `Shire ${index + 1}`,
      state: 1,
      center: 1
    })) as typeof pack.provinces;
    mocks.labels.mockReturnValue([
      { id: "stateLabel1", entityId: 1, type: "state", group: "state", text: "Westreach", anchor: [10, 20] }
    ] as never[]);
    Omnibar.open();
    search("westreach");
    const names = rows().map(row => row.querySelector(".omnibar-name")?.textContent);
    expect(names.slice(0, 3)).toEqual(["Westreach", "Kingdom of Westreach", "Shire 1"]); // exact, partial, context
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
