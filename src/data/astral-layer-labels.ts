// The Layers tab buttons shown in Astral view. Standard labels stay in layer-labels.ts
import type { LayerId } from "@/components/layers";
import type { LayerButton } from "./layer-labels";

export const ASTRAL_LAYER_TOGGLES = new Map<LayerId, LayerButton>([
  ["texture", { label: "Sector <u>D</u>ust", shortcut: "KeyD" }],
  ["nebulae", { label: "<u>N</u>ebulae", shortcut: "KeyN" }],
  ["starDensity", { label: "<u>P</u>opulation", shortcut: "KeyP" }],
  ["systems", { label: "S<u>y</u>stems", shortcut: "KeyY" }],
  ["states", { label: "<u>E</u>mpires" }],
  ["provinces", { label: "<u>S</u>ectors", shortcut: "KeyS" }],
  ["borders", { label: "<u>B</u>orders", shortcut: "KeyB" }],
  ["zones", { label: "<u>Z</u>ones", shortcut: "KeyZ" }],
  ["routes", { label: "<u>H</u>yperlanes", shortcut: "KeyH" }],
  ["markers", { label: "<u>A</u>nomalies", shortcut: "KeyA" }],
  ["labels", { label: "<u>L</u>abels", shortcut: "KeyL" }],
  ["coordinates", { label: "Sensor <u>G</u>rid", shortcut: "KeyG" }],
  ["scaleBar", { label: "Scale Bar", shortcut: "Slash", hint: "/ (slash sign)" }]
]);
