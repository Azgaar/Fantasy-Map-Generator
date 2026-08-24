import { afterEach, describe, expect, it, vi } from "vitest";
import { bindOptionsController, OptionsController, type OptionsControllerApi } from "./options-controller";

const createTarget = (): OptionsControllerApi => ({
  applyGraphSize: vi.fn(),
  applyStoredOptions: vi.fn(),
  changeCellsDensity: vi.fn(),
  changeViewMode: vi.fn(),
  connectToDropbox: vi.fn(async () => undefined),
  copyLinkToClickboard: vi.fn(),
  exportToJson: vi.fn(async () => undefined),
  fitMapToScreen: vi.fn(),
  getCellsDensity: vi.fn(() => 10_000),
  getCellsDensityColor: vi.fn(() => "#123456"),
  hide: vi.fn(),
  loadURL: vi.fn(),
  openExportToPngTiles: vi.fn(),
  randomize: vi.fn(),
  regenerate: vi.fn(),
  restoreSeed: vi.fn(),
  show: vi.fn(),
  showSupporters: vi.fn(async () => undefined),
  toggle: vi.fn()
});

let release: (() => void) | undefined;
afterEach(() => release?.());

describe("options controller", () => {
  it("forwards commands through the side-effect-free facade", () => {
    const target = createTarget();
    release = bindOptionsController(target);

    OptionsController.applyGraphSize();
    OptionsController.changeCellsDensity(4);
    OptionsController.regenerate({ seed: "42" });

    expect(target.applyGraphSize).toHaveBeenCalledOnce();
    expect(target.changeCellsDensity).toHaveBeenCalledWith(4);
    expect(target.regenerate).toHaveBeenCalledWith({ seed: "42" });
    expect(OptionsController.getCellsDensity(4)).toBe(10_000);
  });
});
