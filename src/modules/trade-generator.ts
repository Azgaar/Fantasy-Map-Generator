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

export type TradeScope = "local" | "global";
export type TradePhase = "local-production-buy" | "local-sale" | "global-redistribution" | "local-demand-fill";
export type TradeActorType = "burg" | "market";

export type TradePriceSnapshot = {
  base: number;
  marketBuy: number;
  marketSell: number;
  consumerBuy: number;
};

export type TradeDeal = {
  id: number;
  phase: TradePhase;
  scope: TradeScope;
  goodId: number;
  units: number;
  buyerType: TradeActorType;
  buyerId: number;
  sellerType: TradeActorType;
  sellerId: number;
  centerId: number | null;
  fromCenterId: number | null;
  toCenterId: number | null;
  stateId: number;
  prices: TradePriceSnapshot;
  grossValue: number;
  taxRate: number;
  taxAmount: number;
  sellerProceeds: number;
};

export type Market = {
  i: number;
  name: string;
  cell: number;
  x: number;
  y: number;
  burgs: number[];
  inventory: Record<number, number>;
  demandTargets: number[];
  demandCoverage: number[];
  uncoveredDemand: number[];
  reserveFactor: number;
  buyPrice: number[];
  sellPrice: number[];
};

export type TradeRunData = {
  markets: Market[];
  deals: TradeDeal[];
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

  createMarket(id: number, name: string, goods: Good[], burgIds: number[] = [], anchor?: Burg): Market {
    const {buyPrice, sellPrice} = this.createPriceTemplate(goods);
    return {
      i: id,
      name,
      cell: anchor?.cell ?? 0,
      x: anchor?.x ?? 0,
      y: anchor?.y ?? 0,
      burgs: burgIds.slice(),
      inventory: {},
      demandTargets: [],
      demandCoverage: [],
      uncoveredDemand: [],
      reserveFactor: DEFAULT_TRADE_RESERVE_FACTOR,
      buyPrice,
      sellPrice
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

  recordDeal(deal: Omit<TradeDeal, "id">): TradeDeal {
    const nextDeal: TradeDeal = {id: this.data.deals.length, ...deal};
    this.data.deals.push(nextDeal);

    if (nextDeal.taxAmount > 0 && nextDeal.stateId > 0) {
      this.data.stateTaxes[nextDeal.stateId] = (this.data.stateTaxes[nextDeal.stateId] || 0) + nextDeal.taxAmount;
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

  getPriceSnapshot(good: Good, marketBuy: number, marketSell: number, burg?: Burg): TradePriceSnapshot {
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

      for (const burgId of market.burgs) {
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

      market.demandTargets = aggregatedUncoveredDemand.map(value => value * (1 + market.reserveFactor));
      market.demandCoverage = this.calculateDemandCoverage(market.inventory, goodById);
      market.uncoveredDemand = market.demandTargets.map((target, index) =>
        Math.max(0, target - market.demandCoverage[index])
      );
    }
  }

  redistributeAcrossMarkets(goods: Good[], productionData: Map<number, BurgProductionData>): void {
    this.updateMarketDemand(goods, productionData);
    const goodById = new Map<number, Good>(goods.map(good => [good.i, good]));
    const exportPools = new Map<number, Record<number, number>>();

    for (const market of this.data.markets) {
      exportPools.set(
        market.i,
        this.splitInventoryByDemand(market.inventory, market.demandTargets, goodById).excessInventory
      );
    }

    for (const importer of this.data.markets) {
      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const demandCategory = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        let shortage = importer.uncoveredDemand[categoryIndex] || 0;
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
          candidate.exporter.inventory[candidate.goodId] = Math.max(
            0,
            (candidate.exporter.inventory[candidate.goodId] || 0) - units
          );
          importer.inventory[candidate.goodId] = (importer.inventory[candidate.goodId] || 0) + units;
          shortage = Math.max(0, shortage - units * candidate.coverageWeight);

          const marketPrice = candidate.exporter.sellPrice[candidate.goodId] ?? candidate.good.value;
          this.recordDeal({
            phase: "global-redistribution",
            scope: "global",
            goodId: candidate.goodId,
            units,
            buyerType: "market",
            buyerId: importer.i,
            sellerType: "market",
            sellerId: candidate.exporter.i,
            centerId: null,
            fromCenterId: candidate.exporter.i,
            toCenterId: importer.i,
            stateId: 0,
            prices: this.getPriceSnapshot(
              candidate.good,
              importer.buyPrice[candidate.goodId] ?? candidate.good.value,
              marketPrice
            ),
            grossValue: units * marketPrice,
            taxRate: 0,
            taxAmount: 0,
            sellerProceeds: units * marketPrice
          });

          candidate.exporter.sellPrice[candidate.goodId] = this.applySellPressure(
            candidate.good,
            candidate.exporter.sellPrice[candidate.goodId],
            -units
          );
          importer.buyPrice[candidate.goodId] = this.applyBuyPressure(
            candidate.good,
            importer.buyPrice[candidate.goodId],
            -units
          );
        }
      }
    }

    this.updateMarketDemand(goods, productionData);
  }

  buyFromMarket(params: {burg: Burg; good: Good; units: number; marketPrice: number; phase?: TradePhase}) {
    const {burg, good, marketPrice} = params;
    const market = this.getMarketForBurg(burg);
    if (!market || params.units <= 0) return {units: 0, totalCost: 0, taxAmount: 0};

    const actualUnits = Math.min(params.units, market.inventory[good.i] || 0);
    if (actualUnits <= 0) return {units: 0, totalCost: 0, taxAmount: 0};

    market.inventory[good.i] = Math.max(0, (market.inventory[good.i] || 0) - actualUnits);

    const taxRate = this.getSalesTaxRate(burg);
    const consumerPrice = this.getConsumerPrice(burg, marketPrice);
    const grossValue = actualUnits * consumerPrice;
    const taxAmount = actualUnits * (consumerPrice - marketPrice);

    this.recordDeal({
      phase: params.phase || "local-production-buy",
      scope: "local",
      goodId: good.i,
      units: actualUnits,
      buyerType: "burg",
      buyerId: burg.i!,
      sellerType: "market",
      sellerId: market.i,
      centerId: market.i,
      fromCenterId: market.i,
      toCenterId: market.i,
      stateId: burg.state || 0,
      prices: this.getPriceSnapshot(good, marketPrice, marketPrice, burg),
      grossValue,
      taxRate,
      taxAmount,
      sellerProceeds: actualUnits * marketPrice
    });

    return {units: actualUnits, totalCost: grossValue, taxAmount};
  }

  sellToMarket(params: {burg: Burg; good: Good; units: number; marketPrice: number; phase?: TradePhase}) {
    const {burg, good, marketPrice} = params;
    const market = this.getMarketForBurg(burg);
    if (!market || params.units <= 0) return {units: 0, revenue: 0};

    market.inventory[good.i] = (market.inventory[good.i] || 0) + params.units;
    const revenue = params.units * marketPrice;

    this.recordDeal({
      phase: params.phase || "local-sale",
      scope: "local",
      goodId: good.i,
      units: params.units,
      buyerType: "market",
      buyerId: market.i,
      sellerType: "burg",
      sellerId: burg.i!,
      centerId: market.i,
      fromCenterId: market.i,
      toCenterId: market.i,
      stateId: burg.state || 0,
      prices: this.getPriceSnapshot(good, marketPrice, marketPrice, burg),
      grossValue: revenue,
      taxRate: 0,
      taxAmount: 0,
      sellerProceeds: revenue
    });

    return {units: params.units, revenue};
  }

  private buildMarkets(goods: Good[], burgs: Burg[]): Market[] {
    const activeBurgs = burgs.filter(burg => burg.i && !burg.removed);
    if (!activeBurgs.length) return [];

    const candidates = this.getMarketCandidates(activeBurgs);
    const markets = candidates.map((burg, index) =>
      this.createMarket(index + 1, `${burg.name || `Burg ${burg.i}`} Market`, goods, [burg.i!], burg)
    );
    const marketsById = new Map(markets.map(market => [market.i, market]));
    const candidateByMarketId = new Map<number, Burg>(candidates.map((burg, index) => [index + 1, burg]));

    for (const burg of activeBurgs) {
      const marketId = this.assignBurgToMarket(burg, markets, candidateByMarketId);
      burg.marketId = marketId;

      const market = marketsById.get(marketId);
      if (market && !market.burgs.includes(burg.i!)) {
        market.burgs.push(burg.i!);
      }
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

  private getMarketCandidates(burgs: Burg[]): Burg[] {
    const candidates = burgs.filter(
      burg => burg.capital || burg.port || burg.group === "trading_post" || burg.group === "caravanserai"
    );
    if (candidates.length) return candidates;

    const capitals = burgs.filter(burg => burg.capital);
    if (capitals.length) return capitals;

    return [burgs[0]];
  }

  private assignBurgToMarket(burg: Burg, markets: Market[], candidateByMarketId: Map<number, Burg>): number {
    let selectedMarket = markets[0];
    let bestDistance = Infinity;
    const sameStateMarkets = markets.filter(market => {
      const candidate = candidateByMarketId.get(market.i);
      return candidate?.state === burg.state;
    });
    const eligibleMarkets = sameStateMarkets.length ? sameStateMarkets : markets;

    for (const market of eligibleMarkets) {
      const candidate = candidateByMarketId.get(market.i);
      if (!candidate) continue;
      const dx = candidate.x - burg.x;
      const dy = candidate.y - burg.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        selectedMarket = market;
      }
    }

    return selectedMarket.i;
  }

  private createPriceTemplate(goods: Good[]) {
    const buyPrice: number[] = [];
    const sellPrice: number[] = [];

    for (const good of goods) {
      buyPrice[good.i] = good.value;
      sellPrice[good.i] = good.value;
    }

    return {buyPrice, sellPrice};
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
