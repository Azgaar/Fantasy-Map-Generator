import { describe, expect, it, vi } from "vitest";
import type { PackedGraph } from "@/types/PackedGraph";
import type { MapRenderer } from "../renderers/core/map-renderer";
import { DEFAULT_PIXI_MAP_STYLE } from "../renderers/scene/styles";
import { mountPixiMapViewer, type PixiViewerRenderer } from "./pixi-map-viewer";

const createRenderer = (): PixiViewerRenderer =>
  ({
    destroy: vi.fn(),
    mount: vi.fn(async () => undefined),
    pick: vi.fn(() => null),
    render: vi.fn(async () => undefined),
    resize: vi.fn(),
    setCamera: vi.fn(),
    setLayerVisibility: vi.fn()
  }) satisfies MapRenderer;

describe("Pixi map viewer", () => {
  it("mounts and updates the production renderer contract without editor globals", async () => {
    const renderer = createRenderer();
    const world = {} as PackedGraph;
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    const camera = { height: 600, scale: 2, width: 800, x: 10, y: 20 };
    const surface = {} as HTMLElement;

    const viewer = await mountPixiMapViewer({
      camera,
      createRenderer: () => renderer,
      layerVisibility: { borders: false, lakes: true },
      style,
      surface,
      world
    });

    expect(renderer.setCamera).toHaveBeenCalledWith(camera);
    expect(renderer.mount).toHaveBeenCalledWith(surface);
    expect(renderer.setLayerVisibility).toHaveBeenCalledWith("borders", false);
    expect(renderer.setLayerVisibility).toHaveBeenCalledWith("lakes", true);
    expect(renderer.render).toHaveBeenCalledWith(
      world,
      expect.not.objectContaining({ impossible: true }),
      expect.objectContaining({ invalidations: [{ kind: "world" }], requiresSceneBuild: true })
    );

    await viewer.render(world, style, [{ kind: "style", layer: "states" }]);
    expect(renderer.render).toHaveBeenLastCalledWith(
      world,
      expect.any(Object),
      expect.objectContaining({ invalidations: [{ kind: "style", layer: "states" }], requiresSceneBuild: true })
    );
    viewer.destroy();
    viewer.destroy();
    expect(renderer.destroy).toHaveBeenCalledOnce();
  });
});
