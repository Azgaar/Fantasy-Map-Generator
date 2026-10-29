import { DEMAND_CATEGORY_LABELS } from "@/data/id-labels";
import { EconomyDebug } from "@/model/economy/economy-debug";
import type { Good } from "@/model/economy/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS, Goods } from "@/model/economy/goods-generator";
import type { Deal, DealKind, SourceOption, Trade } from "@/model/economy/markets-generator";
import { DEAL_KINDS, Markets } from "@/model/economy/markets-generator";
import type { ProductionCandidate, ProductionLogEntry } from "@/model/economy/production-generator";
import { isDemandEntry, isMfgEntry, isTradeEntry } from "@/model/economy/production-generator";
import { Prosperity } from "@/model/economy/prosperity";
import { Icons } from "@/model/icons";
import { type Burg, Burgs } from "@/model/political/burgs-generator";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Csv } from "@/services/io/csv";
import { Dialog } from "@/ui/dialog/dialog";
import { zoomTo } from "@/ui/map/zoom";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { BADGE_COLORS, tone } from "./economy-config";
import { EconomyTerms } from "./economy-terms";
import { bindEconomyWiki, economyWikiButton } from "./economy-wiki";
import { prosperityTip, renderProsperity, renderProsperityParts } from "./prosperity-view";
import {
  carriageDistance,
  getTradeContext,
  money,
  splitDealPrice,
  tariffCell,
  tradeCellTips,
  tradeColumnTips
} from "./trade/deal-price";

type RowType = "LOCAL" | "BUY" | "MFG" | "SELL" | "KEEP" | "NEED";
type HistoryRow = {
  type: RowType;
  goodId: number;
  units: number;
  kind?: DealKind;
  marketId?: number;
  price?: number; // per unit, as the rest but the income: the goods' own price
  carriage: number;
  tax: number;
  tariff: number;
  income?: number;
  formula?: string; // the price split, adding up to the income
  details: string; // shown when the row expands, in the debug log only
  goodTip?: string; // shown on hovering the good
  label?: string; // in place of the good, on a row about no single good
};

let activeBurgId = 0;
const dialogId = "productionOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg" };
const goodName = (row: HistoryRow) => Goods.get(row.goodId)?.name ?? "";
const marketName = (row: HistoryRow) => {
  const market = Markets.get(row.marketId);
  return market ? Markets.getName(market) : "";
};

function open(burgId: number): void {
  void Icons.retry("goods");
  if (options.app.mode) return;

  const burg = pack.burgs[burgId];
  if (!burg || burg.removed) {
    tip(t("Invalid burg. The selected burg does not exist or was removed."), true, "error", 5000);
    return;
  }
  if (!Markets.ofBurg(burg)) {
    tip(sentences(t("No market"), t("This burg is not connected to any market")), true, "error", 5000);
    return;
  }
  if (!burg.production) {
    tip(t("No production data for this burg."), true, "error", 5000);
    return;
  }
  activeBurgId = burgId;

  renderDialog();
  render();

  Dialog.open(dialogId, {
    title: t("Economy Overview: {{- burg}}", { burg: burg.name }),
    width: "56em",
    resizable: true,
    onClose: () => Dialog.destroy(dialogId),
    position
  });
}

function renderDialog(): void {
  Dialog.destroy(dialogId);
  const html = /* html */ `<div id="${dialogId}" class="dialog stable">
      <style>
        #${dialogId} > div { width: auto }
        #${dialogId}Stats { margin-bottom: 0.85em; line-height: 1.6em }
        #${dialogId}Stats > div > span { margin-right: 0.6em }
        #${dialogId}Stats .oneLine { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
        #${dialogId}Stats .parts { color: #666 }
        #${dialogId}Treasury { width: 7em; margin-left: 0.2em }
        #${dialogId} .productionGood { display: inline-flex; align-items: center; gap: 0.2em; vertical-align: middle }
        #${dialogId} table { width: 100%; table-layout: fixed; border-collapse: collapse; line-height: 1 }
        #${dialogId} thead th { position: sticky; top: 0; background: #eee }
        #${dialogId} tbody tr { border-bottom: 1px solid #f0f0f0 }
        #${dialogId} th, #${dialogId} td { padding: 0.4em 0.5em; vertical-align: top; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
        #${dialogId} .right { text-align: right }
        #${dialogId} tr[data-expandable] { cursor: pointer }
        #${dialogId} .historyDetails td { padding: 0.3em 0.5em 0.8em; line-height: 1.4; white-space: normal }
        #${dialogId} .historyDetails ul { margin: 0.2em 0 0 1.1em; padding: 0 }
        #${dialogId} .typeBadge { margin-left: 4px; border-radius: 3px; padding: 0 0.4em; font-size: 0.8em; font-weight: bold; line-height: 1.35 }
        ${Object.entries(BADGE_COLORS)
          .map(
            ([kind, [background, color]]) =>
              `#${dialogId} .typeBadge.${kind} { background: ${background}; color: ${color} }`
          )
          .join("\n")}
        #${dialogId} .sources { border-collapse: collapse; margin: 0.3em 0; width: auto; table-layout: auto }
        #${dialogId} .sources td, #${dialogId} .sources th { padding: 0.1em 0.5em; border: 0 }
        #${dialogId} .sources .chosen { font-weight: bold; background: #eef6ee }
      </style>
      <div id="${dialogId}Stats"></div>
      <div id="${dialogId}Body" class="table"></div>
      <div id="${dialogId}Totals" class="totalLine"></div>
      <div id="${dialogId}Bottom">
        <button id="${dialogId}Refresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="${dialogId}Export" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
        ${economyWikiButton(`${dialogId}Wiki`)}
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl(`${dialogId}Refresh`).addEventListener("click", render);
  bindEconomyWiki(`${dialogId}Wiki`);
  ensureEl(`${dialogId}Export`).addEventListener("click", downloadHistoryCsv);
  ensureEl(`${dialogId}Body`).addEventListener("click", onBodyClick);
}

function onBodyClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const zoom = target.closest<HTMLElement>("[data-zoom-market]");
  if (zoom) {
    const center = pack.burgs[Markets.get(Number(zoom.dataset.zoomMarket))?.centerBurgId ?? 0];
    if (center?.i) zoomTo(center.x, center.y, 8, 2000);
    return;
  }

  const row = target.closest<HTMLElement>("tr[data-expandable]");
  const details = row?.nextElementSibling as HTMLElement | null;
  if (!row || !details) return;
  details.hidden = !details.hidden;
  row.querySelector(".icon-right-open, .icon-down-open")!.className = details.hidden
    ? "icon-right-open"
    : "icon-down-open";
}

/** The run in order: the debug log step by step, otherwise summed as local bonus, inputs, manufacturing, sales and demand fill */
function getHistoryRows(): HistoryRow[] {
  const burg = pack.burgs[activeBurgId];
  if (!burg?.production) return [];
  return EconomyDebug.get(burg.i!)?.map(getLogRow) ?? getSummaryRows(burg);
}

function getSummaryRows(burg: Burg): HistoryRow[] {
  const production = burg.production ?? [];
  const deals = pack.deals.filter(([dealBurg]) => dealBurg === burg.i);
  const isLocal = (goodId: number) => goodId === pack.cells.good[burg.cell] && !Goods.get(goodId)?.recipes?.length;
  const byValue = (a: Deal, b: Deal) => b[4] * b[5] - a[4] * a[5];
  const dealRows = (kind: DealKind) =>
    deals
      .filter(deal => deal[3] === kind)
      .toSorted(byValue)
      .map(([, marketId, goodId, , units, price, tax, tariff, carriage]) =>
        getTradeRow(goodId, marketId, kind, { units, price, tax, tariff, carriage })
      );

  // recipes the burg had every ingredient for: bought for production or made itself
  const hadGoods = new Set([
    ...deals.filter(deal => deal[3] === DEAL_KINDS.input).map(deal => deal[2]),
    ...production.map(([goodId]) => goodId)
  ]);
  const recipeInputs = (goodId: number) => {
    const recipes = Goods.get(goodId)?.recipes ?? [];
    const used = recipes.filter(recipe => Object.keys(recipe).every(id => hadGoods.has(+id)));
    return (used.length ? used : recipes)
      .map(recipe =>
        Object.keys(recipe)
          .map(id => Goods.get(+id)?.name ?? "")
          .join(` ${t("and")} `)
      )
      .join(" / ");
  };

  return [
    ...production.filter(([goodId]) => isLocal(goodId)).map(([goodId, units]) => getLocalRow(goodId, units)),
    ...dealRows(DEAL_KINDS.input),
    ...production
      .filter(([goodId]) => !isLocal(goodId))
      .toSorted((a, b) => b[1] - a[1])
      .map(([goodId, units]) => ({
        ...getMfgRow(goodId, units),
        goodTip: t("Manufacturing from {{- inputs}}", { inputs: recipeInputs(goodId) })
      })),
    ...dealRows(DEAL_KINDS.sale),
    ...dealRows(DEAL_KINDS.kept),
    ...dealRows(DEAL_KINDS.demand)
  ];
}

function getLogRow(entry: ProductionLogEntry): HistoryRow {
  if (isDemandEntry(entry)) return getNeedRow(entry);
  if (isTradeEntry(entry)) {
    const row = getTradeRow(entry.goodId, entry.market, entry.kind, entry);
    return entry.sources ? { ...row, details: renderSources(entry.market, entry.sources) } : row;
  }
  if (!isMfgEntry(entry)) return getLocalRow(entry.goodId, entry.units);

  const inputs = entry.recipe.map(item => `${rn(item.units, 2)} ${goodDot(item.goodId)}`).join(` ${t("and")} `);
  const modifier = entry.cultureModifier ?? 1;
  const modifierNote = modifier !== 1 ? `. ${t("Production multiplier")}: x${rn(modifier, 2)}` : "";
  const specializationNote = entry.specialization ? `. ${t("Division of labor bonus")}: x${entry.specialization}` : "";
  return {
    ...getMfgRow(entry.goodId, entry.units),
    details: `${t("Manufacturing from {{- inputs}}", { inputs })}${modifierNote}${specializationNote}${renderDecision(entry.candidates)}`
  };
}

const getLocalRow = (goodId: number, units: number): HistoryRow => ({
  type: "LOCAL",
  goodId,
  units,
  tax: 0,
  tariff: 0,
  carriage: 0,
  details: ""
});

const getMfgRow = (goodId: number, units: number): HistoryRow => ({
  type: "MFG",
  goodId,
  units,
  tax: 0,
  tariff: 0,
  carriage: 0,
  details: ""
});

function getTradeRow(goodId: number, marketId: number, kind: DealKind, trade: Trade): HistoryRow {
  if (kind === DEAL_KINDS.kept) return getKeepRow(goodId, trade.units);
  const isSale = kind === DEAL_KINDS.sale;
  const { units } = trade;
  const { goodsPrice, carriage, tax, tariff, value, formula } = splitDealPrice(trade, isSale);
  return {
    type: isSale ? "SELL" : "BUY",
    goodId,
    units,
    kind,
    price: goodsPrice,
    marketId,
    tax,
    tariff,
    carriage,
    income: isSale ? value : -value,
    formula,
    details: ""
  };
}

// nothing changes hands, so no prices
const getKeepRow = (goodId: number, units: number): HistoryRow => ({
  type: "KEEP",
  goodId,
  units,
  kind: DEAL_KINDS.kept,
  tax: 0,
  tariff: 0,
  carriage: 0,
  details: ""
});

function renderDecision(candidates: readonly ProductionCandidate[]): string {
  if (!candidates.length) return "";
  const score = (value: number) => `<b class="positive">${t("score {{score}}", { score: rn(value, 2) })}</b>`;
  const items = candidates
    .toSorted((a, b) => b.score - a.score)
    .map(candidate => {
      const name = Goods.get(candidate.goodId)?.name ?? "";
      const ingredients = candidate.ingredients
        .map(ingredient => `${rn(ingredient.amount * candidate.units, 2)} ${goodDot(ingredient.goodId)}`)
        .join(", ");
      const prep = candidate.isPreparation
        ? ` (${t("prep for {{- good}}", { good: goodDot(candidate.goalGoodId ?? -1) })})`
        : "";
      const workers = rn(candidate.workersNeeded || 1, 2);
      const formula = candidate.isPreparation
        ? `${t("goal sell")} ${formatPrice((candidate.gainPerWorker || 0) * workers)} ÷ ${t("workers")} ${workers} × ${t("units")} ${rn(candidate.units, 2)}`
        : `${t("sell")} ${formatPrice(candidate.sellPrice)} - ${t("cost")} ${formatPrice(candidate.ingredientCost)}`;
      return `<li><b>${name}</b>${prep}: ${formula} = ${score(candidate.score)}. ${t("Ingredients")}: ${ingredients}</li>`;
    });
  const basis = t("highest score among feasible options ({{options}})", { options: candidates.length });
  return `<div><b>${t("Decision basis")}:</b> ${basis}:</div><ul>${items.join("")}</ul>`;
}

function goodDot(goodId: number): string {
  const good = Goods.get(goodId);
  return good ? `<svg width="14" height="14" style="margin: -6px 2px -4px 0">${goodBadge(good)}</svg>` : "";
}

function render(): void {
  const burg = pack.burgs[activeBurgId];
  if (!burg) return;

  renderStats(burg);
  const tips = tradeColumnTips();
  const historyRows = getHistoryRows();
  const expandable = historyRows.some(row => row.details);
  const rows = historyRows.map(row => renderHistoryLine(row, expandable));
  renderTotals(historyRows);
  ensureEl(`${dialogId}Body`).innerHTML = rows.length
    ? /* html */ `<table>
        <colgroup>
          ${expandable ? '<col style="width: 2%" />' : ""}
          <col style="width: ${expandable ? 22 : 24}%" />
          <col style="width: 13%" />
          <col style="width: 13%" />
          <col style="width: 10%" />
          <col style="width: 9%" />
          <col style="width: 9%" />
          <col style="width: 8%" />
          <col style="width: 12%" />
        </colgroup>
        <thead>
          <tr>
            ${expandable ? "<th></th>" : ""}
            <th>${t("Good")}</th>
            <th>${t("Market")}</th>
            <th class="right" data-tip="${tips.net}">${t("Net")}</th>
            <th class="right" data-tip="${tips.carriage}">${t("Carriage")}</th>
            <th class="right" data-tip="${tips.tax}">${t("Tax")}</th>
            <th class="right" data-tip="${tips.tariff}">${t("Tariff")}</th>
            <th class="right" data-tip="${tips.units}">${t("Units")}</th>
            <th class="right" data-tip="${tips.income}">${t("Income")}</th>
          </tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>`
    : `<i>${t("No production actions recorded")}</i>`;
}

type DemandEntry = Extract<ProductionLogEntry, { category: number }>;

// a category the burg came to cover: its shortage and every good it could cover it with
const getNeedRow = ({ category, shortage, options }: DemandEntry): HistoryRow => {
  const name = DEMAND_PRIORITY[category];
  return {
    type: "NEED",
    goodId: -1,
    units: shortage,
    tax: 0,
    tariff: 0,
    carriage: 0,
    label: `${DEMAND_CATEGORY_ICONS[name]} ${DEMAND_CATEGORY_LABELS[name]}`,
    details: renderDemandOptions(options)
  };
};

function renderDemandOptions(options: DemandEntry["options"]): string {
  if (!options.length) return `<i>${t("No good that covers it is for sale anywhere")}</i>`;
  const own = pack.cells.market[pack.burgs[activeBurgId]?.cell];
  const items = options.slice(0, 10).map(({ goodId, coverage, costPerCoverage, market, kept }) => {
    const where = kept
      ? t("kept from its own sales")
      : market === own
        ? t("from its own market")
        : t("from {{- market}}", { market: Markets.getName(Markets.get(market)!) });
    const per = coverage === 1 ? "" : ` (${t("{{coverage}} per unit", { coverage: rn(coverage, 2) })})`;
    return `<li>${goodDot(goodId)}${Goods.get(goodId)?.name}: ${formatPrice(costPerCoverage)} ${t("per covered need")}${per}, ${where}</li>`;
  });
  const more = options.length > 10 ? `<li>${t("and {{count}} more", { count: options.length - 10 })}</li>` : "";
  return `<div>${t("Goods that could cover the need")}:</div><ul>${items.join("")}${more}</ul>`;
}

/** Every market the burg could have bought the good from, at its door, with the one it chose */
function renderSources(chosen: number, sources: SourceOption[]): string {
  const own = pack.cells.market[pack.burgs[activeBurgId]?.cell];
  const reason = chosen === own ? t("Bought at its own market") : t("Bought from the cheapest other market");
  const open = sources.filter(source => !source.excluded);
  const shown = open.slice(0, 6);
  const picked = open.find(source => source.market === chosen);
  if (picked && !shown.includes(picked)) shown.push(picked);

  const name = (market: number) => {
    const label = Markets.getName(Markets.get(market)!);
    return market === own ? `${label} (${t("own")})` : label;
  };
  const rows = shown.map(
    source => /* html */ `<tr${source.market === chosen ? ' class="chosen"' : ""}>
      <td>${name(source.market)}</td>
      <td class="right">${source.stock}</td>
      <td class="right">${formatPrice(source.price)}</td>
      <td class="right">${formatPrice(source.tax)}</td>
      <td class="right">${tariffCell(source.tariff, source.isImport)}</td>
      <td class="right">${formatPrice(source.carriage)}</td>
      <td class="right">${formatPrice(source.buyPrice)}</td>
    </tr>`
  );
  const count = (reason: SourceOption["excluded"]) => sources.filter(source => source.excluded === reason).length;
  const [none, unreachable, embargoed] = [count("stock"), count("route"), count("embargo")];
  const excluded = [
    none && t("{{count}} have none", { count: none }),
    unreachable && t("{{count}} have no route to the burg", { count: unreachable }),
    embargoed && t("{{count}} are under embargo", { count: embargoed })
  ].filter(Boolean);

  return /* html */ `<div>${reason}.</div>
    <table class="sources">
      <thead><tr><th>${t("Market")}</th><th class="right">${t("Stock")}</th><th class="right">${t("Price")}</th><th class="right">${t("Tax")}</th><th class="right">${t("Tariff")}</th><th class="right">${t("Carriage")}</th><th class="right">${t("At the door")}</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>
    ${excluded.length ? `<div>${t("Other markets")}: ${excluded.join(", ")}</div>` : ""}`;
}

const TYPE_LABELS: Record<RowType, () => string> = {
  LOCAL: () => t("Local").toUpperCase(),
  BUY: () => t("BUY"),
  MFG: () => t("MFG"),
  SELL: () => t("sell").toUpperCase(),
  KEEP: () => t("Keep").toUpperCase(),
  NEED: () => t("Need").toUpperCase()
};

function renderHistoryLine(row: HistoryRow, expandable: boolean): string {
  if (row.label) return renderLabelLine(row, expandable);
  const good = Goods.get(row.goodId);
  if (!good) return "";

  const purposes = [
    t("Sale to local market"),
    t("Purchase for production"),
    t("Purchase for demand"),
    t("Produced locally and kept to cover the burg's demand")
  ];
  const purpose =
    row.kind !== undefined ? purposes[row.kind] : row.type === "MFG" ? t("Manufacturing step") : t("Local production");
  const covers = row.kind === DEAL_KINDS.demand || row.kind === DEAL_KINDS.kept ? renderCoverage(good, row.units) : "";
  const typeTip = covers ? sentences(purpose, t("Covers demand: {{- demand}}", { demand: covers })) : purpose;
  const badge = `<span class="typeBadge ${row.type.toLowerCase()}">${TYPE_LABELS[row.type]()}</span>`;

  // per unit; green adds to the burg's money, the negative color takes from it
  const isSale = row.type === "SELL";
  const isTrade = row.price !== undefined;
  const income = row.income === undefined ? "" : formatPrice(row.income);
  const context = isTrade ? getContext(row) : undefined;
  const tips = context && tradeCellTips({ ...getFigures(row), good, ...context });
  const cell = (content: string, tip?: string) => `<td class="right"${tip ? ` data-tip="${tip}"` : ""}>${content}</td>`;

  return /* html */ `<tr${row.details ? " data-expandable" : ""}>
      ${expandable ? `<td>${row.details ? '<span class="icon-right-open"></span>' : ""}</td>` : ""}
      <td data-tip="${row.goodTip ?? typeTip}">${goodDot(row.goodId)}${good.name}${badge}</td>
      <td>${renderMarket(row)}</td>
      ${cell(isTrade ? money(row.price!, isSale) : "", tips?.net)}
      ${cell(isTrade ? money(row.carriage, false) || formatPrice(0) : "", tips?.carriage)}
      ${cell(money(row.tax, false), tips?.tax)}
      ${cell(context ? tariffCell(row.tariff, context.isImport) : "", tips?.tariff)}
      ${cell(String(rn(row.units, 2)), tips?.units)}
      <td class="right ${tone(row.income ?? 0)}" data-tip="${tips?.income ?? ""}">${income}</td>
    </tr>${row.details ? `<tr class="historyDetails" hidden><td></td><td colspan="8">${row.details}</td></tr>` : ""}`;
}

// a row about no single good: only the label, the units and the details
function renderLabelLine(row: HistoryRow, expandable: boolean): string {
  const tip = t("A need the burg covered. Expand for options");
  const badge = `<span class="typeBadge ${row.type.toLowerCase()}">${TYPE_LABELS[row.type]()}</span>`;
  return /* html */ `<tr${row.details ? " data-expandable" : ""}>
      ${expandable ? `<td>${row.details ? '<span class="icon-right-open"></span>' : ""}</td>` : ""}
      <td data-tip="${tip}">${row.label}${badge}</td>
      <td></td><td></td><td></td><td></td><td></td>
      <td class="right">${rn(row.units, 2)}</td>
      <td></td>
    </tr>${row.details ? `<tr class="historyDetails" hidden><td></td><td colspan="8">${row.details}</td></tr>` : ""}`;
}

/** The demand categories the good's units cover, e.g. "🍖 food 2.14, 💎 luxury 0.5" */
function renderCoverage(good: Good, units: number): string {
  return DEMAND_PRIORITY.flatMap(category => {
    const share = good.demandCoverage?.[category] || 0;
    if (!share) return [];
    return `${DEMAND_CATEGORY_ICONS[category]} ${DEMAND_CATEGORY_LABELS[category]} ${rn(units * share, 2)}`;
  }).join(", ");
}

/** Sums of the run's trades in money: what the burg paid and got, and the carriage and taxes inside */
function renderTotals(rows: HistoryRow[]): void {
  const sum = (pick: (row: HistoryRow) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const purchases = -sum(row => (row.type === "BUY" ? (row.income ?? 0) : 0));
  const sales = sum(row => (row.type === "SELL" ? (row.income ?? 0) : 0));
  const income = sales - purchases;
  const total = (label: string, tip: string, amount: string) =>
    `<div style="margin-left: 12px" data-tip="${tip}">${label}: ${amount}</div>`;

  ensureEl(`${dialogId}Totals`).innerHTML = [
    total(
      t("Purchases"),
      t("Paid for goods bought, carriage and taxes included"),
      money(purchases, false) || formatPrice(0)
    ),
    total(t("Sales"), t("Got for goods sold, carriage and sales tax taken off"), money(sales, true) || formatPrice(0)),
    total(
      t("Carriage"),
      t("Carriage paid in all"),
      formatPrice(
        rn(
          sum(row => row.carriage * row.units),
          2
        )
      )
    ),
    total(
      t("Tax"),
      t("Sales tax paid in all"),
      formatPrice(
        rn(
          sum(row => row.tax * row.units),
          2
        )
      )
    ),
    total(
      t("Tariff"),
      t("Import tariffs paid in all"),
      formatPrice(
        rn(
          sum(row => row.tariff * row.units),
          2
        )
      )
    ),
    total(t("Income"), tradeColumnTips().income, `<span class="${tone(income)}">${formatPrice(rn(income, 2))}</span>`)
  ].join("");
}

function renderMarket(row: HistoryRow): string {
  const { marketId } = row;
  const market = Markets.get(marketId);
  if (!market) return "";
  const name = Markets.getName(market);
  const { decimas, isImport } = getContext(row);
  const distance = carriageDistance(decimas);
  const zoomTip = isImport
    ? sentences(t("Import from {{market}}", { market: name }), distance, t("Click to zoom"))
    : sentences(distance, t("Click to zoom"));
  return `<span class="pointer" data-zoom-market="${marketId}" data-tip="${zoomTip}">${name}</span>`;
}

const getContext = ({ goodId, marketId = 0, kind = DEAL_KINDS.sale }: HistoryRow) =>
  getTradeContext(activeBurgId, marketId, goodId, kind);

const getFigures = ({ units, price, carriage, tax, tariff, formula }: HistoryRow) => ({
  units,
  net: price ?? 0,
  carriage,
  tax,
  tariff,
  formula: formula ?? ""
});

function renderStats(burg: Burg): void {
  const population = burg.population || 0;
  const burgs = pack.burgs.filter(b => b.i && !b.removed).sort((a, b) => (b.population || 0) - (a.population || 0));
  const market = Markets.ofBurg(burg);

  const targets = DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  const covered = DEMAND_PRIORITY.map(() => 0);
  const consumption = Prosperity.getConsumption(burg.i!);
  consumption.forEach((units, goodId) => {
    const coverage = Goods.get(goodId)?.demandCoverage ?? {};
    DEMAND_PRIORITY.forEach((category, index) => {
      covered[index] += units * (coverage[category] || 0);
    });
  });
  const living = Prosperity.getBurg(burg.i!);

  const product = Math.max(0, burg.product || 0);
  const wealth = population > 0 ? product / population : 0;
  const treasury = burg.treasury || 0;
  // a market center's merchants take the margin on every trade at its market, so its treasury is more than its deals
  const isCenter = market?.centerBurgId === burg.i;
  const margin = isCenter
    ? pack.deals.reduce((sum, deal) => sum + (deal[1] === market.i ? Markets.getMargin(deal) : 0), 0) +
      (market.rural?.margin || 0)
    : 0;
  const treasuryTip = isCenter
    ? sentences(EconomyTerms.treasury(), t("As its market's center, it also takes the market margin"))
    : EconomyTerms.treasury();

  ensureEl(`${dialogId}Stats`).innerHTML = /* html */ `
    <div>
      <span><b>${t("Population")}:</b> ${population}</span>
      ${EconomyDebug.get(burg.i!) ? `<span><b>${t("Order")}:</b> ${t("{{rank}} of {{total}}", { rank: burgs.indexOf(burg) + 1, total: burgs.length })}</span>` : ""}
      <span><b>${t("Market")}:</b> ${market ? Markets.getName(market) : ""}</span>
    </div>
    <div data-tip="${t("Production: goods the burg made today, units a day")}"><b>${t("Production")}:</b> ${renderGoods(burg.production ?? []) || t("None")}</div>
    <div data-tip="${t("Consumption: goods the people bought or kept")}"><b>${t("Consumption")}:</b> ${renderGoods(consumption.flatMap((units, goodId) => (units ? [[goodId, units] as [number, number]] : []))) || t("None")}</div>
    <div data-tip="${t("Demand: needs covered, plus wants")}"><b>${t("Demand")}:</b> ${renderDemand(covered, targets)}</div>
    ${living ? `<div class="oneLine" data-tip="${prosperityTip(living.prosperity)}"><b>${t("Prosperity")}:</b> ${renderProsperity(living.prosperity)} <span class="parts">(${renderProsperityParts(living)})</span></div>` : ""}
    <div>
      <span data-tip="${EconomyTerms.product()}"><b>${t("Product")}:</b> <span class="positive">${formatPrice(product)}</span></span>
      <span data-tip="${EconomyTerms.wealth()}"><b>${t("Wealth")}:</b> <span class="positive">${formatPrice(wealth)}</span></span>
      ${isCenter && market.feePaid ? `<span data-tip="${t("The license its state charges a market's center a day")}"><b>${t("Market License")}:</b> <span class="negative">${formatPrice(market.feePaid)}</span></span>` : ""}
      ${isCenter ? `<span data-tip="${t("Market margin: {{rate}}% of every trade at its market", { rate: rn(Markets.getMarginRate(market) * 100, 1) })}"><b>${t("Market margin")}:</b> <span class="positive">${formatPrice(margin)}</span></span>` : ""}
      ${burg.pollTaxPaid ? `<span data-tip="${t("Poll tax: {{rate}} a head", { rate: pack.states[burg.state || 0]?.economy.pollTax || 0 })}"><b>${t("Poll Tax")}:</b> ${formatPrice(burg.pollTaxPaid)}</span>` : ""}
      <span data-tip="${sentences(treasuryTip, t("Type to change. It lasts until the economy is regenerated"))}"><b><label for="${dialogId}Treasury">${t("Treasury")}</label>:</b> 🟡<input id="${dialogId}Treasury" type="number" step="0.01" value="${rn(treasury, 2)}" /></span>
    </div>`;
  ensureEl<HTMLInputElement>(`${dialogId}Treasury`).addEventListener("change", function () {
    if (Number.isFinite(this.valueAsNumber)) Burgs.setTreasury(burg.i!, this.valueAsNumber);
  });
}

function renderDemand(covered: number[], targets: number[]): string {
  return DEMAND_PRIORITY.map((category, index) => {
    const target = rn(targets[index] || 0, 2);
    const met = rn(Math.min(covered[index] || 0, target), 2);
    const wants = rn(Math.max(0, (covered[index] || 0) - target), 2);
    const tip = `${DEMAND_CATEGORY_LABELS[category]}: ${t("{{covered}} of {{target}} needed", { covered: met, target })}${wants ? `, ${t("{{wants}} more as wants", { wants })}` : ""}`;
    const extra = wants ? ` <span class="positive">+${wants}</span>` : "";
    return `<span data-tip="${tip}">${DEMAND_CATEGORY_ICONS[category]} <span class="${met < target ? "negative" : ""}">${met}</span>/${target}${extra}</span>`;
  }).join(" • ");
}

const SHOWN_GOODS = 8; // the rest are listed on hover

/** Goods as the goods layer's badges with units a day, the most valuable first */
function renderGoods(goods: [goodId: number, units: number][]): string {
  const sorted = goods
    .flatMap(([goodId, units]) => {
      const good = Goods.get(goodId);
      return good ? [{ good, amount: rn(units, 2) }] : [];
    })
    .sort((a, b) => b.amount * b.good.value - a.amount * a.good.value);
  const describe = ({ good, amount }: (typeof sorted)[number]) =>
    t("{{good}}: {{amount}} {{unit}} per day", {
      good: good.name,
      amount,
      unit: amount === 1 ? good.unit : `${good.unit}s`
    });
  const shown = sorted
    .slice(0, SHOWN_GOODS)
    .map(
      item =>
        `<span class="productionGood" data-tip="${describe(item)}"><svg width="1.6em" height="1.6em">${goodBadge(item.good)}</svg>${item.amount}</span>`
    )
    .join(" ");
  const rest = sorted.slice(SHOWN_GOODS);
  return rest.length ? `${shown} +${t("{{count}} more", { count: rest.length })}` : shown;
}

function downloadHistoryCsv(): void {
  const perUnit = (amount: number) => (rn(amount, 2) ? rn(amount, 2) : "");
  const rows = getHistoryRows().map(row => [
    goodName(row),
    row.type,
    marketName(row),
    row.price === undefined ? "" : rn(row.price, 2),
    perUnit(row.carriage),
    perUnit(row.tax),
    perUnit(row.tariff),
    rn(row.units, 2),
    row.income === undefined ? "" : rn(row.income, 2)
  ]);
  const name = pack.burgs[activeBurgId]?.name ?? activeBurgId;
  const headers = ["Good", "Type", "Market", "Net Unit Price", "Carriage", "Tax", "Tariff", "Units", "Income"];
  Csv.download(`Production_${name}`, headers, rows);
}

export const ProductionOverview = { open };
