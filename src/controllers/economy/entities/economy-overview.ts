import { Controllers } from "@/controllers";
import { EXPENSES } from "@/data/expenses";
import { EXPENSE_LABELS } from "@/data/id-labels";
import { Accounts, type GroupLiving, type ProvinceAccounts, type StateAccounts } from "@/model/economy/accounts";
import { Corruption } from "@/model/economy/corruption";
import { Goods } from "@/model/economy/goods-generator";
import { PROSPERITY_LEVELS } from "@/model/economy/prosperity";
import { StateOrders } from "@/model/economy/state-orders";
import { Stability } from "@/model/political/stability";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Dialog } from "@/ui/dialog/dialog";
import {
  bindEconomyWiki,
  budgetBackground,
  ECONOMY_COLORS,
  EconomyTerms,
  economyWikiButton,
  prosperityColor,
  prosperityLevel,
  renderProsperity,
  renderProsperityParts,
  renderProsperityPercent,
  tone
} from "@/ui/economy-view";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";
import { type GoodsKind, StateEconomyTables } from "./state-economy-tables";

const DIALOG_CLASS = "economyOverviewDialog";
const TOP_ROWS = 6;

const SECTORS = ["rural", "manufacturing", "trade"] as const;
type Sector = (typeof SECTORS)[number];
const SECTOR_COLORS: Record<Sector, string> = { rural: "#6a9a3a", manufacturing: "#d98a32", trade: "#4a7ac0" };

type Kind = "state" | "province";
type Sectors = Record<Sector | "product", number>;
type Living = Pick<StateAccounts, "living" | "levels">;
type Population = Pick<StateAccounts, "people" | "urbanPeople">;
type ProvinceFigures = { corruption: number; infrastructure: number; stability: number | null };

const dialogId = (kind: Kind, id: number) => `${kind}Economy${id}`;

/** Opens one dialog per state or province, so they can be compared side by side */
function open(kind: Kind, id: number): void {
  const title = getTitle(kind, id);
  if (!title) return;
  if (!(kind === "state" ? Accounts.ofState(id) : Accounts.ofProvince(id))) {
    tip(EconomyTerms.noData(), true, "error", 5000);
    return;
  }

  const dialog = dialogId(kind, id);
  Dialog.destroy(dialog);
  ensureEl("dialogs").insertAdjacentHTML("beforeend", renderDialog(dialog));
  ensureEl(dialog).addEventListener("click", event => onClick(kind, id, event.target as HTMLElement));
  bindEconomyWiki(`${dialog}Wiki`);
  refresh(kind, id);

  const offset = 10 + 660 * (document.querySelectorAll(`.${DIALOG_CLASS}`).length - 1); // each next one to the left
  Dialog.open(dialog, {
    title,
    width: "min(46em, calc(100vw - 20px))",
    maxHeight: window.innerHeight - 20,
    resizable: true,
    onClose: () => Dialog.destroy(dialog),
    position: { my: "right top", at: `right-${offset} top+10`, of: "svg" }
  });
}

/** Null when there is nothing to show; state 0 is the neutral lands, often empty */
function getTitle(kind: Kind, id: number): string | null {
  if (kind === "province") {
    const province = pack.provinces[id];
    if (!province || province.removed) return null;
    return t("Economy of {{- province}}", { province: province.fullName || province.name });
  }
  const state = pack.states[id];
  if (!state || state.removed || (!state.cells && !state.burgs)) return null;
  return id ? t("Economy of {{- state}}", { state: state.fullName || state.name }) : t("Economy of the neutral lands");
}

const renderDialog = (id: string) => /* html */ `<div id="${id}" class="dialog stable ${DIALOG_CLASS}">
  ${economyStyle(DIALOG_CLASS)}
  <div id="${id}Body"></div>
  <div style="margin-top: 3px">
    <button id="${id}Refresh" type="button" data-tip="${t("Refresh")}" class="icon-cw"></button>
    ${economyWikiButton(`${id}Wiki`)}
  </div>
</div>`;

function onClick(kind: Kind, id: number, target: HTMLElement): void {
  const goodsTable = target.closest<HTMLElement>(".goodsTable");
  if (target.closest(`#${dialogId(kind, id)}Refresh`)) refresh(kind, id);
  else if (goodsTable) StateEconomyTables.openGoods(id, goodsTable.dataset.kind as GoodsKind);
  else if (target.closest(".partnersTable")) StateEconomyTables.openPartners(id);
  else if (target.closest(".prosperityTable")) StateEconomyTables.openProsperity(id);
  else if (target.closest(".taxes")) void Controllers.StateBudgetEditor.open(id, () => refresh(kind, id));
}

function refresh(kind: Kind, id: number): void {
  const body = findEl(`${dialogId(kind, id)}Body`); // closed while the budget stayed open
  if (body) body.innerHTML = kind === "state" ? renderState(id) : renderProvince(id);
}

/** The dialogs' style, shared with the burg economy */
export const economyStyle = (dialog: string) => /* html */ `<style>
  .${dialog} > div { width: auto }
  .${dialog} .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(9.5em, 1fr)); gap: 0.4em; margin-bottom: 0.8em }
  .${dialog} .card { border: 1px solid #ccc; border-top: 3px solid var(--header); padding: 0.3em 0.5em; line-height: 1.3 }
  .${dialog} .card .label { font-size: 0.8em; text-transform: uppercase; color: #666 }
  .${dialog} .card .value { font-size: 1.25em; font-weight: bold; white-space: nowrap }
  .${dialog} .card .note { font-size: 0.8em; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  .${dialog} h4 { margin: 0.8em 0 0.3em; border-bottom: 1px solid var(--dark-solid) }
  .${dialog} .columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20em), 1fr)); column-gap: 1.2em }
  .${dialog} .stack { display: flex; height: 1em }
  .${dialog} .stack.small { display: flex; height: 0.85em; opacity: 0.8 }
  .${dialog} .legend { display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: 0.8em }
  .${dialog} .legend span { font-size: 0.9em; white-space: nowrap }
  .${dialog} .swatch { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.25em; vertical-align: middle }
  .${dialog} .row { display: grid; grid-template-columns: minmax(0, 8em) minmax(1em, 1fr) minmax(5em, max-content); align-items: center; column-gap: 0.4em; line-height: 1.5 }
  .${dialog} .row.plain { grid-template-columns: minmax(0, 1fr) minmax(6em, max-content) }
  .${dialog} .row.budget { grid-template-columns: minmax(0, 2fr) 2.5em minmax(1em, 1fr) minmax(5em, max-content) }
  .${dialog} .row .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 0.2em }
  .${dialog} .row.plain .name, .${dialog} .row.budget .name { white-space: normal }
  .${dialog} .bar { height: 0.7em; background: #eee }
  .${dialog} .bar > div { height: 100% }
  .${dialog} .bar.stack { display: flex }
  .${dialog} .right { text-align: right; white-space: nowrap }
  .${dialog} .total { font-weight: bold; border-top: 1px solid #ccc }
  .${dialog} .muted { font-size: 0.85em; color: #666 }
  .${dialog} h4 { display: flex; justify-content: space-between; align-items: center }
  .${dialog} h4 button[class^="icon-"] { padding: 0 3px; font-size: 0.75em; line-height: 1; margin: 2px 0; }
  .${dialog} .group { line-height: 1.6 }
</style>`;

function renderState(stateId: number): string {
  const accounts = Accounts.ofState(stateId);
  const world = Accounts.getWorld();
  if (!accounts || !world) return "";
  const trade = Accounts.getTrade(stateId);
  const prosperityButton = `<button type="button" class="icon-list-bullet prosperityTable" data-tip="${t("Show prosperity statistics")}"></button>`;
  return [
    renderStateCards(stateId, accounts, world, trade.exports, trade.imports),
    renderSectors(accounts, world, t("World")),
    renderLiving(accounts, prosperityButton),
    stateId ? `<div class="columns">${renderRevenue(stateId, accounts)}${renderExpenses(stateId)}</div>` : "",
    `<div class="columns">${renderGoods(t("Main exports"), trade.exported, tableButton("exports"))}${renderGoods(t("Main imports"), trade.imported, tableButton("imports"))}</div>`,
    `<div class="columns">${renderGoods(t("Most valuable goods made"), Accounts.getOutput(stateId), tableButton("made"))}${renderPartners(trade.partners)}</div>`
  ].join("");
}

function renderStateCards(
  stateId: number,
  accounts: StateAccounts,
  world: StateAccounts,
  exports: number,
  imports: number
): string {
  const treasury = pack.states[stateId].economy.treasury || 0;
  const burden = accounts.product ? rn((accounts.taxes / accounts.product) * 100, 1) : 0;
  const balance = exports - imports;
  const population = people(accounts);
  const share = world.product ? rn((accounts.product / world.product) * 100, 1) : 0;
  const accountsOf = (id: number) => Accounts.ofState(id);

  const treasuryCard = stateId
    ? card(
        t("Day Balance"),
        `<span class="${tone(treasury)}">${formatPrice(treasury)}</span>`,
        [stateRank(stateId, id => pack.states[id].economy.treasury || 0), t("Tax burden: {{burden}}%", { burden })],
        sentences(EconomyTerms.stateTreasury(), t("Tax burden: the taxes' share of the product"))
      )
    : card(t("Day Balance"), "—", [t("Neutrals collect no taxes")], EconomyTerms.stateTreasury());
  const populationRank = stateRank(stateId, id => {
    const other = accountsOf(id);
    return other ? people(other).total : 0;
  });
  const rural = si(population.rural);
  const urban = si(population.urban);

  return `<div class="cards">
    ${card(t("Economy"), economyType(accounts, world), economyNotes(stateId, accounts, world), t("Economy type: the sector the state leans on"))}
    ${card(t("Population"), si(population.total), [populationRank, t("Rural: {{rural}}, urban: {{urban}}", { rural, urban })], t("Population: rural and urban people"))}
    ${card(t("Inequality"), String(rn(gini(accounts.burgWealth), 2)), [stateRank(stateId, id => gini(accountsOf(id)?.burgWealth ?? []), true), `${t("World")}: ${rn(gini(world.burgWealth), 2)}`], t("Inequality: Gini of burg wealth, 0 is equal"))}
    ${card(t("Trade balance"), `<span class="${tone(balance)}">${formatPrice(balance)}</span>`, [`${t("Exports")}: ${formatPrice(exports)}`, `${t("Imports")}: ${formatPrice(imports)}`], t("Trade balance: exports less imports, at market prices"))}
    ${treasuryCard}
    ${card(t("Prosperity"), prosperityPercent(accounts.prosperity), [stateRank(stateId, id => accountsOf(id)?.prosperity ?? 0), `${t("World")}: ${prosperityText(world.prosperity)}`], EconomyTerms.prosperity())}
    ${card(t("Product"), formatPrice(accounts.product), [stateRank(stateId, id => accountsOf(id)?.product ?? 0), t("{{share}}% of the world", { share })], EconomyTerms.stateProduct())}
    ${card(t("Wealth"), formatPrice(accounts.wealth), [stateRank(stateId, id => accountsOf(id)?.wealth ?? 0), `${t("World")}: ${formatPrice(world.wealth)}`], EconomyTerms.wealth())}
  </div>`;
}

/** What the state collected today, by tax */
function renderRevenue(stateId: number, accounts: StateAccounts): string {
  const { salesTax, tariffs, pollTax, pollTaxOwed, marketFees } = Accounts.getBudget(stateId);
  const { economy } = pack.states[stateId];
  const share = accounts.product ? rn((accounts.taxes / accounts.product) * 100, 1) : 0;
  return `<div><h4 data-tip="${t("What the state collected today")}"><span>${t("Revenue")}</span>${budgetButton()}</h4>
    ${line(t("Sales tax: {{rate}}%", { rate: rn((economy.salesTax || 0) * 100, 1) }), salesTax, "", "positive")}
    ${line(t("Import tariffs"), tariffs, "", "positive")}
    ${line(t("Poll tax: {{rate}} a head", { rate: economy.pollTax || 0 }), pollTax, pollTax ? EconomyTerms.collected(pollTax, pollTaxOwed) : "", "positive")}
    ${line(t("Market licenses: {{fee}} each", { fee: economy.marketFee || 0 }), marketFees, "", "positive")}
    ${economy.adjustments.map(({ name, value }) => line(escapeHtml(name) || t("Adjustments"), value, EconomyTerms.adjustments(), tone(value))).join("")}
    <div class="total">${line(t("Collected"), economy.collected, t("Total collected taxes and fees"), tone(economy.collected))}</div>
    <div class="muted">${t("{{share}}% of the product", { share })}</div>
  </div>`;
}

/** Each expense's share with officials' part grayed, then the treasury's */
function renderExpenses(stateId: number): string {
  const { economy } = pack.states[stateId];
  const { budget } = economy;
  const balance = 100 - EXPENSES.reduce((total, expense) => total + budget[expense], 0); // below 0 when the state spends beyond its taxes
  const row = (name: string, share: number, bar: string, value: number, tip: string, tone: string) =>
    `<div data-tip="${tip}" class="row budget"><span class="name">${name}</span><span class="right">${share}%</span>${bar}<span class="right ${tone}">${formatPrice(value)}</span></div>`;
  const corruption = Corruption.ofState(pack.states[stateId], economy.collected);
  return `<div><h4 data-tip="${EconomyTerms.budget()}"><span>${t("Expenses")}</span>${budgetButton()}</h4>
    ${EXPENSES.map(expense => row(EXPENSE_LABELS[expense], budget[expense], `<div class="bar" style="background: ${budgetBackground(budget[expense], corruption)}"></div>`, -economy.spent[expense], EconomyTerms.expenseTip(expense), "negative")).join("")}
    <div class="total">${row(t("Day Balance"), balance, "<span></span>", economy.treasury, EconomyTerms.stateTreasury(), tone(economy.treasury))}</div>
    ${pocketedLine(corruption, economy.pocketed, EconomyTerms.corruption())}
  </div>`;
}

function renderPartners(partners: Map<number, { exports: number; imports: number }>): string {
  const rows = [...partners]
    .map(([stateId, row]) => ({ stateId, ...row, volume: row.exports + row.imports }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, TOP_ROWS);
  const most = Math.max(1, ...rows.map(row => row.volume));
  const html = rows
    .map(({ stateId, exports, imports }) => {
      const partner = pack.states[stateId];
      const balance = exports - imports;
      const name = `<span class="swatch" style="background: ${partner?.color || "#ccc"}"></span>${escapeHtml(partner?.name || t("Neutrals"))}`;
      const part = (value: number, color: string) =>
        `<div style="width: ${(value / most) * 100}%; background: ${color}"></div>`;
      const bar = `<div class="bar stack">${part(exports, ECONOMY_COLORS.positive)}${part(imports, ECONOMY_COLORS.negative)}</div>`;
      const tip = `${t("Exports")}: ${formatPrice(exports)}. ${t("Imports")}: ${formatPrice(imports)}`;
      return `<div data-tip="${tip}" class="row"><span class="name">${name}</span>${bar}<span class="right ${tone(balance)}">${formatPrice(balance)}</span></div>`;
    })
    .join("");
  const tipText = t("Exports to and imports from each partner state, at market prices, and the balance");
  const button = rows.length
    ? `<button type="button" class="icon-list-bullet partnersTable" data-tip="${EconomyTerms.table()}"></button>`
    : "";
  return `<div><h4 data-tip="${tipText}"><span>${t("Foreign trade")}</span>${button}</h4>${html ? html : `<i>${t("None")}</i>`}</div>`;
}

function renderProvince(provinceId: number): string {
  const accounts = Accounts.ofProvince(provinceId);
  const province = pack.provinces[provinceId];
  if (!province) return "";
  const state = Accounts.ofState(province.state);
  if (!accounts || !state) return "";
  return [
    renderProvinceCards(provinceId, accounts, state),
    renderSectors(accounts, state, t("State")),
    renderLiving(accounts),
    `<div class="columns">${renderProvinceTaxes(provinceId, accounts)}${renderGoods(t("Most valuable goods made"), accounts.output)}</div>`
  ].join("");
}

/** Its figures, each ranked among its state's provinces and set against the state's */
function renderProvinceCards(provinceId: number, accounts: ProvinceAccounts, stateAccounts: StateAccounts): string {
  const stateId = pack.provinces[provinceId].state;
  const state = pack.states[stateId];
  const ids = pack.provinces
    .filter(p => p.i && !p.removed && p.state === stateId && Accounts.ofProvince(p.i))
    .map(p => p.i);
  const of = (id: number) => Accounts.ofProvince(id)!;
  const ranked = (measure: (accounts: ProvinceAccounts) => number) => rank(ids, provinceId, id => measure(of(id)));

  const population = people(accounts);
  const productShare = stateAccounts.product ? rn((accounts.product / stateAccounts.product) * 100, 1) : 0;
  const taxes = taxesOf(accounts);
  const burden = accounts.product ? rn((taxes / accounts.product) * 100, 1) : 0;

  const figures = getProvinceFigures(stateId);
  const own = figures.get(provinceId);
  const governed = (
    label: string,
    measure: (figures: ProvinceFigures) => number | null,
    format: (value: number) => string,
    stateValue: string,
    tipText: string,
    lowestFirst = false
  ) => {
    const value = own ? measure(own) : null;
    if (!own || value === null) return card(label, "—", [EconomyTerms.noData()], tipText);
    const others = ids.filter(id => figures.has(id));
    const place = rank(others, provinceId, id => measure(figures.get(id)!) ?? 0, lowestFirst);
    return card(label, format(value), [place, `${t("State")}: ${stateValue}`], tipText);
  };
  const percent = (value: number) => `${rn(value * 100)}%`;
  const stateStability = Stability.get(stateId)?.stability;
  const rural = si(population.rural);
  const urban = si(population.urban);

  return `<div class="cards">
    ${card(t("Population"), si(population.total), [ranked(a => people(a).total), t("Rural: {{rural}}, urban: {{urban}}", { rural, urban })], t("Population: rural and urban people"))}
    ${card(t("Product"), formatPrice(accounts.product), [ranked(a => a.product), t("{{share}}% of the state", { share: productShare })], EconomyTerms.stateProduct())}
    ${card(t("Wealth"), formatPrice(accounts.wealth), [ranked(a => a.wealth), `${t("State")}: ${formatPrice(stateAccounts.wealth)}`], EconomyTerms.wealth())}
    ${card(t("Prosperity"), prosperityPercent(accounts.prosperity), [ranked(a => a.prosperity ?? 0), `${t("State")}: ${prosperityText(stateAccounts.prosperity)}`], EconomyTerms.prosperity())}
    ${card(t("Taxes collected"), formatPrice(taxes), [ranked(taxesOf), t("Tax burden: {{burden}}%", { burden })], t("Taxes paid to the state"))}
    ${governed(
      t("Corruption"),
      g => g.corruption,
      value => `${rn(value)}%`,
      `${rn(Corruption.ofState(state, state.economy.collected))}%`,
      EconomyTerms.corruption(),
      true
    )}
    ${governed(t("Infrastructure"), g => g.infrastructure, percent, percent(StateOrders.getProvision(state, "infrastructure")), t("Infrastructure: how well the state's public works serve the people"))}
    ${governed(t("Stability"), g => g.stability, percent, stateStability === undefined ? "—" : percent(stateStability), EconomyTerms.stability())}
  </div>`;
}

/** Taxes paid by its people and by foreigners at its markets, and the state orders its burgs got */
function renderProvinceTaxes(provinceId: number, accounts: ProvinceAccounts): string {
  const { taxes, spent, pocketed } = accounts;
  const total = taxesOf(accounts);
  const stability = Stability.getProvince(provinceId);
  const state = pack.states[pack.provinces[provinceId].state];
  const corruption = stability ? Corruption.ofProvince(state, stability.province, state.economy.collected) : 0;
  return `<div><h4 data-tip="${t("Taxes paid to the state and its spending in the province")}"><span>${t("Taxes and state spending")}</span></h4>
    ${line(t("Sales tax"), -taxes.salesTax, "", "negative")}
    ${line(t("Import tariffs"), -taxes.tariffs, "", "negative")}
    ${line(t("Poll tax"), -taxes.pollTax, "", "negative")}
    ${line(t("Market licenses"), -taxes.marketFees, "", "negative")}
    <div class="total">${line(t("Taxes collected"), -total, t("Taxes paid to the state"), "negative")}</div>
    <div class="total">${line(t("State orders"), spent, t("Goods the state bought at the province's burgs"), "positive")}</div>
    ${pocketedLine(corruption, pocketed, t("State spending pocketed by officials"))}
  </div>`;
}

/** Each province of the state by id */
function getProvinceFigures(stateId: number): Map<number, ProvinceFigures> {
  const state = pack.states[stateId];
  const figures = new Map<number, ProvinceFigures>();
  if (!stateId || !state || state.removed) return figures;
  const infrastructure = StateOrders.getInfrastructure(state);
  for (const { province, stability } of Stability.getProvinces(stateId)) {
    if (!province.id) continue;
    figures.set(province.id, {
      corruption: Corruption.ofProvince(state, province, state.economy.collected),
      infrastructure: infrastructure.get(province.id) ?? 0,
      stability
    });
  }
  return figures;
}

function card(label: string, value: string, notes: string[], tipText: string): string {
  const lines = notes.map(note => `<div class="note">${note}</div>`).join("");
  return `<div class="card" data-tip="${tipText}"><div class="label">${label}</div><div class="value">${value}</div>${lines}</div>`;
}

const line = (name: string, value: number, tip = "", tone = "") =>
  `<div data-tip="${tip}" class="row plain"><span class="name">${name}</span><span class="right ${tone}">${formatPrice(value)}</span></div>`;

const pocketedLine = (corruption: number, pocketed: number, tip: string) =>
  `<div data-tip="${tip}" class="row plain muted"><span class="name"><span class="swatch" style="background: ${ECONOMY_COLORS.pocketed}"></span>${t("Corruption: {{rate}}%", { rate: rn(corruption) })}</span><span class="right negative">${formatPrice(-pocketed)}</span></div>`;

/** "Rank: 2 of 20" among the ids, the highest value first unless the lowest is the best */
function rank(ids: number[], own: number, measure: (id: number) => number, lowestFirst = false): string {
  const value = measure(own);
  const place = ids.filter(id => (lowestFirst ? measure(id) < value : measure(id) > value)).length + 1;
  return t("Rank: {{rank}} of {{total}}", { rank: place, total: ids.length });
}

/** Rank among living states; the neutral lands are not ranked */
function stateRank(stateId: number, measure: (stateId: number) => number, lowestFirst = false): string {
  if (!stateId) return t("Neutral lands");
  const ids = pack.states.filter(state => state.i && !state.removed).map(state => state.i);
  return rank(ids, stateId, measure, lowestFirst);
}

/** The sectors' bar and legend, each against the share of what it is compared with */
function renderSectors(accounts: Sectors, compared: Sectors, comparedLabel: string): string {
  const labels: Record<Sector, string> = { rural: t("Rural"), manufacturing: t("Manufacturing"), trade: t("Trade") };
  const hints: Record<Sector, string> = {
    rural: t("Rural people's earnings from their produce"),
    manufacturing: t("The product of its burgs"),
    trade: t("Margins its market centers took")
  };
  const bar = SECTORS.map(sector => {
    const width = sectorShare(accounts, sector) * 100;
    return `<div data-tip="${hints[sector]}" style="width: ${width}%; background: ${SECTOR_COLORS[sector]}"></div>`;
  }).join("");
  const legend = SECTORS.map(sector => {
    const value = `${formatPrice(accounts[sector])} (${rn(sectorShare(accounts, sector) * 100, 1)}%)`;
    const share = `${comparedLabel}: ${rn(sectorShare(compared, sector) * 100, 1)}%`;
    return `<span data-tip="${hints[sector]}. ${share}"><span class="swatch" style="background: ${SECTOR_COLORS[sector]}"></span>${labels[sector]}: ${value}</span>`;
  }).join("");
  return `<h4>${t("Economic sectors")}</h4><div class="stack" style="margin: 0.3em 0">${bar}</div><div class="legend">${legend}</div>`;
}

/** How urban and rural people live, each with a bar of its people by prosperity level */
function renderLiving(accounts: Living, button = ""): string {
  const level = (index: number) => {
    const middle = index / 10 + 0.05; // a prosperity within the level, for its name and color
    return { name: prosperityLevel(middle), color: prosperityColor(middle) };
  };
  const stack = (counts: number[]) => {
    const total = counts.reduce((sum, count) => sum + count, 0) || 1;
    const parts = PROSPERITY_LEVELS.map((_, index) => {
      const share = (counts[index] / total) * 100;
      if (!share) return "";
      const { name, color } = level(index);
      return `<div data-tip="${name}: ${rn(share, 1)}%" style="width: ${share}%; background: ${color}"></div>`;
    }).join("");
    return `<div class="stack small">${parts}</div>`;
  };
  const group = (label: string, living: GroupLiving | null, counts: number[]) =>
    living
      ? `<div data-tip="${renderProsperityParts(living)}" class="group">${label}: ${renderProsperity(living.prosperity)}${stack(counts)}</div>`
      : "";

  const people = PROSPERITY_LEVELS.map((_, index) => accounts.levels.urban[index] + accounts.levels.rural[index]);
  return `<div><h4 data-tip="${t("Prosperity of urban and rural people")}"><span>${t("Prosperity")}</span>${button}</h4>
    ${group(t("Total population"), combine(accounts.living.urban, accounts.living.rural), people)}
    ${group(t("Urban population"), accounts.living.urban, accounts.levels.urban)}
    ${group(t("Rural population"), accounts.living.rural, accounts.levels.rural)}
    ${accounts.living.urban || accounts.living.rural ? "" : `<i>${t("None")}</i>`}
  </div>`;
}

/** The most valuable goods, by value; values by good id */
function renderGoods(title: string, values: number[], button = ""): string {
  const top = values
    .flatMap((value, goodId) => (value > 0 ? [[goodId, value] as [number, number]] : []))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ROWS);
  const most = top[0]?.[1] || 1;
  const html = top
    .map(([goodId, value]) => {
      const good = Goods.get(goodId);
      if (!good) return "";
      const name = `<svg width="1.4em" height="1.4em">${goodBadge(good)}</svg>${escapeHtml(good.name)}`;
      const bar = `<div class="bar"><div style="width: ${(value / most) * 100}%; background: var(--header)"></div></div>`;
      return `<div class="row"><span class="name">${name}</span>${bar}<span class="right">${formatPrice(value)}</span></div>`;
    })
    .join("");
  return `<div><h4><span>${title}</span>${top.length ? button : ""}</h4>${html || `<i>${t("None")}</i>`}</div>`;
}

const tableButton = (kind: GoodsKind) =>
  `<button type="button" class="icon-list-bullet goodsTable" data-kind="${kind}" data-tip="${EconomyTerms.table()}"></button>`;

const budgetButton = () =>
  `<button type="button" class="icon-bank taxes" data-tip="${t("Set the state's taxes, budget and tariffs")}"></button>`;

const prosperityPercent = (value: number | null) => (value === null ? "—" : renderProsperityPercent(value));
const prosperityText = (value: number | null) =>
  value === null ? "—" : `${rn(value * 100)}% ${prosperityLevel(value)}`;

const sectorShare = (accounts: Sectors, sector: Sector) => (accounts.product ? accounts[sector] / accounts.product : 0);

const taxesOf = ({ taxes }: ProvinceAccounts) => taxes.salesTax + taxes.tariffs + taxes.pollTax + taxes.marketFees;

/** Population as people, from urban and rural population points */
function people(accounts: Population) {
  const { scale, urbanization } = options.map.units.population;
  const urban = accounts.urbanPeople * scale * urbanization.rate;
  const rural = (accounts.people - accounts.urbanPeople) * scale;
  return { urban, rural, total: urban + rural };
}

/** Two groups' living averaged by their people */
function combine(...groups: (GroupLiving | null)[]): GroupLiving | null {
  const lived = groups.filter(group => group !== null);
  const people = lived.reduce((sum, group) => sum + group.people, 0);
  if (!people) return null;
  const average = (key: "needs" | "comfort" | "variety" | "infrastructure" | "prosperity") =>
    lived.reduce((sum, group) => sum + group[key] * group.people, 0) / people;
  return {
    people,
    needs: average("needs"),
    comfort: average("comfort"),
    variety: average("variety"),
    infrastructure: average("infrastructure"),
    prosperity: average("prosperity")
  };
}

/** Why the type, and the good the state is known for */
function economyNotes(stateId: number, accounts: StateAccounts, world: StateAccounts): string[] {
  const sector = leaningSector(accounts, world);
  const labels: Record<Sector, string> = { rural: t("Rural"), manufacturing: t("Manufacturing"), trade: t("Trade") };
  const lean = sector ? rn(sectorShare(accounts, sector) / (sectorShare(world, sector) || 1), 1) : 0;
  const notes = sector ? [t("{{sector}}: ×{{lean}}", { sector: labels[sector], lean })] : [];
  const known = knownFor(stateId);
  if (known) notes.push(t("Known for: {{good}}", { good: known }));
  return notes;
}

/** The good weighing most in its exports: its share² ÷ its world share */
function knownFor(stateId: number): string | null {
  const { exported, exports } = Accounts.getTrade(stateId);
  if (!exports) return null;
  const world: number[] = [];
  for (const state of pack.states) {
    if (state.removed) continue;
    Accounts.getTrade(state.i).exported.forEach((value, goodId) => {
      world[goodId] = (world[goodId] || 0) + value;
    });
  }
  const worldTotal = world.reduce((total, value) => total + value, 0);
  let bestId = -1;
  let bestLean = 0;
  exported.forEach((value, goodId) => {
    const lean = (value / exports) ** 2 / (world[goodId] / worldTotal);
    if (lean > bestLean) [bestId, bestLean] = [goodId, lean];
  });
  return Goods.get(bestId)?.name ?? null;
}

/** The sector whose share of the product most exceeds its share of the world's */
function leaningSector(accounts: StateAccounts, world: StateAccounts): Sector | null {
  if (!accounts.product) return null;
  const lean = (sector: Sector) => sectorShare(accounts, sector) / (sectorShare(world, sector) || 1);
  return SECTORS.reduce((best, next) => (lean(next) > lean(best) ? next : best));
}

function economyType(accounts: StateAccounts, world: StateAccounts): string {
  const sector = leaningSector(accounts, world);
  return sector ? { rural: t("Agrarian"), manufacturing: t("Artisan"), trade: t("Mercantile") }[sector] : "—";
}

/** 0 when all are equal, 1 when one has it all */
function gini(values: number[]): number {
  const sorted = values.map(value => Math.max(0, value)).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!total || sorted.length < 2) return 0;
  const weighted = sorted.reduce((sum, value, index) => sum + (2 * (index + 1) - sorted.length - 1) * value, 0);
  return weighted / (sorted.length * total);
}

export const EconomyOverview = { open };
