import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

const findMarker = (id: number) => pack.markers.find(marker => marker.i === id);
const isMarkerDeletable = (id: number): boolean => !!findMarker(id);
const isMarkerLocked = (id: number): boolean => !!findMarker(id)?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isMarkerDeletable(id) && !isMarkerLocked(id));
  const skippedLocked = ids.filter(id => isMarkerDeletable(id) && isMarkerLocked(id)).length;
  return {
    lines: [`${plural(deletableIds.length, "marker")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked
  };
}

/**
 * Build the Markers bulk adapter (legacy-JS menu). Rows carry `data-i` (not data-id)
 * and markers are stored in a plain array keyed by `.i`. Delete mirrors the menu's
 * single-delete: drop the marker note, filter it out of pack.markers, and remove its
 * map element. No color, no children. `redraw` is injected by the menu.
 */
export function createMarkersAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "markers",
    containerId: "markersBody",
    footerId: "markersBottom",
    supportsColor: false,
    getRowId: row => {
      const id = Number(row.dataset.i);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isMarkerDeletable,
    isLocked: isMarkerLocked,
    setLock: (id, locked) => {
      const marker = findMarker(id);
      if (!marker) return;
      if (locked) marker.lock = true;
      else delete marker.lock;
    },
    deleteEntity: id => {
      notes = notes.filter(note => note.id !== `marker${id}`);
      pack.markers = pack.markers.filter(marker => marker.i !== id);
      document.getElementById(`marker${id}`)?.remove();
    },
    describeCascade,
    redraw
  };
}
