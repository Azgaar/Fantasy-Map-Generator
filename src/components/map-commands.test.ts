// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draw: vi.fn(), refresh: vi.fn(), regenerate: vi.fn(), dialog: vi.fn() }));
vi.mock("@/components/layers", () => ({ Layers: { draw: mocks.draw, toggle: vi.fn() } }));
vi.mock("@/components/dialog/dialog-helpers", () => ({ refreshEditors: mocks.refresh }));
vi.mock("@/components/options/tabs/layers-tab", () => ({ LAYER_TOGGLES: new Map() }));
vi.mock("@/controllers", () => ({ Controllers: {} }));

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

  it("has unique persistent command IDs", () => {
    expect(new Set(MAP_COMMANDS.map(command => command.id)).size).toBe(MAP_COMMANDS.length);
  });
});
