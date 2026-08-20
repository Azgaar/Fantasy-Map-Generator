import type { Style } from "@/types/style";
import { DEFAULT_PIXI_MAP_STYLE, type MapStyle } from "./styles";

export function getMapRendererStyle(appStyle: Pick<Style, "mapRenderer">): MapStyle {
  appStyle.mapRenderer ??= structuredClone(DEFAULT_PIXI_MAP_STYLE);
  return structuredClone(appStyle.mapRenderer);
}

export function resetMapRendererStyle(appStyle: Pick<Style, "mapRenderer">): MapStyle {
  appStyle.mapRenderer = structuredClone(DEFAULT_PIXI_MAP_STYLE);
  return structuredClone(appStyle.mapRenderer);
}
