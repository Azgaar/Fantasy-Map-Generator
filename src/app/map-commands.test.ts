// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  draw: vi.fn(),
  refresh: vi.fn(),
  regenerate: vi.fn(),
  produce: vi.fn(),
  clear: vi.fn(),
  applyPreset: vi.fn(),
  save: vi.fn(),
  syncPorts: vi.fn(),
  collectStatistics: vi.fn()
}));
vi.mock("@/renderers/layers", () => ({ Layers: { draw: mocks.draw, toggle: vi.fn() } }));
vi.mock("@/ui/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/ui/dialog/dialog-helpers")>()),
  closeEntityDialogs: vi.fn(),
  refreshEditors: mocks.refresh
}));
vi.mock("@/app/chrome/tabs/layers-tab", () => ({
  LAYER_TOGGLES: new Map(),
  LAYER_PRESETS: { political: "Political map" }
}));
vi.mock("@/ui/map/zoom", () => ({ changeMapZoom: vi.fn(), resetZoom: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/app/chrome/app-info", () => ({ showInfo: vi.fn() }));
vi.mock("@/app/layers-presets", () => ({ applyPreset: mocks.applyPreset, savePreset: vi.fn() }));
vi.mock("@/app/lifecycle", () => ({ regeneratePrompt: vi.fn() }));
vi.mock("@/app/chrome/io-panes", () => ({}));
vi.mock("@/app/chrome/options-panel", () => ({ openTab: vi.fn(), toggleOptions: vi.fn() }));
vi.mock("@/app/seed", () => ({ showSeedHistoryDialog: vi.fn() }));
vi.mock("@/services", () => ({ Services: { Save: { toMachine: mocks.save } } }));
vi.mock("@/services/autosave", () => ({ toggleSaveReminder: vi.fn() }));
vi.mock("@/services/url-params", () => ({ copyMapURL: vi.fn() }));
vi.mock("@/services/versioning", () => ({ cleanupData: vi.fn() }));

import { Goods } from "@/model/economy/goods-generator";
import { Markets } from "@/model/economy/markets-generator";
import { Production } from "@/model/economy/production-generator";
import { Routes } from "@/model/economy/routes-generator";
import { Ice } from "@/model/physical/ice-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import { DIALOGS_MARKUP, dialogButton } from "@/ui/dialog/dialog-testing";
import { isLinkable, MAP_COMMANDS, openEconomyRegeneration } from "./map-commands";

beforeEach(() => {
  document.body.innerHTML = DIALOGS_MARKUP;
  sessionStorage.clear();
  vi.clearAllMocks();
  Object.assign(Rivers, { regenerate: mocks.regenerate });
  Object.assign(Routes, { sync: () => {} });
  Object.assign(Burgs, { syncPorts: mocks.syncPorts });
  Object.assign(States, { collectStatistics: mocks.collectStatistics });
});

it("offers overwriting the saved file in command search without another save button", () => {
  MAP_COMMANDS.find(command => command.id === "saveToMachine")!.run();
  expect(mocks.save).toHaveBeenLastCalledWith();
  MAP_COMMANDS.find(command => command.id === "overwriteMapFile")!.run();
  expect(mocks.save).toHaveBeenLastCalledWith(true);
});

describe("shared regeneration commands", () => {
  it("waits for confirmation before changing the map and refreshing its views", () => {
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    expect(mocks.regenerate).not.toHaveBeenCalled();
    dialogButton("Proceed").click();
    expect(mocks.regenerate).toHaveBeenCalledOnce();
    expect(mocks.syncPorts).toHaveBeenCalledOnce();
    expect(mocks.draw).toHaveBeenCalledWith("rivers", "burgIcons");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("leaves the map unchanged when regeneration is cancelled", () => {
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    dialogButton("Cancel").click();
    expect(mocks.regenerate).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("keeps asking after a cancel with Do not ask again ticked", () => {
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    document.querySelector<HTMLInputElement>("#regenerateDontAsk")!.checked = true;
    dialogButton("Cancel").click();
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    expect(mocks.regenerate).not.toHaveBeenCalled();
  });

  it("skips only the regeneration Do not ask again was ticked on", () => {
    Object.assign(Ice, { regenerate: vi.fn() });
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    document.querySelector<HTMLInputElement>("#regenerateDontAsk")!.checked = true;
    dialogButton("Proceed").click();
    expect(mocks.regenerate).toHaveBeenCalledOnce();

    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    expect(mocks.regenerate).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".message")).toBeNull();

    MAP_COMMANDS.find(command => command.id === "regenerateIce")!.run();
    expect(document.querySelector("#regenerateDontAsk")).not.toBeNull();
    expect(Ice.regenerate).not.toHaveBeenCalled();
  });

  describe("the economy regeneration dialog", () => {
    const part = (id: string) => document.querySelector<HTMLInputElement>(`#regeneratePart-${id}`)!;
    const run = (id: string) => MAP_COMMANDS.find(command => command.id === id)!.run();
    const ticks = () => ["restore", "deposits", "markets", "territories", "production"].filter(id => part(id).checked);
    let calls: string[];

    beforeEach(() => {
      calls = [];
      const spy = (name: string) => () => void calls.push(name);
      Object.assign(Goods, { regenerate: spy("deposits") });
      Object.assign(Markets, { regenerate: spy("markets"), expand: spy("territories") });
      Object.assign(Production, { regenerate: spy("production"), clear: spy("clear") });
    });

    it.each([
      [
        ["deposits", "production"],
        ["deposits", "production"]
      ],
      [
        ["markets", "production"],
        ["markets", "territories", "production"]
      ],
      [["production"], ["production"]]
    ] as const)("opens with %j ticked", (preset, expected) => {
      openEconomyRegeneration([...preset]);
      expect(ticks()).toEqual(expected);
      expect(calls).toEqual([]);
    });

    it("is what the Tools Economy button opens, production alone ticked", () => {
      run("regenerateEconomy");
      expect(ticks()).toEqual(["production"]);
      expect(
        MAP_COMMANDS.some(({ id }) => ["regenerateGoods", "regenerateMarkets", "regenerateProduction"].includes(id))
      ).toBe(false);
    });

    it("runs the ticked parts in order, whichever button opened it", () => {
      run("regenerateEconomy");
      part("deposits").checked = true;
      part("markets").click();
      dialogButton("Proceed").click();
      expect(calls).toEqual(["deposits", "markets", "production"]);
      expect(mocks.refresh).toHaveBeenCalledOnce();
    });

    it("keeps the deals under new deposits or territories, and clears them when markets are replaced", () => {
      openEconomyRegeneration(["deposits", "production"]);
      part("production").checked = false;
      dialogButton("Proceed").click();
      expect(calls).toEqual(["deposits"]);

      calls = [];
      openEconomyRegeneration(["territories"]);
      dialogButton("Proceed").click();
      expect(calls).toEqual(["territories"]);

      calls = [];
      openEconomyRegeneration(["markets"]);
      dialogButton("Proceed").click();
      expect(calls).toEqual(["markets", "clear"]);
    });

    it("locks a part while the one rebuilding it is ticked, and puts it back after", () => {
      openEconomyRegeneration(["markets", "production"]);
      expect(part("territories").disabled).toBe(true);
      part("markets").click();
      expect(part("territories")).toMatchObject({ disabled: false, checked: false });

      part("markets").click();
      expect(part("territories")).toMatchObject({ disabled: true, checked: true });
    });

    it("always asks, and offers no Do not ask again", () => {
      sessionStorage.setItem("regenerateDontAsk-regenerateEconomy", "true");
      run("regenerateEconomy");
      expect(calls).toEqual([]);
      expect(document.querySelector("#regenerateDontAsk")).toBeNull();
    });
  });

  it("regenerates burgs, counts the states' people, then markets, then production", () => {
    const order: string[] = [];
    Object.assign(Burgs, { regenerate: () => order.push("burgs") });
    Object.assign(States, { collectStatistics: () => order.push("statistics") });
    Object.assign(Markets, { regenerate: () => order.push("markets") });
    Object.assign(Production, { regenerate: () => order.push("production") });
    MAP_COMMANDS.find(command => command.id === "regenerateBurgs")!.run();
    dialogButton("Proceed").click();
    expect(order).toEqual(["burgs", "statistics", "markets", "production"]);
  });

  it("offers every built-in layers preset as a command", () => {
    const command = MAP_COMMANDS.find(command => command.id === "preset:political")!;
    expect(command.name).toBe("Apply Layers Preset: Political map");
    command.run();
    expect(mocks.applyPreset).toHaveBeenCalledWith("political");
  });

  it("has unique persistent command IDs", () => {
    expect(new Set(MAP_COMMANDS.map(command => command.id)).size).toBe(MAP_COMMANDS.length);
  });
});

describe("linkable commands", () => {
  it("only open things, never generate, load or reset", () => {
    const linkable = MAP_COMMANDS.filter(isLinkable).map(({ id }) => id);
    expect(linkable).toContain("editHeightmapButton");
    expect(linkable).toContain("exportButton");
    expect(linkable).not.toContain("exportSvg");
    expect(linkable).not.toContain("assistant");
    for (const id of ["newMap", "quickLoad", "regenerateStates", "optionsReset", "layer:toggleRivers"])
      expect(linkable).not.toContain(id);
  });
});
