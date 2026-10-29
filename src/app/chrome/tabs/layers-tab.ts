// Layers tab: a projection of the Layers registry. Renders the layer buttons and wires them up.

import { Controllers } from "@/controllers";
import { isConquestEnabled, subscribeConquestView } from "@/controllers/conquest-mode";
import { ASTRAL_LAYER_TOGGLES } from "@/data/astral-layer-labels";
import { ASTRAL_DEFAULT_PRESET, ASTRAL_PRESETS } from "@/data/astral-layers";
import { LAYER_TOGGLES, type LayerButton, underlineHotkey } from "@/data/layer-labels";
import type { LayerId } from "@/renderers/layers";
import { Layers } from "@/renderers/layers";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { isAstralView, subscribeAstralView } from "@/renderers/view-mode";
import { isCtrlClick } from "@/utils/common-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";

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

export { ASTRAL_LAYER_TOGGLES } from "@/data/astral-layer-labels";
export { LAYER_TOGGLES } from "@/data/layer-labels";

const toggles = (): Map<LayerId, LayerButton> => (isAstralView() ? ASTRAL_LAYER_TOGGLES : LAYER_TOGGLES);

export const getLayerByShortcut = (code: string): LayerId | undefined => {
  const conquestActive = isConquestEnabled();
  return [...toggles()].find(([id, button]) => {
    if (!conquestActive && id.startsWith("tw")) return false;
    return button.shortcut === code;
  })?.[0];
};

const ASTRAL_PRESET_IDS = new Set(Object.keys(ASTRAL_PRESETS));

const TEMPLATE = /* html */ `
  <div class="head">
    <p data-tip="${t("Select a map layers preset")}">${t("Layers preset")}:</p>
    <select data-tip="${t("Select a map layers preset")}" id="layersPreset" style="width: 45%"></select>
    <button
      id="savePresetButton"
      data-tip="${t("Click to save displayed layers as a new preset")}"
      class="icon-plus sideButton"
      style="display: none"
    ></button>
    <button
      id="removePresetButton"
      data-tip="${t("Remove")}"
      class="icon-minus sideButton"
      style="display: none"
    ></button>
    <button id="layersOrderButton" data-tip="${t("Change the layer order")}" class="icon-sort-alt-down sideButton"></button>
  </div>
  <div data-tip="${sentences(t("Click to toggle the layer"), t("Ctrl + click to edit layer style"))}" id="mapLayers"></div>
  <div class="tip">${t("Click to toggle the layer")}. ${t("Ctrl + click to edit layer style")}</div>
  <div id="viewMode" data-tip="${t("Set view mode")}">
    <p>${t("View mode")}:</p>
    <button data-tip="${t("Standard view mode for editing the map")}" id="viewStandard" class="pressed">
      ${t("Standard")}
    </button>
    <button
      data-tip="${sentences(t("Map presentation in 3D scene"), t("Works best for heightmap"), t("Cannot be used for editing"))}"
      id="viewMesh"
    >
      ${t("3D scene")}
    </button>
    <button data-tip="${sentences(t("Project map on globe"), t("Cannot be used for editing"))}" id="viewGlobe">${t("Globe")}</button>
    <button data-tip="${t("Living World simulation: seasonal clock, news ticker, inspector and god mode")}" id="viewLivingWorld">${t("Living World")}</button>
    <button data-tip="${t("Astral view: star chart layers, nebulae and systems")}" id="viewAstral">${t("Astral")}</button>
  </div>
`;

ensureEl("layersContent").innerHTML = TEMPLATE;

function renderPresetOptions(): void {
  const select = ensureEl<HTMLSelectElement>("layersPreset");
  const known = new Set(Array.from(select.options, option => option.value));

  for (const [id, label] of Object.entries(LAYER_PRESETS)) {
    if (!known.has(id)) select.add(new Option(label, id));
  }
  for (const [id, preset] of Object.entries(ASTRAL_PRESETS)) {
    if (!known.has(id)) select.add(new Option(preset.name, id));
  }
  if (!known.has("custom")) select.add(new Option(t("Custom (not saved)"), "custom"));

  const astral = isAstralView();
  for (const option of Array.from(select.options)) {
    option.hidden = astral
      ? !ASTRAL_PRESET_IDS.has(option.value) && option.value !== "custom"
      : ASTRAL_PRESET_IDS.has(option.value);
  }

  const fallback = astral ? ASTRAL_DEFAULT_PRESET : "political";
  const current = Array.from(select.options).find(option => option.value === select.value && !option.hidden);
  if (!current) select.value = fallback;
}

function render(): void {
  renderPresetOptions();
  const activeToggles = toggles();
  const conquestActive = isConquestEnabled();
  ensureEl("mapLayers").replaceChildren(
    ...Layers.all.flatMap(layer => {
      if (!conquestActive && layer.id.startsWith("tw")) return [];
      const button = activeToggles.get(layer.id);
      if (!button) return [];

      const item = document.createElement("button");
      item.dataset.layer = layer.id;
      item.dataset.tip = sentences(
        t("Toggle {{- layer}}", { layer: button.label }),
        t("Ctrl + click to edit layer style")
      );
      if (button.shortcut) item.dataset.shortcut = button.hint ?? button.shortcut.replace("Key", "");
      item.innerHTML = underlineHotkey(button);
      item.classList.toggle("buttonoff", !Layers.isOn(layer.id));
      return [item];
    })
  );
}

ensureEl("mapLayers").addEventListener("click", event => {
  const id = (event.target as HTMLElement).closest("button")?.dataset.layer;
  if (!id || !Layers.has(id)) return;

  if (isCtrlClick(event) && !options.map.viewOnly) return void Controllers.StyleEditor.open(id);
  Layers.toggle(id);
});

ensureEl("layersOrderButton").addEventListener("click", () => void Controllers.LayersOrder.open());

Layers.subscribe(render);
subscribeAstralView(render);
subscribeConquestView(render);
Layers.subscribe(() => ViewportLayers.renderNow());

// the 3d view renders the map as a texture: refresh it on any layer change, once the batch has settled
let view3dRefresh: number | undefined;
Layers.subscribe(() => {
  if (!findEl("canvas3d")) return;
  clearTimeout(view3dRefresh);
  view3dRefresh = window.setTimeout(() => void Controllers.View3d.update(), 400);
});

render();