import { Controllers } from "@/controllers";
import { Goods } from "@/model/economy/goods-generator";
import { PROSPERITY_LEVELS } from "@/model/economy/prosperity";
import { type GroupLiving, type StateAccounts, StateEconomy } from "@/model/economy/state-economy";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Dialog } from "@/ui/dialog/dialog";
import { tip } from "@/ui/tooltips";
import { t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { bindEconomyWiki, economyWikiButton } from "./economy-wiki";
import { prosperityColor, prosperityLevel, renderProsperity, renderProsperityParts } from "./prosperity-view";

const dialogPrefix = "stateEconomy";
const TOP_ROWS = 6;
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
  .stateEconomyDialog .stack { display: flex; height: 1em; margin: 0.3em 0 }
  .stateEconomyDialog .legend span { margin-right: 0.8em; font-size: 0.85em; white-space: nowrap }
  .stateEconomyDialog .swatch { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 0.25em; vertical-align: middle }
  .stateEconomyDialog .row { display: grid; grid-template-columns: 8em 1fr 5em; align-items: center; column-gap: 0.4em; line-height: 1.6 }
  .stateEconomyDialog .row.plain { grid-template-columns: 1fr 6em }
  .stateEconomyDialog .row .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; gap: 0.2em }
  .stateEconomyDialog .bar { height: 0.7em; background: #eee }
  .stateEconomyDialog .bar > div { height: 100% }
  .stateEconomyDialog .right { text-align: right }
  .stateEconomyDialog .positive { color: #2a6 }
  .stateEconomyDialog .negative { color: #a34a14 }
  .stateEconomyDialog .total { font-weight: bold; border-top: 1px solid #ccc }
  .stateEconomyDialog .muted { font-size: 0.85em; color: #666 }
  .stateEconomyDialog .group { line-height: 1.6 }
</style>`;

/** Opens one dialog per state, so states can be compared side by side */
function open(stateId: number): void {
  const state = pack.states[stateId];
  if (!stateId || !state || state.removed) return;
  if (!StateEconomy.getAccounts(stateId)) {
    tip(t("No economy data yet. Regenerate the economy first"), true, "error", 5000);
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
      <div>
        <button type="button" data-tip="${t("Refresh")}" class="icon-cw refresh"></button>
        <button type="button" data-tip="${t("Set the state's taxes and tariffs")}" class="icon-percent taxes"></button>
        ${economyWikiButton(`${id}Wiki`)}
      </div>
    </div>`
  );
  const root = ensureEl(id);
  const render = () => {
    root.querySelector<HTMLElement>(".body")!.innerHTML = renderBody(stateId);
  };
  root.querySelector(".refresh")!.addEventListener("click", render);
  root.querySelector(".taxes")!.addEventListener("click", () => Controllers.StatesEditor.openTaxes(stateId));
  bindEconomyWiki(`${id}Wiki`);
  render();

  const offset = 10 + 660 * opened; // each next one to the left of the last, for comparing
  Dialog.open(id, {
    title: t("Economy of {{- state}}", { state: state.fullName || state.name }),
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
    `<div class="columns">${renderTaxes(stateId, accounts)}${renderPartners(trade.partners)}</div>`,
    `<div class="columns">${renderGoods(t("Main exports"), trade.exported)}${renderGoods(t("Main imports"), trade.imported)}</div>`,
    `<div class="columns">${renderGoods(t("Most valuable goods made"), StateEconomy.getOutput(stateId))}${renderLiving(accounts)}</div>`
  ].join("");
}

function card(label: string, value: string, notes: string[], tipText: string): string {
  const lines = notes.map(note => `<div class="note">${note}</div>`).join("");
  return `<div class="card" data-tip="${tipText}"><div class="label">${label}</div><div class="value">${value}</div>${lines}</div>`;
}

/** "Rank: 2 of 20" among living states, the highest value first */
function rank(stateId: number, measure: (stateId: number) => number): string {
  const states = pack.states.filter(state => state.i && !state.removed);
  const own = measure(stateId);
  const place = states.filter(state => measure(state.i) > own).length + 1;
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
  const treasury = pack.states[stateId].treasury || 0;
  const burden = accounts.product ? rn((treasury / accounts.product) * 100, 1) : 0;
  const balance = exports - imports;
  const population = people(accounts);
  const share = world.product ? rn((accounts.product / world.product) * 100, 1) : 0;
  const worldProsperity =
    world.prosperity === null ? "—" : `${rn(world.prosperity * 100)}% ${prosperityLevel(world.prosperity)}`;
  const prosperity = accounts.prosperity === null ? "—" : renderProsperity(accounts.prosperity);

  return `<div class="cards">
    ${card(t("Product"), formatPrice(accounts.product), [rank(stateId, id => accountsOf(id)?.product ?? 0), t("{{share}}% of the world", { share })], t("Product: what the state's people make in a day: rural people's earnings, its burgs' product and its markets' margins"))}
    ${card(t("Wealth"), formatPrice(accounts.wealth), [rank(stateId, id => accountsOf(id)?.wealth ?? 0), `${t("World")}: ${formatPrice(world.wealth)}`], t("Wealth: product per person"))}
    ${card(
      t("Population"),
      si(population.total),
      [
        rank(stateId, id => {
          const other = accountsOf(id);
          return other ? people(other).total : 0;
        }),
        t("Rural: {{rural}}, urban: {{urban}}", { rural: si(population.rural), urban: si(population.urban) })
      ],
      t("Population: rural and urban people")
    )}
    ${card(t("Economy"), economyType(accounts, world), [sectorShares(accounts), `${t("World")}: ${sectorShares(world)}`], t("Economy type: the sector the state leans on more than the world does: Agrarian for rural, Artisan for manufacturing, Mercantile for trade. Shares of the product: rural / manufacturing / trade"))}
    ${card(t("Prosperity"), prosperity, [rank(stateId, id => accountsOf(id)?.prosperity ?? 0), `${t("World")}: ${worldProsperity}`], t("Prosperity: how well the people live, townspeople and rural people by their numbers. Defined by consumption fulfillment, quality and variety"))}
    ${card(t("Treasury"), formatPrice(treasury), [rank(stateId, id => pack.states[id].treasury || 0), t("Tax burden: {{burden}}%", { burden })], t("Treasury: the state's taxes for the day. Tax burden: the treasury's share of the product"))}
    ${card(t("Trade balance"), `<span class="${balance >= 0 ? "positive" : "negative"}">${formatPrice(balance)}</span>`, [`${t("Exports")}: ${formatPrice(exports)}`, `${t("Imports")}: ${formatPrice(imports)}`], t("Trade balance: what other states bought from the state's burgs and markets, less what its burgs bought from theirs, at market prices"))}
    ${card(t("Inequality"), String(rn(gini(accounts.burgWealth), 2)), [rank(stateId, id => gini(accountsOf(id)?.burgWealth ?? [])), `${t("World")}: ${rn(gini(world.burgWealth), 2)}`], t("Inequality: the Gini coefficient of burg wealth, from 0 when all burgs are equally wealthy to 1 when one has it all"))}
  </div>`;
}

const sectorShare = (accounts: StateAccounts, sector: Sector) =>
  accounts.product ? accounts[sector] / accounts.product : 0;

/** The sector whose share of the product most exceeds its share of the world's */
function economyType(accounts: StateAccounts, world: StateAccounts): string {
  if (!accounts.product) return "—";
  const lean = (sector: Sector) => sectorShare(accounts, sector) / (sectorShare(world, sector) || 1);
  const sector = SECTORS.reduce((best, next) => (lean(next) > lean(best) ? next : best));
  return { rural: t("Agrarian"), manufacturing: t("Artisan"), trade: t("Mercantile") }[sector];
}

function sectorShares(accounts: StateAccounts): string {
  return SECTORS.map(sector => `${rn(sectorShare(accounts, sector) * 100)}%`).join(" / ");
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
    const shares = `${rn(sectorShare(accounts, sector) * 100, 1)}% (${formatPrice(accounts[sector])})`;
    const worldShare = `${t("World")}: ${rn(sectorShare(world, sector) * 100, 1)}%`;
    return `<span data-tip="${hints[sector]}. ${worldShare}"><span class="swatch" style="background: ${SECTOR_COLORS[sector]}"></span>${labels[sector]} ${shares}</span>`;
  }).join("");
  return `<h4>${t("Economic sectors")}</h4><div class="stack">${bar}</div><div class="legend">${legend}</div>`;
}

const line = (name: string, value: number) =>
  `<div class="row plain"><span class="name">${name}</span><span class="right">${formatPrice(value)}</span></div>`;

function renderTaxes(stateId: number, accounts: StateAccounts): string {
  const { salesTax, tariffs, pollTax } = StateEconomy.getBudget(stateId);
  const total = salesTax + tariffs + pollTax;
  const state = pack.states[stateId];
  const share = accounts.product ? rn((total / accounts.product) * 100, 1) : 0;
  return `<div><h4 data-tip="${t("What the state collected today. Rates are set with the taxes button below")}">${t("Taxes")}</h4>
    ${line(t("Sales tax {{rate}}%", { rate: rn((state.salesTax || 0) * 100, 1) }), salesTax)}
    ${line(t("Tariffs"), tariffs)}
    ${line(t("Poll tax {{rate}} a head", { rate: state.pollTax || 0 }), pollTax)}
    <div class="total">${line(t("Treasury"), total)}</div>
    <div class="muted">${t("{{share}}% of the product", { share })}</div>
  </div>`;
}

function renderPartners(partners: Map<number, { exports: number; imports: number }>): string {
  const rows = [...partners]
    .map(([stateId, row]) => ({ stateId, balance: row.exports - row.imports, volume: row.exports + row.imports }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, TOP_ROWS);
  const most = Math.max(1, ...rows.map(row => Math.abs(row.balance)));
  const html = rows
    .map(({ stateId, balance }) => {
      const partner = pack.states[stateId];
      const width = (Math.abs(balance) / most) * 100;
      const sign = balance >= 0 ? "positive" : "negative";
      const name = `<span class="swatch" style="background: ${partner?.color || "#ccc"}"></span>${partner?.name || t("Neutrals")}`;
      const bar = `<div class="bar"><div style="width: ${width}%; background: ${balance >= 0 ? "#2a6" : "#c43"}"></div></div>`;
      return `<div class="row"><span class="name">${name}</span>${bar}<span class="right ${sign}">${formatPrice(balance)}</span></div>`;
    })
    .join("");
  const tipText = t("Trade balance with the states it trades with most, at market prices before carriage and taxes");
  return `<div><h4 data-tip="${tipText}">${t("Foreign trade")}</h4>${html || `<i>${t("None")}</i>`}</div>`;
}

function renderGoods(title: string, values: number[]): string {
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
  return `<div><h4>${title}</h4>${html || `<i>${t("None")}</i>`}</div>`;
}

/** How townspeople and rural people live, and the share of all people at each prosperity level */
function renderLiving(accounts: StateAccounts): string {
  const group = (label: string, living: GroupLiving | null) =>
    living
      ? `<div class="group"><b>${label}:</b> ${renderProsperity(living.prosperity)}<div class="muted">${renderProsperityParts(living)}</div></div>`
      : "";
  const total = accounts.levels.reduce((sum, count) => sum + count, 0) || 1;
  const levels = PROSPERITY_LEVELS.map((_, index) => {
    const middle = index / 10 + 0.05; // a prosperity within the level, for its name and color
    return {
      share: (accounts.levels[index] / total) * 100,
      name: prosperityLevel(middle),
      color: prosperityColor(middle)
    };
  });
  const stack = levels
    .filter(level => level.share)
    .map(
      ({ share, name, color }) =>
        `<div data-tip="${name}: ${rn(share, 1)}%" style="width: ${share}%; background: ${color}"></div>`
    )
    .join("");
  const legend = levels
    .filter(level => level.share >= 1)
    .map(
      ({ share, name, color }) =>
        `<span><span class="swatch" style="background: ${color}"></span>${name} ${rn(share)}%</span>`
    )
    .join("");
  return `<div><h4 data-tip="${t("Prosperity of townspeople and rural people, and the share of all people at each level")}">${t("Living standards")}</h4>
    ${group(t("Townspeople"), accounts.towns)}
    ${group(t("Rural people"), accounts.country)}
    <div class="stack" data-tip="${t("People by prosperity level")}">${stack}</div>
    <div class="legend">${legend}</div>
  </div>`;
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
