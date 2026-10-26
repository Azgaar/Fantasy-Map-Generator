import { DEMAND_CATEGORY_LABELS } from "@/data/id-labels";
import type { Good } from "@/model/economy/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS, Goods } from "@/model/economy/goods-generator";
import type { Deal, DealKind, Trade } from "@/model/economy/markets-generator";
import { DEAL_KINDS, Markets } from "@/model/economy/markets-generator";
import type { ProductionCandidate, ProductionLogEntry } from "@/model/economy/production-generator";
import { isMfgEntry, isTradeEntry } from "@/model/economy/production-generator";
import { Icons } from "@/model/icons";
import type { Burg } from "@/model/political/burgs-generator";
import { formatPrice } from "@/model/units";
import { goodBadge } from "@/renderers/draw-goods";
import { Csv } from "@/services/io/csv";
import { Dialog } from "@/ui/dialog/dialog";
import { zoomTo } from "@/ui/map/zoom";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { money, splitDealPrice, tradeCellTips, tradeColumnTips } from "./trade/deal-price";

type RowType = "LOCAL" | "BUY" | "MFG" | "SELL";
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
  details: string; // shown when the row expands
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
  if (!Markets.get(burg.market)) {
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
    title: t("Production Overview: {{- burg}}", { burg: burg.name }),
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
        #${dialogId} .typeBadge.local { background: #d9e7f5; color: #346 }
        #${dialogId} .typeBadge.buy { background: #f5d9d6; color: #a33 }
        #${dialogId} .typeBadge.mfg { background: #f8e7bf; color: #b67a00 }
        #${dialogId} .typeBadge.sell { background: #dff0e2; color: #2f8a46 }
        #${dialogId} .positive { color: #2a6 }
        #${dialogId} .negative { color: #c84 }
      </style>
      <div id="${dialogId}Stats"></div>
      <div id="${dialogId}Body" class="table"></div>
      <div id="${dialogId}Bottom">
        <button id="${dialogId}Refresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="${dialogId}Export" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl(`${dialogId}Refresh`).addEventListener("click", render);
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
  return burg.productionLog?.map(getLogRow) ?? getSummaryRows(burg);
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
          .map(id => goodDot(+id))
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
      .map(([goodId, units]) => getMfgRow(goodId, units, recipeInputs(goodId))),
    ...dealRows(DEAL_KINDS.sale),
    ...dealRows(DEAL_KINDS.demand)
  ];
}

function getLogRow(entry: ProductionLogEntry): HistoryRow {
  if (isTradeEntry(entry)) return getTradeRow(entry.goodId, entry.market, entry.kind, entry);
  if (!isMfgEntry(entry)) return getLocalRow(entry.goodId, entry.units);

  const inputs = entry.recipe.map(item => `${rn(item.units, 2)} ${goodDot(item.goodId)}`).join(` ${t("and")} `);
  const modifier = entry.cultureModifier ?? 1;
  const modifierNote =
    modifier !== 1
      ? `. ${t("Culture type production modifier. Produced units are multiplied by this value.")}: x${rn(modifier, 2)}`
      : "";
  return getMfgRow(entry.goodId, entry.units, inputs, `${modifierNote}${renderDecision(entry.candidates)}`);
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

const getMfgRow = (goodId: number, units: number, inputs: string, more = ""): HistoryRow => ({
  type: "MFG",
  goodId,
  units,
  tax: 0,
  tariff: 0,
  carriage: 0,
  details: `${t("Manufacturing from {{- inputs}}", { inputs })}${more}`
});

function getTradeRow(goodId: number, marketId: number, kind: DealKind, trade: Trade): HistoryRow {
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
  const rows = getHistoryRows().map(renderHistoryLine);
  ensureEl(`${dialogId}Body`).innerHTML = rows.length
    ? /* html */ `<table>
        <colgroup>
          <col style="width: 2%" />
          <col style="width: 22%" />
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
            <th></th>
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

const TYPE_LABELS: Record<RowType, () => string> = {
  LOCAL: () => t("Local").toUpperCase(),
  BUY: () => t("BUY"),
  MFG: () => t("MFG"),
  SELL: () => t("sell").toUpperCase()
};

function renderHistoryLine(row: HistoryRow): string {
  const good = Goods.get(row.goodId);
  if (!good) return "";

  const purposes = [t("Sale to local market"), t("Purchase for production"), t("Purchase for demand")];
  const typeTip =
    row.kind !== undefined ? purposes[row.kind] : row.type === "MFG" ? t("Manufacturing step") : t("Local production");
  const badge = `<span class="typeBadge ${row.type.toLowerCase()}" data-tip="${typeTip}">${TYPE_LABELS[row.type]()}</span>`;

  // per unit; green adds to the burg's money, the negative color takes from it
  const isSale = row.type === "SELL";
  const isTrade = row.price !== undefined;
  const income = row.income === undefined ? "" : formatPrice(row.income);
  const tips = isTrade ? getCellTips(row, good) : undefined;
  const cell = (content: string, tip?: string) => `<td class="right"${tip ? ` data-tip="${tip}"` : ""}>${content}</td>`;

  return /* html */ `<tr${row.details ? " data-expandable" : ""}>
      <td>${row.details ? '<span class="icon-right-open"></span>' : ""}</td>
      <td>${goodDot(row.goodId)}${good.name}${badge}</td>
      <td>${renderMarket(row.marketId)}</td>
      ${cell(isTrade ? money(row.price!, isSale) : "", tips?.net)}
      ${cell(isTrade ? money(row.carriage, false) || formatPrice(0) : "", tips?.carriage)}
      ${cell(money(row.tax, false), tips?.tax)}
      ${cell(money(row.tariff, false), tips?.tariff)}
      ${cell(String(rn(row.units, 2)), tips?.units)}
      <td class="right ${(row.income ?? 0) >= 0 ? "positive" : "negative"}" data-tip="${tips?.income ?? ""}">${income}</td>
    </tr>${row.details ? `<tr class="historyDetails" hidden><td></td><td colspan="8">${row.details}</td></tr>` : ""}`;
}

function renderMarket(marketId: number | undefined): string {
  const market = Markets.get(marketId);
  if (!market) return "";
  const name = Markets.getName(market);
  const isImport = marketId !== pack.burgs[activeBurgId]?.market;
  const zoomTip = isImport
    ? sentences(t("Import from {{market}}", { market: name }), t("Click to zoom"))
    : t("Click to zoom");
  return `<span class="pointer" data-zoom-market="${marketId}" data-tip="${zoomTip}">${name}</span>`;
}

function getCellTips(row: HistoryRow, good: Good) {
  const { goodId, marketId = 0, kind = DEAL_KINDS.sale } = row;
  const { taxState, tariffState } = Markets.getTaxStates([activeBurgId, marketId, goodId, kind, 0, 0, 0, 0, 0]);
  return tradeCellTips({
    good,
    units: row.units,
    net: row.price ?? 0,
    carriage: row.carriage,
    tax: row.tax,
    tariff: row.tariff,
    income: row.income ?? 0,
    taxStateId: taxState,
    tariffStateId: tariffState,
    formula: row.formula ?? ""
  });
}

function renderStats(burg: Burg): void {
  const population = burg.population || 0;
  const burgs = pack.burgs.filter(b => b.i && !b.removed).sort((a, b) => (b.population || 0) - (a.population || 0));
  const market = Markets.get(burg.market);

  const targets = DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  const covered = DEMAND_PRIORITY.map(() => 0);
  let totalTax = 0;
  for (const [dealBurg, , goodId, kind, units, , tax, tariff] of pack.deals) {
    if (dealBurg !== burg.i) continue;
    totalTax += tax + tariff;
    if (kind !== DEAL_KINDS.demand) continue;
    const coverage = Goods.get(goodId)?.demandCoverage ?? {};
    DEMAND_PRIORITY.forEach((category, index) => {
      covered[index] += units * (coverage[category] || 0);
    });
  }
  const uncovered = targets.map((target, index) => Math.max(0, target - covered[index]));

  const product = Math.max(0, burg.product || 0);
  const wealth = population > 0 ? product / population : 0;
  const treasury = burg.treasury || 0;

  ensureEl(`${dialogId}Stats`).innerHTML = /* html */ `
    <div>
      <span><b>${t("Population")}:</b> ${population}</span>
      <span><b>${t("Order")}:</b> ${t("{{rank}} of {{total}}", { rank: burgs.indexOf(burg) + 1, total: burgs.length })}</span>
      <span><b>${t("Market")}:</b> ${market ? Markets.getName(market) : ""}</span>
    </div>
    <div><b>${t("Initial Demand")}:</b> ${renderDemand(targets)}</div>
    <div><b>${t("Uncovered Demand")}:</b> ${renderDemand(uncovered, true) || t("None")}</div>
    <div><b>${t("Production")}:</b> ${renderProduction(burg) || t("None")}</div>
    <div>
      <span data-tip="${t("Gross Product: local sale revenue minus purchased ingredient costs during the production.")}"><b>${t("Product")}:</b> <span class="positive">${formatPrice(product)}</span></span>
      <span data-tip="${t("Product per capita: gross product divided by population.")}"><b>${t("Wealth")}:</b> <span class="positive">${formatPrice(wealth)}</span></span>
      <span data-tip="${t("Sales tax and tariffs the burg paid: on its sales, deducted from the revenue; on its purchases, included in the price. Each goes to the treasury of the state that levies it")}"><b>${t("Total Tax")}:</b> <span class="negative">${formatPrice(totalTax)}</span></span>
      <span data-tip="${t("Net burg treasury after local buying, local sales, and final local demand fill.")}"><b>${t("Treasury")}:</b> <span class="${treasury >= 0 ? "positive" : "negative"}">${formatPrice(treasury)}</span></span>
    </div>`;
}

function renderDemand(values: number[], onlyShortage = false): string {
  return DEMAND_PRIORITY.flatMap((category, index) => {
    const value = rn(values[index] || 0, 2);
    if (onlyShortage && value <= 0) return [];
    return `<span data-tip="${DEMAND_CATEGORY_LABELS[category]}">${DEMAND_CATEGORY_ICONS[category]} ${value}</span>`;
  }).join(" • ");
}

// as in the Burg Editor, with the goods-layer badges
function renderProduction(burg: Burg): string {
  return (burg.production ?? [])
    .toSorted((a, b) => b[1] - a[1])
    .map(([goodId, units]) => {
      const good = Goods.get(goodId);
      if (!good) return "";
      const unit = units === 1 ? good.unit : `${good.unit}s`;
      const goodTip = t("{{good}}: {{amount}} {{unit}} per day", { good: good.name, amount: units, unit });
      return `<span class="productionGood" data-tip="${goodTip}"><svg width="1.6em" height="1.6em">${goodBadge(good)}</svg>${rn(units, 2)}</span>`;
    })
    .join(" ");
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
