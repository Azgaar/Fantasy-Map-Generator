// The Units Editor: the distance, altitude, temperature and population scales a map is read in.
// Every control here edits `facts.units` - the dialog is built and filled from the object on open,
// and nothing outside reads its inputs
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { getDefaultFacts } from "@/components/facts-model";
import { Layers } from "@/components/layers";
import { keysUnder, type SettingKey, write } from "@/components/settings";
import { bindSettings, syncSetting, syncSettings } from "@/components/settings-binding";
import { applyOption, ensureEl } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";
import { bindLockIcons, lock, unlock } from "../utils/preferences";

declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

const DIALOG_ID = "unitsEditor";

const TEMPLATE = /* html */ `
    <div id="unitsBody" style="margin-left: 1.1em">
      <div class="unitsHeader" style="margin-top: 0.4em">
        <span class="icon-map-signs"></span>
        <label>Distance:</label>
      </div>
      <div data-tip="Select a distance unit or provide a custom name">
        <label>Distance unit:</label>
        <select id="distanceUnitInput" data-stored="distanceUnit">
          <option value="mi" selected>Mile (mi)</option>
          <option value="km">Kilometer (km)</option>
          <option value="lg">League (lg)</option>
          <option value="vr">Versta (vr)</option>
          <option value="nmi">Nautical mile (nmi)</option>
          <option value="nlg">Nautical league (nlg)</option>
          <option value="custom_name">Custom name</option>
        </select>
      </div>
      <div data-tip="Select how many distance units are in one pixel">
        <i data-locked="0" id="lock_distanceScale" class="icon-lock-open"></i>
        <slider-input id="distanceScaleInput" data-stored="distanceScale" min=".01" max="20" step=".1" value="3">
          <label>1 map pixel:</label>
        </slider-input>
      </div>
      <div data-tip='Area unit name, type "square" to add ² to the distance unit'>
        <label>Area unit:</label>
        <input id="areaUnit" data-stored="areaUnit" type="text" value="square" />
      </div>
      <div class="unitsHeader">
        <span class="icon-signal"></span>
        <label>Altitude:</label>
      </div>
      <div data-tip="Select an altitude unit or provide a custom name">
        <label>Height unit:</label>
        <select id="heightUnit" data-stored="heightUnit">
          <option value="ft" selected>Feet (ft)</option>
          <option value="m">Meters (m)</option>
          <option value="f">Fathoms (f)</option>
          <option value="custom_name">Custom name</option>
        </select>
      </div>
      <div
        data-tip="Set height exponent, i.e. a value for altitude change sharpness. Altitude affects temperature and hence biomes"
      >
        <slider-input
          id="heightExponentInput"
          data-stored="heightExponent"
          min="1.5"
          max="2.2"
          step=".01"
          value="2"
        >
          <label>Exponent:</label>
        </slider-input>
      </div>
      <div class="unitsHeader" data-tip="Select Temperature scale">
        <span class="icon-temperature-high"></span>
        <label>Temperature:</label>
      </div>
      <div>
        <label>Temperature scale:</label>
        <select id="temperatureScale" data-stored="temperatureScale">
          <option value="°C" selected>degree Celsius (°C)</option>
          <option value="°F">degree Fahrenheit (°F)</option>
          <option value="K">Kelvin (K)</option>
          <option value="°R">degree Rankine (°R)</option>
          <option value="°De">degree Delisle (°De)</option>
          <option value="°N">degree Newton (°N)</option>
          <option value="°Ré">degree Réaumur (°Ré)</option>
          <option value="°Rø">degree Rømer (°Rø)</option>
        </select>
      </div>
      <div class="unitsHeader">
        <span class="icon-male"></span>
        <label>Population:</label>
      </div>
      <div data-tip="Set how many people are in one population point">
        <slider-input
          id="populationRateInput"
          data-stored="populationRate"
          min="10"
          max="10000"
          step="10"
          value="1000"
        >
          <label>1 population point:</label>
        </slider-input>
      </div>
      <div data-tip="Set urban population modifier. Change to increase or descrese burgs population">
        <slider-input id="urbanizationInput" data-stored="urbanization" min=".01" max="5" step=".01" value="1">
          <label>Urbanization rate:</label>
        </slider-input>
      </div>
      <div data-tip="Set urban density: average population per building in Medieval Fantasy City Generator">
        <slider-input id="urbanDensityInput" data-stored="urbanDensity" min="1" max="200" step="1" value="10">
          <label>Urban density:</label>
        </slider-input>
      </div>
    </div>
    <div id="unitsBottom">
      <button id="unitsRestore" data-tip="Restore default units settings" class="icon-ccw"></button>
    </div>
`;

function open(): void {
  closeDialogs("#unitsEditor, .stable");
  renderDialog();

  $("#unitsEditor").dialog({
    title: "Units Editor",
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
    close: () => destroyDialog(DIALOG_ID)
  });
}

function renderDialog(): void {
  destroyDialog(DIALOG_ID);
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${DIALOG_ID}" class="dialog stable">${TEMPLATE}</div>`
  );

  fillInputs();
  addListeners();
  bindLockIcons(ensureEl(DIALOG_ID));
}

/** Every setting kept under `facts.units`: the whole of what this dialog edits */
const UNIT_KEYS = keysUnder("units.");

/** The object is the source: push every unit it holds into the control that shows it */
function fillInputs(): void {
  // a unit the user named themselves is not among the options of its select until it is put back there
  applyOption(ensureEl("distanceUnitInput"), facts.units.distance.unit);
  applyOption(ensureEl("heightUnit"), facts.units.height.unit);

  syncSettings(UNIT_KEYS);
}

// Units are facts of the map, and this dialog is the only writer of them: it owns every control
// it shows, writes the value it redraws from, and pins what the user set by hand
function addListeners(): void {
  // the redraws here are heavy, so they wait for the drag to end rather than run per frame
  bindSettings(ensureEl(DIALOG_ID), (key, settled) => settled && redraw(key));

  // both unit selects offer a sentinel that stands for a name the user has yet to give
  ensureEl("distanceUnitInput").addEventListener("change", promptForCustomUnit);
  ensureEl("heightUnit").addEventListener("change", promptForCustomUnit);
  ensureEl("unitsRestore").addEventListener("click", restoreDefaultUnits);
}

/** What each unit is read by: a value written from anywhere else redraws the same way */
function redraw(key: SettingKey): void {
  if (key === "distanceUnit" || key === "distanceScale") redrawDistances();
  else if (key === "heightExponent") {
    Temperature.generate();
    Layers.draw("temperature");
  } else if (key === "temperatureScale") Layers.draw("temperature");
}

/** "custom_name" is not a unit: it asks for one, and the answer goes where the value belongs */
function promptForCustomUnit(this: HTMLSelectElement, event: Event): void {
  if (this.value !== "custom_name") return;
  event.stopPropagation(); // the sentinel must never reach the object

  const key = this.dataset.stored as SettingKey;
  const kind = key === "heightUnit" ? "height" : "distance";
  prompt(`Provide a custom name for a ${kind} unit`, { default: "" }, custom => {
    this.options.add(new Option(String(custom), String(custom), false, true));
    if (!write(key, String(custom))) return;
    lock(key);
    syncSetting(key);
    redraw(key);
  });
}

/** Everything measured in distance units: the scale bar and the grid size the Style tab reports */
function redrawDistances(): void {
  Layers.draw("scaleBar");
  calculateFriendlyGridSize();
}

function restoreDefaultUnits(): void {
  facts.units = getDefaultFacts().units;
  for (const key of UNIT_KEYS) unlock(key);

  fillInputs();
  Temperature.generate();
  redrawDistances();
}

export const UnitsEditor = { open };
