// UI module to control the options (preferences)

import { hsl } from "d3";
import { ApplicationController } from "@/application/application-controller";
import { getViewportSurface } from "@/application/viewport-surface";
import { getWorkspaceMode, requireWorkspaceCapability } from "@/application/workspace-mode";
import { mountAboutPanel } from "@/components/app-info/about-panel";
import { closeDialogs, confirmationDialog } from "@/components/dialog/dialog-helpers";
import { enableElementDragging } from "@/components/element-dragging";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { fitLegendBox } from "@/renderers/draw-legend";
import { fitScaleBar } from "@/renderers/draw-scalebar";
import { getUnitSettings } from "@/services/units-settings";
import { applyOption, ensureEl, gauss, last, minmax, P, rand, rn, rw } from "@/utils";
import { lock, stored, unlock } from "@/utils/preferences";
import { mountLayerPanel } from "../layers/layer-panel";
import { mountStylePanel } from "../style/style-panel";
import { mountCustomizationPanel } from "./customization-panel";
import { createExportMapDialog, createLoadMapDialog, createPngTilesDialog, createSaveMapDialog } from "./io-dialogs";
import {
  bindOptionsController,
  OptionsController,
  type OptionsControllerApi,
  type RegenerateOptions
} from "./options-controller";
import { mountOptionsPanel } from "./options-panel";

interface ValueElement extends HTMLElement {
  max: string;
  value: string;
}

interface GoogleTranslateApi {
  translate: {
    TranslateElement: {
      new (options: { layout: unknown; pageLanguage: string }, elementId: string): unknown;
      InlineLayout: { VERTICAL: unknown };
    };
  };
}

mountLayerPanel();
mountStylePanel();
mountOptionsPanel();
mountCustomizationPanel();
mountAboutPanel();
getUnitSettings();

const optionsRoot = ensureEl("options");
const optionsTrigger = ensureEl("optionsTrigger");
const regenerate = ensureEl("regenerate");
const collapsible = ensureEl("collapsible");
const styleContent = ensureEl("styleContent");
const toolsContent = ensureEl("toolsContent");
const aboutContent = ensureEl("aboutContent");
const customizationMenu = ensureEl("customizationMenu");
const manorsInput = ensureEl<HTMLInputElement>("manorsInput");
const manorsOutput = ensureEl<HTMLOutputElement>("manorsOutput");
const mapWidthInput = ensureEl<HTMLInputElement>("mapWidthInput");
const mapHeightInput = ensureEl<HTMLInputElement>("mapHeightInput");
const distanceScaleInput = ensureEl<HTMLInputElement>("distanceScaleInput");
const optionsSeed = ensureEl<HTMLInputElement>("optionsSeed");
const pointsOutputFormatted = ensureEl<HTMLOutputElement>("pointsOutputFormatted");
const culturesOutput = ensureEl<HTMLInputElement>("culturesOutput");
const statesNumber = ensureEl<ValueElement>("statesNumber");
const provincesRatio = ensureEl<ValueElement>("provincesRatio");
const sizeVariety = ensureEl<ValueElement>("sizeVariety");
const growthRate = ensureEl<ValueElement>("growthRate");
const uiSize = ensureEl<ValueElement>("uiSize");
const themeHueInput = ensureEl<HTMLInputElement>("themeHueInput");
const themeColorInput = ensureEl<HTMLInputElement>("themeColorInput");
const transparencyInput = ensureEl<ValueElement>("transparencyInput");
const zoomExtentMin = ensureEl<HTMLInputElement>("zoomExtentMin");
const zoomExtentMax = ensureEl<HTMLInputElement>("zoomExtentMax");
const shapeRendering = ensureEl<HTMLSelectElement>("shapeRendering");
const yearInput = ensureEl<HTMLInputElement>("yearInput");
const eraInput = ensureEl<HTMLInputElement>("eraInput");
const tooltip = ensureEl("tooltip");

enableElementDragging({ element: ensureEl("optionsContainer"), handleSelector: ".drag-trigger" });
enableElementDragging({ element: ensureEl("exitCustomization"), handleSelector: "div" });
ensureEl("mapLayers").style.userSelect = "none";

optionsTrigger.addEventListener("click", showOptions);
regenerate.addEventListener("click", () => regeneratePrompt());
ensureEl("optionsHide").addEventListener("click", hideOptions);
ensureEl("generateMapFromSetup").addEventListener("click", () => regeneratePrompt({ fromSetup: true }));
ensureEl("showSupporters").addEventListener("click", () => void showSupporters());
document.addEventListener("click", event => {
  const target = (event.target as Element | null)?.closest<HTMLElement>("[data-seed-history-index]");
  if (target) restoreSeed(Number(target.dataset.seedHistoryIndex));
});

// remove glow if tip is aknowledged
if (stored("disable_click_arrow_tooltip")) {
  clearMainTip();
  optionsTrigger.classList.remove("glow");
}

// Show options pane on trigger click
function showOptions(event?: Event): void {
  if (getWorkspaceMode() === "view") {
    tip("Switch to Edit mode to change map options", false, "error");
    return;
  }
  if (!stored("disable_click_arrow_tooltip")) {
    clearMainTip();
    localStorage.setItem("disable_click_arrow_tooltip", "true");
    optionsTrigger.classList.remove("glow");
  }

  regenerate.style.display = "none";
  ensureEl("options").style.display = "block";
  optionsTrigger.style.display = "none";
  document.body.classList.add("workspace-panel-open");
  notifyWorkspacePanelChange();

  if (event) event.stopPropagation();
}

// Hide options pane on trigger click
function hideOptions(event?: Event): void {
  ensureEl("options").style.display = "none";
  optionsTrigger.style.display = "block";
  document.body.classList.remove("workspace-panel-open");
  window.dispatchEvent(new CustomEvent("workspace-panel-change", { detail: { section: null } }));
  if (event) event.stopPropagation();
}

// To toggle options on hotkey press
function toggleOptions(event?: Event): void {
  if (ensureEl("options").style.display === "none") showOptions(event);
  else hideOptions(event);
}

// Toggle "New Map!" pane on hover
optionsTrigger.addEventListener("mouseenter", () => {
  if (optionsTrigger.classList.contains("glow")) return;
  if (ensureEl("options").style.display === "none") regenerate.style.display = "block";
});

collapsible.addEventListener("mouseleave", () => {
  regenerate.style.display = "none";
});

// Activate options tab on click
optionsRoot.querySelector<HTMLElement>("div.tab")?.addEventListener("click", event => {
  const target = event.target as HTMLElement;
  if (target.tagName !== "BUTTON") return;
  const id = target.id;
  if (id === "optionsHide") return;
  const active = ensureEl("options").querySelector(".tab > button.active");
  if (active && id === active.id) return; // already active tab is clicked

  if (active) active.classList.remove("active");
  ensureEl(id).classList.add("active");
  optionsRoot.querySelectorAll<HTMLElement>(".tabcontent").forEach(e => {
    e.style.display = "none";
  });

  if (id === "styleTab") {
    styleContent.style.display = "block";
    window.StyleEditor.refresh();
  } else if (id === "optionsTab") {
    optionsContent.style.display = "block";
  } else if (id === "toolsTab") {
    if (customization === 1) customizationMenu.style.display = "block";
    else toolsContent.style.display = "block";
  } else if (id === "aboutTab") {
    aboutContent.style.display = "block";
  }

  notifyWorkspacePanelChange(id);
});

const workspaceSections = {
  styleTab: "style",
  aboutTab: "about"
};

const workspaceSectionTitles = {
  create: "Create",
  edit: "Edit",
  style: "Style",
  "world-setup": "World Setup",
  regenerate: "Regenerate",
  preferences: "Preferences",
  about: "About"
};

function getWorkspaceSection(activeId?: string): string {
  if (activeId === "optionsTab") return ensureEl("optionsContent").dataset.workspaceView || "preferences";
  if (activeId === "toolsTab") return ensureEl("toolsContent").dataset.workspaceView || "edit";
  return workspaceSections[activeId as keyof typeof workspaceSections] || "style";
}

function notifyWorkspacePanelChange(tabId?: string): void {
  const activeId = tabId || optionsRoot.querySelector<HTMLElement>(".tab > button.active")?.id;
  const section = getWorkspaceSection(activeId);
  const title =
    workspaceSectionTitles[section as keyof typeof workspaceSectionTitles] ||
    (activeId ? document.getElementById(activeId)?.textContent?.trim() : null) ||
    "Style";
  window.dispatchEvent(new CustomEvent("workspace-panel-change", { detail: { section, title } }));
}

// show popup with a list of Patreon supportes (updated manually)
async function showSupporters(): Promise<void> {
  const list = window.Supporters.split("\n").sort();
  const columns = window.innerWidth < 800 ? 2 : 5;

  const messageHtml = `<ul style='column-count: ${columns}; column-gap: 2em'>${list.map(n => `<li>${n}</li>`).join("")}</ul>`;
  window.showMessageDialog({
    id: "supportersDialog",
    messageHtml,
    title: "Patreon Supporters",
    width: "min-content"
  });
}

// on any option or dialog change
ensureEl("options").addEventListener("change", storeValueIfRequired);
ensureEl("dialogs").addEventListener("change", storeValueIfRequired);
ensureEl("options").addEventListener("input", updateOutputToFollowInput);
ensureEl("dialogs").addEventListener("input", updateOutputToFollowInput);

function storeValueIfRequired(ev: Event): void {
  const target = ev.target as HTMLInputElement;
  if (target.dataset.stored) lock(target.dataset.stored);
}

function updateOutputToFollowInput(ev: Event): void {
  const target = ev.target as HTMLInputElement;
  const { id, value } = target;

  // specific cases
  if (id === "manorsInput") {
    manorsOutput.value = value === "1000" ? "auto" : value;
    return;
  }

  // generic case
  if (id.slice(-5) === "Input") {
    const output = document.getElementById(`${id.slice(0, -5)}Output`) as ValueElement | null;
    if (output) output.value = value;
  } else if (id.slice(-6) === "Output") {
    const input = document.getElementById(`${id.slice(0, -6)}Input`) as ValueElement | null;
    if (input) input.value = value;
  }
}

// Option listeners
const optionsContent = ensureEl("optionsContent");

optionsContent.addEventListener("input", event => {
  const { id, value } = event.target as HTMLInputElement;
  if (id === "mapWidthInput" || id === "mapHeightInput") mapSizeInputChange();
  else if (id === "pointsInput") changeCellsDensity(+value);
  else if (id === "culturesSet") changeCultureSet();
  else if (id === "statesNumber") changeStatesNumber(value);
  else if (id === "emblemShape") changeEmblemShape(value);
  else if (id === "tooltipSize") changeTooltipSize(value);
  else if (id === "themeHueInput") changeThemeHue(value);
  else if (id === "themeColorInput") changeDialogsTheme(themeColorInput.value, transparencyInput.value);
  else if (id === "transparencyInput") changeDialogsTheme(themeColorInput.value, value);
});

optionsContent.addEventListener("change", event => {
  const { id, value } = event.target as HTMLInputElement;
  if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
  else if (id === "optionsSeed") generateMapWithSeed();
  else if (id === "uiSize") changeUiSize(+value);
  else if (id === "shapeRendering") setRendering(value);
  else if (id === "yearInput") changeYear();
  else if (id === "eraInput") changeEra();
});

optionsContent.addEventListener("click", event => {
  const target = event.target as HTMLElement;
  const { id } = target;
  if (id === "restoreDefaultCanvasSize") restoreDefaultCanvasSize();
  else if (id === "optionsMapHistory") showSeedHistoryDialog();
  else if (id === "optionsCopySeed") copyMapURL();
  else if (id === "optionsEraRegenerate") regenerateEra();
  else if (id === "templateInputContainer") openTemplateSelectionDialog();
  else if (id === "zoomExtentDefault") restoreDefaultZoomExtent();
  else if (id === "translateExtent") toggleTranslateExtent(target);
  else if (id === "speakerTest") testSpeaker();
  else if (id === "themeColorRestore") restoreDefaultThemeColor();
  else if (id === "loadGoogleTranslateButton") loadGoogleTranslate();
  else if (id === "resetLanguage") resetLanguage();
});

function mapSizeInputChange(): void {
  const $mapWidthInput = ensureEl<HTMLInputElement>("mapWidthInput");
  const $mapHeightInput = ensureEl<HTMLInputElement>("mapHeightInput");

  fitMapToScreen();
  localStorage.setItem("mapWidth", $mapWidthInput.value);
  localStorage.setItem("mapHeight", $mapHeightInput.value);

  const tooWide = +$mapWidthInput.value > window.innerWidth;
  const tooHigh = +$mapHeightInput.value > window.innerHeight;

  if (tooWide || tooHigh) {
    const message = `Canvas size is larger than window size (${window.innerWidth} x ${window.innerHeight}). It can affect performance`;
    tip(message, false, "warn", 4000);
  }
}

function restoreDefaultCanvasSize(): void {
  mapWidthInput.value = String(window.innerWidth);
  mapHeightInput.value = String(window.innerHeight);
  localStorage.removeItem("mapHeight");
  localStorage.removeItem("mapWidth");
  fitMapToScreen();
}

// on map creation
function applyGraphSize(): void {
  graphWidth = +mapWidthInput.value;
  graphHeight = +mapHeightInput.value;

  const { defs, fogging } = getViewportSurface();
  fogging.selectAll("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);
  defs.select("mask#fog > rect").attr("width", graphWidth).attr("height", graphHeight);
  defs.select("mask#water > rect").attr("width", graphWidth).attr("height", graphHeight);
}

// on generate, on load, on resize, on canvas size change
function fitMapToScreen(): void {
  svgWidth = Math.min(+mapWidthInput.value, window.innerWidth);
  svgHeight = Math.min(+mapHeightInput.value, window.innerHeight);
  getViewportSurface().svg.attr("width", svgWidth).attr("height", svgHeight);

  const zoomMin = rn(Math.max(svgWidth / graphWidth, svgHeight / graphHeight), 3);
  zoomExtentMin.value = String(zoomMin);
  const zoomMax = +zoomExtentMax.value;

  window.MapZoom.setTranslateExtent([
    [0, 0],
    [graphWidth, graphHeight]
  ]);
  window.MapZoom.setExtent(zoomMin, zoomMax);

  fitScaleBar(getViewportSurface().scaleBar, svgWidth, svgHeight);
  fitLegendBox();
}

function toggleTranslateExtent(el: HTMLElement): void {
  const on = Number(!Number(el.dataset.on));
  el.dataset.on = String(on);
  if (on) {
    window.MapZoom.setTranslateExtent([
      [-graphWidth / 2, -graphHeight / 2],
      [graphWidth * 1.5, graphHeight * 1.5]
    ]);
  } else {
    window.MapZoom.setTranslateExtent([
      [0, 0],
      [graphWidth, graphHeight]
    ]);
  }
}

// add voice options
let voiceAttempts = 0;
const voiceInterval = setInterval(() => {
  voiceAttempts++;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) {
    if (voiceAttempts < 10) return;

    clearInterval(voiceInterval);
    const select = ensureEl<HTMLSelectElement>("speakerVoice");
    if (!select.options.length) {
      select.options.add(new Option("No voices available", "", false));
    }
    return;
  }

  clearInterval(voiceInterval);

  const select = ensureEl<HTMLSelectElement>("speakerVoice");
  voices.forEach((voice, i) => {
    select.options.add(new Option(voice.name, String(i), false));
  });
  const storedVoice = stored("speakerVoice");
  if (storedVoice) select.value = storedVoice;
  else select.value = String(voices.findIndex(voice => voice.lang === "en-US"));
}, 1000);

function testSpeaker(): void {
  const text = `${mapName.value}, ${options.year} ${options.era}`;
  const speaker = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const voiceId = +ensureEl<HTMLSelectElement>("speakerVoice").value;
    speaker.voice = voices[voiceId] ?? null;
  }
  speechSynthesis.speak(speaker);
}

function generateMapWithSeed(): void {
  if (optionsSeed.value === seed) {
    tip("The current map already has this seed", false, "error");
    return;
  }
  regeneratePrompt({ seed: optionsSeed.value });
}

function showSeedHistoryDialog(): void {
  const lines = mapHistory.map((h, i) => {
    const created = new Date(h.created).toLocaleTimeString();
    const button = `<i data-tip="Click to generate a map with this seed" data-seed-history-index="${i}" class="icon-history optionsSeedRestore"></i>`;
    return `<li>Seed: ${h.seed} ${button}. Size: ${h.width}x${h.height}. Template: ${h.template}. Created: ${created}</li>`;
  });
  const messageHtml = /* html */ `<ol style="margin: 0; padding-left: 1.5em">
    ${lines.join("")}
  </ol>`;

  window.showMessageDialog({ id: "seedHistoryDialog", messageHtml, title: "Seed history" });
}

// generate map with historical seed
function restoreSeed(id: number): void {
  const { seed, width, height, template } = mapHistory[id] as unknown as {
    seed: string;
    width: number;
    height: number;
    template: string;
  };
  optionsSeed.value = seed;
  mapWidthInput.value = String(width);
  mapHeightInput.value = String(height);
  ensureEl<HTMLInputElement>("templateInput").value = template;

  if (stored("template")) unlock("template");

  regeneratePrompt({ seed });
}

function copyMapURL(): void {
  const locked = document.querySelectorAll("i.icon-lock").length; // check if some options are locked
  const search = `?seed=${optionsSeed.value}&width=${graphWidth}&height=${graphHeight}${
    locked ? "" : "&options=default"
  }`;
  navigator.clipboard
    .writeText(location.host + location.pathname + search)
    .then(() => {
      tip("Map URL is copied to clipboard", false, "success", 3000);
      //window.history.pushState({}, null, search);
    })
    .catch(err => tip(`Could not copy URL: ${err}`, false, "error", 5000));
}

const cellsDensityMap = {
  1: 1000,
  2: 2000,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 30000,
  7: 40000,
  8: 50000,
  9: 60000,
  10: 70000,
  11: 80000,
  12: 90000,
  13: 100000
};

function changeCellsDensity(value: string | number): void {
  pointsInput.value = String(value);
  const cells = getCellsDensity(value) || Number(pointsInput.dataset.cells);
  pointsInput.dataset.cells = String(cells);
  pointsOutputFormatted.value = `${cells / 1000}K`;
  pointsOutputFormatted.style.color = getCellsDensityColor(cells);
}

function getCellsDensity(value: string | number): number {
  return cellsDensityMap[Number(value) as keyof typeof cellsDensityMap] ?? 0;
}

function getCellsDensityColor(cells: number): string {
  return cells > 50000 ? "#b12117" : cells !== 10000 ? "#dfdf12" : "#053305";
}

function changeCultureSet(): void {
  const max = culturesSet.selectedOptions[0]?.dataset.max ?? "30";
  culturesInput.max = culturesOutput.max = max;
  if (+culturesOutput.value > +max) culturesInput.value = culturesOutput.value = max;
}

function changeEmblemShape(emblemShape: string): void {
  const image = ensureEl<SVGPathElement>("emblemShapeImage");
  const shapePath = window.COArenderer && COArenderer.shieldPaths[emblemShape as keyof typeof COArenderer.shieldPaths];
  shapePath ? image.setAttribute("d", shapePath) : image.removeAttribute("d");

  const specificShape = ["culture", "state", "random"].includes(emblemShape) ? undefined : emblemShape;
  if (emblemShape === "random") {
    pack.cultures
      .filter(c => !c.removed)
      .forEach(c => {
        c.shield = Cultures.getRandomShield();
      });
  }

  const rerenderCOA = (id: string, coa: Parameters<typeof COArenderer.trigger>[1]) => {
    const coaEl = document.getElementById(id);
    if (!coaEl) return; // not rendered
    coaEl.remove();
    COArenderer.trigger(id, coa);
  };

  pack.states.forEach(state => {
    if (!state.i || state.removed || !state.coa || state.coa.custom) return;
    const newShield = specificShape || COA.getShield(state.culture, undefined);
    if (newShield === state.coa.shield) return;
    state.coa.shield = newShield;
    rerenderCOA(`stateCOA${state.i}`, state.coa);
  });

  pack.provinces.forEach(province => {
    if (!province.i || province.removed || !province.coa || province.coa.custom) return;
    const culture = pack.cells.culture[province.center ?? 0];
    const newShield = specificShape || COA.getShield(culture, province.state);
    if (newShield === province.coa.shield) return;
    province.coa.shield = newShield;
    rerenderCOA(`provinceCOA${province.i}`, province.coa);
  });

  pack.burgs.forEach(burg => {
    if (!burg.i || burg.removed || !burg.coa || burg.coa.custom) return;
    const newShield = specificShape || COA.getShield(burg.culture ?? 0, burg.state ?? 0);
    if (newShield === burg.coa.shield) return;
    burg.coa.shield = newShield;
    rerenderCOA(`burgCOA${burg.i}`, burg.coa);
  });
}

function changeStatesNumber(value: string | number): void {
  statesNumber.style.color = +value ? "" : "#b12117";
  const numericValue = Number(value);
  const capitalSize = Math.max(rn(6 - numericValue / 20), 3);
  const stateSize = Math.max(rn(18 - numericValue / 6), 4);
  if (style.labels.groups.capital) style.labels.groups.capital["font-size"] = `${capitalSize}%`;
  if (style.labels.groups.states) style.labels.groups.states["font-size"] = `${stateSize}%`;
  if (window.LayerControls.isLayerOn("toggleLabels")) drawLabels();
}

function changeUiSize(value: number): void {
  if (Number.isNaN(value) || value < 0.5) return;

  const max = getUImaxSize();
  if (value > max) value = max;

  uiSize.value = String(value);
  document.getElementsByTagName("body")[0].style.fontSize = `${rn(value * 10, 2)}px`;
  ensureEl("options").style.width = `${value * 300}px`;
}

function getUImaxSize(): number {
  return rn(Math.min(window.innerHeight / 465, window.innerWidth / 302), 1);
}

function changeTooltipSize(value: string | number): void {
  tooltip.style.fontSize = `calc(${value}px + 0.5vw)`;
}

const THEME_COLOR = "#997787";
function restoreDefaultThemeColor(): void {
  localStorage.removeItem("themeColor");
  changeDialogsTheme(THEME_COLOR, transparencyInput.value);
}

function changeThemeHue(hue: string | number): void {
  const { s, l } = hsl(themeColorInput.value);
  const newColor = hsl(+hue, s, l).hex();
  changeDialogsTheme(newColor, transparencyInput.value);
}

// change color and transparency for modal windows
function changeDialogsTheme(themeColor: string | null, transparency: string | number): void {
  transparencyInput.value = String(transparency);
  const alpha = (100 - +transparency) / 100;
  const alphaReduced = Math.min(alpha + 0.3, 1);

  const { h, s, l } = hsl(themeColor || THEME_COLOR);
  themeColorInput.value = themeColor || THEME_COLOR;
  themeHueInput.value = String(h);

  const getRGBA = (hue: number, saturation: number, lightness: number, alpha: number): string => {
    const color = hsl(hue, saturation, lightness, alpha);
    return color.toString();
  };

  const theme = [
    { name: "--bg-opacity", value: alpha },
    { name: "--bg-main", h, s, l, alpha },
    { name: "--bg-lighter", h, s, l: l + 0.02, alpha },
    { name: "--bg-light", h, s: s - 0.02, l: l + 0.06, alpha },
    { name: "--light-solid", h, s: s + 0.01, l: l + 0.05, alpha: 1 },
    { name: "--dark-solid", h, s, l: l - 0.2, alpha: 1 },
    { name: "--header", h, s: s, l: l - 0.03, alpha: alphaReduced },
    { name: "--header-active", h, s: s, l: l - 0.09, alpha: alphaReduced },
    { name: "--bg-disabled", h, s: s - 0.04, l: l + 0.09, alpha: alphaReduced },
    { name: "--bg-dialogs", h: 0, s: 0, l: 0.98, alpha }
  ];

  const sx = document.documentElement.style;
  theme.forEach(({ name, value, h, s, l, alpha }) => {
    if (value !== undefined) sx.setProperty(name, String(value));
    else if (h !== undefined && s !== undefined && l !== undefined && alpha !== undefined)
      sx.setProperty(name, getRGBA(h, s, l, alpha));
  });
}

function loadGoogleTranslate(): void {
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js";
  script.onload = () => {
    initGoogleTranslate();
    ensureEl("loadGoogleTranslateButton").remove();

    // replace mapLayers underline <u> with bare text to avoid translation issue
    ensureEl("mapLayers")
      .querySelectorAll<HTMLElement>("li")
      .forEach(el => {
        const text = el.innerHTML.replace(/<u>(.+)<\/u>/g, "$1");
        el.innerHTML = text;
      });
  };

  document.head.appendChild(script);
}

function initGoogleTranslate(): void {
  const translate = (window as typeof window & { google?: GoogleTranslateApi }).google?.translate;
  if (!translate) return;
  new translate.TranslateElement(
    { pageLanguage: "en", layout: translate.TranslateElement.InlineLayout.VERTICAL },
    "google_translate_element"
  );
}

function resetLanguage(): void {
  const languageSelect = document.querySelector<HTMLSelectElement & { handleChange?: (event: Event) => void }>(
    "#google_translate_element select"
  );
  if (!languageSelect) return;
  if (!languageSelect.value) return;

  languageSelect.value = "en";
  languageSelect.handleChange?.(new Event("change"));

  // do once again to actually reset the language
  languageSelect.value = "en";
  languageSelect.handleChange?.(new Event("change"));
}

function changeZoomExtent(value: string | number): void {
  if (+zoomExtentMin.value > +zoomExtentMax.value) {
    [zoomExtentMin.value, zoomExtentMax.value] = [zoomExtentMax.value, zoomExtentMin.value];
  }
  const min = Math.max(+zoomExtentMin.value, 0.01);
  const max = Math.min(+zoomExtentMax.value, 200);
  zoomExtentMin.value = String(min);
  zoomExtentMax.value = String(max);
  const scale = minmax(+value, 0.01, 200);
  window.MapZoom.setExtent(min, max, scale);
}

function restoreDefaultZoomExtent(): void {
  zoomExtentMin.value = "1";
  zoomExtentMax.value = "20";
  window.MapZoom.setExtent(1, 20, 1);
}

// restore options stored in localStorage
function applyStoredOptions(): void {
  if (!stored("mapWidth") || !stored("mapHeight")) {
    mapWidthInput.value = String(window.innerWidth);
    mapHeightInput.value = String(window.innerHeight);
  }

  const heightmapId = stored("template");
  if (heightmapId) {
    const name = heightmapTemplates[heightmapId]?.name || precreatedHeightmaps[heightmapId]?.name || heightmapId;
    applyOption(ensureEl<HTMLInputElement>("templateInput"), heightmapId, name);
  }

  const storedDistanceUnit = stored("distanceUnit");
  const storedHeightUnit = stored("heightUnit");
  if (storedDistanceUnit) applyOption(distanceUnitInput, storedDistanceUnit);
  if (storedHeightUnit) applyOption(heightUnit, storedHeightUnit);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === "speakerVoice") continue;

    const input = (document.getElementById(`${key}Input`) || document.getElementById(key)) as ValueElement | null;
    const output = document.getElementById(`${key}Output`) as ValueElement | null;

    const value = stored(key);
    if (input && value !== null) input.value = value;
    if (output && value !== null) output.value = value;
    lock(key);

    if (key === "points" && value !== null) changeCellsDensity(+value);
    if (key === "distanceScale" && value !== null) distanceScale = +value;

    // add saved style presets to options
    if (key.slice(0, 5) === "style") applyOption(stylePreset, key, key.slice(5));
  }

  const readStored = (key: string) => stored(key);
  const storedWinds = readStored("winds");
  if (storedWinds) options.winds = storedWinds.split(",").map(Number);
  for (const key of [
    "temperatureEquator",
    "temperatureNorthPole",
    "temperatureSouthPole",
    "mapSize",
    "latitude",
    "longitude",
    "prec"
  ] as const) {
    const value = readStored(key);
    if (value) options[key] = +value;
  }
  const storedMilitary = readStored("military");
  if (storedMilitary) options.military = JSON.parse(storedMilitary);

  const storedTooltipSize = readStored("tooltipSize");
  const storedRegions = readStored("regions");
  if (storedTooltipSize) changeTooltipSize(storedTooltipSize);
  if (storedRegions) changeStatesNumber(storedRegions);

  uiSize.max = String(getUImaxSize());
  const storedUiSize = readStored("uiSize");
  if (storedUiSize) changeUiSize(+storedUiSize);
  else changeUiSize(minmax(rn(+mapWidthInput.value / 1280, 1), 1, 2.5));

  // search params overwrite stored and default options
  const params = new URL(window.location.href).searchParams;
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));
  if (width) mapWidthInput.value = String(width);
  if (height) mapHeightInput.value = String(height);

  // a zero-sized window (hidden or headless tab) or a stored 0 would produce a degenerate grid
  if (!(+mapWidthInput.value > 0) || !(+mapHeightInput.value > 0)) {
    mapWidthInput.value = String(window.innerWidth || 1280);
    mapHeightInput.value = String(window.innerHeight || 800);
  }

  const transparency = stored("transparency") || 5;
  const themeColor = stored("themeColor");
  changeDialogsTheme(themeColor, transparency);

  setRendering(shapeRendering.value);
}

// randomize options if randomization is allowed (not locked or queryParam options='default')
function randomizeOptions(): void {
  const randomize = new URL(window.location.href).searchParams.get("options") === "default"; // ignore stored options

  // 'Options' settings
  if (randomize || !stored("points")) changeCellsDensity(4); // reset to default, no need to randomize
  if (randomize || !stored("template")) randomizeHeightmapTemplate();
  if (randomize || !stored("statesNumber")) statesNumber.value = String(gauss(18, 5, 2, 30));
  if (randomize || !stored("provincesRatio")) provincesRatio.value = String(gauss(20, 10, 20, 100));
  if (randomize || !stored("manors")) {
    manorsInput.value = "1000";
    manorsOutput.value = "auto";
  }
  if (randomize || !stored("religionsNumber")) religionsNumber.value = String(gauss(6, 3, 2, 10));
  if (randomize || !stored("sizeVariety")) sizeVariety.value = String(gauss(4, 2, 0, 10, 1));
  if (randomize || !stored("growthRate")) growthRate.value = String(rn(1 + Math.random(), 1));
  if (randomize || !stored("cultures")) culturesInput.value = culturesOutput.value = String(gauss(12, 3, 5, 30));
  if (randomize || !stored("culturesSet")) randomizeCultureSet();

  // 'Configure World' settings
  if (randomize || !stored("temperatureEquator")) options.temperatureEquator = gauss(25, 7, 20, 35, 0);
  if (randomize || !stored("temperatureNorthPole")) options.temperatureNorthPole = gauss(-25, 7, -40, 10, 0);
  if (randomize || !stored("temperatureSouthPole")) options.temperatureSouthPole = gauss(-15, 7, -40, 10, 0);
  if (randomize || !stored("prec")) options.prec = gauss(100, 40, 5, 500);

  // 'Units Editor' settings
  const US = navigator.language === "en-US";
  if (randomize || !stored("distanceScale")) {
    distanceScale = gauss(3, 1, 1, 5);
    distanceScaleInput.value = String(distanceScale);
  }
  if (!stored("distanceUnit")) distanceUnitInput.value = US ? "mi" : "km";
  if (!stored("heightUnit")) heightUnit.value = US ? "ft" : "m";
  if (!stored("temperatureScale")) temperatureScale.value = US ? "°F" : "°C";

  // World settings
  generateEra();
}

// select heightmap template pseudo-randomly
function randomizeHeightmapTemplate(): void {
  const templates: Record<string, number> = {};
  for (const key in heightmapTemplates) {
    templates[key] = heightmapTemplates[key].probability || 0;
  }
  const template = rw(templates);
  const name = heightmapTemplates[template]?.name ?? template;
  applyOption(ensureEl<HTMLInputElement>("templateInput"), template, name);
}

// select culture set pseudo-randomly
function randomizeCultureSet(): void {
  const sets = {
    world: 10,
    european: 10,
    oriental: 2,
    english: 5,
    antique: 3,
    highFantasy: 11,
    darkFantasy: 3,
    random: 1
  };
  culturesSet.value = rw(sets);
  changeCultureSet();
}

function setRendering(value: string): void {
  getViewportSurface().viewbox.attr("shape-rendering", value);
}

// generate current year and era name
function generateEra(): void {
  if (!stored("year")) yearInput.value = String(rand(100, 2000)); // current year
  if (!stored("era")) eraInput.value = `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
  options.year = +yearInput.value;
  options.era = eraInput.value;
  options.eraShort = options.era
    .split(" ")
    .map(w => w[0].toUpperCase())
    .join(""); // short name for era
}

function regenerateEra(): void {
  unlock("era");
  options.era = eraInput.value = `${Names.getBaseShort(P(0.7) ? 1 : rand(Names.nameBases.length))} Era`;
  options.eraShort = options.era
    .split(" ")
    .map(w => w[0].toUpperCase())
    .join("");
}

function changeYear(): void {
  if (!yearInput.value) return;
  if (Number.isNaN(+yearInput.value)) {
    tip("Current year should be a number", false, "error");
    return;
  }
  options.year = +yearInput.value;
}

function changeEra(): void {
  if (!eraInput.value) return;
  lock("era");
  options.era = eraInput.value;
}

async function openTemplateSelectionDialog(): Promise<void> {
  window.Controllers.HeightmapSelection.open();
}

// Sticked menu Options listeners
ensureEl("sticked").addEventListener("click", event => {
  const id = (event.target as HTMLElement).id;
  if (id === "newMapButton") regeneratePrompt();
  else if (id === "saveButton") showSavePane();
  else if (id === "exportButton") showExportPane();
  else if (id === "loadButton") showLoadPane();
  else if (id === "zoomReset") resetZoom(1000);
});

function regeneratePrompt(options?: RegenerateOptions): void {
  if (!requireWorkspaceCapability("map:generate")) return;
  if (customization) {
    tip("New map cannot be generated when edit mode is active, please exit the mode and retry", false, "error");
    return;
  }
  if (!options) {
    window.dispatchEvent(new CustomEvent("new-map:open"));
    return;
  }

  const isBlankCanvas = options.fromSetup && document.body.dataset.newMapMode === "blank";
  const generateSelectedMap = () => {
    if (isBlankCanvas) regenerateBlankMap(options);
    else ApplicationController.regenerateMap(options);
  };

  const lastGeneratedMap = last(mapHistory);
  const workingTime = lastGeneratedMap ? (Date.now() - lastGeneratedMap.created) / 60000 : Infinity; // minutes
  if (workingTime < 1) {
    generateSelectedMap();
    return;
  }

  confirmationDialog({
    confirm: "Generate",
    message: /* html */ `Are you sure you want to ${isBlankCanvas ? "start a blank canvas" : "generate a new map"}?<br />
      All unsaved changes made to the current map will be lost`,
    onConfirm: () => {
      closeDialogs();
      generateSelectedMap();
    },
    title: "Generate new map"
  });
}

let blankMapPending = false;
function regenerateBlankMap(options: RegenerateOptions): void {
  if (blankMapPending) return;
  blankMapPending = true;

  delete document.body.dataset.newMapMode;
  const templateInput = ensureEl<HTMLInputElement>("templateInput");
  applyOption(templateInput, "loneIsland", heightmapTemplates.loneIsland.name);
  lock("template");
  templateInput.dispatchEvent(new Event("change", { bubbles: true }));

  const openBlankEditor = () => {
    clearTimeout(timeout);
    blankMapPending = false;
    setTimeout(() => window.Controllers.HeightmapEditor.openBlank(), 0);
  };
  const timeout = setTimeout(() => {
    window.removeEventListener("map:generated", openBlankEditor);
    blankMapPending = false;
  }, 60000);

  window.addEventListener("map:generated", openBlankEditor, { once: true });
  ApplicationController.regenerateMap(options);
}

function showSavePane(): void {
  const content = createSaveMapDialog();
  content.querySelectorAll<HTMLButtonElement>("[data-save-method]").forEach(button => {
    button.addEventListener("click", () => {
      void window.Services.Save.saveMap(button.dataset.saveMethod as "storage" | "machine" | "dropbox");
    });
  });
  showDomDialog({
    actions: [{ label: "Close" }],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Save map",
    width: "25em"
  });
}

function copyLinkToClickboard(): void {
  const shrableLink = ensureEl<HTMLAnchorElement>("sharableLink");
  const link = shrableLink.getAttribute("href");
  if (!link) return;
  navigator.clipboard.writeText(link).then(() => tip("Link is copied to the clipboard", true, "success", 8000));
}

function showExportPane(): void {
  const content = createExportMapDialog();
  const showLabels = content.querySelector<HTMLInputElement>("#showLabels")!;
  showLabels.checked = options.labels.showAll;
  showLabels.addEventListener("change", () => {
    options.labels.showAll = showLabels.checked;
    localStorage.setItem("label-groups", JSON.stringify(options.labels));
    drawLabels();
  });
  content.querySelector("#openExportToPngTiles")!.addEventListener("click", openExportToPngTiles);
  content.querySelectorAll<HTMLButtonElement>("[data-export-map]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.exportMap === "png") void window.Services.ExportMap.exportToPng();
      else void window.Services.ExportMap.exportToJpeg();
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-export-geo]").forEach(button => {
    button.addEventListener("click", () => {
      const type = button.dataset.exportGeo!;
      const method = `saveGeoJson${type[0].toUpperCase()}${type.slice(1)}`;
      void (window.Services.ExportMap as Record<string, () => void>)[method]();
    });
  });
  content.querySelectorAll<HTMLButtonElement>("[data-export-json]").forEach(button => {
    button.addEventListener(
      "click",
      () => void exportToJson(button.dataset.exportJson as "Full" | "GridCells" | "Minimal" | "PackCells")
    );
  });
  showDomDialog({
    actions: [{ label: "Close" }],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Export map data",
    width: "26em"
  });
}

async function exportToJson(type: "Full" | "GridCells" | "Minimal" | "PackCells"): Promise<void> {
  window.Services.ExportJson.exportToJson(type);
}

async function showLoadPane(): Promise<void> {
  const content = createLoadMapDialog();
  const dropboxConnectButton = content.querySelector<HTMLElement>("#dropboxConnectButton")!;
  const loadFromDropboxSelect = content.querySelector<HTMLSelectElement>("#loadFromDropboxSelect")!;
  const loadFromDropboxButtons = content.querySelector<HTMLElement>("#loadFromDropboxButtons")!;
  content.querySelector<HTMLButtonElement>('[data-load-method="machine"]')!.addEventListener("click", () => {
    ensureEl("mapToLoad").click();
  });
  content.querySelector<HTMLButtonElement>('[data-load-method="storage"]')!.addEventListener("click", () => {
    void window.Services.Load.quickLoad();
  });
  content.querySelector("#loadMapFromUrl")!.addEventListener("click", loadURL);
  dropboxConnectButton.addEventListener("click", () => void connectToDropbox());
  content.querySelector<HTMLButtonElement>('[data-dropbox-action="load"]')!.addEventListener("click", () => {
    void window.Services.Load.loadFromDropbox();
  });
  content.querySelector<HTMLButtonElement>('[data-dropbox-action="share"]')!.addEventListener("click", () => {
    void window.Services.Load.createSharableDropboxLink();
  });
  content.querySelector("#copySharableLink")!.addEventListener("click", copyLinkToClickboard);
  showDomDialog({
    actions: [{ label: "Close" }],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Load map",
    width: "fit-content"
  });

  // already connected to Dropbox: list saved maps
  if (await window.Services.Cloud.isConnected()) {
    dropboxConnectButton.style.display = "none";
    loadFromDropboxSelect.style.display = "block";
    loadFromDropboxSelect.innerHTML = /* html */ `<option value="" disabled selected>Loading...</option>`;

    const files = await window.Services.Cloud.list();

    if (!files) {
      loadFromDropboxButtons.style.display = "none";
      loadFromDropboxSelect.innerHTML = /* html */ `<option value="" disabled selected>Save files to Dropbox first</option>`;
      return;
    }

    loadFromDropboxButtons.style.display = "block";
    loadFromDropboxSelect.innerHTML = "";
    files.forEach(({ name, updated, size, path }) => {
      const sizeMB = `${rn(size / 1024 / 1024, 2)} MB`;
      const updatedOn = new Date(updated).toLocaleDateString();
      const nameFormatted = `${updatedOn}: ${name} [${sizeMB}]`;
      const option = new Option(nameFormatted, path);
      loadFromDropboxSelect.options.add(option);
    });

    return;
  }

  // not connected to Dropbox: show connect button
  dropboxConnectButton.style.display = "inline-block";
  loadFromDropboxButtons.style.display = "none";
  loadFromDropboxSelect.style.display = "none";
}

async function connectToDropbox(): Promise<void> {
  await window.Services.Cloud.connect();
  if (await window.Services.Cloud.isConnected()) {
    closeDialogs();
    void showLoadPane();
  }
}

function loadURL(): void {
  const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;
  const inner = `Provide URL to map file:
    <input id="mapURL" type="url" style="width: 24em" placeholder="https://e-cloud.com/test.map">
    <br><i>Please note server should allow CORS for file to be loaded. If CORS is not allowed, save file to Dropbox and provide a direct link</i>`;
  window.destroyDialog("loadMapUrlDialog");
  const content = document.createElement("div");
  content.id = "loadMapUrlDialog";
  content.innerHTML = inner;
  ensureEl("dialogs").appendChild(content);
  window.showDomDialog({
    actions: [
      {
        close: false,
        label: "Load",
        onClick: () => {
          const value = content.querySelector<HTMLInputElement>("#mapURL")?.value ?? "";
          if (!pattern.test(value)) {
            tip("Please provide a valid URL", false, "error");
            return;
          }
          window.Services.Load.loadMapFromURL(value);
          window.destroyDialog(content.id);
        }
      },
      { label: "Cancel" }
    ],
    content,
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Load map from URL",
    width: "27em"
  });
}

// load map
ensureEl<HTMLInputElement>("mapToLoad").addEventListener("change", event => {
  const input = event.currentTarget as HTMLInputElement;
  const fileToLoad = input.files?.[0];
  input.value = "";
  if (!fileToLoad) return;
  closeDialogs();
  window.Services.Load.uploadMap(fileToLoad);
});

function openExportToPngTiles(): void {
  closeDialogs();
  const content = createPngTilesDialog();
  content.querySelector<HTMLElement>("#tileStatus")!.innerHTML = "";

  const inputs = content.querySelectorAll<HTMLInputElement>("input");
  inputs.forEach(input => {
    input.addEventListener("input", updateTilesOptions);
  });

  showDomDialog({
    actions: [
      { close: false, label: "Download", onClick: () => window.Services.ExportMap.exportToPngTiles() },
      { label: "Cancel" }
    ],
    content,
    onClose: () => {
      window.Services.ExportMap.cancelPngTilesExport();
      inputs.forEach(input => {
        input.removeEventListener("input", updateTilesOptions);
      });
      getViewportSurface().debug.selectAll("*").remove();
    },
    placement: "center",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Download tiles",
    width: "23em"
  });
  updateTilesOptions();
}

function updateTilesOptions(event?: Event): void {
  const input = event?.currentTarget;
  if (input instanceof HTMLInputElement) {
    const { nextElementSibling: next, previousElementSibling: prev } = input;
    if (next instanceof HTMLInputElement) next.value = input.value;
    if (prev instanceof HTMLInputElement) prev.value = input.value;
  }

  const tileSize = ensureEl("tileSize");
  const tilesX = +ensureEl<HTMLInputElement>("tileColsOutput").value || 2;
  const tilesY = +ensureEl<HTMLInputElement>("tileRowsOutput").value || 2;
  const scale = +ensureEl<HTMLInputElement>("tileScaleOutput").value || 1;

  // calculate size
  const sizeX = graphWidth * scale * tilesX;
  const sizeY = graphHeight * scale * tilesY;
  const totalSize = sizeX * sizeY;

  tileSize.innerHTML = /* html */ `${sizeX} x ${sizeY} px`;
  tileSize.style.color = totalSize > 1e9 ? "#d00b0b" : totalSize > 1e8 ? "#9e6409" : "#1a941a";

  // draw tiles
  const rects: string[] = [];
  const labels: string[] = [];
  const tileW = (graphWidth / tilesX) | 0;
  const tileH = (graphHeight / tilesY) | 0;

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function getRowLabel(row: number): string {
    const first = row >= alphabet.length ? alphabet[Math.floor(row / alphabet.length) - 1] : "";
    const last = alphabet[row % alphabet.length];
    return first + last;
  }

  for (let y = 0, row = 0; y + tileH <= graphHeight; y += tileH, row++) {
    for (let x = 0, column = 1; x + tileW <= graphWidth; x += tileW, column++) {
      rects.push(`<rect x=${x} y=${y} width=${tileW} height=${tileH} />`);
      labels.push(`<text x=${x + tileW / 2} y=${y + tileH / 2}>${getRowLabel(row)}${column}</text>`);
    }
  }

  getViewportSurface().debug.html(`
    <g fill='none' stroke='#000'>${rects.join("")}</g>
    <g fill='#000' stroke='none' text-anchor='middle' dominant-baseline='central' font-size='18px'>${labels.join(
      ""
    )}</g>
  `);
}

const runtime: OptionsControllerApi = {
  applyGraphSize,
  applyStoredOptions,
  changeCellsDensity,
  connectToDropbox,
  copyLinkToClickboard,
  exportToJson,
  fitMapToScreen,
  getCellsDensityColor,
  getCellsDensity,
  hide: hideOptions,
  loadURL,
  openExportToPngTiles,
  randomize: randomizeOptions,
  regenerate: regeneratePrompt,
  restoreSeed,
  show: showOptions,
  showSupporters,
  toggle: toggleOptions
};

bindOptionsController(runtime);
window.OptionsController = OptionsController;
