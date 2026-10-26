import type { Point } from "@/model/graph/voronoi";
import { FlatQueue } from "@/utils/flat-queue";

const WATER_COST = 0.2; // per map unit; land travel costs 1
const SWITCH_SPACINGS = 4; // loading between land and water, in cell spacings

/** A search over the route network; states are `cell * 2`, plus 1 when arriving by water */
export type RouteSearch = { cost: Float64Array; prevCell: Int32Array; prevState: Int32Array };

/** The route network as flat arrays: each cell's links from `offsets[cell]`, with their travel cost and mode */
type RouteGraph = {
  offsets: Int32Array;
  targets: Int32Array;
  costs: Float64Array;
  water: Uint8Array;
  isPort: Uint8Array; // by cell: goods switch between land and water only at a port
  switchCost: number;
};

/** Travel over the route network, shared by trade prices and the trade animation: goods pay for the path they are drawn along */
export class TradeRoutesModule {
  /** Cheapest travel from a cell over routes; with an end cell, stops there and returns its state, otherwise -1 */
  search(startCell: number, endCell = -1, graph = this.buildGraph(), search = this.createSearch()) {
    const { offsets, targets, costs, water, isPort, switchCost } = graph;
    const { cost, prevCell, prevState } = search;
    cost.fill(Infinity);
    cost[startCell * 2] = 0;
    cost[startCell * 2 + 1] = 0;
    const queue = new FlatQueue();

    const visit = (from: number, fromState: number, link: number, baseCost: number) => {
      const isWater = water[link] === 1;
      const switching = fromState !== -1 && isWater !== ((fromState & 1) === 1);
      if (switching && !isPort[from]) return;
      const total = baseCost + costs[link] + (switching ? switchCost : 0);
      const state = targets[link] * 2 + (isWater ? 1 : 0);
      if (total >= cost[state]) return;
      cost[state] = total;
      prevCell[state] = from;
      prevState[state] = fromState;
      queue.push(state, total);
    };

    for (let link = offsets[startCell]; link < offsets[startCell + 1]; link++) visit(startCell, -1, link, 0);

    while (queue.length) {
      const stateCost = queue.peekValue();
      const state = queue.pop();
      if (stateCost > cost[state]) continue;

      const cell = state >> 1;
      if (cell === endCell) return { search, endState: state };
      for (let link = offsets[cell]; link < offsets[cell + 1]; link++) visit(cell, state, link, stateCost);
    }

    return { search, endState: -1 };
  }

  /** Travel cost from each market's center to every burg, by market then burg id; Infinity with no route */
  measure(): Float32Array[] {
    const graph = this.buildGraph();
    const search = this.createSearch();
    const costs: Float32Array[] = [];
    for (const market of pack.markets) {
      const center = pack.burgs[market.centerBurgId];
      if (!center) continue;

      const { cost } = this.search(center.cell, -1, graph, search).search;
      const row = new Float32Array(pack.burgs.length).fill(Infinity);
      for (const burg of pack.burgs) {
        if (!burg?.i || burg.removed) continue;
        row[burg.i] = burg.cell === center.cell ? 0 : Math.min(cost[burg.cell * 2], cost[burg.cell * 2 + 1]);
      }
      costs[market.i] = row;
    }
    return costs;
  }

  private createSearch(): RouteSearch {
    const states = pack.cells.h.length * 2;
    return { cost: new Float64Array(states), prevCell: new Int32Array(states), prevState: new Int32Array(states) };
  }

  /** Each route link's travel cost: its length, a fifth of it on water */
  private buildGraph(): RouteGraph {
    const { cells, routes } = pack;
    const isWaterRoute: boolean[] = [];
    for (const route of routes) isWaterRoute[route.i] = route.group === "searoutes";

    const cellCount = cells.h.length;
    const offsets = new Int32Array(cellCount + 1);
    const targets: number[] = [];
    const costs: number[] = [];
    const water: number[] = [];
    for (let cell = 0; cell < cellCount; cell++) {
      offsets[cell] = targets.length;
      const links = cells.routes[cell];
      if (!links) continue;
      const [x1, y1] = this.getCellPoint(cell);
      for (const next in links) {
        const isWater = isWaterRoute[links[+next]] ?? false;
        const [x2, y2] = this.getCellPoint(+next);
        targets.push(+next);
        costs.push(Math.hypot(x2 - x1, y2 - y1) * (isWater ? WATER_COST : 1));
        water.push(isWater ? 1 : 0);
      }
    }
    offsets[cellCount] = targets.length;

    const isPort = new Uint8Array(cellCount);
    for (const burg of pack.burgs) if (burg?.i && !burg.removed && burg.port) isPort[burg.cell] = 1;

    return {
      offsets,
      targets: Int32Array.from(targets),
      costs: Float64Array.from(costs),
      water: Uint8Array.from(water),
      isPort,
      switchCost: SWITCH_SPACINGS * (globalThis.grid?.spacing || 1)
    };
  }

  /** A burg's position on its cell, otherwise the cell's center */
  getCellPoint(cellId: number): Point {
    const burgId = pack.cells.burg[cellId];
    const burg = burgId ? pack.burgs[burgId] : null;
    return burg ? [burg.x, burg.y] : pack.cells.p[cellId];
  }
}

export const TradeRoutes = new TradeRoutesModule();
