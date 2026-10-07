// Layers tab: a projection of the Layers registry. Renders the layer buttons and wires them up.
import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { LAYER_TOGGLES, underlineHotkey } from "@/data/layer-labels";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { isCtrlClick } from "@/utils";
import { t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/nodeUtils";

// built-in layer presets, in the order the select shows them; the layer sets live in layers-presets
export const LAYER_PRESETS: Record<string, string> = {
  political: t("Political map"),
  cultural: t("Cultural map"),
  religions: t("Religions map"),
  provinces: t("Provinces map"),
  biomes: t("Biomes map"),
  heightmap: t("Heightmap"),
  physical: t("Physical map"),
  poi: t("Places of interest"),
  goods: t("Goods map"),
  trade: t("Trade animation"),
  military: t("Military map"),
  emblems: t("Emblems"),
  landmass: t("Pure landmass")
};

export { LAYER_TOGGLES } from "@/data/layer-labels";

export const getLayerByShortcut = (code: string): LayerId | undefined =>
  [...LAYER_TOGGLES].find(([, button]) => button.shortcut === code)?.[0];

const TEMPLATE = /* html */ `
  <p data-tip="${t("Select a map layers preset")}" style="display: inline-block">${t("Layers preset:")}</p>
  <select data-tip="${t("Select a map layers preset")}" id="layersPreset" style="width: 45%">
    ${Object.entries(LAYER_PRESETS)
      .map(([id, label]) => `<option value="${id}">${label}</option>`)
      .join("")}
    <option hidden value="custom">${t("Custom (not saved)")}</option>
  </select>
  <button
    id="savePresetButton"
    data-tip="${t("Click to save displayed layers as a new preset")}"
    class="icon-plus sideButton"
    style="display: none"
  ></button>
  <button
    id="removePresetButton"
    data-tip="${t("Click to remove current custom preset")}"
    class="icon-minus sideButton"
    style="display: none"
  ></button>
  <p>${t("Displayed layers and layer order:")}</p>
  <ul
    data-tip="${t("Click to toggle a layer, drag to raise or lower a layer. Ctrl + click to edit layer style")}"
    id="mapLayers"
  >
  </ul>
  <div class="tip">${t("Click to toggle, drag to raise or lower the layer")}</div>
  <div class="tip">${t("Ctrl + click to edit layer style")}</div>
  <div id="viewMode" data-tip="${t("Set view mode")}">
    <p>${t("View mode:")}</p>
    <button data-tip="${t("Standard view mode for editing the map")}" id="viewStandard" class="pressed">
      ${t("Standard")}
    </button>
    <button
      data-tip="${t("Map presentation in 3D scene. Works best for heightmap. Cannot be used for editing")}"
      id="viewMesh"
    >
      ${t("3D scene")}
    </button>
    <button data-tip="${t("Project map on globe. Cannot be used for editing")}" id="viewGlobe">${t("Globe")}</button>
  </div>
`;

ensureEl("layersContent").innerHTML = TEMPLATE;

function render(): void {
  ensureEl("mapLayers").replaceChildren(
    ...Layers.all.flatMap(layer => {
      const button = LAYER_TOGGLES.get(layer.id);
      if (!button) return [];

      const item = document.createElement("li");
      item.dataset.layer = layer.id;
      item.dataset.tip = t(
        "{{layer}}: click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style",
        {
          layer: button.label
        }
      );
      if (button.shortcut) item.dataset.shortcut = button.hint ?? button.shortcut.replace("Key", "");
      item.innerHTML = underlineHotkey(button);
      item.classList.toggle("buttonoff", !Layers.isOn(layer.id));
      item.classList.toggle("solid", layer.params.parent !== "viewbox"); // layers outside the viewbox cannot be reordered
      return [item];
    })
  );
}

ensureEl("mapLayers").addEventListener("click", event => {
  const id = (event.target as HTMLElement).closest("li")?.dataset.layer;
  if (!id || !Layers.has(id)) return;

  if (isCtrlClick(event)) return void Controllers.StyleEditor.open(id);
  Layers.toggle(id);
});

// move layers on mapLayers dragging. TODO: deprecate jQuery
$("#mapLayers").sortable({
  items: "li:not(.solid)",
  containment: "parent",
  cancel: ".solid",
  update: (_event: Event, ui: { item: any }) => {
    const id = ui.item.data("layer");
    const before = ui.item.next().data("layer");
    const thisLayer = Layers.has(id) ? id : undefined;
    const beforeLayer = Layers.has(before) ? before : undefined;
    if (thisLayer) Layers.move(thisLayer, beforeLayer);
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
