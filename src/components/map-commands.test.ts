// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  draw: vi.fn(),
  refresh: vi.fn(),
  regenerate: vi.fn(),
  dialog: vi.fn(),
  applyPreset: vi.fn()
}));
vi.mock("@/components/layers", () => ({ Layers: { draw: mocks.draw, toggle: vi.fn() } }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ refreshEditors: mocks.refresh }));
vi.mock("@/components/options/tabs/layers-tab", () => ({
  LAYER_TOGGLES: new Map(),
  LAYER_PRESETS: { political: "Political map" }
}));
vi.mock("@/components/zoom", () => ({ changeMapZoom: vi.fn(), resetZoom: vi.fn() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));
vi.mock("@/components/app-info", () => ({ showInfo: vi.fn() }));
vi.mock("@/components/layers-presets", () => ({ applyPreset: mocks.applyPreset, savePreset: vi.fn() }));
vi.mock("@/components/lifecycle", () => ({ regeneratePrompt: vi.fn() }));
vi.mock("@/components/options/io-panes", () => ({}));
vi.mock("@/components/options/options-panel", () => ({ openTab: vi.fn(), toggleOptions: vi.fn() }));
vi.mock("@/components/seed", () => ({ showSeedHistoryDialog: vi.fn() }));
vi.mock("@/services", () => ({ Services: {} }));
vi.mock("@/services/autosave", () => ({ toggleSaveReminder: vi.fn() }));
vi.mock("@/services/url-params", () => ({ copyMapURL: vi.fn() }));
vi.mock("@/services/versioning", () => ({ cleanupData: vi.fn() }));

import { MAP_COMMANDS } from "./map-commands";

beforeEach(() => {
  document.body.innerHTML = '<div id="alert"><div id="alertMessage"></div></div>';
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("Rivers", { regenerate: mocks.regenerate });
  vi.stubGlobal("$", () => ({ dialog: mocks.dialog }));
});

function confirmation() {
  return mocks.dialog.mock.calls[0][0] as { buttons: { Proceed: () => void; Cancel: () => void } };
}

describe("shared regeneration commands", () => {
  it("waits for confirmation before changing the map and refreshing its views", () => {
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    expect(mocks.regenerate).not.toHaveBeenCalled();
    confirmation().buttons.Proceed.call(document.getElementById("alert"));
    expect(mocks.regenerate).toHaveBeenCalledOnce();
    expect(mocks.draw).toHaveBeenCalledWith("rivers");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("leaves the map unchanged when regeneration is cancelled", () => {
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    confirmation().buttons.Cancel.call(document.getElementById("alert"));
    expect(mocks.regenerate).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("honors the existing session preference to skip confirmation", () => {
    sessionStorage.setItem("regenerateFeatureDontAsk", "true");
    MAP_COMMANDS.find(command => command.id === "regenerateRivers")!.run();
    expect(mocks.regenerate).toHaveBeenCalledOnce();
    expect(mocks.dialog).not.toHaveBeenCalled();
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
