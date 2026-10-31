import { Controllers } from "@/controllers";
import { EXPENSE_LABELS } from "@/data/id-labels";
import { Goods } from "@/model/economy/goods-generator";
import { type StateAccounts, StateEconomy } from "@/model/economy/state-economy";
import { Districts } from "@/model/political/districts";
import { EXPENSES } from "@/model/political/states-generator";
import { formatPrice } from "@/model/units";
import { Dialog } from "@/ui/dialog/dialog";
import {
  bindEconomyWiki,
  budgetBackground,
  ECONOMY_COLORS,
  EconomyTerms,
  prosperityLevel,
  renderProsperityPercent,
  tone
} from "@/ui/economy-view";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { escapeHtml } from "@/utils/string-utils";
import {
  card,
  economyDialog,
  line,
  rank,
  renderGoods,
  renderLiving,
  renderSectors,
  SECTORS,
  type Sector,
  sectorShare
} from "./economy-parts";
import { type GoodsKind, StateEconomyTables } from "./state-economy-tables";

const TOP_PARTNERS = 6;
const KNOWN_FOR_SHARE = 0.03; // a good the state is known for makes at least this share of its output
const DIALOG_CLASS = "stateEconomyDialog";

const dialogId = (stateId: number) => `stateEconomy${stateId}`;

/** Opens one dialog per state, so states can be compared side by side */
function open(stateId: number): void {
  const state = pack.states[stateId];
  if (!state || state.removed || (!state.cells && !state.burgs)) return; // 0 is the neutral lands, often empty
  if (!StateEconomy.getAccounts(stateId)) {
    tip(EconomyTerms.noData(), true, "error", 5000);
    return;
  }

  renderDialog(stateId);
  addListeners(stateId);
  refresh(stateId);

  const offset = 10 + 660 * (document.querySelectorAll(`.${DIALOG_CLASS}`).length - 1); // each next one to the left of the last
  Dialog.open(dialogId(stateId), {
    title: stateId
      ? t("Economy of {{- state}}", { state: state.fullName || state.name })
      : t("Economy of the neutral lands"),
    width: "46em",
    resizable: true,
    onClose: () => cleanup(stateId),
    position: { my: "right top", at: `right-${offset} top+10`, of: "svg" }
  });
}

function renderDialog(stateId: number): void {
  Dialog.destroy(dialogId(stateId));
  ensureEl("dialogs").insertAdjacentHTML("beforeend", economyDialog(dialogId(stateId), DIALOG_CLASS));
}

function addListeners(stateId: number): void {
  const id = dialogId(stateId);
  ensureEl(id).addEventListener("click", event => onClick(stateId, event.target as HTMLElement));
  bindEconomyWiki(`${id}Wiki`);
}

function onClick(stateId: number, target: HTMLElement): void {
  const goodsTable = target.closest<HTMLElement>(".goodsTable");
  if (target.closest(`#${dialogId(stateId)}Refresh`)) refresh(stateId);
  else if (goodsTable) StateEconomyTables.openGoods(stateId, goodsTable.dataset.kind as GoodsKind);
  else if (target.closest(".partnersTable")) StateEconomyTables.openPartners(stateId);
  else if (target.closest(".prosperityTable")) StateEconomyTables.openProsperity(stateId);
  else if (target.closest(".taxes")) void Controllers.StateBudgetEditor.open(stateId, () => refresh(stateId));
}

function refresh(stateId: number): void {
  ensureEl(`${dialogId(stateId)}Body`).innerHTML = renderBody(stateId);
}

function cleanup(stateId: number): void {
  Dialog.destroy(dialogId(stateId));
}

function renderBody(stateId: number): string {
  const accounts = StateEconomy.getAccounts(stateId);
  const world = StateEconomy.getWorld();
  if (!accounts || !world) return "";
  const trade = StateEconomy.getTrade(stateId);
  return [
    renderCards(stateId, accounts, world, trade.exports, trade.imports),
    renderSectors(accounts, world, t("World")),
    renderLiving(
      accounts,
      `<button type="button" class="icon-list-bullet prosperityTable" data-tip="${t("Show prosperity statistics")}"></button>`
    ),
    stateId ? `<div class="columns">${renderRevenue(stateId, accounts)}${renderExpenses(stateId)}</div>` : "",
    `<div class="columns">${renderGoods(t("Main exports"), trade.exported, tableButton("exports"))}${renderGoods(t("Main imports"), trade.imported, tableButton("imports"))}</div>`,
    `<div class="columns">${renderGoods(t("Most valuable goods made"), StateEconomy.getOutput(stateId), tableButton("made"))}${renderPartners(trade.partners)}</div>`
  ].join("");
}

/** Rank among living states; the neutral lands are not ranked */
function stateRank(stateId: number, measure: (stateId: number) => number, lowestFirst = false): string {
  if (!stateId) return t("Neutral lands");
  const ids = pack.states.filter(state => state.i && !state.removed).map(state => state.i);
  return rank(ids, stateId, measure, lowestFirst);
}

const accountsOf = (stateId: number) => StateEconomy.getAccounts(stateId);

/** Population as people, from townspeople and rural population points */
function people(accounts: StateAccounts) {
  const { scale, urbanization } = options.map.units.population;
  const urban = accounts.townspeople * scale * urbanization.rate;
  const rural = (accounts.people - accounts.townspeople) * scale;
  return { urban, rural, total: urban + rural };
}

function renderCards(
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
  const worldProsperity =
    world.prosperity === null ? "—" : `${rn(world.prosperity * 100)}% ${prosperityLevel(world.prosperity)}`;
  const prosperity = accounts.prosperity === null ? "—" : renderProsperityPercent(accounts.prosperity);

  const treasuryCard = stateId
    ? card(
        t("Day Balance"),
        formatPrice(treasury),
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
    ${card(t("Prosperity"), prosperity, [stateRank(stateId, id => accountsOf(id)?.prosperity ?? 0), `${t("World")}: ${worldProsperity}`], EconomyTerms.prosperity())}
    ${card(t("Product"), formatPrice(accounts.product), [stateRank(stateId, id => accountsOf(id)?.product ?? 0), t("{{share}}% of the world", { share })], EconomyTerms.stateProduct())}
    ${card(t("Wealth"), formatPrice(accounts.wealth), [stateRank(stateId, id => accountsOf(id)?.wealth ?? 0), `${t("World")}: ${formatPrice(world.wealth)}`], EconomyTerms.wealth())}
  </div>`;
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

/** The good whose share of the state's output most exceeds its share of the world's, of those it makes in some measure */
function knownFor(stateId: number): string | null {
  const output = StateEconomy.getOutput(stateId);
  const worldOutput = StateEconomy.getWorldOutput();
  const total = output.reduce((sum, value) => sum + (value || 0), 0);
  const worldTotal = worldOutput.reduce((sum, value) => sum + (value || 0), 0);
  if (!total || !worldTotal) return null;
  let bestId = -1;
  let bestLean = 0;
  for (let goodId = 0; goodId < output.length; goodId++) {
    const value = output[goodId];
    if (!value || value / total < KNOWN_FOR_SHARE) continue;
    const lean = value / total / ((worldOutput[goodId] || value) / worldTotal);
    if (lean > bestLean) [bestId, bestLean] = [goodId, lean];
  }
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

const tableButton = (kind: GoodsKind) =>
  `<button type="button" class="icon-list-bullet goodsTable" data-kind="${kind}" data-tip="${EconomyTerms.table()}"></button>`;

const budgetButton = () =>
  `<button type="button" class="icon-bank taxes" data-tip="${t("Set the state's taxes, budget and tariffs")}"></button>`;

/** What the state collected today, by tax */
function renderRevenue(stateId: number, accounts: StateAccounts): string {
  const { salesTax, tariffs, pollTax, pollTaxOwed, marketFees, adjustments } = StateEconomy.getBudget(stateId);
  const { economy } = pack.states[stateId];
  const taxes = salesTax + tariffs + pollTax + marketFees;
  const share = accounts.product ? rn((accounts.taxes / accounts.product) * 100, 1) : 0;
  return `<div><h4 data-tip="${t("What the state collected today")}"><span>${t("Revenue")}</span>${budgetButton()}</h4>
    ${line(t("Sales tax: {{rate}}%", { rate: rn((economy.salesTax || 0) * 100, 1) }), salesTax, "", "positive")}
    ${line(t("Import tariffs"), tariffs, "", "positive")}
    ${line(t("Poll tax: {{rate}} a head", { rate: economy.pollTax || 0 }), pollTax, pollTax ? EconomyTerms.collected(pollTax, pollTaxOwed) : "", "positive")}
    ${line(t("Market licenses: {{fee}} each", { fee: economy.marketFee || 0 }), marketFees, "", "positive")}
    ${economy.adjustments.map(({ name, value }) => line(escapeHtml(name) || t("Adjustments"), value, EconomyTerms.adjustments(), tone(value))).join("")}
    <div class="total">${line(t("Collected"), taxes + adjustments, t("Total collected taxes and fees"), "positive")}</div>
    <div class="muted">${t("{{share}}% of the product", { share })}</div>
  </div>`;
}

/** Where the taxes went: each expense's share with the part officials pocket grayed, then the treasury's */
function renderExpenses(stateId: number): string {
  const { economy } = pack.states[stateId];
  const { budget } = economy;
  const balance = 100 - EXPENSES.reduce((total, expense) => total + budget[expense], 0); // below 0 when the state spends beyond its taxes
  const row = (name: string, share: number, bar: string, value: number, tip: string, tone: string) =>
    `<div data-tip="${tip}" class="row budget"><span class="name">${name}</span><span class="right">${share}%</span>${bar}<span class="right ${tone}">${formatPrice(value)}</span></div>`;
  const swatch = `<span class="swatch" style="background: ${ECONOMY_COLORS.pocketed}"></span>`;
  return `<div><h4 data-tip="${EconomyTerms.budget()}"><span>${t("Expenses")}</span>${budgetButton()}</h4>
    ${EXPENSES.map(expense => row(EXPENSE_LABELS[expense], budget[expense], `<div class="bar" style="background: ${budgetBackground(budget[expense], budget.corruption)}"></div>`, -economy.spent[expense], EconomyTerms.expenseTip(expense), "negative")).join("")}
    <div class="total">${row(t("Day Balance"), balance, "<span></span>", economy.treasury, EconomyTerms.stateTreasury(), tone(economy.treasury))}</div>
    <div data-tip="${EconomyTerms.corruption()}" class="row plain muted"><span class="name">${swatch}${t("Corruption: {{rate}}%", { rate: rn(Districts.getStateCorruption(pack.states[stateId], economy.collected)) })}</span><span class="right negative">${formatPrice(-economy.pocketed)}</span></div>
  </div>`;
}

function renderPartners(partners: Map<number, { exports: number; imports: number }>): string {
  const rows = [...partners]
    .map(([stateId, row]) => ({ stateId, ...row, volume: row.exports + row.imports }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, TOP_PARTNERS);
  const most = Math.max(1, ...rows.map(row => row.volume));
  const html = rows
    .map(({ stateId, exports, imports }) => {
      const partner = pack.states[stateId];
      const balance = exports - imports;
      const name = `<span class="swatch" style="background: ${partner?.color || "#ccc"}"></span>${partner?.name || t("Neutrals")}`;
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

/** 0 when all are equal, 1 when one has it all */
function gini(values: number[]): number {
  const sorted = values.map(value => Math.max(0, value)).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!total || sorted.length < 2) return 0;
  const weighted = sorted.reduce((sum, value, index) => sum + (2 * (index + 1) - sorted.length - 1) * value, 0);
  return weighted / (sorted.length * total);
}

export const StateEconomyOverview = { open };
