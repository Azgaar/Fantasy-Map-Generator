// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  connected: vi.fn(() => false),
  isOn: vi.fn((_layer: string) => true),
  openEditor: vi.fn((_element: Element) => true),
  reveal: vi.fn()
}));
vi.mock("@/renderers/layers", () => ({ Layers: { isOn: mocks.isOn } }));
vi.mock("@/ui/map/reveal", () => ({ openEntity: () => undefined, revealEntity: mocks.reveal }));
vi.mock("@/ui/map/viewbox-events", () => ({ openEditor: mocks.openEditor }));
vi.mock("@/controllers", () => ({ Controllers: { Assistant: { ask: mocks.ask } } }));
vi.mock("@/services/assistant/provider/connection", () => ({ isConnected: mocks.connected }));
vi.mock("@/utils", async original => ({ ...(await original<object>()), getPointer: () => [30, 40] }));

import { Pack } from "@/model/graph/pack-generator";
import { ContextMenu } from "./context-menu";

const rows = () => Array.from(document.querySelectorAll<HTMLButtonElement>("#contextMenu button"));
const names = () => rows().map(row => row.querySelector(".name")?.textContent);

function rightClick(...hits: string[]): void {
  document.elementsFromPoint = () => hits.map(id => document.getElementById(id)!);
  ContextMenu.open(new MouseEvent("contextmenu", { clientX: 30, clientY: 40 }));
}

beforeEach(() => {
  ContextMenu.close();
  vi.clearAllMocks();
  document.body.innerHTML = /* html */ `<svg id="map"><g id="viewbox">
    <g id="labels"><text id="stateLabel1"></text></g>
    <g id="burgIcons"><g data-id="1"><use id="burgIcon"></use></g><use id="burg1"></use></g>
  </g></svg>`;
  Object.assign(Pack, { findCell: () => 1 });
  globalThis.pack = {
    cells: {
      p: [
        [10, 20],
        [30, 40]
      ],
      burg: [0, 1],
      r: [0, 0],
      f: [0, 0],
      routes: {},
      state: [0, 1],
      province: [0, 0],
      culture: [0, 0],
      religion: [0, 0],
      biome: [0, 0]
    },
    burgs: [0, { i: 1, name: "Vaeltown" }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Ardenia" }
    ],
    biomes: [{ i: 0, name: "Marine" }],
    provinces: [],
    cultures: [],
    religions: [],
    rivers: [],
    features: [],
    routes: [],
    markers: [],
    zones: []
  } as unknown as typeof pack;
});

describe("context menu", () => {
  it("lists the top hit first, then everything else at the spot from the narrowest, each once", () => {
    rightClick("stateLabel1", "burgIcon");
    expect(names()).toEqual(["Ardenia", "Vaeltown", "Marine"]);
  });

  it("opens what left-click opens for a drawn row, and reveals a row with no editor", () => {
    rightClick("burgIcon");
    rows()[0].click();
    expect(mocks.openEditor).toHaveBeenCalledWith(document.getElementById("burgIcon"));

    rightClick(); // the cell's burg, though the cursor missed its icon
    rows()[0].click();
    expect(mocks.openEditor).toHaveBeenLastCalledWith(document.getElementById("burg1"));

    rightClick("burgIcon");
    rows().at(-1)!.click(); // the biome is not drawn here
    expect(mocks.reveal).toHaveBeenCalledWith({ type: "biome", id: 0 });
    expect(document.getElementById("contextMenu")).toBeNull();
  });

  it("dims the rows whose layers are off, unless drawn under the cursor", () => {
    mocks.isOn.mockImplementation(layer => layer !== "biomes");
    rightClick("burgIcon");
    expect(rows().map(row => row.classList.contains("dim"))).toEqual([false, false, true]);

    mocks.isOn.mockReturnValue(false);
    rightClick("burgIcon"); // e.g. found through its emblem while the burg icons are off
    expect(rows().map(row => row.classList.contains("dim"))).toEqual([false, true, true]);
  });

  it("titles an unnamed entity by its kind only", () => {
    pack.burgs[1] = { i: 1, name: "" } as (typeof pack.burgs)[number];
    rightClick("burgIcon");
    expect(rows()[0].querySelector(".name")?.textContent).toBe("Burg");
    expect(rows()[0].querySelector(".kind")).toBeNull();
  });

  it("asks the Assistant about the place for the Key tier only", () => {
    rightClick("burgIcon");
    expect(names()).not.toContain("What's there?");

    mocks.connected.mockReturnValue(true);
    rightClick("burgIcon");
    rows().at(-1)!.click();
    expect(mocks.ask).toHaveBeenCalledWith("What's there? cell:1, x:30, y:40");
  });

  it("closes on Escape and on a click outside, keeping its keys from the hotkeys", () => {
    const hotkey = vi.fn();
    document.addEventListener("keyup", hotkey);
    rightClick("burgIcon");
    for (const key of ["ArrowDown", "Escape"]) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
    }
    expect(document.getElementById("contextMenu")).toBeNull();
    expect(hotkey).not.toHaveBeenCalled();
    document.removeEventListener("keyup", hotkey);

    rightClick("burgIcon");
    document.getElementById("map")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(document.getElementById("contextMenu")).toBeNull();
  });

  it("closes on any other key, leaving it to the hotkeys", () => {
    const hotkey = vi.fn();
    document.addEventListener("keyup", hotkey);
    rightClick("burgIcon");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "-", bubbles: true }));
    expect(document.getElementById("contextMenu")).toBeNull();
    expect(hotkey).toHaveBeenCalledOnce();
    document.removeEventListener("keyup", hotkey);
  });
});
