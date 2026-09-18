import type { Zone } from "@/generators/zones-generator";
import { ensureEl, getVertexPath } from "@/utils";

// not read off the editor's select: the paint editor destroys that dialog mid-redraw (#1810)
export const zonesFilter = { type: "all" };

export function drawZones(): void {
  const { type: filterBy } = zonesFilter;
  const isFiltered = filterBy !== "all";
  const visibleZones = pack.zones.filter(
    ({ hidden, cells, type }) => !hidden && cells.length && (!isFiltered || type === filterBy)
  );

  ensureEl("zones").innerHTML = visibleZones.map(drawZone).join("");
}

function drawZone({ i, cells, type, color }: Zone): string {
  const path = getVertexPath(cells, pack);
  return /* html */ `<path id="zone${i}" data-id="${i}" data-type="${type}" d="${path}" fill="${color}" />`;
}
