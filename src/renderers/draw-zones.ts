import type { Zone } from "@/generators/zones-generator";
import { ensureEl, findEl, getVertexPath } from "@/utils";

export function drawZones(): void {
  const filterBy = findEl<HTMLSelectElement>("zonesFilterType")?.value;
  const isFiltered = filterBy && filterBy !== "all";
  const visibleZones = pack.zones.filter(
    ({ hidden, cells, type }) => !hidden && cells.length && (!isFiltered || type === filterBy)
  );

  ensureEl("zones").innerHTML = visibleZones.map(drawZone).join("");
}

function drawZone({ i, cells, type, color }: Zone): string {
  const path = getVertexPath(cells, pack);
  return /* html */ `<path id="zone${i}" data-id="${i}" data-type="${type}" d="${path}" fill="${color}" />`;
}
