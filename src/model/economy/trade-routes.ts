import type { Point } from "@/model/graph/voronoi";
import { FlatQueue } from "@/utils/flat-queue";

const WATER_COST = 0.2; // per map unit; land travel costs 1
const SWITCH_SPACINGS = 4; // loading between land and water, in cell spacings

/** A search over the route network; states are `cell * 2`, plus 1 when arriving by water */
export type RouteSearch = { cost: Float64Array; prevCell: Int32Array; prevState: Int32Array };

/** Travel over the route network, shared by trade prices and the trade animation: goods pay for the path they are drawn along */
export class TradeRoutesModule {
  /** Cheapest travel from a cell over routes; with an end cell, stops there and returns its state, otherwise -1 */
  search(startCell: number, endCell = -1): { search: RouteSearch; endState: number } {
    const { cells, routes } = pack;
    const states = cells.h.length * 2;
    const search: RouteSearch = {
      cost: new Float64Array(states).fill(Infinity),
      prevCell: new Int32Array(states).fill(-1),
      prevState: new Int32Array(states).fill(-1)
    };
    const { cost, prevCell, prevState } = search;
    const isWaterRoute: boolean[] = [];
    for (const route of routes) isWaterRoute[route.i] = route.group === "searoutes";
    const switchCost = SWITCH_SPACINGS * (globalThis.grid?.spacing || 1);

    cost[startCell * 2] = 0;
    cost[startCell * 2 + 1] = 0;
    const queue = new FlatQueue();
    const visit = (from: number, fromState: number, to: number, routeId: number, baseCost: number) => {
      const water = isWaterRoute[routeId] ?? false;
      const [x1, y1] = this.getCellPoint(from);
      const [x2, y2] = this.getCellPoint(to);
      const switching = fromState !== -1 && water !== ((fromState & 1) === 1);
      const total = baseCost + Math.hypot(x2 - x1, y2 - y1) * (water ? WATER_COST : 1) + (switching ? switchCost : 0);
      const state = to * 2 + (water ? 1 : 0);
      if (total >= cost[state]) return;
      cost[state] = total;
      prevCell[state] = from;
      prevState[state] = fromState;
      queue.push(state, total);
    };

    const startLinks = cells.routes[startCell] ?? {};
    for (const next in startLinks) visit(startCell, -1, +next, startLinks[+next], 0);

    while (queue.length) {
      const stateCost = queue.peekValue();
      const state = queue.pop();
      if (stateCost > cost[state]) continue;

      const cell = state >> 1;
      if (cell === endCell) return { search, endState: state };

      const links = cells.routes[cell] ?? {};
      for (const next in links) visit(cell, state, +next, links[+next], stateCost);
    }

    return { search, endState: -1 };
  }

  /** Travel cost from each market's center to every burg, by market then burg id; Infinity with no route */
  measure(): Float32Array[] {
    const costs: Float32Array[] = [];
    for (const market of pack.markets) {
      const center = pack.burgs[market.centerBurgId];
      if (!center) continue;

      const { cost } = this.search(center.cell).search;
      const row = new Float32Array(pack.burgs.length).fill(Infinity);
      for (const burg of pack.burgs) {
        if (!burg?.i || burg.removed) continue;
        row[burg.i] = burg.cell === center.cell ? 0 : Math.min(cost[burg.cell * 2], cost[burg.cell * 2 + 1]);
      }
      costs[market.i] = row;
    }
    return costs;
  }

  /** A burg's position on its cell, otherwise the cell's center */
  getCellPoint(cellId: number): Point {
    const burgId = pack.cells.burg[cellId];
    const burg = burgId ? pack.burgs[burgId] : null;
    return burg ? [burg.x, burg.y] : pack.cells.p[cellId];
  }
}

export const TradeRoutes = new TradeRoutesModule();
