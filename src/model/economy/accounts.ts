import { sum } from "d3";
import { EXPENSES } from "@/data/expenses";
import { Pack } from "@/model/graph/pack-generator";
import { Corruption } from "./corruption";
import { DEAL_KINDS, Deals } from "./deals";
import { Goods } from "./goods-generator";
import { Markets } from "./markets-generator";
import { Output } from "./output";
import { type Living, PROSPERITY_LEVELS, Prosperity } from "./prosperity";
import { Taxes } from "./taxes";

type Group = "urban" | "rural";

/** A group of people's living, averaged by their numbers */
export type GroupLiving = Living & { people: number };

/** What states and provinces both sum; product is rural + manufacturing + trade */
type PeopleAccounts = {
  people: number;
  urbanPeople: number;
  rural: number; // rural people's earnings from their produce
  manufacturing: number; // its burgs' product
  trade: number; // market margins its market centers took
  product: number;
  wealth: number; // product per person
  prosperity: number | null; // all people's, by their numbers
  living: Record<Group, GroupLiving | null>;
  levels: Record<Group, number[]>; // people at each prosperity level, by burgs and by cells
};

export type StateAccounts = PeopleAccounts & {
  taxes: number; // taxes and fees it collected, adjustments aside
  burgWealth: number[]; // each burg's product per person
};

type ProvinceTaxes = { salesTax: number; tariffs: number; pollTax: number; marketFees: number };

export type ProvinceAccounts = PeopleAccounts & {
  output: number[]; // value made at base prices, by good id
  taxes: ProvinceTaxes; // raised there for its state: by its people, and by foreigners at its markets
  spent: number; // state orders delivered to its burgs: its seat's, and the court's and the army's at the capital
  pocketed: number; // what officials took of the spending meant for it
};

type StateTrade = {
  exports: number;
  imports: number;
  partners: Map<number, { exports: number; imports: number }>;
  exported: number[]; // value by good id
  imported: number[];
  exportedUnits: number[]; // units by good id
  importedUnits: number[];
};

/** The economy summed from the last run: by state, by province and the world's */
class AccountsModule {
  private sources: Record<string, unknown[]> = {}; // what each cache below describes
  private states = new Map<number, StateAccounts>();
  private world: StateAccounts | null = null;
  private provinces = new Map<number, ProvinceAccounts>();
  private outputs = new Map<number, number[]>();
  private worldOutput: number[] = [];
  private consumption = new Map<number, number[]>();

  /** Also the neutral lands', as state 0; null before the economy has run */
  ofState(stateId: number): StateAccounts | null {
    this.indexStates();
    return this.states.get(stateId) ?? null;
  }

  /** null for no province and before the economy has run */
  ofProvince(provinceId: number): ProvinceAccounts | null {
    this.indexProvinces();
    return this.provinces.get(provinceId) ?? null;
  }

  /** The world's: all states, neutrals included */
  getWorld(): StateAccounts | null {
    this.indexStates();
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
      const [burgId, marketId, goodId, kind, units] = deal;
      if (kind === DEAL_KINDS.kept) continue;
      const burgState = pack.burgs[burgId]?.state || 0;
      const market = Markets.getState(Markets.get(marketId));
      if (burgState === market || (burgState !== stateId && market !== stateId)) continue;
      const isExport = kind === DEAL_KINDS.sale ? burgState === stateId : market === stateId;
      const partner = burgState === stateId ? market : burgState;
      const value = Deals.getGoodsValue(deal);
      const row = trade.partners.get(partner) ?? { exports: 0, imports: 0 };
      if (isExport) {
        trade.exports += value;
        row.exports += value;
        trade.exported[goodId] = (trade.exported[goodId] || 0) + value;
        trade.exportedUnits[goodId] = (trade.exportedUnits[goodId] || 0) + units;
      } else {
        trade.imports += value;
        row.imports += value;
        trade.imported[goodId] = (trade.imported[goodId] || 0) + value;
        trade.importedUnits[goodId] = (trade.importedUnits[goodId] || 0) + units;
      }
      trade.partners.set(partner, row);
    }
    return trade;
  }

  /** Last run's taxes and fees collected, poll tax owed, and what officials pocketed */
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
    const { salesTax, tariffs } = Taxes.getTaxesByState();
    const { owed, paid } = Taxes.getPollTax();
    return {
      salesTax: salesTax[stateId] || 0,
      tariffs: tariffs[stateId] || 0,
      pollTax: paid[stateId] || 0,
      pollTaxOwed: owed[stateId] || 0,
      marketFees: Taxes.getMarketFees()[stateId] || 0,
      markets: pack.markets.filter(market => Markets.getState(market) === stateId).length,
      adjustments: sum(pack.states[stateId]?.economy.adjustments ?? [], line => line.value),
      corruption: pack.states[stateId]?.economy.pocketed || 0
    };
  }

  /** Value at base prices of each good the state's burgs and countryside made, by good id */
  getOutput(stateId: number): number[] {
    this.indexOutputs();
    return this.outputs.get(stateId) ?? [];
  }

  getWorldOutput(): number[] {
    this.indexOutputs();
    return this.worldOutput;
  }

  /** Units per good its people and the state bought a day, kept output in, unsold produce out */
  getConsumption(stateId: number): number[] {
    this.indexConsumption();
    return this.consumption.get(stateId) ?? [];
  }

  /** True when the named cache no longer describes the last run and the map */
  private isStale(name: string, ...map: unknown[]): boolean {
    const sources = [pack.deals, Pack.revision, ...map];
    if (sources.every((source, k) => source === this.sources[name]?.[k])) return false;
    this.sources[name] = sources;
    return true;
  }

  private indexConsumption(): void {
    if (!this.isStale("consumption")) return;
    this.consumption.clear();
    const add = (stateId: number, goodId: number, units: number) => {
      const values = this.consumption.get(stateId) ?? [];
      this.consumption.set(stateId, values);
      values[goodId] = (values[goodId] || 0) + units;
    };
    for (const [burgId, , goodId, kind, units] of pack.deals)
      if (kind === DEAL_KINDS.demand || kind === DEAL_KINDS.kept || kind === DEAL_KINDS.order)
        add(pack.burgs[burgId]?.state || 0, goodId, units);
    for (const cellId of pack.cells.i)
      Prosperity.getRuralCell(cellId)?.bought.forEach((units, goodId) => {
        add(pack.cells.state[cellId], goodId, units);
      });
  }

  private indexOutputs(): void {
    if (!this.isStale("outputs")) return;
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
    Output.getRural().forEach((produced, cellId) => {
      if (!pack.cells.market[cellId]) return;
      for (const [goodId, units] of Object.entries(produced))
        add(pack.cells.state[Output.getWorkingCell(cellId)], +goodId, units);
    });
  }

  private indexStates(): void {
    if (!this.isStale("states")) return;
    this.states.clear();
    this.world = null;
    if (!pack.deals?.length) return; // no economy run: nothing to sum
    const world = emptyState();
    this.world = world;
    const accountsOf = (stateId: number) => {
      const accounts = this.states.get(stateId) ?? emptyState();
      this.states.set(stateId, accounts);
      return accounts;
    };
    const withWorld = (stateId: number) => [accountsOf(stateId), world];

    for (const state of pack.states) if (!state.removed) accountsOf(state.i); // a state with no people, the neutral lands too, has empty accounts
    const living = new LivingSums();
    const addLiving = (stateId: number, group: Group, people: number, row: Living | null) => {
      for (const accounts of withWorld(stateId)) living.add(accounts, group, people, row);
    };

    for (const burg of pack.burgs) {
      if (!burg.i || burg.removed || !burg.population) continue;
      for (const accounts of withWorld(burg.state || 0)) {
        accounts.people += burg.population;
        accounts.urbanPeople += burg.population;
        accounts.manufacturing += burg.product || 0;
        accounts.burgWealth.push((burg.product || 0) / burg.population);
      }
      addLiving(burg.state || 0, "urban", burg.population, Prosperity.getBurg(burg.i));
    }

    // each cell's rural people count in the state the cell is in, with its earnings and living
    for (const cellId of pack.cells.i) {
      const people = pack.cells.pop[cellId] || 0;
      if (!people) continue;
      const stateId = pack.cells.state[cellId];
      const rural = Prosperity.getRuralCell(cellId);
      for (const accounts of withWorld(stateId)) {
        accounts.people += people;
        accounts.rural += rural?.earned || 0;
      }
      addLiving(stateId, "rural", people, rural?.living ?? null);
    }

    for (const deal of pack.deals) {
      const margin = Deals.getMargin(deal);
      if (!margin) continue;
      const [, marketId] = deal;
      for (const accounts of withWorld(Markets.getState(Markets.get(marketId)))) accounts.trade += margin;
    }

    // rural purchases make no deals, but their margin goes to the center too
    for (const market of pack.markets) {
      const margin = market.rural?.margin;
      if (!margin) continue;
      for (const accounts of withWorld(Markets.getState(market))) accounts.trade += margin;
    }

    const { salesTax, tariffs } = Taxes.getTaxesByState();
    const taxes = [salesTax, tariffs, Taxes.getPollTax().paid, Taxes.getMarketFees()];

    for (const [stateId, accounts] of this.states) {
      accounts.taxes = sum(taxes, byState => byState[stateId] || 0);
      living.close(accounts);
    }
    world.taxes = sum(taxes.flat());
    living.close(world);
  }

  private indexProvinces(): void {
    if (!this.isStale("provinces", pack.provinces)) return;
    this.provinces.clear();
    if (!pack.deals?.length || !pack.provinces?.length) return;
    const { cells, burgs, provinces } = pack;
    for (const province of provinces)
      if (province?.i && !province.removed) this.provinces.set(province.i, emptyProvince());
    const of = (cellId: number | undefined) =>
      cellId === undefined ? undefined : this.provinces.get(cells.province[cellId]);
    const living = new LivingSums();

    for (const burg of burgs) {
      const accounts = burg.i && !burg.removed && burg.population ? of(burg.cell) : undefined;
      if (!accounts) continue;
      accounts.people += burg.population!;
      accounts.urbanPeople += burg.population!;
      accounts.manufacturing += burg.product || 0;
      accounts.taxes.pollTax += burg.pollTaxPaid || 0;
      living.add(accounts, "urban", burg.population!, Prosperity.getBurg(burg.i!));
    }

    const make = (accounts: ProvinceAccounts | undefined, goodId: number, units: number) => {
      const good = Goods.get(goodId);
      if (accounts && good) accounts.output[goodId] = (accounts.output[goodId] || 0) + units * good.value;
    };
    for (const burg of burgs)
      if (burg.i && !burg.removed)
        for (const [goodId, units] of burg.production ?? []) make(of(burg.cell), goodId, units);
    Output.getRural().forEach((produced, cellId) => {
      if (!cells.market[cellId]) return;
      for (const [goodId, units] of Object.entries(produced)) make(of(Output.getWorkingCell(cellId)), +goodId, units);
    });

    // rural people share what their market paid of their state's poll tax in the run, by head
    const heads = new Map<number, number[]>(); // by market: people by state
    for (const cellId of cells.i) {
      const marketId = cells.market[cellId];
      if (!marketId || !cells.pop[cellId]) continue;
      const byState = heads.get(marketId) ?? [];
      byState[cells.state[cellId]] = (byState[cells.state[cellId]] || 0) + cells.pop[cellId];
      heads.set(marketId, byState);
    }
    const paidPerHead = new Map<number, Map<number, number>>(); // by market: state -> paid a head
    for (const market of pack.markets) {
      const byState = heads.get(market.i) ?? [];
      const paid = (market.rural?.pollTax ?? []).map(([stateId, , pays]): [number, number] => [
        stateId,
        pays / (byState[stateId] || 1)
      ]);
      paidPerHead.set(market.i, new Map(paid));
    }
    for (const cellId of cells.i) {
      const people = cells.pop[cellId] || 0;
      const accounts = people ? of(cellId) : undefined;
      if (!accounts) continue;
      const rural = Prosperity.getRuralCell(cellId);
      accounts.people += people;
      accounts.rural += rural?.earned || 0;
      const stateId = cells.state[cellId];
      accounts.taxes.pollTax += people * (paidPerHead.get(cells.market[cellId])?.get(stateId) || 0);
      living.add(accounts, "rural", people, rural?.living ?? null);
    }

    // a tax counts where its state's own taxpayer is, or at the market where a foreigner paid it
    const center = (marketId: number) => pack.burgs[Markets.get(marketId)?.centerBurgId ?? 0];
    for (const deal of pack.deals) {
      const [burgId, marketId, , kind, units, price, tax, tariff] = deal;
      const burg = burgs[burgId];
      if (kind === DEAL_KINDS.order) {
        const accounts = of(burg?.cell);
        if (accounts) accounts.spent += units * price; // its taxes and margin count below like any deal's
      }
      const margin = Deals.getMargin(deal);
      if (margin) {
        const accounts = of(center(marketId)?.cell);
        if (accounts) accounts.trade += margin;
      }
      if (!tax && !tariff) continue;
      const { taxState, tariffState } = Taxes.getTaxStates(deal);
      const raisedFor = (stateId: number, atMarket?: number) =>
        of(burg?.state === stateId ? burg.cell : atMarket === undefined ? undefined : center(atMarket)?.cell);
      const taxed = tax ? raisedFor(taxState, marketId) : undefined;
      if (taxed) taxed.taxes.salesTax += tax;
      const importer = kind === DEAL_KINDS.sale ? marketId : burg && Markets.ofBurg(burg)?.i;
      const tariffed = tariff ? raisedFor(tariffState, importer) : undefined;
      if (tariffed) tariffed.taxes.tariffs += tariff;
    }
    for (const market of pack.markets) {
      const accounts = of(center(market.i)?.cell);
      if (!accounts) continue;
      accounts.trade += market.rural?.margin || 0;
      accounts.taxes.marketFees += market.feePaid || 0;
    }

    this.addPocketed();
    for (const accounts of this.provinces.values()) living.close(accounts);
  }

  /** What officials pocketed of the spending meant for each province */
  private addPocketed(): void {
    for (const state of pack.states) {
      if (!state.i || state.removed || state.economy.collected <= 0) continue;
      const { budget, collected } = state.economy;
      const capital = Corruption.ofCapital(state);
      const inProvinces = budget.administration + budget.infrastructure;
      const inCapital = EXPENSES.reduce((total, expense) => total + budget[expense], 0) - inProvinces;
      for (const province of Corruption.getProvinces(state.i)) {
        const accounts = this.provinces.get(province.id);
        if (!accounts) continue;
        const corruption = Corruption.ofProvince(state, province, collected);
        const share = inProvinces * province.share + (province === capital ? inCapital : 0);
        accounts.pocketed += (collected * share * corruption) / 10000;
      }
    }
  }
}

export const Accounts = new AccountsModule();

function emptyPeople(): PeopleAccounts {
  return {
    people: 0,
    urbanPeople: 0,
    rural: 0,
    manufacturing: 0,
    trade: 0,
    product: 0,
    wealth: 0,
    prosperity: null,
    living: { urban: null, rural: null },
    levels: { urban: PROSPERITY_LEVELS.map(() => 0), rural: PROSPERITY_LEVELS.map(() => 0) }
  };
}

function emptyState(): StateAccounts {
  return { ...emptyPeople(), taxes: 0, burgWealth: [] };
}

function emptyProvince(): ProvinceAccounts {
  return {
    ...emptyPeople(),
    output: [],
    taxes: { salesTax: 0, tariffs: 0, pollTax: 0, marketFees: 0 },
    spent: 0,
    pocketed: 0
  };
}

function average(row: GroupLiving | undefined): GroupLiving | null {
  return row?.people
    ? {
        people: row.people,
        needs: row.needs / row.people,
        comfort: row.comfort / row.people,
        variety: row.variety / row.people,
        infrastructure: row.infrastructure / row.people,
        prosperity: row.prosperity / row.people
      }
    : null;
}

const LIVING_FIELDS = ["needs", "comfort", "variety", "infrastructure", "prosperity"] as const;

/** People-weighted sums of each group's living, averaged when the accounts close */
class LivingSums {
  private sums = new Map<PeopleAccounts, Partial<Record<Group, GroupLiving>>>();

  add(accounts: PeopleAccounts, group: Group, people: number, living: Living | null): void {
    if (!living || !people) return;
    const groups = this.sums.get(accounts) ?? {};
    this.sums.set(accounts, groups);
    const row = groups[group] ?? { people: 0, needs: 0, comfort: 0, variety: 0, infrastructure: 0, prosperity: 0 };
    groups[group] = row;
    row.people += people;
    for (const field of LIVING_FIELDS) row[field] += people * living[field];
    accounts.levels[group][PROSPERITY_LEVELS.indexOf(Prosperity.getLevel(living.prosperity))] += people;
  }

  close(accounts: PeopleAccounts): void {
    accounts.product = accounts.rural + accounts.manufacturing + accounts.trade;
    accounts.wealth = accounts.people ? accounts.product / accounts.people : 0;
    const groups = this.sums.get(accounts);
    accounts.living = { urban: average(groups?.urban), rural: average(groups?.rural) };
    const lived = [accounts.living.urban, accounts.living.rural].filter(group => group !== null);
    const people = lived.reduce((total, group) => total + group.people, 0);
    accounts.prosperity = people
      ? lived.reduce((total, group) => total + group.prosperity * group.people, 0) / people
      : null;
  }
}
