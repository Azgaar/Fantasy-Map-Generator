// States spend their budget's expenses of the taxes they collect during the economy run, as the taxes come in:
// the court and the army buy at the capital, administration and infrastructure at the provinces' seats

import { sum } from "d3";
import type { Burg } from "@/model/political/burgs-generator";
import { EXPENSES, type Expense, noExpenses, States } from "@/model/political/states-generator";
import { rn } from "@/utils/number-utils";
import { type DemandCategory, type Good, getVarietyShares } from "./goods-generator";
import { DEAL_KINDS, type Market, Markets, type TradeTerms } from "./markets-generator";

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

type Seat = { burg: Burg; share: number; spent: number };
type StateRun = {
  stateId: number;
  dawn: number; // money known at dawn: the poll tax its burgs owe, its market fees and its other revenue
  seats: Record<Expense, Seat[]>;
  terms: TradeTerms;
};

class StateOrdersModule {
  private runs: StateRun[] = [];
  private goodsFor = new Map<DemandCategory, Good[]>(); // by need: the goods covering it, for the run

  /** Starts the run, once burgs owe their poll tax: what each state has at dawn and where it buys */
  start(): void {
    const terms = Markets.getTradeTerms();
    const fees = States.getMarketFees();
    const dawn: number[] = [];
    for (const burg of pack.burgs)
      if (burg.i && !burg.removed && burg.pollTaxPaid)
        dawn[burg.state || 0] = (dawn[burg.state || 0] || 0) + burg.pollTaxPaid;
    const provinceSeats = this.getProvinceSeats();
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
      const atCapital = () =>
        capital?.i && !capital.removed && Markets.ofBurg(capital) ? [{ burg: capital, share: 1, spent: 0 }] : [];
      const atSeats = () =>
        provinceSeats[state.i]?.length ? provinceSeats[state.i].map(seat => ({ ...seat, spent: 0 })) : atCapital();
      this.runs.push({
        stateId: state.i,
        dawn: (dawn[state.i] || 0) + (fees[state.i] || 0) + state.economy.otherRevenue,
        seats: { court: atCapital(), administration: atSeats(), infrastructure: atSeats(), military: atCapital() },
        terms: this.exempt(terms, state.i)
      });
    }
  }

  /** A turn: each seat spends its expenses' share of what the state collected so far; the day's last spends the rest */
  place(last = false): void {
    const ruralPollTax = last ? Markets.getRuralPollTax() : [];
    const least = last ? 0.01 : MIN_ORDER;
    for (const run of this.runs) {
      const { budget } = pack.states[run.stateId].economy;
      const collected = run.dawn + Markets.getTaxesSoFar(run.stateId) + (ruralPollTax[run.stateId] || 0);
      for (const expense of EXPENSES) {
        const allowance = (collected * budget[expense] * (100 - budget.corruption)) / 10000; // officials pocket the rest
        for (const seat of run.seats[expense]) {
          const money = allowance * seat.share - seat.spent;
          if (money < least) continue;
          for (const [need, part] of EXPENSE_NEEDS[expense])
            seat.spent += this.order(seat.burg, need, money * part, run.terms, !last);
        }
      }
    }
  }

  /** Ends the run: each state keeps what its expenses spent */
  end(): void {
    for (const run of this.runs) {
      const spent = noExpenses();
      for (const expense of EXPENSES) spent[expense] = rn(sum(run.seats[expense].map(seat => seat.spent)), 2);
      pack.states[run.stateId].economy.spent = spent;
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
      price: Markets.customerBuyPrice(market, market.goods[good.i]?.price ?? good.value)
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
          Markets.getSupplier(market, good, () => Markets.quoteSource(burg, good, terms)?.source)
        );
      const source = sources.get(good.i);
      if (!source || (source.goods[good.i]?.stock || 0) <= 0.01) return 0;
      const trade = Markets.buy({ burg, source, good, units: Infinity, kind: DEAL_KINDS.order, terms, budget });
      return trade ? trade.units * trade.price : 0;
    };
    options.forEach((option, k) => {
      const spend = money * shares[k];
      const cost = buy(option.good, spend);
      if (signal && cost < spend - 0.01) Markets.signalShortage(market, option.good, (spend - cost) / option.price);
      spent += cost;
    });
    for (const { good } of options.toSorted((a, b) => costPerCoverage(a) - costPerCoverage(b))) {
      if (money - spent < 0.01) break;
      spent += buy(good, money - spent);
    }
    return spent;
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

  /** Each state's provinces' seats, shared by their people; people of no province or one without a seat count for the capital */
  private getProvinceSeats(): Omit<Seat, "spent">[][] {
    const { cells, burgs, provinces, states } = pack;
    const people: Map<number, number>[] = []; // by state: seat burg id -> people
    for (const cellId of cells.i) {
      const stateId = cells.state[cellId];
      if (!stateId || states[stateId]?.removed) continue;
      const count = (cells.pop[cellId] || 0) + (cells.burg[cellId] ? burgs[cells.burg[cellId]]?.population || 0 : 0);
      if (!count) continue;
      const province = provinces?.[cells.province?.[cellId] || 0];
      const seat = province && !province.removed ? burgs[province.burg] : undefined;
      const seatId =
        seat?.i && !seat.removed && Markets.ofBurg(seat) && seat.state === stateId ? seat.i : states[stateId].capital;
      people[stateId] ??= new Map();
      people[stateId].set(seatId, (people[stateId].get(seatId) || 0) + count);
    }

    return people.map(seats => {
      const valid = [...seats].filter(
        ([burgId]) => burgs[burgId]?.i && !burgs[burgId].removed && Markets.ofBurg(burgs[burgId])
      );
      const total = valid.reduce((sum, [, count]) => sum + count, 0);
      return valid.map(([burgId, count]) => ({ burg: burgs[burgId], share: count / total }));
    });
  }
}

export const StateOrders = new StateOrdersModule();
