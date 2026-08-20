import type { MapCamera } from "../core/camera";
import { coalesceInvalidations } from "../core/invalidation";
import { readLegacyPixiMapStyle, readLegacyReliefSvgDataUri } from "./legacy-pixi-style-adapter";
import type { PixiMapRenderer, PixiMapTheme, PixiPrototypeSnapshot } from "./pixi-map-renderer";
import { type PixiOwnedLayer, pixiOwnsLayer, setPixiRendererTheme } from "./pixi-renderer-ownership";

export interface PixiMapPrototypeApi {
  clear: () => Promise<void>;
  disable: () => Promise<void>;
  enable: (theme?: PixiMapTheme) => Promise<void>;
  getSnapshot: () => PixiPrototypeSnapshot | null;
  invalidateLayer: (layer: PixiOwnedLayer, cellIds?: readonly number[]) => void;
  materializeSvgFallback: () => () => void;
  ownsLayer: (layer: PixiOwnedLayer) => boolean;
  queueRebuild: () => void;
  rebuild: () => Promise<void>;
  syncCamera: () => void;
}

let instancePromise: Promise<PixiMapRenderer> | null = null;
let instance: PixiMapRenderer | null = null;
let pendingTheme: PixiMapTheme | null = null;
let materializingSvgFallback = false;

const getFallbackSelectors = (theme: PixiMapTheme): string[] =>
  theme === "states"
    ? ["#statesBody", "#statesHalo", "#statePaths", "#stateBorders", "#provinceBorders", "#terrain"]
    : ["#biomes"];

const clearOwnedSvgLayers = (theme: PixiMapTheme): void => {
  for (const selector of getFallbackSelectors(theme)) document.querySelector(selector)?.replaceChildren();
};

const drawSvgFallback = (theme: PixiMapTheme): void => {
  if (theme === "states") {
    window.drawStates();
    window.drawRelief();
    window.drawBorders();
  } else {
    window.drawBiomes();
  }
};

const renderSvgFallback = (theme: PixiMapTheme): void => {
  materializingSvgFallback = true;
  try {
    drawSvgFallback(theme);
  } finally {
    materializingSvgFallback = false;
  }
};

const getInstance = async (): Promise<PixiMapRenderer> => {
  instancePromise ??= import("./pixi-map-renderer").then(({ PixiMapRenderer }) => {
    instance = new PixiMapRenderer({
      recordPerformance: (name, duration) => window.MapPerformance?.record(name, duration),
      resolveReliefIcon: readLegacyReliefSvgDataUri
    });
    return instance;
  });
  return instancePromise;
};

const prepareSurface = (): HTMLElement => {
  const map = document.getElementById("map");
  if (!map) throw new Error("Cannot mount the Pixi renderer without #map");
  const surface = document.getElementById("pixi-map-prototype") ?? document.createElement("div");
  surface.id = "pixi-map-prototype";
  surface.style.pointerEvents = "none";
  const bounds = map.getBoundingClientRect();
  surface.style.height = `${Math.max(1, Math.round(bounds.height || svgHeight))}px`;
  surface.style.left = `${bounds.left + window.scrollX}px`;
  surface.style.top = `${bounds.top + window.scrollY}px`;
  surface.style.width = `${Math.max(1, Math.round(bounds.width || svgWidth))}px`;
  if (surface.nextElementSibling !== map) map.before(surface);
  return surface;
};

const syncLegacyVisibility = (renderer: PixiMapRenderer): void => {
  renderer.setLayerVisibility("biomes", layerIsOn("toggleBiomes"));
  renderer.setLayerVisibility("borders", layerIsOn("toggleBorders"));
  renderer.setLayerVisibility("relief", layerIsOn("toggleRelief"));
  renderer.setLayerVisibility("states", layerIsOn("toggleStates"));
};

const getLegacyCamera = (): MapCamera => {
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

const api: PixiMapPrototypeApi = {
  clear: async () => instance?.clear(),
  disable: async () => {
    if (pendingTheme) renderSvgFallback(pendingTheme);
    pendingTheme = null;
    setPixiRendererTheme(null);
    instance?.destroy();
    instance = null;
    instancePromise = null;
    document.getElementById("pixi-map-prototype")?.remove();
    document.getElementById("map")?.classList.remove("pixi-prototype-states", "pixi-prototype-biomes");
  },
  enable: async (theme = "states") => {
    if (pendingTheme && pendingTheme !== theme) renderSvgFallback(pendingTheme);
    if (theme === "states" && !pack.relief?.length) Relief.generate();
    pendingTheme = theme;
    setPixiRendererTheme(theme);
    clearOwnedSvgLayers(theme);
    if (theme === "states") window.drawRelief();
    const renderer = await getInstance();
    renderer.setTheme(theme);
    renderer.setCamera(getLegacyCamera());
    await renderer.mount(prepareSurface());
    syncLegacyVisibility(renderer);
    await renderer.render(pack, readLegacyPixiMapStyle(), coalesceInvalidations([{ kind: "world" }]));
    document.getElementById("map")?.classList.toggle("pixi-prototype-states", theme === "states");
    document.getElementById("map")?.classList.toggle("pixi-prototype-biomes", theme === "biomes");
  },
  getSnapshot: () => instance?.getSnapshot() ?? null,
  invalidateLayer: (layer, cellIds) => {
    if (!instance) return;
    instance.queueRender(
      pack,
      readLegacyPixiMapStyle(),
      layer === "states" || layer === "biomes" ? { cellIds, kind: "assignment", layer } : { kind: "geometry", layer }
    );
  },
  materializeSvgFallback: () => {
    const theme = pendingTheme;
    if (!theme) return () => undefined;

    const snapshots = getFallbackSelectors(theme).map(selector => {
      const element = document.querySelector(selector);
      return { element, html: element?.innerHTML ?? "" };
    });
    materializingSvgFallback = true;
    try {
      drawSvgFallback(theme);
    } catch (error) {
      materializingSvgFallback = false;
      throw error;
    }

    return () => {
      for (const { element, html } of snapshots) if (element) element.innerHTML = html;
      materializingSvgFallback = false;
      if (theme === "states") window.drawRelief();
    };
  },
  ownsLayer: layer => !materializingSvgFallback && pendingTheme !== null && pixiOwnsLayer(layer),
  queueRebuild: () => {
    void instancePromise?.then(instance => instance.queueRender(pack, readLegacyPixiMapStyle(), { kind: "world" }));
  },
  rebuild: async () => {
    const renderer = await getInstance();
    await renderer.mount(prepareSurface());
    await renderer.render(pack, readLegacyPixiMapStyle(), coalesceInvalidations([{ kind: "world" }]));
  },
  syncCamera: () => instance?.setCamera(getLegacyCamera())
};

export const clearPixiRenderer = api.clear;
export const invalidatePixiRendererLayer = api.invalidateLayer;
export const materializePixiSvgFallback = api.materializeSvgFallback;
export const pixiRendererOwnsLayer = api.ownsLayer;
export const queuePixiRendererRebuild = api.queueRebuild;
export const syncPixiRendererCamera = api.syncCamera;
export const pixiRendererController = api;
export const getPendingPixiTheme = (): PixiMapTheme | null => pendingTheme;
export const setPendingPixiTheme = (theme: PixiMapTheme | null): void => {
  pendingTheme = theme;
  setPixiRendererTheme(theme);
};
export const syncPixiRendererVisibility = (): void => {
  void instancePromise?.then(syncLegacyVisibility);
};
