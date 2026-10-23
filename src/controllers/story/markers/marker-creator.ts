import { pointer } from "d3";
import { Pack } from "@/model/graph/pack-generator";
import { Icons } from "@/model/icons";
import type { Marker } from "@/model/story/markers-generator";
import { Markers } from "@/model/story/markers-generator";
import { Layers } from "@/renderers/layers";
import { refreshEditors } from "@/ui/dialog/dialog-helpers";
import { stopMapPlacement, toggleMapPlacement } from "@/ui/map/map-placement";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

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
  findEl("markersAddFromOverview")?.classList.add("pressed");
  findEl("markerAdd")?.classList.add("pressed");
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
  findEl("markerAdd")?.classList.remove("pressed");
  findEl("markersAddFromOverview")?.classList.remove("pressed");
}

export const MarkerCreator = { toggle };
