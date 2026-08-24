import { describe, expect, it, vi } from "vitest";
import {
  ApplicationController,
  type ApplicationControllerApi,
  bindApplicationController
} from "./application-controller";

describe("application controller", () => {
  it("forwards commands to the bound bootstrap implementation", async () => {
    const target = {
      focusOn: vi.fn(),
      generateMapOnLoad: vi.fn(async () => undefined),
      regenerateMap: vi.fn(),
      undraw: vi.fn()
    } satisfies ApplicationControllerApi;
    const release = bindApplicationController(target);

    ApplicationController.focusOn();
    ApplicationController.regenerateMap("test");
    await ApplicationController.generateMapOnLoad();

    expect(target.focusOn).toHaveBeenCalledOnce();
    expect(target.regenerateMap).toHaveBeenCalledWith("test");
    expect(target.generateMapOnLoad).toHaveBeenCalledOnce();
    release();
  });
});
