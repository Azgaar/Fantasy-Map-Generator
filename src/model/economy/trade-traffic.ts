import { DEAL_KINDS } from "@/model/economy/deals";
import { TradeRoutes } from "./trade-routes";

/** A route link's traffic: units of each good carried over it either way a day, by good id */
export type TrafficLink = { cells: [number, number]; goods: Map<number, number>; water: boolean };

export class TradeTrafficModule {
  private source: unknown = null; // the deals the cache describes
  private network: unknown = null; // and the route links they followed
  private routeCount = 0;
  private links = new Map<number, TrafficLink>(); // by link key

  /** Every link that carried goods in the last run */
  getLinks(): TrafficLink[] {
    this.index();
    return [...this.links.values()];
  }

  /** The link between two neighbor cells, if it carried goods */
  get(cellA: number, cellB: number): TrafficLink | undefined {
    this.index();
    return this.links.get(this.key(cellA, cellB));
  }

  private key(a: number, b: number): number {
    const count = pack.cells.h.length;
    return a < b ? a * count + b : b * count + a;
  }

  /** Each deal's goods follow the cheapest route, as their carriage was priced */
  private index(): void {
    const { cells, routes } = pack;
    if (this.source === pack.deals && this.network === cells.routes && this.routeCount === routes.length) return;
    this.source = pack.deals;
    this.network = cells.routes;
    this.routeCount = routes.length;
    this.links.clear();
    if (!pack.deals?.length) return;

    const goodsByMarket = new Map<number, Map<number, Map<number, number>>>(); // market id → burg cell → good id → units
    for (const [burgId, marketId, goodId, kind, units] of pack.deals) {
      const cell = pack.burgs[burgId]?.cell;
      if (kind === DEAL_KINDS.kept || !units || cell === undefined) continue;
      const cells = goodsByMarket.get(marketId) ?? new Map<number, Map<number, number>>();
      const goods = cells.get(cell) ?? new Map<number, number>();
      goods.set(goodId, (goods.get(goodId) ?? 0) + Math.abs(units));
      cells.set(cell, goods);
      goodsByMarket.set(marketId, cells);
    }

    const graph = TradeRoutes.buildGraph();
    const search = TradeRoutes.createSearch();
    for (const market of pack.markets) {
      const center = pack.burgs[market.centerBurgId];
      const cells = goodsByMarket.get(market.i);
      if (!center || !cells) continue;

      const { cost, prevCell, prevState } = TradeRoutes.search(center.cell, -1, graph, search).search;
      for (const [cell, goods] of cells) {
        if (cell === center.cell) continue;
        let state = cost[cell * 2] <= cost[cell * 2 + 1] ? cell * 2 : cell * 2 + 1;
        if (cost[state] === Infinity) continue;
        while (state !== -1) {
          this.add(prevCell[state], state >> 1, goods, (state & 1) === 1);
          state = prevState[state];
        }
      }
    }
  }

  private add(from: number, to: number, goods: Map<number, number>, water: boolean): void {
    const key = this.key(from, to);
    let link = this.links.get(key);
    if (!link) {
      link = { cells: [from, to], goods: new Map(), water };
      this.links.set(key, link);
    }
    for (const [goodId, units] of goods) link.goods.set(goodId, (link.goods.get(goodId) ?? 0) + units);
  }
}

export const TradeTraffic = new TradeTrafficModule();
