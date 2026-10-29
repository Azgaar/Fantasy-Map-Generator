// The anomaly conversion: rewrite every marker's legend and icon in the sector register, keeping
// the original text. One-way and idempotent. See docs/plans/astral-anomalies.md
import { Dialog } from "@/ui/dialog/dialog";
import { Icons } from "@/model/icons";
import { Layers } from "@/renderers/layers";
import { tip } from "@/ui/tooltips";
import { ANOMALY_DIVIDER, astralLegend, MARKER_READINGS } from "@/data/astral-markers";
import { capitalize } from "@/utils/string-utils";

function isConverted(marker: { note?: string }): boolean {
  return marker.note?.includes(ANOMALY_DIVIDER) ?? false;
}

function convertible(): typeof pack.markers {
  return pack.markers.filter(marker => MARKER_READINGS[marker.type] && !marker.hidden && !isConverted(marker));
}

function apply(): void {
  const count = convertible().length;
  if (!count) {
    tip("There is nothing to convert: every anomaly already reads in the sector register", true, "info", 6000);
    return;
  }

  Dialog.confirm({
    title: "Convert anomalies",
    message:
      `The ${count} markers of this map will take their anomaly legends and icons.` +
      "<br><br>Each legend is rewritten in the sector register and the original text is kept below a divider." +
      "<br>This cannot be undone in one step: restore a legend from the notes editor.",
    confirm: "Convert",
    onConfirm: convert
  });
}

function convert(): void {
  let converted = 0;
  for (const marker of pack.markers) {
    const reading = MARKER_READINGS[marker.type];
    if (!reading || marker.hidden || isConverted(marker)) continue;
    const legend = astralLegend(marker.type, `${marker.i}|${marker.name ?? ""}`);
    if (!legend) continue;

    const original = marker.note ? `${ANOMALY_DIVIDER}${marker.note}` : "";
    // written directly, like the generator's own notes: dungeon and encounter legends carry
    // iframes the notes editor subset rejects, and the original text must survive whole
    marker.note = `${legend}${original}`;
    marker.icon = Icons.reference(reading.icon);
    if (!marker.name) marker.name = capitalize(reading.reading);
    converted++;
  }

  Layers.draw("markers");
  tip(`Converted ${converted} anomal${converted === 1 ? "y" : "ies"}`, true, "success", 6000);
}

export const AstralMarkers = { apply };
