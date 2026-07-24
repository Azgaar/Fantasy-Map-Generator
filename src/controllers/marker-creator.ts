import { pointer, select } from "d3";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import type { Marker } from "@/generators/markers-generator";
import { drawMarker } from "@/renderers/draw-markers";
import { ensureEl, findEl, rn } from "@/utils";

function toggle(): void {
  if (findEl("addMarker")?.classList.contains("pressed")) {
    unpressProxyButtons();
    stopMapPlacement();
    return;
  }

  toggleMapPlacement("addMarker", addOnClick, "Click on map to add a marker. Hold Shift to add multiple");
  document.getElementById("markersAddFromOverview")?.classList.add("pressed");
  document.getElementById("markerAdd")?.classList.add("pressed");
  if (!layerIsOn("toggleMarkers")) toggleMarkers();
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = findCell(point[0], point[1]);
  if (cell === undefined) return;

  const { markers } = pack;
  const isMarkerSelected = markers.length && elSelected?.node()?.parentElement?.id === "markers";
  const selectedMarker = isMarkerSelected ? markers.find(marker => marker.i === +elSelected.attr("id").slice(6)) : null;
  const selectedType = ensureEl<HTMLSelectElement>("addedMarkerType").value;
  const selectedConfig = Markers.getConfig().find(({ type }) => type === selectedType);
  const baseMarker = selectedMarker || selectedConfig || { icon: "❓", type: "custom" };
  const marker = Markers.add({ ...baseMarker, x: rn(point[0], 2), y: rn(point[1], 2), cell } as Marker);

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
