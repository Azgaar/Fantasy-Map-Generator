// A state's economy from the last run: what its people make and how well they live, its budget and its trade.
// Worked out from burgs, deals and markets on demand, so it needs nothing saved of its own

import { sum } from "d3";
import { States } from "@/model/political/states-generator";
import { Goods } from "./goods-generator";
import { Markets } from "./markets-generator";
import { Production } from "./production-generator";
import { type Living, PROSPERITY_LEVELS, Prosperity } from "./prosperity";
import { DEAL_KINDS, type Deal, Trade } from "./trade";

type Group = "towns" | "country";

/** A group of people's living, averaged by their numbers */
export type GroupLiving = Living & { people: number };

/** The sum of a state's figures; product is rural + manufacturing + trade */
export type StateAccounts = {
  people: number;
  townspeople: number;
  rural: number; // rural people's earnings from their produce
  manufacturing: number; // its burgs' product
  trade: number; // market margins its market centers took
  product: number;
  taxes: number; // taxes and fees it collected, adjustments aside
  wealth: number; // product per person
  prosperity: number | null; // all people's, by their numbers
  towns: GroupLiving | null;
  country: GroupLiving | null;
  levels: Record<Group, number[]>; // people at each prosperity level, by burgs and by cells
  burgWealth: number[]; // each burg's product per person
};

export type StateTrade = {
  exports: number;
  imports: number;
  partners: Map<number, { exports: number; imports: number }>;
  exported: number[]; // value by good id
  imported: number[];
  exportedUnits: number[]; // units by good id
  importedUnits: number[];
};

/** A deal's goods at the market's price: without carriage, taxes and the margin */
const goodsValue = (deal: Deal) => {
  const [, , , kind, units, price, tax, tariff, carriage] = deal;
  const margin = Trade.getMargin(deal);
  return kind === DEAL_KINDS.sale
    ? units * (price + carriage) + margin
    : units * price - tax - tariff - units * carriage - margin;
};

const emptyAccounts = (): StateAccounts => ({
  people: 0,
  townspeople: 0,
  rural: 0,
  manufacturing: 0,
  trade: 0,
  product: 0,
  taxes: 0,
  wealth: 0,
  prosperity: null,
  towns: null,
  country: null,
  levels: { towns: PROSPERITY_LEVELS.map(() => 0), country: PROSPERITY_LEVELS.map(() => 0) },
  burgWealth: []
});

class StateEconomyModule {
  private source: unknown = null; // the deals the cache describes
  private accounts = new Map<number, StateAccounts>();
  private world: StateAccounts | null = null;
  private outputSource: unknown = null; // the deals the outputs describe
  private outputs = new Map<number, number[]>();
  private worldOutput: number[] = [];

  getAccounts(stateId: number): StateAccounts | null {
    this.index();
    return this.accounts.get(stateId) ?? null;
  }

  /** The world's: all states, neutrals included */
  getWorld(): StateAccounts | null {
    this.index();
    return this.world;
  }

  getTrade(stateId: number): StateTrade {
    const trade: StateTrade = {
      exports: 0,
      imports: 0,
      partners: new Map(),
      exported: [],
      imported: [],
      exportedUnits: [],
      importedUnits: []
    };
    for (const deal of pack.deals) {
      const [burgId, marketId, goodId, kind] = deal;
      if (kind === DEAL_KINDS.kept) continue;
      const burgState = pack.burgs[burgId]?.state || 0;
      const market = Markets.getState(Markets.get(marketId));
      if (burgState === market || (burgState !== stateId && market !== stateId)) continue;
      // a burg selling abroad or a foreign burg buying here is an export; a burg buying abroad, an import
      const isExport = kind === DEAL_KINDS.sale ? burgState === stateId : market === stateId;
      const partner = burgState === stateId ? market : burgState;
      const value = goodsValue(deal);
      const row = trade.partners.get(partner) ?? { exports: 0, imports: 0 };
      if (isExport) {
        trade.exports += value;
        row.exports += value;
        trade.exported[goodId] = (trade.exported[goodId] || 0) + value;
        trade.exportedUnits[goodId] = (trade.exportedUnits[goodId] || 0) + deal[4];
      } else {
        trade.imports += value;
        row.imports += value;
        trade.imported[goodId] = (trade.imported[goodId] || 0) + value;
        trade.importedUnits[goodId] = (trade.importedUnits[goodId] || 0) + deal[4];
      }
      trade.partners.set(partner, row);
    }
    return trade;
  }

  /** Sales tax, tariffs, poll tax and market fees the state collected in the last run, the poll tax it was owed, and what its officials pocketed of it all */
  getBudget(stateId: number): {
    salesTax: number;
    tariffs: number;
    pollTax: number;
    pollTaxOwed: number;
    marketFees: number;
    markets: number;
    adjustments: number;
    corruption: number;
  } {
    const { salesTax, tariffs } = Trade.getTaxesByState();
    const { owed, paid } = States.getPollTax();
    return {
      salesTax: salesTax[stateId] || 0,
      tariffs: tariffs[stateId] || 0,
      pollTax: paid[stateId] || 0,
      pollTaxOwed: owed[stateId] || 0,
      marketFees: States.getMarketFees()[stateId] || 0,
      markets: pack.markets.filter(market => market.feePaid && Markets.getState(market) === stateId).length,
      adjustments: sum(pack.states[stateId]?.economy.adjustments ?? [], line => line.value),
      corruption: pack.states[stateId]?.economy.pocketed || 0
    };
  }

  /** Value at base prices of each good the state's burgs and countryside made, by good id */
  getOutput(stateId: number): number[] {
    this.indexOutputs();
    return this.outputs.get(stateId) ?? [];
  }

  /** The world's output, by good id */
  getWorldOutput(): number[] {
    this.indexOutputs();
    return this.worldOutput;
  }

  private indexOutputs(): void {
    if (this.outputSource === pack.deals) return;
    this.outputSource = pack.deals;
    this.outputs.clear();
    const world: number[] = [];
    this.worldOutput = world;
    const add = (stateId: number, goodId: number, units: number) => {
      const good = Goods.get(goodId);
      if (!good) return;
      const output = this.outputs.get(stateId) ?? [];
      this.outputs.set(stateId, output);
      for (const values of [output, world]) values[goodId] = (values[goodId] || 0) + units * good.value;
    };
    for (const burg of pack.burgs)
      if (burg.i && !burg.removed)
        for (const [goodId, units] of burg.production ?? []) add(burg.state || 0, goodId, units);
    Production.getRuralOutput().forEach((produced, cellId) => {
      if (!pack.cells.market[cellId]) return;
      for (const [goodId, units] of Object.entries(produced)) add(pack.cells.state[cellId], +goodId, units);
    });
  }

  private index(): void {
    if (this.source === pack.deals) return;
    this.source = pack.deals;
    this.accounts.clear();
    this.world = null;
    if (!pack.deals?.length) return; // no economy run: nothing to sum
    const world = emptyAccounts();
    this.world = world;
    const of = (stateId: number) => {
      const accounts = this.accounts.get(stateId) ?? emptyAccounts();
      this.accounts.set(stateId, accounts);
      return accounts;
    };
    const andWorld = (stateId: number) => [of(stateId), world];
    for (const state of pack.states) if (!state.removed) of(state.i); // a state with no people, the neutral lands too, has empty accounts
    // people-weighted sums of each group's living, averaged at the end
    const sums = new Map<StateAccounts, Partial<Record<Group, GroupLiving>>>();
    const live = (stateId: number, group: Group, people: number, living: Living | null) => {
      if (!living || !people) return;
      for (const accounts of andWorld(stateId)) {
        const groups = sums.get(accounts) ?? {};
        sums.set(accounts, groups);
        const row = groups[group] ?? { people: 0, needs: 0, comfort: 0, variety: 0, infrastructure: 0, prosperity: 0 };
        groups[group] = row;
        row.people += people;
        row.needs += people * living.needs;
        row.comfort += people * living.comfort;
        row.variety += people * living.variety;
        row.infrastructure += people * living.infrastructure;
        row.prosperity += people * living.prosperity;
        accounts.levels[group][PROSPERITY_LEVELS.indexOf(Prosperity.getLevel(living.prosperity))] += people;
      }
    };

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.population) continue;
      for (const accounts of andWorld(burg.state || 0)) {
        accounts.people += burg.population;
        accounts.townspeople += burg.population;
        accounts.manufacturing += burg.product || 0;
        accounts.burgWealth.push((burg.product || 0) / burg.population);
      }
      live(burg.state || 0, "towns", burg.population, Prosperity.getBurg(burg.i));
    }

    // each cell's rural people count in the state the cell is in, with its earnings and living
    for (const cellId of pack.cells.i) {
      const people = pack.cells.pop[cellId] || 0;
      if (!people) continue;
      const stateId = pack.cells.state[cellId];
      const rural = Prosperity.getRuralCell(cellId);
      for (const accounts of andWorld(stateId)) {
        accounts.people += people;
        accounts.rural += rural?.earned || 0;
      }
      live(stateId, "country", people, rural?.living ?? null);
    }

    for (const deal of pack.deals) {
      const margin = Trade.getMargin(deal);
      if (!margin) continue;
      for (const accounts of andWorld(Markets.getState(Markets.get(deal[1])))) accounts.trade += margin;
    }
    // rural purchases make no deals, but their margin goes to the center too
    for (const market of pack.markets) {
      const margin = market.rural?.margin;
      if (!margin) continue;
      for (const accounts of andWorld(Markets.getState(market))) accounts.trade += margin;
    }

    const average = (row: GroupLiving | undefined): GroupLiving | null =>
      row?.people
        ? {
            people: row.people,
            needs: row.needs / row.people,
            comfort: row.comfort / row.people,
            variety: row.variety / row.people,
            infrastructure: row.infrastructure / row.people,
            prosperity: row.prosperity / row.people
          }
        : null;
    const { salesTax, tariffs } = Trade.getTaxesByState();
    const taxes = [salesTax, tariffs, States.getPollTax().paid, States.getMarketFees()];
    const close = (accounts: StateAccounts, collected: number) => {
      accounts.product = accounts.rural + accounts.manufacturing + accounts.trade;
      accounts.taxes = collected;
      accounts.wealth = accounts.people ? accounts.product / accounts.people : 0;
      accounts.towns = average(sums.get(accounts)?.towns);
      accounts.country = average(sums.get(accounts)?.country);
      const lived = [accounts.towns, accounts.country].filter(group => group !== null);
      const people = lived.reduce((sum, group) => sum + group.people, 0);
      accounts.prosperity = people
        ? lived.reduce((sum, group) => sum + group.prosperity * group.people, 0) / people
        : null;
    };
    for (const [stateId, accounts] of this.accounts)
      close(
        accounts,
        sum(taxes, byState => byState[stateId] || 0)
      );
    close(world, sum(taxes.flat()));
  }
}

export const StateEconomy = new StateEconomyModule();
