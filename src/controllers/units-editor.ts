// The Units Editor: the distance, altitude, temperature and population scales a map is read in.
// Every control here edits `facts.units` - the dialog is built and filled from the object on open,
// and nothing outside reads its inputs
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { Pins } from "@/components/pins";
import { applyOption, ensureEl } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

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
        <select id="distanceUnitInput">
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
        <slider-input id="distanceScaleInput" min=".01" max="20" step=".1" value="3">
          <label>1 map pixel:</label>
        </slider-input>
      </div>
      <div data-tip='Area unit name, type "square" to add ² to the distance unit'>
        <label>Area unit:</label>
        <input id="areaUnit" type="text" value="square" />
      </div>
      <div class="unitsHeader">
        <span class="icon-signal"></span>
        <label>Altitude:</label>
      </div>
      <div data-tip="Select an altitude unit or provide a custom name">
        <label>Height unit:</label>
        <select id="heightUnit">
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
        <select id="temperatureScale">
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
         
          min="10"
          max="10000"
          step="10"
          value="1000"
        >
          <label>1 population point:</label>
        </slider-input>
      </div>
      <div data-tip="Set urban population modifier. Change to increase or descrese burgs population">
        <slider-input id="urbanizationInput" min=".01" max="5" step=".01" value="1">
          <label>Urbanization rate:</label>
        </slider-input>
      </div>
      <div data-tip="Set urban density: average population per building in Medieval Fantasy City Generator">
        <slider-input id="urbanDensityInput" min="1" max="200" step="1" value="10">
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
  Pins.bindIcons(ensureEl(DIALOG_ID), unitValue);
}

/** Every unit this dialog edits: the control that shows it, and where it lives in `facts` */
const UNIT_KEYS = [
  "distanceUnit",
  "distanceScale",
  "areaUnit",
  "heightUnit",
  "heightExponent",
  "temperatureScale",
  "populationRate",
  "urbanization",
  "urbanDensity"
] as const;

/** The control each unit is shown in, and the value it holds now */
function unitValue(key: string): string | number | undefined {
  const { distance, area, height, temperature, population } = facts.units;
  if (key === "distanceUnit") return distance.unit;
  if (key === "distanceScale") return distance.scale;
  if (key === "areaUnit") return area.unit;
  if (key === "heightUnit") return height.unit;
  if (key === "heightExponent") return height.exponent;
  if (key === "temperatureScale") return temperature.unit;
  if (key === "populationRate") return population.scale;
  if (key === "urbanization") return population.urbanization.rate;
  if (key === "urbanDensity") return population.urbanization.density;
  return undefined;
}

/** three controls are named after the setting itself, the rest carry the "Input" suffix */
const BARE_IDS = ["areaUnit", "heightUnit", "temperatureScale"];
const inputFor = (key: string) => ensureEl<HTMLInputElement>(BARE_IDS.includes(key) ? key : `${key}Input`);

/** The object is the source: push every unit it holds into the control that shows it */
function fillInputs(): void {
  // a unit the user named themselves is not among the options of its select until it is put back there
  applyOption(ensureEl("distanceUnitInput"), facts.units.distance.unit);
  applyOption(ensureEl("heightUnit"), facts.units.height.unit);

  for (const key of UNIT_KEYS) inputFor(key).value = String(unitValue(key));
}

/**
 * Units are facts of the map and this dialog is their only writer: it owns every control it shows,
 * writes the value into `facts`, pins what the user set by hand, and redraws whatever reads it.
 * The <slider-input> controls re-dispatch their inner events, so only the outer id ever matches
 */
function addListeners(): void {
  ensureEl(DIALOG_ID).addEventListener("change", onUnitChange);
  ensureEl("unitsRestore").addEventListener("click", restoreDefaultUnits);
}

function onUnitChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value;
  const { units } = facts;

  switch (input.id) {
    case "distanceUnitInput":
      // the select offers a sentinel that stands for a name the user has yet to give
      if (value === "custom_name") {
        askForCustomUnit(input, "distance");
        return;
      }
      units.distance.unit = value;
      Pins.set("distanceUnit", value);
      redrawDistances();
      return;

    case "distanceScaleInput":
      units.distance.scale = +value;
      Pins.set("distanceScale", +value);
      redrawDistances();
      return;

    case "areaUnit":
      units.area.unit = value;
      Pins.set("areaUnit", value);
      return;

    case "heightUnit":
      if (value === "custom_name") {
        askForCustomUnit(input, "height");
        return;
      }
      units.height.unit = value;
      Pins.set("heightUnit", value);
      return;

    case "heightExponentInput":
      units.height.exponent = +value;
      Pins.set("heightExponent", +value);
      Temperature.generate();
      Layers.draw("temperature");
      return;

    case "temperatureScale":
      units.temperature.unit = value;
      Pins.set("temperatureScale", value);
      Layers.draw("temperature");
      return;

    case "populationRateInput":
      units.population.scale = +value;
      Pins.set("populationRate", +value);
      return;

    case "urbanizationInput":
      units.population.urbanization.rate = +value;
      Pins.set("urbanization", +value);
      return;

    case "urbanDensityInput":
      units.population.urbanization.density = +value;
      Pins.set("urbanDensity", +value);
      return;
  }
}

/** "custom_name" is not a unit: it asks for one, and puts the answer where the value belongs */
function askForCustomUnit(select: HTMLInputElement, kind: "distance" | "height"): void {
  fillInputs(); // the sentinel is not a unit, so the select goes back to the one in use right away
  prompt(`Provide a custom name for a ${kind} unit`, { default: "" }, custom => {
    const name = String(custom);
    if (!name) return;

    (select as unknown as HTMLSelectElement).options.add(new Option(name, name, false, true));
    if (kind === "distance") {
      facts.units.distance.unit = name;
      Pins.set("distanceUnit", name);
      redrawDistances();
    } else {
      facts.units.height.unit = name;
      Pins.set("heightUnit", name);
    }
  });
}

/** Everything measured in distance units: the scale bar and the grid size the Style tab reports */
function redrawDistances(): void {
  Layers.draw("scaleBar");
  calculateFriendlyGridSize();
}

function restoreDefaultUnits(): void {
  facts.units = Facts.getDefault().units;
  for (const key of UNIT_KEYS) Pins.clear(key);

  fillInputs();
  Temperature.generate();
  redrawDistances();
}

export const UnitsEditor = { open };
