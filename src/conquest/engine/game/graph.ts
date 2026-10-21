/**
 * Graph helpers over the map pack (total-war/.plans/PLAN.md §3.1 step 2 outputs):
 * region adjacency (corruption distance), cell lookups, land-cell indexing.
 */
import type { MapPack } from "../common/types";

export interface GraphIndex {
  /** azgaar land cell id → index into pack.graph.land.cells */
  landIndex: Map<number, number>;
  /** region id → neighboring region ids */
  regionAdjacency: Map<number, Set<number>>;
  /** cell id → region id (land only) */
  cellRegion: Map<number, number>;
  /** cell id → army occupancy is campaign state, not static — not indexed here */
}

const cache = new WeakMap<MapPack, GraphIndex>();

export function graphIndex(pack: MapPack): GraphIndex {
  const hit = cache.get(pack);
  if (hit) return hit;

  const landIndex = new Map<number, number>();
  pack.graph.land.cells.forEach((c, i) => {
    landIndex.set(c.id, i);
  });

  const cellRegion = new Map<number, number>();
  for (const c of pack.graph.land.cells) cellRegion.set(c.id, c.region);

  const regionAdjacency = new Map<number, Set<number>>();
  const link = (a: number, b: number) => {
    if (a === b || a === 0 || b === 0) return;
    (regionAdjacency.get(a) ?? regionAdjacency.set(a, new Set()).get(a)!).add(b);
    (regionAdjacency.get(b) ?? regionAdjacency.set(b, new Set()).get(b)!).add(a);
  };
  for (const [a, b] of pack.graph.land.edges) {
    link(cellRegion.get(a) ?? 0, cellRegion.get(b) ?? 0);
  }

  const idx: GraphIndex = { landIndex, regionAdjacency, cellRegion };
  cache.set(pack, idx);
  return idx;
}

/** BFS steps on the region graph (corruption distance, total-war/.plans/PLAN.md §5.6). */
export function regionDistance(idx: GraphIndex, from: number, to: number): number {
  if (from === to) return 0;
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    for (const n of idx.regionAdjacency.get(cur) ?? []) {
      if (dist.has(n)) continue;
      const d = dist.get(cur)! + 1;
      if (n === to) return d;
      dist.set(n, d);
      queue.push(n);
    }
  }
  return Number.POSITIVE_INFINITY;
}
