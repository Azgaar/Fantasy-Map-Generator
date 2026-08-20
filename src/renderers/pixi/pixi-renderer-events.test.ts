import { describe, expect, it, vi } from "vitest";
import mainScript from "../../../public/main.js?raw";
import layersScript from "../../../public/modules/ui/layers.js?raw";
import type { PixiRendererControllerApi } from "./pixi-renderer-controller";
import {
  PIXI_RENDERER_COMMAND_EVENT,
  PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT,
  type PixiRendererCommand,
  type PixiRendererOwnershipRequest,
  registerPixiRendererEventBridge
} from "./pixi-renderer-events";

const createController = (): PixiRendererControllerApi => ({
  clear: vi.fn(async () => undefined),
  getSnapshot: vi.fn(() => null),
  invalidateLayer: vi.fn(),
  ownsLayer: vi.fn(layer => layer === "states"),
  queueRebuild: vi.fn(),
  start: vi.fn(async () => undefined),
  syncCamera: vi.fn()
});

describe("Pixi renderer classic event bridge", () => {
  it("keeps classic application scripts independent of the console compatibility global", () => {
    const scripts = [mainScript, layersScript];

    for (const script of scripts) expect(script.includes("PixiMapPrototype")).toBe(false);
    const combined = scripts.join("\n");
    expect(combined.includes(PIXI_RENDERER_COMMAND_EVENT)).toBe(true);
    expect(combined.includes(PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT)).toBe(true);
  });

  it("routes classic commands through the typed controller", () => {
    const target = new EventTarget();
    const controller = createController();
    registerPixiRendererEventBridge(controller, target);

    for (const detail of [
      { command: "clear" },
      { command: "queue-rebuild" },
      { cellIds: [3, 8], command: "invalidate-layer", layer: "states" }
    ] satisfies PixiRendererCommand[]) {
      target.dispatchEvent(new CustomEvent(PIXI_RENDERER_COMMAND_EVENT, { detail }));
    }

    expect(controller.clear).toHaveBeenCalledOnce();
    expect(controller.queueRebuild).toHaveBeenCalledOnce();
    expect(controller.invalidateLayer).toHaveBeenCalledWith("states", [3, 8]);
  });

  it("answers synchronous ownership requests without exposing the controller", () => {
    const target = new EventTarget();
    const controller = createController();
    registerPixiRendererEventBridge(controller, target);
    const states: PixiRendererOwnershipRequest = { layer: "states", owner: "svg" };
    const unknown: PixiRendererOwnershipRequest = { layer: "labels", owner: "svg" };

    target.dispatchEvent(new CustomEvent(PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT, { detail: states }));
    target.dispatchEvent(new CustomEvent(PIXI_RENDERER_OWNERSHIP_REQUEST_EVENT, { detail: unknown }));

    expect(states.owner).toBe("pixi");
    expect(unknown.owner).toBe("svg");
  });

  it("removes both listeners deterministically", () => {
    const target = new EventTarget();
    const controller = createController();
    const release = registerPixiRendererEventBridge(controller, target);
    release();

    target.dispatchEvent(
      new CustomEvent(PIXI_RENDERER_COMMAND_EVENT, {
        detail: { command: "queue-rebuild" } satisfies PixiRendererCommand
      })
    );
    expect(controller.queueRebuild).not.toHaveBeenCalled();
  });
});
