import { plural } from "../../../utils/stringUtils";
import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

const findZone = (id: number) => pack.zones.find(zone => zone.i === id);
const isZoneDeletable = (id: number): boolean => !!findZone(id);
function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isZoneDeletable(id));
  return {
    lines: [`${plural(deletableIds.length, "zone")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked: 0
  };
}

/**
 * Build the Zones bulk adapter (legacy-JS menu). Zones have no lock concept, so no
 * setLock is exposed (the bar then shows no Lock/Unlock) and isLocked is always
 * false. Delete mirrors the menu's single-delete: filter the zone out of pack.zones,
 * remove its map group, and clear its fog. Color is supported; `redraw` is injected.
 */
export function createZonesAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "zones",
    containerId: "zonesBodySection",
    footerId: "zonesBottom",
    supportsColor: true,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isZoneDeletable,
    isLocked: () => false,
    setColor: (id, color) => {
      const zone = findZone(id);
      if (zone) zone.color = color;
    },
    deleteEntity: id => {
      pack.zones = pack.zones.filter(zone => zone.i !== id);
      zones.select(`#zone${id}`).remove();
      unfog(`focusZone${id}`);
    },
    describeCascade,
    redraw
  };
}
