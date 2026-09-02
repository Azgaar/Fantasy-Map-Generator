import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { syncInputs } from "@/components/options/tabs/options-tab";
import { lock, unlock } from "@/utils/preferences";
import { ensureEl } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

// Custom app prompt shadows the DOM built-in (same pattern as burg-editor / route-groups-editor).
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

// The #unitsEditor inputs (distanceUnitInput, heightUnit, temperatureScale, …) are app-wide
// settings cached as globals at load and read across the codebase, so this module does NOT
// own that markup — it stays in index.html. Listeners are wired once behind this flag.
let initialized = false; // TODO: refactor to eliminate initialization arc

function open(): void {
  closeDialogs("#unitsEditor, .stable");

  $("#unitsEditor").dialog({
    title: "Units Editor",
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  if (initialized) return;
  initialized = true;

  ensureEl("distanceUnitInput").addEventListener("change", changeDistanceUnit);
  ensureEl("distanceScaleInput").addEventListener("change", changeDistanceScale);
  ensureEl("heightUnit").addEventListener("change", changeHeightUnit);
  ensureEl("heightExponentInput").addEventListener("input", changeHeightExponent);
  ensureEl("temperatureScale").addEventListener("change", changeTemperatureScale);

  ensureEl("populationRateInput").addEventListener("change", changePopulationRate);
  ensureEl("urbanizationInput").addEventListener("change", changeUrbanizationRate);
  ensureEl("urbanDensityInput").addEventListener("change", changeUrbanDensity);

  ensureEl("unitsRestore").addEventListener("click", restoreDefaultUnits);
}

function changeDistanceUnit(this: HTMLSelectElement): void {
  if (this.value === "custom_name") {
    prompt("Provide a custom name for a distance unit", { default: "" }, custom => {
      this.options.add(new Option(String(custom), String(custom), false, true));
      Options.set(o => (o.units.distance.unit = String(custom)));
      lock("distanceUnit");
      Layers.draw("scaleBar");
      calculateFriendlyGridSize();
    });
    return;
  }

  Layers.draw("scaleBar");
  calculateFriendlyGridSize();
}

function changeDistanceScale(this: HTMLInputElement): void {
  options.units.distance.scale = +this.value;
  Layers.draw("scaleBar");
  calculateFriendlyGridSize();
}

function changeHeightUnit(this: HTMLSelectElement): void {
  if (this.value !== "custom_name") return;

  prompt("Provide a custom name for a height unit", { default: "" }, custom => {
    this.options.add(new Option(String(custom), String(custom), false, true));
    Options.set(o => (o.units.height.unit = String(custom)));
    lock("heightUnit");
  });
}

function changeHeightExponent(): void {
  Temperature.generate();
  Layers.draw("temperature");
}

function changeTemperatureScale(): void {
  Layers.draw("temperature");
}

function changePopulationRate(this: HTMLInputElement): void {
  options.units.population.scale = +this.value;
}

function changeUrbanizationRate(this: HTMLInputElement): void {
  options.units.population.urbanization.rate = +this.value;
}

function changeUrbanDensity(this: HTMLInputElement): void {
  options.units.population.urbanization.density = +this.value;
}

function restoreDefaultUnits(): void {
  const US = navigator.language === "en-US";
  const UK = navigator.language === "en-GB";

  Options.set(o => {
    o.units.distance.scale = 3;
    o.units.distance.unit = US || UK ? "mi" : "km";
    o.units.height.unit = US || UK ? "ft" : "m";
    o.units.height.exponent = 1.8;
    o.units.temperature.unit = US ? "°F" : "°C";
    o.units.area.unit = "square";
    o.units.population.scale = 1000;
    o.units.population.urbanization.rate = 1;
    o.units.population.urbanization.density = 10;
  });

  for (const setting of [
    "distanceScale",
    "distanceUnit",
    "heightUnit",
    "temperatureScale",
    "areaUnit",
    "heightExponent",
    "populationRate",
    "urbanization",
    "urbanDensity"
  ])
    unlock(setting);

  calculateFriendlyGridSize();
  Temperature.generate();
  Layers.draw("scaleBar");
  syncInputs();
}

export const UnitsEditor = { open };
