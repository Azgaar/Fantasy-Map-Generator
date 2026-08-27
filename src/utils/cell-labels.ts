/**
 * Human labels for a Voronoi cell — journeys use these instead of raw ids
 * so From/To read as places, not indices.
 */

const NEARBY_BURG_MAX_CELLS = 3;

const getBurgAtCell = (cellId: number): { name: string } | undefined => {
  const burgId = pack.cells.burg[cellId];
  if (!burgId) return undefined;
  const burg = pack.burgs[burgId];
  if (!burg || burg.removed) return undefined;
  return { name: burg.name || `Burg ${burg.i}` };
};

/**
 * Find the nearest burg to a cell, within `maxCells` graph steps (BFS).
 * Returns undefined if none is close enough.
 */
const findNearbyBurg = (cellId: number, maxCells: number): { name: string } | undefined => {
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
 * A short display label for an endpoint cell:
 *   - burg name if the cell has a burg
 *   - "near <burg>" if a burg is within a few cells
 *   - "cell <id>" otherwise
 */
export function cellEndpointLabel(cellId: number | undefined): string {
  if (cellId === undefined) return "not set";
  const here = getBurgAtCell(cellId);
  if (here) return here.name;
  const nearby = findNearbyBurg(cellId, NEARBY_BURG_MAX_CELLS);
  if (nearby) return `near ${nearby.name}`;
  return `cell ${cellId}`;
}

/** Longer tooltip form; distinguishes the three cases explicitly. */
export function cellEndpointTooltip(cellId: number | undefined): string {
  if (cellId === undefined) return "Not set — click, then click a cell on the map to set this endpoint";
  const here = getBurgAtCell(cellId);
  if (here) return `${here.name} (cell ${cellId}) — click to pick a different cell`;
  const nearby = findNearbyBurg(cellId, NEARBY_BURG_MAX_CELLS);
  if (nearby) return `Vicinity of ${nearby.name} (cell ${cellId}) — click to pick a different cell`;
  return `Cell ${cellId} — click to pick a different cell`;
}
