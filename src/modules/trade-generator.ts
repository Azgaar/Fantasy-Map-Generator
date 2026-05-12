import {quadtree} from "d3-quadtree";
import {rn} from "../utils";
import {getRandomColor} from "../utils/colorUtils";
import type {Burg} from "./burgs-generator";
import type {DemandCategory, Good} from "./goods-generator";
import {DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "./goods-generator";
import type {ProductionHistoryEntry} from "./production-generator";

export const DEFAULT_SALES_TAX = 0.2;
export const PRICE_FLOOR_FACTOR = 0.25;
export const PRICE_CEILING_FACTOR = 3.0;
export const BUY_PRESSURE_FACTOR = 0.02;
export const SELL_PRESSURE_FACTOR = 0.01;
export const RURAL_BONUS_PRODUCTION = 5;

const TRADE_RESERVE_FACTOR = 0.2;

export type TradePhase = "buy" | "sell";

export type Deal = {
  id: number;
  market: number;
  phase: TradePhase;
  goodId: number;
  units: number;
  buyer: number;
  seller: number;
  price: number;
};

export type MarketGoodData = {
  stock: number;
  buyPrice: number;
  sellPrice: number;
};

export type Market = {
  i: number;
  centerBurgId: number;
  color: string;
  goods: Record<number, MarketGoodData>;
};

export type TradeRunData = {
  markets: Market[];
  deals: Deal[];
  stateTaxes: Record<number, number>;
};

export class TradeModule {
  private data: TradeRunData = {markets: [], deals: [], stateTaxes: {}};

  reset(): TradeRunData {
    this.data = {markets: [], deals: [], stateTaxes: {}};
    this.syncPackData();
    return this.data;
  }

  initialize(goods: Good[], burgs: Burg[]): TradeRunData {
    this.reset();
    const markets = this.buildMarkets(goods, burgs);
    this.seedMarketsFromRuralProduction(goods, markets);
    this.initializeMarketPrices(goods, markets);
    this.setMarkets(markets);
    return this.data;
  }

  createMarket(id: number, centerBurgId: number, goods: Good[]): Market {
    return {
      i: id,
      centerBurgId,
      color: getRandomColor(),
      goods: this.createMarketGoods(goods)
    };
  }

  setMarkets(markets: Market[]): void {
    this.data.markets = markets;
    this.syncPackData();
  }

  getMarkets(): Market[] {
    return this.data.markets;
  }

  getRunData(): TradeRunData {
    return this.data;
  }

  getMarket(marketId: number | undefined): Market | undefined {
    if (!marketId) return undefined;
    return this.data.markets.find(market => market.i === marketId);
  }

  getMarketForBurg(burg: Burg): Market | undefined {
    return this.getMarket(burg.market);
  }

  getMarketBurgIds(marketId: number): number[] {
    return (pack.burgs as Burg[])
      .filter(burg => burg.i && !burg.removed && burg.market === marketId)
      .map(burg => burg.i!);
  }

  private getMarketGood(market: Market, goodId: number, fallbackPrice = 0): MarketGoodData {
    const existing = market.goods[goodId];
    if (existing) return existing;

    const initialized: MarketGoodData = {
      stock: 0,
      buyPrice: fallbackPrice,
      sellPrice: fallbackPrice
    };
    market.goods[goodId] = initialized;
    return initialized;
  }

  private getMarketInventory(market: Market): Record<number, number> {
    const inventory: Record<number, number> = {};
    for (const goodIdStr in market.goods) {
      inventory[+goodIdStr] = market.goods[+goodIdStr].stock;
    }
    return inventory;
  }

  recordDeal(data: Omit<Deal, "id">): Deal {
    const deal: Deal = {id: this.data.deals.length, ...data, units: rn(data.units, 2)};
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

  createDemandVector(categories: readonly DemandCategory[]): number[] {
    return Array(categories.length).fill(0);
  }

  updateMarketDemand(
    goods: Good[],
    productionData: Map<number, ProductionHistoryEntry[]>,
    demandInventory: Map<number, Record<number, number>>
  ): void {
    const goodById = new Map<number, Good>(goods.map(good => [good.i, good]));

    for (const market of this.data.markets) {
      const aggregatedUncoveredDemand = this.createDemandVector(DEMAND_PRIORITY);
      const marketBurgIds = this.getMarketBurgIds(market.i);

      for (const burgId of marketBurgIds) {
        const burg = pack.burgs[burgId] as Burg | undefined;
        const data = productionData.get(burgId);
        if (!burg || !data) continue;

        const burgDemandTargets = DEMAND_PRIORITY.map(
          category => (burg.population || 0) * DEMAND_TARGET_FACTORS[category]
        );
        const burgCoverage = this.calculateDemandCoverage(demandInventory.get(burgId) ?? {}, goodById);

        for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
          aggregatedUncoveredDemand[categoryIndex] += Math.max(
            0,
            burgDemandTargets[categoryIndex] - burgCoverage[categoryIndex]
          );
        }
      }

      const demandTargets = aggregatedUncoveredDemand.map(value => value * (1 + TRADE_RESERVE_FACTOR));
      const demandCoverage = this.calculateDemandCoverage(this.getMarketInventory(market), goodById);
      void demandTargets.map((target, index) => Math.max(0, target - demandCoverage[index]));
    }
  }

  redistributeAcrossMarkets(
    goods: Good[],
    productionData: Map<number, ProductionHistoryEntry[]>,
    demandInventory: Map<number, Record<number, number>>
  ): void {
    this.updateMarketDemand(goods, productionData, demandInventory);
    const goodById = new Map<number, Good>(goods.map(good => [good.i, good]));
    const exportPools = new Map<number, Record<number, number>>();
    const uncoveredDemandByMarket = new Map<number, number[]>();

    for (const market of this.data.markets) {
      const marketDemand = this.createDemandVector(DEMAND_PRIORITY);
      const marketBurgIds = this.getMarketBurgIds(market.i);
      for (const burgId of marketBurgIds) {
        const burg = pack.burgs[burgId] as Burg | undefined;
        const data = productionData.get(burgId);
        if (!burg || !data) continue;

        const burgDemandTargets = DEMAND_PRIORITY.map(
          category => (burg.population || 0) * DEMAND_TARGET_FACTORS[category]
        );
        const burgCoverage = this.calculateDemandCoverage(demandInventory.get(burgId) ?? {}, goodById);

        for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
          marketDemand[categoryIndex] += Math.max(0, burgDemandTargets[categoryIndex] - burgCoverage[categoryIndex]);
        }
      }
      const demandTargets = marketDemand.map(value => value * (1 + TRADE_RESERVE_FACTOR));
      const marketInventory = this.getMarketInventory(market);
      const demandCoverage = this.calculateDemandCoverage(marketInventory, goodById);
      uncoveredDemandByMarket.set(
        market.i,
        demandTargets.map((target, index) => Math.max(0, target - demandCoverage[index]))
      );

      exportPools.set(market.i, this.splitInventoryByDemand(marketInventory, demandTargets, goodById).excessInventory);
    }

    for (const importer of this.data.markets) {
      const importerUncovered = uncoveredDemandByMarket.get(importer.i) || this.createDemandVector(DEMAND_PRIORITY);
      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        let shortage = importerUncovered[categoryIndex] || 0;
        if (shortage <= 0.001) continue;

        const candidates = this.data.markets
          .filter(exporter => exporter.i !== importer.i)
          .flatMap(exporter => {
            const exportPool = exportPools.get(exporter.i) || {};
            return Object.keys(exportPool)
              .map(Number)
              .flatMap(goodId => {
                const available = exportPool[goodId] || 0;
                const good = goodById.get(goodId);
                const coverageWeight = good?.demandCoverage[demandCategory] || 0;
                if (!good || available <= 0.001 || coverageWeight <= 0) return [];

                return [{exporter, good, goodId, available, coverageWeight}];
              });
          })
          .sort((a, b) => b.coverageWeight - a.coverageWeight || a.good.value - b.good.value || a.goodId - b.goodId);

        for (const candidate of candidates) {
          if (shortage <= 0.001) break;

          const unitsNeeded = shortage / candidate.coverageWeight;
          const units = Math.min(candidate.available, unitsNeeded);
          if (units <= 0.001) continue;

          const exporterPool = exportPools.get(candidate.exporter.i)!;
          exporterPool[candidate.goodId] = Math.max(0, (exporterPool[candidate.goodId] || 0) - units);
          const exporterGood = this.getMarketGood(candidate.exporter, candidate.goodId, candidate.good.value);
          exporterGood.stock = Math.max(0, exporterGood.stock - units);
          const importerGood = this.getMarketGood(importer, candidate.goodId, candidate.good.value);
          importerGood.stock += units;
          shortage = Math.max(0, shortage - units * candidate.coverageWeight);

          const marketPrice = this.getMarketGood(candidate.exporter, candidate.goodId, candidate.good.value).sellPrice;
          this.recordDeal({
            market: importer.i,
            phase: "buy",
            goodId: candidate.goodId,
            units,
            buyer: importer.i,
            seller: candidate.exporter.i,
            price: marketPrice
          });

          const nextSell = this.applySellPressure(
            candidate.good,
            this.getMarketGood(candidate.exporter, candidate.goodId, candidate.good.value).sellPrice,
            -units
          );
          this.getMarketGood(candidate.exporter, candidate.goodId, candidate.good.value).sellPrice = nextSell;

          const nextBuy = this.applyBuyPressure(
            candidate.good,
            this.getMarketGood(importer, candidate.goodId, candidate.good.value).buyPrice,
            -units
          );
          this.getMarketGood(importer, candidate.goodId, candidate.good.value).buyPrice = nextBuy;
        }
      }
    }

    this.updateMarketDemand(goods, productionData, demandInventory);
  }

  buyFromMarket(params: {burg: Burg; good: Good; units: number; marketPrice: number}) {
    const {burg, good, marketPrice} = params;
    const market = this.getMarketForBurg(burg);
    if (!market || params.units <= 0) return {units: 0, totalCost: 0, taxAmount: 0, dealId: null};

    const marketGood = this.getMarketGood(market, good.i, good.value);
    const actualUnits = Math.min(params.units, marketGood.stock || 0);
    if (actualUnits <= 0) return {units: 0, totalCost: 0, taxAmount: 0, dealId: null};

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

    return {units: actualUnits, totalCost: actualUnits * marketPrice, taxAmount: 0, dealId: deal.id};
  }

  sellToMarket(params: {burg: Burg; good: Good; units: number; marketPrice: number}) {
    const {burg, good, marketPrice} = params;
    const market = this.getMarketForBurg(burg);
    if (!market || params.units <= 0) return {units: 0, revenue: 0, taxAmount: 0, dealId: null};

    const marketGood = this.getMarketGood(market, good.i, good.value);
    marketGood.stock += params.units;
    const grossRevenue = params.units * marketPrice;
    const taxAmount = grossRevenue * this.getSalesTaxRate(burg);
    const revenue = grossRevenue - taxAmount;

    const deal = this.recordDeal({
      market: market.i,
      phase: "sell",
      goodId: good.i,
      units: params.units,
      buyer: market.i,
      seller: burg.i!,
      price: marketPrice
    });

    return {units: params.units, revenue, taxAmount, dealId: deal.id};
  }

  private buildMarkets(goods: Good[], burgs: Burg[]): Market[] {
    const validBurgs = burgs.filter(burg => burg.i && !burg.removed);
    if (!validBurgs.length) return [];

    for (const burg of burgs) {
      if (!burg?.i || burg.removed) continue;
      burg.market = 0;
    }

    // Score each burg by population; capitals and ports are weighted higher
    const scored = validBurgs
      .map(burg => {
        let score = burg.population || 0;
        if (burg.capital) score *= 2;
        if (burg.port) score *= 2;
        return {burg, score};
      })
      .sort((a, b) => b.score - a.score);

    // minSpacing scales with map size relative to burg count
    let minSpacing = (((graphWidth + graphHeight) * 4) / validBurgs.length ** 0.7) | 0;

    const markets: Market[] = [];
    const tree = quadtree<[number, number, number]>(
      [],
      d => d[0],
      d => d[1]
    );

    for (const {burg} of scored) {
      const {x, y} = burg;
      const nearest = tree.find(x, y, minSpacing);

      if (nearest) {
        burg.market = nearest[2]; // Assign to existing market
      } else {
        // Create a new market anchored at this burg
        const marketId = markets.length + 1;
        const market = this.createMarket(marketId, burg.i!, goods);
        markets.push(market);
        tree.add([x, y, marketId]);
        burg.market = marketId;
      }

      minSpacing += 1;
    }

    return markets;
  }

  private calculateDemandCoverage(inventory: Record<number, number>, goodById: Map<number, Good>): number[] {
    const demandCoverage = this.createDemandVector(DEMAND_PRIORITY);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      const good = goodById.get(goodId);
      if (!good) continue;

      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        const coverageWeight = good.demandCoverage[demandCategory] || 0;
        if (!coverageWeight) continue;
        demandCoverage[categoryIndex] += amount * coverageWeight;
      }
    }

    return demandCoverage;
  }

  private splitInventoryByDemand(
    inventory: Record<number, number>,
    demandTargets: number[],
    goodById: Map<number, Good>
  ): {
    retainedInventory: Record<number, number>;
    excessInventory: Record<number, number>;
  } {
    const retainedInventory: Record<number, number> = {};
    const excessInventory: Record<number, number> = {...inventory};
    const retainedDemandCoverage = this.createDemandVector(DEMAND_PRIORITY);

    for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
      const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
      const candidates = Object.keys(excessInventory)
        .map(Number)
        .filter(goodId => {
          const amount = excessInventory[goodId] || 0;
          const good = goodById.get(goodId);
          return amount > 0 && Boolean(good?.demandCoverage[demandCategory]);
        })
        .sort((a, b) => {
          const coverageA = goodById.get(a)?.demandCoverage[demandCategory] || 0;
          const coverageB = goodById.get(b)?.demandCoverage[demandCategory] || 0;
          return coverageB - coverageA || a - b;
        });

      for (const goodId of candidates) {
        const shortage = Math.max(0, demandTargets[categoryIndex] - retainedDemandCoverage[categoryIndex]);
        if (shortage <= 0.001) break;

        const available = excessInventory[goodId] || 0;
        if (available <= 0) continue;
        const good = goodById.get(goodId)!;
        const coverageWeight = good.demandCoverage[demandCategory] || 0;
        if (!coverageWeight) continue;

        const keepAmount = Math.min(available, shortage / coverageWeight);
        if (keepAmount <= 0.001) continue;

        retainedInventory[goodId] = (retainedInventory[goodId] || 0) + keepAmount;
        excessInventory[goodId] = Math.max(0, available - keepAmount);

        for (let coverageCategoryIndex = 0; coverageCategoryIndex < DEMAND_PRIORITY.length; coverageCategoryIndex++) {
          const coverageCategory = DEMAND_PRIORITY[coverageCategoryIndex] as DemandCategory;
          const retainedCoverageWeight = good.demandCoverage[coverageCategory] || 0;
          if (!retainedCoverageWeight) continue;
          retainedDemandCoverage[coverageCategoryIndex] += keepAmount * retainedCoverageWeight;
        }
      }
    }

    return {retainedInventory, excessInventory};
  }

  private createMarketGoods(goods: Good[]): Record<number, MarketGoodData> {
    const marketGoods: Record<number, MarketGoodData> = {};

    for (const good of goods) {
      marketGoods[good.i] = {
        stock: 0,
        buyPrice: good.value,
        sellPrice: good.value
      };
    }

    return marketGoods;
  }

  private seedMarketsFromRuralProduction(goods: Good[], markets: Market[]): void {
    if (!markets.length) return;

    const {cells} = pack;
    this.assignCellsToMarkets(markets);
    const marketByCell = cells.market;
    const goodById = new Map<number, Good>(goods.map(good => [good.i, good]));
    const marketsById = new Map<number, Market>(markets.map(market => [market.i, market]));

    for (const cellId of cells.i) {
      const marketId = marketByCell[cellId];
      if (!marketId) continue;
      const market = marketsById.get(marketId);
      if (!market) continue;

      const cellPopulation = Math.max(0, cells.pop[cellId] || 0);
      const biomeId = cells.biome[cellId];
      const explicitGoodId = cells.good[cellId];

      if (explicitGoodId) {
        const explicitGood = this.getMarketGood(market, explicitGoodId, goodById.get(explicitGoodId)?.value || 0);
        explicitGood.stock += RURAL_BONUS_PRODUCTION;
      }

      if (cellPopulation <= 0) continue;
      for (const good of goods) {
        const biomeProduction = good.biome?.[biomeId] || 0;
        if (biomeProduction <= 0) continue;
        const marketGood = this.getMarketGood(market, good.i, good.value);
        marketGood.stock += cellPopulation * biomeProduction;
      }
    }
  }

  private initializeMarketPrices(goods: Good[], markets: Market[]): void {
    const consumerDemandFactor = this.buildConsumerDemandFactor(goods);
    const industrialDemandFactor = this.buildIndustrialDemandFactor(goods);

    for (const market of markets) {
      const population = this.getMarketBurgIds(market.i).reduce(
        (sum, burgId) => sum + (pack.burgs[burgId]?.population || 0),
        0
      );
      for (const good of goods) {
        const marketGood = this.getMarketGood(market, good.i, good.value);
        const stock = Math.max(0.001, marketGood.stock);
        const expectedDemand =
          population * (consumerDemandFactor[good.i] || 0) +
          Math.sqrt(Math.max(1, population)) * (industrialDemandFactor[good.i] || 0);
        const scarcity = expectedDemand > 0 ? expectedDemand / stock : 1;
        const floor = good.value * PRICE_FLOOR_FACTOR;
        const ceiling = good.value * PRICE_CEILING_FACTOR;
        const marketRate = Math.max(floor, Math.min(ceiling, good.value * scarcity));
        marketGood.buyPrice = Math.min(ceiling, marketRate * 1.1);
        marketGood.sellPrice = Math.max(floor, marketRate * 0.9);
      }
    }
  }

  private assignCellsToMarkets(markets: Market[]): void {
    const {cells, burgs} = pack;
    const assignment = new Uint16Array(cells.i.length);
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
      assignment[startCell] = market.i;
      costs[startCell] = 1;
      queue.push({cellId: startCell, marketId: market.i, burg, priority: 0}, 0);
    }

    while (queue.length) {
      const {cellId, marketId, burg, priority} = queue.pop();
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
          queue.push({cellId: neighborId, marketId, burg, priority: totalCost}, totalCost);

          const hasGood = Boolean(cells.good[neighborId]);
          const isDeepWater = cells.t[neighborId] < -1;
          if (isDeepWater && !hasGood) continue; // exclude deep water cells without goods

          assignment[neighborId] = marketId;
        }
      }
    }

    pack.cells.market = assignment;

    for (const burg of burgs as Burg[]) {
      if (!burg?.i || burg.removed) continue;
      burg.market = assignment[burg.cell] || 0;
    }
  }

  private buildConsumerDemandFactor(goods: Good[]): number[] {
    const demandFactor: number[] = [];
    for (const good of goods) {
      demandFactor[good.i] = DEMAND_PRIORITY.reduce((sum, category) => {
        return sum + (good.demandCoverage[category] || 0) * DEMAND_TARGET_FACTORS[category];
      }, 0);
    }
    return demandFactor;
  }

  private buildIndustrialDemandFactor(goods: Good[]): number[] {
    const demandFactor: number[] = [];

    for (const good of goods) {
      if (!good.recipes?.length) continue;
      for (const recipe of good.recipes) {
        for (const [ingredientIdStr, amount] of Object.entries(recipe)) {
          const ingredientId = +ingredientIdStr;
          const ingredient = goods[ingredientId];
          if (!ingredient) continue;
          demandFactor[ingredientId] =
            (demandFactor[ingredientId] || 0) +
            amount * Math.max(0.05, good.value / Math.max(1, ingredient.value)) * 0.05;
        }
      }
    }

    return demandFactor;
  }

  private applyBuyPressure(good: Good, currentPrice: number | undefined, unitsDelta: number): number {
    const basePrice = currentPrice ?? good.value;
    const floor = good.value * PRICE_FLOOR_FACTOR;
    const ceiling = good.value * PRICE_CEILING_FACTOR;
    return Math.max(floor, Math.min(ceiling, basePrice + unitsDelta * good.value * BUY_PRESSURE_FACTOR));
  }

  private applySellPressure(good: Good, currentPrice: number | undefined, unitsDelta: number): number {
    const basePrice = currentPrice ?? good.value;
    const floor = good.value * PRICE_FLOOR_FACTOR;
    const ceiling = good.value * PRICE_CEILING_FACTOR;
    return Math.max(floor, Math.min(ceiling, basePrice - unitsDelta * good.value * SELL_PRESSURE_FACTOR));
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
