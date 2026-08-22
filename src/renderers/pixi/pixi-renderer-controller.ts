import type { TemperatureScale } from "@/utils/temperature";
import type { MapCamera } from "../core/camera";
import { coalesceInvalidations } from "../core/invalidation";
import { getMarkerRenderState } from "../marker-render-state";
import { getMapRendererStyle } from "../scene/map-style-state";
import { createMapRenderWorld } from "../scene/render-world";
import type { PixiMapRenderer, PixiRendererSnapshot } from "./pixi-map-renderer";
import type { PixiOwnedLayer } from "./pixi-renderer-ownership";
import { readReliefSvgDataUri, readSvgElementDataUri, readSvgSymbolDataUri } from "./relief-icon-svg-adapter";

export interface PixiRendererControllerApi {
  clear: () => Promise<void>;
  createOverview: (maxWidth: number, maxHeight: number) => PixiRendererOverview | null;
  getCanvas: () => CanvasImageSource | null;
  getSnapshot: () => PixiRendererSnapshot | null;
  invalidateLayer: (layer: PixiOwnedLayer, cellIds?: readonly number[]) => void;
  queueRebuild: () => void;
  start: () => Promise<void>;
  syncCamera: () => void;
}

export interface PixiRendererOverview {
  height: number;
  source: CanvasImageSource;
  width: number;
}

export const PIXI_RENDERER_SCENE_CHANGE_EVENT = "map:pixi-renderer:scene-change";

let instancePromise: Promise<PixiMapRenderer> | null = null;
let instance: PixiMapRenderer | null = null;

const OWNED_SVG_SELECTORS = [
  "#oceanLayers",
  "#oceanPattern",
  "#landmass",
  "#lakes",
  "#biomes",
  "#cells",
  "#gridOverlay",
  "#rivers",
  "#terrain",
  "#relig",
  "#cults",
  "#statesBody",
  "#statesHalo",
  "#statePaths",
  "#provs",
  "#zones",
  "#stateBorders",
  "#provinceBorders",
  "#routes",
  "#temperature",
  "#coastline",
  "#prec"
] as const;

// Serialized legacy maps may still contain these groups. They are import input only and are removed before Pixi paints.
const REMOVED_SVG_SELECTORS = [
  "#burgIcons",
  "#anchors",
  "#markers",
  "#ice",
  "#goods",
  "#goodsCells",
  "#goodsIcons",
  "#goodsBurgs",
  "#markets",
  "#population",
  "#rural",
  "#urban",
  "#armies",
  "#compass",
  "#tradeAnimation"
] as const;

const clearOwnedSvgLayers = (): void => {
  for (const selector of OWNED_SVG_SELECTORS) document.querySelector(selector)?.replaceChildren();
  for (const selector of REMOVED_SVG_SELECTORS) document.querySelector(selector)?.remove();
};

const getInstance = async (): Promise<PixiMapRenderer> => {
  instancePromise ??= import("./pixi-map-renderer").then(({ PixiMapRenderer }) => {
    instance = new PixiMapRenderer({
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      onSceneChange: () => window.dispatchEvent(new Event(PIXI_RENDERER_SCENE_CHANGE_EVENT)),
      recordPerformance: (name, duration) => window.MapPerformance?.record(name, duration),
      resolveReliefIcon: readReliefSvgDataUri,
      resolveCompassIcon: () => readSvgElementDataUri("defs-compass-rose", "-220 -220 440 440"),
      resolveSymbolIcon: readSvgSymbolDataUri
    });
    return instance;
  });
  return instancePromise;
};

const prepareSurface = (): HTMLElement => {
  const map = document.getElementById("map");
  if (!map) throw new Error("Cannot mount the Pixi renderer without #map");
  const surface = document.getElementById("pixi-map-renderer") ?? document.createElement("div");
  surface.id = "pixi-map-renderer";
  surface.style.pointerEvents = "none";
  const bounds = map.getBoundingClientRect();
  surface.style.height = `${Math.max(1, Math.round(bounds.height || svgHeight))}px`;
  surface.style.left = `${bounds.left + window.scrollX}px`;
  surface.style.top = `${bounds.top + window.scrollY}px`;
  surface.style.width = `${Math.max(1, Math.round(bounds.width || svgWidth))}px`;
  if (surface.nextElementSibling !== map) map.before(surface);
  return surface;
};

const syncVisibility = (renderer: PixiMapRenderer): void => {
  renderer.setLayerVisibility("ocean", true);
  renderer.setLayerVisibility("landmass", true);
  renderer.setLayerVisibility("lakes", layerIsOn("toggleLakes"));
  renderer.setLayerVisibility("biomes", layerIsOn("toggleBiomes"));
  renderer.setLayerVisibility("cells", layerIsOn("toggleCells"));
  renderer.setLayerVisibility("grid", layerIsOn("toggleGrid"));
  renderer.setLayerVisibility("compass", layerIsOn("toggleCompass"));
  renderer.setLayerVisibility("rivers", layerIsOn("toggleRivers"));
  renderer.setLayerVisibility("relief", layerIsOn("toggleRelief"));
  renderer.setLayerVisibility("religions", layerIsOn("toggleReligions"));
  renderer.setLayerVisibility("cultures", layerIsOn("toggleCultures"));
  renderer.setLayerVisibility("states", layerIsOn("toggleStates"));
  renderer.setLayerVisibility("provinces", layerIsOn("toggleProvinces"));
  renderer.setLayerVisibility("trade", layerIsOn("toggleTrade"));
  renderer.setLayerVisibility("zones", layerIsOn("toggleZones"));
  renderer.setLayerVisibility("borders", layerIsOn("toggleBorders"));
  renderer.setLayerVisibility("routes", layerIsOn("toggleRoutes"));
  renderer.setLayerVisibility("temperature", layerIsOn("toggleTemperature"));
  renderer.setLayerVisibility("coastline", true);
  renderer.setLayerVisibility("ice", layerIsOn("toggleIce"));
  renderer.setLayerVisibility("goods", layerIsOn("toggleGoods"));
  renderer.setLayerVisibility("markets", layerIsOn("toggleMarketsLayer"));
  renderer.setLayerVisibility("precipitation", layerIsOn("togglePrecipitation"));
  renderer.setLayerVisibility("population", layerIsOn("togglePopulation"));
  renderer.setLayerVisibility("burgIcons", layerIsOn("toggleBurgIcons"));
  renderer.setLayerVisibility("military", layerIsOn("toggleMilitary"));
  renderer.setLayerVisibility("markers", layerIsOn("toggleMarkers"));
};

const getCamera = (): MapCamera => {
  const map = document.getElementById("map");
  const bounds = map?.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds?.height || svgHeight)),
    scale,
    width: Math.max(1, Math.round(bounds?.width || svgWidth)),
    x: viewX,
    y: viewY
  };
};

const getWorld = () =>
  createMapRenderWorld(
    pack,
    {
      grid,
      requestedCells: Number(pointsInput.dataset.cells) || grid.cells.i.length,
      temperatureScale: temperatureScale.value as TemperatureScale
    },
    getMarkerRenderState(),
    Production,
    urbanization
  );

const api: PixiRendererControllerApi = {
  clear: async () => instance?.clear(),
  createOverview: (maxWidth, maxHeight) => instance?.createOverview(maxWidth, maxHeight) ?? null,
  getCanvas: () => instance?.getCanvas() ?? null,
  getSnapshot: () => instance?.getSnapshot() ?? null,
  invalidateLayer: (layer, cellIds) => {
    if (!instance) return;
    instance.queueRender(
      getWorld(),
      getMapRendererStyle(style),
      ["biomes", "cultures", "provinces", "religions", "states"].includes(layer)
        ? { cellIds, kind: "assignment", layer }
        : { kind: "geometry", layer }
    );
  },
  queueRebuild: () => {
    void instancePromise?.then(renderer =>
      renderer.queueRender(getWorld(), getMapRendererStyle(style), { kind: "world" })
    );
  },
  start: async () => {
    if (!pack?.cells?.i?.length) return;
    if (!pack.relief?.length) Relief.generate();
    clearOwnedSvgLayers();
    const renderer = await getInstance();
    renderer.setCamera(getCamera());
    await renderer.mount(prepareSurface());
    syncVisibility(renderer);
    await renderer.render(getWorld(), getMapRendererStyle(style), coalesceInvalidations([{ kind: "world" }]));
    document.getElementById("map")?.classList.add("pixi-renderer-active");
  },
  syncCamera: () => instance?.setCamera(getCamera())
};

export const clearPixiRenderer = api.clear;
export const createPixiRendererOverview = api.createOverview;
export const getPixiRendererCanvas = api.getCanvas;
export const invalidatePixiRendererLayer = api.invalidateLayer;
export const queuePixiRendererRebuild = api.queueRebuild;
export const startPixiRenderer = api.start;
export const syncPixiRendererCamera = api.syncCamera;
export const pixiRendererController = api;
export const syncPixiRendererVisibility = (): void => {
  void instancePromise?.then(syncVisibility);
};
