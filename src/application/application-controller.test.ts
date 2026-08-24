import { describe, expect, it, vi } from "vitest";
import {
  ApplicationController,
  type ApplicationControllerApi,
  bindApplicationController
} from "./application-controller";

describe("application controller", () => {
  it("forwards commands to the bound bootstrap implementation", async () => {
    const target = {
      addLakesInDeepDepressions: vi.fn(),
      calculateMapCoordinates: vi.fn(),
      calculateTemperatures: vi.fn(),
      focusOn: vi.fn(),
      generateMapOnLoad: vi.fn(async () => undefined),
      generatePrecipitation: vi.fn(),
      openNearSeaLakes: vi.fn(),
      rankCells: vi.fn(),
      reGraph: vi.fn(),
      regenerateMap: vi.fn(),
      showStatistics: vi.fn(),
      undraw: vi.fn()
    } satisfies ApplicationControllerApi;
    const release = bindApplicationController(target);

    ApplicationController.calculateTemperatures();
    ApplicationController.regenerateMap("test");
    await ApplicationController.generateMapOnLoad();

    expect(target.calculateTemperatures).toHaveBeenCalledOnce();
    expect(target.regenerateMap).toHaveBeenCalledWith("test");
    expect(target.generateMapOnLoad).toHaveBeenCalledOnce();
    release();
  });
});
