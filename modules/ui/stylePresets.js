// UI module to control the style presets
"use strict";

const defaultStyles = ["default", "ancient", "gloom", "clean", "light", "watercolor", "cyberpunk", "monochrome"];

// add styles to list
{
  const defaultOptions = defaultStyles.map(styleName => `<option value="${styleName}">${styleName}</option>`);
  const storedStyles = Object.keys(localStorage).filter(key => key.startsWith("fmgStyle"));
  const customOptions = storedStyles.map(styleName => `<option value="${styleName}">${styleName.replace("fmgStyle", "")} [custom]</option>`);
  const options = defaultOptions.join("") + customOptions.join("");
  document.getElementById("stylePreset").innerHTML = options;
}

async function applyStyleOnLoad() {
  let preset = localStorage.getItem("presetStyle") || "default";
  let style = {};

  const isCustom = !defaultStyles.includes(preset);
  if (isCustom) {
    const storedStyleJSON = localStorage.getItem(preset);
    if (!storedStyleJSON) {
      console.error(`Custom style ${preset} in not found in localStorage. Appliying default style`);
      preset = "default";
    } else {
      const isValid = JSON.isValid(storedStyleJSON);
      if (isValid) {
        style = JSON.parse(storedStyleJSON);
      } else {
        console.error(`Custom style ${preset} stored in localStorage is not valid. Appliying default style`);
        preset = "default";
      }
    }
  } else {
    const defaultStyle = await fetch(`/styles/${preset}.json`)
      .then(res => res.json())
      .catch(err => {
        console.error("Error on loading style", preset, err);
        return {};
      });
    style = defaultStyle;
  }

  applyStyle(style);
  updateMapFilter();
  stylePreset.value = stylePreset.dataset.old = preset;
}

function applyStyle(style) {
  for (const selector in style) {
    const el = document.querySelector(selector);
    if (!el) continue;
    for (const attribute in style[selector]) {
      const value = style[selector][attribute];

      if (value === "null" || value === null) {
        el.removeAttribute(attribute);
        continue;
      }

      if (attribute === "text-shadow") {
        el.style[attribute] = value;
      } else {
        el.setAttribute(attribute, value);
      }
    }
  }
}

// change current style preset to another saved one
function changeStylePreset(preset) {
  if (customization) return tip("Please exit the customization mode first", false, "error");

  if (sessionStorage.getItem("styleChangeWarningShown")) {
    changeStyle();
  } else {
    sessionStorage.setItem("styleChangeWarningShown", true);
    alertMessage.innerHTML = "Are you sure you want to change the style preset? All unsaved style changes will be lost";
    $("#alert").dialog({
      resizable: false,
      title: "Change style preset",
      width: "23em",
      buttons: {
        Change: function () {
          changeStyle();
          $(this).dialog("close");
        },
        Cancel: function () {
          stylePreset.value = stylePreset.dataset.old;
          $(this).dialog("close");
        }
      }
    });
  }

  function changeStyle() {
    const customPreset = localStorage.getItem(preset);
    if (customPreset) {
      if (JSON.isValid(customPreset)) applyStyle(JSON.parse(customPreset));
      else {
        tip("Cannot parse stored style JSON. Default style applied", false, "error", 5000);
        applyDefaultStyle();
      }
    } else if (defaultStyles[preset]) {
      const style = defaultStyles[preset];
      if (JSON.isValid(style)) applyStyle(JSON.parse(style));
      else tip("Cannot parse style JSON", false, "error", 5000);
    } else applyDefaultStyle();

    const isDefault = defaultStyles.includes(stylePreset.value);
    removeStyleButton.style.display = isDefault ? "none" : "inline-block";
    updateElements(); // change elements
    selectStyleElement(); // re-select element to trigger values update
    updateMapFilter();
    localStorage.setItem("presetStyle", preset); // save preset to use it onload
    stylePreset.dataset.old = stylePreset.value; // save current value
  }
}

function addStylePreset() {
  $("#styleSaver").dialog({
    title: "Style Saver",
    width: "26em",
    position: {my: "center", at: "center", of: "svg"}
  });

  const currentPreset = document.getElementById("stylePreset").selectedOptions[0];
  const styleName = currentPreset ? currentPreset.text : "custom";
  document.getElementById("styleSaverName").value = styleName;
  styleSaverJSON.value = JSON.stringify(getStyle(), null, 2);
  checkName();

  if (modules.saveStyle) return;
  modules.saveStyle = true;

  // add listeners
  document.getElementById("styleSaverName").addEventListener("input", checkName);
  document.getElementById("styleSaverSave").addEventListener("click", saveStyle);
  document.getElementById("styleSaverDownload").addEventListener("click", styleDownload);
  document.getElementById("styleSaverLoad").addEventListener("click", () => styleToLoad.click());
  document.getElementById("styleToLoad").addEventListener("change", function () {
    uploadFile(this, styleUpload);
  });

  function getStyle() {
    const style = {};
    const attributes = {
      "#map": ["background-color", "filter", "data-filter"],
      "#armies": ["font-size", "box-size", "stroke", "stroke-width", "fill-opacity", "filter"],
      "#biomes": ["opacity", "filter", "mask"],
      "#stateBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#provinceBorders": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#cells": ["opacity", "stroke", "stroke-width", "filter", "mask"],
      "#gridOverlay": ["opacity", "scale", "dx", "dy", "type", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "transform", "filter", "mask"],
      "#coordinates": ["opacity", "data-size", "font-size", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#compass": ["opacity", "transform", "filter", "mask", "shape-rendering"],
      "#rose": ["transform"],
      "#relig": ["opacity", "stroke", "stroke-width", "filter"],
      "#cults": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#landmass": ["opacity", "fill", "filter"],
      "#markers": ["opacity", "rescale", "filter"],
      "#prec": ["opacity", "stroke", "stroke-width", "fill", "filter"],
      "#population": ["opacity", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#rural": ["stroke"],
      "#urban": ["stroke"],
      "#freshwater": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#salt": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#sinkhole": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#frozen": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#lava": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#dry": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#sea_island": ["opacity", "stroke", "stroke-width", "filter", "auto-filter"],
      "#lake_island": ["opacity", "stroke", "stroke-width", "filter"],
      "#terrain": ["opacity", "set", "size", "density", "filter", "mask"],
      "#rivers": ["opacity", "filter", "fill"],
      "#ruler": ["opacity", "filter"],
      "#roads": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#trails": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#searoutes": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#statesBody": ["opacity", "filter"],
      "#statesHalo": ["opacity", "data-width", "stroke-width", "filter"],
      "#provs": ["opacity", "fill", "font-size", "font-family", "filter"],
      "#temperature": ["opacity", "font-size", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter"],
      "#ice": ["opacity", "fill", "stroke", "stroke-width", "filter"],
      "#emblems": ["opacity", "stroke-width", "filter"],
      "#texture": ["opacity", "filter", "mask"],
      "#textureImage": ["x", "y"],
      "#zones": ["opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "filter", "mask"],
      "#oceanLayers": ["filter", "layers"],
      "#oceanBase": ["fill"],
      "#oceanicPattern": ["href", "opacity"],
      "#terrs": ["opacity", "scheme", "terracing", "skip", "relax", "curve", "filter", "mask"],
      "#legend": ["data-size", "font-size", "font-family", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "data-x", "data-y", "data-columns"],
      "#legendBox": ["fill", "fill-opacity"],
      "#burgLabels > #cities": ["opacity", "fill", "text-shadow", "data-size", "font-size", "font-family"],
      "#burgIcons > #cities": ["opacity", "fill", "fill-opacity", "size", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap"],
      "#anchors > #cities": ["opacity", "fill", "size", "stroke", "stroke-width"],
      "#burgLabels > #towns": ["opacity", "fill", "text-shadow", "data-size", "font-size", "font-family"],
      "#burgIcons > #towns": ["opacity", "fill", "fill-opacity", "size", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap"],
      "#anchors > #towns": ["opacity", "fill", "size", "stroke", "stroke-width"],
      "#labels > #states": ["opacity", "fill", "stroke", "stroke-width", "text-shadow", "data-size", "font-size", "font-family", "filter"],
      "#labels > #addedLabels": ["opacity", "fill", "stroke", "stroke-width", "text-shadow", "data-size", "font-size", "font-family", "filter"],
      "#fogging": ["opacity", "fill", "filter"]
    };

    for (const selector in attributes) {
      const el = document.querySelector(selector);
      if (!el) continue;

      style[selector] = {};
      for (const attr of attributes[selector]) {
        let value = el.style[attr] || el.getAttribute(attr);
        if (attr === "font-size" && el.hasAttribute("data-size")) value = el.getAttribute("data-size");
        style[selector][attr] = parseValue(value);
      }
    }

    function parseValue(value) {
      if (value === "null" || value === null) return null;
      if (value === "") return "";
      if (!isNaN(+value)) return +value;
      return value;
    }

    return style;
  }

  function checkName() {
    let tip = "";
    const v = "style" + styleSaverName.value;
    const listed = Array.from(stylePreset.options).some(o => o.value == v);
    const stored = localStorage.getItem(v);
    if (!stored && listed) tip = "default";
    else if (stored) tip = "existing";
    else if (styleSaverName.value) tip = "new";
    styleSaverTip.innerHTML = tip;
  }

  function saveStyle() {
    if (!styleSaverJSON.value) return tip("Please provide a style JSON", false, "error");
    if (!JSON.isValid(styleSaverJSON.value)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!styleSaverName.value) return tip("Please provide a preset name", false, "error");
    if (styleSaverTip.innerHTML === "default") return tip("You cannot overwrite default preset, please change the name", false, "error");

    const preset = "style" + styleSaverName.value;
    applyOption(stylePreset, preset, styleSaverName.value); // add option
    localStorage.setItem("presetStyle", preset); // mark preset as default
    localStorage.setItem(preset, styleSaverJSON.value); // save preset

    applyStyle(JSON.parse(styleSaverJSON.value));
    updateMapFilter();
    invokeActiveZooming();

    $("#styleSaver").dialog("close");
    removeStyleButton.style.display = "inline-block";
    tip("Style preset is saved", false, "success", 4000);
  }

  function styleDownload() {
    if (!styleSaverJSON.value) return tip("Please provide a style JSON", false, "error");
    if (!JSON.isValid(styleSaverJSON.value)) return tip("JSON string is not valid, please check the format", false, "error");
    if (!styleSaverName.value) return tip("Please provide a preset name", false, "error");

    const data = styleSaverJSON.value;
    if (!data) return tip("Please provide a style JSON", false, "error");
    downloadFile(data, "style" + styleSaverName.value + ".json", "application/json");
  }

  function styleUpload(dataLoaded) {
    if (!dataLoaded) return tip("Cannot load the file. Please check the data format", false, "error");
    const data = JSON.stringify(JSON.parse(dataLoaded), null, 2);
    styleSaverJSON.value = data;
  }
}

function removeStylePreset() {
  const isDefault = defaultStyles.includes(stylePreset.value);
  if (isDefault) return tip("Cannot remove system preset", false, "error");

  localStorage.removeItem("presetStyle");
  localStorage.removeItem(stylePreset.value);
  stylePreset.selectedOptions[0].remove();
  removeStyleButton.style.display = "none";

  applyDefaultStyle();
  updateMapFilter();
  invokeActiveZooming();
}

function updateMapFilter() {
  const filter = svg.attr("data-filter");
  mapFilters.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  if (!filter) return;
  mapFilters.querySelector("#" + filter).classList.add("pressed");
}
