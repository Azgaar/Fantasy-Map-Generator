import { hsl, select } from "d3";
import type { FactsData } from "@/components/facts-schema";
import { Layers } from "@/components/layers";
import { getDefaultOptions, type OptionsData, THEME_COLOR } from "@/components/options-schema";
import { PINNABLE } from "@/components/pinnable";
import { generateMapWithSeed, showSeedHistoryDialog } from "@/components/seed";
import { tip } from "@/components/tooltips";
import { setMapZoom, setTranslateExtent, setZoomExtent } from "@/components/zoom";
import { Controllers } from "@/controllers";
import { heightmapTemplates } from "@/data/heightmap-templates";
import { precreatedHeightmaps } from "@/data/precreated-heightmaps";
import { CULTURE_SETS, Cultures } from "@/generators/cultures-generator";
import { Emblems } from "@/generators/emblems-generator";
import { Names } from "@/generators/names-generator";
import { EmblemRenderer } from "@/renderers/emblems/renderer";
import { toggleAssistant } from "@/services/assistant";
import { copyMapURL } from "@/services/url-params";
import { applyOption, ensureEl, findEl } from "@/utils/nodeUtils";
import { minmax, rn } from "@/utils/numberUtils";
import { bindLockIcons, lock, unlock } from "@/utils/preferences";

const TEMPLATE = /* html */ `
  <p data-tip="Map generation settings. Generate a new map to apply the settings">
    Map settings (new map to apply):
  </p>
  <table>
    <tr
      data-tip="Set original map size on generation. It cannot be changed later. Always keep canvas size equal to your screen size or less. The best option is to use the default value. For full-globe maps use aspect ratio 2:1"
    >
      <td>
        <i data-tip="Restore default canvas size" id="restoreDefaultCanvasSize" class="icon-ccw"></i>
      </td>
      <td>Canvas size</td>
      <td>
        <input id="mapWidthInput" class="paired" type="number" min="240" value="960" />
        <span>x</span>
        <input id="mapHeightInput" class="paired" type="number" min="135" value="540" />
        <span>px</span>
      </td>
      <td></td>
    </tr>
    <tr
      data-tip="Map seed number. Press 'Enter' to apply. Seed produces the same map only if canvas size and options are the same"
    >
      <td>
        <i
          data-tip="Show seed history to apply a previous seed"
          id="optionsMapHistory"
          class="icon-hourglass-1"
        ></i>
      </td>
      <td>Map seed</td>
      <td>
        <input id="seedInput" class="long" type="number" min="1" max="999999999" step="1" />
      </td>
      <td>
        <i
          data-tip="Copy map seed as URL. It will produce the same map only if options are default or the same"
          id="optionsCopySeed"
          class="icon-docs"
        ></i>
      </td>
    </tr>
    <tr
      data-tip="Set number of points to be used for graph generation. Highly affects performance. 10K is the only recommended value"
    >
      <td>
        <i data-locked="0" id="lock_points" class="icon-lock-open"></i>
      </td>
      <td>Points number</td>
      <td>
        <input
          id="pointsInput"
          data-stored="points"
          type="range"
          min="1"
          max="13"
          value="4"
          data-cells="10000"
        />
      </td>
      <td>
        <output id="pointsOutputFormatted" style="color: #053305">10K</output>
      </td>
    </tr>
    <tr data-tip="Define map name (will be used to name downloaded files)">
      <td>
        <i data-locked="0" id="lock_mapName" class="icon-lock-open"></i>
      </td>
      <td>Map name</td>
      <td>
        <input
          id="mapName"
          data-stored="mapName"
          class="long"
          autocorrect="off"
          spellcheck="false"
          type="text"
        />
      </td>
      <td>
        <i data-tip="Regenerate map name" id="optionsMapNameRegenerate" class="icon-arrows-cw"></i>
      </td>
    </tr>
    <tr data-tip="Define current year and era name">
      <td>
        <i data-locked="0" id="lock_year" data-ids="year,era" class="icon-lock-open"></i>
      </td>
      <td>Year and era</td>
      <td>
        <input
          id="yearInput"
          data-stored="year"
          type="number"
          step="1"
          class="paired"
          style="width: 24%; float: left; font-size: smaller"
        />
        <input
          id="eraInput"
          data-stored="era"
          autocorrect="off"
          spellcheck="false"
          type="text"
          style="width: 75%; float: right"
          class="long"
        />
      </td>
      <td>
        <i id="optionsEraRegenerate" data-tip="Regenerate era" class="icon-arrows-cw"></i>
      </td>
    </tr>
    <tr data-tip="Select template or precreated heightmap to be used on generation">
      <td>
        <i data-locked="0" id="lock_template" class="icon-lock-open"></i>
      </td>
      <td>Heightmap</td>
      <td id="templateInputContainer" class="pointer">
        <select id="templateInput" data-stored="template" style="pointer-events: none"></select>
      </td>
      <td></td>
    </tr>
    <tr data-tip="Define how many Cultures should be generated">
      <td>
        <i data-locked="0" id="lock_cultures" class="icon-lock-open"></i>
      </td>
      <td>Cultures number</td>
      <td>
        <input id="culturesInput" data-stored="cultures" type="range" min="1" />
      </td>
      <td>
        <input id="culturesOutput" data-stored="cultures" type="number" min="1" />
      </td>
    </tr>
    <tr data-tip="Select a set of cultures to be used for names and cultures generation">
      <td>
        <i data-locked="0" id="lock_culturesSet" class="icon-lock-open"></i>
      </td>
      <td>Cultures set</td>
      <td>
        <select id="culturesSet" data-stored="culturesSet">
          <option value="world" data-max="32" selected>All-world</option>
          <option value="european" data-max="15">European</option>
          <option value="oriental" data-max="13">Oriental</option>
          <option value="english" data-max="10">English</option>
          <option value="antique" data-max="10">Antique</option>
          <option value="highFantasy" data-max="17">High Fantasy</option>
          <option value="darkFantasy" data-max="18">Dark Fantasy</option>
          <option value="random" data-max="100">Random</option>
        </select>
      </td>
      <td></td>
    </tr>
    <tr data-tip="Define how many states and capitals should be generated">
      <td>
        <i data-locked="0" id="lock_statesNumber" class="icon-lock-open"></i>
      </td>
      <td>States number</td>
      <td colspan="2">
        <slider-input id="statesNumber" data-stored="statesNumber" min="0" max="100"></slider-input>
      </td>
    </tr>
    <tr
      data-tip="Set what share of eligible burgs in each state will become province centers. Higher values create more provinces"
    >
      <td>
        <i data-locked="0" id="lock_provincesRatio" class="icon-lock-open"></i>
      </td>
      <td>Provinces ratio</td>
      <td colspan="2">
        <slider-input id="provincesRatio" data-stored="provincesRatio" min="0" max="100"></slider-input>
      </td>
    </tr>
    <tr data-tip="Define how much states and cultures can vary in size. Defines expansionism value">
      <td>
        <i data-locked="0" id="lock_sizeVariety" class="icon-lock-open"></i>
      </td>
      <td>Size variety</td>
      <td colspan="2">
        <slider-input id="sizeVariety" data-stored="sizeVariety" min="0" max="10" step=".1"></slider-input>
      </td>
    </tr>
    <tr data-tip="Set state and cultures growth rate. Defines how many lands will stay neutral">
      <td>
        <i data-locked="0" id="lock_growthRate" class="icon-lock-open"></i>
      </td>
      <td>Growth rate</td>
      <td colspan="2">
        <slider-input id="growthRate" data-stored="growthRate" min=".1" max="2" step=".1"></slider-input>
      </td>
    </tr>
    <tr data-tip="Define a number of non-capital settlements to be placed (if enough suitable land exists)">
      <td>
        <i data-locked="0" id="lock_manors" class="icon-lock-open"></i>
      </td>
      <td>Burgs number</td>
      <td>
        <input id="manorsInput" data-stored="manors" type="range" min="0" max="1000" step="1" value="1000" />
      </td>
      <td>
        <output id="manorsOutput" data-stored="manors" value="auto"></output>
      </td>
    </tr>
    <tr
      data-tip="Define how many organized religions and cults should be generated. Cultures will have their own folk religions in any case"
    >
      <td>
        <i data-locked="0" id="lock_religionsNumber" class="icon-lock-open"></i>
      </td>
      <td>Religions number</td>
      <td colspan="2">
        <slider-input
          id="religionsNumber"
          data-stored="religionsNumber"
          min="0"
          max="50"
          step="1"
        ></slider-input>
      </td>
    </tr>
  </table>
  <p data-tip="Tool settings that don't affect maps. Changes are getting applied immediately">
    Generator settings:
  </p>
  <table>
    <tr
      data-tip="Set user interface size. Please note browser zoom also affects interface size (Ctrl + or Ctrl - to change)"
    >
      <td></td>
      <td>Interface size</td>
      <td colspan="2">
        <slider-input id="uiSize" data-stored="uiSize" min=".6" max="3" step=".1"></slider-input>
      </td>
    </tr>
    <tr data-tip="Set tooltip size">
      <td></td>
      <td>Tooltip size</td>
      <td colspan="2">
        <slider-input id="tooltipSize" data-stored="tooltipSize" min="1" max="32" value="14"></slider-input>
      </td>
    </tr>
    <tr data-tip="Set theme hue for dialogs and tool windows">
      <td>
        <i data-tip="Restore default theme color: pale magenta" id="themeColorRestore" class="icon-ccw"></i>
      </td>
      <td>Theme color</td>
      <td>
        <input id="themeHueInput" type="range" min="0" max="359" />
      </td>
      <td>
        <input id="themeColorInput" type="color" />
      </td>
    </tr>
    <tr data-tip="Set dialog and tool windows transparency">
      <td></td>
      <td>Transparency</td>
      <td colspan="2">
        <slider-input id="transparencyInput" min="0" max="100"></slider-input>
      </td>
    </tr>
    <tr data-tip="Set autosave interval in minutes. Set 0 to disable autosave. Map is saved to browser memory">
      <td></td>
      <td>Autosave interval</td>
      <td>
        <input
          id="autosaveIntervalInput"
          data-stored="autosaveInterval"
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
          data-stored="autosaveInterval"
          type="number"
          min="0"
          max="60"
          step="1"
          value="15"
        />
      </td>
    </tr>
    <tr data-tip="Set what Generator should do on load">
      <td></td>
      <td>Onload behavior</td>
      <td>
        <select id="onloadBehavior" data-stored="onloadBehavior">
          <option value="random" selected>Generate random map</option>
          <option value="lastSaved">Open last saved map</option>
        </select>
      </td>
      <td></td>
    </tr>
    <tr data-tip="Toggle Azgaar Assistant (help bubble on the bottom right corner)">
      <td></td>
      <td>Azgaar assistant</td>
      <td>
        <select id="azgaarAssistant" data-stored="azgaarAssistant">
          <option value="show" selected>Show</option>
          <option value="hide">Hide</option>
        </select>
      </td>
    </tr>
    <tr data-tip="Select speech synthesis voice to pronounce generated names">
      <td></td>
      <td>Speaker voice</td>
      <td>
        <select id="speakerVoice" data-stored="speakerVoice"></select>
      </td>
      <td>
        <span id="speakerTest" data-tip="Click to test the voice" style="cursor: pointer">🔊</span>
      </td>
    </tr>
    <tr data-tip="Select emblem shape. Can be changed indivudually in Emblem editor">
      <td></td>
      <!-- no lock: the shape is an interface preference, kept by this browser whatever map is on screen -->
      <td>Emblem shape</td>
      <td>
        <select id="emblemShape" data-stored="emblemShape">
          <optgroup label="Diversiform">
            <option value="culture" selected>Culture-specific</option>
            <option value="random">Culture-random</option>
            <option value="state">State-specific</option>
          </optgroup>
          <optgroup label="Basic">
            <option value="heater">Heater</option>
            <option value="spanish">Spanish</option>
            <option value="french">French</option>
          </optgroup>
          <optgroup label="Regional">
            <option value="horsehead">Horsehead</option>
            <option value="horsehead2">Horsehead Edgy</option>
            <option value="polish">Polish</option>
            <option value="hessen">Hessen</option>
            <option value="swiss">Swiss</option>
          </optgroup>
          <optgroup label="Historical">
            <option value="boeotian">Boeotian</option>
            <option value="roman">Roman</option>
            <option value="kite">Kite</option>
            <option value="oldFrench">Old French</option>
            <option value="renaissance">Renaissance</option>
            <option value="baroque">Baroque</option>
          </optgroup>
          <optgroup label="Specific">
            <option value="targe">Targe</option>
            <option value="targe2">Targe2</option>
            <option value="pavise">Pavise</option>
            <option value="wedged">Wedged</option>
          </optgroup>
          <optgroup label="Banner">
            <option value="flag">Flag</option>
            <option value="pennon">Pennon</option>
            <option value="guidon">Guidon</option>
            <option value="banner">Banner</option>
            <option value="dovetail">Dovetail</option>
            <option value="gonfalon">Gonfalon</option>
            <option value="pennant">Pennant</option>
          </optgroup>
          <optgroup label="Simple">
            <option value="round">Round</option>
            <option value="oval">Oval</option>
            <option value="vesicaPiscis">Vesica Piscis</option>
            <option value="square">Square</option>
            <option value="diamond">Diamond</option>
          </optgroup>
          <optgroup label="Fantasy">
            <option value="fantasy1">Fantasy1</option>
            <option value="fantasy2">Fantasy2</option>
            <option value="fantasy3">Fantasy3</option>
            <option value="fantasy4">Fantasy4</option>
            <option value="fantasy5">Fantasy5</option>
          </optgroup>
          <optgroup label="Middle Earth">
            <option value="noldor">Noldor</option>
            <option value="gondor">Gondor</option>
            <option value="easterling">Easterling</option>
            <option value="erebor">Erebor</option>
            <option value="ironHills">Iron Hills</option>
            <option value="urukHai">UrukHai</option>
            <option value="moriaOrc">Moria Orc</option>
          </optgroup>
        </select>
      </td>
      <td>
        <svg class="emblemShapePreview" viewBox="0 0 200 210"><path id="emblemShapeImage" /></svg>
      </td>
    </tr>
    <tr data-tip="Set minimum and maximum possible zoom level">
      <td>
        <i data-tip="Restore default zoom extent: [1, 20]" id="zoomExtentDefault" class="icon-ccw"></i>
      </td>
      <td>Zoom extent</td>
      <td>
        <span data-tip="Mimimal possible zoom level (should be > 0)">min</span>
        <input
          data-tip="Mimimal possible zoom level (should be > 0)"
          id="zoomExtentMin"
          class="paired"
          type="number"
          min=".2"
          step=".1"
          max="20"
          value="1"
        />
        <span data-tip="Maximal possible zoom level (should be > 1)">max</span>
        <input
          data-tip="Maximal possible zoom level (should be > 1)"
          id="zoomExtentMax"
          class="paired"
          type="number"
          min="1"
          max="50"
          value="20"
        />
      </td>
      <td>
        <i
          data-tip="Allow to drag map beyond canvas borders"
          id="translateExtent"
          data-on="0"
          class="icon-hand-paper-o"
        ></i>
      </td>
    </tr>
    <tr data-tip="Select rendering model. Try to set to 'optimized' if you face performance issues">
      <td></td>
      <td>Rendering</td>
      <td>
        <select id="shapeRendering" data-stored="shapeRendering">
          <option value="geometricPrecision">Best quality</option>
          <option value="optimizeSpeed" selected>Best performance</option>
        </select>
      </td>
      <td></td>
    </tr>
    <tr
      data-tip="Load Google Translate and select language. Note that automatic translation can break some page functional. In this case reset the language back to English or refresh the page"
    >
      <td>
        <i data-tip="Reset language to English" id="resetLanguage" class="icon-ccw"></i>
      </td>
      <td>Language</td>
      <td>
        <button id="loadGoogleTranslateButton">Init Google Translate</button>
        <div id="google_translate_element"></div>
      </td>
      <td></td>
    </tr>
  </table>
  <div>
    <button
      id="configureWorld"
      data-tip="Click to open world configurator to setup map position on Globe and World climate"
      onclick="window.Controllers.WorldConfigurator.open()"
    >
      Configure World
    </button>
    <button
      id="optionsReset"
      data-tip="Click to restore default options and reload the page"
      onclick="cleanupData()"
    >
      Reset to defaults
    </button>
  </div>
`;

type Setting<T> = {
  key: string; // the id the input carries in `data-stored`, and the key its lock is kept under
  get: (source: T) => string | number | null; // null: nothing chosen yet, the control keeps its own value
  set?: (target: T, value: string) => void; // absent when the row is a readout with its own action
};

/**
 * Requests: what the next map will be generated with. Editing one changes nothing on screen -
 * the tab says so in its own heading. See docs/architecture/configuration.md
 */
const REQUEST_SETTINGS: Setting<OptionsData>[] = [
  { key: "mapWidth", get: o => o.nextMap.width, set: (o, v) => (o.nextMap.width = +v) },
  { key: "mapHeight", get: o => o.nextMap.height, set: (o, v) => (o.nextMap.height = +v) },
  { key: "template", get: o => o.generation.template, set: (o, v) => (o.generation.template = v) },
  {
    key: "resolveDepressionsSteps",
    get: o => o.generation.resolveDepressionsSteps,
    set: (o, v) => (o.generation.resolveDepressionsSteps = +v)
  },
  {
    key: "lakeElevationLimit",
    get: o => o.generation.lakeElevationLimit,
    set: (o, v) => (o.generation.lakeElevationLimit = +v)
  },
  { key: "cultures", get: o => o.generation.cultures.limit, set: (o, v) => (o.generation.cultures.limit = +v) },
  { key: "culturesSet", get: o => o.generation.cultures.set, set: (o, v) => (o.generation.cultures.set = v) },
  { key: "statesNumber", get: o => o.generation.states.limit, set: (o, v) => (o.generation.states.limit = +v) },
  {
    key: "growthRate",
    get: o => o.generation.states.growthRate,
    set: (o, v) => {
      o.generation.states.growthRate = +v;
      o.generation.cultures.growthRate = +v;
    }
  },
  { key: "sizeVariety", get: o => o.generation.states.sizeVariety, set: (_o, v) => Options.setSizeVariety(+v) },
  { key: "provincesRatio", get: o => o.generation.provinces.ratio, set: (o, v) => (o.generation.provinces.ratio = +v) },
  { key: "manors", get: o => o.generation.burgs.limit, set: (o, v) => (o.generation.burgs.limit = +v) },
  { key: "religionsNumber", get: o => o.generation.religions.limit, set: (o, v) => (o.generation.religions.limit = +v) }
];

/**
 * Preferences: what this browser wants, whatever map is on screen. They take effect the moment
 * they change, nothing generated depends on them, and no lock pins them - there is nothing to pin
 * a value against when it is never re-rolled. A row with no `set` is written by the dialog that
 * owns the control; the table still gives the panel a way to show it
 */
const PREFERENCE_SETTINGS: Setting<OptionsData>[] = [
  { key: "uiSize", get: o => o.view.ui.size, set: (o, v) => (o.view.ui.size = +v) },
  { key: "tooltipSize", get: o => o.view.ui.tooltipSize, set: (o, v) => (o.view.ui.tooltipSize = +v) },
  { key: "azgaarAssistant", get: o => o.view.ui.assistant, set: (o, v) => (o.view.ui.assistant = v) },
  { key: "speakerVoice", get: o => o.view.ui.speakerVoice, set: (o, v) => (o.view.ui.speakerVoice = v) },
  { key: "emblemShape", get: o => o.view.emblemShape, set: (o, v) => (o.view.emblemShape = v) },
  { key: "shapeRendering", get: o => o.view.rendering, set: (o, v) => (o.view.rendering = v) },
  { key: "onloadBehavior", get: o => o.view.onLoad, set: (o, v) => (o.view.onLoad = v) },
  { key: "autosaveInterval", get: o => o.view.autosave.interval, set: (o, v) => (o.view.autosave.interval = +v) },

  // the zoom extent is normalised as a pair, and the theme as a colour and its transparency, so
  // each group keeps a writer of its own and the table only shows what that writer settled on
  { key: "zoomExtentMin", get: o => o.view.zoomExtent.min },
  { key: "zoomExtentMax", get: o => o.view.zoomExtent.max },

  // the export dialogs own these controls and write them; see components/options/io-panes.ts
  { key: "pngResolution", get: o => o.view.export.pngResolution },
  { key: "tileCols", get: o => o.view.export.tiles.cols },
  { key: "tileRows", get: o => o.view.export.tiles.rows },
  { key: "tileScale", get: o => o.view.export.tiles.scale }
];

/** Every control `options` answers for, requests and preferences alike */
const OPTION_SETTINGS: Setting<OptionsData>[] = [...REQUEST_SETTINGS, ...PREFERENCE_SETTINGS];

/**
 * Facts: what is true about the map on screen. Editing one changes the map now, so these write
 * `facts` and never a request. The Units editor owns its own controls the same way
 */
const FACT_SETTINGS: Setting<FactsData>[] = [
  { key: "seed", get: f => f.seed }, // a readout: typing a seed regenerates rather than editing this map
  // the depression settings are the one pair of controls that answer to both objects: the heightmap
  // being customized re-derives its rivers and lakes from the fact as the slider moves, and the
  // request is what the next map starts from. Two names, two objects, one control - see
  // docs/architecture/configuration.md#generation-mechanics
  {
    key: "resolveDepressionsSteps",
    get: f => f.heightmap.resolveDepressionsSteps,
    set: (f, v) => (f.heightmap.resolveDepressionsSteps = +v)
  },
  {
    key: "lakeElevationLimit",
    get: f => f.heightmap.lakeElevationLimit,
    set: (f, v) => (f.heightmap.lakeElevationLimit = +v)
  },
  { key: "mapName", get: f => f.lore.name, set: (f, v) => (f.lore.name = v) },
  { key: "year", get: f => f.lore.calendar.year, set: (f, v) => (f.lore.calendar.year = +v) },
  {
    key: "era",
    get: f => f.lore.calendar.era,
    set: (f, v) => {
      f.lore.calendar.era = v;
      f.lore.calendar.eraShort = Facts.shortEra();
    }
  }
];

ensureEl("optionsContent").innerHTML = TEMPLATE;
addListeners();
watchInputs();
loadVoices();

function addListeners(): void {
  const content = ensureEl("optionsContent");

  content.addEventListener("input", event => {
    const { id, value } = event.target as HTMLInputElement;
    if (id === "mapWidthInput" || id === "mapHeightInput") onCanvasSizeChange();
    else if (id === "pointsInput") changeCellsDensity(+value);
    else if (id === "culturesSet") changeCultureSet(value);
    else if (id === "statesNumber") changeStatesNumber(+value);
    else if (id === "emblemShape") changeEmblemShape(value);
    else if (id === "tooltipSize") changeTooltipSize(+value);
    else if (id === "themeHueInput") changeThemeHue(value);
    else if (id === "themeColorInput" || id === "transparencyInput") {
      setTheme(
        ensureEl<HTMLInputElement>("themeColorInput").value,
        +ensureEl<HTMLInputElement>("transparencyInput").value
      );
    }
  });

  content.addEventListener("change", event => {
    const { id, value } = event.target as HTMLInputElement;
    if (id === "zoomExtentMin" || id === "zoomExtentMax") changeZoomExtent(value);
    else if (id === "seedInput") generateMapWithSeed();
    else if (id === "uiSize") changeUiSize(+value);
    else if (id === "shapeRendering") setRendering(value);
    else if (id === "yearInput") changeYear();
    else if (id === "eraInput") changeEra();
    else if (id === "azgaarAssistant") toggleAssistant(value === "show");
  });

  content.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    if (target.id === "restoreDefaultCanvasSize") restoreDefaultCanvasSize();
    else if (target.id === "optionsMapHistory") showSeedHistoryDialog();
    else if (target.id === "optionsCopySeed") copyMapURL();
    else if (target.id === "optionsEraRegenerate") regenerateEra();
    else if (target.id === "optionsMapNameRegenerate") regenerateMapName();
    else if (target.id === "templateInputContainer") Controllers.HeightmapSelection.open();
    else if (target.id === "zoomExtentDefault") restoreDefaultZoomExtent();
    else if (target.id === "translateExtent") toggleTranslateExtent(target);
    else if (target.id === "speakerTest") testSpeaker();
    else if (target.id === "themeColorRestore") restoreDefaultThemeColor();
    else if (target.id === "loadGoogleTranslateButton") loadGoogleTranslate();
    else if (target.id === "resetLanguage") resetLanguage();
  });
}

/** Push every setting the tab shows into its input, so the DOM reflects the objects behind it */
export function syncInputs(): void {
  const push = (key: string, value: string | number | null) => {
    if (value === null) return; // nothing chosen yet: the control keeps the value it derived
    const input = inputFor(key);
    if (input) input.value = String(value);
    const output = findEl<HTMLOutputElement>(`${key}Output`);
    if (output) output.value = String(value);
  };

  for (const { key, get } of OPTION_SETTINGS) {
    if (key === "template") continue; // a select whose options are added on demand, see below
    push(key, get(options));
  }
  for (const { key, get } of FACT_SETTINGS) push(key, get(facts));

  const id = options.generation.template;
  const template = findEl<HTMLSelectElement>("templateInput");
  if (template && id) applyOption(template, id, heightmapTemplates[id]?.name || precreatedHeightmaps[id]?.name || id);

  const manors = findEl<HTMLOutputElement>("manorsOutput");
  if (manors) manors.value = Options.isAutoBurgLimit() ? "auto" : String(options.generation.burgs.limit);

  syncCellsDensity(); // the Points slider shows a step, the object holds the cell count it resolves to
  syncCultures(); // the cultures slider is capped by the selected set
}

/**
 * Keep the object in step with the panel: `data-stored` names the setting, the same key it is
 * pinned under. Every control writes to the object, never the other way round
 */
function watchInputs(): void {
  const optionRows = new Map(OPTION_SETTINGS.map(setting => [setting.key, setting]));
  const factRows = new Map(FACT_SETTINGS.map(setting => [setting.key, setting]));

  const onChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    const key = target?.dataset?.stored;
    if (!key) return;

    // one table per object: a key in both is a control that owns two differently-named values,
    // never one value with two writers
    const apply = () => {
      if (key === "points") return Options.setDensity(+target.value);
      optionRows.get(key)?.set?.(options, target.value);
      factRows.get(key)?.set?.(facts, target.value);
    };

    // an input event is a drag in progress: apply it, but wait for the change event to keep it
    apply();
    if (event.type !== "change") return;

    if (PINNABLE[key]) lock(key); // a request the user set by hand: keep the value on the next map
    Options.persist();
  };

  // only this tab's own controls: every dialog wires the controls it owns
  const root = findEl("options");
  root?.addEventListener("input", onChange);
  root?.addEventListener("change", onChange);

  // the canvas size inputs are not `data-stored`: `onCanvasSizeChange` is their single writer, and
  // it writes the request. The extent on screen belongs to the graph this map was built on
}

const inputFor = (key: string) => findEl<HTMLInputElement>(`${key}Input`) ?? findEl<HTMLInputElement>(key);

function onCanvasSizeChange(): void {
  Options.set(o => {
    o.nextMap.width = +ensureEl<HTMLInputElement>("mapWidthInput").value;
    o.nextMap.height = +ensureEl<HTMLInputElement>("mapHeightInput").value;
  });
  // the map on screen keeps the extent its graph was built on - this asks for the next one
  lock("mapWidth");
  lock("mapHeight");

  if (options.nextMap.width > window.innerWidth || options.nextMap.height > window.innerHeight) {
    const size = `${window.innerWidth} x ${window.innerHeight}`;
    tip(`Canvas size is larger than window size (${size}). It can affect performance`, false, "warn", 4000);
  }
}

function restoreDefaultCanvasSize(): void {
  Options.set(o => {
    o.nextMap.width = window.innerWidth;
    o.nextMap.height = window.innerHeight;
  });
  unlock("mapWidth");
  unlock("mapHeight");
  syncInputs();
}

/** The Points slider picks a density step; the readout shows the cell count it resolves to */
export function changeCellsDensity(density: number): void {
  Options.setDensity(density);
  syncCellsDensity();
}

/** Push the density step and the cell count it resolves to into the slider and its readout */
function syncCellsDensity(): void {
  const { density, points: cellsDesired } = options.nextMap;

  const input = findEl<HTMLInputElement>("pointsInput");
  if (input) {
    input.value = String(density);
    input.dataset.cells = String(cellsDesired);
  }

  const readout = findEl<HTMLOutputElement>("pointsOutputFormatted");
  if (!readout) return;
  readout.value = `${cellsDesired / 1000}K`;
  readout.style.color = cellsDensityColor(cellsDesired);
}

/** green at the default density, amber above it, red where performance starts to suffer */
export const cellsDensityColor = (cells: number): string =>
  cells > 50000 ? "#b12117" : cells === 10000 ? "#053305" : "#dfdf12";

/** Each culture set holds a different number of cultures, and the number asked for cannot exceed it */
function changeCultureSet(set: string): void {
  Options.set(o => {
    o.generation.cultures.set = set;
    Options.capCultures();
  });
  syncCultures();
}

/** Cap the cultures slider at what the selected set can give, and show the number that survived it */
function syncCultures(): void {
  const max = String(CULTURE_SETS[options.generation.cultures.set]?.max ?? 0);
  const input = findEl<HTMLInputElement>("culturesInput");
  const output = findEl<HTMLInputElement>("culturesOutput");
  if (!input || !output) return;

  input.max = output.max = max;
  input.value = output.value = String(options.generation.cultures.limit);
}

/** More states means smaller labels, so they keep fitting the shrinking territories */
function changeStatesNumber(count: number): void {
  ensureEl("statesNumber").style.color = count ? "" : "#b12117";

  const capitalSize = Math.max(rn(6 - count / 20), 3);
  const stateSize = Math.max(rn(18 - count / 6), 4);
  if (styles.labels.groups.capital) styles.labels.groups.capital.attrs["font-size"] = `${capitalSize}%`;
  if (styles.labels.groups.states) styles.labels.groups.states.attrs["font-size"] = `${stateSize}%`;
  select("#labels").select("[data-group='capital']").attr("font-size", `${capitalSize}%`);
  select("#labels").select("[data-group='states']").attr("font-size", `${stateSize}%`);
}

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
    if (!state.i || state.removed || !state.coa || state.coa.custom) continue;
    const shield = specificShape || Emblems.getShield(state.culture ?? 0);
    if (shield === state.coa.shield) continue;
    state.coa.shield = shield;
    EmblemRenderer.trigger(`stateCOA${state.i}`, state.coa);
  }

  for (const province of pack.provinces) {
    if (!province.i || province.removed || !province.coa || province.coa.custom) continue;
    const shield = specificShape || Emblems.getShield(pack.cells.culture[province.center] ?? 0, province.state);
    if (shield === province.coa.shield) continue;
    province.coa.shield = shield;
    EmblemRenderer.trigger(`provinceCOA${province.i}`, province.coa);
  }

  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.coa || burg.coa.custom) continue;
    const shield = specificShape || Emblems.getShield(burg.culture ?? 0, burg.state);
    if (shield === burg.coa.shield) continue;
    burg.coa.shield = shield;
    EmblemRenderer.trigger(`burgCOA${burg.i}`, burg.coa);
  }
}

function changeYear(): void {
  const value = ensureEl<HTMLInputElement>("yearInput").value;
  if (!value) return;
  if (Number.isNaN(+value)) {
    tip("Current year should be a number", false, "error");
    return;
  }
  facts.lore.calendar.year = +value;
}

function changeEra(): void {
  const value = ensureEl<HTMLInputElement>("eraInput").value;
  if (!value) return;
  lock("era");
  Facts.set(f => (f.lore.calendar.era = value));
}

function regenerateMapName(): void {
  Names.getMapName(true); // writes facts.lore.name, and unpins the name if the user had pinned it
  syncInputs();
}

function regenerateEra(): void {
  unlock("era");
  Facts.set(f => {
    f.lore.calendar.era = Facts.randomEra();
    f.lore.calendar.eraShort = Facts.shortEra();
  });
  ensureEl<HTMLInputElement>("eraInput").value = facts.lore.calendar.era;
}

function changeUiSize(value: number): void {
  if (Number.isNaN(value) || value < 0.5) return;
  const size = Math.min(value, maxUiSize());

  ensureEl<HTMLInputElement>("uiSize").value = String(size);
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
    o.view.ui.themeColor = themeColor;
    o.view.ui.transparency = transparency;
  });
  changeDialogsTheme(themeColor, transparency);
}

function restoreDefaultThemeColor(): void {
  setTheme(THEME_COLOR, options.view.ui.transparency);
}

function changeThemeHue(hue: string): void {
  const { s, l } = hsl(options.view.ui.themeColor);
  setTheme(hsl(+hue, s, l).hex(), options.view.ui.transparency);
}

/**
 * Derive the whole dialog palette from one colour and one transparency. This applies what the
 * object holds; `setTheme` is what puts it there
 */
function changeDialogsTheme(themeColor: string, transparency: number): void {
  ensureEl<HTMLInputElement>("transparencyInput").value = String(transparency);
  const alpha = (100 - transparency) / 100;
  const alphaReduced = Math.min(alpha + 0.3, 1);

  const { h, s, l } = hsl(themeColor);
  ensureEl<HTMLInputElement>("themeColorInput").value = themeColor;
  ensureEl<HTMLInputElement>("themeHueInput").value = String(h);

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

function setRendering(value: string): void {
  select("#viewbox").attr("shape-rendering", value);

  const isFast = value === "optimizeSpeed";
  select("#statesHalo").style("display", isFast ? "none" : (null as unknown as string));
  if (!isFast && pack.cells && select("#statesHalo").selectAll("*").size() === 0) Layers.draw("states");
}

function changeZoomExtent(value: string): void {
  const minInput = ensureEl<HTMLInputElement>("zoomExtentMin");
  const maxInput = ensureEl<HTMLInputElement>("zoomExtentMax");
  if (+minInput.value > +maxInput.value) [minInput.value, maxInput.value] = [maxInput.value, minInput.value];

  setZoomExtentPreference(Math.max(+minInput.value, 0.01), Math.min(+maxInput.value, 200));
  setMapZoom(minmax(+value, 0.01, 200));
}

function restoreDefaultZoomExtent(): void {
  const { min, max } = getDefaultOptions().view.zoomExtent;
  setZoomExtentPreference(min, max);
  setMapZoom(min);
}

/** The single writer of the zoom extent: one pair, normalised together and shown together */
function setZoomExtentPreference(min: number, max: number): void {
  Options.set(o => (o.view.zoomExtent = { min, max }));
  ensureEl<HTMLInputElement>("zoomExtentMin").value = String(min);
  ensureEl<HTMLInputElement>("zoomExtentMax").value = String(max);
  setZoomExtent(min, max);
}

/** Let the user pan beyond the canvas edges, so a map can be inspected off-centre */
function toggleTranslateExtent(el: HTMLElement): void {
  const isOn = !+(el.dataset.on ?? 0);
  el.dataset.on = String(+isOn);

  const { width, height } = facts.graph;
  if (isOn) setTranslateExtent(-width / 2, -height / 2, width * 1.5, height * 1.5);
  else setTranslateExtent(0, 0, width, height);
}

/** Voices arrive asynchronously and some browsers report none at all, so poll briefly then give up */
function loadVoices(): void {
  let attempts = 0;
  const select = ensureEl<HTMLSelectElement>("speakerVoice");

  const interval = setInterval(() => {
    const voices = speechSynthesis.getVoices();

    if (!voices.length) {
      if (++attempts < 10) return;
      clearInterval(interval);
      if (!select.options.length) select.options.add(new Option("No voices available", ""));
      return;
    }

    clearInterval(interval);
    for (const [index, voice] of voices.entries()) select.options.add(new Option(voice.name, String(index)));
    select.value = options.view.ui.speakerVoice || String(voices.findIndex(voice => voice.lang === "en-US"));
  }, 1000);
}

function testSpeaker(): void {
  const { year, era } = facts.lore.calendar;
  const speech = new SpeechSynthesisUtterance(`${facts.lore.name}, ${year} ${era}`);
  const voices = speechSynthesis.getVoices();
  if (voices.length) speech.voice = voices[+ensureEl<HTMLSelectElement>("speakerVoice").value];
  speechSynthesis.speak(speech);
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
 * settings. The option *values* are restored by components/options.ts before this runs
 */
/**
 * Custom style presets predating the `fmgStyle_` prefix kept a `style<Name>` key of their own;
 * today's are listed by public/modules/ui/style-presets.js when it builds the select
 */
function restoreLegacyStylePresets(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("style")) applyOption(stylePreset, key, key.slice(5));
  }
}

/** The interface size a browser that has never chosen one gets: the map's own extent, scaled */
const defaultUiSize = (): number => minmax(rn(facts.graph.width / 1280, 1), 1, 2.5);

export function restoreUi(): void {
  const template = facts.heightmap.template;
  if (template) {
    const name = heightmapTemplates[template]?.name || precreatedHeightmaps[template]?.name || template;
    applyOption(ensureEl("templateInput"), template, name);
  }

  bindLockIcons(ensureEl("options"));
  restoreLegacyStylePresets();

  // `syncInputs` has already put every preference in its control; these are the ones that also do
  // something the moment they are read back. See docs/architecture/configuration.md
  const { ui, rendering, emblemShape, zoomExtent } = options.view;

  Emblems.setShape(emblemShape);
  changeTooltipSize(ui.tooltipSize);
  changeStatesNumber(options.generation.states.limit); // state label sizes follow the number of states

  ensureEl<HTMLInputElement>("uiSize").max = String(maxUiSize());
  changeUiSize(ui.size ?? defaultUiSize());

  changeDialogsTheme(ui.themeColor, ui.transparency);
  setRendering(rendering);
  setZoomExtent(zoomExtent.min, zoomExtent.max);
}

// Legacy seam: the classic style.js reads the culture set cap, the submap and transform tools
// set the cell density, and Google's script calls back into the page by name
declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var changeCellsDensity: (density: number) => void;
  var initGoogleTranslate: () => void;
  var google: any;
}

window.changeCellsDensity = changeCellsDensity;
window.initGoogleTranslate = () => {
  new google.translate.TranslateElement(
    { pageLanguage: "en", layout: google.translate.TranslateElement.InlineLayout.VERTICAL },
    "google_translate_element"
  );
};
