import { svgDefinitionsReady } from "@/components/svg-definitions-loader";
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
import type { MapRenderWorld } from "../scene/render-world";
import { createMapRenderWorld } from "../scene/render-world";
import { hydrateLegacyPhysicalStyle } from "./legacy-physical-style-adapter";
import { removeLegacyRendererGroups } from "./legacy-svg-import";
import type {
  PixiMapRenderer,
  PixiRasterCapabilities,
  PixiRasterFrameRequest,
  PixiRendererSnapshot,
  PixiSceneChangeKind
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
  preload: () => Promise<void>;
  invalidateLayer: (layer: PixiOwnedLayer, cellIds?: readonly number[]) => void;
  invalidateStyle: (layer: PixiOwnedLayer) => void;
  queueRebuild: () => void;
  pick: (clientX: number, clientY: number) => MapHit | null;
  start: () => Promise<void>;
  whenCommitted: (after?: number) => Promise<number>;
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
export const PIXI_RENDERER_ANIMATION_FRAME_EVENT = "map:pixi-renderer:animation-frame";
export const MAP_CONTENT_CHANGED_EVENT = "map:content-changed";

let instancePromise: Promise<PixiMapRenderer> | null = null;
let instance: PixiMapRenderer | null = null;
let layerOrder = MAP_LAYER_REGISTRY.map(layer => layer.id);
let lastWorld: MapRenderWorld | null = null;
const interactionOverlay = new MapInteractionOverlay();
let viewportSyncFrameId: number | null = null;

const getInstance = async (): Promise<PixiMapRenderer> => {
  instancePromise ??= import("./pixi-map-renderer").then(({ PixiMapRenderer }) => {
    instance = new PixiMapRenderer({
      deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      onSceneChange: dispatchSceneChange,
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

const dispatchSceneChange = (kind: PixiSceneChangeKind): void => {
  const event = kind === "content" ? PIXI_RENDERER_SCENE_CHANGE_EVENT : PIXI_RENDERER_ANIMATION_FRAME_EVENT;
  window.dispatchEvent(new Event(event));
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
  renderer.setLayerVisibility("texture", true);
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

const syncViewport = (): void => {
  if (viewportSyncFrameId !== null) return;
  viewportSyncFrameId = requestAnimationFrame(() => {
    viewportSyncFrameId = null;
    const map = document.getElementById("map");
    const surface = document.getElementById("pixi-map-renderer");
    if (!map || !surface || !instance) return;

    const bounds = map.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    surface.style.height = `${height}px`;
    surface.style.left = `${bounds.left + window.scrollX}px`;
    surface.style.top = `${bounds.top + window.scrollY}px`;
    surface.style.width = `${width}px`;

    const camera = getCamera();
    instance.resize({ height, width });
    instance.setCamera(camera);
    interactionOverlay.setCamera(camera);
  });
};

const getRendererScreenPoint = (clientX: number, clientY: number): ScreenPoint | null => {
  const surface = document.getElementById("pixi-map-renderer");
  if (!surface) return null;
  return clientToViewport({ x: clientX, y: clientY }, surface.getBoundingClientRect());
};

const getWorld = () => {
  lastWorld = createMapRenderWorld(
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
    { extent: mapCoordinates, height: graphHeight, width: graphWidth },
    seed
  );
  return lastWorld;
};

const api: PixiRendererControllerApi = {
  clear: async () => {
    interactionOverlay.clear();
    lastWorld = null;
    await instance?.clear();
  },
  clearInteraction: () => interactionOverlay.clear(),
  createOverview: (maxWidth, maxHeight) => instance?.createOverview(maxWidth, maxHeight) ?? null,
  getCanvas: () => instance?.getCanvas() ?? null,
  getRasterCapabilities: () => instance?.getRasterCapabilities() ?? null,
  getSnapshot: () => instance?.getSnapshot() ?? null,
  preload: async () => {
    await getInstance();
  },
  invalidateLayer: (layer, cellIds) => {
    window.dispatchEvent(new Event(MAP_CONTENT_CHANGED_EVENT));
    if (!instance) return;
    instance.queueRender(
      getWorld(),
      getMapRendererStyle(style),
      ["biomes", "cultures", "provinces", "religions", "states"].includes(layer)
        ? { cellIds, kind: "assignment", layer }
        : { kind: "geometry", layer }
    );
  },
  invalidateStyle: layer => {
    window.dispatchEvent(new Event(MAP_CONTENT_CHANGED_EVENT));
    instance?.queueRender(lastWorld ?? getWorld(), getMapRendererStyle(style), { kind: "style", layer });
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
    window.dispatchEvent(new Event(MAP_CONTENT_CHANGED_EVENT));
    layerOrder = normalizeMapLayerOrder(order);
    instance?.setLayerOrder(layerOrder);
  },
  queueRebuild: () => {
    window.dispatchEvent(new Event(MAP_CONTENT_CHANGED_EVENT));
    void instancePromise?.then(renderer =>
      renderer.queueRender(getWorld(), getMapRendererStyle(style), { kind: "world" })
    );
  },
  start: async () => {
    if (!pack?.cells?.i?.length) return;
    await svgDefinitionsReady;
    if (!document.getElementById("defElements")) throw new Error("Reusable SVG definitions are unavailable");
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
  whenCommitted: after => instance?.whenCommitted(after) ?? Promise.resolve(0),
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

export const clearMapInteractionOverlay = api.clearInteraction;
export const createPixiRendererOverview = api.createOverview;
export const getPixiRendererCanvas = api.getCanvas;
export const getPixiRasterCapabilities = api.getRasterCapabilities;
export const getPixiRendererSnapshot = api.getSnapshot;
export const preloadPixiRenderer = api.preload;
export const invalidatePixiRendererLayer = api.invalidateLayer;
export const invalidatePixiRendererStyle = api.invalidateStyle;
export const queuePixiRendererRebuild = api.queueRebuild;
export const pickPixiRenderer = api.pick;
export const renderPixiRasterFrame = api.renderRasterFrame;
export const setPixiRendererLayerOrder = api.setLayerOrder;
export const whenPixiRendererCommitted = api.whenCommitted;
export const syncPixiRendererCamera = api.syncCamera;
export const syncPixiRendererViewport = syncViewport;
export const getPixiMapPointAtClient = api.toMapPoint;
export const updateMapInteractionOverlay = api.updateInteraction;
export const pixiRendererController = api;
export const syncPixiRendererVisibility = (): void => {
  window.dispatchEvent(new Event(MAP_CONTENT_CHANGED_EVENT));
  void instancePromise?.then(syncVisibility);
};
