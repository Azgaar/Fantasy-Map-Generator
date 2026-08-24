import { describe, expect, it, vi } from "vitest";
import {
  bindWorldGenerationController,
  WorldGenerationController,
  type WorldGenerationControllerApi
} from "./world-generation-controller";

describe("world generation controller", () => {
  it("forwards commands to the bound bootstrap implementation", () => {
    const target = {
      addLakesInDeepDepressions: vi.fn(),
      calculateMapCoordinates: vi.fn(),
      calculateTemperatures: vi.fn(),
      generatePrecipitation: vi.fn(),
      openNearSeaLakes: vi.fn(),
      rankCells: vi.fn(),
      reGraph: vi.fn(),
      showStatistics: vi.fn()
    } satisfies WorldGenerationControllerApi;
    const release = bindWorldGenerationController(target);

    WorldGenerationController.calculateTemperatures();
    WorldGenerationController.reGraph();

    expect(target.calculateTemperatures).toHaveBeenCalledOnce();
    expect(target.reGraph).toHaveBeenCalledOnce();
    release();
  });
});
