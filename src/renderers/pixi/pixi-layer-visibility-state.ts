import type { Style } from "@/types/style";
import type { PixiOwnedLayer } from "./pixi-renderer-ownership";

export const PIXI_LAYER_CONTROL_IDS = {
  biomes: "toggleBiomes",
  borders: "toggleBorders",
  burgIcons: "toggleBurgIcons",
  cells: "toggleCells",
  compass: "toggleCompass",
  cultures: "toggleCultures",
  goods: "toggleGoods",
  grid: "toggleGrid",
  ice: "toggleIce",
  lakes: "toggleLakes",
  markers: "toggleMarkers",
  markets: "toggleMarketsLayer",
  military: "toggleMilitary",
  precipitation: "togglePrecipitation",
  population: "togglePopulation",
  provinces: "toggleProvinces",
  relief: "toggleRelief",
  religions: "toggleReligions",
  rivers: "toggleRivers",
  routes: "toggleRoutes",
  states: "toggleStates",
  temperature: "toggleTemperature",
  trade: "toggleTrade",
  zones: "toggleZones"
} as const satisfies Partial<Record<PixiOwnedLayer, string>>;

export type ToggleablePixiLayer = keyof typeof PIXI_LAYER_CONTROL_IDS;

export function capturePixiLayerVisibility(
  appStyle: Pick<Style, "mapLayerVisibility">,
  isControlOn: (controlId: string) => boolean
): void {
  const visibility = { ...appStyle.mapLayerVisibility };
  for (const [layer, controlId] of Object.entries(PIXI_LAYER_CONTROL_IDS) as [ToggleablePixiLayer, string][]) {
    visibility[layer] = isControlOn(controlId);
  }
  appStyle.mapLayerVisibility = visibility;
}

export function getStoredPixiLayerVisibility(
  appStyle: Pick<Style, "mapLayerVisibility">,
  layer: ToggleablePixiLayer
): boolean | undefined {
  return appStyle.mapLayerVisibility?.[layer];
}
