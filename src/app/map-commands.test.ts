// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  draw: vi.fn(),
  refresh: vi.fn(),
  regenerate: vi.fn(),
  applyPreset: vi.fn(),
  save: vi.fn(),
  chronicle: vi.fn()
}));
vi.mock("@/renderers/layers", () => ({ Layers: { draw: mocks.draw, toggle: vi.fn() } }));
vi.mock("@/ui/dialog/dialog-helpers", async importOriginal => ({
  ...(await importOriginal<typeof import("@/ui/dialog/dialog-helpers")>()),
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

import { Routes } from "@/model/economy/routes-generator";
import { Rivers } from "@/model/physical/river-generator";
import { DIALOGS_MARKUP, dialogButton } from "@/ui/dialog/dialog-testing";
import { isLinkable, MAP_COMMANDS } from "./map-commands";

beforeEach(() => {
  document.body.innerHTML = DIALOGS_MARKUP;
  sessionStorage.clear();
  vi.clearAllMocks();
  Object.assign(Rivers, { regenerate: mocks.regenerate });
  Object.assign(Routes, { sync: () => {} });
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
    expect(mocks.draw).toHaveBeenCalledWith("rivers");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("leaves the map unchanged when regeneration is cancelled", () => {
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    dialogButton("Cancel").click();
    expect(mocks.regenerate).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("honors the existing session preference to skip confirmation", () => {
    sessionStorage.setItem("regenerateFeatureDontAsk", "true");
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    expect(mocks.regenerate).toHaveBeenCalledOnce();
    expect(document.querySelector(".message")).toBeNull();
  });

  it("regenerates history and redraws the markers the chronicle replaces", () => {
    vi.stubGlobal("Chronicle", { generate: mocks.chronicle });
    MAP_COMMANDS.find(command => command.id === "regenerateHistory")!.run();
    dialogButton("Proceed").click();
    expect(mocks.chronicle).toHaveBeenCalledOnce();
    expect(mocks.draw).toHaveBeenCalledWith("markers");
    expect(mocks.refresh).toHaveBeenCalledOnce();
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
