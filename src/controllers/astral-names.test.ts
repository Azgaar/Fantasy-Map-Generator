import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  draw: vi.fn(),
  refresh: vi.fn(),
  tip: vi.fn(),
  dialog: vi.fn()
}));
vi.mock("@/components/layers", () => ({ Layers: { draw: mocks.draw } }));
vi.mock("@/components/tooltips", () => ({ tip: mocks.tip, clearMainTip: vi.fn() }));
vi.mock("@/components/dialog/dialog-helpers", () => ({
  confirmationDialog: mocks.dialog,
  refreshEditors: mocks.refresh
}));

import { AstralNames } from "./astral-names";

const TREK_CORE = "TRKCO";

describe("the Astral Names action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.options = {
      map: { cultures: { set: "astralTrek" }, units: { population: { scale: 1000, urbanization: { rate: 0.1 } } } }
    } as unknown as typeof options;
    globalThis.pack = {
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "Gantia", culture: 1, capital: 1, fullName: "Kingdom of Gantia" }
      ],
      cultures: [
        { i: 0, name: "Wildlings", base: "GERMA" },
        { i: 1, name: "Aeloran", base: TREK_CORE }
      ],
      burgs: [0, { i: 1, cell: 0, x: 10, y: 10, name: "Gant", culture: 1, population: 5 }],
      provinces: [{ i: 0 }]
    } as unknown as typeof pack;
  });

  function confirm(): void {
    const { onConfirm } = mocks.dialog.mock.calls[0][0] as { onConfirm: () => void };
    onConfirm();
  }

  it("asks for confirmation before touching the map", () => {
    AstralNames.apply();
    expect(pack.states[1].name).toBe("Gantia");
    expect(mocks.draw).not.toHaveBeenCalled();

    confirm();
    expect(pack.states[1].name).toBe("Gant"); // named by the system that holds it
  });

  it("redraws the labels layer, so the map shows the names it just gave the polities", () => {
    AstralNames.apply();
    confirm();
    expect(mocks.draw).toHaveBeenCalledWith("labels");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.tip).toHaveBeenCalledWith(expect.stringContaining("polities"), true, "success", expect.any(Number));
  });

  it("refuses a map with no Astral peoples", () => {
    pack.cultures[1].base = "ENGLI";
    AstralNames.apply();
    expect(mocks.dialog).not.toHaveBeenCalled();
    expect(mocks.tip).toHaveBeenCalledWith(expect.stringContaining("no Astral peoples"), true, "error", 8000);
  });
});
