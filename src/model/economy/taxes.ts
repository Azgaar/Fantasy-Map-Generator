import { sum } from "d3";
import { EXPENSES } from "@/data/expenses";
import type { Deal } from "@/types/economy";
import { rn } from "@/utils/number-utils";
import { Corruption } from "./corruption";
import { DEAL_KINDS } from "./deals";
import { Markets } from "./markets-generator";

export type TariffRate = number | "embargo";

/** What states charge, from their settings, and what they collected in the last run */
class TaxesModule {
  /** Adds up the deals' taxes, poll tax, fees and adjustments, into each state's accounts and treasury */
  collect(): void {
    const { states } = pack;
    if (!states?.length) return;
    const { salesTax, tariffs } = this.getTaxesByState();

    const pollTax = this.getPollTax().paid;
    const marketFees = this.getMarketFees();
    for (const state of states) {
      if (!state.i || state.removed) continue;
      const { budget, adjustments } = state.economy;
      const collected = rn(
        (salesTax[state.i] || 0) +
          (tariffs[state.i] || 0) +
          (pollTax[state.i] || 0) +
          (marketFees[state.i] || 0) +
          sum(adjustments, line => line.value),
        2
      );
      const expenses = sum(EXPENSES.map(expense => budget[expense]));
      const corruption = Corruption.ofState(state, collected);
      const pocketed = rn((Math.max(0, collected) * expenses * corruption) / 10000, 2); // officials' cut of each expense
      state.economy.collected = collected;
      state.economy.pocketed = pocketed;
      state.economy.treasury = rn(collected - pocketed - sum(Object.values(state.economy.spent)), 2);
    }
  }

  getTaxesByState(): { salesTax: number[]; tariffs: number[] } {
    const salesTax: number[] = [];
    const tariffs: number[] = [];
    for (const deal of pack.deals) {
      const [, , , , , , tax, tariff] = deal;
      const { taxState, tariffState } = this.getTaxStates(deal);
      if (tax) salesTax[taxState] = (salesTax[taxState] || 0) + tax;
      if (tariff) tariffs[tariffState] = (tariffs[tariffState] || 0) + tariff;
    }
    return { salesTax, tariffs };
  }

  /** Poll tax owed and paid last run, by state: rural people pay as far as their money goes */
  getPollTax(): { owed: number[]; paid: number[] } {
    const owed: number[] = [];
    const paid: number[] = [];
    const add = (stateId: number, owes: number, pays: number) => {
      owed[stateId] = (owed[stateId] || 0) + owes;
      paid[stateId] = (paid[stateId] || 0) + pays;
    };
    for (const burg of pack.burgs ?? [])
      if (burg?.i && !burg.removed && burg.pollTaxPaid) add(burg.state || 0, burg.pollTaxPaid, burg.pollTaxPaid);
    for (const market of pack.markets ?? [])
      for (const [stateId, owes, pays] of market?.rural?.pollTax ?? []) add(stateId, owes, pays);
    return { owed, paid };
  }

  /** Market fees paid in the last run, by the state of each market's center */
  getMarketFees(): number[] {
    const paid: number[] = [];
    for (const market of pack.markets ?? []) {
      if (!market?.feePaid) continue;
      const stateId = Markets.getState(market);
      paid[stateId] = (paid[stateId] || 0) + market.feePaid;
    }
    return paid;
  }

  /** The states a deal's sales tax and tariff go to: the seller's, and the importer's market's */
  getTaxStates(deal: Deal): { taxState: number; tariffState: number } {
    const [burgId, , , kind] = deal;
    const { own, market } = this.getMarketStates(deal);
    return kind === DEAL_KINDS.sale
      ? { taxState: pack.burgs[burgId]?.state || 0, tariffState: market }
      : { taxState: market, tariffState: own };
  }

  /** Only an import may pay a tariff */
  isImport(deal: Deal): boolean {
    const { own, market } = this.getMarketStates(deal);
    return deal[7] > 0 || this.isForeign(own, market);
  }

  /** The rate of the deal's tariff: the importer's on goods from the other market's state */
  getDealTariffRate(deal: Deal): number {
    const [, , goodId, kind] = deal;
    const { own, market } = this.getMarketStates(deal);
    return kind === DEAL_KINDS.sale ? this.getTariffRate(market, own, goodId) : this.getTariffRate(own, market, goodId);
  }

  getSalesTax(burg?: { state?: number }): number {
    const stateId = burg?.state || 0;
    if (!stateId) return 0;
    return pack.states?.[stateId]?.economy.salesTax ?? 0;
  }

  /** The poll tax a state charges people at its rate; neutrals charge none */
  getPollTaxDue(stateId: number, people: number): number {
    const state = pack.states?.[stateId];
    return stateId && state && !state.removed ? (state.economy.pollTax || 0) * people : 0;
  }

  /** Trade between two states; neutral lands are no state: no tariff, embargo or import carriage */
  isForeign(stateA: number, stateB: number): boolean {
    return Boolean(stateA && stateB && stateA !== stateB);
  }

  /** The importer state's rate on the good from the exporter state, 0 under an embargo */
  getTariffRate(importerStateId: number, exporterStateId: number, goodId: number): number {
    const rate = this.findTariff(importerStateId, exporterStateId, goodId);
    return rate === "embargo" ? 0 : rate;
  }

  /** Any matching embargo of the importer, else its most specific tariff: state and good, state, good, all */
  findTariff(importerStateId: number, exporterStateId: number, goodId: number): TariffRate {
    const importer = pack.states[importerStateId];
    if (!this.isForeign(importerStateId, exporterStateId) || !importer || importer.removed) return 0;
    let rate = 0;
    let rank = -1;
    for (const { states, goods, rate: ruleRate } of importer.economy.tariffs) {
      if (states !== "all" && !states.includes(exporterStateId)) continue;
      if (goods !== "all" && !goods.includes(goodId)) continue;
      if (ruleRate === "embargo") return "embargo";
      const ruleRank = (states === "all" ? 0 : 2) + (goods === "all" ? 0 : 1);
      if (ruleRank >= rank) [rate, rank] = [ruleRate, ruleRank];
    }
    return rate;
  }

  /** A burg that lost its market since the run stays in its own state until the next one */
  private getMarketStates([burgId, marketId]: Deal): { own: number; market: number } {
    const burg = pack.burgs[burgId];
    const own = burg && Markets.ofBurg(burg);
    return {
      own: own ? Markets.getState(own) : burg?.state || 0,
      market: Markets.getState(Markets.get(marketId))
    };
  }
}

export const Taxes = new TaxesModule();
