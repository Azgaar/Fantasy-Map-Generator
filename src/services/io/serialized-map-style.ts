import type { MapLayerId } from "@/renderers/core/layer-registry";
import { getCapturedPixiLayerVisibility } from "@/renderers/pixi/pixi-layer-visibility-state";
import type { Style } from "@/types/style";

export function createSerializedMapStyle(
  style: Style,
  layerOrder: readonly MapLayerId[],
  isDocumentLayerVisible: (controlId: string) => boolean
): Style {
  return {
    ...structuredClone(style),
    mapLayerOrder: [...layerOrder],
    mapLayerVisibility: getCapturedPixiLayerVisibility(style, isDocumentLayerVisible)
  };
}
