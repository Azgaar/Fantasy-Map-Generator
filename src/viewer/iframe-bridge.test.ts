import { describe, expect, it, vi } from "vitest";
import {
  FANTASY_MAP_VIEWER_MESSAGE_SOURCE,
  FANTASY_MAP_VIEWER_MESSAGE_VERSION,
  installFantasyMapViewerIframeBridge
} from "./iframe-bridge";
import type { PixiMapViewerHandle } from "./pixi-map-viewer";

describe("viewer iframe bridge", () => {
  it("accepts versioned commands only from allowed origins and releases listeners", async () => {
    const target = new EventTarget();
    const postMessage = vi.fn();
    const viewer = {
      destroy: vi.fn(),
      setLayers: vi.fn(),
      subscribe: vi.fn(() => vi.fn())
    } as unknown as PixiMapViewerHandle;
    const release = installFantasyMapViewerIframeBridge(viewer, {
      allowedOrigins: ["https://host.example"],
      messageTarget: target as unknown as Window,
      postTarget: { postMessage } as unknown as Window,
      targetOrigin: "https://host.example"
    });

    target.dispatchEvent(
      new MessageEvent("message", {
        data: {
          command: "setLayers",
          layers: { states: false },
          source: FANTASY_MAP_VIEWER_MESSAGE_SOURCE,
          version: FANTASY_MAP_VIEWER_MESSAGE_VERSION
        },
        origin: "https://host.example"
      })
    );
    await Promise.resolve();
    expect(viewer.setLayers).toHaveBeenCalledWith({ states: false });

    target.dispatchEvent(
      new MessageEvent("message", {
        data: {
          command: "destroy",
          source: FANTASY_MAP_VIEWER_MESSAGE_SOURCE,
          version: FANTASY_MAP_VIEWER_MESSAGE_VERSION
        },
        origin: "https://attacker.example"
      })
    );
    expect(viewer.destroy).not.toHaveBeenCalled();
    release();
  });
});
