// Layer presets: named sets of layers the user can switch between, stored in localStorage
import { Layers } from "@/renderers/layers/layers-registry";
import { toCanonicalLayerId } from "@/services/io/legacy-layer-ids";
import { ensureEl } from "@/utils";
import { BUTTONS } from "./layers-tab";

// custom legacy 3-arg prompt from commonUtils.initializePrompt (collides with lib.dom's var prompt)
declare const prompt: (text: string, options: { default: string }, callback: (value: string) => void) => void;

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
  ], // prettier-ignore
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
  ], // prettier-ignore
  emblems: ["borders", "burgIcons", "emblems", "ice", "lakes", "rivers", "routes", "scaleBar", "states", "vignette"],
  landmass: ["scaleBar"]
};

const select = () => ensureEl<HTMLSelectElement>("layersPreset");
const presets = restoreCustomPresets();

// a preset lists the layers the user can toggle from the tab. Layers driven by the map itself — fogging follows
// the state focus — are never part of one, so they must not be compared against it or saved into it
const activeUserLayers = (): string[] =>
  Layers.all
    .filter(layer => BUTTONS.has(layer) && layer.isOn)
    .map(layer => layer.id)
    .sort();

function restoreCustomPresets(): Record<string, string[]> {
  const stored: Record<string, string[]> | null = JSON.parse(localStorage.getItem("presets") || "null");
  if (!stored) return { ...DEFAULT_PRESETS };

  for (const name in stored) {
    stored[name] = stored[name].map(toCanonicalLayerId); // presets saved before 1.144 hold toggle* button ids
    if (!DEFAULT_PRESETS[name]) select().add(new Option(name, name));
  }

  localStorage.setItem("presets", JSON.stringify(stored));
  return stored;
}

/** run on map generation: the layers are drawn right after, so the state is applied without drawing */
export function applyLayersPreset(): void {
  const stored = localStorage.getItem("preset") || select().value;
  const name = stored in presets ? stored : "political"; // the stored preset may have been removed
  setPresetName(name);

  Layers.restore({ order: Layers.state.order, active: presets[name] });
}

function setPresetName(name: string): void {
  select().value = name;
  localStorage.setItem("preset", name);
  ensureEl("removePresetButton").style.display = DEFAULT_PRESETS[name] ? "none" : "inline-block";
  ensureEl("savePresetButton").style.display = "none";
}

function changePreset(name: string): void {
  setPresetName(name);
  Layers.setActive(presets[name].map(layerId => Layers.get(layerId)).filter(layer => layer !== undefined));
}

function savePreset(): void {
  prompt("Please provide a preset name", { default: "" }, (name: string) => {
    presets[name] = activeUserLayers();
    select().add(new Option(name, name, false, true));
    localStorage.setItem("presets", JSON.stringify(presets));
    localStorage.setItem("preset", name);
    ensureEl("removePresetButton").style.display = "inline-block";
    ensureEl("savePresetButton").style.display = "none";
  });
}

function removePreset(): void {
  const name = select().value;
  delete presets[name];
  select().options.remove(Array.from(select().options).findIndex(option => option.value === name));
  select().value = "custom";
  ensureEl("removePresetButton").style.display = "none";
  ensureEl("savePresetButton").style.display = "inline-block";

  localStorage.setItem("presets", JSON.stringify(presets));
  localStorage.removeItem("preset");
}

/** highlight the preset matching the current layers, run on every layers change */
function highlightCurrentPreset(): void {
  const active = activeUserLayers().join(",");
  const current = Object.keys(presets).find(name => [...presets[name]].sort().join(",") === active);

  select().value = current ?? "custom";
  ensureEl("removePresetButton").style.display = current && !DEFAULT_PRESETS[current] ? "inline-block" : "none";
  ensureEl("savePresetButton").style.display = current ? "none" : "inline-block";
}

select().addEventListener("change", event => changePreset((event.target as HTMLSelectElement).value));
ensureEl("savePresetButton").addEventListener("click", savePreset);
ensureEl("removePresetButton").addEventListener("click", removePreset);
Layers.subscribe(highlightCurrentPreset);

declare global {
  interface Window {
    applyLayersPreset: typeof applyLayersPreset;
  }
}

window.applyLayersPreset = applyLayersPreset;
