// The Units Editor: the distance, altitude, temperature and population scales a map is read in
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { Pins } from "@/components/pins";
import { updateGridSizeReadout } from "@/controllers/style-editor/controls";
import { AltitudeLegend } from "@/renderers/altitude-legend";
import { t } from "@/utils/i18n";
import { applyOption, ensureEl } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

const DIALOG_ID = "unitsEditor";

const TEMPLATE = /* html */ `
    <div id="unitsBody" style="margin-left: 1.1em">
      <div class="unitsHeader" style="margin-top: 0.4em">
        <span class="icon-map-signs"></span>
        <label>${t("Distance")}:</label>
      </div>
      <div data-tip="${t("Select a distance unit or provide a custom name")}">
        <label>${t("Distance unit")}:</label>
        <select id="distanceUnitInput">
          <option value="mi" selected>${t("Mile (mi)")}</option>
          <option value="km">${t("Kilometer (km)")}</option>
          <option value="lg">${t("League (lg)")}</option>
          <option value="vr">${t("Versta (vr)")}</option>
          <option value="nmi">${t("Nautical mile (nmi)")}</option>
          <option value="nlg">${t("Nautical league (nlg)")}</option>
          <option value="custom_name">${t("Custom name")}</option>
        </select>
      </div>
      <div data-tip="${t("Select how many distance units are in one pixel")}">
        <i data-locked="0" id="lock_distanceScale" class="icon-lock-open"></i>
        <slider-input id="distanceScaleInput" min=".01" max="20" step=".1" value="3">
          <label>${t("1 map pixel")}:</label>
        </slider-input>
      </div>
      <div data-tip="${t("Area unit name, type “square” to add ² to the distance unit")}">
        <label>${t("Area unit")}:</label>
        <input id="areaUnit" type="text" value="square" />
      </div>
      <div class="unitsHeader">
        <span class="icon-signal"></span>
        <label>${t("Altitude")}:</label>
      </div>
      <div data-tip="${t("Select an altitude unit or provide a custom name")}">
        <label>${t("Height unit")}:</label>
        <select id="heightUnit">
          <option value="ft" selected>${t("Feet (ft)")}</option>
          <option value="m">${t("Meters (m)")}</option>
          <option value="f">${t("Fathoms (f)")}</option>
          <option value="custom_name">${t("Custom name")}</option>
        </select>
      </div>
      <div
        data-tip="${t("Set height exponent, i.e. a value for altitude change sharpness. Altitude affects temperature and hence biomes")}"
      >
        <slider-input
          id="heightExponentInput"
         
          min="1.5"
          max="2.2"
          step=".01"
          value="2"
        >
          <label>${t("Exponent")}:</label>
        </slider-input>
      </div>
      <div class="unitsHeader" data-tip="${t("Select Temperature scale")}">
        <span class="icon-temperature-high"></span>
        <label>${t("Temperature")}:</label>
      </div>
      <div>
        <label>${t("Temperature scale")}:</label>
        <select id="temperatureScale">
          <option value="°C" selected>${t("degree Celsius (°C)")}</option>
          <option value="°F">${t("degree Fahrenheit (°F)")}</option>
          <option value="K">${t("Kelvin (K)")}</option>
          <option value="°R">${t("degree Rankine (°R)")}</option>
          <option value="°De">${t("degree Delisle (°De)")}</option>
          <option value="°N">${t("degree Newton (°N)")}</option>
          <option value="°Ré">${t("degree Réaumur (°Ré)")}</option>
          <option value="°Rø">${t("degree Rømer (°Rø)")}</option>
        </select>
      </div>
      <div class="unitsHeader">
        <span class="icon-male"></span>
        <label>${t("Population")}:</label>
      </div>
      <div data-tip="${t("Set how many people are in one population point")}">
        <slider-input
          id="populationRateInput"
         
          min="10"
          max="10000"
          step="10"
          value="1000"
        >
          <label>${t("1 population point")}:</label>
        </slider-input>
      </div>
      <div data-tip="${t("Set urban population modifier. Change to increase or decrease burgs population")}">
        <slider-input id="urbanizationInput" min=".01" max="5" step=".01" value="1">
          <label>${t("Urbanization rate")}:</label>
        </slider-input>
      </div>
      <div data-tip="${t("Set urban density: average population per building in Medieval Fantasy City Generator")}">
        <slider-input id="urbanDensityInput" min="1" max="200" step="1" value="10">
          <label>${t("Urban density")}:</label>
        </slider-input>
      </div>
    </div>
    <div id="unitsBottom">
      <button id="unitsAltitudeLegend" data-tip="${t("Toggle the Altitude legend box")}" class="icon-list-bullet"></button>
      <button id="unitsRestore" data-tip="${t("Restore default units settings")}" class="icon-ccw"></button>
    </div>
`;

function open(): void {
  closeDialogs("#unitsEditor, .stable");
  renderDialog();

  $("#unitsEditor").dialog({
    title: t("Units Editor"),
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

/** Every unit this dialog edits: the control that shows it, and where it lives in `options.map` */
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
  const { distance, area, height, temperature, population } = options.map.units;
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
  applyOption(ensureEl("distanceUnitInput"), options.map.units.distance.unit);
  applyOption(ensureEl("heightUnit"), options.map.units.height.unit);

  for (const key of UNIT_KEYS) inputFor(key).value = String(unitValue(key));
}

/**
 * Units describe the map and this dialog is their only writer: it owns every control it shows,
 * writes the value into `options.map`, pins what the user set by hand, and redraws what reads it.
 * The <slider-input> controls re-dispatch their inner events, so only the outer id ever matches
 */
function addListeners(): void {
  ensureEl(DIALOG_ID).addEventListener("change", onUnitChange);
  ensureEl("unitsAltitudeLegend").addEventListener("click", AltitudeLegend.toggle);
  ensureEl("unitsRestore").addEventListener("click", restoreDefaultUnits);
}

function onUnitChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value;
  const { units } = options.map;

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
      break;

    case "distanceScaleInput":
      units.distance.scale = +value;
      Pins.set("distanceScale", +value);
      redrawDistances();
      break;

    case "areaUnit":
      units.area.unit = value;
      Pins.set("areaUnit", value);
      break;

    case "heightUnit":
      if (value === "custom_name") {
        askForCustomUnit(input, "height");
        return;
      }
      units.height.unit = value;
      Pins.set("heightUnit", value);
      break;

    case "heightExponentInput":
      units.height.exponent = +value;
      Pins.set("heightExponent", +value);
      Temperature.generate();
      Layers.draw("temperature");
      break;

    case "temperatureScale":
      units.temperature.unit = value;
      Pins.set("temperatureScale", value);
      Layers.draw("temperature");
      break;

    case "populationRateInput":
      units.population.scale = +value;
      Pins.set("populationRate", +value);
      break;

    case "urbanizationInput":
      units.population.urbanization.rate = +value;
      Pins.set("urbanization", +value);
      break;

    case "urbanDensityInput":
      units.population.urbanization.density = +value;
      Pins.set("urbanDensity", +value);
      break;

    default:
      return;
  }

  AltitudeLegend.refresh(); // reads the height unit and exponent
  Options.save();
}

/** "custom_name" is not a unit: it asks for one, and puts the answer where the value belongs */
function askForCustomUnit(select: HTMLInputElement, kind: "distance" | "height"): void {
  fillInputs(); // the sentinel is not a unit, so the select goes back to the one in use right away
  prompt(
    kind === "distance" ? t("Provide a custom name for a distance unit") : t("Provide a custom name for a height unit"),
    { default: "" },
    custom => {
      const name = String(custom);
      if (!name) return;

      (select as unknown as HTMLSelectElement).options.add(new Option(name, name, false, true));
      if (kind === "distance") {
        options.map.units.distance.unit = name;
        Pins.set("distanceUnit", name);
        redrawDistances();
      } else {
        options.map.units.height.unit = name;
        Pins.set("heightUnit", name);
        AltitudeLegend.refresh();
      }
      Options.save();
    }
  );
}

/** Everything measured in distance units: the scale bar and the grid size the Style tab reports */
function redrawDistances(): void {
  Layers.draw("scaleBar");
  updateGridSizeReadout();
}

function restoreDefaultUnits(): void {
  options.map.units = Options.getDefaultOptions().map.units;
  for (const key of UNIT_KEYS) Pins.clear(key);
  Options.save();

  fillInputs();
  Temperature.generate();
  redrawDistances();
  AltitudeLegend.refresh();
}

export const UnitsEditor = { open };
