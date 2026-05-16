import { quadtree } from "d3-quadtree";
import { minmax, rn } from "../utils";
import { getRandomColor } from "../utils/colorUtils";
import type { Burg } from "./burgs-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "./goods-generator";
import type { ProductionHistory } from "./production-generator";

export const DEFAULT_SALES_TAX = 0.2;
export const PRICE_FLOOR_FACTOR = 0.25;
export const PRICE_CEILING_FACTOR = 3.0;
const LAPLACE_PRICE_SMOOTHING = 5;
export const MARKET_MARGIN = 0.1;
export const MARKET_PRESSURE_FACTOR = 0.01;
export const BONUS_RESOURCE_PRODUCTION = 5;

const TRADE_RESERVE_FACTOR = 0.2;

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  goods: Record<number, { stock: number; price: number }>;
};

export type Deal = {
  id: number;
  market: number;
  phase: "buy" | "sell";
  goodId: number;
  units: number;
  buyer: number;
  seller: number;
  price: number;
};

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

  initialize() {
    this.reset();
    const goods = pack.goods;
    const burgs = pack.burgs.filter(b => b.i && !b.removed);
    for (const g of goods) this.goodById[g.i] = g;

    const markets = this.createMarkets(burgs);
    const cellMarket = this.expandMarkers(markets, burgs);
    this.collectRuralProduction(cellMarket);
    this.initializeMarketPrices(goods, markets);
    this.data.markets = markets;
    this.syncPackData();
    return this.data;
  }

  getMarket(marketId: number | undefined): Market | undefined {
    if (!marketId) return undefined;
    return this.data.markets.find(market => market.i === marketId);
  }

  getBurgMarket(burg: Burg): Market | undefined {
    return this.getMarket(burg.market);
  }

  applyMarketPressure(basePrice: number, currentPrice: number | undefined, units: number): number {
    const price = currentPrice ?? basePrice;
    const floor = basePrice * PRICE_FLOOR_FACTOR;
    const ceiling = basePrice * PRICE_CEILING_FACTOR;
    return minmax(floor, price + units * basePrice * MARKET_PRESSURE_FACTOR, ceiling);
  }

  private getMarketBurgs(marketId: number): Burg[] {
    return pack.burgs.filter(burg => burg.i && !burg.removed && burg.market === marketId);
  }

  private getMarketGood(market: Market, good: Good) {
    const existing = market.goods[good.i];
    if (existing) return existing;

    const initialized = { stock: 0, price: good.value };
    market.goods[good.i] = initialized;
    return initialized;
  }

  private getMarketInventory(market: Market): number[] {
    const inventory: number[] = [];
    for (const goodId in market.goods) {
      const id = +goodId;
      inventory[id] = market.goods[id].stock;
    }
    return inventory;
  }

  recordDeal(data: Omit<Deal, "id">): Deal {
    const deal: Deal = {
      id: this.data.deals.length,
      ...data,
      units: rn(data.units, 2)
    };
    this.data.deals.push(deal);

    const isLocalSale = deal.phase === "sell";
    const seller = isLocalSale ? (pack.burgs[deal.seller] ?? null) : null;
    const sellerTaxRate = seller ? this.getSalesTaxRate(seller) : 0;
    const taxAmount = isLocalSale ? deal.units * deal.price * sellerTaxRate : 0;
    const stateId = seller?.state || 0;

    if (taxAmount > 0 && stateId > 0) this.data.stateTaxes[stateId] = (this.data.stateTaxes[stateId] || 0) + taxAmount;
    return deal;
  }

  getSalesTaxRate(burg: Burg): number {
    const stateId = burg.state || 0;
    if (!stateId) return 0;
    return pack.states?.[stateId]?.salesTax ?? DEFAULT_SALES_TAX;
  }

  updateMarketDemand(productionData: Map<number, ProductionHistory[]>, demandInventory: Map<number, number[]>): void {
    for (const market of this.data.markets) {
      const aggregatedUncoveredDemand: number[] = Array(DEMAND_PRIORITY.length).fill(0);
      const marketBurgs = this.getMarketBurgs(market.i);
      for (const burg of marketBurgs) {
        const data = productionData.get(burg.i!);
        if (!burg || !data) continue;
        const burgDemandTargets = DEMAND_PRIORITY.map(
          category => (burg.population || 0) * DEMAND_TARGET_FACTORS[category]
        );
        const burgCoverage = this.calculateDemandCoverage(demandInventory.get(burg.i!) ?? [], this.goodById);
        for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
          aggregatedUncoveredDemand[categoryIndex] += Math.max(
            0,
            burgDemandTargets[categoryIndex] - burgCoverage[categoryIndex]
          );
        }
      }
      const demandTargets = aggregatedUncoveredDemand.map(value => value * (1 + TRADE_RESERVE_FACTOR));
      const demandCoverage = this.calculateDemandCoverage(this.getMarketInventory(market), this.goodById);
      void demandTargets.map((target, index) => Math.max(0, target - demandCoverage[index]));
    }
  }

  redistributeAcrossMarkets(
    productionData: Map<number, ProductionHistory[]>,
    demandInventory: Map<number, number[]>
  ): void {
    this.updateMarketDemand(productionData, demandInventory);
    const exportPools: number[][] = [];
    const uncoveredDemandByMarket: number[][] = [];

    for (const market of this.data.markets) {
      const marketDemand: number[] = Array(DEMAND_PRIORITY.length).fill(0);
      const marketBurgs = this.getMarketBurgs(market.i);
      for (const burg of marketBurgs) {
        const data = productionData.get(burg.i!);
        if (!burg || !data) continue;
        const burgDemandTargets = DEMAND_PRIORITY.map(
          category => (burg.population || 0) * DEMAND_TARGET_FACTORS[category]
        );
        const burgCoverage = this.calculateDemandCoverage(demandInventory.get(burg.i!) ?? [], this.goodById);
        for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
          marketDemand[categoryIndex] += Math.max(0, burgDemandTargets[categoryIndex] - burgCoverage[categoryIndex]);
        }
      }
      const demandTargets = marketDemand.map(value => value * (1 + TRADE_RESERVE_FACTOR));
      const marketInventory = this.getMarketInventory(market);
      const demandCoverage = this.calculateDemandCoverage(marketInventory, this.goodById);
      uncoveredDemandByMarket[market.i] = demandTargets.map((target, index) =>
        Math.max(0, target - demandCoverage[index])
      );
      exportPools[market.i] = this.splitInventoryByDemand(
        marketInventory,
        demandTargets,
        this.goodById
      ).excessInventory;
    }

    for (const importer of this.data.markets) {
      const importerUncovered: number[] = uncoveredDemandByMarket[importer.i] || Array(DEMAND_PRIORITY.length).fill(0);
      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        let shortage = importerUncovered[categoryIndex] || 0;
        if (shortage <= 0.001) continue;
        const candidates = this.data.markets
          .filter(exporter => exporter.i !== importer.i)
          .flatMap(exporter => {
            const exportPool = exportPools[exporter.i] || [];
            const goods: { exporter: Market; good: Good; goodId: number; available: number; coverageWeight: number }[] =
              [];
            for (let goodId = 0; goodId < exportPool.length; goodId++) {
              const available = exportPool[goodId] || 0;
              const good = this.goodById[goodId];
              const coverageWeight = good?.demandCoverage?.[demandCategory] || 0;
              if (!good || available <= 0.001 || coverageWeight <= 0) continue;
              goods.push({ exporter, good, goodId, available, coverageWeight });
            }
            return goods;
          })
          .sort((a, b) => b.coverageWeight - a.coverageWeight || a.good.value - b.good.value || a.goodId - b.goodId);
        for (const candidate of candidates) {
          if (shortage <= 0.001) break;
          const unitsNeeded = shortage / candidate.coverageWeight;
          const units = Math.min(candidate.available, unitsNeeded);
          if (units <= 0.001) continue;
          const exporterPool = exportPools[candidate.exporter.i]!;
          exporterPool[candidate.goodId] = Math.max(0, (exporterPool[candidate.goodId] || 0) - units);
          const exporterGood = this.getMarketGood(candidate.exporter, candidate.good);
          exporterGood.stock = Math.max(0, exporterGood.stock - units);
          const importerGood = this.getMarketGood(importer, candidate.good);
          importerGood.stock += units;
          shortage = Math.max(0, shortage - units * candidate.coverageWeight);
          const marketPrice = exporterGood.price * (1 - MARKET_MARGIN);
          this.recordDeal({
            market: importer.i,
            phase: "buy",
            goodId: candidate.goodId,
            units,
            buyer: importer.i,
            seller: candidate.exporter.i,
            price: marketPrice
          });
          exporterGood.price = this.applyMarketPressure(candidate.good.value, exporterGood.price, -units);
          importerGood.price = this.applyMarketPressure(candidate.good.value, importerGood.price, units);
        }
      }
    }
    this.updateMarketDemand(productionData, demandInventory);
  }

  buyFromMarket({ burg, good, marketPrice, units }: { burg: Burg; good: Good; units: number; marketPrice: number }) {
    const market = this.getBurgMarket(burg);
    if (!market || units <= 0) return { units: 0, totalCost: 0, taxAmount: 0, dealId: null };

    const marketGood = this.getMarketGood(market, good);
    const actualUnits = Math.min(units, marketGood.stock || 0);
    if (actualUnits <= 0) return { units: 0, totalCost: 0, taxAmount: 0, dealId: null };

    marketGood.stock = Math.max(0, marketGood.stock - actualUnits);

    const deal = this.recordDeal({
      market: market.i,
      phase: "buy",
      goodId: good.i,
      units: actualUnits,
      buyer: burg.i!,
      seller: market.i,
      price: marketPrice
    });

    return { units: actualUnits, totalCost: actualUnits * marketPrice, taxAmount: 0, dealId: deal.id };
  }

  sellToMarket({ burg, good, marketPrice, units }: { burg: Burg; good: Good; units: number; marketPrice: number }) {
    const market = this.getBurgMarket(burg);
    if (!market || units <= 0) return { units: 0, revenue: 0, taxAmount: 0, dealId: null };

    const marketGood = this.getMarketGood(market, good);
    marketGood.stock += units;
    const grossRevenue = units * marketPrice;
    const taxAmount = grossRevenue * this.getSalesTaxRate(burg);
    const revenue = grossRevenue - taxAmount;

    const deal = this.recordDeal({
      market: market.i,
      phase: "sell",
      goodId: good.i,
      units,
      buyer: market.i,
      seller: burg.i!,
      price: marketPrice
    });

    return { units, revenue, taxAmount, dealId: deal.id };
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

  private calculateDemandCoverage(inventory: number[], goodById: Good[]): number[] {
    const demandCoverage: number[] = Array(DEMAND_PRIORITY.length).fill(0);
    for (let goodId = 0; goodId < inventory.length; goodId++) {
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;
      const good = goodById[goodId];
      if (!good) continue;
      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        const coverageWeight = good?.demandCoverage?.[demandCategory] || 0;
        if (!coverageWeight) continue;
        demandCoverage[categoryIndex] += amount * coverageWeight;
      }
    }
    return demandCoverage;
  }

  private splitInventoryByDemand(
    inventory: number[],
    demandTargets: number[],
    goodById: Good[]
  ): {
    retainedInventory: number[];
    excessInventory: number[];
  } {
    const retainedInventory: number[] = [];
    const excessInventory: number[] = inventory.slice();
    const retainedDemandCoverage: number[] = Array(DEMAND_PRIORITY.length).fill(0);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
      // Find all goods with coverage for this category
      const candidates: number[] = [];
      for (let goodId = 0; goodId < excessInventory.length; goodId++) {
        const amount = excessInventory[goodId] || 0;
        const good = goodById[goodId];
        if (amount > 0 && good?.demandCoverage?.[demandCategory]) candidates.push(goodId);
      }
      candidates.sort((a, b) => {
        const coverageA = goodById[a]?.demandCoverage?.[demandCategory] || 0;
        const coverageB = goodById[b]?.demandCoverage?.[demandCategory] || 0;
        return coverageB - coverageA || a - b;
      });

      for (const goodId of candidates) {
        const shortage = Math.max(0, demandTargets[categoryIndex] - retainedDemandCoverage[categoryIndex]);
        if (shortage <= 0.001) break;

        const available = excessInventory[goodId] || 0;
        if (available <= 0) continue;
        const good = goodById[goodId]!;
        const coverageWeight = good?.demandCoverage?.[demandCategory] || 0;
        if (!coverageWeight) continue;

        const keepAmount = Math.min(available, shortage / coverageWeight);
        if (keepAmount <= 0.001) continue;

        retainedInventory[goodId] = (retainedInventory[goodId] || 0) + keepAmount;
        excessInventory[goodId] = Math.max(0, available - keepAmount);

        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const coverageCategory = DEMAND_PRIORITY[coverageCategoryIndex] as DemandCategory;
          const retainedCoverageWeight = good?.demandCoverage?.[coverageCategory] || 0;
          if (!retainedCoverageWeight) continue;
          retainedDemandCoverage[coverageCategoryIndex] += keepAmount * retainedCoverageWeight;
        }
      }
    }

    return { retainedInventory, excessInventory };
  }

  private collectRuralProduction(cellMarket: Uint16Array): void {
    const productionByBiome = Goods.getBiomesProduction();

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
      const biomeProduction = productionByBiome[biomeId] || [];
      for (const { goodId, production } of biomeProduction) {
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

  private initializeMarketPrices(goods: Good[], markets: Market[]): void {
    const consumerDemandFactors = this.collectConsumerDemand(goods);
    const industrialDemandFactors = this.collectIndustrialDemand(goods, consumerDemandFactors);

    // Pre-calculate average base ingredient cost per manufactured good (market-independent)
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

    for (const market of markets) {
      const population = this.getMarketBurgs(market.i).reduce((sum, burg) => sum + (burg.population || 0), 0);

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
        let totalLocalCost = 0;
        for (const recipe of good.recipes) {
          for (const [ingIdStr, amount] of Object.entries(recipe)) {
            const ingId = +ingIdStr;
            const ing = this.goodById[ingId];
            if (!ing) continue;
            totalLocalCost += amount * this.getMarketGood(market, ing).price;
          }
        }
        const avgLocalCost = totalLocalCost / good.recipes.length;
        const avgBaseCost = avgBaseCostByGood[good.i] ?? 0;
        const demandPrice = avgLocalCost + Math.max(0, good.value - avgBaseCost);
        const minPrice = good.value * PRICE_FLOOR_FACTOR;
        const maxPrice = good.value * PRICE_CEILING_FACTOR;
        marketGood.price = minmax(demandPrice, minPrice, maxPrice);
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
