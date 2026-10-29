// A state's economy from the last run: what its people make and how well they live, its budget and its trade.
// Worked out from burgs, deals and markets on demand, so it needs nothing saved of its own

import { States } from "@/model/political/states-generator";
import { DEMAND_PRIORITY, DEMAND_TARGET_FACTORS, Goods } from "./goods-generator";
import { DEAL_KINDS, type Deal, Markets } from "./markets-generator";
import { Production } from "./production-generator";
import { type Living, PROSPERITY_LEVELS, Prosperity } from "./prosperity";

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
  wealth: number; // product per person
  prosperity: number | null; // all people's, by their numbers
  towns: GroupLiving | null;
  country: GroupLiving | null;
  levels: Record<"towns" | "country", number[]>; // people at each prosperity level, by burgs and by cells
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

/** A deal's goods at the market's price, without carriage and taxes */
const goodsValue = ([, , , kind, units, price, tax, tariff, carriage]: Deal) =>
  kind === DEAL_KINDS.sale ? units * (price + carriage) : units * price - tax - tariff - units * carriage;

class StateEconomyModule {
  private source: unknown = null; // the deals the cache describes
  private accounts = new Map<number, StateAccounts>();
  private outputSource: unknown = null; // the deals the outputs describe
  private outputs = new Map<number, number[]>(); // by state, -1 for the world

  getAccounts(stateId: number): StateAccounts | null {
    this.index();
    return this.accounts.get(stateId) ?? null;
  }

  /** The world's: all states, neutrals included */
  getWorld(): StateAccounts | null {
    this.index();
    return this.accounts.get(-1) ?? null;
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
    const marketState = (marketId: number) => pack.burgs[Markets.get(marketId)?.centerBurgId ?? 0]?.state || 0;
    for (const deal of pack.deals) {
      const [burgId, marketId, goodId, kind] = deal;
      if (kind === DEAL_KINDS.kept) continue;
      const burgState = pack.burgs[burgId]?.state || 0;
      const market = marketState(marketId);
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
    corruption: number;
  } {
    let salesTax = 0;
    let tariffs = 0;
    for (const deal of pack.deals) {
      const { taxState, tariffState } = Markets.getTaxStates(deal);
      if (taxState === stateId) salesTax += deal[6];
      if (tariffState === stateId) tariffs += deal[7] || 0;
    }
    const { owed, paid } = States.getPollTax();
    const markets = pack.markets.filter(market => market.feePaid && pack.burgs[market.centerBurgId]?.state === stateId);
    const marketFees = markets.reduce((total, market) => total + (market.feePaid || 0), 0);
    const pollTax = paid[stateId] || 0;
    return {
      salesTax,
      tariffs,
      pollTax,
      pollTaxOwed: owed[stateId] || 0,
      marketFees,
      markets: markets.length,
      corruption: pack.states[stateId]?.economy.pocketed || 0
    };
  }

  /** Value at base prices of each good the state's burgs and countryside made, by good id; -1 for the world's */
  getOutput(stateId: number): number[] {
    if (this.outputSource !== pack.deals) {
      this.outputSource = pack.deals;
      this.outputs.clear();
      const add = (id: number, goodId: number, units: number) => {
        const good = Goods.get(goodId);
        if (!good) return;
        for (const key of [id, -1]) {
          const output = this.outputs.get(key) ?? [];
          output[goodId] = (output[goodId] || 0) + units * good.value;
          this.outputs.set(key, output);
        }
      };
      for (const burg of pack.burgs)
        if (burg.i && !burg.removed)
          for (const [goodId, units] of burg.production ?? []) add(burg.state || 0, goodId, units);
      const biomes = Goods.getBiomesProduction();
      for (const cellId of pack.cells.i) {
        if (!pack.cells.market[cellId]) continue;
        const produced = Production.getCellProduction(cellId, biomes);
        for (const [goodId, units] of Object.entries(produced)) add(pack.cells.state[cellId], +goodId, units);
      }
    }
    return this.outputs.get(stateId) ?? [];
  }

  /** Of each need, the share its townspeople had met; rural people live off their fields */
  getNeedsMet(stateId: number): number[] {
    const needed = DEMAND_PRIORITY.map(() => 0);
    const met = DEMAND_PRIORITY.map(() => 0);
    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || burg.state !== stateId || !burg.population || !burg.market) continue;
      const covered = DEMAND_PRIORITY.map(() => 0);
      Prosperity.getConsumption(burg.i).forEach((units, goodId) => {
        const coverage = Goods.get(goodId)?.demandCoverage ?? {};
        DEMAND_PRIORITY.forEach((category, index) => {
          covered[index] += units * (coverage[category] || 0);
        });
      });
      DEMAND_PRIORITY.forEach((category, index) => {
        const target = burg.population! * DEMAND_TARGET_FACTORS[category];
        needed[index] += target;
        met[index] += Math.min(target, covered[index]);
      });
    }
    return needed.map((target, index) => (target ? met[index] / target : 1));
  }

  private index(): void {
    if (this.source === pack.deals) return;
    this.source = pack.deals;
    this.accounts.clear();
    if (!pack.deals?.length) return; // no economy run: nothing to sum
    const of = (stateId: number) => {
      let accounts = this.accounts.get(stateId);
      if (!accounts) {
        accounts = {
          people: 0,
          townspeople: 0,
          rural: 0,
          manufacturing: 0,
          trade: 0,
          product: 0,
          wealth: 0,
          prosperity: null,
          towns: null,
          country: null,
          levels: { towns: PROSPERITY_LEVELS.map(() => 0), country: PROSPERITY_LEVELS.map(() => 0) },
          burgWealth: []
        };
        this.accounts.set(stateId, accounts);
      }
      return accounts;
    };
    for (const state of pack.states) if (!state.removed) of(state.i); // a state with no people, the neutral lands too, has empty accounts
    // people-weighted sums of each group's living, averaged at the end
    const sums = new Map<string, GroupLiving>();
    const live = (stateId: number, group: "towns" | "country", people: number, living: Living | null) => {
      if (!living || !people) return;
      for (const id of [stateId, -1]) {
        const key = `${id}-${group}`;
        const row = sums.get(key) ?? { people: 0, needs: 0, comfort: 0, variety: 0, prosperity: 0 };
        row.people += people;
        row.needs += people * living.needs;
        row.comfort += people * living.comfort;
        row.variety += people * living.variety;
        row.prosperity += people * living.prosperity;
        sums.set(key, row);
        of(id).levels[group][PROSPERITY_LEVELS.indexOf(Prosperity.getLevel(living.prosperity))] += people;
      }
    };

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.population) continue;
      for (const accounts of [of(burg.state || 0), of(-1)]) {
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
      for (const accounts of [of(stateId), of(-1)]) {
        accounts.people += people;
        accounts.rural += rural?.earned || 0;
      }
      live(stateId, "country", people, rural?.living ?? null);
    }

    for (const deal of pack.deals) {
      const margin = Markets.getMargin(deal);
      if (!margin) continue;
      const center = pack.burgs[Markets.get(deal[1])?.centerBurgId ?? 0];
      for (const accounts of [of(center?.state || 0), of(-1)]) accounts.trade += margin;
    }
    // rural purchases make no deals, but their margin goes to the center too
    for (const market of pack.markets) {
      const margin = market.rural?.margin;
      if (!margin) continue;
      const center = pack.burgs[market.centerBurgId];
      for (const accounts of [of(center?.state || 0), of(-1)]) accounts.trade += margin;
    }

    const average = (row: GroupLiving | undefined): GroupLiving | null =>
      row?.people
        ? {
            people: row.people,
            needs: row.needs / row.people,
            comfort: row.comfort / row.people,
            variety: row.variety / row.people,
            prosperity: row.prosperity / row.people
          }
        : null;
    for (const [stateId, accounts] of this.accounts) {
      accounts.product = accounts.rural + accounts.manufacturing + accounts.trade;
      accounts.wealth = accounts.people ? accounts.product / accounts.people : 0;
      accounts.towns = average(sums.get(`${stateId}-towns`));
      accounts.country = average(sums.get(`${stateId}-country`));
      const lived = [accounts.towns, accounts.country].filter(group => group !== null);
      const people = lived.reduce((sum, group) => sum + group.people, 0);
      accounts.prosperity = people
        ? lived.reduce((sum, group) => sum + group.prosperity * group.people, 0) / people
        : null;
    }
  }
}

export const StateEconomy = new StateEconomyModule();
