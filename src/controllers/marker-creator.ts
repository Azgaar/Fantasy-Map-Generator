import { pointer, select } from "d3";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import type { Marker } from "@/generators/markers-generator";
import { drawMarker } from "@/renderers/draw-markers";
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
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;

  const selectedType = ensureEl<HTMLSelectElement>("addedMarkerType").value;
  const selectedConfig = Markers.getConfig().find(({ type }) => type === selectedType);
  const template = baseMarker || selectedConfig || { icon: "❓", type: "custom" };
  const marker = Markers.add({ ...template, x: rn(point[0], 2), y: rn(point[1], 2), cell } as Marker);

  selectedConfig?.add(`marker${marker.i}`, cell);

  const markersElement = select<SVGGElement, unknown>("#markers");
  const rescale = +markersElement.attr("rescale");
  markersElement.node()?.insertAdjacentHTML("beforeend", drawMarker(marker, rescale));
  refreshEditors();

  if (!event.shiftKey) {
    unpressProxyButtons();
    stopMapPlacement();
  }
}

function unpressProxyButtons(): void {
  document.getElementById("markerAdd")?.classList.remove("pressed");
  document.getElementById("markersAddFromOverview")?.classList.remove("pressed");
}

export const MarkerCreator = { toggle };
