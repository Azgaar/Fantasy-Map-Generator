/**
 * Movement (total-war/.plans/PLAN.md §5.2): edge costs, A* pathfinding, MP accounting.
 * All costs are advisory here and authoritative inside command validation —
 * clients get candidate paths from the /path endpoint but the server re-validates.
 */

import type { MapPack } from "../common/types";
import type { CampaignConfig } from "./config";
import { type GraphIndex, graphIndex } from "./graph";
import type { Stance } from "./state";

interface PathResult {
  path: number[];
  cost: number;
  reachable: boolean;
}

const adj = new WeakMap<MapPack, Map<number, { to: number; cost: number; road: 0 | 1 | 2; river: boolean }[]>>();

function adjacency(pack: MapPack): Map<number, { to: number; cost: number; road: 0 | 1 | 2; river: boolean }[]> {
  const hit = adj.get(pack);
  if (hit) return hit;
  const map = new Map<number, { to: number; cost: number; road: 0 | 1 | 2; river: boolean }[]>();
  for (const [a, b, cost, road, river] of pack.graph.land.edges) {
    (map.get(a) ?? map.set(a, []).get(a)!).push({ to: b, cost, road, river: river === 1 });
    (map.get(b) ?? map.set(b, []).get(b)!).push({ to: a, cost, road, river: river === 1 });
  }
  adj.set(pack, map);
  return map;
}

/** Normalized movement cost of one edge for an army's stance (config-scaled). */
export function edgeCost(pack: MapPack, config: CampaignConfig, from: number, to: number, stance: Stance): number {
  const edge = adjacency(pack)
    .get(from)
    ?.find(e => e.to === to);
  if (!edge) return Number.POSITIVE_INFINITY;
  const roadMult =
    edge.road === 2 ? config.movement.roadMultiplier : edge.road === 1 ? config.movement.trailMultiplier : 1;
  const stanceMult = config.movement.stanceMultipliers[stance] ?? 1;
  return (edge.cost / config.movement.costDivisor) * roadMult * stanceMult;
}

export function maxMovement(config: CampaignConfig, stance: Stance): number {
  return config.movement.basePoints * (config.movement.stanceMultipliers[stance] ?? 1);
}

/** A* with deterministic tie-breaks (lower cell id wins). */
export function findPath(pack: MapPack, config: CampaignConfig, from: number, to: number): PathResult {
  const idx = graphIndex(pack);
  if (!idx.landIndex.has(from) || !idx.landIndex.has(to)) return { path: [], cost: 0, reachable: false };
  if (from === to) return { path: [from], cost: 0, reachable: true };

  const distG = new Map<number, number>([[from, 0]]);
  const cameFrom = new Map<number, number>();
  const open: { id: number; f: number }[] = [{ id: from, f: 0 }];

  const heuristic = (a: number, b: number): number => {
    const pa = pack.graph.land.cells[idx.landIndex.get(a)!]!.p;
    const pb = pack.graph.land.cells[idx.landIndex.get(b)!]!.p;
    return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) / config.movement.costDivisor;
  };

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i]!;
      const b = open[bestIdx]!;
      if (a.f < b.f || (a.f === b.f && a.id < b.id)) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!.id;
    if (current === to) {
      const path = [current];
      let cur = current;
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)!;
        path.unshift(cur);
      }
      return { path, cost: distG.get(to)!, reachable: true };
    }
    for (const edge of adjacency(pack).get(current) ?? []) {
      // A* uses stance-neutral costs; stance is applied per-army in pathCost/commands.
      const g = distG.get(current)! + edgeCost(pack, config, current, edge.to, "normal");
      if (g < (distG.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distG.set(edge.to, g);
        cameFrom.set(edge.to, current);
        const f = g + heuristic(edge.to, to);
        if (!open.some(o => o.id === edge.to)) open.push({ id: edge.to, f });
      }
    }
  }
  return { path: [], cost: 0, reachable: false };
}

export function riverCrossing(pack: MapPack, from: number, to: number): boolean {
  const edge = adjacency(pack)
    .get(from)
    ?.find(e => e.to === to);
  return edge?.river ?? false;
}

export type { GraphIndex };
