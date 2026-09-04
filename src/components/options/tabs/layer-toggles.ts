// The only mapping between a layer and its button. Data only: the tab that renders these buttons
// wires up the DOM on import, so anything that just needs the mapping reads it from here
import type { LayerId } from "@/components/layers";

export interface LayerButton {
  label: string; // button text, may contain markup marking the shortcut letter
  shortcut?: string; // KeyboardEvent.code
  hint?: string; // shortcut as shown in the tip, defaults to the code without the "Key" prefix
}

// only layers listed here get a button, in registry order
export const LAYER_TOGGLES = new Map<LayerId, LayerButton>([
  ["texture", { label: "Te<u>x</u>ture", shortcut: "KeyX" }],
  ["heightmap", { label: "<u>H</u>eightmap", shortcut: "KeyH" }],
  ["lakes", { label: "Lakes", shortcut: "KeyQ" }],
  ["biomes", { label: "<u>B</u>iomes", shortcut: "KeyB" }],
  ["cells", { label: "C<u>e</u>lls", shortcut: "KeyE" }],
  ["grid", { label: "Grid", shortcut: "Semicolon", hint: "; (semicolon)" }],
  ["coordinates", { label: "C<u>o</u>ordinates", shortcut: "KeyO" }],
  ["compass", { label: "<u>W</u>ind Rose", shortcut: "KeyW" }],
  ["rivers", { label: "Ri<u>v</u>ers", shortcut: "KeyV" }],
  ["relief", { label: "Relie<u>f</u>", shortcut: "KeyF" }],
  ["religions", { label: "<u>R</u>eligions", shortcut: "KeyR" }],
  ["cultures", { label: "<u>C</u>ultures", shortcut: "KeyC" }],
  ["states", { label: "<u>S</u>tates", shortcut: "KeyS" }],
  ["provinces", { label: "<u>P</u>rovinces", shortcut: "KeyP" }],
  ["zones", { label: "<u>Z</u>ones", shortcut: "KeyZ" }],
  ["borders", { label: "Bor<u>d</u>ers", shortcut: "KeyD" }],
  ["routes", { label: "Ro<u>u</u>tes", shortcut: "KeyU" }],
  ["temperature", { label: "<u>T</u>emperature", shortcut: "KeyT" }],
  ["ice", { label: "Ice", shortcut: "KeyJ" }],
  ["goods", { label: "<u>G</u>oods", shortcut: "KeyG" }],
  ["markets", { label: "Markets" }],
  ["trade", { label: "Trade", shortcut: "Backquote", hint: "` (backtick)" }],
  ["precipitation", { label: "Precipit<u>a</u>tion", shortcut: "KeyA" }],
  ["population", { label: "Populatio<u>n</u>", shortcut: "KeyN" }],
  ["emblems", { label: "Emblems", shortcut: "KeyY" }],
  ["burgIcons", { label: "<u>I</u>cons", shortcut: "KeyI" }],
  ["labels", { label: "<u>L</u>abels", shortcut: "KeyL" }],
  ["military", { label: "<u>M</u>ilitary", shortcut: "KeyM" }],
  ["markers", { label: "Mar<u>k</u>ers", shortcut: "KeyK" }],
  ["journeys", { label: "Journeys" }],
  ["rulers", { label: "Rulers", shortcut: "Equal", hint: "= (equal sign)" }],
  ["scaleBar", { label: "Scale Bar", shortcut: "Slash", hint: "/ (slash sign)" }],
  ["vignette", { label: "Vignette", shortcut: "BracketLeft", hint: "[ (left square bracket)" }]
]);

export const getLayerByShortcut = (code: string): LayerId | undefined =>
  [...LAYER_TOGGLES].find(([, button]) => button.shortcut === code)?.[0];
