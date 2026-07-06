import Alea from "alea";
import { quadtree } from "d3-quadtree";
import { minmax } from "../utils";
import { getColors, getRandomColor } from "../utils/colorUtils";
import type { Burg } from "./burgs-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "./goods-generator";

const PRICE_FLOOR_FACTOR = 0.1;
const PRICE_CEILING_FACTOR = 5.0;
const LAPLACE_PRICE_SMOOTHING = 5;
const MARKET_PRESSURE_FACTOR = 0.01;
const MARKET_MARGIN = 0.1;

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  name?: string;
  goods: Record<number, { stock: number; price: number }>;
};

export type Deal = {
  i: number;
  seller: number;
  sellerType: "burg" | "market";
  buyer: number;
  buyerType: "burg" | "market";
  good: number;
  units: number;
  price: number;
  tax: number;
};

export class MarketsModule {
  private marketById: Market[] = [];

  generate(regenerate: boolean = false): Market[] {
    TIME && console.time("generateMarkets");
    if (!regenerate) Math.random = Alea(seed);
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
        if (burg.capital) score *= 2.5;
        if (burg.port) score *= 1.2;
        score *= Math.random() * 2 + 0.5; // add some noise
        return { burg, score };
      })
      .sort((a, b) => b.score - a.score);

    // minSpacing scales with map size relative to burg count
    let minSpacing = (((graphWidth + graphHeight) * 2) / pack.burgs.length ** 0.6) | 0;

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
        const market = { i: marketId, centerBurgId: burg.i, color: "", goods: {} };
        markets.push(market);
        this.marketById[marketId] = market;
        tree.add([x, y, marketId]);
        minSpacing += 1;
      }
    }

    const colors = getColors(markets.length);
    markets.forEach((m, i) => {
      m.color = colors[i];
    });

    return markets;
  }

  expandTerritories(markets: Market[] = pack.markets): Uint16Array {
    this.indexMarkets(markets);
    return this.expandMarkets(markets);
  }

  private indexMarkets(markets: Market[] = pack.markets): void {
    this.marketById = [];
    for (const market of markets) if (market) this.marketById[market.i] = market;
  }

  public sync(): void {
    this.indexMarkets();
  }

  private expandMarkets(markets: Market[]): Uint16Array {
    const cells = pack.cells;
    const cellMarket = new Uint16Array(cells.i.length);
    const costs: number[] = [];
    const queue = new FlatQueue();

    const MIN_COST = 1;
    const BASE_COST = 10;
    const DIFFERENT_STATE_COST = 100;
    const WATER_COST = 50;
    const WATER_COST_FOR_NON_PORTS = 50;
    const ISLAND_CHANGE_COST = 100;

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
        let cost = BASE_COST;
        if (isWater) {
          cost += WATER_COST;
          if (burg.port !== cells.f[neighborId]) cost += WATER_COST_FOR_NON_PORTS;
        } else {
          if (cells.f[burg.cell] !== cells.f[neighborId]) cost += ISLAND_CHANGE_COST;
          if (cells.state[neighborId] && burg.state !== cells.state[neighborId]) cost += DIFFERENT_STATE_COST;
        }

        const totalCost = priority + cost;
        if (!costs[neighborId] || totalCost < costs[neighborId]) {
          costs[neighborId] = totalCost;
          queue.push({ cellId: neighborId, marketId, burg, priority: totalCost }, totalCost);

          const hasGood = Boolean(cells.good[neighborId]);
          if (isWater && !hasGood) continue; // exclude water cells without goods

          cellMarket[neighborId] = marketId;
        }
      }
    }

    pack.cells.market = cellMarket;

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      burg.market = cellMarket[burg.cell] || 0;
      burg.plaza = burg.plaza || tradeCenters[burg.i] ? 1 : 0;
    }

    return cellMarket;
  }

  collectRuralProduction(): void {
    const biomeProduction = Goods.getBiomesProduction();

    for (const cellId of pack.cells.i) {
      const market = this.marketById[pack.cells.market[cellId]];
      if (!market) continue;

      const produced = Production.getCellProduction(cellId, biomeProduction);
      for (const [goodId, amount] of Object.entries(produced)) {
        const good = Goods.get(+goodId);
        if (!good) continue;
        const marketGood = this.getMarketGood(market, good);
        marketGood.stock = rn(marketGood.stock + amount, 2);
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
        marketGood.price = rn(good.value * minmax(ratio, PRICE_FLOOR_FACTOR, PRICE_CEILING_FACTOR), 2);
      }

      // Second pass: manufactured goods - average local ingredient cost + base value-added
      for (const good of pack.goods) {
        if (!good.recipes?.length) continue;
        const marketGood = this.getMarketGood(market, good);
        let totalMarketCost = 0;
        for (const recipe of good.recipes) {
          for (const [ingIdStr, amount] of Object.entries(recipe)) {
            const ingId = +ingIdStr;
            const ing = Goods.get(ingId);
            if (!ing) continue;
            totalMarketCost += amount * this.getMarketGood(market, ing).price;
          }
        }
        const avgMarketCost = totalMarketCost / good.recipes.length;
        const avgBaseCost = avgIngredientsCostByGood[good.i] ?? 0;
        const demandPrice = avgMarketCost + Math.max(0, good.value - avgBaseCost);
        marketGood.price = rn(
          minmax(demandPrice, good.value * PRICE_FLOOR_FACTOR, good.value * PRICE_CEILING_FACTOR),
          2
        );
      }
    }
  }

  public get(marketId: number | undefined): Market | undefined {
    if (!marketId) return undefined;
    return this.marketById[marketId];
  }

  // Display name: the custom name if set, otherwise derived from the center burg.
  public getName(market: Market): string {
    return market.name || pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
  }

  addMarket(burgId: number): Market | null {
    const burg = (pack.burgs as Burg[])[burgId];
    if (!burg || burg.removed) return null;

    if (pack.markets.some(m => m.centerBurgId === burgId)) {
      tip("This burg is already a market center", false, "error");
      return null;
    }

    const maxId = pack.markets.reduce((max, m) => Math.max(max, m.i), 0);
    const marketId = maxId + 1;
    const market: Market = { i: marketId, centerBurgId: burgId, color: getRandomColor(), goods: {} };
    pack.markets.push(market);
    pack.deals = [];

    this.indexMarkets();
    pack.cells.market[burg.cell] = marketId;
    burg.market = marketId;
    burg.plaza = 1;

    return market;
  }

  removeMarket(marketId: number) {
    const market = this.get(marketId);
    if (!market) return;

    const centerBurg = pack.burgs[market.centerBurgId];
    if (centerBurg) centerBurg.plaza = 0;

    // drop the deals tied to this market
    pack.deals = pack.deals.filter(
      deal =>
        !(
          (deal.sellerType === "market" && deal.seller === marketId) ||
          (deal.buyerType === "market" && deal.buyer === marketId)
        )
    );

    for (let i = 0; i < pack.cells.market.length; i++) {
      if (pack.cells.market[i] === marketId) pack.cells.market[i] = 0;
    }

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed) continue;
      if (burg.market === marketId) burg.market = 0;
    }

    pack.markets = pack.markets.filter(m => m.i !== marketId);
    this.indexMarkets();
  }

  quoteMarket(market: Market, goodId: number): { stock: number; buyPrice: number; sellPrice: number } {
    const good = Goods.get(goodId);
    if (!good) return { stock: 0, buyPrice: 0, sellPrice: 0 };
    const row = this.getMarketGood(market, good);
    return {
      stock: row.stock,
      buyPrice: this.customerBuyPrice(row.price),
      sellPrice: this.customerSellPrice(row.price)
    };
  }

  buy({
    burg,
    good,
    units,
    budget = Infinity
  }: {
    burg: Burg;
    good: Good;
    units: number;
    budget?: number;
  }): Deal | null {
    const market = this.get(burg.market);
    if (!market) return null;

    const marketGood = this.getMarketGood(market, good);
    const unitPrice = this.customerBuyPrice(marketGood.price);

    const actualUnits = rn(Math.min(units, marketGood.stock, budget / unitPrice), 2);
    if (actualUnits < 0.01) return null;

    const deal: Deal = {
      i: pack.deals.length,
      seller: market.i,
      sellerType: "market",
      buyer: burg.i!,
      buyerType: "burg",
      good: good.i,
      units: actualUnits,
      price: unitPrice,
      tax: 0
    };
    pack.deals.push(deal);

    marketGood.stock = rn(Math.max(0, marketGood.stock - actualUnits), 2);
    marketGood.price = rn(this.applyMarketPressure(good.value, marketGood.price, actualUnits), 2);
    return deal;
  }

  sell({ burg, good, units, taxRate }: { burg: Burg; good: Good; units: number; taxRate: number }): Deal | null {
    const market = this.get(burg.market);
    if (!market || units <= 0) return null;

    const marketGood = this.getMarketGood(market, good);
    const price = this.customerSellPrice(marketGood.price);
    const tax = rn(units * price * taxRate, 2);
    marketGood.stock = rn(marketGood.stock + units, 2);

    const deal: Deal = {
      i: pack.deals.length,
      seller: burg.i!,
      sellerType: "burg",
      buyer: market.i,
      buyerType: "market",
      good: good.i,
      units: rn(units, 2),
      price,
      tax
    };
    pack.deals.push(deal);

    marketGood.price = rn(this.applyMarketPressure(good.value, marketGood.price, -units), 2);
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
    const DISTANCE_COST_FACTOR = 1;

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
        exporterTaxPerUnit: number;
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

        const exporterCenter = pack.burgs[exporter.market.centerBurgId];
        const exporterTaxPerUnit = States.getSalesTax(exporterCenter) * exporterGood.price;

        for (const importer of importers) {
          const importerGood = this.getMarketGood(importer.market, good);
          const needed = Math.max(0, importer.reserve - importerGood.stock);
          const units = Math.min(available, needed);
          if (units < MIN_UNIT) continue;

          const transportCost = distances[importer.market.i] * good.value;
          const unitProfit = importerGood.price - (exporterGood.price + transportCost + exporterTaxPerUnit);
          const totalProfit = unitProfit * units;
          if (totalProfit < MIN_PROFIT) continue;

          opportunities.push({
            exporter: exporter.market,
            importer: importer.market,
            reserveExporter: exporter.reserve,
            reserveImporter: importer.reserve,
            transportCost,
            exporterTaxPerUnit,
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

        const landedCost = exporterGood.price + opportunity.transportCost + opportunity.exporterTaxPerUnit;
        const totalProfit = (importerGood.price - landedCost) * units;
        if (totalProfit < MIN_PROFIT) continue;

        const deal: Deal = {
          i: pack.deals.length,
          seller: opportunity.exporter.i,
          sellerType: "market",
          buyer: opportunity.importer.i,
          buyerType: "market",
          good: good.i,
          units,
          price: landedCost,
          tax: opportunity.exporterTaxPerUnit * units
        };
        pack.deals.push(deal);

        exporterGood.price = rn(this.applyMarketPressure(good.value, exporterGood.price, units), 2);
        importerGood.price = rn(this.applyMarketPressure(good.value, importerGood.price, -units), 2);
        exporterGood.stock = rn(exporterGood.stock - units, 2);
        importerGood.stock = rn(importerGood.stock + units, 2);
      }
    }
  }

  customerBuyPrice(midPrice: number): number {
    return rn(midPrice * (1 + MARKET_MARGIN), 2);
  }

  customerSellPrice(midPrice: number): number {
    return rn(midPrice * (1 - MARKET_MARGIN), 2);
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
          const ing = Goods.get(+ingIdStr);
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
