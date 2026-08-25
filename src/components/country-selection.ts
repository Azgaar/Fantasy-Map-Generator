import { getAssignmentOverlay } from "@/renderers/interaction/map-domain-overlay";
import { updateMapInteractionOverlay } from "@/renderers/pixi/pixi-renderer-controller";
import { LAYER_CONTROLS_CHANGE_EVENT } from "./layers/layer-controls";

export const COUNTRY_SELECTION_CHANGE_EVENT = "map:country-selection-change";

let selectedCountryId: number | null = null;

export function getSelectedCountryId(): number | null {
  return selectedCountryId;
}

export function canSelectCountry(): boolean {
  return window.LayerControls?.getSnapshot().selectedPreset === "political";
}

export function selectCountry(countryId: number): boolean {
  const country = pack.states[countryId];
  if (!canSelectCountry() || !countryId || !country || country.removed) return false;

  selectedCountryId = countryId;
  updateMapInteractionOverlay({
    selection: getAssignmentOverlay(pack.cells.state, countryId, {
      fill: "#ffffff",
      fillOpacity: 0.12,
      stroke: "#ffffff",
      strokeOpacity: 0.9,
      strokeWidth: 2
    })
  });
  notifySelectionChanged();
  return true;
}

export function clearSelectedCountry(): void {
  if (selectedCountryId === null) return;
  selectedCountryId = null;
  updateMapInteractionOverlay({ selection: null });
  notifySelectionChanged();
}

function notifySelectionChanged(): void {
  window.dispatchEvent(new CustomEvent(COUNTRY_SELECTION_CHANGE_EVENT, { detail: selectedCountryId }));
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener(LAYER_CONTROLS_CHANGE_EVENT, () => {
    if (selectedCountryId !== null && !canSelectCountry()) clearSelectedCountry();
  });
  window.addEventListener("map:generated", clearSelectedCountry);
  window.addEventListener("map:loaded", clearSelectedCountry);
}
