const NEARBY_BURG_MAX_CELLS = 3;
type NamedBurg = { name: string; x: number; y: number };

/** What names a cell: the burg on it, the nearest burg within reach, or nothing at all */
export type CellPlace = { burg: NamedBurg; nearby: boolean } | null;

const getBurgAtCell = (cellId: number): NamedBurg | undefined => {
  const burgId = pack.cells.burg[cellId];
  if (!burgId) return undefined;
  const burg = pack.burgs[burgId];
  if (!burg || burg.removed) return undefined;
  return { name: burg.name || `Burg ${burg.i}`, x: burg.x, y: burg.y };
};

/** Find the nearest burg to a cell, within `maxCells` graph steps (BFS) */
const findNearbyBurg = (cellId: number, maxCells: number): NamedBurg | undefined => {
  if (!pack.cells.burg || !pack.burgs?.length) return undefined;
  const visited = new Set<number>([cellId]);
  let frontier: number[] = [cellId];
  for (let step = 0; step < maxCells; step++) {
    const next: number[] = [];
    for (const c of frontier) {
      const neighbours = pack.cells.c[c] || [];
      for (const n of neighbours) {
        if (visited.has(n)) continue;
        visited.add(n);
        const hit = getBurgAtCell(n);
        if (hit) return hit;
        next.push(n);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return undefined;
};

/**
 * The burg a cell is named after, if any. Every label below is a wording of this one lookup,
 * so a caller needing more than one of them should resolve the place once and format it twice.
 */
export function resolveCellPlace(cellId: number): CellPlace {
  const here = getBurgAtCell(cellId);
  if (here) return { burg: here, nearby: false };
  const nearby = findNearbyBurg(cellId, NEARBY_BURG_MAX_CELLS);
  return nearby ? { burg: nearby, nearby: true } : null;
}

/** A short display label for an endpoint cell */
export function cellEndpointLabel(cellId: number | undefined, place?: CellPlace): string {
  if (cellId === undefined) return "unset";
  const resolved = place === undefined ? resolveCellPlace(cellId) : place;
  if (!resolved) return `cell ${cellId}`;
  return resolved.nearby ? `${resolved.burg.name} vicinity` : resolved.burg.name;
}

/**
 * Where a halt happened, as a phrase a lore template can drop in: "at Redgate", "near Redgate",
 * or null when there is no burg close enough to name. Templates supply their own leading word,
 * so this deliberately differs from {@link cellEndpointLabel}, which is a bare column label.
 */
export function cellPlacePhrase(cellId: number): string | null {
  const place = resolveCellPlace(cellId);
  if (!place) return null;
  return `${place.nearby ? "near" : "at"} ${place.burg.name}`;
}

/** Where to centre the map to show an endpoint: its burg if it has one, else the cell itself */
export function getCellPoint(cellId: number | undefined): [x: number, y: number] | undefined {
  if (cellId === undefined) return undefined;
  const burg = getBurgAtCell(cellId);
  if (burg) return [burg.x, burg.y];
  const point = pack.cells.p[cellId];
  return point ? [point[0], point[1]] : undefined;
}
