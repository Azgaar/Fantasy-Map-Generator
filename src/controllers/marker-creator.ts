import { pointer } from "d3";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import type { Marker } from "@/generators/markers-generator";
import { invalidateMarkerSymbols } from "@/renderers/point-symbols";
import type { Point } from "@/types/global";
import { ensureEl, findEl, rn } from "@/utils";

function toggle(baseMarker?: Marker): void {
  if (findEl("addMarker")?.classList.contains("pressed")) {
    unpressProxyButtons();
    stopMapPlacement();
    return;
  }

  toggleMapPlacement(
    "addMarker",
    event => addOnClick(event, baseMarker),
    "Click on map to add a marker. Hold Shift to add multiple",
    undefined,
    unpressProxyButtons
  );
  document.getElementById("markersAddFromOverview")?.classList.add("pressed");
  document.getElementById("markerAdd")?.classList.add("pressed");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();
}

function addOnClick(event: MouseEvent, baseMarker?: Marker): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  if (!addAt(point, baseMarker)) return;

  if (!event.shiftKey) {
    unpressProxyButtons();
    stopMapPlacement();
  }
}

function addAt(point: Point, baseMarker?: Marker): boolean {
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return false;

  const selectedType = ensureEl<HTMLSelectElement>("addedMarkerType").value;
  const selectedConfig = Markers.getConfig().find(({ type }) => type === selectedType);
  const template = baseMarker || selectedConfig || { icon: "❓", type: "custom" };
  const marker = Markers.add({ ...template, x: rn(point[0], 2), y: rn(point[1], 2), cell } as Marker);

  selectedConfig?.add(`marker${marker.i}`, cell);

  invalidateMarkerSymbols();
  refreshEditors();
  return true;
}

function unpressProxyButtons(): void {
  document.getElementById("markerAdd")?.classList.remove("pressed");
  document.getElementById("markersAddFromOverview")?.classList.remove("pressed");
}

export const MarkerCreator = { addAt, toggle };
