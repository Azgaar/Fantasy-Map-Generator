// A province's economy from the last run: what its people make and how well they live, the taxes raised there, the
// state spending delivered there and what officials pocketed of its share. Worked out on demand, nothing saved

import { type District, Districts } from "@/model/political/districts";
import { EXPENSES, States } from "@/model/political/states-generator";
import { Goods } from "./goods-generator";
import { Markets } from "./markets-generator";
import { Production } from "./production-generator";
import { PROSPERITY_LEVELS, Prosperity } from "./prosperity";
import type { GroupLiving } from "./state-economy";
import { DEAL_KINDS, Trade } from "./trade";

type Group = "towns" | "country";

export type ProvinceTaxes = { salesTax: number; tariffs: number; pollTax: number; marketFees: number };

/** The sum of a province's figures; product is rural + manufacturing + trade */
export type ProvinceAccounts = {
  people: number;
  townspeople: number;
  rural: number;
  manufacturing: number;
  trade: number;
  product: number;
  wealth: number;
  prosperity: number | null;
  towns: GroupLiving | null;
  country: GroupLiving | null;
  levels: Record<Group, number[]>; // people at each prosperity level, by burgs and by cells
  output: number[]; // value made at base prices, by good id
  taxes: ProvinceTaxes; // raised there for its state: by its people, and by foreigners at its markets
  spent: number; // state orders delivered to its burgs: its seat's, and the court's and the army's at the capital
  pocketed: number; // what officials took of the spending meant for it
};

const emptyAccounts = (): ProvinceAccounts => ({
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
  output: [],
  taxes: { salesTax: 0, tariffs: 0, pollTax: 0, marketFees: 0 },
  spent: 0,
  pocketed: 0
});

class ProvinceEconomyModule {
  private sources: unknown[] = []; // the deals and provinces the cache describes
  private accounts = new Map<number, ProvinceAccounts>();

  /** null for no province and before the economy has run */
  get(provinceId: number): ProvinceAccounts | null {
    this.index();
    return this.accounts.get(provinceId) ?? null;
  }

  private index(): void {
    const sources = [pack.deals, pack.provinces];
    if (sources.every((source, k) => source === this.sources[k])) return;
    this.sources = sources;
    this.accounts.clear();
    if (!pack.deals?.length || !pack.provinces?.length) return;
    const { cells, burgs, provinces } = pack;
    for (const province of provinces)
      if (province?.i && !province.removed) this.accounts.set(province.i, emptyAccounts());
    const of = (cellId: number | undefined) =>
      cellId === undefined ? undefined : this.accounts.get(cells.province[cellId]);
    const sums = new Map<ProvinceAccounts, Partial<Record<Group, GroupLiving>>>();
    const live = (accounts: ProvinceAccounts, group: Group, people: number, living: GroupLiving | null) => {
      if (!living || !people) return;
      const groups = sums.get(accounts) ?? {};
      sums.set(accounts, groups);
      const row = groups[group] ?? { people: 0, needs: 0, comfort: 0, variety: 0, infrastructure: 0, prosperity: 0 };
      groups[group] = row;
      row.people += people;
      accounts.levels[group][PROSPERITY_LEVELS.indexOf(Prosperity.getLevel(living.prosperity))] += people;
      for (const key of ["needs", "comfort", "variety", "infrastructure", "prosperity"] as const)
        row[key] += people * living[key];
    };

    for (const burg of burgs) {
      const accounts = burg.i && !burg.removed && burg.population ? of(burg.cell) : undefined;
      if (!accounts) continue;
      accounts.people += burg.population!;
      accounts.townspeople += burg.population!;
      accounts.manufacturing += burg.product || 0;
      accounts.taxes.pollTax += burg.pollTaxPaid || 0;
      const living = Prosperity.getBurg(burg.i!);
      live(accounts, "towns", burg.population!, living && { ...living, people: burg.population! });
    }

    const make = (accounts: ProvinceAccounts | undefined, goodId: number, units: number) => {
      const good = Goods.get(goodId);
      if (accounts && good) accounts.output[goodId] = (accounts.output[goodId] || 0) + units * good.value;
    };
    for (const burg of burgs)
      if (burg.i && !burg.removed)
        for (const [goodId, units] of burg.production ?? []) make(of(burg.cell), goodId, units);
    Production.getRuralOutput().forEach((produced, cellId) => {
      if (!cells.market[cellId]) return;
      for (const [goodId, units] of Object.entries(produced)) make(of(cellId), +goodId, units);
    });

    // rural people pay what their market's share allowed of the poll tax each cell owed
    const paidShare = new Map<number, Map<number, number>>(); // by market: state -> share paid
    for (const market of pack.markets)
      paidShare.set(
        market.i,
        new Map((market.rural?.pollTax ?? []).map(([stateId, owed, paid]) => [stateId, owed ? paid / owed : 0]))
      );
    for (const cellId of cells.i) {
      const people = cells.pop[cellId] || 0;
      const accounts = people ? of(cellId) : undefined;
      if (!accounts) continue;
      const rural = Prosperity.getRuralCell(cellId);
      accounts.people += people;
      accounts.rural += rural?.earned || 0;
      const stateId = cells.state[cellId];
      accounts.taxes.pollTax +=
        States.getPollTaxDue(stateId, people) * (paidShare.get(cells.market[cellId])?.get(stateId) || 0);
      live(accounts, "country", people, rural && { ...rural.living, people });
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
      const margin = Trade.getMargin(deal);
      if (margin) {
        const accounts = of(center(marketId)?.cell);
        if (accounts) accounts.trade += margin;
      }
      if (!tax && !tariff) continue;
      const { taxState, tariffState } = Trade.getTaxStates(deal);
      // sales tax is collected at the deal's market, a tariff at the importing one: the deal's on a sale, the burg's own on a purchase
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

    this.addPocketed(of);
    for (const accounts of this.accounts.values()) {
      accounts.product = accounts.rural + accounts.manufacturing + accounts.trade;
      accounts.wealth = accounts.people ? accounts.product / accounts.people : 0;
      const groups = sums.get(accounts);
      accounts.towns = average(groups?.towns);
      accounts.country = average(groups?.country);
      const lived = [accounts.towns, accounts.country].filter(group => group !== null);
      const people = lived.reduce((sum, group) => sum + group.people, 0);
      accounts.prosperity = people
        ? lived.reduce((sum, group) => sum + group.prosperity * group.people, 0) / people
        : null;
    }
  }

  /** Each district's share of what officials pocketed, as collection counts it, split over its provinces by their people */
  private addPocketed(of: (cellId: number | undefined) => ProvinceAccounts | undefined): void {
    const pocketed = new Map<District, number>();
    for (const state of pack.states) {
      if (!state.i || state.removed || state.economy.collected <= 0) continue;
      const { budget, collected } = state.economy;
      const capital = Districts.getCapital(state);
      const atSeats = budget.administration + budget.infrastructure;
      const atCapital = EXPENSES.reduce((sum, expense) => sum + budget[expense], 0) - atSeats;
      for (const district of Districts.get(state.i)) {
        const corruption = Districts.getCorruption(state, district, collected);
        const share = atSeats * district.share + (district === capital ? atCapital : 0);
        pocketed.set(district, (collected * share * corruption) / 10000);
      }
    }
    for (const cellId of pack.cells.i) {
      const district = Districts.at(cellId);
      const accounts = district?.people ? of(cellId) : undefined;
      if (!district || !accounts) continue;
      const burgId = pack.cells.burg[cellId];
      const people = (pack.cells.pop[cellId] || 0) + (burgId ? pack.burgs[burgId]?.population || 0 : 0);
      accounts.pocketed += ((pocketed.get(district) || 0) * people) / district.people;
    }
  }
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

export const ProvinceEconomy = new ProvinceEconomyModule();
