import { getViewportSurface } from "@/application/viewport-surface";
import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { tip } from "@/components/tooltips";
import { RELIEF_SETS } from "@/data/relief-icons";
import { drawHeightmap } from "@/renderers/draw-heightmap";
import { redrawLegend } from "@/renderers/draw-legend";
import { drawMeasurers } from "@/renderers/draw-measurers";
import { drawRelief } from "@/renderers/draw-relief-icons";
import { drawScaleBar, fitScaleBar } from "@/renderers/draw-scalebar";
import { drawLabels } from "@/renderers/labels/labels-renderer";
import { OceanLayers } from "@/renderers/ocean-layers";
import { invalidateBurgSymbols } from "@/renderers/point-symbols";
import { addCustomHeightColorScheme, HEIGHT_COLOR_SCHEMES } from "@/renderers/scene/height-color-schemes";
import type {
  LegacyStylePreset,
  LegacyStylePresetAttributes,
  LegacyStylePresetValue
} from "@/renderers/scene/legacy-style-preset-adapter";
import type { ReliefSet } from "@/types/relief";
import type { LabelGroupStyle } from "@/types/style";
import { applyOption, downloadFile, ensureEl, uploadFile } from "@/utils";
import { CUSTOM_STYLE_PRESET_PREFIX } from "./style-preset-constants";
import { bindStylePresets, StylePresets, type StylePresetsApi } from "./style-presets-controller";

const systemPresets = [
  "default",
  "ancient",
  "gloom",
  "pale",
  "light",
  "watercolor",
  "clean",
  "atlas",
  "darkSeas",
  "cyberpunk",
  "night",
  "monochrome"
];
const RELIEF_STYLE_ATTRIBUTES = ["set", "size", "density"];
const styleSaverName = ensureEl<HTMLInputElement>("styleSaverName");
const styleSaverJSON = ensureEl<HTMLTextAreaElement>("styleSaverJSON");
const styleSaverTip = ensureEl("styleSaverTip");
const styleToLoad = ensureEl<HTMLInputElement>("styleToLoad");
const styleElementSelect = ensureEl<HTMLSelectElement>("styleElementSelect");
const stylePreset = ensureEl<HTMLSelectElement>("stylePreset");
const mapFilters = ensureEl("mapFilters");
const removeStyleButton = ensureEl("removeStyleButton");

// add style presets to list
{
  const systemOptions = systemPresets.map(styleName => `<option value="${styleName}">${styleName}</option>`);
  const storedStyles = Object.keys(localStorage).filter(key => key.startsWith(CUSTOM_STYLE_PRESET_PREFIX));
  const customOptions = storedStyles.map(
    styleName => `<option value="${styleName}">${styleName.replace(CUSTOM_STYLE_PRESET_PREFIX, "")} [custom]</option>`
  );
  const options = systemOptions.join("") + customOptions.join("");
  ensureEl("stylePreset").innerHTML = options;
}

const stylePresetsRuntime: StylePresetsApi = {
  add: addStylePreset,
  applyOnLoad: applyStyleOnLoad,
  requestChange: requestStylePresetChange,
  requestRemove: requestRemoveStylePreset
};
bindStylePresets(stylePresetsRuntime);
window.StylePresets = StylePresets;
stylePreset.addEventListener("change", () => requestStylePresetChange(stylePreset.value));
ensureEl("addStyleButton").addEventListener("click", addStylePreset);
removeStyleButton.addEventListener("click", requestRemoveStylePreset);

async function applyStyleOnLoad() {
  const desiredPreset = localStorage.getItem("presetStyle") || "default";
  const styleData = await getStylePreset(desiredPreset);
  const [appliedPreset, style] = styleData;

  applyStylePreset(style);
  updateMapFilter();
  stylePreset.value = stylePreset.dataset.old = appliedPreset;
  setPresetRemoveButtonVisibiliy();
}

async function getStylePreset(desiredPreset: string): Promise<[string, LegacyStylePreset]> {
  let presetToLoad = desiredPreset;

  const isCustom = !systemPresets.includes(desiredPreset);
  if (isCustom) {
    const storedStyleJSON = localStorage.getItem(desiredPreset);
    if (!storedStyleJSON) {
      ERROR && console.error(`Custom style ${desiredPreset} in not found in localStorage. Applying default style`);
      presetToLoad = "default";
    } else {
      const isValid = JSON.isValid(storedStyleJSON);
      if (isValid) return [desiredPreset, JSON.parse(storedStyleJSON) as LegacyStylePreset];

      ERROR &&
        console.error(`Custom style ${desiredPreset} stored in localStorage is not valid. Applying default style`);
      presetToLoad = "default";
    }
  }

  const style = await fetchSystemPreset(presetToLoad);
  return [presetToLoad, style];
}

async function fetchSystemPreset(preset: string): Promise<LegacyStylePreset> {
  try {
    const res = await fetch(`./styles/${preset}.json?v=${VERSION}`);
    return (await res.json()) as LegacyStylePreset;
  } catch (err) {
    throw new Error(`Cannot fetch style preset ${preset}`, { cause: err });
  }
}

function applyStylePreset(presetJson: LegacyStylePreset): void {
  for (const selector in presetJson) {
    let labelGroup: string | null = null;
    if (selector.startsWith("#labels > #")) {
      labelGroup = selector.split("#").pop() ?? null;
      if (labelGroup) style.labels.groups[labelGroup] = getStyleAttributes(presetJson[selector] ?? {});
    }

    if (selector === "#terrain") {
      const { set, size, density } = presetJson[selector] ?? {};

      if (typeof size === "number") {
        const ratio = size / style.relief.size;
        style.relief.size = size;
        if (ratio !== 1) Relief.changeSize(size);
      }

      if (typeof set === "string" && set in RELIEF_SETS) {
        const reliefSet = set as ReliefSet;
        style.relief.set = reliefSet;
        Relief.changeSet(reliefSet);
      }

      if (typeof density === "number") style.relief.density = density; // no model change as it would require regeneration
    }

    const el = (
      labelGroup
        ? document.querySelector(`#labels > [data-group="${CSS.escape(labelGroup)}"]`)
        : document.querySelector(selector)
    ) as HTMLElement | null;
    if (!el) continue;

    for (const attribute in presetJson[selector]) {
      if (attribute === "id") continue;
      if (selector === "#terrain" && RELIEF_STYLE_ATTRIBUTES.includes(attribute)) continue; // stored in style.relief
      const value = presetJson[selector]?.[attribute];

      if (value === "null" || value === null) {
        el.removeAttribute(attribute);
        continue;
      }

      if (value !== undefined) el.setAttribute(attribute, String(value));

      if (selector === "#texture") {
        const image = document.querySelector("#texture > image");
        if (image) {
          if (attribute === "data-x") image.setAttribute("x", String(value));
          if (attribute === "data-y") image.setAttribute("y", String(value));
          if (attribute === "data-href") image.setAttribute("href", String(value));
        }
      }

      // add custom heightmap color scheme
      if (
        selector === "#terrs" &&
        attribute === "scheme" &&
        typeof value === "string" &&
        !(value in HEIGHT_COLOR_SCHEMES)
      ) {
        addCustomHeightColorScheme(value);
      }
    }

    if (selector.startsWith("#labels > #")) {
      const dx = el.dataset.dx || 0;
      const dy = el.dataset.dy || 0;
      el.style.transform = +dx || +dy ? `translate(${dx}em, ${dy}em)` : "";
    }
  }

  // a group the preset doesn't cover takes the style of the default group of its type. It's left without a
  // style if there is none: getGroupStyle falls back to the built-in style, an empty one would win over it
  for (const group of options.labels.groups) {
    if (style.labels.groups[group.name]) continue;
    const defaultGroupStyle = style.labels.groups[Labels.getFallbackGroup(group.type).name];
    if (defaultGroupStyle) style.labels.groups[group.name] = { ...defaultGroupStyle };
  }

  window.MapStyleControls.applyLegacyPreset(presetJson);
  drawLabels();

  function getStyleAttributes(attributes: LegacyStylePresetAttributes): LabelGroupStyle {
    return Object.fromEntries(
      Object.entries(attributes).filter(([attribute]) => attribute !== "id")
    ) as unknown as LabelGroupStyle;
  }
}

function requestStylePresetChange(preset: string): void {
  const isConfirmed = sessionStorage.getItem("styleChangeConfirmed");
  if (isConfirmed) {
    void changeStyle(preset);
    return;
  }

  confirmationDialog({
    title: "Change style preset",
    message: "Are you sure you want to change the style preset? All unsaved style changes will be lost",
    confirm: "Change",
    onConfirm: () => {
      sessionStorage.setItem("styleChangeConfirmed", "true");
      void changeStyle(preset);
    },
    onCancel: () => {
      stylePreset.value = stylePreset.dataset.old ?? "default";
    }
  });
}

async function changeStyle(desiredPreset: string): Promise<void> {
  const styleData = await getStylePreset(desiredPreset);
  const [presetName, style] = styleData;
  localStorage.setItem("presetStyle", presetName);
  applyStyleWithUiRefresh(style);
}

function applyStyleWithUiRefresh(preset: LegacyStylePreset): void {
  applyStylePreset(preset);
  styleElementSelect.dispatchEvent(new Event("change"));
  updateMapFilter();
  stylePreset.dataset.old = stylePreset.value;

  const { legend, scaleBar } = getViewportSurface();
  drawScaleBar(scaleBar, scale);
  fitScaleBar(scaleBar, svgWidth, svgHeight);
  if (window.LayerControls.isLayerOn("toggleHeight")) drawHeightmap();
  if (legend.selectAll("*").size()) redrawLegend();
  OceanLayers();
  if (window.LayerControls.isLayerOn("toggleRulers")) drawMeasurers();
  drawRelief();
  if (window.LayerControls.isLayerOn("toggleBurgIcons")) invalidateBurgSymbols();
  drawLabels();

  setPresetRemoveButtonVisibiliy();
}

function addStylePreset(): void {
  window.showDomDialog({
    content: ensureEl("styleSaver"),
    destroyOnClose: false,
    placement: "center",
    placementTarget: document.getElementById("map"),
    title: "Style Saver",
    width: "26em"
  });

  const styleName = stylePreset.value.replace(CUSTOM_STYLE_PRESET_PREFIX, "");
  styleSaverName.value = styleName;
  styleSaverJSON.value = JSON.stringify(collectStyleData(), null, 2);
  checkName();

  if (modules.saveStyle) return;
  modules.saveStyle = true;

  // add listeners
  styleSaverName.addEventListener("input", checkName);
  ensureEl("styleSaverSave").addEventListener("click", saveStyle);
  ensureEl("styleSaverDownload").addEventListener("click", styleDownload);
  ensureEl("styleSaverLoad").addEventListener("click", () => styleToLoad.click());
  styleToLoad.addEventListener("change", loadStyleFile);

  function collectStyleData(): LegacyStylePreset {
    const presetStyle: LegacyStylePreset = {};
    const attributes: Record<string, readonly string[]> = {
      "#map": ["background-color", "filter", "data-filter"],
      "#ruler": ["opacity", "data-size", "font-size", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#statesHalo": ["opacity", "data-width", "stroke-width", "filter"],
      "#legend": [
        "data-size",
        "font-size",
        "font-family",
        "stroke",
        "stroke-width",
        "stroke-dasharray",
        "stroke-linecap",
        "data-x",
        "data-y",
        "data-columns"
      ],
      "#legendBox": ["fill", "fill-opacity"],
      "#fogging": ["opacity", "fill", "filter"],
      "#vignette": ["opacity", "fill", "filter"],
      "#vignette-rect": ["x", "y", "width", "height", "rx", "ry", "filter"],
      "#scaleBar": ["opacity", "fill", "font-size", "data-bar-size", "data-x", "data-y", "data-label"],
      "#scaleBarBack": [
        "opacity",
        "fill",
        "stroke",
        "stroke-width",
        "filter",
        "data-top",
        "data-right",
        "data-bottom",
        "data-left"
      ]
    };

    for (const selector in attributes) {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) continue;

      const storedAttributes: LegacyStylePresetAttributes = {};
      presetStyle[selector] = storedAttributes;
      for (const attr of attributes[selector]) {
        let value: LegacyStylePresetValue = el.style.getPropertyValue(attr) || el.getAttribute(attr);
        if (attr === "font-size" && selector !== "#markets" && el.hasAttribute("data-size"))
          value = el.getAttribute("data-size");
        storedAttributes[attr] = parseValue(value);
      }
    }

    Object.assign(presetStyle, window.MapStyleControls.serializeLegacyPreset());

    if (presetStyle["#terrain"]) Object.assign(presetStyle["#terrain"], style.relief);

    for (const [group, groupStyle] of Object.entries(style.labels.groups)) {
      addStoredLabelStyle(`#labels > #${group}`, groupStyle);
    }

    function addStoredLabelStyle(selector: string, groupStyle: LabelGroupStyle): void {
      if (!groupStyle) return;
      presetStyle[selector] = Object.fromEntries(
        Object.entries(groupStyle)
          .filter(([key]) => key !== "id" && key !== "transform")
          .map(([key, value]) => [key, parseValue(value)])
      );
    }

    function parseValue(value: unknown): LegacyStylePresetValue {
      if (value === "null" || value === null) return null;
      if (value === "") return "";
      if (!Number.isNaN(Number(value))) return Number(value);
      return String(value);
    }

    return presetStyle;
  }

  function checkName(): void {
    const styleName = CUSTOM_STYLE_PRESET_PREFIX + styleSaverName.value;

    const isSystem = systemPresets.includes(styleName) || systemPresets.includes(styleSaverName.value);
    if (isSystem) {
      styleSaverTip.innerHTML = "default";
      return;
    }

    const isExisting = Array.from(stylePreset.options).some(option => option.value === styleName);
    if (isExisting) {
      styleSaverTip.innerHTML = "existing";
      return;
    }

    styleSaverTip.innerHTML = "new";
  }

  function saveStyle(): void {
    const styleJSON = styleSaverJSON.value;
    const desiredName = styleSaverName.value;

    if (!styleJSON) {
      tip("Please provide a style JSON", false, "error");
      return;
    }
    if (!JSON.isValid(styleJSON)) {
      tip("JSON string is not valid, please check the format", false, "error");
      return;
    }
    if (!desiredName) {
      tip("Please provide a preset name", false, "error");
      return;
    }
    if (styleSaverTip.innerHTML === "default") {
      tip("You cannot overwrite default preset, please change the name", false, "error");
      return;
    }

    const presetName = CUSTOM_STYLE_PRESET_PREFIX + desiredName;
    applyOption(stylePreset, presetName, `${desiredName} [custom]`);
    localStorage.setItem("presetStyle", presetName);
    localStorage.setItem(presetName, styleJSON);

    applyStyleWithUiRefresh(JSON.parse(styleJSON) as LegacyStylePreset);
    tip("Style preset is saved and applied", false, "success", 4000);
    window.destroyDialog("styleSaver");
  }

  function styleDownload(): void {
    const styleJSON = styleSaverJSON.value;
    const styleName = styleSaverName.value;

    if (!styleJSON) {
      tip("Please provide a style JSON", false, "error");
      return;
    }
    if (!JSON.isValid(styleJSON)) {
      tip("JSON string is not valid, please check the format", false, "error");
      return;
    }
    if (!styleName) {
      tip("Please provide a preset name", false, "error");
      return;
    }

    downloadFile(styleJSON, `${styleName}.json`, "application/json");
  }

  function loadStyleFile(this: HTMLInputElement): void {
    const fileName = this.files?.[0]?.name.replace(/\.[^.]*$/, "") ?? "style";
    uploadFile(this, styleUpload);

    function styleUpload(dataLoaded: string): void {
      if (!dataLoaded) {
        tip("Cannot load the file. Please check the data format", false, "error");
        return;
      }
      const isValid = JSON.isValid(dataLoaded);
      if (!isValid) {
        tip("Loaded data is not a valid JSON, please check the format", false, "error");
        return;
      }

      styleSaverJSON.value = JSON.stringify(JSON.parse(dataLoaded), null, 2);
      styleSaverName.value = fileName;
      checkName();
      tip("Style preset is uploaded", false, "success", 4000);
    }
  }
}

function requestRemoveStylePreset(): void {
  const isDefault = systemPresets.includes(stylePreset.value);
  if (isDefault) {
    tip("Cannot remove system preset", false, "error");
    return;
  }

  confirmationDialog({
    title: "Remove style preset",
    message: "Are you sure you want to remove the style preset? This action cannot be undone.",
    confirm: "Remove",
    onConfirm: removeStylePreset
  });
}

function removeStylePreset(): void {
  localStorage.removeItem("presetStyle");
  localStorage.removeItem(stylePreset.value);
  stylePreset.selectedOptions[0].remove();

  changeStyle("default");
}

function updateMapFilter(): void {
  const filter = getViewportSurface().svg.attr("data-filter");
  mapFilters.querySelectorAll(".pressed").forEach(button => {
    button.classList.remove("pressed");
  });
  if (!filter) return;
  mapFilters.querySelector(`#${filter}`)?.classList.add("pressed");
}

function setPresetRemoveButtonVisibiliy(): void {
  const isDefault = systemPresets.includes(stylePreset.value);
  removeStyleButton.style.display = isDefault ? "none" : "inline-block";
}
