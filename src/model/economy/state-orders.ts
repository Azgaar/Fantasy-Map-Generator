import { sum } from "d3";
import { EXPENSES, type Expense, noExpenses } from "@/data/expenses";
import type { Burg } from "@/model/political/burgs-generator";
import type { State } from "@/model/political/states-generator";
import type { DemandCategory, Good, Market } from "@/types/economy";
import { rn } from "@/utils/number-utils";
import { Corruption, type ProvinceCorruption } from "./corruption";
import { DEAL_KINDS } from "./deals";
import { getVarietyShares } from "./demand";
import { Markets } from "./markets-generator";
import { Taxes } from "./taxes";
import { Trade, type TradeTerms } from "./trade";

/** The needs each expense buys for, with the share of its money */
const EXPENSE_NEEDS: Record<Expense, [DemandCategory, number][]> = {
  court: [["luxury", 1]],
  administration: [["utilities", 1]],
  infrastructure: [["construction", 1]],
  military: [
    ["military", 0.6],
    ["food", 0.4]
  ]
};
const MIN_ORDER = 1; // money a buyer gathers before it orders, so it buys in lots rather than crumbs
export const PROVISION_NEED = { infrastructure: 0.05, court: 0.08 }; // spending a person a day that serves the state's people fully

/** A burg an expense buys at, with its share of the expense; corruption: its province's, before administration */
type Buyer = { burg: Burg; share: number; corruption: number; spent: number };
type StateRun = {
  stateId: number;
  dawn: number; // money known at dawn: the poll tax its burgs owe, its market fees and its adjustments
  ruralPollTax: number; // settled at the day's last orders
  buyers: Record<Expense, Buyer[]>;
  terms: TradeTerms;
};

class StateOrdersModule {
  private runs: StateRun[] = [];
  private goodsFor = new Map<DemandCategory, Good[]>(); // by need: the goods covering it, for the run

  /** Starts the run, once burgs owe their poll tax: what each state has at dawn and where it buys */
  start(): void {
    const terms = Trade.getTradeTerms();
    const fees = Taxes.getMarketFees();
    const dawn: number[] = [];
    for (const burg of pack.burgs)
      if (burg.i && !burg.removed && burg.pollTaxPaid)
        dawn[burg.state || 0] = (dawn[burg.state || 0] || 0) + burg.pollTaxPaid;
    this.goodsFor.clear();
    for (const [need] of Object.values(EXPENSE_NEEDS).flat())
      this.goodsFor.set(
        need,
        options.map.goods.filter(good => good.demandCoverage?.[need])
      );

    this.runs = [];
    for (const state of pack.states) {
      if (!state.i || state.removed) continue;
      const capital = pack.burgs[state.capital];
      const atCapital = capital?.i && !capital.removed && Markets.ofBurg(capital) ? capital : undefined;
      const inCapital = (): Buyer[] =>
        atCapital
          ? [{ burg: atCapital, share: 1, corruption: this.tendency(state, Corruption.ofCapital(state)), spent: 0 }]
          : [];
      // by province, as collection counts officials' cut; one whose capital has no market buys at the state's
      const inProvinces = (): Buyer[] =>
        Corruption.getProvinces(state.i).flatMap(province => {
          const burg = province.burg && Markets.ofBurg(province.burg) ? province.burg : atCapital;
          return burg ? [{ burg, share: province.share, corruption: this.tendency(state, province), spent: 0 }] : [];
        });
      const opening = (dawn[state.i] || 0) + (fees[state.i] || 0) + sum(state.economy.adjustments, line => line.value);
      this.runs.push({
        stateId: state.i,
        dawn: opening,
        ruralPollTax: 0,
        buyers: {
          court: inCapital(),
          administration: inProvinces(),
          infrastructure: inProvinces(),
          military: inCapital()
        },
        terms: this.exempt(terms, state.i)
      });
    }
  }

  /** Each buyer spends its expenses' share of the taxes so far; the last turn spends the rest */
  place(last = false): void {
    const ruralPollTax = last ? Trade.settleRuralPollTax() : [];
    const least = last ? 0.01 : MIN_ORDER;
    for (const run of this.runs) {
      const state = pack.states[run.stateId];
      const { budget } = state.economy;
      if (last) run.ruralPollTax = ruralPollTax[run.stateId] || 0;
      const collected = this.getCollected(run);
      for (const expense of EXPENSES) {
        for (const buyer of run.buyers[expense]) {
          const corruption = Corruption.curb(state, collected, buyer.corruption); // officials pocket it of the buyer's allowance
          const money = (collected * budget[expense] * buyer.share * (100 - corruption)) / 10000 - buyer.spent;
          if (money < least) continue;
          for (const [need, part] of EXPENSE_NEEDS[expense])
            buyer.spent += this.order(buyer.burg, need, money * part, run.terms, !last);
        }
      }
    }
  }

  /** What the state collected so far, including taxes other states' orders pay it */
  private getCollected(run: StateRun): number {
    return run.dawn + run.ruralPollTax + Trade.getTaxesSoFar(run.stateId);
  }

  /** Ends the run: each state keeps what it spent and collected, for readers before collection */
  end(): void {
    for (const run of this.runs) {
      const spent = noExpenses();
      for (const expense of EXPENSES) spent[expense] = rn(sum(run.buyers[expense].map(buyer => buyer.spent)), 2);
      pack.states[run.stateId].economy.spent = spent;
      pack.states[run.stateId].economy.collected = rn(this.getCollected(run), 2);
    }
    this.runs = [];
    this.goodsFor.clear();
  }

  /** How fully last run's infrastructure or court spending served the state's people, 0 to 1 */
  getProvision(state: State | undefined, expense: keyof typeof PROVISION_NEED): number {
    if (!state?.i || state.removed) return 0;
    const need = PROVISION_NEED[expense] * ((state.urban || 0) + (state.rural || 0));
    return need ? Math.min(1, (state.economy.spent[expense] || 0) / need) : 0;
  }

  /** How fully last run's infrastructure spending served each province, 0 to 1, by province id */
  getInfrastructure(state: State): Map<number, number> {
    const served = new Map<number, number>();
    const provinces = Corruption.getProvinces(state.i);
    if (!state.economy) return served;
    const { collected } = state.economy;
    const kept = provinces.map(d => d.share * (1 - Corruption.ofProvince(state, d, collected) / 100));
    const total = kept.reduce((sum, value) => sum + value, 0);
    const spent = state.economy.spent.infrastructure || 0;
    provinces.forEach((d, k) => {
      const need = PROVISION_NEED.infrastructure * d.people;
      served.set(d.id, need && total ? Math.min(1, (spent * kept[k]) / total / need) : 0);
    });
    return served;
  }

  /** Spends on the need's goods at the buyer's market or the cheapest other; returns what it spent */
  private order(burg: Burg, need: DemandCategory, money: number, terms: TradeTerms, signal: boolean): number {
    const market = Markets.ofBurg(burg);
    if (!market) return 0;
    const options = (this.goodsFor.get(need) ?? []).map(good => ({
      good,
      price: Trade.customerBuyPrice(market, market.goods[good.i]?.price ?? good.value)
    }));
    const costPerCoverage = ({ good, price }: { good: Good; price: number }) => price / good.demandCoverage![need]!;
    const shares = getVarietyShares(options.map(costPerCoverage));

    let spent = 0;
    const sources = new Map<number, Market | null>(); // by good: where the buyer found it, kept for the rest of the order
    const buy = (good: Good, budget: number) => {
      if (budget < 0.01) return 0;
      if (!sources.has(good.i))
        sources.set(
          good.i,
          Trade.getSupplier(market, good, () => Trade.quoteSource(burg, good, terms)?.source)
        );
      const source = sources.get(good.i);
      if (!source || (source.goods[good.i]?.stock || 0) <= 0.01) return 0;
      const trade = Trade.buy({ burg, source, good, units: Infinity, kind: DEAL_KINDS.order, terms, budget });
      return trade ? trade.units * trade.price : 0;
    };
    options.forEach((option, k) => {
      const spend = money * shares[k];
      const cost = buy(option.good, spend);
      if (signal && cost < spend - 0.01) Trade.signalShortage(market, option.good, (spend - cost) / option.price);
      spent += cost;
    });
    for (const { good } of options.toSorted((a, b) => costPerCoverage(a) - costPerCoverage(b))) {
      if (money - spent < 0.01) break;
      spent += buy(good, money - spent);
    }
    return spent;
  }

  /** The province's corruption before administration, or the state's without provinces */
  private tendency(state: State, province: ProvinceCorruption | undefined): number {
    return province ? Corruption.getTendency(state, province) : state.economy.budget.corruption;
  }

  /** A state pays no sales tax or tariff to itself */
  private exempt(terms: TradeTerms, stateId: number): TradeTerms {
    return (source, market, good, price) => {
      const costs = terms(source, market, good, price);
      if (!costs) return null;
      return {
        taxPerUnit: Markets.getState(source) === stateId ? 0 : costs.taxPerUnit,
        tariffPerUnit: Markets.getState(market) === stateId ? 0 : costs.tariffPerUnit
      };
    };
  }
}

export const StateOrders = new StateOrdersModule();
