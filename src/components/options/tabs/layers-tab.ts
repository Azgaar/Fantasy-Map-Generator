// Layers tab: a projection of the Layers registry. Renders the layer buttons and wires them up.
import { Layers } from "@/components/layers";
import { LAYER_TOGGLES } from "@/components/options/tabs/layer-toggles";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { isCtrlClick } from "@/utils";
import { ensureEl, findEl } from "@/utils/nodeUtils";

const TEMPLATE = /* html */ `
  <p data-tip="Select a map layers preset" style="display: inline-block">Layers preset:</p>
  <select
    data-tip="Select a map layers preset"
    id="layersPreset"
    style="width: 45%"
  >
    <option value="political" selected>Political map</option>
    <option value="cultural">Cultural map</option>
    <option value="religions">Religions map</option>
    <option value="provinces">Provinces map</option>
    <option value="biomes">Biomes map</option>
    <option value="heightmap">Heightmap</option>
    <option value="physical">Physical map</option>
    <option value="poi">Places of interest</option>
    <option value="goods">Goods map</option>
    <option value="trade">Trade animation</option>
    <option value="military">Military map</option>
    <option value="emblems">Emblems</option>
    <option value="landmass">Pure landmass</option>
    <option hidden value="custom">Custom (not saved)</option>
  </select>
  <button
    id="savePresetButton"
    data-tip="Click to save displayed layers as a new preset"
    class="icon-plus sideButton"
    style="display: none"
  ></button>
  <button
    id="removePresetButton"
    data-tip="Click to remove current custom preset"
    class="icon-minus sideButton"
    style="display: none"
  ></button>
  <p>Displayed layers and layers order:</p>
  <ul
    data-tip="Click to toggle a layer, drag to raise or lower a layer. Ctrl + click to edit layer style"
    id="mapLayers"
  >
  </ul>
  <div class="tip">Click to toggle, drag to raise or lower the layer</div>
  <div class="tip">Ctrl + click to edit layer style</div>
  <div id="viewMode" data-tip="Set view node">
    <p>View mode:</p>
    <button data-tip="Standard view mode that allows to edit the map" id="viewStandard" class="pressed">
      Standard
    </button>
    <button
      data-tip="Map presentation in 3D scene. Works best for heightmap. Cannot be used for editing"
      id="viewMesh"
    >
      3D scene
    </button>
    <button data-tip="Project map on globe. Cannot be used for editing" id="viewGlobe">Globe</button>
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
      item.dataset.tip = `${button.label.replace(/<\/?u>/g, "")}: click to toggle, drag to raise or lower the layer. Ctrl + click to edit layer style`;
      if (button.shortcut) item.dataset.shortcut = button.hint ?? button.shortcut.replace("Key", "");
      item.innerHTML = button.label;
      item.classList.toggle("buttonoff", !Layers.isOn(layer.id));
      item.classList.toggle("solid", layer.params.parent !== "viewbox"); // layers outside the viewbox cannot be reordered
      return [item];
    })
  );
}

ensureEl("mapLayers").addEventListener("click", event => {
  const id = (event.target as HTMLElement).closest("li")?.dataset.layer;
  if (!id || !Layers.has(id)) return;

  if (isCtrlClick(event)) return void editStyle(Layers.get(id).elementId);
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
