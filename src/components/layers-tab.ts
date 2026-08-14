// Layers tab: a projection of the Layers registry. Holds the only mapping between a layer and its button.
import type { Layer } from "@/renderers/layers/layers";
import { Layers } from "@/renderers/layers/layers";
import {
  biomesLayer,
  bordersLayer,
  burgIconsLayer,
  cellsLayer,
  compassLayer,
  coordinatesLayer,
  culturesLayer,
  emblemsLayer,
  goodsLayer,
  gridLayer,
  heightmapLayer,
  iceLayer,
  labelsLayer,
  lakesLayer,
  markersLayer,
  marketsLayer,
  militaryLayer,
  populationLayer,
  precipitationLayer,
  provincesLayer,
  reliefLayer,
  religionsLayer,
  riversLayer,
  routesLayer,
  rulersLayer,
  scaleBarLayer,
  statesLayer,
  temperatureLayer,
  textureLayer,
  tradeLayer,
  vignetteLayer,
  zonesLayer
} from "@/renderers/layers/map-layers";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { isCtrlClick } from "@/utils";
import { ensureEl, findEl } from "@/utils/nodeUtils";

interface LayerButton {
  /** button text, may contain markup marking the shortcut letter */
  label: string;
  /** KeyboardEvent.code */
  shortcut?: string;
  /** shortcut as shown in the tip, defaults to the code without the "Key" prefix */
  hint?: string;
}

// only layers listed here get a button, in registry order
export const BUTTONS = new Map<Layer, LayerButton>([
  [textureLayer, { label: "Te<u>x</u>ture", shortcut: "KeyX" }],
  [heightmapLayer, { label: "<u>H</u>eightmap", shortcut: "KeyH" }],
  [lakesLayer, { label: "Lakes", shortcut: "KeyQ" }],
  [biomesLayer, { label: "<u>B</u>iomes", shortcut: "KeyB" }],
  [cellsLayer, { label: "C<u>e</u>lls", shortcut: "KeyE" }],
  [gridLayer, { label: "Grid", shortcut: "Semicolon", hint: "; (semicolon)" }],
  [coordinatesLayer, { label: "C<u>o</u>ordinates", shortcut: "KeyO" }],
  [compassLayer, { label: "<u>W</u>ind Rose", shortcut: "KeyW" }],
  [riversLayer, { label: "Ri<u>v</u>ers", shortcut: "KeyV" }],
  [reliefLayer, { label: "Relie<u>f</u>", shortcut: "KeyF" }],
  [religionsLayer, { label: "<u>R</u>eligions", shortcut: "KeyR" }],
  [culturesLayer, { label: "<u>C</u>ultures", shortcut: "KeyC" }],
  [statesLayer, { label: "<u>S</u>tates", shortcut: "KeyS" }],
  [provincesLayer, { label: "<u>P</u>rovinces", shortcut: "KeyP" }],
  [zonesLayer, { label: "<u>Z</u>ones", shortcut: "KeyZ" }],
  [bordersLayer, { label: "Bor<u>d</u>ers", shortcut: "KeyD" }],
  [routesLayer, { label: "Ro<u>u</u>tes", shortcut: "KeyU" }],
  [temperatureLayer, { label: "<u>T</u>emperature", shortcut: "KeyT" }],
  [iceLayer, { label: "Ice", shortcut: "KeyJ" }],
  [goodsLayer, { label: "<u>G</u>oods", shortcut: "KeyG" }],
  [marketsLayer, { label: "Markets" }],
  [tradeLayer, { label: "Trade", shortcut: "Backquote", hint: "` (backtick)" }],
  [precipitationLayer, { label: "Precipit<u>a</u>tion", shortcut: "KeyA" }],
  [populationLayer, { label: "Populatio<u>n</u>", shortcut: "KeyN" }],
  [emblemsLayer, { label: "Emblems", shortcut: "KeyY" }],
  [burgIconsLayer, { label: "<u>I</u>cons", shortcut: "KeyI" }],
  [labelsLayer, { label: "<u>L</u>abels", shortcut: "KeyL" }],
  [militaryLayer, { label: "<u>M</u>ilitary", shortcut: "KeyM" }],
  [markersLayer, { label: "Mar<u>k</u>ers", shortcut: "KeyK" }],
  [rulersLayer, { label: "Rulers", shortcut: "Equal", hint: "= (equal sign)" }],
  [scaleBarLayer, { label: "Scale Bar", shortcut: "Slash", hint: "/ (slash sign)" }],
  [vignetteLayer, { label: "Vignette", shortcut: "BracketLeft", hint: "[ (left square bracket)" }]
]);

export const getLayerByShortcut = (code: string): Layer | undefined =>
  [...BUTTONS].find(([, button]) => button.shortcut === code)?.[0];

const list = ensureEl("mapLayers");

function render(): void {
  list.replaceChildren(
    ...Layers.all.flatMap(layer => {
      const button = BUTTONS.get(layer);
      if (!button) return [];

      const item = document.createElement("li");
      item.dataset.layer = layer.id;
      item.dataset.tip = `${button.label.replace(/<\/?u>/g, "")}: click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style`;
      if (button.shortcut) item.dataset.shortcut = button.hint ?? button.shortcut.replace("Key", "");
      item.innerHTML = button.label;
      item.classList.toggle("buttonoff", !layer.isOn);
      item.classList.toggle("solid", layer.params.parent !== "viewbox"); // layers outside the viewbox cannot be reordered
      return [item];
    })
  );
}

list.addEventListener("click", event => {
  const layerId = (event.target as HTMLElement).closest("li")?.dataset.layer;
  const layer = layerId ? Layers.get(layerId) : undefined;
  if (!layer) return;

  if (isCtrlClick(event)) return void editStyle(layer.elementId);
  Layers.toggle(layer);
});

// move layers on mapLayers dragging (jquery sortable)
$("#mapLayers").sortable({
  items: "li:not(.solid)",
  containment: "parent",
  cancel: ".solid",
  update: (_event: Event, ui: { item: any }) => {
    const layer = Layers.get(ui.item.data("layer"));
    if (layer) Layers.move(layer, Layers.get(ui.item.next().data("layer")));
  }
});

Layers.subscribe(render);
Layers.subscribe(() => ViewportLayers.renderNow());

// the 3d view renders the map as a texture: refresh it on any layer change, once the batch has settled
let view3dRefresh: number | undefined;
Layers.subscribe(() => {
  if (!findEl("canvas3d")) return;
  clearTimeout(view3dRefresh);
  view3dRefresh = window.setTimeout(() => void Controllers.View3d.update(), 400);
});

render();
