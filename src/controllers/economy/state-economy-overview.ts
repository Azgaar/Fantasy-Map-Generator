import { Controllers } from "@/controllers";
import { Goods } from "@/model/economy/goods-generator";
import { PROSPERITY_LEVELS } from "@/model/economy/prosperity";
import { type GroupLiving, type StateAccounts, StateEconomy } from "@/model/economy/state-economy";
import { EXPENSES } from "@/model/political/states-generator";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { budgetBackground, ECONOMY_COLORS, tone } from "./economy-config";
import { EconomyTerms } from "./economy-terms";
import { bindEconomyWiki, economyWikiButton } from "./economy-wiki";
import {
  prosperityColor,
  prosperityLevel,
  renderProsperity,
  renderProsperityParts,
  renderProsperityPercent
} from "./prosperity-view";
import { type GoodsKind, openGoodsTable, openPartnersTable, openProsperityTable } from "./state-economy-tables";

const dialogPrefix = "stateEconomy";

const TOP_ROWS = 6;
const TOP_PARTNERS = 6;
const KNOWN_FOR_SHARE = 0.03; // a good the state is known for makes at least this share of its output

const SECTORS = ["rural", "manufacturing", "trade"] as const;
type Sector = (typeof SECTORS)[number];
const SECTOR_COLORS: Record<Sector, string> = { rural: "#6a9a3a", manufacturing: "#d98a32", trade: "#4a7ac0" };
const STYLE = /* html */ `<style>
  .stateEconomyDialog > div { width: auto }
  .stateEconomyDialog .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.4em; margin-bottom: 0.8em }
  .stateEconomyDialog .card { border: 1px solid #ccc; border-top: 3px solid var(--header); padding: 0.3em 0.5em; line-height: 1.3 }
  .stateEconomyDialog .card .label { font-size: 0.8em; text-transform: uppercase; color: #666 }
  .stateEconomyDialog .card .value { font-size: 1.25em; font-weight: bold; white-space: nowrap }
  .stateEconomyDialog .card .note { font-size: 0.8em; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  .stateEconomyDialog h4 { margin: 0.8em 0 0.3em; border-bottom: 1px solid var(--dark-solid) }
  .stateEconomyDialog .columns { display: grid; grid-template-columns: 1fr 1fr; column-gap: 1.2em }
  .stateEconomyDialog .stack { display: flex; height: 1em }
  .stateEconomyDialog .stack.small { display: flex; height: 0.85em; opacity: 0.8 }
  .stateEconomyDialog .legend { display: flex; justify-content: space-between; }
  .stateEconomyDialog .legend span { font-size: 0.9em; white-space: nowrap }
  .stateEconomyDialog .swatch { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.25em; vertical-align: middle }
  .stateEconomyDialog .row { display: grid; grid-template-columns: 8em 1fr 5em; align-items: center; column-gap: 0.4em; line-height: 1.5 }
  .stateEconomyDialog .row.plain { grid-template-columns: 1fr 6em }
  .stateEconomyDialog .row.budget { grid-template-columns: 2fr 2em 1fr 5em }
  .stateEconomyDialog .row .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 0.2em }
  .stateEconomyDialog .bar { height: 0.7em; background: #eee }
  .stateEconomyDialog .bar > div { height: 100% }
  .stateEconomyDialog .bar.stack { display: flex }
  .stateEconomyDialog .right { text-align: right }
  .stateEconomyDialog .total { font-weight: bold; border-top: 1px solid #ccc }
  .stateEconomyDialog .muted { font-size: 0.85em; color: #666 }
  .stateEconomyDialog h4 { display: flex; justify-content: space-between; align-items: center }
  .stateEconomyDialog h4 button[class^="icon-"] { padding: 0 3px; font-size: 0.75em; line-height: 1; margin: 2px 0; }
  .stateEconomyDialog .group { line-height: 1.6 }
</style>`;

/** Opens one dialog per state, so states can be compared side by side */
function open(stateId: number): void {
  const state = pack.states[stateId];
  if (!state || state.removed || (!state.cells && !state.burgs)) return; // 0 is the neutral lands, often empty
  if (!StateEconomy.getAccounts(stateId)) {
    tip(EconomyTerms.noData(), true, "error", 5000);
    return;
  }

  const id = `${dialogPrefix}${stateId}`;
  Dialog.destroy(id);
  const opened = document.querySelectorAll(".stateEconomyDialog").length;
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${id}" class="dialog stable stateEconomyDialog">
      ${STYLE}
      <div class="body"></div>
      <div style="margin-top: 3px">
        <button type="button" data-tip="${t("Refresh")}" class="icon-cw refresh"></button>
        ${economyWikiButton(`${id}Wiki`)}
      </div>
    </div>`
  );
  const root = ensureEl(id);
  const render = () => {
    root.querySelector<HTMLElement>(".body")!.innerHTML = renderBody(stateId);
  };
  root.querySelector(".refresh")!.addEventListener("click", render);
  root.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>(".goodsTable");
    if (button) openGoodsTable(stateId, button.dataset.kind as GoodsKind);
    if (target.closest(".partnersTable")) openPartnersTable(stateId);
    if (target.closest(".prosperityTable")) openProsperityTable(stateId);
    if (target.closest(".taxes")) Controllers.StatesEditor.openTaxes(stateId);
  });
  bindEconomyWiki(`${id}Wiki`);
  render();

  const offset = 10 + 660 * opened; // each next one to the left of the last, for comparing
  Dialog.open(id, {
    title: stateId
      ? t("Economy of {{- state}}", { state: state.fullName || state.name })
      : t("Economy of the neutral lands"),
    width: "46em",
    resizable: true,
    onClose: () => Dialog.destroy(id),
    position: { my: "right top", at: `right-${offset} top+10`, of: "svg" }
  });
}

function renderBody(stateId: number): string {
  const accounts = StateEconomy.getAccounts(stateId);
  const world = StateEconomy.getWorld();
  if (!accounts || !world) return "";
  const trade = StateEconomy.getTrade(stateId);
  return [
    renderCards(stateId, accounts, world, trade.exports, trade.imports),
    renderSectors(accounts, world),
    renderLiving(accounts),
    stateId ? `<div class="columns">${renderRevenue(stateId, accounts)}${renderExpenses(stateId)}</div>` : "",
    `<div class="columns">${renderGoods(t("Main exports"), trade.exported, "exports")}${renderGoods(t("Main imports"), trade.imported, "imports")}</div>`,
    `<div class="columns">${renderGoods(t("Most valuable goods made"), StateEconomy.getOutput(stateId), "made")}${renderPartners(trade.partners)}</div>`
  ].join("");
}

function card(label: string, value: string, notes: string[], tipText: string): string {
  const lines = notes.map(note => `<div class="note">${note}</div>`).join("");
  return `<div class="card" data-tip="${tipText}"><div class="label">${label}</div><div class="value">${value}</div>${lines}</div>`;
}

/** "Rank: 2 of 20" among living states, the highest value first unless the lowest is the best; the neutral lands are not ranked */
function rank(stateId: number, measure: (stateId: number) => number, lowestFirst = false): string {
  if (!stateId) return t("Neutral lands");
  const states = pack.states.filter(state => state.i && !state.removed);
  const own = measure(stateId);
  const place = states.filter(state => (lowestFirst ? measure(state.i) < own : measure(state.i) > own)).length + 1;
  return t("Rank: {{rank}} of {{total}}", { rank: place, total: states.length });
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
  const burden = accounts.product ? rn((pack.states[stateId].economy.collected / accounts.product) * 100, 1) : 0;
  const balance = exports - imports;
  const population = people(accounts);
  const share = world.product ? rn((accounts.product / world.product) * 100, 1) : 0;
  const worldProsperity =
    world.prosperity === null ? "—" : `${rn(world.prosperity * 100)}% ${prosperityLevel(world.prosperity)}`;
  const prosperity = accounts.prosperity === null ? "—" : renderProsperityPercent(accounts.prosperity);

  const treasuryCard = stateId
    ? card(
        t("Balance"),
        formatPrice(treasury),
        [rank(stateId, id => pack.states[id].economy.treasury || 0), t("Tax burden: {{burden}}%", { burden })],
        sentences(EconomyTerms.stateTreasury(), t("Tax burden: the taxes' share of the product"))
      )
    : card(t("Balance"), "—", [t("Neutrals collect no taxes")], EconomyTerms.stateTreasury());
  const populationRank = rank(stateId, id => {
    const other = accountsOf(id);
    return other ? people(other).total : 0;
  });
  const rural = si(population.rural);
  const urban = si(population.urban);

  return `<div class="cards">
    ${card(t("Economy"), economyType(accounts, world), economyNotes(stateId, accounts, world), t("Economy type: the sector the state leans on"))}
    ${card(t("Population"), si(population.total), [populationRank, t("Rural: {{rural}}, urban: {{urban}}", { rural, urban })], t("Population: rural and urban people"))}
    ${card(t("Inequality"), String(rn(gini(accounts.burgWealth), 2)), [rank(stateId, id => gini(accountsOf(id)?.burgWealth ?? []), true), `${t("World")}: ${rn(gini(world.burgWealth), 2)}`], t("Inequality: Gini of burg wealth, 0 is equal"))}
    ${card(t("Trade balance"), `<span class="${tone(balance)}">${formatPrice(balance)}</span>`, [`${t("Exports")}: ${formatPrice(exports)}`, `${t("Imports")}: ${formatPrice(imports)}`], t("Trade balance: exports less imports, at market prices"))}
    ${treasuryCard}
    ${card(t("Prosperity"), prosperity, [rank(stateId, id => accountsOf(id)?.prosperity ?? 0), `${t("World")}: ${worldProsperity}`], EconomyTerms.prosperity())}
    ${card(t("Product"), formatPrice(accounts.product), [rank(stateId, id => accountsOf(id)?.product ?? 0), t("{{share}}% of the world", { share })], EconomyTerms.stateProduct())}
    ${card(t("Wealth"), formatPrice(accounts.wealth), [rank(stateId, id => accountsOf(id)?.wealth ?? 0), `${t("World")}: ${formatPrice(world.wealth)}`], EconomyTerms.wealth())}
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
  const worldOutput = StateEconomy.getOutput(-1);
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

const sectorShare = (accounts: StateAccounts, sector: Sector) =>
  accounts.product ? accounts[sector] / accounts.product : 0;

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

function renderSectors(accounts: StateAccounts, world: StateAccounts): string {
  const labels: Record<Sector, string> = { rural: t("Rural"), manufacturing: t("Manufacturing"), trade: t("Trade") };
  const hints: Record<Sector, string> = {
    rural: t("Rural people's earnings from their produce"),
    manufacturing: t("The product of the state's burgs"),
    trade: t("Margins the state's market centers took")
  };
  const bar = SECTORS.map(sector => {
    const width = sectorShare(accounts, sector) * 100;
    return `<div data-tip="${hints[sector]}" style="width: ${width}%; background: ${SECTOR_COLORS[sector]}"></div>`;
  }).join("");
  const legend = SECTORS.map(sector => {
    const value = `${formatPrice(accounts[sector])} (${rn(sectorShare(accounts, sector) * 100, 1)}%)`;
    const worldShare = `${t("World")}: ${rn(sectorShare(world, sector) * 100, 1)}%`;
    return `<span data-tip="${hints[sector]}. ${worldShare}"><span class="swatch" style="background: ${SECTOR_COLORS[sector]}"></span>${labels[sector]}: ${value}</span>`;
  }).join("");
  return `<h4>${t("Economic sectors")}</h4><div class="stack" style="margin: 0.3em 0">${bar}</div><div class="legend">${legend}</div>`;
}

const line = (name: string, value: number, tip = "", tone = "") =>
  `<div data-tip="${tip}" class="row plain"><span class="name">${name}</span><span class="right ${tone}">${formatPrice(value)}</span></div>`;

const budgetButton = () =>
  `<button type="button" class="icon-bank taxes" data-tip="${t("Set the state's taxes, budget and tariffs")}"></button>`;

/** What the state collected today, by tax */
function renderRevenue(stateId: number, accounts: StateAccounts): string {
  const { salesTax, tariffs, pollTax, pollTaxOwed, marketFees, otherRevenue } = StateEconomy.getBudget(stateId);
  const { economy } = pack.states[stateId];
  const taxes = salesTax + tariffs + pollTax + marketFees;
  const share = accounts.product ? rn((taxes / accounts.product) * 100, 1) : 0;
  return `<div><h4 data-tip="${t("What the state collected today")}"><span>${t("Revenue")}</span>${budgetButton()}</h4>
    ${line(t("Sales tax: {{rate}}%", { rate: rn((economy.salesTax || 0) * 100, 1) }), salesTax, "", "positive")}
    ${line(t("Import tariffs"), tariffs, "", "positive")}
    ${line(t("Poll tax: {{rate}} a head", { rate: economy.pollTax || 0 }), pollTax, pollTax ? EconomyTerms.collected(pollTax, pollTaxOwed) : "", "positive")}
    ${line(t("Market licenses: {{fee}} each", { fee: economy.marketFee || 0 }), marketFees, "", "positive")}
    ${otherRevenue ? line(t("Other revenue"), otherRevenue, EconomyTerms.otherRevenue(), tone(otherRevenue)) : ""}
    <div class="total">${line(t("Collected"), taxes + otherRevenue, t("Total collected taxes and fees"), "positive")}</div>
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
    ${EXPENSES.map(expense => row(EconomyTerms.expense(expense), budget[expense], `<div class="bar" style="background: ${budgetBackground(budget[expense], budget.corruption)}"></div>`, -economy.spent[expense], EconomyTerms.expenseTip(expense), "negative")).join("")}
    <div class="total">${row(t("Balance"), balance, "<span></span>", economy.treasury, EconomyTerms.stateTreasury(), tone(economy.treasury))}</div>
    <div data-tip="${EconomyTerms.corruption()}" class="row plain muted"><span class="name">${swatch}${t("Corruption: {{rate}}%", { rate: budget.corruption })}</span><span class="right negative">${formatPrice(-economy.pocketed)}</span></div>
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

function renderGoods(title: string, values: number[], kind: GoodsKind): string {
  const top = values
    .flatMap((value, goodId) => (value > 0 ? [[goodId, value] as [number, number]] : []))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ROWS);
  const most = top[0]?.[1] || 1;
  const html = top
    .map(([goodId, value]) => {
      const good = Goods.get(goodId);
      if (!good) return "";
      const name = `<svg width="1.4em" height="1.4em">${goodBadge(good)}</svg>${good.name}`;
      const bar = `<div class="bar"><div style="width: ${(value / most) * 100}%; background: var(--header)"></div></div>`;
      return `<div class="row"><span class="name">${name}</span>${bar}<span class="right">${formatPrice(value)}</span></div>`;
    })
    .join("");
  const button = top.length
    ? `<button type="button" class="icon-list-bullet goodsTable" data-kind="${kind}" data-tip="${EconomyTerms.table()}"></button>`
    : "";
  return `<div><h4><span>${title}</span>${button}</h4>${html || `<i>${t("None")}</i>`}</div>`;
}

/** How urban and rural people live, each with a bar of its people by prosperity level */
function renderLiving(accounts: StateAccounts): string {
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

  const people = PROSPERITY_LEVELS.map((_, index) => accounts.levels.towns[index] + accounts.levels.country[index]);
  const button = `<button type="button" class="icon-list-bullet prosperityTable" data-tip="${t("Show prosperity statistics")}"></button>`;
  return `<div><h4 data-tip="${t("Prosperity of urban and rural people")}"><span>${t("Prosperity")}</span>${button}</h4>
    ${group(t("Total population"), combine(accounts.towns, accounts.country), people)}
    ${group(t("Urban population"), accounts.towns, accounts.levels.towns)}
    ${group(t("Rural population"), accounts.country, accounts.levels.country)}
    ${accounts.towns || accounts.country ? "" : `<i>${t("None")}</i>`}
  </div>`;
}

/** Two groups' living averaged by their people */
function combine(...groups: (GroupLiving | null)[]): GroupLiving | null {
  const lived = groups.filter(group => group !== null);
  const people = lived.reduce((sum, group) => sum + group.people, 0);
  if (!people) return null;
  const average = (key: "needs" | "comfort" | "variety" | "prosperity") =>
    lived.reduce((sum, group) => sum + group[key] * group.people, 0) / people;
  return {
    people,
    needs: average("needs"),
    comfort: average("comfort"),
    variety: average("variety"),
    prosperity: average("prosperity")
  };
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
