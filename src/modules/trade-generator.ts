import { quadtree } from "d3-quadtree";
import { minmax, rn } from "../utils";
import { getRandomColor } from "../utils/colorUtils";
import type { Burg } from "./burgs-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { BONUS_RESOURCE_PRODUCTION, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "./goods-generator";

const PRICE_FLOOR_FACTOR = 0.25;
const PRICE_CEILING_FACTOR = 3.0;
const LAPLACE_PRICE_SMOOTHING = 5;
const MARKET_PRESSURE_FACTOR = 0.01;
const MARKET_MARGIN = 0.1;

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  goods: Record<number, { stock: number; price: number }>;
};

export type Deal = {
  id: number;
  type: "in" | "out";
  market: number;
  client: number;
  good: number;
  units: number;
  price: number;
};

export type BiomesProduction = Record<number, { goodId: number; production: number }[]>;

export class TradeModule {
  private data: { markets: Market[]; deals: Deal[]; stateTaxes: Record<number, number> } = {
    markets: [],
    deals: [],
    stateTaxes: {}
  };
  private goodById: Good[] = [];
  private marketById: Market[] = [];

  reset() {
    this.data = { markets: [], deals: [], stateTaxes: {} };
    this.goodById = [];
    this.marketById = [];
    this.syncPackData();
    return this.data;
  }

  initialize(biomesProduction: BiomesProduction) {
    this.reset();
    const goods = pack.goods;
    const burgs = pack.burgs.filter(b => b.i && !b.removed);
    for (const g of goods) this.goodById[g.i] = g;

    const markets = this.createMarkets(burgs);
    const cellMarket = this.expandMarkers(markets, burgs);
    this.collectRuralProduction(cellMarket, biomesProduction);
    this.initializeMarketPrices(goods, markets, burgs);
    this.data.markets = markets;
    this.syncPackData();
    return this.data;
  }

  getMarket(marketId: number | undefined): Market {
    const market = marketId ? this.marketById[marketId] : undefined;
    if (!market) throw new Error(`Market ${marketId} not found`);
    return market;
  }

  quoteMarket(market: Market, goodId: number): { stock: number; buyPrice: number; sellPrice: number } {
    const good = this.goodById[goodId] ?? Goods.get(goodId);
    if (!good) return { stock: 0, buyPrice: 0, sellPrice: 0 };
    const row = this.getMarketGood(market, good);
    return {
      stock: row.stock,
      buyPrice: this.customerBuyPrice(row.price),
      sellPrice: this.customerSellPrice(row.price)
    };
  }

  recordDeal(data: Omit<Deal, "id">): Deal {
    const deal: Deal = {
      id: this.data.deals.length,
      ...data,
      units: rn(data.units, 2),
      price: rn(data.price, 2)
    };
    this.data.deals.push(deal);
    return deal;
  }

  buy({
    burg,
    marketId,
    good,
    units,
    budget,
    transportCost = 0
  }: {
    burg: Burg;
    marketId: number;
    good: Good;
    units: number;
    budget?: number;
    transportCost?: number;
  }): Deal | null {
    const market = this.getMarket(marketId);
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const unitPrice = this.customerBuyPrice(marketGood.price) + transportCost;
    const maxByStock = marketGood.stock || 0;
    const maxByBudget =
      budget === undefined ? Number.POSITIVE_INFINITY : budget > 0 && unitPrice > 0 ? budget / unitPrice : 0;
    const actualUnits = Math.min(units, maxByStock, maxByBudget);
    if (actualUnits <= 0) return null;
    marketGood.stock = Math.max(0, marketGood.stock - actualUnits);

    const deal = this.recordDeal({
      market: market.i,
      type: "out",
      good: good.i,
      units: actualUnits,
      client: burg.i!,
      price: unitPrice
    });

    marketGood.price = this.applyMarketPressure(good.value, marketGood.price, actualUnits);
    return deal;
  }

  sell({
    burg,
    marketId,
    good,
    units,
    transportCost = 0
  }: {
    burg: Burg;
    marketId: number;
    good: Good;
    units: number;
    transportCost?: number;
  }): Deal | null {
    const market = this.getMarket(marketId);
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const price = Math.max(0, this.customerSellPrice(marketGood.price) - transportCost);
    marketGood.stock += units;

    const deal = this.recordDeal({
      market: market.i,
      type: "in",
      good: good.i,
      units,
      client: burg.i!,
      price
    });

    marketGood.price = this.applyMarketPressure(good.value, marketGood.price, -units);
    return deal;
  }

  private getMarketGood(market: Market, good: Good) {
    const existing = market.goods[good.i];
    if (existing) return existing;

    const initialized = { stock: 0, price: good.value };
    market.goods[good.i] = initialized;
    return initialized;
  }

  private customerBuyPrice(midPrice: number): number {
    return midPrice * (1 + MARKET_MARGIN);
  }

  private customerSellPrice(midPrice: number): number {
    return midPrice * (1 - MARKET_MARGIN);
  }

  private applyMarketPressure(basePrice: number, currentPrice: number | undefined, units: number): number {
    const price = currentPrice ?? basePrice;
    const floor = basePrice * PRICE_FLOOR_FACTOR;
    const ceiling = basePrice * PRICE_CEILING_FACTOR;
    return minmax(floor, price + units * basePrice * MARKET_PRESSURE_FACTOR, ceiling);
  }

  private createMarkets(burgs: Burg[]): Market[] {
    // Score each burg by population; capitals and ports are weighted higher
    const scored = burgs
      .map(burg => {
        let score = burg.population || 0;
        if (burg.capital) score *= 2;
        if (burg.port) score *= 2;
        return { burg, score };
      })
      .sort((a, b) => b.score - a.score);

    // minSpacing scales with map size relative to burg count
    let minSpacing = (((graphWidth + graphHeight) * 4) / burgs.length ** 0.7) | 0;

    const markets: Market[] = [];
    const tree = quadtree<[number, number, number]>(
      [],
      d => d[0],
      d => d[1]
    );

    for (const { burg } of scored) {
      if (burg.i === undefined) continue;
      const { x, y } = burg;
      const nearest = tree.find(x, y, minSpacing);
      if (!nearest) {
        // Create a new market anchored at this burg
        const marketId = markets.length + 1;

        const market = { i: marketId, centerBurgId: burg.i, color: getRandomColor(), goods: {} };
        markets.push(market);
        this.marketById[marketId] = market;
        tree.add([x, y, marketId]);
      }

      minSpacing += 1;
    }

    return markets;
  }

  private collectRuralProduction(cellMarket: Uint16Array, biomeProduction: BiomesProduction): void {
    for (const cellId of pack.cells.i) {
      const market = this.marketById[cellMarket[cellId]];
      if (!market) continue;

      const biomeId = pack.cells.biome[cellId];
      const bonusGoodId = pack.cells.good[cellId];
      const population = pack.cells.pop[cellId];

      if (bonusGoodId) {
        const bonusGood = this.getMarketGood(market, this.goodById[bonusGoodId]);
        bonusGood.stock += BONUS_RESOURCE_PRODUCTION;
      }

      if (population <= 0) continue;
      const biomeRuralGoods = biomeProduction[biomeId] || [];
      for (const { goodId, production } of biomeRuralGoods) {
        const marketGood = this.getMarketGood(market, this.goodById[goodId]);
        marketGood.stock += population * production;
      }
    }
  }

  private expandMarkers(markets: Market[], burgs: Burg[]): Uint16Array {
    const cells = pack.cells;
    const cellMarket = new Uint16Array(cells.i.length);
    const costs: number[] = [];
    const queue = new FlatQueue();

    const MIN_COST = 1;
    const MAX_COST = cells.i.length * 2;
    const BASE_COST = 10;
    const SAME_PORT_WATERBODY_BONUS = 8;
    const SAME_ROUTE_BONUS = 5;
    const SAME_RIVER_BONUS = 5;
    const DIFFERENT_STATE_COST = 20;
    const DIFFERENT_PROVINCE_COST = 5;
    const MOUNTAIN_COST = 20;

    // Seed queue from each market center's cell
    for (const market of markets) {
      const burg = burgs[market.centerBurgId];
      if (!burg) continue;

      const startCell = burg.cell;
      cellMarket[startCell] = market.i;
      costs[startCell] = 1;
      queue.push({ cellId: startCell, marketId: market.i, burg, priority: 0 }, 0);
    }

    while (queue.length) {
      const { cellId, marketId, burg, priority } = queue.pop();
      const cellRiver = cells.r[cellId];
      const cellState = cells.state[cellId];
      const cellProvince = cells.province[cellId];

      for (const neighborId of cells.c[cellId]) {
        let cost = BASE_COST;
        if (cells.h[neighborId] < 20 && burg.port === cells.f[neighborId]) cost -= SAME_PORT_WATERBODY_BONUS;
        if (Routes.areConnected(cellId, neighborId)) {
          cost -= SAME_ROUTE_BONUS;
        } else if (cells.h[neighborId] >= 70) {
          cost += MOUNTAIN_COST;
        }
        if (cellRiver && cellRiver === cells.r[neighborId]) cost -= SAME_RIVER_BONUS;
        if (cellState && cellState !== cells.state[neighborId]) cost += DIFFERENT_STATE_COST;
        if (cellProvince && cellProvince !== cells.province[neighborId]) cost += DIFFERENT_PROVINCE_COST;
        if (cost <= MIN_COST) cost = MIN_COST;
        if (cost > MAX_COST) continue;

        const totalCost = priority + cost;
        if (!costs[neighborId] || totalCost < costs[neighborId]) {
          costs[neighborId] = totalCost;
          queue.push({ cellId: neighborId, marketId, burg, priority: totalCost }, totalCost);

          const hasGood = Boolean(cells.good[neighborId]);
          const isDeepWater = cells.t[neighborId] < -1;
          if (isDeepWater && !hasGood) continue; // exclude deep water cells without goods

          cellMarket[neighborId] = marketId;
        }
      }
    }

    pack.cells.market = cellMarket;

    for (const burg of burgs) {
      burg.market = cellMarket[burg.cell] || 0;
    }

    return cellMarket;
  }

  private initializeMarketPrices(goods: Good[], markets: Market[], burgs: Burg[]): void {
    const consumerDemandFactors = this.collectConsumerDemand(goods);
    const industrialDemandFactors = this.collectIndustrialDemand(goods, consumerDemandFactors);
    const avgIngredientsCostByGood = this.calculateAverageBaseCostByGood(goods);
    const populationByMarket = this.calculatePopulationByMarket(burgs);

    for (const market of markets) {
      const population = populationByMarket[market.i] || 0;

      // First pass: raw goods - price from demand/supply ratio
      for (const good of goods) {
        if (!good.distribution) continue;
        const marketGood = this.getMarketGood(market, good);
        const consumerDemand = consumerDemandFactors[good.i] || 0;
        const industrialDemand = industrialDemandFactors[good.i] || 0;
        const demand = population * (consumerDemand + industrialDemand);
        const ratio = (demand + LAPLACE_PRICE_SMOOTHING) / (marketGood.stock + LAPLACE_PRICE_SMOOTHING);
        marketGood.price = good.value * minmax(ratio, PRICE_FLOOR_FACTOR, PRICE_CEILING_FACTOR);
      }

      // Second pass: manufactured goods - average local ingredient cost + base value-added
      for (const good of goods) {
        if (!good.recipes?.length) continue;
        const marketGood = this.getMarketGood(market, good);
        let totalMarketCost = 0;
        for (const recipe of good.recipes) {
          for (const [ingIdStr, amount] of Object.entries(recipe)) {
            const ingId = +ingIdStr;
            const ing = this.goodById[ingId];
            if (!ing) continue;
            totalMarketCost += amount * this.getMarketGood(market, ing).price;
          }
        }
        const avgMarketCost = totalMarketCost / good.recipes.length;
        const avgBaseCost = avgIngredientsCostByGood[good.i] ?? 0;
        const demandPrice = avgMarketCost + Math.max(0, good.value - avgBaseCost);
        marketGood.price = minmax(demandPrice, good.value * PRICE_FLOOR_FACTOR, good.value * PRICE_CEILING_FACTOR);
      }
    }
  }

  private collectConsumerDemand(goods: Good[]): number[] {
    const totalCoverageByCategory = Object.fromEntries(
      DEMAND_PRIORITY.map(category => [
        category,
        goods.reduce((sum, g) => sum + (g?.demandCoverage?.[category] || 0), 0) || 1
      ])
    ) as Record<DemandCategory, number>;

    const demandFactor: number[] = [];
    for (const good of goods) {
      demandFactor[good.i] = DEMAND_PRIORITY.reduce((sum, category) => {
        const share = (good?.demandCoverage?.[category] || 0) / (totalCoverageByCategory[category] || 1);
        return sum + share * DEMAND_TARGET_FACTORS[category];
      }, 0);
    }
    return demandFactor;
  }

  private collectIndustrialDemand(goods: Good[], consumerDemandFactors: number[]): number[] {
    // Per-capita demand for ingredients driven by consumer demand for their manufactured outputs.
    const demandFactor: number[] = [];
    for (const good of goods) {
      if (!good.recipes?.length) continue;
      const outputDemand = consumerDemandFactors[good.i] || 0;
      for (const recipe of good.recipes) {
        for (const [ingredientIdStr, amount] of Object.entries(recipe)) {
          const ingredientId = +ingredientIdStr;
          demandFactor[ingredientId] = (demandFactor[ingredientId] || 0) + amount * outputDemand;
        }
      }
    }
    return demandFactor;
  }

  private calculateAverageBaseCostByGood(goods: Good[]): number[] {
    const avgBaseCostByGood = new Array(goods.length);
    for (const good of goods) {
      if (!good.recipes?.length) continue;
      let totalBaseCost = 0;
      for (const recipe of good.recipes) {
        for (const [ingIdStr, amount] of Object.entries(recipe)) {
          const ing = this.goodById[+ingIdStr];
          if (ing) totalBaseCost += amount * ing.value;
        }
      }
      avgBaseCostByGood[good.i] = totalBaseCost / good.recipes.length;
    }
    return avgBaseCostByGood;
  }

  private calculatePopulationByMarket(burgs: Burg[]): number[] {
    const populationByMarket: number[] = [];
    for (const burg of burgs) {
      if (!burg.market || !burg.population) continue;
      if (!populationByMarket[burg.market]) populationByMarket[burg.market] = 0;
      populationByMarket[burg.market] += burg.population;
    }
    return populationByMarket;
  }

  private syncPackData(): void {
    if (typeof pack === "undefined") return;
    pack.markets = this.data.markets;
    pack.deals = this.data.deals;
  }
}

declare global {
  var Trade: TradeModule;
}

window.Trade = new TradeModule();
