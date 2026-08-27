// Layer presets: named sets of layers the user can switch between, stored in localStorage
import { ensureEl } from "@/utils";
import { confirmationDialog } from "./dialog/dialog-helpers";
import { type LayerId, Layers } from "./layers";
import { LAYER_TOGGLES } from "./layers-tab";

const DEFAULT_PRESETS: Record<string, LayerId[]> = {
  political: ["borders", "burgIcons", "ice", "labels", "lakes", "rivers", "routes", "scaleBar", "states", "vignette"],
  cultural: ["borders", "burgIcons", "cultures", "labels", "lakes", "rivers", "routes", "scaleBar", "vignette"],
  religions: ["borders", "burgIcons", "labels", "lakes", "religions", "rivers", "routes", "scaleBar", "vignette"],
  provinces: ["borders", "burgIcons", "labels", "lakes", "provinces", "rivers", "scaleBar", "vignette"],
  biomes: ["biomes", "ice", "lakes", "rivers", "scaleBar", "vignette"],
  heightmap: ["heightmap", "lakes", "rivers", "vignette"],
  physical: ["coordinates", "heightmap", "ice", "lakes", "rivers", "scaleBar", "vignette"],
  poi: ["borders", "burgIcons", "heightmap", "ice", "lakes", "markers", "rivers", "routes", "scaleBar", "vignette"],
  goods: [
    "borders",
    "burgIcons",
    "cells",
    "goods",
    "lakes",
    "markets",
    "rivers",
    "routes",
    "scaleBar",
    "trade",
    "vignette"
  ],
  trade: ["borders", "burgIcons", "lakes", "rivers", "routes", "scaleBar", "states", "trade", "vignette"],
  military: [
    "borders",
    "burgIcons",
    "labels",
    "lakes",
    "military",
    "rivers",
    "routes",
    "scaleBar",
    "states",
    "vignette"
  ],
  emblems: ["borders", "burgIcons", "emblems", "ice", "lakes", "rivers", "routes", "scaleBar", "states", "vignette"],
  landmass: ["scaleBar"]
};

const presets: Record<string, string[]> = { ...DEFAULT_PRESETS };
restoreCustomPresets();

function restoreCustomPresets(): void {
  const stored: Record<string, string[]> | null = JSON.parse(localStorage.getItem("presets") || "null");
  if (!stored) return;

  for (const name in stored) {
    if (!stored[name].every(id => Layers.has(id))) continue;
    presets[name] = stored[name];
    if (!DEFAULT_PRESETS[name]) ensureEl<HTMLSelectElement>("layersPreset").add(new Option(name, name));
  }
}

/** run on map generation: the layers are drawn right after, so the state is applied without drawing */
export function applyLayersPreset(): void {
  const stored = localStorage.getItem("preset") || ensureEl<HTMLSelectElement>("layersPreset").value;
  const name = stored in presets ? stored : "political"; // the stored preset may have been removed
  setPresetName(name);

  Layers.restore({ order: Layers.state.order, active: presets[name] });
}

/** Apply ?preset= or ?layers= from the URL. Layer names are canonical LayerId values and layers takes precedence. */
export function applyURLLayers(params: URLSearchParams): void {
  const layersParam = params.get("layers");
  if (layersParam) {
    const ids = layersParam
      .split(",")
      .map(s => s.trim())
      .filter(id => Layers.has(id));
    if (ids.length) {
      Layers.set(ids);
    } else {
      ERROR && console.error(`URL param layers="${layersParam}" has no valid layer ids`);
    }
    return;
  }

  const presetParam = params.get("preset");
  const presetName = presetParam && findPresetName(presetParam);
  if (presetName) {
    setPresetName(presetName);
    Layers.set(presets[presetName]);
  } else if (presetParam) {
    ERROR && console.error(`URL param preset="${presetParam}" is invalid`);
  }
}

/** Find a preset by its case-insensitive key or displayed name. */
function findPresetName(param: string): string | undefined {
  const needle = param.toLowerCase().trim();
  const byKey = Object.keys(presets).find(key => key.toLowerCase() === needle);
  if (byKey) return byKey;

  const option = Array.from(ensureEl<HTMLSelectElement>("layersPreset").options).find(
    option => option.text.toLowerCase() === needle
  );
  return option?.value && option.value in presets ? option.value : undefined;
}

function setPresetName(name: string): void {
  ensureEl<HTMLSelectElement>("layersPreset").value = name;
  localStorage.setItem("preset", name);
  ensureEl("removePresetButton").style.display = DEFAULT_PRESETS[name] ? "none" : "inline-block";
  ensureEl("savePresetButton").style.display = "none";
}

function savePreset(): void {
  confirmationDialog({
    title: "Save layer preset",
    message: /*html*/ `<label>Preset name: <input id="layersPresetName" type="text" autocomplete="off" /></label>`,
    confirm: "Save",
    onConfirm: () => {
      const name = ensureEl<HTMLInputElement>("layersPresetName").value.trim();
      if (!name) return;

      const activeUserLayers = Layers.all
        .filter(layer => LAYER_TOGGLES.has(layer.id) && Layers.isOn(layer.id))
        .map(layer => layer.id);

      presets[name] = activeUserLayers;
      ensureEl<HTMLSelectElement>("layersPreset").add(new Option(name, name, false, true));
      localStorage.setItem("presets", JSON.stringify(presets));
      localStorage.setItem("preset", name);
      ensureEl("removePresetButton").style.display = "inline-block";
      ensureEl("savePresetButton").style.display = "none";
    }
  });

  ensureEl<HTMLInputElement>("layersPresetName").focus();
}

function removePreset(): void {
  const name = ensureEl<HTMLSelectElement>("layersPreset").value;
  delete presets[name];
  ensureEl<HTMLSelectElement>("layersPreset").options.remove(
    Array.from(ensureEl<HTMLSelectElement>("layersPreset").options).findIndex(option => option.value === name)
  );
  ensureEl<HTMLSelectElement>("layersPreset").value = "custom";
  ensureEl("removePresetButton").style.display = "none";
  ensureEl("savePresetButton").style.display = "inline-block";

  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.removeItem("preset");
}

function highlightCurrentPreset(): void {
  const asSet = (ids: readonly string[]): string => [...ids].sort().join(",");
  const active = asSet(
    Layers.all.filter(layer => LAYER_TOGGLES.has(layer.id) && Layers.isOn(layer.id)).map(layer => layer.id)
  );
  const current = Object.keys(presets).find(name => asSet(presets[name]) === active);

  ensureEl<HTMLSelectElement>("layersPreset").value = current ?? "custom";
  ensureEl("removePresetButton").style.display = current && !DEFAULT_PRESETS[current] ? "inline-block" : "none";
  ensureEl("savePresetButton").style.display = current ? "none" : "inline-block";
}

ensureEl<HTMLSelectElement>("layersPreset").addEventListener("change", event => {
  const presetName = (event.target as HTMLSelectElement).value;
  setPresetName(presetName);
  Layers.set(presets[presetName]);
});
ensureEl("savePresetButton").addEventListener("click", savePreset);
ensureEl("removePresetButton").addEventListener("click", removePreset);

Layers.subscribe(highlightCurrentPreset);

declare global {
  interface Window {
    applyLayersPreset: typeof applyLayersPreset;
    applyURLLayers: typeof applyURLLayers;
  }
}

window.applyLayersPreset = applyLayersPreset;
window.applyURLLayers = applyURLLayers;
