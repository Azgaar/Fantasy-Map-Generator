import { pointer } from "d3";
import { refreshEditors } from "@/components/dialog/dialog-helpers";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import type { Marker } from "@/generators/markers-generator";
import { ensureEl, findEl, rn } from "@/utils";
import { sentences, t } from "@/utils/i18n";

function toggle(baseMarker?: Marker): void {
  if (findEl("addMarker")?.classList.contains("pressed")) {
    unpressProxyButtons();
    stopMapPlacement();
    return;
  }

  toggleMapPlacement(
    "addMarker",
    event => addOnClick(event, baseMarker),
    sentences(t("Click on map to place a marker"), t("Hold Shift to add multiple")),
    undefined,
    unpressProxyButtons
  );
  document.getElementById("markersAddFromOverview")?.classList.add("pressed");
  document.getElementById("markerAdd")?.classList.add("pressed");
  Layers.show("markers");
}

function addOnClick(event: MouseEvent, baseMarker?: Marker): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = Pack.findCell(point[0], point[1]);
  if (cell === undefined) return;

  const selectedType = ensureEl<HTMLSelectElement>("addedMarkerType").value;
  const selectedConfig = Markers.getConfig().find(({ type }) => type === selectedType);
  const template = baseMarker || selectedConfig || { icon: Icons.glyph("❓"), type: "custom" };
  const marker = Markers.add({ ...template, x: rn(point[0], 2), y: rn(point[1], 2), cell } as Marker);
  selectedConfig?.add(marker, cell);

  Layers.draw("markers");
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
