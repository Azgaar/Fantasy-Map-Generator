import type {Burg} from "../modules/burgs-generator";
import type {DemandCategory} from "../modules/goods-generator";
import {DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "../modules/goods-generator";
import type {DecisionCandidate, DemandEffect} from "../modules/production-generator";
import type {Deal} from "../modules/trade-generator";
import {rn} from "../utils";

type Type = "RAW" | "MFG" | "BUY" | "SELL";

export function open(burgId: number): void {
  const burg = pack.burgs[burgId];
  if (!burg || burg.removed) {
    tip("Invalid burg. The selected burg does not exist or was removed.", true, "error", 5000);
    return;
  }

  const market = Trade.getMarketForBurg(burg);
  if (!market) {
    tip("No market. This burg is not connected to any market.", true, "error", 5000);
    return;
  }

  const data = Production.getProductionData(burgId);
  if (!data) {
    tip("No production data for this burg.", true, "error", 5000);
    return;
  }

  const getDealSpent = (deal: Deal) => deal.units * deal.prices.consumerBuy;
  const getDealTax = (deal: Deal) => deal.units * (deal.prices.consumerBuy - deal.prices.marketBuy);
  const getDealRevenue = (deal: Deal) => deal.units * deal.prices.marketSell;
  const getDealSalesTaxPerUnit = (deal: Deal) =>
    Math.max(0, (deal.prices.consumerBuy || 0) - (deal.prices.marketBuy || 0));

  const {productionBuyDeals, burgSaleDeals, demandFillDeals} = (pack.deals || []).reduce(
    (acc, deal) => {
      const {phase, buyerId, sellerId} = deal;
      if (phase === "local-production-buy" && buyerId === burgId) {
        acc.productionBuyDeals.push(deal);
      } else if (phase === "local-sale" && sellerId === burgId) {
        acc.burgSaleDeals.push(deal);
      } else if (phase === "local-demand-buy" && buyerId === burgId) {
        acc.demandFillDeals.push(deal);
      }
      return acc;
    },
    {productionBuyDeals: [] as Deal[], burgSaleDeals: [] as Deal[], demandFillDeals: [] as Deal[]}
  );

  const styles = {
    muted: "color:#777",
    subtle: "color:#999",
    divider: "color:#bbb",
    positive: "color:#2a6",
    negative: "color:#c44",
    warning: "color:#c84",
    sectionTitle: "font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.3em;margin-bottom:.45em",
    topBar: "margin-bottom:.85em;display:flex;flex-wrap:wrap;column-gap:.85em;align-items: center",
    table: "width:100%;table-layout:fixed;border-collapse:collapse;line-height:1",
    headRow: "background:#eee",
    bodyRow: "border-bottom:1px solid #f0f0f0",
    cell: "padding:.4em .5em;vertical-align:top",
    cellRight: "padding:.4em .5em;vertical-align:top;text-align:right",
    detailsCell: "padding:0.5em 0.5em 1em;",
    empty: "color:#888;font-style:italic",
    summaryBar: "display:flex;margin-top:.6em;justify-content:space-between;padding:0 .5em;gap:1em;flex-wrap:wrap"
  };

  const goodName = (id: number) => Goods.get(id)?.name ?? `#${id}`;

  const goodDot = (id: number) => {
    const good = Goods.get(id);
    if (!good) return "";

    return `<svg width="14" height="14" style="margin: -6px 2px -4px 0;">
              <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
              <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
            </svg>`;
  };

  const typeBadge = (type: Type) => {
    const commonStyles =
      "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
    if (type === "RAW")
      return `<span style="${commonStyles};background:#e7edf2;color:#5f6f7a" title="Raw resource production">RAW</span>`;
    if (type === "BUY")
      return `<span style="${commonStyles};background:#f5d9d6;color:#a33" title="Local market purchase">BUY</span>`;
    if (type === "SELL")
      return `<span style="${commonStyles};background:#dff0e2;color:#2f8a46" title="Sale to local market">SELL</span>`;
    return `<span style="${commonStyles};background:#f8e7bf;color:#b67a00" title="Manufacturing step">MFG</span>`;
  };

  const renderGoodLabel = (id: number, suffix = "") => `${goodDot(id)}${goodName(id)}${suffix}`;
  const renderDataCell = (content: string | number, align: "left" | "right" = "left", extra = "") =>
    `<td style="${align === "right" ? styles.cellRight : styles.cell}${extra ? `;${extra}` : ""}">${content}</td>`;
  const renderHeaderCell = (content: string, align: "left" | "right" = "left", title = "") =>
    `<th style="${align === "right" ? styles.cellRight : styles.cell}"${title ? ` title="${title}"` : ""}>${content}</th>`;
  const renderSection = (title: string, content: string) =>
    `<div style="margin-bottom:.9em"><div style="${styles.sectionTitle}">${title}</div>${content}</div>`;
  const renderPriceCell = (value: number | string, extra = "") => renderDataCell(formatPrice(value), "right", extra);
  const renderIncomeCell = (
    value: number,
    opts?: {
      formulaTitle?: string;
    }
  ) => {
    const extraStyle = value >= 0 ? styles.positive : styles.warning;
    const titleAttr = opts?.formulaTitle ? ` title="${opts.formulaTitle}"` : "";
    return `<td style="${styles.cellRight};${extraStyle}"${titleAttr}>${formatPrice(value)}</td>`;
  };
  const getIncomeFormulaTitle = (deal: Deal, kind: "buy" | "sell") => {
    const units = deal.units;
    const buyOrSellPrice = kind === "buy" ? deal.prices.marketBuy : deal.prices.marketSell;
    const salesTaxPerUnit = kind === "buy" ? getDealSalesTaxPerUnit(deal) : 0;
    const total = units * (buyOrSellPrice + salesTaxPerUnit);
    const signedTotal = kind === "buy" ? -total : total;
    return `${rn(units, 2)} * (${rn(buyOrSellPrice, 2)} + 1 * ${rn(salesTaxPerUnit, 2)}) = ${rn(signedTotal, 2)}`;
  };
  const renderTaggedGood = (id: number, type: Type, suffix = "") =>
    `${renderGoodLabel(id, suffix)} <span style="margin-left:4px">${typeBadge(type)}</span>`;
  const renderLogRow = (candidatesId: string, candidatesHtml: string) =>
    candidatesHtml
      ? /*html*/ `<tr id="${candidatesId}" style="display:none">
          <td colspan="4" style="${styles.detailsCell}">${candidatesHtml}</td>
        </tr>`
      : "";
  const formatPrice = (value: number | string) => `🟡 ${typeof value === "number" ? rn(value, 2) : value}`;
  const renderDemand = (values: number[] | Partial<Record<DemandCategory, number>>, onlyPositive = false) => {
    const entries = Array.isArray(values)
      ? DEMAND_PRIORITY.flatMap((category, index) => {
          const value = values[index] || 0;
          if (onlyPositive && value <= 0.001) return [];
          return `<span title="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
        })
      : (Object.entries(values) as [DemandCategory, number][]).flatMap(([category, value]) => {
          if (onlyPositive && value <= 0.001) return [];
          return `<span title="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
        });

    return entries.join(` <span style="${styles.divider}">•</span> `);
  };
  const calculateDemandCoverageTotals = (inventory: Record<number, number>) => {
    const totals = Array(DEMAND_PRIORITY.length).fill(0);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      const good = Goods.get(goodId);
      if (!good) continue;

      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const category = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        const coveredAmount = good.demandCoverage[category] || 0;
        if (!coveredAmount) continue;
        totals[categoryIndex] += amount * coveredAmount;
      }
    }

    return totals;
  };
  const formatDemandMultiplier = (demandEffect: DemandEffect) => {
    return (
      demandEffect.category &&
      `demand ${rn(demandEffect.multiplier, 2)} (shortage ${rn(demandEffect.shortage, 2)} ${DEMAND_CATEGORY_ICONS[demandEffect.category]})`
    );
  };
  const formatAvailable = (available: number) => {
    if (available < 1) return "available <1";
    return `available ${rn(available, 2)}`;
  };
  const renderCandidateScore = (score: number) => `<b style="${styles.positive}">score ${rn(score, 2)}</b>`;
  const renderDecisionCandidate = (candidate: DecisionCandidate) => {
    if (candidate.kind === "extract") {
      const factors = [
        `projected gain ${formatPrice(candidate.chainValue)}`,
        candidate.cultureModifier !== 1 ? `culture x${rn(candidate.cultureModifier, 2)}` : "",
        `unit ${rn(candidate.units, 2)} (${formatAvailable(candidate.available)})`,
        candidate.demandEffect.multiplier > 1 ? formatDemandMultiplier(candidate.demandEffect) : ""
      ].filter(Boolean);

      return `${typeBadge("RAW")} <b>${goodName(candidate.goodId)}</b>: ${factors.join(" * ")} = ${renderCandidateScore(candidate.score)}`;
    }

    const margin = Math.max(0, candidate.revenue - candidate.ingredientCost);
    const ingredients = candidate.ingredients
      .map(ingredient => {
        const sources = [
          ingredient.amount === ingredient.fromInventory ? "from inventory" : null,
          ingredient.fromInventory > 0 && ingredient.amount !== ingredient.fromInventory
            ? `${rn(ingredient.fromInventory, 2)} from inventory`
            : null,
          ingredient.amount === ingredient.fromMarket ? "from local market" : null,
          ingredient.fromMarket > 0 && ingredient.amount !== ingredient.fromMarket
            ? `${rn(ingredient.fromMarket, 2)} from local market`
            : null
        ];
        return `${rn(ingredient.amount, 2)} ${goodDot(ingredient.goodId)} (${sources.filter(Boolean).join(", ")})`;
      })
      .join(", ");

    const factors = [
      `projected gain ${formatPrice(margin)}`,
      candidate.cultureModifier !== 1 ? `culture x${rn(candidate.cultureModifier, 2)}` : "",
      `unit ${rn(candidate.units, 2)}`,
      candidate.demandEffect.multiplier > 1 ? formatDemandMultiplier(candidate.demandEffect) : ""
    ].filter(Boolean);

    return `<div>${typeBadge("MFG")} <b>${goodName(candidate.goodId)}</b>: ${factors.join(" * ")} = ${renderCandidateScore(candidate.score)}</div>
      <div style="margin-top:.1em;${styles.muted}">Ingredients: ${ingredients}</div>`;
  };
  const renderDecisionDetails = (candidates?: DecisionCandidate[]) => {
    if (!candidates || candidates.length === 0) return "";
    const candidatesHtml = `<ul style="margin:.2em 0 0 1.1em;padding:0">${candidates
      .sort((a, b) => b.score - a.score)
      .map((candidate: DecisionCandidate) => `<li style="margin-top:.25em">${renderDecisionCandidate(candidate)}</li>`)
      .join("")}</ul>`;
    return /*html*/ `<div><b>Decision basis:</b> highest score among ${candidates.length} feasible options:</div>${candidatesHtml}`;
  };
  const accessibleResourcesTitle = "Accessible Resources";
  const population = burg.population || 0;
  const wealthAfter = burg.wealth || 0;

  // Derive process rank from sorted burg order (same order as production run)
  const sortedBurgIds = (pack.burgs as Burg[])
    .filter(b => b.i && !b.removed)
    .sort((a, b) => (a.population || 0) - (b.population || 0))
    .map(b => b.i!);
  const totalBurgs = sortedBurgIds.length;
  const processRank = sortedBurgIds.indexOf(burgId) + 1;

  // Derive financials from deal log
  const phaseRevenue = burgSaleDeals.reduce((sum, deal) => sum + getDealRevenue(deal), 0);
  const ingredientCosts = productionBuyDeals.reduce((sum, deal) => sum + getDealSpent(deal), 0);
  const grossProduct = phaseRevenue - ingredientCosts;
  const totalTax = [...productionBuyDeals, ...demandFillDeals].reduce((sum, deal) => sum + getDealTax(deal), 0);
  const productPerCapita = population > 0 ? grossProduct / population : 0;

  const initialDemand = DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  const finalDemandCoverage = calculateDemandCoverageTotals(data.finalInventory);
  const uncoveredDemand = initialDemand.map((target, index) => Math.max(0, target - finalDemandCoverage[index]));
  const producedByGood: Record<number, number> = {};
  const demandFillUnitsByGood: Record<number, number> = {};
  const centerBurg = market ? pack.burgs[market.centerBurgId] : null;

  const statsHtml = /*html*/ `
    <div style="${styles.topBar}">
      <span><b>Population:</b> ${population}</span>
      <span><b>Order:</b> ${processRank} of ${totalBurgs}</span>
      <span><b>Market:</b> ${centerBurg?.name || "unknown"} (${market?.i})</span>
      <div><b>Initial Demand:</b> ${renderDemand(initialDemand)}</div>
    </div>`;

  const globalResources = Production.collectGlobalResources(pack.goods);
  const burgResources = Production.collectBurgResources(burg, globalResources);

  const accessibleResourceRows = Object.entries(burgResources)
    .map(([goodIdStr, amount]) => {
      const goodId = +goodIdStr;
      const good = Goods.get(goodId);
      if (!good) return "";

      const demandCoverage = Object.fromEntries(
        Object.entries(good.demandCoverage).map(([category, value]) => [category, value * amount])
      ) as Partial<Record<DemandCategory, number>>;

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderGoodLabel(goodId))}
        ${renderDataCell(rn(amount, 2), "right")}
        ${renderPriceCell(good.value)}
        ${renderDataCell(renderDemand(demandCoverage, true), "right")}
      </tr>`;
    })
    .join("");

  const accessibleResourcesTable = accessibleResourceRows
    ? /*html*/ `<table style="${styles.table}">
        <colgroup>
          <col style="width: 30%;">
          <col style="width: 10%;">
          <col style="width: 20%;">
          <col style="width: 40%;">
        </colgroup>
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Resource")}
          ${renderHeaderCell("Units", "right", "Raw units from flood-fill cells")}
          ${renderHeaderCell("Base Price", "right", "Authored reference price for this resource")}
          ${renderHeaderCell("Demand Coverage", "right", "Demand categories this accessible resource can help cover at current pulled units")}
        </tr></thead>
        <tbody>${accessibleResourceRows}</tbody>
      </table>`
    : `<i style="${styles.empty}">No goods reached this burg</i>`;

  let stepIndex = 0;
  const stepRows = data.jobs.flatMap(job => {
    producedByGood[job.goodId] = (producedByGood[job.goodId] || 0) + job.units;
    const candidatesId = `candidates${stepIndex++}`;
    const candidatesHtml = renderDecisionDetails(job.candidates);
    const rowAttrs = candidatesHtml
      ? ` data-target="${candidatesId}" style="${styles.bodyRow};cursor:pointer" title="Click to expand decision details"`
      : ` style="${styles.bodyRow}"`;

    if (job.kind === "extract") {
      const cultureSuffix =
        job.cultureModifier !== 1
          ? ` <span style="${styles.muted}" title="Culture bonus">x${rn(job.cultureModifier, 2)}</span>`
          : "";

      const details = "Local resource production";
      return [
        /*html*/ `<tr${rowAttrs}>
        ${renderDataCell(renderTaggedGood(job.goodId, "RAW", cultureSuffix))}
        ${renderDataCell(rn(job.units, 2), "right")}
        <td style="${styles.cell}">${details}</td>
        ${renderDataCell("", "right", styles.subtle)}
      </tr>`,
        renderLogRow(candidatesId, candidatesHtml)
      ];
    }

    const rows: string[] = [];

    const cultureSuffix =
      job.cultureModifier !== 1
        ? ` <span style="${styles.muted}" title="Culture bonus">x${rn(job.cultureModifier, 2)}</span>`
        : "";
    const allInputs = job.recipe
      .map(item => `${rn(item.fromInventory + item.fromMarket, 2)} ${goodDot(item.goodId)}`)
      .join(` and `);

    rows.push(/*html*/ `<tr${rowAttrs}>
      ${renderDataCell(renderTaggedGood(job.goodId, "MFG", cultureSuffix))}
      ${renderDataCell(rn(job.units, 2), "right")}
      <td style="${styles.cell}">${`Producing from ${allInputs}`}</td>
      ${renderDataCell("", "right", styles.subtle)}
    </tr>`);

    rows.push(renderLogRow(candidatesId, candidatesHtml));

    return rows;
  });

  const demandFillRows = demandFillDeals.map(deal => {
    demandFillUnitsByGood[deal.goodId] = (demandFillUnitsByGood[deal.goodId] || 0) + deal.units;

    return /*html*/ `<tr style="${styles.bodyRow}">
      ${renderDataCell(renderTaggedGood(deal.goodId, "BUY"))}
      ${renderDataCell(rn(deal.units, 2), "right")}
      <td style="${styles.cell}">Demand fill from local market</td>
      ${renderIncomeCell(-getDealSpent(deal), {formulaTitle: getIncomeFormulaTitle(deal, "buy")})}
    </tr>`;
  });

  const productionBuyRows = productionBuyDeals.map(deal => {
    return /*html*/ `<tr style="${styles.bodyRow}">
      ${renderDataCell(renderTaggedGood(deal.goodId, "BUY"))}
      ${renderDataCell(rn(deal.units, 2), "right")}
      <td style="${styles.cell}">Local market purchase for production</td>
      ${renderIncomeCell(-getDealSpent(deal), {formulaTitle: getIncomeFormulaTitle(deal, "buy")})}
    </tr>`;
  });

  const saleRows = burgSaleDeals.map(deal => {
    return /*html*/ `<tr style="${styles.bodyRow}">
      ${renderDataCell(renderTaggedGood(deal.goodId, "SELL"))}
      ${renderDataCell(rn(deal.units, 2), "right")}
      <td style="${styles.cell}">Sale to local market</td>
      ${renderIncomeCell(getDealRevenue(deal), {formulaTitle: getIncomeFormulaTitle(deal, "sell")})}
    </tr>`;
  });

  const jobsTableRows = [...stepRows, ...saleRows, ...productionBuyRows, ...demandFillRows];
  const jobsTable = jobsTableRows.length
    ? /*html*/ `<table style="${styles.table}">
        <colgroup>
          <col style="width: 30%;">
          <col style="width: 10%;">
          <col style="width: 40%;">
          <col style="width: 20%;">
        </colgroup>
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Good")}
          ${renderHeaderCell("Units", "right")}
          ${renderHeaderCell("Details")}
          ${renderHeaderCell("Income", "right", "Money flow for deal rows: negative for BUY, positive for SELL. Pure production rows are blank.")}
        </tr></thead>
        <tbody>${jobsTableRows.join("")}</tbody>
      </table>`
    : `<i style="${styles.empty}">No production actions recorded</i>`;

  const mfgCostByGood: Record<number, number> = {};
  for (const job of data.jobs) {
    if (job.kind === "manufacture" && job.recipe) {
      const marketSpend = job.recipe.reduce((sum, item) => sum + item.marketCost, 0);
      mfgCostByGood[job.goodId] = (mfgCostByGood[job.goodId] || 0) + marketSpend;
    }
  }

  const finalEntries = Object.entries(data.finalInventory).filter(([, value]) => value > 0);
  const finalRows = finalEntries
    .sort(([aId, aAmount], [bId, bAmount]) => {
      const aManufactured = Boolean(Goods.get(+aId)?.recipes?.length);
      const bManufactured = Boolean(Goods.get(+bId)?.recipes?.length);
      if (aManufactured !== bManufactured) return aManufactured ? -1 : 1;
      return (bAmount as number) - (aAmount as number);
    })
    .map(([goodId, amount]) => {
      const id = +goodId;
      const good = Goods.get(id);
      if (!good) return "";

      const producedUnits = producedByGood[id] || 0;
      const boughtUnits = demandFillUnitsByGood[id] || 0;
      const isManufactured = Boolean(good.recipes?.length);
      const type: Type = producedUnits <= 0 && boughtUnits > 0 ? "BUY" : isManufactured ? "MFG" : "RAW";
      const ingredientCost = isManufactured ? mfgCostByGood[id] || 0 : 0;
      const allocatedCost = producedUnits > 0 ? ingredientCost * Math.min(1, amount / producedUnits) : 0;
      const costPerUnit = isManufactured && producedUnits > 0 ? rn(ingredientCost / producedUnits, 2) : 0;
      const demandCoverage = Object.fromEntries(
        Object.entries(good.demandCoverage).map(([category, value]) => [category, value * amount])
      ) as Partial<Record<DemandCategory, number>>;

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderTaggedGood(id, type))}
        ${renderDataCell(rn(amount, 2), "right")}
        ${renderPriceCell(costPerUnit)}
        ${renderPriceCell(allocatedCost, allocatedCost > 0 ? styles.warning : styles.subtle)}
        ${renderDataCell(renderDemand(demandCoverage, true) || "—", "right")}
      </tr>`;
    })
    .join("");

  const demandSummaryHtml = /*html*/ `
    <div style="${styles.summaryBar}">
      <span title="Initial demand minus final covered demand"><b>Uncovered Demand:</b> ${renderDemand(uncoveredDemand, true) || "none"}</span>
    </div>`;

  const historySummaryHtml = /*html*/ `
    <div style="${styles.summaryBar}">
      <span title="Gross Product is local sale revenue minus purchased ingredient costs during this production run. It excludes retained inventory and later demand-fill purchases."><b>Gross Product:</b> <span style="font-weight:600; ${grossProduct >= 0 ? styles.positive : styles.negative}">${formatPrice(grossProduct)}</span></span>
      <span title="Gross product per population point. This is the burg's gross product divided by population, a per-capita productivity measure for the current production run."><b>Weath:</b> <span style="font-weight:600; ${productPerCapita >= 0 ? styles.positive : styles.negative}">${formatPrice(productPerCapita)}</span></span>
      <span title="Sales tax is the markup added on top of market buy price for consumers. It transfers value to treasury and increases effective buy costs, lowering net local purchasing power."><b>Total Tax:</b> <span style="font-weight:600; ${totalTax >= 0 ? styles.warning : styles.subtle}">${formatPrice(totalTax)}</span></span>
      <span title="Net burg treasury after local buying, local sales, and final local demand fill."><b>Treasury:</b> <span style="font-weight:600; ${wealthAfter >= 0 ? styles.positive : styles.negative}">${formatPrice(wealthAfter)}</span></span>
    </div>`;

  const historySection = `${jobsTable}${historySummaryHtml}`;

  const finalTableContent = finalRows
    ? /*html*/ `<table style="${styles.table}">
        <colgroup>
          <col style="width: 30%;">
          <col style="width: 10%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
          <col style="width: 30%;">
        </colgroup>
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Good")}
          ${renderHeaderCell("Units", "right")}
          ${renderHeaderCell("Unit Cost", "right", "Average purchased-input cost per locally produced unit. Raw and bought goods stay at 0.")}
          ${renderHeaderCell("Allocated Cost", "right", "Purchased-input cost allocated to retained locally produced units.")}
          ${renderHeaderCell("Demand Coverage", "right", "Demand categories covered by the retained units in this row.")}
        </tr></thead>
        <tbody>${finalRows}</tbody>
      </table>`
    : `<i style="${styles.empty}">No output produced</i>`;

  const finalTable = `${finalTableContent}${demandSummaryHtml}`;

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent">
      ${statsHtml}
      ${renderSection(accessibleResourcesTitle, accessibleResourcesTable)}
      ${renderSection("Production and Trade history", historySection)}
      ${renderSection("Demand Coverage", finalTable)}
    </div>
  `;

  const overviewContent = alertMessage.querySelector<HTMLElement>("#productionOverviewContent");
  if (overviewContent) {
    overviewContent.onclick = event => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLTableRowElement>("tr[data-target]");
      if (!row) return;

      const candidatesId = row.dataset.target;
      if (!candidatesId) return;
      const detailsRow = overviewContent.querySelector<HTMLTableRowElement>(`#${candidatesId}`);
      if (!detailsRow) return;

      const isOpen = detailsRow.style.display !== "none";
      detailsRow.style.display = isOpen ? "none" : "table-row";
    };
  }

  $("#alert").dialog({width: "48em", resizable: true, title: `Production Overview: ${burg.name}`});
}

declare global {
  interface Window {
    ProductionOverview: {open: typeof open};
  }
}

window.ProductionOverview = {open};
