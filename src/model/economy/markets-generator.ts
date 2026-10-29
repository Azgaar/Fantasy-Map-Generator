// Markets: where they stand, the land each serves, and their names and colors

import Alea from "alea";
import { quadtree } from "d3-quadtree";
import type { Burg } from "@/model/political/burgs-generator";
import { States } from "@/model/political/states-generator";
import { getColors, getRandomColor, requireFill } from "@/utils/color-utils";
import { FlatQueue } from "@/utils/flat-queue";
import { t } from "@/utils/i18n";
import { notify } from "@/utils/notices";
import { minmax } from "@/utils/number-utils";

const OTHER_LANDMASS_SPACING = 0.5; // share of the market spacing a market on another landmass keeps clear
export const MARKET_FEE_DETERRENCE = 25; // a state's market fee a day that halves a burg's chance to be a market center and doubles the area each market needs
const CROSSROADS_BONUS = 0.25; // score a burg gains for each route beyond a road through it, up to 4 more
const SPACING_RANGE = [0.5, 2.5]; // the spacing a burg needs, as a share of the base, from the busiest land to the emptiest
const DENSITY_PULL = 0.6; // how far markets follow burgs: 1 gives every market about as many burgs, 0 spaces them evenly

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  name?: string;
  goods: Record<number, { stock: number; price: number }>;
  rural?: RuralDay; // its rural people's last day, kept from the economy run
  feePaid?: number; // license fee its center burg paid its state in the last economy run
  note?: string;
};

/** A market's rural people's day: what their produce earned, what they bought with it, and the poll tax they owed and paid by state */
export type RuralDay = {
  earned: number;
  spent: number;
  bought: [goodId: number, units: number][];
  margin?: number; // what the market's center took on their purchases, in no deal
  pollTax?: [stateId: number, owed: number, paid: number][];
};

export class MarketsModule {
  private marketById: Market[] = [];
  revision = 0; // bumped when a market is added or moved without replacing pack.markets

  regenerate(): Market[] {
    return this.generate(true);
  }

  generate(regenerate: boolean = false): Market[] {
    if (!regenerate) Math.random = Alea(options.map.seed);
    const markets = this.createMarkets();
    this.expandMarkets(markets);

    pack.markets = markets;
    pack.deals = [];

    return markets;
  }

  private createMarkets(): Market[] {
    const feeFactor = (burg: Burg) => 1 + States.getMarketFee(burg.state || 0) / MARKET_FEE_DETERRENCE;
    // Score each burg by population; capitals, ports and crossroads are weighted higher, a dear market license lower
    const scored = pack.burgs
      .map(burg => {
        let score = burg.population || 0;
        if (burg.capital) score *= 2.5;
        if (burg.port) score *= 1.2;
        const roads = Object.keys(pack.cells.routes?.[burg.cell!] ?? {}).length;
        score *= 1 + CROSSROADS_BONUS * minmax(roads - 2, 0, 4);
        score /= feeFactor(burg);
        score *= Math.random() * 2 + 0.5; // add some noise
        return { burg, score };
      })
      .sort((a, b) => b.score - a.score);

    const spacing = this.getSpacing(
      scored.map(({ burg }) => burg).filter(burg => burg.i && !burg.removed),
      feeFactor
    );

    const markets: Market[] = [];
    this.marketById = [];
    const newTree = () =>
      quadtree<[number, number, number]>(
        [],
        d => d[0],
        d => d[1]
      );
    const tree = newTree();
    const treeByLandmass = new Map<number, ReturnType<typeof newTree>>();
    const place = (burg: Burg) => {
      const marketId = markets.length + 1;
      const market = { i: marketId, centerBurgId: burg.i!, color: "", goods: {} };
      markets.push(market);
      this.marketById[marketId] = market;
      tree.add([burg.x, burg.y, marketId]);
      if (!treeByLandmass.has(burg.feature!)) treeByLandmass.set(burg.feature!, newTree());
      treeByLandmass.get(burg.feature!)!.add([burg.x, burg.y, marketId]);
    };

    const living = scored.filter(({ burg }) => burg.i && !burg.removed);
    for (const { burg } of living) {
      const { x, y } = burg;
      const minSpacing = spacing.get(burg.i!)!;
      // a market across the water is a world apart: it blocks a new one only when much closer
      const blocked =
        treeByLandmass.get(burg.feature!)?.find(x, y, minSpacing) ||
        tree.find(x, y, minSpacing * OTHER_LANDMASS_SPACING);
      if (!blocked) place(burg);
    }

    // a landmass with burgs but no port has no sea routes to the rest: it trades within itself
    const portLandmasses = new Set(living.filter(({ burg }) => burg.port).map(({ burg }) => burg.feature));
    for (const { burg } of living) {
      if (!portLandmasses.has(burg.feature) && !treeByLandmass.has(burg.feature!)) place(burg);
    }

    const colors = getColors(markets.length);
    markets.forEach((m, i) => {
      m.color = colors[i];
    });

    return markets;
  }

  /** How far a burg must be from other market centers to become one: closer where burgs crowd and licenses are cheap */
  private getSpacing(burgs: Burg[], feeFactor: (burg: Burg) => number): Map<number, number> {
    const base = ((options.map.graph.width + options.map.graph.height) * 2.5) / pack.burgs.length ** 0.6;
    const tree = quadtree<Burg>(
      burgs,
      burg => burg.x,
      burg => burg.y
    );
    const neighbors = burgs.map(({ x, y }) => {
      let count = 0;
      tree.visit((node, x0, y0, x1, y1) => {
        if (!node.length) {
          for (let leaf: typeof node | undefined = node; leaf; leaf = leaf.next) {
            const { data } = leaf as { data: Burg };
            if ((data.x - x) ** 2 + (data.y - y) ** 2 < base ** 2) count++;
          }
        }
        return x0 > x + base || x1 < x - base || y0 > y + base || y1 < y - base;
      });
      return count;
    });
    const fees = burgs.map(feeFactor);
    const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / (values.length || 1);
    const meanNeighbors = mean(neighbors);
    const meanFee = mean(fees);
    const [min, max] = SPACING_RANGE;
    return new Map(
      burgs.map((burg, index) => {
        const area = (meanNeighbors / neighbors[index]) ** DENSITY_PULL * (fees[index] / meanFee);
        return [burg.i!, base * minmax(Math.sqrt(area), min, max)];
      })
    );
  }

  expandTerritories(): Uint16Array {
    this.sync();
    return this.expandMarkets(pack.markets);
  }

  sync(): void {
    this.marketById = [];
    for (const market of pack.markets) if (market) this.marketById[market.i] = market;
  }

  private expandMarkets(markets: Market[]): Uint16Array {
    const cells = pack.cells;
    const cellMarket = new Uint16Array(cells.i.length);
    const costs: number[] = [];
    const queue = new FlatQueue<{ cellId: number; marketId: number; burg: Burg; priority: number }>();

    const MIN_COST = 1;
    const BASE_COST = 10;
    const DIFFERENT_STATE_COST = 200;
    const WATER_COST = 50;
    const WATER_COST_FOR_NON_PORTS = 50;
    const ISLAND_CHANGE_COST = 100;

    const nativeOwner = new Uint8Array(cells.i.length); // cell is owned by a market of its own state

    const tradeCenters = {} as Record<number, boolean>;
    for (const market of markets) {
      const centerBurg = pack.burgs[market.centerBurgId];
      if (!centerBurg) continue;
      tradeCenters[centerBurg.i] = true;

      const startCell = centerBurg.cell;
      cellMarket[startCell] = market.i;
      costs[startCell] = MIN_COST;

      queue.push({ cellId: startCell, marketId: market.i, burg: centerBurg, priority: 0 }, 0);
    }

    while (queue.length) {
      const { cellId, marketId, burg, priority } = queue.pop();

      for (const neighborId of cells.c[cellId]) {
        const isWater = cells.h[neighborId] < 20;
        const isNative = Boolean(cells.state[neighborId]) && burg.state === cells.state[neighborId];
        let cost = BASE_COST;
        if (isWater) {
          cost += WATER_COST;
          if (burg.port !== cells.f[neighborId]) cost += WATER_COST_FOR_NON_PORTS;
        } else {
          if (cells.f[burg.cell] !== cells.f[neighborId]) cost += ISLAND_CHANGE_COST;
          if (cells.state[neighborId] && !isNative) cost += DIFFERENT_STATE_COST;
        }

        const totalCost = priority + cost;
        const nativeTie = totalCost === costs[neighborId] && isNative && !nativeOwner[neighborId];
        if (!costs[neighborId] || totalCost < costs[neighborId] || nativeTie) {
          costs[neighborId] = totalCost;
          queue.push({ cellId: neighborId, marketId, burg, priority: totalCost }, totalCost);

          const hasGood = Boolean(cells.good[neighborId]);
          if (isWater && !hasGood) continue; // exclude water cells without goods

          cellMarket[neighborId] = marketId;
          nativeOwner[neighborId] = isNative ? 1 : 0;
        }
      }
    }

    pack.cells.market = cellMarket;

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      burg.plaza = burg.plaza || tradeCenters[burg.i] ? 1 : 0;
    }

    return cellMarket;
  }

  public get(marketId: number | undefined): Market | undefined {
    if (!marketId) return undefined;
    return this.marketById[marketId];
  }

  /** The market of the burg's cell */
  ofBurg(burg: Burg): Market | undefined {
    return this.get(pack.cells.market?.[burg.cell]);
  }

  /** Rename a market; empty takes its center burg's name again */
  rename(marketId: number, name: string): void {
    const market = this.living(marketId);
    if (typeof name !== "string") throw new Error("The name must be text");
    if (name.trim()) market.name = name.trim();
    else delete market.name;
  }

  /** Set a market's color on the Markets layer */
  recolor(marketId: number, color: string): void {
    this.living(marketId).color = requireFill(color);
  }

  private living(marketId: number): Market {
    const market = pack.markets?.find(({ i }) => i === marketId);
    if (!market) throw new Error(`Market ${marketId} does not exist`);
    return market;
  }

  // Display name: the custom name if set, otherwise derived from the center burg.
  public getName(market: Market): string {
    return market.name || pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
  }

  addMarket(burgId: number): Market | null {
    const burg = (pack.burgs as Burg[])[burgId];
    if (!burg || burg.removed) return null;

    if (pack.markets.some(m => m.centerBurgId === burgId)) {
      notify(t("This burg is already a market center"), "error");
      return null;
    }

    const maxId = pack.markets.reduce((max, m) => Math.max(max, m.i), 0);
    const marketId = maxId + 1;
    const market: Market = { i: marketId, centerBurgId: burgId, color: getRandomColor(), goods: {} };
    pack.markets.push(market);
    pack.deals = [];

    this.sync();
    this.revision++;
    pack.cells.market[burg.cell] = marketId;
    burg.plaza = 1;

    return market;
  }

  // Move the market center to another burg. Keeps territories, goods, production and deals intact.
  relocateMarket(marketId: number, newBurgId: number): Market | null {
    const market = this.get(marketId);
    if (!market) return null;

    const newCenter = pack.burgs[newBurgId];
    if (!newCenter || newCenter.removed) return null;
    if (market.centerBurgId === newBurgId) return null;
    if (pack.markets.some(m => m.centerBurgId === newBurgId)) return null;

    const oldCenter = pack.burgs[market.centerBurgId];
    if (oldCenter) oldCenter.plaza = 0;

    market.centerBurgId = newBurgId;
    this.revision++;
    pack.cells.market[newCenter.cell] = marketId;
    newCenter.plaza = 1;

    return market;
  }

  removeMarket(marketId: number) {
    const market = this.get(marketId);
    if (!market) return;

    const centerBurg = pack.burgs[market.centerBurgId];
    if (centerBurg) centerBurg.plaza = 0;

    pack.deals = pack.deals.filter(([, dealMarket]) => dealMarket !== marketId);

    for (let i = 0; i < pack.cells.market.length; i++) {
      if (pack.cells.market[i] === marketId) pack.cells.market[i] = 0;
    }

    pack.markets = pack.markets.filter(m => m.i !== marketId);
    this.sync();
  }

  /** A market's state is its center burg's */
  getState(market: Market | undefined): number {
    return market ? pack.burgs[market.centerBurgId]?.state || 0 : 0;
  }
}

export const Markets = new MarketsModule();
