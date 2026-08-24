import type { TemperatureScale } from "@/utils/temperature";
import { clientToViewport, type MapCamera, screenToWorld } from "../core/camera";
import { coalesceInvalidations } from "../core/invalidation";
import { MAP_LAYER_REGISTRY, type MapLayerId, normalizeMapLayerOrder } from "../core/layer-registry";
import type { MapHit, ScreenPoint } from "../core/map-renderer";
import { emblemRenderer } from "../emblems/renderer";
import { MapInteractionOverlay, type MapInteractionOverlayPatch } from "../interaction/map-interaction-overlay";
import { getLabelRenderState } from "../labels/label-render-state";
import { getMarkerRenderState } from "../marker-render-state";
import { getMapRendererStyle } from "../scene/map-style-state";
import { createMapRenderWorld } from "../scene/render-world";
import { hydrateLegacyPhysicalStyle } from "./legacy-physical-style-adapter";
import { removeLegacyRendererGroups } from "./legacy-svg-import";
import type {
  PixiMapRenderer,
  PixiRasterCapabilities,
  PixiRasterFrameRequest,
  PixiRendererSnapshot
} from "./pixi-map-renderer";
import type { PixiOwnedLayer } from "./pixi-renderer-ownership";
import { readReliefSvgDataUri, readSvgElementDataUri, readSvgSymbolDataUri } from "./relief-icon-svg-adapter";

export interface PixiRendererControllerApi {
  clear: () => Promise<void>;
  clearInteraction: () => void;
  createOverview: (maxWidth: number, maxHeight: number) => PixiRendererOverview | null;
  getCanvas: () => CanvasImageSource | null;
  getRasterCapabilities: () => PixiRasterCapabilities | null;
  getSnapshot: () => PixiRendererSnapshot | null;
  invalidateLayer: (layer: PixiOwnedLayer, cellIds?: readonly number[]) => void;
  queueRebuild: () => void;
  pick: (clientX: number, clientY: number) => MapHit | null;
  start: () => Promise<void>;
  renderRasterFrame: (request: PixiRasterFrameRequest) => HTMLCanvasElement;
  setLayerOrder: (order: readonly MapLayerId[]) => void;
  syncCamera: () => void;
  toMapPoint: (clientX: number, clientY: number) => ScreenPoint | null;
  updateInteraction: (patch: MapInteractionOverlayPatch) => void;
}

export interface PixiRendererOverview {
  height: number;
  source: CanvasImageSource;
  width: number;
}

export const PIXI_RENDERER_SCENE_CHANGE_EVENT = "map:pixi-renderer:scene-change";

let instancePromise: Promise<PixiMapRenderer> | null = null;
let instance: PixiMapRenderer | null = null;
let layerOrder = MAP_LAYER_REGISTRY.map(layer => layer.id);
const interactionOverlay = new MapInteractionOverlay();

const getInstance = async (): Promise<PixiMapRenderer> => {
  instancePromise ??= import("./pixi-map-renderer").then(({ PixiMapRenderer }) => {
    instance = new PixiMapRenderer({
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      onSceneChange: () => window.dispatchEvent(new Event(PIXI_RENDERER_SCENE_CHANGE_EVENT)),
      recordPerformance: (name, duration) => window.MapPerformance?.record(name, duration),
      resolveReliefIcon: readReliefSvgDataUri,
      resolveCompassIcon: () => readSvgElementDataUri("defs-compass-rose", "-220 -220 440 440"),
      resolveEmblemIcon: (id, coa, strokeWidth) => {
        if (coa.custom && !coa.customData) {
          const legacyId = id.replace(/_[^_]+$/, "");
          return readSvgElementDataUri(legacyId, "0 0 200 200");
        }
        return emblemRenderer.renderDataUri(id, coa, { strokeWidth });
      },
      resolveSymbolIcon: (icon, presentation) => readSvgSymbolDataUri(icon, document, presentation)
    });
    instance.setLayerOrder(layerOrder);
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
  renderer.setLayerVisibility("texture", window.LayerControls.isLayerOn("toggleTexture"));
  renderer.setLayerVisibility("height", window.LayerControls.isLayerOn("toggleHeight"));
  renderer.setLayerVisibility("lakes", window.LayerControls.isLayerOn("toggleLakes"));
  renderer.setLayerVisibility("biomes", window.LayerControls.isLayerOn("toggleBiomes"));
  renderer.setLayerVisibility("cells", window.LayerControls.isLayerOn("toggleCells"));
  renderer.setLayerVisibility("grid", window.LayerControls.isLayerOn("toggleGrid"));
  renderer.setLayerVisibility("coordinates", window.LayerControls.isLayerOn("toggleCoordinates"));
  renderer.setLayerVisibility("compass", window.LayerControls.isLayerOn("toggleCompass"));
  renderer.setLayerVisibility("rivers", window.LayerControls.isLayerOn("toggleRivers"));
  renderer.setLayerVisibility("relief", window.LayerControls.isLayerOn("toggleRelief"));
  renderer.setLayerVisibility("religions", window.LayerControls.isLayerOn("toggleReligions"));
  renderer.setLayerVisibility("cultures", window.LayerControls.isLayerOn("toggleCultures"));
  renderer.setLayerVisibility("states", window.LayerControls.isLayerOn("toggleStates"));
  renderer.setLayerVisibility("provinces", window.LayerControls.isLayerOn("toggleProvinces"));
  renderer.setLayerVisibility("trade", window.LayerControls.isLayerOn("toggleTrade"));
  renderer.setLayerVisibility("zones", window.LayerControls.isLayerOn("toggleZones"));
  renderer.setLayerVisibility("borders", window.LayerControls.isLayerOn("toggleBorders"));
  renderer.setLayerVisibility("routes", window.LayerControls.isLayerOn("toggleRoutes"));
  renderer.setLayerVisibility("temperature", window.LayerControls.isLayerOn("toggleTemperature"));
  renderer.setLayerVisibility("coastline", true);
  renderer.setLayerVisibility("ice", window.LayerControls.isLayerOn("toggleIce"));
  renderer.setLayerVisibility("goods", window.LayerControls.isLayerOn("toggleGoods"));
  renderer.setLayerVisibility("markets", window.LayerControls.isLayerOn("toggleMarketsLayer"));
  renderer.setLayerVisibility("precipitation", window.LayerControls.isLayerOn("togglePrecipitation"));
  renderer.setLayerVisibility("population", window.LayerControls.isLayerOn("togglePopulation"));
  renderer.setLayerVisibility("emblems", window.LayerControls.isLayerOn("toggleEmblems"));
  renderer.setLayerVisibility("labels", window.LayerControls.isLayerOn("toggleLabels"));
  renderer.setLayerVisibility("burgIcons", window.LayerControls.isLayerOn("toggleBurgIcons"));
  renderer.setLayerVisibility("military", window.LayerControls.isLayerOn("toggleMilitary"));
  renderer.setLayerVisibility("markers", window.LayerControls.isLayerOn("toggleMarkers"));
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

const getRendererScreenPoint = (clientX: number, clientY: number): ScreenPoint | null => {
  const surface = document.getElementById("pixi-map-renderer");
  if (!surface) return null;
  return clientToViewport({ x: clientX, y: clientY }, surface.getBoundingClientRect());
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
    urbanization,
    getLabelRenderState(),
    { extent: mapCoordinates, height: graphHeight, width: graphWidth }
  );

const api: PixiRendererControllerApi = {
  clear: async () => {
    interactionOverlay.clear();
    await instance?.clear();
  },
  clearInteraction: () => interactionOverlay.clear(),
  createOverview: (maxWidth, maxHeight) => instance?.createOverview(maxWidth, maxHeight) ?? null,
  getCanvas: () => instance?.getCanvas() ?? null,
  getRasterCapabilities: () => instance?.getRasterCapabilities() ?? null,
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
  pick: (clientX, clientY) => {
    const point = getRendererScreenPoint(clientX, clientY);
    return point ? (instance?.pick(point) ?? null) : null;
  },
  renderRasterFrame: request => {
    if (!instance) throw new Error("Pixi renderer is not ready for raster export");
    return instance.renderRasterFrame(request);
  },
  setLayerOrder: order => {
    layerOrder = normalizeMapLayerOrder(order);
    instance?.setLayerOrder(layerOrder);
  },
  queueRebuild: () => {
    void instancePromise?.then(renderer =>
      renderer.queueRender(getWorld(), getMapRendererStyle(style), { kind: "world" })
    );
  },
  start: async () => {
    if (!pack?.cells?.i?.length) return;
    hydrateLegacyPhysicalStyle(style);
    if (!pack.relief?.length) Relief.generate();
    const renderer = await getInstance();
    const camera = getCamera();
    renderer.setCamera(camera);
    interactionOverlay.mount(document.getElementById("map") as unknown as SVGSVGElement, {
      height: graphHeight,
      width: graphWidth
    });
    interactionOverlay.setCamera(camera);
    await renderer.mount(prepareSurface());
    syncVisibility(renderer);
    await renderer.render(getWorld(), getMapRendererStyle(style), coalesceInvalidations([{ kind: "world" }]));
    removeLegacyRendererGroups();
    document.getElementById("map")?.classList.add("pixi-renderer-active");
  },
  syncCamera: () => {
    const camera = getCamera();
    instance?.setCamera(camera);
    interactionOverlay.setCamera(camera);
  },
  toMapPoint: (clientX, clientY) => {
    const point = getRendererScreenPoint(clientX, clientY);
    return point ? screenToWorld(point, getCamera()) : null;
  },
  updateInteraction: patch => interactionOverlay.update(patch)
};

export const clearPixiRenderer = api.clear;
export const clearMapInteractionOverlay = api.clearInteraction;
export const createPixiRendererOverview = api.createOverview;
export const getPixiRendererCanvas = api.getCanvas;
export const getPixiRasterCapabilities = api.getRasterCapabilities;
export const getPixiRendererSnapshot = api.getSnapshot;
export const invalidatePixiRendererLayer = api.invalidateLayer;
export const queuePixiRendererRebuild = api.queueRebuild;
export const pickPixiRenderer = api.pick;
export const renderPixiRasterFrame = api.renderRasterFrame;
export const setPixiRendererLayerOrder = api.setLayerOrder;
export const startPixiRenderer = api.start;
export const syncPixiRendererCamera = api.syncCamera;
export const getPixiMapPointAtClient = api.toMapPoint;
export const updateMapInteractionOverlay = api.updateInteraction;
export const pixiRendererController = api;
export const syncPixiRendererVisibility = (): void => {
  void instancePromise?.then(syncVisibility);
};
