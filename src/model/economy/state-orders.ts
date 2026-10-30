// States spend their budget's expenses of the taxes they collect during the economy run, as the taxes come in:
// the court and the army buy at the capital, administration and infrastructure at the provinces' seats

import { sum } from "d3";
import type { Burg } from "@/model/political/burgs-generator";
import { type District, Districts } from "@/model/political/districts";
import { EXPENSES, type Expense, noExpenses, type State, States } from "@/model/political/states-generator";
import { rn } from "@/utils/number-utils";
import { type DemandCategory, type Good, getVarietyShares } from "./goods-generator";
import { type Market, Markets } from "./markets-generator";
import { DEAL_KINDS, Trade, type TradeTerms } from "./trade";

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
const MIN_ORDER = 1; // money a seat gathers before it orders during the day, so it buys in lots rather than crumbs; the day's last orders take the rest

type Seat = { burg: Burg; share: number; corruption: number; spent: number }; // corruption: its district's, before administration
type StateRun = {
  stateId: number;
  dawn: number; // money known at dawn: the poll tax its burgs owe, its market fees and its adjustments
  collected: number; // so far
  seats: Record<Expense, Seat[]>;
  terms: TradeTerms;
};

class StateOrdersModule {
  private runs: StateRun[] = [];
  private goodsFor = new Map<DemandCategory, Good[]>(); // by need: the goods covering it, for the run

  /** Starts the run, once burgs owe their poll tax: what each state has at dawn and where it buys */
  start(): void {
    const terms = Trade.getTradeTerms();
    const fees = States.getMarketFees();
    const dawn: number[] = [];
    for (const burg of pack.burgs)
      if (burg.i && !burg.removed && burg.pollTaxPaid)
        dawn[burg.state || 0] = (dawn[burg.state || 0] || 0) + burg.pollTaxPaid;
    this.goodsFor.clear();
    for (const [need] of Object.values(EXPENSE_NEEDS).flat())
      this.goodsFor.set(
        need,
        pack.goods.filter(good => good.demandCoverage?.[need])
      );

    this.runs = [];
    for (const state of pack.states) {
      if (!state.i || state.removed) continue;
      const capital = pack.burgs[state.capital];
      const district = Districts.getCapital(state);
      const atCapital = (): Seat[] =>
        capital?.i && !capital.removed && Markets.ofBurg(capital)
          ? [{ burg: capital, share: 1, corruption: this.tendency(state, district), spent: 0 }]
          : [];
      const atSeats = (): Seat[] => {
        const seats = Districts.get(state.i).filter(d => d.seat && Markets.ofBurg(d.seat));
        const total = seats.reduce((sum, d) => sum + d.share, 0);
        if (!total) return atCapital();
        return seats.map(d => ({
          burg: d.seat!,
          share: d.share / total,
          corruption: this.tendency(state, d),
          spent: 0
        }));
      };
      const opening =
        (dawn[state.i] || 0) + (fees[state.i] || 0) + sum(state.economy.adjustments ?? [], line => line.value);
      this.runs.push({
        stateId: state.i,
        dawn: opening,
        collected: opening,
        seats: { court: atCapital(), administration: atSeats(), infrastructure: atSeats(), military: atCapital() },
        terms: this.exempt(terms, state.i)
      });
    }
  }

  /** A turn: each seat spends its expenses' share of what the state collected so far; the day's last spends the rest */
  place(last = false): void {
    const ruralPollTax = last ? Trade.settleRuralPollTax() : [];
    const least = last ? 0.01 : MIN_ORDER;
    for (const run of this.runs) {
      const state = pack.states[run.stateId];
      const { budget } = state.economy;
      const collected = run.dawn + Trade.getTaxesSoFar(run.stateId) + (ruralPollTax[run.stateId] || 0);
      run.collected = collected;
      for (const expense of EXPENSES) {
        for (const seat of run.seats[expense]) {
          const corruption = States.getCorruption(state, collected, seat.corruption); // officials pocket it of the seat's allowance
          const money = (collected * budget[expense] * seat.share * (100 - corruption)) / 10000 - seat.spent;
          if (money < least) continue;
          for (const [need, part] of EXPENSE_NEEDS[expense])
            seat.spent += this.order(seat.burg, need, money * part, run.terms, !last);
        }
      }
    }
  }

  /** Ends the run: each state keeps what its expenses spent, and what it collected, so what reads it before collection sees this run's */
  end(): void {
    for (const run of this.runs) {
      const spent = noExpenses();
      for (const expense of EXPENSES) spent[expense] = rn(sum(run.seats[expense].map(seat => seat.spent)), 2);
      pack.states[run.stateId].economy.spent = spent;
      pack.states[run.stateId].economy.collected = rn(run.collected, 2);
    }
    this.runs = [];
    this.goodsFor.clear();
  }

  /** Spends on the goods covering the need, cheaper ones getting more, at the seat's market or the cheapest other. Returns what it spent */
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
    const sources = new Map<number, Market | null>(); // by good: where the seat found it, kept for the rest of the order
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

  /** The district's corruption before administration, or the state's without districts */
  private tendency(state: State, district: District | undefined): number {
    return district ? Districts.getTendency(state, district) : state.economy.budget.corruption;
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
