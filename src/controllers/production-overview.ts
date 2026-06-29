import type { Burg } from "../generators/burgs-generator";
import type { DemandCategory } from "../generators/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS } from "../generators/goods-generator";
import type { Deal } from "../generators/markets-generator";
import type { ProductionCandidate } from "../generators/production-generator";
import { isDealRecord, isMfgRecord } from "../generators/production-generator";
import { formatPrice, rn } from "../utils";

type Type = "MFG" | "BUY" | "SELL" | "LOCAL";

function open(burgId: number): void {
  if (customization) return;
  const burg = pack.burgs[burgId];
  if (!burg || burg.removed) {
    tip("Invalid burg. The selected burg does not exist or was removed.", true, "error", 5000);
    return;
  }

  const market = Markets.get(burg.market);
  if (!market) {
    tip("No market. This burg is not connected to any market.", true, "error", 5000);
    return;
  }

  const data = burg.production;
  if (!data) {
    tip("No production data for this burg.", true, "error", 5000);
    return;
  }

  const isBurgSeller = (deal: Deal) => deal.sellerType === "burg" && deal.seller === burgId;
  const isBurgBuyer = (deal: Deal) => deal.buyerType === "burg" && deal.buyer === burgId;

  const getDealSpent = (deal: Deal) => deal.units * deal.price;

  const getDealTax = (deal: Deal) => {
    if (!isBurgSeller(deal)) return 0;
    if (deal.tax !== undefined) return deal.tax;
    return deal.units * deal.price * States.getSalesTax(pack.burgs[deal.seller]);
  };

  const getDealRevenue = (deal: Deal) => deal.units * deal.price;

  const getDealNetRevenue = (deal: Deal) => getDealRevenue(deal) - getDealTax(deal);

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
    empty: "color:#888;font-style:italic"
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
    if (type === "BUY")
      return `<span style="${commonStyles};background:#f5d9d6;color:#a33" data-tip="Local market purchase">BUY</span>`;
    if (type === "SELL")
      return `<span style="${commonStyles};background:#dff0e2;color:#2f8a46" data-tip="Sale to local market">SELL</span>`;
    if (type === "LOCAL")
      return `<span style="${commonStyles};background:#d9e7f5;color:#346" data-tip="Local production">LOCAL</span>`;
    return `<span style="${commonStyles};background:#f8e7bf;color:#b67a00" data-tip="Manufacturing step">MFG</span>`;
  };
  const modifierBadge = (modifier: number) =>
    `<span style="display:inline-block;margin-left:4px;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35;background:#edf1f4;color:#5f6f7a" data-tip="Culture type production modifier. Produced units are multiplied by this value.">x${rn(modifier, 2)}</span>`;

  const renderGoodLabel = (id: number, suffix = "") => `${goodDot(id)}${goodName(id)}${suffix}`;
  const renderDataCell = (content: string | number, align: "left" | "right" = "left", extra = "") =>
    `<td style="${align === "right" ? styles.cellRight : styles.cell}${extra ? `;${extra}` : ""}">${content}</td>`;
  const renderHeaderCell = (content: string, align: "left" | "right" = "left", title = "") =>
    `<th style="${align === "right" ? styles.cellRight : styles.cell}"${title ? ` data-tip="${title}"` : ""}>${content}</th>`;
  const renderSection = (title: string, content: string, tooltip = "") =>
    `<div style="margin-bottom:.9em"><div style="${styles.sectionTitle}"${tooltip ? ` data-tip="${tooltip}"` : ""}>${title}</div>${content}</div>`;
  const renderIncomeCell = (value: number) => {
    const extraStyle = value >= 0 ? styles.positive : styles.warning;
    return `<td style="${styles.cellRight};${extraStyle}">${formatPrice(value)}</td>`;
  };
  const renderTable = (params: {
    colWidths: string[];
    headers: Array<{ label: string; align?: "left" | "right"; title?: string }>;
    rows: string[];
    empty: string;
  }) => {
    const { colWidths, headers, rows, empty } = params;
    if (!rows.length) return `<i style="${styles.empty}">${empty}</i>`;

    return /*html*/ `<table style="${styles.table}">
      <colgroup>${colWidths.map(width => `<col style="width: ${width};">`).join("")}</colgroup>
      <thead><tr style="${styles.headRow}">${headers
        .map(header => renderHeaderCell(header.label, header.align || "left", header.title || ""))
        .join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
  };
  const renderTaggedGood = (id: number, type: Type, suffix = "") =>
    `${renderGoodLabel(id, suffix)} <span style="margin-left:4px">${typeBadge(type)}</span>`;
  const renderLogRow = (targetId: string, detailsHtml: string) =>
    detailsHtml
      ? /*html*/ `<tr id="${targetId}" style="display:none">
          <td colspan="4" style="${styles.detailsCell}">${detailsHtml}</td>
        </tr>`
      : "";
  const renderDemand = (values: number[] | Partial<Record<DemandCategory, number>>, onlyPositive = false) => {
    const entries = Array.isArray(values)
      ? DEMAND_PRIORITY.flatMap((category, index) => {
          const value = values[index] || 0;
          if (onlyPositive && value <= 0.001) return [];
          return `<span data-tip="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
        })
      : (Object.entries(values) as [DemandCategory, number][]).flatMap(([category, value]) => {
          if (onlyPositive && value <= 0.001) return [];
          return `<span data-tip="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
        });

    return entries.join(` <span style="${styles.divider}">•</span> `);
  };
  const calculateDemandCoverageTotals = (inventory: Record<number, number>) => {
    const totals: number[] = Array(DEMAND_PRIORITY.length).fill(0);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      const good = Goods.get(goodId);
      if (!good) continue;

      for (let categoryIndex = 0; categoryIndex < DEMAND_PRIORITY.length; categoryIndex++) {
        const category = DEMAND_PRIORITY[categoryIndex] as DemandCategory;
        const coveredAmount = good.demandCoverage?.[category] || 0;
        if (!coveredAmount) continue;
        totals[categoryIndex] += amount * coveredAmount;
      }
    }

    return totals;
  };
  const renderCandidateScore = (score: number) => `<b style="${styles.positive}">score ${rn(score, 2)}</b>`;
  const renderDecisionCandidate = (candidate: ProductionCandidate) => {
    const ingredients = candidate.ingredients
      .map(ing => `${rn(ing.amount * candidate.units, 2)} ${goodDot(ing.goodId)}`)
      .join(", ");

    const prep = candidate.isPreparation ? ` (prep for ${goodDot(candidate.goalGoodId || -1)})` : "";
    const demand =
      candidate.demandCategory && candidate.demandMultiplier !== 1
        ? `x demand ${DEMAND_CATEGORY_ICONS[candidate.demandCategory]} ${rn(candidate.demandMultiplier, 2)}`
        : "";
    const culture = candidate.cultureModifier !== 1 ? ` ${modifierBadge(candidate.cultureModifier)}` : "";

    let formula: string;
    if (candidate.isPreparation) {
      const workers = rn(candidate.workersNeeded || 1, 2);
      const gain = ((candidate.gainPerWorker || 0) / candidate.demandMultiplier) * workers;
      formula = `goal sell ${formatPrice(gain)}${culture} ÷ ${workers} workers ${demand} × units ${rn(candidate.units, 2)} = ${renderCandidateScore(candidate.score)}`;
    } else {
      formula = `sell ${formatPrice(candidate.sellPrice)}${culture} - cost ${formatPrice(candidate.ingredientCost)} = ${renderCandidateScore(candidate.score)}`;
    }
    return `<div>${typeBadge("MFG")} <b>${goodName(candidate.goodId)}</b>${prep}: ${formula}. <span style="${styles.muted}">Ingredients: ${ingredients}</span></div>`;
  };
  const renderDecisionDetails = (candidates?: readonly ProductionCandidate[]) => {
    if (!candidates || candidates.length === 0) return "";
    const candidatesHtml = `<ul style="margin:.2em 0 0 1.1em;padding:0">${[...candidates]
      .sort((a, b) => b.score - a.score)
      .map(
        (candidate: ProductionCandidate) => `<li style="margin-top:.25em">${renderDecisionCandidate(candidate)}</li>`
      )
      .join("")}</ul>`;
    return /*html*/ `<div><b>Decision basis:</b> highest score among ${candidates.length} feasible options:</div>${candidatesHtml}`;
  };
  const renderCalculationDetails = (expression: string, value: number, label: string) =>
    /*html*/ `<div><b>Deal calculation:</b> ${expression} = <b>${formatPrice(value)}</b> ${label}</div>`;
  const renderBuyDetails = (units: number, unitPrice: number, totalCost: number) =>
    renderCalculationDetails(`unit ${rn(units, 2)} × buy price ${rn(unitPrice, 2)}`, -totalCost, "spent");
  const renderSaleDetails = (deal: Deal) =>
    renderCalculationDetails(
      `unit ${rn(deal.units, 2)} × sell price ${rn(deal.price, 2)} - sales tax ${rn(getDealTax(deal), 2)}`,
      getDealNetRevenue(deal),
      "income"
    );
  const renderExpandableDealRow = (params: {
    targetId: string;
    goodId: number;
    type: Type;
    units: number;
    details: string;
    income: number;
    detailsHtml: string;
  }) => {
    const { targetId, goodId, type, units, details, income, detailsHtml } = params;
    return [
      /*html*/ `<tr data-target="${targetId}" style="${styles.bodyRow};cursor:pointer" data-tip="Click to expand deal details">
        ${renderDataCell(renderTaggedGood(goodId, type))}
        ${renderDataCell(rn(units, 2), "right")}
        <td style="${styles.cell}">${details}</td>
        ${renderIncomeCell(income)}
      </tr>`,
      renderLogRow(targetId, detailsHtml)
    ];
  };
  const population = burg.population || 0;
  const treasuryAfter = burg.treasury || 0;

  // Derive process rank from sorted burg order (same order as production run)
  const sortedBurgIds = (pack.burgs as Burg[])
    .filter(b => b.i && !b.removed)
    .sort((a, b) => (a.population || 0) - (b.population || 0))
    .map(b => b.i!);
  const totalBurgs = sortedBurgIds.length;
  const processRank = sortedBurgIds.indexOf(burgId) + 1;

  const initialDemand = DEMAND_PRIORITY.map(category => population * DEMAND_TARGET_FACTORS[category]);
  const producedByGood: Record<number, number> = {};

  let totalTax = 0;
  let stepIndex = 0;
  const netInventory: Record<number, number> = {};

  const dealById = new Map(pack.deals.map(d => [d.i, d]));
  const allRows = data.flatMap(entry => {
    if (isMfgRecord(entry)) {
      const mfg = entry;
      producedByGood[mfg.goodId] = (producedByGood[mfg.goodId] || 0) + mfg.units;
      netInventory[mfg.goodId] = (netInventory[mfg.goodId] || 0) + mfg.units;
      for (const item of mfg.recipe) netInventory[item.goodId] = (netInventory[item.goodId] || 0) - item.units;

      const candidatesId = `candidates${stepIndex++}`;
      const candidatesHtml = renderDecisionDetails(mfg.candidates);
      const rowAttrs = candidatesHtml
        ? ` data-target="${candidatesId}" style="${styles.bodyRow};cursor:pointer" data-tip="Click to expand decision details"`
        : ` style="${styles.bodyRow}"`;
      const cultureModifier = mfg.cultureModifier ?? 1;
      const cultureSuffix = cultureModifier !== 1 ? ` ${modifierBadge(cultureModifier)}` : "";
      const allInputs = mfg.recipe.map(item => `${rn(item.units, 2)} ${goodDot(item.goodId)}`).join(` and `);

      return [
        /*html*/ `<tr${rowAttrs}>
           ${renderDataCell(renderTaggedGood(mfg.goodId, "MFG", cultureSuffix))}
           ${renderDataCell(rn(mfg.units, 2), "right")}
           <td style="${styles.cell}">Manufacturing from ${allInputs}</td>
           ${renderDataCell("", "right", styles.subtle)}
         </tr>`,
        renderLogRow(candidatesId, candidatesHtml)
      ];
    } else if (isDealRecord(entry)) {
      const deal = dealById.get(entry.dealId);
      if (!deal) return [];
      const detailsId = `deal-details-${stepIndex++}`;
      if (isBurgBuyer(deal)) {
        netInventory[deal.good] = (netInventory[deal.good] || 0) + deal.units;
        return renderExpandableDealRow({
          targetId: detailsId,
          goodId: deal.good,
          type: "BUY",
          units: deal.units,
          details: "Market purchase",
          income: -getDealSpent(deal),
          detailsHtml: renderBuyDetails(deal.units, deal.price, getDealSpent(deal))
        });
      }
      if (isBurgSeller(deal)) {
        netInventory[deal.good] = (netInventory[deal.good] || 0) - deal.units;
        totalTax += getDealTax(deal);
        return renderExpandableDealRow({
          targetId: detailsId,
          goodId: deal.good,
          type: "SELL",
          units: deal.units,
          details: "Sale to local market",
          income: getDealNetRevenue(deal),
          detailsHtml: renderSaleDetails(deal)
        });
      }
    } else {
      producedByGood[entry.goodId] = (producedByGood[entry.goodId] || 0) + entry.units;
      netInventory[entry.goodId] = (netInventory[entry.goodId] || 0) + entry.units;
      return /*html*/ `<tr style="${styles.bodyRow}">
           ${renderDataCell(renderTaggedGood(entry.goodId, "LOCAL"))}
           ${renderDataCell(entry.units, "right")}
           <td style="${styles.cell}">Local bonus resource</td>
           ${renderDataCell("", "right", styles.subtle)}
         </tr>`;
    }
    return [];
  });

  const grossProduct = Math.max(0, burg.product || 0);
  const productPerCapita = population > 0 ? grossProduct / population : 0;

  const jobsTable = renderTable({
    colWidths: ["30%", "10%", "45%", "15%"],
    headers: [
      { label: "Good" },
      { label: "Units", align: "right" },
      { label: "Details" },
      {
        label: "Income",
        align: "right",
        title: "Money flow for deal rows: negative for BUY, positive for SELL. Pure production rows are blank."
      }
    ],
    rows: allRows,
    empty: "No production actions recorded"
  });

  const finalDemandCoverage = calculateDemandCoverageTotals(netInventory);
  const uncoveredDemand = initialDemand.map((target, index) => Math.max(0, target - finalDemandCoverage[index]));

  const statsHtml = /*html*/ `
    <div style="${styles.topBar}">
      <div>
        <span><b>Population:</b> ${population}</span>
        <span><b>Order:</b> ${processRank} of ${totalBurgs}</span>
        <span><b>Market:</b> ${market ? Markets.getName(market) : "unknown"} (${market?.i})</span>
      </div>
      <div><b>Initial Demand:</b> ${renderDemand(initialDemand)}</div>
      <div><b>Uncovered Demand:</b> ${renderDemand(uncoveredDemand, true) || "none"}</div>
      <div>
        <span data-tip="Gross Product is local sale revenue minus purchased ingredient costs during the production."><b>Product:</b> <span style="${styles.positive}">${formatPrice(grossProduct)}</span></span>
        <span data-tip="Product per capita: gross product divided by population."><b>Wealth:</b> <span style="${productPerCapita >= 0 ? styles.positive : styles.negative}">${formatPrice(productPerCapita)}</span></span>
        <span data-tip="Sales Tax is paid by the seller on local sale deals. It is deducted from gross sale value and transferred to the state treasury."><b>Total Tax:</b> <span style="${totalTax >= 0 ? styles.warning : styles.subtle}">${formatPrice(totalTax)}</span></span>
        <span data-tip="Net burg treasury after local buying, local sales, and final local demand fill."><b>Treasury:</b> <span style="${treasuryAfter >= 0 ? styles.positive : styles.negative}">${formatPrice(treasuryAfter)}</span></span>
      </div>
    </div>`;

  const producedRows = Object.entries(producedByGood)
    .filter(([, units]) => units > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([goodIdStr, units]) => {
      const id = +goodIdStr;
      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderGoodLabel(id))}
        ${renderDataCell(rn(units, 2), "right")}
      </tr>`;
    });

  const producedTable = renderTable({
    colWidths: ["80%", "20%"],
    headers: [{ label: "Good" }, { label: "Units", align: "right" }],
    rows: producedRows,
    empty: "No goods manufactured"
  });

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent">
      ${statsHtml}
      ${renderSection("Manufactured Goods", producedTable, "Goods manufactured by this burg in this production cycle.")}
      ${renderSection("Production and Trade history", jobsTable, "Chronological local production, market purchases, sales, and demand-fill operations for this burg.")}
    </div>
  `;

  const overviewContent = alertMessage.querySelector<HTMLElement>("#productionOverviewContent");
  if (overviewContent) {
    overviewContent.onclick = event => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLTableRowElement>("tr[data-target]");
      if (!row) return;

      const targetId = row.dataset.target;
      if (!targetId) return;
      const detailsRow = overviewContent.querySelector<HTMLTableRowElement>(`#${targetId}`);
      if (!detailsRow) return;

      const isOpen = detailsRow.style.display !== "none";
      detailsRow.style.display = isOpen ? "none" : "table-row";
    };
  }

  $("#alert").dialog({
    width: "48em",
    resizable: true,
    title: `Production Overview: ${burg.name}`,
    position: {
      my: "right top",
      at: "right-10 top+10",
      of: "svg",
      collision: "fit"
    }
  });
}

export const ProductionOverview = { open };
