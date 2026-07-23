import { type Selection, select } from "d3";
import { ensureEl } from "../utils";
import type { PromptOptions } from "../utils/commonUtils";

// Custom app prompt shadows the DOM built-in (same pattern as burg-editor / route-groups-editor).
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

type ScaleBarSelection = Selection<SVGGElement, unknown, HTMLElement, unknown>;

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

  ensureEl("distanceUnitInput").on("change", changeDistanceUnit);
  ensureEl("distanceScaleInput").on("change", changeDistanceScale);
  ensureEl("heightUnit").on("change", changeHeightUnit);
  ensureEl("heightExponentInput").on("input", changeHeightExponent);
  ensureEl("temperatureScale").on("change", changeTemperatureScale);

  ensureEl("populationRateInput").on("change", changePopulationRate);
  ensureEl("urbanizationInput").on("change", changeUrbanizationRate);
  ensureEl("urbanDensityInput").on("change", changeUrbanDensity);

  ensureEl("unitsRestore").on("click", restoreDefaultUnits);
}

function renderScaleBar(): void {
  const bar = select("#scaleBar") as unknown as ScaleBarSelection;
  drawScaleBar(bar, scale);
  fitScaleBar(bar, svgWidth, svgHeight);
}

function changeDistanceUnit(this: HTMLSelectElement): void {
  if (this.value === "custom_name") {
    prompt("Provide a custom name for a distance unit", { default: "" }, custom => {
      this.options.add(new Option(String(custom), String(custom), false, true));
      lock("distanceUnit");
      renderScaleBar();
      calculateFriendlyGridSize();
    });
    return;
  }

  renderScaleBar();
  calculateFriendlyGridSize();
}

function changeDistanceScale(this: HTMLInputElement): void {
  distanceScale = +this.value;
  renderScaleBar();
  calculateFriendlyGridSize();
}

function changeHeightUnit(this: HTMLSelectElement): void {
  if (this.value !== "custom_name") return;

  prompt("Provide a custom name for a height unit", { default: "" }, custom => {
    this.options.add(new Option(String(custom), String(custom), false, true));
    lock("heightUnit");
  });
}

function changeHeightExponent(): void {
  calculateTemperatures();
  if (layerIsOn("toggleTemperature")) drawTemperature();
}

function changeTemperatureScale(): void {
  if (layerIsOn("toggleTemperature")) drawTemperature();
}

function changePopulationRate(this: HTMLInputElement): void {
  populationRate = +this.value;
}

function changeUrbanizationRate(this: HTMLInputElement): void {
  urbanization = +this.value;
}

function changeUrbanDensity(this: HTMLInputElement): void {
  urbanDensity = +this.value;
}

function restoreDefaultUnits(): void {
  distanceScale = 3;
  ensureEl<HTMLInputElement>("distanceScaleInput").value = String(distanceScale);
  unlock("distanceScale");

  // units
  const US = navigator.language === "en-US";
  const UK = navigator.language === "en-GB";
  distanceUnitInput.value = US || UK ? "mi" : "km";
  heightUnit.value = US || UK ? "ft" : "m";
  temperatureScale.value = US ? "°F" : "°C";
  areaUnit.value = "square";
  localStorage.removeItem("distanceUnit");
  localStorage.removeItem("heightUnit");
  localStorage.removeItem("temperatureScale");
  localStorage.removeItem("areaUnit");
  calculateFriendlyGridSize();

  // height exponent
  heightExponentInput.value = "1.8";
  localStorage.removeItem("heightExponent");
  calculateTemperatures();

  renderScaleBar();

  // population
  populationRate = 1000;
  ensureEl<HTMLInputElement>("populationRateInput").value = String(populationRate);
  urbanization = 1;
  ensureEl<HTMLInputElement>("urbanizationInput").value = String(urbanization);
  urbanDensity = 10;
  ensureEl<HTMLInputElement>("urbanDensityInput").value = String(urbanDensity);
  localStorage.removeItem("populationRate");
  localStorage.removeItem("urbanization");
  localStorage.removeItem("urbanDensity");
}

export const UnitsEditor = { open };
