import { LAYER_CONTROLS_CHANGE_EVENT } from "@/components/layers/layer-controls";
import type { PixiMapPrototype, PixiMapTheme, PixiPrototypeSnapshot } from "./pixi-map-prototype";

export interface PixiMapPrototypeApi {
  clear: () => Promise<void>;
  disable: () => Promise<void>;
  enable: (theme?: PixiMapTheme) => Promise<void>;
  getSnapshot: () => PixiPrototypeSnapshot | null;
  queueRebuild: () => void;
  rebuild: () => Promise<void>;
}

let instancePromise: Promise<PixiMapPrototype> | null = null;
let instance: PixiMapPrototype | null = null;
let pendingTheme: PixiMapTheme | null = null;

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
    pendingTheme = null;
    instance?.disable();
  },
  enable: async (theme = "states") => {
    pendingTheme = theme;
    await (await getInstance()).enable(theme);
  },
  getSnapshot: () => instance?.getSnapshot() ?? null,
  queueRebuild: () => {
    void instancePromise?.then(instance => instance.queueRebuild());
  },
  rebuild: async () => (await getInstance()).rebuild()
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
