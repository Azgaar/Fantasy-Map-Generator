import type { MapCamera } from "../renderers/core/camera";
import { coalesceInvalidations, type RenderInvalidation } from "../renderers/core/invalidation";
import type { MapLayerId } from "../renderers/core/layer-registry";
import type { MapRenderer } from "../renderers/core/map-renderer";
import type { MapRenderWorld } from "../renderers/scene/render-world";
import type { MapStyle } from "../renderers/scene/styles";

export type PixiViewerRenderer = MapRenderer;

export interface PixiMapViewerOptions {
  camera: MapCamera;
  createRenderer?: () => Promise<PixiViewerRenderer> | PixiViewerRenderer;
  layerVisibility?: Readonly<Partial<Record<MapLayerId, boolean>>>;
  style: MapStyle;
  surface: HTMLElement;
  world: MapRenderWorld;
}

export interface PixiMapViewerHandle {
  destroy: () => void;
  render: (world: MapRenderWorld, style: MapStyle, invalidations: readonly RenderInvalidation[]) => Promise<void>;
  renderer: PixiViewerRenderer;
  setCamera: (camera: MapCamera) => void;
  setLayerVisibility: (layer: MapLayerId, visible: boolean) => void;
}

export async function mountPixiMapViewer(options: PixiMapViewerOptions): Promise<PixiMapViewerHandle> {
  const renderer = await (options.createRenderer ?? createProductionRenderer)();
  renderer.setCamera(options.camera);
  await renderer.mount(options.surface);
  for (const [layer, visible] of Object.entries(options.layerVisibility ?? {})) {
    if (visible !== undefined) renderer.setLayerVisibility(layer as MapLayerId, visible);
  }
  await renderer.render(options.world, structuredClone(options.style), coalesceInvalidations([{ kind: "world" }]));

  let destroyed = false;
  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      renderer.destroy();
    },
    render: (world, style, invalidations) =>
      renderer.render(world, structuredClone(style), coalesceInvalidations(invalidations)),
    renderer,
    setCamera: camera => renderer.setCamera(camera),
    setLayerVisibility: (layer, visible) => renderer.setLayerVisibility(layer, visible)
  };
}

async function createProductionRenderer(): Promise<PixiViewerRenderer> {
  const { PixiMapRenderer } = await import("../renderers/pixi/pixi-map-renderer");
  return new PixiMapRenderer();
}
