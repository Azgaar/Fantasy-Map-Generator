import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import type { MapCamera } from "../core/camera";
import { readLegacyPixiMapStyle } from "./legacy-pixi-style-adapter";
import type { PixiMapPrototype, PixiMapTheme, PixiPrototypeSnapshot } from "./pixi-map-prototype";
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

let instancePromise: Promise<PixiMapPrototype> | null = null;
let instance: PixiMapPrototype | null = null;
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

const getInstance = async (): Promise<PixiMapPrototype> => {
  instancePromise ??= import("./pixi-map-prototype").then(({ PixiMapPrototype }) => {
    instance = new PixiMapPrototype();
    return instance;
  });
  return instancePromise;
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
    instance?.disable();
  },
  enable: async (theme = "states") => {
    if (pendingTheme && pendingTheme !== theme) renderSvgFallback(pendingTheme);
    pendingTheme = theme;
    setPixiRendererTheme(theme);
    clearOwnedSvgLayers(theme);
    if (theme === "states") window.drawRelief();
    const renderer = await getInstance();
    renderer.setCamera(getLegacyCamera());
    renderer.setSemanticStyle(readLegacyPixiMapStyle());
    await renderer.enable(theme);
  },
  getSnapshot: () => instance?.getSnapshot() ?? null,
  invalidateLayer: (layer, cellIds) => {
    if (!instance) return;
    instance.setSemanticStyle(readLegacyPixiMapStyle());
    instance.invalidateLayer(layer, cellIds);
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
    void instancePromise?.then(instance => {
      instance.setSemanticStyle(readLegacyPixiMapStyle());
      instance.queueRebuild();
    });
  },
  rebuild: async () => {
    const renderer = await getInstance();
    renderer.setSemanticStyle(readLegacyPixiMapStyle());
    await renderer.rebuild();
  },
  syncCamera: () => instance?.setCamera(getLegacyCamera())
};

window.PixiMapPrototype = api;

const scheduleEnable = (): void => {
  if (!pendingTheme) return;
  requestAnimationFrame(() => void api.enable(pendingTheme!));
};

window.addEventListener("map:generated", scheduleEnable);
window.addEventListener("map:loaded", scheduleEnable);
window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
  requestAnimationFrame(() => void instancePromise?.then(instance => instance.syncVisibility()));
});

const params = new URLSearchParams(location.search);
if (params.get("renderer") === "pixi") {
  pendingTheme = params.get("pixiTheme") === "biomes" ? "biomes" : "states";
  setPixiRendererTheme(pendingTheme);
}
