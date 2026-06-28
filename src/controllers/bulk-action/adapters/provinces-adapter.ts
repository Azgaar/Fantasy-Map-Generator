import type { Province } from "@/generators/provinces-generator";
import { plural } from "../../../utils/stringUtils";
import type { BulkDeleteOptions, BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

const isProvinceDeletable = (id: number): boolean => id !== 0 && !!pack.provinces[id] && !pack.provinces[id].removed;
const isProvinceLocked = (id: number): boolean => !!pack.provinces[id]?.lock;
/**
 * Burgs contained in a province, enumerated from cells the way the editor's
 * collectStatistics does (a burg belongs to the province of the cell it sits in).
 * This is the canonical source while the editor is open and avoids relying on the
 * province.burgs cache.
 */
function getProvinceBurgs(provinceId: number): number[] {
  const burgIds: number[] = [];
  pack.cells.province.forEach((cellProvince: number, cellIndex: number) => {
    if (cellProvince !== provinceId) return;
    const burgId = pack.cells.burg[cellIndex];
    if (burgId && pack.burgs[burgId] && !pack.burgs[burgId].removed) burgIds.push(burgId);
  });
  return burgIds;
}

function describeCascade(ids: number[], options: BulkDeleteOptions = {}): CascadeSummary {
  const deletableIds = ids.filter(id => isProvinceDeletable(id) && !isProvinceLocked(id));
  const skippedLocked = ids.filter(id => isProvinceDeletable(id) && isProvinceLocked(id)).length;

  let burgs = 0;
  deletableIds.forEach(id => {
    burgs += getProvinceBurgs(id).length;
  });

  const lines = [`${plural(deletableIds.length, "province")} will be removed`];
  if (burgs) {
    lines.push(
      options.deleteChildren
        ? `${plural(burgs, "burg")} will be removed`
        : `${plural(burgs, "burg")} will be unassigned`
    );
  }

  return { lines, deletable: deletableIds.length, skippedLocked };
}

/**
 * Remove one province from pack, mirroring the provinces editor's single-delete:
 * release its cells, drop it from its owner state's list, and clear its map
 * artifacts. With deleteChildren the contained burgs are removed via the trusted
 * global Burgs.remove; otherwise they stay put but become unassigned (their cells'
 * province is cleared). No list/border redraw here — the caller redraws once.
 */
function removeProvince(provinceId: number, options: BulkDeleteOptions = {}): void {
  const province = pack.provinces[provinceId];
  if (!provinceId || !province || province.removed) return;

  if (options.deleteChildren) {
    getProvinceBurgs(provinceId).forEach(burgId => {
      Burgs.remove(burgId);
    });
  }

  // release the province's cells (this also unassigns any remaining burgs)
  pack.cells.province.forEach((cellProvince: number, cellIndex: number) => {
    if (cellProvince === provinceId) pack.cells.province[cellIndex] = 0;
  });

  // drop the province from its owner state's list
  const state = pack.states[province.state];
  if (state?.provinces?.includes(provinceId)) {
    state.provinces.splice(state.provinces.indexOf(provinceId), 1);
  }

  // clear map artifacts (emblem, COA, fog, SVG path/gap)
  unfog(`focusProvince${provinceId}`);
  document.getElementById(`provinceCOA${provinceId}`)?.remove();
  emblems.select(`#provinceEmblems > use[data-i='${provinceId}']`).remove();
  const provincesBody = provs.select("#provincesBody");
  provincesBody.select(`#province${provinceId}`).remove();
  provincesBody.select(`#province-gap${provinceId}`).remove();

  pack.provinces[provinceId] = { i: provinceId, removed: true } as Province;
}

/**
 * Build the Provinces bulk adapter (legacy-JS menu). Provinces own burgs, so the
 * adapter exposes the "burgs" childKind: deleting with the child option removes the
 * contained burgs, without it they are unassigned. `redraw` is injected by the menu.
 */
export function createProvincesAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "provinces",
    containerId: "provincesBodySection",
    footerId: "provincesBottom",
    supportsColor: true,
    childKind: "burgs",
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isProvinceDeletable,
    isLocked: isProvinceLocked,
    setLock: (id, locked) => {
      if (pack.provinces[id]) pack.provinces[id].lock = locked;
    },
    setColor: (id, color) => {
      if (pack.provinces[id]) pack.provinces[id].color = color;
    },
    deleteEntity: (id, options) => removeProvince(id, options),
    describeCascade,
    redraw
  };
}
