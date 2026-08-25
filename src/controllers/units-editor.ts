import { type Selection, select } from "d3";
import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { WorldGenerationController } from "@/generators/world-generation-controller";
import { drawScaleBar, fitScaleBar } from "@/renderers/draw-scalebar";
import { drawTemperature } from "@/renderers/draw-temperature";
import { getUnitSettings } from "@/services/units-settings";
import { lock, unlock } from "@/utils/preferences";
import type { PromptOptions } from "../utils/commonUtils";

// Custom app prompt shadows the DOM built-in (same pattern as burg-editor / route-groups-editor).
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

type ScaleBarSelection = Selection<SVGGElement, unknown, HTMLElement, unknown>;

const unitSettings = getUnitSettings();

// The legacy global bindings point at these controller-owned elements while the migration removes
// direct DOM lookups from other modules incrementally.
let initialized = false; // TODO: refactor to eliminate initialization arc

function open(): void {
  closeDialogs("#unitsEditor, .stable");

  showDomDialog({
    content: unitSettings.content,
    destroyOnClose: false,
    placement: "top-right",
    placementTarget: document.querySelector("svg"),
    title: "Units Editor",
    width: "24em"
  });

  if (initialized) return;
  initialized = true;

  unitSettings.distanceUnitInput.addEventListener("change", changeDistanceUnit);
  unitSettings.distanceScaleInput.addEventListener("change", changeDistanceScale);
  unitSettings.heightUnit.addEventListener("change", changeHeightUnit);
  unitSettings.heightExponentInput.addEventListener("input", changeHeightExponent);
  unitSettings.temperatureScale.addEventListener("change", changeTemperatureScale);
  unitSettings.populationRateInput.addEventListener("change", changePopulationRate);
  unitSettings.urbanizationInput.addEventListener("change", changeUrbanizationRate);
  unitSettings.urbanDensityInput.addEventListener("change", changeUrbanDensity);
  unitSettings.unitsRestore.addEventListener("click", restoreDefaultUnits);
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
      window.StyleEditor.calculateFriendlyGridSize();
    });
    return;
  }

  renderScaleBar();
  window.StyleEditor.calculateFriendlyGridSize();
}

function changeDistanceScale(this: HTMLInputElement): void {
  distanceScale = +this.value;
  renderScaleBar();
  window.StyleEditor.calculateFriendlyGridSize();
}

function changeHeightUnit(this: HTMLSelectElement): void {
  if (this.value !== "custom_name") return;

  prompt("Provide a custom name for a height unit", { default: "" }, custom => {
    this.options.add(new Option(String(custom), String(custom), false, true));
    lock("heightUnit");
  });
}

function changeHeightExponent(): void {
  WorldGenerationController.calculateTemperatures();
  if (window.LayerControls.isLayerOn("toggleTemperature")) drawTemperature();
}

function changeTemperatureScale(): void {
  if (window.LayerControls.isLayerOn("toggleTemperature")) drawTemperature();
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
  unitSettings.distanceScaleInput.value = String(distanceScale);
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
  window.StyleEditor.calculateFriendlyGridSize();

  // height exponent
  heightExponentInput.value = "1.8";
  localStorage.removeItem("heightExponent");
  WorldGenerationController.calculateTemperatures();

  renderScaleBar();

  // population
  populationRate = 1000;
  unitSettings.populationRateInput.value = String(populationRate);
  urbanization = 1;
  unitSettings.urbanizationInput.value = String(urbanization);
  urbanDensity = 10;
  unitSettings.urbanDensityInput.value = String(urbanDensity);
  localStorage.removeItem("populationRate");
  localStorage.removeItem("urbanization");
  localStorage.removeItem("urbanDensity");
}

export const UnitsEditor = { open };
