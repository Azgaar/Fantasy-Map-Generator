import { hsl } from "d3";
import { toggleAssistant } from "@/components/assistant-bubble";
import { applyZoomExtent, fitMapToScreen, setViewport } from "@/components/canvas";
import { confirmationDialog } from "@/components/dialog/dialog-helpers";
import { DEFAULT_THEME_COLOR } from "@/components/options-model";
import type { OptionsData } from "@/components/options-schema";
import {
  applyPerformancePreset,
  applyPerformanceSettings,
  onPerformanceChange,
  resolvePerformancePreset
} from "@/components/performance";
import { Pins } from "@/components/pins";
import { generateMapWithSeed, showSeedHistoryDialog } from "@/components/seed";
import { tip } from "@/components/tooltips";
import { viewport } from "@/components/viewport";
import { constrainZoom, setMapZoom, setTranslateExtent, setZoomExtent } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { getPointsNumber } from "@/data/graph-density";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { isLanguage, LANGUAGES } from "@/data/languages";
import { precreatedHeightmaps } from "@/data/precreated-heightmaps";
import { isAutoBurgLimit } from "@/generators/burgs-generator";
import { CULTURE_SETS, Cultures } from "@/generators/cultures-generator";
import { Emblems } from "@/generators/emblems-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { copyMapURL } from "@/services/url-params";
import { Catalog, sentences, t } from "@/utils/i18n";
import { applyOption, ensureEl, findEl } from "@/utils/nodeUtils";
import { minmax, rn } from "@/utils/numberUtils";
import { PerformanceSettings } from "../performance-settings";

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
    effect: () => customization === 1 && Controllers.HeightmapEditor.redrawDrainage() // the heightmap editor's overlay
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

const TEMPLATE = /* html */ `
  <p data-tip="${t("Settings for the next map. Generate a new map to apply them")}">
    ${t("Map settings (apply to new maps)")}:
  </p>
  <table>
    <tr
      data-tip="${t("Coordinate extent the next map is generated on. It is fixed for the life of that map and cannot be changed later - the Viewport size below is what you see it through. For full-globe maps use aspect ratio 2:1")}"
    >
      <td>
        <i data-tip="${t("Restore default map size: the window size")}" id="restoreDefaultMapSize" class="icon-ccw"></i>
      </td>
      <td>${t("Map size")}</td>
      <td>
        <input id="mapWidthInput" data-option="mapWidth" class="paired" type="number" min="240" value="960" />
        <span>x</span>
        <input id="mapHeightInput" data-option="mapHeight" class="paired" type="number" min="135" value="540" />
        <span>px</span>
      </td>
      <td></td>
    </tr>
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
    <tr
      data-tip="${t("Set what share of eligible burgs in each state will become province centers. Higher values create more provinces")}"
    >
      <td>
        <i data-locked="0" id="lock_provincesRatio" class="icon-lock-open"></i>
      </td>
      <td>${t("Provinces ratio")}</td>
      <td colspan="2">
        <slider-input id="provincesRatio" data-option="provincesRatio" min="0" max="100"></slider-input>
      </td>
    </tr>
    <tr data-tip="${t("Define how much states and cultures can vary in size. Defines expansionism value")}">
      <td>
        <i data-locked="0" id="lock_sizeVariety" class="icon-lock-open"></i>
      </td>
      <td>${t("Size variety")}</td>
      <td colspan="2">
        <slider-input id="sizeVariety" data-option="sizeVariety" min="0" max="10" step=".1"></slider-input>
      </td>
    </tr>
    <tr data-tip="${t("Set the growth rate of states and cultures. Determines how much land stays neutral")}">
      <td>
        <i data-locked="0" id="lock_growthRate" class="icon-lock-open"></i>
      </td>
      <td>${t("Growth rate")}</td>
      <td colspan="2">
        <slider-input id="growthRate" data-option="growthRate" min=".1" max="2" step=".1"></slider-input>
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
        <i data-tip="${t("Restore default theme color: pale magenta")}" id="themeColorRestore" class="icon-ccw"></i>
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
    <tr data-tip="${t("Set autosave interval in minutes. Set 0 to disable autosave. Map is saved to browser memory")}">
      <td></td>
      <td>${t("Autosave interval")}</td>
      <td>
        <input
          id="autosaveIntervalInput"
          data-option="autosaveInterval"
          type="range"
          min="0"
          max="60"
          step="1"
          value="15"
        />
      </td>
      <td>
        <input
          id="autosaveIntervalOutput"
          data-option="autosaveInterval"
          type="number"
          min="0"
          max="60"
          step="1"
          value="15"
        />
      </td>
    </tr>
    <tr data-tip="${t("Set what Generator should do on load")}">
      <td></td>
      <td>${t("On load")}</td>
      <td>
        <select id="onloadBehavior" data-option="onloadBehavior">
          <option value="random" selected>${t("Generate random map")}</option>
          <option value="lastSaved">${t("Open last saved map")}</option>
        </select>
      </td>
      <td></td>
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
    <tr data-tip="${t("Select speech synthesis voice to pronounce generated names")}">
      <td></td>
      <td>${t("Speaker voice")}</td>
      <td>
        <select id="speakerVoice" data-option="speakerVoice"></select>
      </td>
      <td>
        <span id="speakerTest" data-tip="${t("Click to test the voice")}" style="cursor: pointer">🔊</span>
      </td>
    </tr>
    <tr data-tip="${t("Select emblem shape. Can be changed individually in the Emblem Editor")}">
      <td></td>
      <!-- no lock: the shape is an interface preference, kept by this browser whatever map is on screen -->
      <td>${t("Emblem shape")}</td>
      <td>
        <select id="emblemShape" data-option="emblemShape">
          <optgroup label="${t("Diversiform")}">
            <option value="culture" selected>${t("Culture-specific")}</option>
            <option value="random">${t("Culture-random")}</option>
            <option value="state">${t("State-specific")}</option>
          </optgroup>
          <optgroup label="${t("Basic")}">
            <option value="heater">${t("Heater")}</option>
            <option value="spanish">${t("Spanish")}</option>
            <option value="french">${t("French")}</option>
          </optgroup>
          <optgroup label="${t("Regional")}">
            <option value="horsehead">${t("Horsehead")}</option>
            <option value="horsehead2">${t("Horsehead Edgy")}</option>
            <option value="polish">${t("Polish")}</option>
            <option value="hessen">${t("Hessen")}</option>
            <option value="swiss">${t("Swiss")}</option>
          </optgroup>
          <optgroup label="${t("Historical")}">
            <option value="boeotian">${t("Boeotian")}</option>
            <option value="roman">${t("Roman")}</option>
            <option value="kite">${t("Kite")}</option>
            <option value="oldFrench">${t("Old French")}</option>
            <option value="renaissance">${t("Renaissance")}</option>
            <option value="baroque">${t("Baroque")}</option>
          </optgroup>
          <optgroup label="${t("Specific")}">
            <option value="targe">${t("Targe")}</option>
            <option value="targe2">${t("Targe2")}</option>
            <option value="pavise">${t("Pavise")}</option>
            <option value="wedged">${t("Wedged")}</option>
            <option value="embowed">${t("Embowed")}</option>
          </optgroup>
          <optgroup label="${t("Banner")}">
            <option value="flag">${t("Flag")}</option>
            <option value="pennon">${t("Pennon")}</option>
            <option value="guidon">${t("Guidon")}</option>
            <option value="banner">${t("Banner")}</option>
            <option value="dovetail">${t("Dovetail")}</option>
            <option value="gonfalon">${t("Gonfalon")}</option>
            <option value="pennant">${t("Pennant")}</option>
          </optgroup>
          <optgroup label="${t("Simple")}">
            <option value="round">${t("Round")}</option>
            <option value="oval">${t("Oval")}</option>
            <option value="vesicaPiscis">${t("Vesica Piscis")}</option>
            <option value="square">${t("Square")}</option>
            <option value="diamond">${t("Diamond")}</option>
            <option value="hexagon">${t("Hexagon")}</option>
          </optgroup>
          <optgroup label="${t("Fantasy")}">
            <option value="fantasy1">${t("Fantasy1")}</option>
            <option value="fantasy2">${t("Fantasy2")}</option>
            <option value="fantasy3">${t("Fantasy3")}</option>
            <option value="fantasy4">${t("Fantasy4")}</option>
            <option value="fantasy5">${t("Fantasy5")}</option>
          </optgroup>
          <optgroup label="${t("Middle Earth")}">
            <option value="noldor">${t("Noldor")}</option>
            <option value="gondor">${t("Gondor")}</option>
            <option value="easterling">${t("Easterling")}</option>
            <option value="erebor">${t("Erebor")}</option>
            <option value="ironHills">${t("Iron Hills")}</option>
            <option value="urukHai">${t("UrukHai")}</option>
            <option value="moriaOrc">${t("Moria Orc")}</option>
          </optgroup>
        </select>
      </td>
      <td>
        <svg class="emblemShapePreview" viewBox="0 0 200 210"><path id="emblemShapeImage" /></svg>
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
        <i data-tip="${t("Restore the default zoom extent")}" id="zoomExtentDefault" class="icon-ccw"></i>
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
    <tr data-tip="${t("Select the interface language. It applies after a reload")}">
      <td></td>
      <td>${t("Language")}</td>
      <td>
        <select id="interfaceLanguage">
          ${Object.entries(LANGUAGES)
            .map(
              ([code, name]) =>
                `<option value="${code}" ${code === Catalog.language ? "selected" : ""}>${name}</option>`
            )
            .join("")}
        </select>
      </td>
      <td></td>
    </tr>
    <tr
      data-tip="${t("Load Google Translate for a language not listed above. Automatic translation can break some page functions. If this happens, reset the translation or refresh the page")}"
    >
      <td>
        <i data-tip="${t("Reset the automatic translation")}" id="resetLanguage" class="icon-ccw"></i>
      </td>
      <td>${t("Other languages")}</td>
      <td>
        <button id="loadGoogleTranslateButton">${t("Load Google Translate")}</button>
        <div id="google_translate_element"></div>
      </td>
      <td></td>
    </tr>
  </table>
  <div>
    <button
      id="configureWorld"
      data-tip="${t("Open the World Configurator to set the map position on the globe and the world climate")}"
      onclick="window.Controllers.WorldConfigurator.open()"
    >
      ${t("Configure World")}
    </button>
    <button
      id="setupLore"
      data-tip="${t("Click to name the map, date its calendar and describe the world")}"
      onclick="window.Controllers.LoreEditor.open()"
    >
      ${t("Set Lore")}
    </button>
    <button
      id="optionsReset"
      data-tip="${t("Click to restore default options and reload the page")}"
      onclick="cleanupData()"
    >
      ${t("Reset Options")}
    </button>
  </div>
`;

const pendingInputs = new WeakMap<HTMLElement, string>();

ensureEl("optionsContent").innerHTML = TEMPLATE;
addListeners();
loadVoices();
onPerformanceChange(() => syncOption("performancePreset")); // the preset follows the fields, wherever they change

function addListeners(): void {
  const content = ensureEl("optionsContent");

  const root = ensureEl("options");
  root.addEventListener("input", onOptionInput);
  root.addEventListener("change", onOptionInput);
  ensureEl("interfaceLanguage").addEventListener("change", event => changeLanguage(event.target as HTMLSelectElement));

  content.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    if (target.id === "restoreDefaultMapSize") restoreDefaultMapSize();
    else if (target.id === "optionsMapHistory") showSeedHistoryDialog();
    else if (target.id === "optionsCopySeed") copyMapURL();
    else if (target.id === "templateInputContainer") Controllers.HeightmapSelection.open();
    else if (target.id === "viewportFit") fitViewportToWindow();
    else if (target.id === "zoomExtentDefault") restoreDefaultZoomExtent();
    else if (target.id === "translateExtent") toggleTranslateExtent(target);
    else if (target.id === "openPerformanceSettings") PerformanceSettings.open();
    else if (target.id === "speakerTest") testSpeaker();
    else if (target.id === "themeColorRestore") restoreDefaultThemeColor();
    else if (target.id === "loadGoogleTranslateButton") loadGoogleTranslate();
    else if (target.id === "resetLanguage") resetLanguage();
  });
}

function optionInputs<T extends HTMLElement = HTMLInputElement>(key: string): NodeListOf<T> {
  return ensureEl("options").querySelectorAll<T>(`[data-option="${key}"]`);
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

function loadGoogleTranslate(): void {
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=initGoogleTranslate";
  script.onload = () => {
    findEl("loadGoogleTranslateButton")?.remove();

    // replace the mapLayers hotkey underlines with bare text, they confuse the translator
    for (const item of ensureEl("mapLayers").querySelectorAll("li")) {
      item.innerHTML = item.innerHTML.replace(/<u>(.+)<\/u>/g, "$1");
    }
  };
  document.head.append(script);
}

function resetLanguage(): void {
  const select = document.querySelector<HTMLSelectElement & { handleChange: (e: Event) => void }>(
    "#google_translate_element select"
  );
  if (!select?.value) return;

  // twice: the first change only arms the widget, the second actually resets it
  for (let i = 0; i < 2; i++) {
    select.value = "en";
    select.handleChange(new Event("change"));
  }
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

// Legacy seam: the submap and transform tools set the cell density, and Google's script calls
// back into the page by name
declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var changeCellsDensity: (density: number) => void;
  var initGoogleTranslate: () => void;
  var google: {
    translate: {
      TranslateElement: {
        new (config: { pageLanguage: string; layout: unknown }, elementId: string): unknown;
        InlineLayout: { VERTICAL: unknown };
      };
    };
  };
}

window.changeCellsDensity = changeCellsDensity;
window.initGoogleTranslate = () => {
  new google.translate.TranslateElement(
    { pageLanguage: "en", layout: google.translate.TranslateElement.InlineLayout.VERTICAL },
    "google_translate_element"
  );
};
