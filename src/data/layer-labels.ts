// The layers the Layers tab lists, with their translated button labels and hotkeys; the style editor names elements by these
import type { LayerId } from "@/components/layers";
import { t } from "@/utils/i18n";

export interface LayerButton {
  label: string; // plain button text; the shortcut letter is underlined when rendered
  shortcut?: string; // KeyboardEvent.code
  hint?: string; // shortcut as shown in the tip, defaults to the code without the "Key" prefix
}

// only layers listed here get a button, in registry order
export const LAYER_TOGGLES = new Map<LayerId, LayerButton>([
  ["texture", { label: t("Texture"), shortcut: "KeyX" }],
  ["heightmap", { label: t("Heightmap"), shortcut: "KeyH" }],
  ["lakes", { label: t("Lakes"), shortcut: "KeyQ" }],
  ["biomes", { label: t("Biomes"), shortcut: "KeyB" }],
  ["cells", { label: t("Cells"), shortcut: "KeyE" }],
  ["grid", { label: t("Grid"), shortcut: "Semicolon", hint: "; (semicolon)" }],
  ["coordinates", { label: t("Coordinates"), shortcut: "KeyO" }],
  ["compass", { label: t("Wind Rose"), shortcut: "KeyW" }],
  ["rivers", { label: t("Rivers"), shortcut: "KeyV" }],
  ["relief", { label: t("Relief"), shortcut: "KeyF" }],
  ["religions", { label: t("Religions"), shortcut: "KeyR" }],
  ["cultures", { label: t("Cultures"), shortcut: "KeyC" }],
  ["states", { label: t("States"), shortcut: "KeyS" }],
  ["provinces", { label: t("Provinces"), shortcut: "KeyP" }],
  ["zones", { label: t("Zones"), shortcut: "KeyZ" }],
  ["borders", { label: t("Borders"), shortcut: "KeyD" }],
  ["routes", { label: t("Routes"), shortcut: "KeyU" }],
  ["temperature", { label: t("Temperature"), shortcut: "KeyT" }],
  ["ice", { label: t("Ice"), shortcut: "KeyJ" }],
  ["goods", { label: t("Goods"), shortcut: "KeyG" }],
  ["markets", { label: t("Markets") }],
  ["trade", { label: t("Trade"), shortcut: "Backquote", hint: "` (backtick)" }],
  ["precipitation", { label: t("Precipitation"), shortcut: "KeyA" }],
  ["population", { label: t("Population"), shortcut: "KeyN" }],
  ["emblems", { label: t("Emblems"), shortcut: "KeyY" }],
  ["burgIcons", { label: t("Icons"), shortcut: "KeyI" }],
  ["labels", { label: t("Labels"), shortcut: "KeyL" }],
  ["military", { label: t("Military"), shortcut: "KeyM" }],
  ["markers", { label: t("Markers"), shortcut: "KeyK" }],
  ["journeys", { label: t("Journeys") }],
  ["rulers", { label: t("Rulers"), shortcut: "Equal", hint: "= (equal sign)" }],
  ["scaleBar", { label: t("Scale Bar"), shortcut: "Slash", hint: "/ (slash sign)" }],
  ["vignette", { label: t("Vignette"), shortcut: "BracketLeft", hint: "[ (left square bracket)" }]
]);

/** The label of a layer; `map` is the whole-map style element */
export function layerLabel(id: string): string {
  if (id === "map") return t("Map");
  const label = LAYER_TOGGLES.get(id as LayerId)?.label;
  return label ?? id.charAt(0).toUpperCase() + id.slice(1); // the permanent layers have no button
}

/** The button label as markup, its first occurrence of the hotkey letter underlined */
export function underlineHotkey({ label, shortcut }: LayerButton): string {
  const letter = shortcut?.startsWith("Key") ? shortcut.slice(3).toLowerCase() : "";
  const index = letter ? label.toLowerCase().indexOf(letter) : -1;
  if (index < 0) return label;
  return `${label.slice(0, index)}<u>${label[index]}</u>${label.slice(index + 1)}`;
}
