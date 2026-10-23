import { hsl } from "d3";
import { applyZoomExtent, fitMapToScreen, setViewport } from "@/app/canvas";
import {
  ADVANCED_OPTIONS_ID,
  AdvancedOptions,
  GRAPH_PRESETS,
  getAdvancedOptionsHTML,
  getGraphPreset
} from "@/app/chrome/advanced-options";
import { toggleAssistant } from "@/app/chrome/assistant-bubble";
import { PerformanceSettings } from "@/app/chrome/performance-settings";
import {
  applyPerformancePreset,
  applyPerformanceSettings,
  onPerformanceChange,
  resolvePerformancePreset
} from "@/app/performance";
import { generateMapWithSeed, showSeedHistoryDialog } from "@/app/seed";
import { Controllers } from "@/controllers";
import { CULTURE_SETS } from "@/data/culture-sets";
import { getPointsNumber } from "@/data/graph-density";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { isLanguage, LANGUAGES } from "@/data/languages";
import { precreatedHeightmaps } from "@/data/precreated-heightmaps";
import type { Sampling } from "@/model/graph/lattice";
import { DEFAULT_THEME_COLOR, Options } from "@/model/options/options-model";
import type { OptionsData } from "@/model/options/options-schema";
import { Pins } from "@/model/options/pins";
import { isAutoBurgLimit } from "@/model/political/burgs-generator";
import { Emblems } from "@/model/political/emblems-generator";
import { Cultures } from "@/model/society/cultures-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { viewport } from "@/renderers/viewport/viewport";
import { copyMapURL } from "@/services/url-params";
import { confirmCleanupData } from "@/services/versioning";
import { confirmationDialog } from "@/ui/dialog/dialog-helpers";
import { constrainZoom, setMapZoom, setTranslateExtent, setZoomExtent } from "@/ui/map/zoom";
import { tip } from "@/ui/tooltips";
import { Catalog, sentences, t } from "@/utils/i18n";
import { applyOption, ensureEl, findEl } from "@/utils/nodeUtils";
import { minmax, rn } from "@/utils/numberUtils";

interface OptionBinding {
  read: (config: OptionsData) => string | number | null;
  update: (value: string) => void;
  pin?: string;
  event?: "change";
}

interface OptionDefinition<T extends string | number> {
  read: (config: OptionsData) => T | null;
  write: (config: OptionsData, value: T) => void;
  parse: (value: string) => T;
  pin?: string;
  effect?: (value: T) => void;
}

const OPTION_BINDINGS: Record<string, OptionBinding> = {
  mapWidth: { read: o => o.generation.graph.width, update: onMapSizeChange, pin: "mapWidth", event: "change" },
  mapHeight: { read: o => o.generation.graph.height, update: onMapSizeChange, pin: "mapHeight", event: "change" },
  seed: { read: o => o.map.seed, update: generateMapWithSeed, event: "change" },
  graphPreset: { read: o => getGraphPreset(o.generation.graph), update: applyGraphPreset },
  sampling: option({
    read: o => o.generation.graph.sampling,
    write: (o, value) => (o.generation.graph.sampling = value),
    parse: value => value as Sampling,
    effect: () => syncOption("graphPreset")
  }),
  jitter: option({
    read: o => o.generation.graph.jitter,
    write: (o, value) => (o.generation.graph.jitter = value),
    parse: Number,
    effect: () => syncOption("graphPreset")
  }),
  points: option({
    read: o => o.generation.graph.density,
    write: (o, value) => (o.generation.graph.density = value),
    parse: Number,
    pin: "points",
    effect: syncCellsDensity
  }),
  template: option({
    read: o => o.generation.template,
    write: (o, value) => (o.generation.template = value),
    parse: String,
    pin: "template"
  }),
  resolveDepressionsSteps: option({
    read: o => o.generation.resolveDepressionsSteps,
    write: (o, value) => (o.generation.resolveDepressionsSteps = value),
    parse: Number,
    pin: "resolveDepressionsSteps"
  }),
  lakeElevationLimit: option({
    read: o => o.generation.lakeElevationLimit,
    write: (o, value) => (o.generation.lakeElevationLimit = value),
    parse: Number,
    pin: "lakeElevationLimit",
    effect: () => options.app.mode === "heightmap" && Controllers.HeightmapEditor.redrawDrainage() // the heightmap editor's overlay
  }),
  cultures: option({
    read: o => o.generation.cultures.limit,
    write: (o, value) => (o.generation.cultures.limit = value),
    parse: Number,
    pin: "cultures",
    effect: syncCultures
  }),
  culturesSet: option({
    read: o => o.generation.cultures.set,
    write: (o, value) => {
      o.generation.cultures.set = value;
      Options.capCultures();
    },
    parse: String,
    pin: "culturesSet",
    effect: syncCultures
  }),
  statesNumber: option({
    read: o => o.generation.states.limit,
    write: (o, value) => (o.generation.states.limit = value),
    parse: Number,
    pin: "statesNumber"
  }),
  provincesRatio: option({
    read: o => o.generation.provinces.ratio,
    write: (o, value) => (o.generation.provinces.ratio = value),
    parse: Number,
    pin: "provincesRatio"
  }),
  religionsNumber: option({
    read: o => o.generation.religions.limit,
    write: (o, value) => (o.generation.religions.limit = value),
    parse: Number,
    pin: "religionsNumber"
  }),
  manors: option({
    read: o => o.generation.burgs.limit,
    write: (o, value) => (o.generation.burgs.limit = value),
    parse: Number,
    pin: "manors",
    effect: syncManors
  }),
  sizeVariety: option({
    read: o => o.generation.states.sizeVariety,
    write: (o, value) => (o.generation.states.sizeVariety = o.generation.cultures.sizeVariety = value),
    parse: Number,
    pin: "sizeVariety"
  }),
  growthRate: option({
    read: o => o.generation.states.growthRate,
    write: (o, value) => (o.generation.states.growthRate = o.generation.cultures.growthRate = value),
    parse: Number,
    pin: "growthRate"
  }),
  uiSize: option({
    read: o => o.app.ui.size,
    write: (o, value) => (o.app.ui.size = value),
    parse: Number,
    effect: changeUiSize
  }),
  tooltipSize: option({
    read: o => o.app.ui.tooltipSize,
    write: (o, value) => (o.app.ui.tooltipSize = value),
    parse: Number,
    effect: changeTooltipSize
  }),
  azgaarAssistant: option({
    read: o => o.app.ui.assistant,
    write: (o, value) => (o.app.ui.assistant = value),
    parse: value => (value === "hide" ? "hide" : "show"),
    effect: value => toggleAssistant(value === "show")
  }),
  speakerVoice: option({
    read: o => o.app.ui.speakerVoice || null, // unset keeps the default voice loadVoices picked
    write: (o, value) => (o.app.ui.speakerVoice = value),
    parse: String
  }),
  emblemShape: option({
    read: o => o.app.emblems.shape,
    write: (o, value) => (o.app.emblems.shape = value),
    parse: String,
    effect: changeEmblemShape
  }),
  performancePreset: { read: o => resolvePerformancePreset(o.app.performance), update: applyPerformancePreset },
  onloadBehavior: option({
    read: o => o.app.onLoad,
    write: (o, value) => (o.app.onLoad = value),
    parse: value => (value === "lastSaved" ? "lastSaved" : "random")
  }),
  autosaveInterval: option({
    read: o => o.app.autosave.interval,
    write: (o, value) => (o.app.autosave.interval = value),
    parse: Number
  }),
  viewportWidth: { read: () => viewport.width, update: changeViewportSize, event: "change" },
  viewportHeight: { read: () => viewport.height, update: changeViewportSize, event: "change" },
  zoomExtentMin: { read: o => o.app.zoomExtent.min, update: changeZoomExtent, event: "change" },
  zoomExtentMax: { read: o => o.app.zoomExtent.max, update: changeZoomExtent, event: "change" },
  themeHue: { read: o => hsl(o.app.ui.themeColor).h, update: changeThemeHue },
  themeColor: { read: o => o.app.ui.themeColor, update: value => setTheme(value, options.app.ui.transparency) },
  transparency: { read: o => o.app.ui.transparency, update: value => setTheme(options.app.ui.themeColor, +value) }
};

function option<T extends string | number>(definition: OptionDefinition<T>): OptionBinding {
  const { read, write, parse, pin, effect } = definition;
  return {
    read,
    pin,
    update(raw) {
      const value = parse(raw);
      Options.set(o => write(o, value));
      if (pin) Pins.set(pin, value);
      effect?.(value);
    }
  };
}

const collator = new Intl.Collator();
/** English first, then the rest by their own name */
const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).sort(([a, x], [b, y]) =>
  a === "en" ? -1 : b === "en" ? 1 : collator.compare(x, y)
);

const TEMPLATE = /* html */ `
  <p data-tip="${t("Settings for the next map. Generate a new map to apply them")}">
    ${t("Map settings (apply to new maps)")}:
  </p>
  <table>
    <tr
      data-tip="${t("Map seed number. Press 'Enter' to apply. A seed reproduces the same map only if the map size and the settings are the same")}"
    >
      <td>
        <i
          data-tip="${t("Show seed history to apply a previous seed")}"
          id="optionsMapHistory"
          class="icon-hourglass-1"
        ></i>
      </td>
      <td>${t("Map seed")}</td>
      <td>
        <input id="seedInput" data-option="seed" class="long" type="number" min="1" max="999999999" step="1" />
      </td>
      <td>
        <i
          data-tip="${t("Copy map seed as URL. It will produce the same map only if options are default or the same")}"
          id="optionsCopySeed"
          class="icon-docs"
        ></i>
      </td>
    </tr>
    <tr
      data-tip="${t("Set number of points to be used for graph generation. Highly affects performance. 10K is the only recommended value")}"
    >
      <td>
        <i data-locked="0" id="lock_points" class="icon-lock-open"></i>
      </td>
      <td>${t("Points number")}</td>
      <td>
        <input
          id="pointsInput"
          data-option="points"
          type="range"
          min="1"
          max="13"
          value="4"
          data-cells="10000"
        />
      </td>
      <td>
        <output id="pointsOutputFormatted" data-option-output="points" style="color: #053305">10K</output>
      </td>
    </tr>
    <tr data-tip="${t("Select template or precreated heightmap to be used on generation")}">
      <td>
        <i data-locked="0" id="lock_template" class="icon-lock-open"></i>
      </td>
      <td>${t("Heightmap")}</td>
      <td id="templateInputContainer" class="pointer">
        <select id="templateInput" data-option="template" style="pointer-events: none"></select>
      </td>
      <td></td>
    </tr>
    <tr data-tip="${t("Define how many Cultures should be generated")}">
      <td>
        <i data-locked="0" id="lock_cultures" class="icon-lock-open"></i>
      </td>
      <td>${t("Cultures number")}</td>
      <td>
        <input id="culturesInput" data-option="cultures" type="range" min="1" />
      </td>
      <td>
        <input id="culturesOutput" data-option="cultures" type="number" min="1" />
      </td>
    </tr>
    <tr data-tip="${t("Select a set of cultures to be used for names and cultures generation")}">
      <td>
        <i data-locked="0" id="lock_culturesSet" class="icon-lock-open"></i>
      </td>
      <td>${t("Cultures set")}</td>
      <td>
        <select id="culturesSet" data-option="culturesSet">
          <option value="world" data-max="32" selected>${t("All-world")}</option>
          <option value="european" data-max="15">${t("European")}</option>
          <option value="oriental" data-max="13">${t("Oriental")}</option>
          <option value="english" data-max="10">${t("English")}</option>
          <option value="antique" data-max="10">${t("Antique")}</option>
          <option value="highFantasy" data-max="17">${t("High Fantasy")}</option>
          <option value="darkFantasy" data-max="18">${t("Dark Fantasy")}</option>
          <option value="random" data-max="100">${t("Random")}</option>
        </select>
      </td>
      <td></td>
    </tr>
    <tr data-tip="${t("Define how many states and capitals should be generated")}">
      <td>
        <i data-locked="0" id="lock_statesNumber" class="icon-lock-open"></i>
      </td>
      <td>${t("States number")}</td>
      <td colspan="2">
        <slider-input id="statesNumber" data-option="statesNumber" min="0" max="100"></slider-input>
      </td>
    </tr>
    <tr data-tip="${t("Define a number of non-capital settlements to be placed (if enough suitable land exists)")}">
      <td>
        <i data-locked="0" id="lock_manors" class="icon-lock-open"></i>
      </td>
      <td>${t("Number of burgs")}</td>
      <td>
        <input id="manorsInput" data-option="manors" type="range" min="0" max="1000" step="1" value="1000" />
      </td>
      <td>
        <output id="manorsOutput" data-option-output="manors" value="auto"></output>
      </td>
    </tr>
    <tr
      data-tip="${t("Define how many organized religions and cults should be generated. Cultures will have their own folk religions in any case")}"
    >
      <td>
        <i data-locked="0" id="lock_religionsNumber" class="icon-lock-open"></i>
      </td>
      <td>${t("Religions number")}</td>
      <td colspan="2">
        <slider-input
          id="religionsNumber"
          data-option="religionsNumber"
          min="0"
          max="50"
          step="1"
        ></slider-input>
      </td>
    </tr>
  </table>
  <p data-tip="${t("Interface preferences saved in this browser. Changes apply immediately")}">
    ${t("Interface settings")}:
  </p>
  <table>
    <tr data-tip="${t("Select the interface language. It applies after a reload")}">
      <td></td>
      <td>${t("Language")}</td>
      <td>
        <select id="interfaceLanguage">
          ${LANGUAGE_OPTIONS.map(
            ([code, name]) => `<option value="${code}" ${code === Catalog.language ? "selected" : ""}>${name}</option>`
          ).join("")}
        </select>
      </td>
      <td></td>
    </tr>
    <tr
      data-tip="${t("Set user interface size. Please note browser zoom also affects interface size (Ctrl + or Ctrl - to change)")}"
    >
      <td></td>
      <td>${t("Interface size")}</td>
      <td colspan="2">
        <slider-input id="uiSize" data-option="uiSize" min=".6" max="3" step=".1"></slider-input>
      </td>
    </tr>
    <tr data-tip="${t("Set tooltip size")}">
      <td></td>
      <td>${t("Tooltip size")}</td>
      <td colspan="2">
        <slider-input id="tooltipSize" data-option="tooltipSize" min="1" max="32" value="14"></slider-input>
      </td>
    </tr>
    <tr data-tip="${t("Set theme hue for dialogs and tool windows")}">
      <td>
        <i data-tip="${t("Reset to default")}" id="themeColorRestore" class="icon-ccw"></i>
      </td>
      <td>${t("Theme color")}</td>
      <td>
        <input id="themeHueInput" data-option="themeHue" type="range" min="0" max="359" />
      </td>
      <td>
        <input id="themeColorInput" data-option="themeColor" type="color" />
      </td>
    </tr>
    <tr data-tip="${t("Set dialog and tool windows transparency")}">
      <td></td>
      <td>${t("Transparency")}</td>
      <td colspan="2">
        <slider-input id="transparencyInput" data-option="transparency" min="0" max="100"></slider-input>
      </td>
    </tr>
    <tr data-tip="${t("Rendering preset: visual quality traded for speed. Pick 'Speed' if the map feels slow")}">
      <td></td>
      <td>${t("Performance")}</td>
      <td>
        <select id="performancePreset" data-option="performancePreset">
          <option value="quality">${t("Quality")}</option>
          <option value="balance" selected>${t("Balance")}</option>
          <option value="speed">${t("Speed")}</option>
          <option value="custom" disabled hidden>${t("Custom")}</option>
        </select>
      </td>
      <td>
        <i data-tip="${t("Open the performance settings")}" id="openPerformanceSettings" class="icon-cog"></i>
      </td>
    </tr>
    <tr data-tip="${t("Toggle Azgaar Assistant (help bubble on the bottom right corner)")}">
      <td></td>
      <td>${t("Azgaar Assistant")}</td>
      <td>
        <select id="azgaarAssistant" data-option="azgaarAssistant">
          <option value="show" selected>${t("Show")}</option>
          <option value="hide">${t("Hide")}</option>
        </select>
      </td>
    </tr>
    <tr
      data-tip="${t("Size of the map window on screen. Independent of the map size: it is how much of the map you see at once. Set by hand it is remembered, until you fit it back to the window")}"
    >
      <td>
        <i data-tip="${t("Fit the viewport to the browser window")}" id="viewportFit" class="icon-ccw"></i>
      </td>
      <td>${t("Viewport size")}</td>
      <td>
        <input id="viewportWidth" data-option="viewportWidth" class="paired" type="number" min="100" />
        <span>x</span>
        <input id="viewportHeight" data-option="viewportHeight" class="paired" type="number" min="100" />
        <span>px</span>
      </td>
      <td></td>
    </tr>
    <tr data-tip="${t("Set minimum and maximum possible zoom level")}">
      <td>
        <i data-tip="${t("Reset to default")}" id="zoomExtentDefault" class="icon-ccw"></i>
      </td>
      <td>${t("Zoom extent")}</td>
      <td>
        <span data-tip="${t("Minimum possible zoom level (should be > 0)")}">${t("min")}</span>
        <input
          data-tip="${t("Minimum possible zoom level (should be > 0)")}"
          id="zoomExtentMin" data-option="zoomExtentMin"
          class="paired"
          type="number"
          min=".2"
          step=".1"
          max="20"
          value="1"
        />
        <span data-tip="${t("Maximum possible zoom level (should be > 1)")}">${t("max")}</span>
        <input
          data-tip="${t("Maximum possible zoom level (should be > 1)")}"
          id="zoomExtentMax" data-option="zoomExtentMax"
          class="paired"
          type="number"
          min="1"
          max="50"
          value="20"
        />
      </td>
      <td>
        <i
          data-tip="${t("Allow dragging the map beyond the canvas borders")}"
          id="translateExtent"
          data-on="0"
          class="icon-hand-paper-o"
        ></i>
      </td>
    </tr>
  </table>
  <p data-tip="${t("Open the map configurators or reset all options")}">${t("Configure")}:</p>
  <div style="display: flex; flex-wrap: wrap; gap: 0.3em; margin: 0.3em 0.3em 0">
    <button
      id="configureWorld"
      style="flex: 1; min-width: max-content"
      data-tip="${t("Open the World Configurator to set the map position on the globe and the world climate")}"
    >
      ${t("Climate")}
    </button>
    <button
      id="setupLore"
      style="flex: 1; min-width: max-content"
      data-tip="${t("Click to name the map, date its calendar and describe the world")}"
    >
      ${t("Lore")}
    </button>
    <button
      id="openAdvancedOptions"
      style="flex: 1; min-width: max-content"
      data-tip="${t("Open advanced options: settings for experienced users")}"
    >
      ${t("Advanced")}
    </button>
    <button
      id="optionsReset"
      style="flex: 1; min-width: max-content"
      data-tip="${t("Click to restore default options and reload the page")}"
    >
      ${t("Reset")}
    </button>
  </div>
`;

const pendingInputs = new WeakMap<HTMLElement, string>();

ensureEl("optionsContent").innerHTML = TEMPLATE;
ensureEl("dialogs").insertAdjacentHTML("beforeend", getAdvancedOptionsHTML());
addListeners();
loadVoices();
onPerformanceChange(() => syncOption("performancePreset")); // the preset follows the fields, wherever they change

function addListeners(): void {
  for (const root of [ensureEl("options"), ensureEl(ADVANCED_OPTIONS_ID)]) {
    root.addEventListener("input", onOptionInput);
    root.addEventListener("change", onOptionInput);
  }
  ensureEl("interfaceLanguage").addEventListener("change", event => changeLanguage(event.target as HTMLSelectElement));

  const onClick = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.id === "restoreDefaultMapSize") restoreDefaultMapSize();
    else if (target.id === "configureWorld") Controllers.WorldConfigurator.open();
    else if (target.id === "setupLore") Controllers.LoreEditor.open();
    else if (target.id === "optionsMapHistory") showSeedHistoryDialog();
    else if (target.id === "optionsCopySeed") copyMapURL();
    else if (target.id === "templateInputContainer") Controllers.HeightmapSelection.open();
    else if (target.id === "viewportFit") fitViewportToWindow();
    else if (target.id === "zoomExtentDefault") restoreDefaultZoomExtent();
    else if (target.id === "translateExtent") toggleTranslateExtent(target);
    else if (target.id === "openPerformanceSettings") PerformanceSettings.open();
    else if (target.id === "speakerTest") testSpeaker();
    else if (target.id === "themeColorRestore") restoreDefaultThemeColor();
    else if (target.id === "openAdvancedOptions") AdvancedOptions.open();
    else if (target.id === "optionsReset") confirmCleanupData();
  };
  ensureEl("optionsContent").addEventListener("click", onClick);
  ensureEl(ADVANCED_OPTIONS_ID).addEventListener("click", onClick);
}

function optionInputs<T extends HTMLElement = HTMLInputElement>(key: string): NodeListOf<T> {
  return document.querySelectorAll<T>(`:is(#options, #${ADVANCED_OPTIONS_ID}) [data-option="${key}"]`);
}

function optionInput<T extends HTMLElement = HTMLInputElement>(key: string): T {
  const input = optionInputs<T>(key)[0];
  if (!input) throw new Error(`Missing option control: ${key}`);
  return input;
}

function syncOption(key: string, source?: HTMLElement): void {
  const value = OPTION_BINDINGS[key].read(options);
  if (value === null) return;
  for (const input of optionInputs(key)) {
    if (input === source) continue;
    input.value = String(value);
    pendingInputs.delete(input);
  }
}

export function syncOptionInputs(): void {
  const template = optionInputs<HTMLSelectElement>("template")[0];
  const id = options.generation.template;
  if (template && id) applyOption(template, id, heightmapTemplates[id]?.name || precreatedHeightmaps[id]?.name || id);

  for (const key of Object.keys(OPTION_BINDINGS)) syncOption(key);
  syncManors();
  syncCellsDensity();
  syncCultures();
  syncPngResolution();
  syncViewOnly();
}

function syncViewOnly(): void {
  const viewOnly = !!options.map.viewOnly;
  document.body.classList.toggle("view-only", viewOnly);
  if (viewOnly) findEl("layersTab")?.click();

  const saveButton = findEl<HTMLButtonElement>("saveButton");
  if (!saveButton) return;
  saveButton.disabled = viewOnly;
  saveButton.dataset.tip = viewOnly
    ? t("The map is in view-only mode and cannot be saved")
    : t("Save fully-functional map file");
}

function syncManors(): void {
  const output = ensureEl("options").querySelector<HTMLOutputElement>('[data-option-output="manors"]');
  if (output) output.value = isAutoBurgLimit() ? t("Auto") : String(options.generation.burgs.limit);
}

function syncCellsDensity(): void {
  const { density } = options.generation.graph;
  const cellsDesired = getPointsNumber(density);

  const input = optionInputs("points")[0];
  if (input) {
    input.value = String(density);
    input.dataset.cells = String(cellsDesired);
  }

  const readout = ensureEl("options").querySelector<HTMLOutputElement>('[data-option-output="points"]');
  if (!readout) return;
  readout.value = `${cellsDesired / 1000}K`;
  readout.style.color = cellsDensityColor(cellsDesired);
}

/** Cap the cultures slider at what the selected set can give, and show the number that survived it */
function syncCultures(): void {
  const max = String(CULTURE_SETS[options.generation.cultures.set]?.max ?? 0);
  for (const input of optionInputs("cultures")) {
    input.max = max;
    input.value = String(options.generation.cultures.limit);
  }
}

function syncPngResolution(): void {
  const input = ensureEl("options").querySelector<HTMLInputElement>('[data-option="pngResolution"]');
  if (input) input.value = String(options.app.export.pngResolution);
}

function currentValue(key: string): string | number | undefined {
  return (
    Object.values(OPTION_BINDINGS)
      .find(binding => binding.pin === key)
      ?.read(options) ?? undefined
  );
}

function onOptionInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const key = input.dataset.option;
  if (!key || !Object.hasOwn(OPTION_BINDINGS, key)) return;
  const binding = OPTION_BINDINGS[key];
  if (binding.event === "change" && event.type !== "change") return;

  // A native change commits the last input; it must not repeat its effects.
  if (event.type !== "change" || pendingInputs.get(input) !== input.value) {
    binding.update(input.value);
    syncOption(key, input);
  }

  if (event.type === "input") pendingInputs.set(input, input.value);
  else {
    pendingInputs.delete(input);
    Options.persist();
  }
}

/** The extent the next map is generated on: not the window it will be looked at through */
function onMapSizeChange(): void {
  // a pin outlives the control, so it cannot hold what the input's own `min` would have rejected
  const asked = (key: string) => {
    const input = optionInput(key);
    const value = Math.max(+input.value || 0, +input.min || 1);
    input.value = String(value);
    return value;
  };
  const width = asked("mapWidth");
  const height = asked("mapHeight");

  Options.set(o => {
    o.generation.graph.width = width;
    o.generation.graph.height = height;
  });
  // the map on screen keeps the extent its graph was built on - this asks for the next one
  Pins.set("mapWidth", width);
  Pins.set("mapHeight", height);

  if (options.generation.graph.width > window.innerWidth || options.generation.graph.height > window.innerHeight) {
    const size = `${window.innerWidth} x ${window.innerHeight}`;
    tip(t("Map size is larger than the window ({{size}}). It can affect performance", { size }), false, "warn", 4000);
  }
}

/** Back to the window size, which is what most maps want */
function restoreDefaultMapSize(): void {
  Options.set(o => {
    o.generation.graph.width = window.innerWidth;
    o.generation.graph.height = window.innerHeight;
  });
  Pins.clear("mapWidth");
  Pins.clear("mapHeight");
  syncOptionInputs();
}

/** A preset is only a sampling and jitter pair: it writes both, the preset select follows them */
function applyGraphPreset(id: string): void {
  const preset = GRAPH_PRESETS[id];
  if (!preset) return;
  Options.set(o => Object.assign(o.generation.graph, { sampling: preset.sampling, jitter: preset.jitter }));
  syncOption("sampling");
  syncOption("jitter");
}

/** The Points slider picks a density step; the readout shows the cell count it resolves to */
export function changeCellsDensity(density: number): void {
  Options.set(o => (o.generation.graph.density = density));
  syncCellsDensity();
}

/** green at the default density, amber above it, red where performance starts to suffer */
export const cellsDensityColor = (cells: number): string =>
  cells > 50000 ? "#b12117" : cells === 10000 ? "#053305" : "#dfdf12";

/** Re-shield every emblem that has not been customised, and re-render the ones on screen */
function changeEmblemShape(shape: string): void {
  Emblems.setShape(shape);

  const image = ensureEl("emblemShapeImage");
  const { shieldPaths } = EmblemRenderer;
  const shapePath = shieldPaths[shape as keyof typeof shieldPaths];
  if (shapePath) image.setAttribute("d", shapePath);
  else image.removeAttribute("d");

  const specificShape = ["culture", "state", "random"].includes(shape) ? null : shape;
  if (shape === "random")
    for (const culture of pack.cultures) if (!culture.removed) culture.shield = Cultures.getRandomShield();

  for (const state of pack.states) {
    if (!state.i || state.removed || !state.coa || "icon" in state.coa) continue;
    const shield = specificShape || Emblems.getShield(state.culture ?? 0);
    if (shield === state.coa.shield) continue;
    state.coa.shield = shield;
    EmblemRenderer.trigger(`stateCOA${state.i}`, state.coa);
  }

  for (const province of pack.provinces) {
    if (!province.i || province.removed || !province.coa || "icon" in province.coa) continue;
    const shield = specificShape || Emblems.getShield(pack.cells.culture[province.center] ?? 0, province.state);
    if (shield === province.coa.shield) continue;
    province.coa.shield = shield;
    EmblemRenderer.trigger(`provinceCOA${province.i}`, province.coa);
  }

  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.coa || "icon" in burg.coa) continue;
    const shield = specificShape || Emblems.getShield(burg.culture ?? 0, burg.state);
    if (shield === burg.coa.shield) continue;
    burg.coa.shield = shield;
    EmblemRenderer.trigger(`burgCOA${burg.i}`, burg.coa);
  }
}

function changeUiSize(value: number): void {
  if (Number.isNaN(value) || value < 0.5) return;
  const size = Math.min(value, maxUiSize());

  optionInput("uiSize").value = String(size);
  document.body.style.fontSize = `${rn(size * 10, 2)}px`;
  ensureEl("options").style.width = `${size * 300}px`;
}

const maxUiSize = () => rn(Math.min(window.innerHeight / 465, window.innerWidth / 302), 1);

function changeTooltipSize(value: number): void {
  ensureEl("tooltip").style.fontSize = `calc(${value}px + 0.5vw)`;
}

/**
 * The theme is a colour and a transparency edited by three controls - a picker, a hue slider and a
 * reset. One writer for the pair keeps the object holding what the dialogs are actually painted
 * with, whichever control moved. See docs/architecture/configuration.md
 */
function setTheme(themeColor: string, transparency: number): void {
  Options.set(o => {
    o.app.ui.themeColor = themeColor;
    o.app.ui.transparency = transparency;
  });
  changeDialogsTheme(themeColor, transparency);
}

function restoreDefaultThemeColor(): void {
  setTheme(DEFAULT_THEME_COLOR, options.app.ui.transparency);
}

function changeThemeHue(hue: string): void {
  const { s, l } = hsl(options.app.ui.themeColor);
  setTheme(hsl(+hue, s, l).hex(), options.app.ui.transparency);
}

/**
 * Derive the whole dialog palette from one colour and one transparency. This applies what the
 * object holds; `setTheme` is what puts it there
 */
function changeDialogsTheme(themeColor: string, transparency: number): void {
  optionInput("transparency").value = String(transparency);
  const alpha = (100 - transparency) / 100;
  const alphaReduced = Math.min(alpha + 0.3, 1);

  const { h, s, l } = hsl(themeColor);
  optionInput("themeColor").value = themeColor;
  optionInput("themeHue").value = String(h);

  const variables: [name: string, value: string][] = [
    ["--bg-opacity", String(alpha)],
    ["--bg-main", hsl(h, s, l, alpha).toString()],
    ["--bg-lighter", hsl(h, s, l + 0.02, alpha).toString()],
    ["--bg-light", hsl(h, s - 0.02, l + 0.06, alpha).toString()],
    ["--light-solid", hsl(h, s + 0.01, l + 0.05, 1).toString()],
    ["--dark-solid", hsl(h, s, l - 0.2, 1).toString()],
    ["--header", hsl(h, s, l - 0.03, alphaReduced).toString()],
    ["--header-active", hsl(h, s, l - 0.09, alphaReduced).toString()],
    ["--bg-disabled", hsl(h, s - 0.04, l + 0.09).toString()],
    ["--bg-dialogs", hsl(0, 0, 0.98, alpha).toString()]
  ];
  for (const [name, value] of variables) document.documentElement.style.setProperty(name, value);
}

function changeZoomExtent(value: string): void {
  const minInput = optionInput("zoomExtentMin");
  const maxInput = optionInput("zoomExtentMax");
  if (+minInput.value > +maxInput.value) [minInput.value, maxInput.value] = [maxInput.value, minInput.value];

  setZoomExtentPreference(Math.max(+minInput.value, 0.01), Math.min(+maxInput.value, 200));
  setMapZoom(minmax(+value, 0.01, 200));
}

/**
 * The window onto the map, not the map. It is free of the extent the graph was built on: a viewport
 * larger than the extent scales the map up to cover it. See docs/architecture/configuration.md
 */
function changeViewportSize(): void {
  const width = +optionInput("viewportWidth").value;
  const height = +optionInput("viewportHeight").value;
  if (!(width > 0) || !(height > 0)) return;

  setViewport(width, height);
  Options.set(o => (o.app.viewport = { width: viewport.width, height: viewport.height }));
}

/** Back to following the browser window, which is what the viewport does until it is set by hand */
function fitViewportToWindow(): void {
  Options.set(o => (o.app.viewport = null));
  fitMapToScreen();
}

/** The default is the fitted view: the ceiling is the app's, the floor is the map's and the window's */
function restoreDefaultZoomExtent(): void {
  Options.set(o => (o.app.zoomExtent.max = Options.getDefaultOptions().app.zoomExtent.max));
  optionInput("zoomExtentMax").value = String(options.app.zoomExtent.max);
  applyZoomExtent();
  setMapZoom(options.app.zoomExtent.min);
}

/** The single writer of the zoom extent: one pair, normalised together and shown together */
function setZoomExtentPreference(min: number, max: number): void {
  Options.set(o => (o.app.zoomExtent = { min, max }));
  optionInput("zoomExtentMin").value = String(min);
  optionInput("zoomExtentMax").value = String(max);
  setZoomExtent(min, max); // a hand-set floor stands until the next fit re-derives it
  constrainZoom();
}

/** Let the user pan beyond the canvas edges, so a map can be inspected off-centre */
function toggleTranslateExtent(el: HTMLElement): void {
  const isOn = !+(el.dataset.on ?? 0);
  el.dataset.on = String(+isOn);

  const { width, height } = options.map.graph;
  if (isOn) setTranslateExtent(-width / 2, -height / 2, width * 1.5, height * 1.5);
  else setTranslateExtent(0, 0, width, height);
}

/** Voices arrive asynchronously and some browsers report none at all, so poll briefly then give up */
function loadVoices(): void {
  let attempts = 0;
  const select = optionInput<HTMLSelectElement>("speakerVoice");

  const interval = setInterval(() => {
    const voices = speechSynthesis.getVoices();

    if (!voices.length) {
      if (++attempts < 10) return;
      clearInterval(interval);
      if (!select.options.length) select.options.add(new Option(t("No voices available"), ""));
      return;
    }

    clearInterval(interval);
    for (const [index, voice] of voices.entries()) select.options.add(new Option(voice.name, String(index)));
    select.value = options.app.ui.speakerVoice || String(voices.findIndex(voice => voice.lang === "en-US"));
  }, 1000);
}

function testSpeaker(): void {
  const speech = new SpeechSynthesisUtterance(t("The quick brown fox jumps over the lazy dog"));
  const voices = speechSynthesis.getVoices();
  if (voices.length) speech.voice = voices[Number(options.app.ui.speakerVoice)] ?? speech.voice;
  speechSynthesis.speak(speech);
}

/** Store the interface language and offer the reload that applies it */
function changeLanguage(select: HTMLSelectElement): void {
  const code = select.value;
  if (!isLanguage(code)) return;
  Options.set(o => (o.app.language = code));
  Options.persist();
  if (code === Catalog.language) return;

  confirmationDialog({
    title: t("Change language"),
    message: sentences(
      t("The interface switches to {{language}} after a reload", { language: LANGUAGES[code] }),
      t("If you have unsaved changes, save the map first")
    ),
    confirm: t("Reload"),
    cancel: t("Not now"),
    onConfirm: () => {
      window.onbeforeunload = null; // the user just confirmed the reload, don't ask again
      location.reload();
    }
  });
}

/**
 * Restore what the tab itself shows: the lock icons, the saved style presets and the interface
 * settings. The values themselves are restored by `Options.restore` before this runs
 */
const defaultUiSize = (): number => minmax(rn(window.innerWidth / 1280, 1), 1, maxUiSize());

export function restoreUi(): void {
  const template = options.generation.template;
  if (template) {
    const name = heightmapTemplates[template]?.name || precreatedHeightmaps[template]?.name || template;
    applyOption(optionInput("template"), template, name);
  }

  Pins.bindIcons(ensureEl("options"), currentValue);
  Pins.bindIcons(ensureEl(ADVANCED_OPTIONS_ID), currentValue);

  // `syncInputs` has already put every preference in its control; these are the ones that also do
  // something the moment they are read back. See docs/architecture/configuration.md
  const { ui, emblems } = options.app;

  Emblems.setShape(emblems.shape);
  changeTooltipSize(ui.tooltipSize);

  optionInput("uiSize").max = String(maxUiSize());
  changeUiSize(ui.size ?? defaultUiSize());

  changeDialogsTheme(ui.themeColor, ui.transparency);
  applyPerformanceSettings();
  applyZoomExtent();
}
