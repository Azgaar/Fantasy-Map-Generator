import { closeDialogs } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import "@/components/ui-dialog/ui-dialog";
import type { UiDialogElement } from "@/components/ui-dialog/ui-dialog";
import { ensureEl } from "@/utils";
import type { PromptOptions } from "@/utils/commonUtils";
import { lock, unlock } from "@/utils/preferences";
import templateHtml from "./units-editor-dialog.html?raw";

// Custom app prompt shadows the DOM built-in (same pattern as burg-editor / route-groups-editor).
declare const prompt: (text: string, options: PromptOptions, callback: (value: string | number) => void) => void;

const template = document.createElement("template");
template.innerHTML = templateHtml;

let initialized = false; // TODO: refactor to eliminate initialization arc

function changeDistanceUnit(this: HTMLSelectElement): void {
  if (this.value === "custom_name") {
    prompt("Provide a custom name for a distance unit", { default: "" }, custom => {
      this.options.add(new Option(String(custom), String(custom), false, true));
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
  distanceScale = +this.value;
  Layers.draw("scaleBar");
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
  Temperature.generate();
  Layers.draw("temperature");
}

function changeTemperatureScale(): void {
  Layers.draw("temperature");
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
  Temperature.generate();

  Layers.draw("scaleBar");

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

class UnitsEditorDialog extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount) return;
    this.appendChild(template.content.cloneNode(true));
  }

  private get dialog(): UiDialogElement {
    return this.querySelector("ui-dialog")!;
  }

  open() {
    closeDialogs("#unitsEditor, .stable");

    this.dialog.open();
    this.dialog.positionRelativeTo(document.querySelector("svg")!, "right top", "right-10 top+10");

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

  close() {
    this.dialog.close();
  }

  positionRelativeTo(target: Element, my: string, at: string) {
    this.dialog.positionRelativeTo(target, my, at);
  }
}

customElements.define("units-editor-dialog", UnitsEditorDialog);

export type UnitsEditorDialogElement = InstanceType<typeof UnitsEditorDialog>;

export const UnitsEditor = { open: () => ensureEl<UnitsEditorDialogElement>("unitsEditor").open() };
