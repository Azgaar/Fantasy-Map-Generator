import {quadtree} from "d3-quadtree";
import {rn} from "../utils";
import type {Burg} from "./burgs-generator";
import type {DemandCategory, Good} from "./goods-generator";
import {DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "./goods-generator";
import type {BurgProductionData} from "./production-generator";

export const DEFAULT_SALES_TAX = 0.2;
export const DEFAULT_TRADE_RESERVE_FACTOR = 0.2;
const BUY_PRESSURE_FACTOR = 0.002;
const SELL_PRESSURE_FACTOR = 0.001;
const PRICE_FLOOR_FACTOR = 0.5;
const PRICE_CEILING_FACTOR = 3.0;

export type TradePhase = "local-production-buy" | "local-sale" | "global-redistribution" | "local-demand-fill";

export type DealPrice = {
  base: number;
  marketBuy: number;
  marketSell: number;
  consumerBuy: number;
};

export type Deal = {
  id: number;
  market: number;
  phase: TradePhase;
  goodId: number;
  units: number;
  buyerId: number;
  sellerId: number;
  prices: DealPrice;
};

export type MarketGoodData = {
  stock: number;
  buyPrice: number;
  sellPrice: number;
};

export type Market = {
  i: number;
  centerBurgId: number;
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
    this.data = {
      markets: [],
      deals: [],
      stateTaxes: {}
    };
    this.syncPackData();
    return this.data;
  }

  initialize(goods: Good[], burgs: Burg[]): TradeRunData {
    this.reset();
    const markets = this.buildMarkets(goods, burgs);
    this.setMarkets(markets);
    return this.data;
  }

  createMarket(id: number, centerBurgId: number, goods: Good[]): Market {
    return {
      i: id,
      centerBurgId,
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
    return this.getMarket(burg.marketId);
  }

  getMarketBurgIds(marketId: number): number[] {
    return (pack.burgs as Burg[])
      .filter(burg => burg.i && !burg.removed && burg.marketId === marketId)
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

  recordDeal(deal: Omit<Deal, "id">): Deal {
    const nextDeal: Deal = {
      id: this.data.deals.length,
      ...deal,
      units: rn(deal.units, 2)
    };
    this.data.deals.push(nextDeal);

    const taxAmount = nextDeal.units * (nextDeal.prices.consumerBuy - nextDeal.prices.marketBuy);
    const isLocalBuy = nextDeal.phase === "local-production-buy" || nextDeal.phase === "local-demand-fill";
    const stateId = isLocalBuy ? (pack.burgs[nextDeal.buyerId] as Burg | undefined)?.state || 0 : 0;

    if (taxAmount > 0 && stateId > 0) {
      this.data.stateTaxes[stateId] = (this.data.stateTaxes[stateId] || 0) + taxAmount;
    }

    return nextDeal;
  }

  getSalesTaxRate(burg: Burg): number {
    const stateId = burg.state || 0;
    if (!stateId) return 0;
    return pack.states?.[stateId]?.salesTax ?? DEFAULT_SALES_TAX;
  }

  getConsumerPrice(burg: Burg, marketPrice: number): number {
    return marketPrice * (1 + this.getSalesTaxRate(burg));
  }

  getPriceSnapshot(good: Good, marketBuy: number, marketSell: number, burg?: Burg): DealPrice {
    return {
      base: good.value,
      marketBuy,
      marketSell,
      consumerBuy: burg ? this.getConsumerPrice(burg, marketBuy) : marketBuy
    };
  }

  createDemandVector(categories: readonly DemandCategory[]): number[] {
    return Array(categories.length).fill(0);
  }

  updateMarketDemand(goods: Good[], productionData: Map<number, BurgProductionData>): void {
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
        const burgCoverage = this.calculateDemandCoverage(data.finalInventory, goodById);

        for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
          aggregatedUncoveredDemand[categoryIndex] += Math.max(
            0,
            burgDemandTargets[categoryIndex] - burgCoverage[categoryIndex]
          );
        }
      }

      const demandTargets = aggregatedUncoveredDemand.map(value => value * (1 + DEFAULT_TRADE_RESERVE_FACTOR));
      const demandCoverage = this.calculateDemandCoverage(this.getMarketInventory(market), goodById);
      void demandTargets.map((target, index) => Math.max(0, target - demandCoverage[index]));
    }
  }

  redistributeAcrossMarkets(goods: Good[], productionData: Map<number, BurgProductionData>): void {
    this.updateMarketDemand(goods, productionData);
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
        const burgCoverage = this.calculateDemandCoverage(data.finalInventory, goodById);

        for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
          marketDemand[categoryIndex] += Math.max(0, burgDemandTargets[categoryIndex] - burgCoverage[categoryIndex]);
        }
      }

      const demandTargets = marketDemand.map(value => value * (1 + DEFAULT_TRADE_RESERVE_FACTOR));
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
            phase: "global-redistribution",
            goodId: candidate.goodId,
            units,
            buyerId: importer.i,
            sellerId: candidate.exporter.i,
            prices: this.getPriceSnapshot(
              candidate.good,
              this.getMarketGood(importer, candidate.goodId, candidate.good.value).buyPrice,
              marketPrice
            )
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

    this.updateMarketDemand(goods, productionData);
  }

  buyFromMarket(params: {burg: Burg; good: Good; units: number; marketPrice: number; phase?: TradePhase}) {
    const {burg, good, marketPrice} = params;
    const market = this.getMarketForBurg(burg);
    if (!market || params.units <= 0) return {units: 0, totalCost: 0, taxAmount: 0};

    const marketGood = this.getMarketGood(market, good.i, good.value);
    const actualUnits = Math.min(params.units, marketGood.stock || 0);
    if (actualUnits <= 0) return {units: 0, totalCost: 0, taxAmount: 0};

    marketGood.stock = Math.max(0, marketGood.stock - actualUnits);

    const consumerPrice = this.getConsumerPrice(burg, marketPrice);
    const grossValue = actualUnits * consumerPrice;
    const taxAmount = actualUnits * (consumerPrice - marketPrice);

    this.recordDeal({
      market: market.i,
      phase: params.phase || "local-production-buy",
      goodId: good.i,
      units: actualUnits,
      buyerId: burg.i!,
      sellerId: market.i,
      prices: this.getPriceSnapshot(good, marketPrice, marketPrice, burg)
    });

    return {units: actualUnits, totalCost: grossValue, taxAmount};
  }

  sellToMarket(params: {burg: Burg; good: Good; units: number; marketPrice: number; phase?: TradePhase}) {
    const {burg, good, marketPrice} = params;
    const market = this.getMarketForBurg(burg);
    if (!market || params.units <= 0) return {units: 0, revenue: 0};

    const marketGood = this.getMarketGood(market, good.i, good.value);
    marketGood.stock += params.units;
    const revenue = params.units * marketPrice;

    this.recordDeal({
      market: market.i,
      phase: params.phase || "local-sale",
      goodId: good.i,
      units: params.units,
      buyerId: market.i,
      sellerId: burg.i!,
      prices: this.getPriceSnapshot(good, marketPrice, marketPrice, burg)
    });

    return {units: params.units, revenue};
  }

  private buildMarkets(goods: Good[], burgs: Burg[]): Market[] {
    const validBurgs = burgs.filter(burg => burg.i && !burg.removed);
    if (!validBurgs.length) return [];

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
        burg.marketId = nearest[2]; // Assign to existing market
      } else {
        // Create a new market anchored at this burg
        const marketId = markets.length + 1;
        const market = this.createMarket(marketId, burg.i!, goods);
        markets.push(market);
        tree.add([x, y, marketId]);
        burg.marketId = marketId;
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
