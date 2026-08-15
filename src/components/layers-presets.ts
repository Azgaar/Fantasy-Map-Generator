// Layer presets: named sets of layers the user can switch between, stored in localStorage
import { Layers } from "@/renderers/layers/layers";
import { toCanonicalLayerId } from "@/services/io/legacy-layer-ids";
import { ensureEl } from "@/utils";
import { confirmationDialog } from "./dialog/dialog-helpers";
import { BUTTONS } from "./layers-tab";

const DEFAULT_PRESETS: Record<string, string[]> = {
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

const presets = restoreCustomPresets();

// a preset lists the layers the user can toggle from the tab. Layers driven by the map itself — fogging follows
// the state focus — are never part of one, so they must not be compared against it or saved into it
const activeUserLayers = (): string[] => Layers.state.active.filter(id => BUTTONS.has(id)).sort();

function restoreCustomPresets(): Record<string, string[]> {
  const stored: Record<string, string[]> | null = JSON.parse(localStorage.getItem("presets") || "null");
  if (!stored) return { ...DEFAULT_PRESETS };

  for (const name in stored) {
    stored[name] = stored[name].map(toCanonicalLayerId); // presets saved before 1.144 hold toggle* button ids
    if (!DEFAULT_PRESETS[name]) ensureEl<HTMLSelectElement>("layersPreset").add(new Option(name, name));
  }

  localStorage.setItem("presets", JSON.stringify(stored));
  return stored;
}

/** run on map generation: the layers are drawn right after, so the state is applied without drawing */
export function applyLayersPreset(): void {
  const stored = localStorage.getItem("preset") || ensureEl<HTMLSelectElement>("layersPreset").value;
  const name = stored in presets ? stored : "political"; // the stored preset may have been removed
  setPresetName(name);

  Layers.restore({ order: Layers.state.order, active: presets[name] });
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

      presets[name] = activeUserLayers();
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

/** highlight the preset matching the current layers, run on every layers change */
function highlightCurrentPreset(): void {
  const active = activeUserLayers().join(",");
  const current = Object.keys(presets).find(name => [...presets[name]].sort().join(",") === active);

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
  }
}

window.applyLayersPreset = applyLayersPreset;
