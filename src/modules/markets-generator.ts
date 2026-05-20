import { quadtree } from "d3-quadtree";
import { minmax } from "../utils";
import { getRandomColor } from "../utils/colorUtils";
import type { Burg } from "./burgs-generator";
import { DEFAULT_CULTURE_TYPE } from "./cultures-generator";
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
  i: number;
  market: number;
  client: number;
  clientType: "burg" | "market";
  direction: "in" | "out";
  good: number;
  units: number;
  price: number;
};

export class MarketsModule {
  private goodById: Good[] = [];
  private marketById: Market[] = [];

  generate(): Market[] {
    TIME && console.time("generateMarkets");
    const goods = pack.goods;
    for (const g of goods) this.goodById[g.i] = g;

    const markets = this.createMarkets();
    this.expandMarkets(markets);

    pack.markets = markets;
    pack.deals = [];

    TIME && console.timeEnd("generateMarkets");
    return markets;
  }

  private createMarkets(): Market[] {
    // Score each burg by population; capitals and ports are weighted higher
    const scored = pack.burgs
      .map(burg => {
        let score = burg.population || 0;
        if (burg.capital) score *= 2;
        if (burg.port) score *= 2;
        return { burg, score };
      })
      .sort((a, b) => b.score - a.score);

    // minSpacing scales with map size relative to burg count
    let minSpacing = (((graphWidth + graphHeight) * 4) / pack.burgs.length ** 0.7) | 0;

    const markets: Market[] = [];
    const tree = quadtree<[number, number, number]>(
      [],
      d => d[0],
      d => d[1]
    );

    for (const { burg } of scored) {
      if (!burg.i || burg.removed) continue;
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

  private expandMarkets(markets: Market[]): Uint16Array {
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

    for (const market of markets) {
      const centerBurg = pack.burgs[market.centerBurgId];
      if (!centerBurg) continue;

      const startCell = centerBurg.cell;
      cellMarket[startCell] = market.i;
      costs[startCell] = MIN_COST;

      queue.push({ cellId: startCell, marketId: market.i, burg: centerBurg, priority: 0 }, 0);
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
        if (cost < MIN_COST) cost = MIN_COST;
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

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      burg.market = cellMarket[burg.cell] || 0;
    }

    return cellMarket;
  }

  collectRuralProduction(): void {
    const biomeProduction = Goods.getBiomesProduction();

    for (const cellId of pack.cells.i) {
      const market = this.marketById[pack.cells.market[cellId]];
      if (!market) continue;

      const biomeId = pack.cells.biome[cellId];
      const bonusGoodId = pack.cells.good[cellId];
      const population = pack.cells.pop[cellId];
      const cultureId = pack.cells.culture[cellId];
      const cultureType = pack.cultures[cultureId]?.type || DEFAULT_CULTURE_TYPE;

      if (bonusGoodId) {
        const good = this.goodById[bonusGoodId];
        const bonusGood = this.getMarketGood(market, good);
        const modifier = good?.culture?.[cultureType] || 1;
        bonusGood.stock += BONUS_RESOURCE_PRODUCTION * modifier;
      }

      if (population <= 0) continue;
      const biomeRuralGoods = biomeProduction[biomeId] || [];
      for (const { goodId, production } of biomeRuralGoods) {
        const good = this.goodById[goodId];
        const marketGood = this.getMarketGood(market, good);
        const modifier = good?.culture?.[cultureType] || 1;
        marketGood.stock += population * production * modifier;
      }
    }
  }

  private getMarketGood(market: Market, good: Good) {
    const existing = market.goods[good.i];
    if (existing) return existing;

    const initial = { stock: 0, price: good.value };
    market.goods[good.i] = initial;
    return initial;
  }

  initializeMarketPrices(): void {
    const consumerDemandFactors = this.collectConsumerDemand(pack.goods);
    const industrialDemandFactors = this.collectIndustrialDemand(pack.goods, consumerDemandFactors);
    const avgIngredientsCostByGood = this.calculateAverageBaseCostByGood(pack.goods);
    const populationByMarket = this.calculatePopulationByMarket();

    for (const market of pack.markets) {
      const population = populationByMarket[market.i] || 0;

      // First pass: raw goods - price from demand/supply ratio
      for (const good of pack.goods) {
        if (!good.distribution) continue;
        const marketGood = this.getMarketGood(market, good);
        const consumerDemand = consumerDemandFactors[good.i] || 0;
        const industrialDemand = industrialDemandFactors[good.i] || 0;
        const demand = population * (consumerDemand + industrialDemand);
        const ratio = (demand + LAPLACE_PRICE_SMOOTHING) / (marketGood.stock + LAPLACE_PRICE_SMOOTHING);
        marketGood.price = good.value * minmax(ratio, PRICE_FLOOR_FACTOR, PRICE_CEILING_FACTOR);
      }

      // Second pass: manufactured goods - average local ingredient cost + base value-added
      for (const good of pack.goods) {
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

  public get(marketId: number | undefined): Market | undefined {
    if (!marketId) return undefined;
    return this.marketById[marketId];
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

  recordDeal(data: Omit<Deal, "i">): Deal {
    const deal: Deal = {
      i: pack.deals.length,
      ...data,
      units: rn(data.units, 2),
      price: rn(data.price, 2)
    };
    pack.deals.push(deal);
    return deal;
  }

  buy({ burg, good, units, budget }: { burg: Burg; good: Good; units: number; budget?: number }): Deal | null {
    const market = this.get(burg.market);
    if (!market) return null;

    const marketGood = this.getMarketGood(market, good);
    const unitPrice = this.customerBuyPrice(marketGood.price);

    let actualUnits = Math.min(units, marketGood.stock);
    if (budget) actualUnits = Math.min(actualUnits, budget / unitPrice);
    if (actualUnits <= 0) return null;

    const deal = this.recordDeal({
      market: market.i,
      direction: "out",
      good: good.i,
      units: actualUnits,
      client: burg.i!,
      clientType: "burg",
      price: unitPrice
    });

    marketGood.stock = Math.max(0, marketGood.stock - actualUnits);
    marketGood.price = this.applyMarketPressure(good.value, marketGood.price, actualUnits);
    return deal;
  }

  sell({ burg, good, units }: { burg: Burg; good: Good; units: number }): Deal | null {
    const market = this.get(burg.market);
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const price = this.customerSellPrice(marketGood.price);
    marketGood.stock += units;

    const deal = this.recordDeal({
      market: market.i,
      direction: "in",
      good: good.i,
      units,
      client: burg.i!,
      clientType: "burg",
      price
    });

    marketGood.price = this.applyMarketPressure(good.value, marketGood.price, -units);
    return deal;
  }

  runGlobalTrade(): void {
    const consumerDemandFactors = this.collectConsumerDemand(pack.goods);
    const industrialDemandFactors = this.collectIndustrialDemand(pack.goods, consumerDemandFactors);
    const populationByMarket = this.calculatePopulationByMarket();

    const mapDiagonal = Math.hypot(graphWidth, graphHeight) || 1;
    const TRADE_RESERVE_FACTOR = 0.2;
    const MIN_UNIT = 0.1;
    const MIN_PROFIT = 1;
    const DISTANCE_COST_FACTOR = 0.5;

    const travelCost: Record<number, Record<number, number>> = {};
    for (const m1 of pack.markets) {
      travelCost[m1.i] = {};
      const burg1 = pack.burgs[m1.centerBurgId];
      if (!burg1) continue;

      for (const m2 of pack.markets) {
        const burg2 = pack.burgs[m2.centerBurgId];
        if (!burg2) continue;

        const dx = Math.abs(burg1.x - burg2.x);
        const dy = Math.abs(burg1.y - burg2.y);
        const distance = dx > dy ? dx + 0.414 * dy : dy + 0.414 * dx;
        travelCost[m1.i][m2.i] = (distance / mapDiagonal) * DISTANCE_COST_FACTOR;
      }
    }

    for (const good of pack.goods) {
      if (!good.distribution && !good.recipes?.length) continue;

      const safetyReserves: number[] = [];
      const exporters: { market: Market; reserve: number }[] = [];
      const importers: { market: Market; reserve: number }[] = [];

      for (const market of pack.markets) {
        const population = populationByMarket[market.i] || 0;
        const demand = population * ((consumerDemandFactors[good.i] || 0) + (industrialDemandFactors[good.i] || 0));
        const reserve = demand * (1 + TRADE_RESERVE_FACTOR);
        safetyReserves[market.i] = reserve;

        const marketGood = this.getMarketGood(market, good);
        if (marketGood.stock > reserve) {
          exporters.push({ market, reserve });
        } else if (marketGood.stock < reserve) {
          importers.push({ market, reserve });
        }
      }

      if (!exporters.length || !importers.length) continue;

      const opportunities: {
        exporter: Market;
        importer: Market;
        reserveExporter: number;
        reserveImporter: number;
        transportCost: number;
        units: number;
        unitProfit: number;
        totalProfit: number;
      }[] = [];

      for (const exporter of exporters) {
        const distances = travelCost[exporter.market.i];
        if (!distances) continue;

        const exporterGood = this.getMarketGood(exporter.market, good);
        const available = Math.max(0, exporterGood.stock - exporter.reserve);
        if (available < MIN_UNIT) continue;

        for (const importer of importers) {
          const importerGood = this.getMarketGood(importer.market, good);
          const needed = Math.max(0, importer.reserve - importerGood.stock);
          const units = Math.min(available, needed);
          if (units < MIN_UNIT) continue;

          const transportCost = distances[importer.market.i] * good.value;
          const unitProfit = importerGood.price - (exporterGood.price + transportCost);
          const totalProfit = unitProfit * units;
          if (totalProfit < MIN_PROFIT) continue;

          opportunities.push({
            exporter: exporter.market,
            importer: importer.market,
            reserveExporter: exporter.reserve,
            reserveImporter: importer.reserve,
            transportCost,
            units,
            unitProfit,
            totalProfit
          });
        }
      }

      opportunities.sort((a, b) => b.totalProfit - a.totalProfit || b.units - a.units);
      for (const opportunity of opportunities) {
        const exporterGood = this.getMarketGood(opportunity.exporter, good);
        const importerGood = this.getMarketGood(opportunity.importer, good);

        const available = Math.max(0, exporterGood.stock - opportunity.reserveExporter);
        const needed = Math.max(0, opportunity.reserveImporter - importerGood.stock);
        const units = Math.min(available, needed);
        if (units < MIN_UNIT) continue;

        const price = exporterGood.price + opportunity.transportCost;
        const totalProfit = (importerGood.price - price) * units;
        if (totalProfit < MIN_PROFIT) continue;

        this.recordDeal({
          market: opportunity.importer.i,
          direction: "in",
          good: good.i,
          units,
          client: opportunity.exporter.i,
          clientType: "market",
          price
        });

        this.recordDeal({
          market: opportunity.exporter.i,
          direction: "out",
          good: good.i,
          units,
          client: opportunity.importer.i,
          clientType: "market",
          price
        });

        exporterGood.price = this.applyMarketPressure(good.value, exporterGood.price, units);
        importerGood.price = this.applyMarketPressure(good.value, importerGood.price, -units);
        exporterGood.stock = exporterGood.stock - units;
        importerGood.stock += units;
      }
    }
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

  private calculatePopulationByMarket(): number[] {
    const populationByMarket: number[] = [];
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.market || !burg.population) continue;
      if (!populationByMarket[burg.market]) populationByMarket[burg.market] = 0;
      populationByMarket[burg.market] += burg.population;
    }
    return populationByMarket;
  }
}

declare global {
  var Markets: MarketsModule;
}

window.Markets = new MarketsModule();
