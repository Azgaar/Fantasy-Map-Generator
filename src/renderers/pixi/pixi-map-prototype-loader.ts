import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import type { PixiMapPrototype, PixiMapTheme, PixiPrototypeSnapshot } from "./pixi-map-prototype";
import { isPixiLayerOwned, type PixiOwnedLayer } from "./pixi-renderer-ownership";

export interface PixiMapPrototypeApi {
  clear: () => Promise<void>;
  disable: () => Promise<void>;
  enable: (theme?: PixiMapTheme) => Promise<void>;
  getSnapshot: () => PixiPrototypeSnapshot | null;
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

const api: PixiMapPrototypeApi = {
  clear: async () => instance?.clear(),
  disable: async () => {
    if (pendingTheme) renderSvgFallback(pendingTheme);
    pendingTheme = null;
    instance?.disable();
  },
  enable: async (theme = "states") => {
    if (pendingTheme && pendingTheme !== theme) renderSvgFallback(pendingTheme);
    pendingTheme = theme;
    clearOwnedSvgLayers(theme);
    if (theme === "states") window.drawRelief();
    await (await getInstance()).enable(theme);
  },
  getSnapshot: () => instance?.getSnapshot() ?? null,
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
  ownsLayer: layer => !materializingSvgFallback && pendingTheme !== null && isPixiLayerOwned(pendingTheme, layer),
  queueRebuild: () => {
    void instancePromise?.then(instance => instance.queueRebuild());
  },
  rebuild: async () => (await getInstance()).rebuild(),
  syncCamera: () => instance?.syncCamera()
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
if (params.get("renderer") === "pixi") pendingTheme = params.get("pixiTheme") === "biomes" ? "biomes" : "states";
