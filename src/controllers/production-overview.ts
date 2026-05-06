import type {DemandCategory, Good} from "../modules/goods-generator";
import {DEMAND_CATEGORIES, DEMAND_CATEGORY_ICONS} from "../modules/goods-generator";
import {
  type DecisionCandidate,
  type DemandContribution,
  getDemandTargetsForPopulation,
  type Log
} from "../modules/production-generator";
import {rn} from "../utils";

export function open(burgId: number): void {
  const burg = (pack.burgs as any[])[burgId];
  if (!burg || burg.removed) {
    tip("No production data available for this burg.", true, "error");
    return;
  }

  const data = Production.getProductionData(burgId);
  if (!data) {
    alertMessage.innerHTML = `<div>No production data for this burg.<br>Run map generation or regenerate production first.</div>`;
    $("#alert").dialog({
      resizable: false,
      title: `Production Overview: ${burg.name}`
    });
    return;
  }

  const goodById = new Map(pack.goods.map((g: Good) => [g.i, g]));
  const goodName = (id: number) => goodById.get(id)?.name ?? `#${id}`;
  const goodColor = (id: number) => goodById.get(id)?.color ?? "#888";

  const styles = {
    muted: "color:#777",
    subtle: "color:#999",
    divider: "color:#bbb",
    positive: "color:#2a6",
    negative: "color:#c44",
    warning: "color:#c84",
    sectionTitle: "font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.3em;margin-bottom:.45em",
    topBar: "margin-bottom:.85em;display:flex;flex-wrap:wrap;column-gap:.85em;align-items: center",
    table: "width:100%;border-collapse:collapse;line-height:1.35",
    headRow: "background:#eee",
    bodyRow: "border-bottom:1px solid #f0f0f0",
    buyRow: "background:#fffaf2;border-bottom:1px solid #f3e4c7",
    cell: "padding:.4em .5em;vertical-align:top",
    cellRight: "padding:.4em .5em;vertical-align:top;text-align:right",
    logRow: "display:none;background:#fafafa;border-bottom:1px solid #ececec",
    logCell: "padding:0 .5em;",
    empty: "color:#888;font-style:italic",
    summaryBar: "display:flex;margin-top:.6em;justify-content: space-between"
  };

  const goodDot = (id: number) => {
    const color = goodColor(id);
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,0.2);margin-right:6px;vertical-align:middle;flex-shrink:0"></span>`;
  };

  const typeBadge = (kind: "RAW" | "MFG" | "BUY") => {
    const commonStyles = "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold";
    if (kind === "RAW") return `<span style="${commonStyles};background:#f0e8e8;color:#a44">RAW</span>`;
    if (kind === "BUY") return `<span style="${commonStyles};background:#f6ead8;color:#b06a00">BUY</span>`;
    return `<span style="${commonStyles};background:#e8f0e8;color:#4a4">MFG</span>`;
  };

  const renderGoodLabel = (id: number, suffix = "") => `${goodDot(id)}${goodName(id)}${suffix}`;
  const renderDataCell = (content: string | number, align: "left" | "right" = "left", extra = "") =>
    `<td style="${align === "right" ? styles.cellRight : styles.cell}${extra ? `;${extra}` : ""}">${content}</td>`;
  const renderHeaderCell = (content: string, align: "left" | "right" = "left", title = "") =>
    `<th style="${align === "right" ? styles.cellRight : styles.cell}"${title ? ` title="${title}"` : ""}>${content}</th>`;
  const renderSection = (title: string, content: string) =>
    `<div style="margin-bottom:.9em"><div style="${styles.sectionTitle}">${title}</div>${content}</div>`;
  const renderValueCell = (label: string, value: number, positive = true) =>
    renderDataCell(`${label}: ${rn(value, 2)}`, "right", `${positive ? styles.positive : styles.warning}`);
  const renderPriceCell = (value: number | string, extra = "") => renderDataCell(formatPrice(value), "right", extra);
  const renderTaggedGood = (id: number, kind: "RAW" | "MFG" | "BUY", suffix = "") =>
    `${renderGoodLabel(id, suffix)} <span style="margin-left:4px">${typeBadge(kind)}</span>`;
  const renderLogRow = (logId: string, logHtml: string) =>
    logHtml
      ? /*html*/ `<tr id="${logId}" style="${styles.logRow}">
          <td colspan="5" style="${styles.logCell}">${logHtml}</td>
        </tr>`
      : "";
  const formatCulture = (cultureModifier: number) =>
    cultureModifier !== 1 ? `, culture x${rn(cultureModifier, 2)}` : "";
  const formatUnits = (units: number) => (units !== 1 ? `, units ${rn(units, 2)}` : "");
  const formatPrice = (value: number | string) => `🟡 ${typeof value === "number" ? rn(value, 2) : value}`;
  const formatDemandCategory = (category: DemandCategory) => `${DEMAND_CATEGORY_ICONS[category]} ${category}`;
  const renderDemandTotals = (values: number[], onlyPositive = false) => {
    const entries = DEMAND_CATEGORIES.flatMap((category, index) => {
      const value = values[index] || 0;
      if (onlyPositive && value <= 0.001) return [];
      return `<span title="${category}">${DEMAND_CATEGORY_ICONS[category]} ${rn(value, 2)}</span>`;
    });

    return entries.length
      ? entries.join(` <span style="${styles.divider}">•</span> `)
      : `<span style="${styles.subtle}">none</span>`;
  };
  const calculateDemandCoverageTotals = (inventory: Record<number, number>) => {
    const totals = Array(DEMAND_CATEGORIES.length).fill(0);

    for (const goodIdStr in inventory) {
      const goodId = +goodIdStr;
      const amount = inventory[goodId] || 0;
      if (amount <= 0) continue;

      const good = goodById.get(goodId);
      if (!good) continue;

      for (let categoryIndex = 0; categoryIndex < DEMAND_CATEGORIES.length; categoryIndex++) {
        const category = DEMAND_CATEGORIES[categoryIndex] as DemandCategory;
        const coveredAmount = good.demandCoverage[category] || 0;
        if (!coveredAmount) continue;
        totals[categoryIndex] += amount * coveredAmount;
      }
    }

    return totals;
  };
  const renderDemandEffect = (multiplier: number, demand: DemandContribution[]) => {
    if (multiplier <= 1.001 || !demand.length) return "";
    const sumFormula = demand
      .map(item => `${formatDemandCategory(item.category)} boost ${rn(item.boost, 2)}`)
      .join(" + ");
    const details = demand
      .map(
        item =>
          `${formatDemandCategory(item.category)} boost = shortage ${rn(item.shortage, 2)} × coverage ${rn(item.demandCoverage, 2)} = ${rn(item.boost, 2)}`
      )
      .join("<br>");
    return `<div style="margin-top:.1em;${styles.muted}">demandMultiplier = 1 + ${sumFormula} = ${rn(multiplier, 2)}</div><div style="margin-top:.1em;${styles.muted}">${details}</div>`;
  };
  const renderDecisionCandidate = (candidate: DecisionCandidate) => {
    if (candidate.kind === "extract") {
      return /*html*/ `<div>
        <div>${typeBadge("RAW")} <b>${goodName(candidate.goodId)}</b>: chain ${rn(candidate.chainValue, 2)}${formatCulture(candidate.cultureModifier)}${formatUnits(candidate.units)}, available ${rn(candidate.available, 2)}, score ${rn(candidate.score, 2)}</div>
        ${renderDemandEffect(candidate.demandMultiplier, candidate.demand)}
      </div>`;
    }

    const ingredients = candidate.ingredients
      .map(
        (item: {goodId: number; amount: number; buyPrice: number; available: number}) =>
          `${goodName(item.goodId)} ${rn(item.amount, 2)} @ ${formatPrice(item.buyPrice)} (avail ${rn(item.available, 2)})`
      )
      .join(", ");
    return /*html*/ `<div>
      <div>${typeBadge("MFG")} <b>${goodName(candidate.goodId)}</b>: sell ${formatPrice(candidate.sellPrice)}${formatCulture(candidate.cultureModifier)}${formatUnits(candidate.units)}, score ${rn(candidate.score, 2)}</div>
      ${renderDemandEffect(candidate.demandMultiplier, candidate.demand)}
      <div style="margin-top:.15em;${styles.muted}">Inputs: ${ingredients}</div>
      <div style="margin-top:.1em;${styles.muted}">Revenue ${rn(candidate.revenue, 2)}, ingredient cost ${rn(candidate.ingredientCost, 2)}</div>
    </div>`;
  };
  const renderDecisionDetails = (log?: Log | null) => {
    if (!log?.selected) return "";
    const alternatives = log.alternatives.length
      ? `<ul style="margin:.15em 0 0 1.1em;padding:0">${log.alternatives.map((option: DecisionCandidate) => `<li style="margin-top:.25em">${renderDecisionCandidate(option)}</li>`).join("")}</ul>`
      : `<div style="margin-top:.2em;${styles.subtle}">No other feasible alternatives</div>`;

    return /*html*/ `<div>
      <div><b>Decision basis:</b> highest score among ${log.candidateCount} feasible options.</div>
      <div style="margin-top:.35em"><b>Selected</b></div>
      <div style="margin-top:.15em">${renderDecisionCandidate(log.selected)}</div>
      <div style="margin-top:.5em"><b>Alternatives</b></div>
      ${alternatives}
    </div>`;
  };
  const renderDemandCoverage = (good: Good | undefined, units: number) => {
    if (!good) return `<span style="${styles.subtle}">-</span>`;

    const coveredCategories = DEMAND_CATEGORIES.flatMap(category => {
      const coveredAmount = good.demandCoverage[category as DemandCategory] || 0;
      if (!coveredAmount) return [];
      return `${DEMAND_CATEGORY_ICONS[category]} ${rn(units * coveredAmount, 2)}`;
    });

    return coveredCategories.length ? coveredCategories.join(", ") : `<span style="${styles.subtle}">-</span>`;
  };
  const accessibleResourcesTitle = "Accessible Resources";
  const initialDemand = getDemandTargetsForPopulation(data.population);
  const finalDemandCoverage = calculateDemandCoverageTotals(data.finalInventory);
  const uncoveredDemand = initialDemand.map((target, index) => Math.max(0, target - finalDemandCoverage[index]));

  const statsHtml = /*html*/ `
    <div style="${styles.topBar}">
      <span><b>Population:</b> ${data.population}</span>
      <span><b>Cells:</b> ${data.cellsReached}/${data.cellsBudget}</span>
      <span><b>Culture type:</b> ${data.cultureType}</span>
      <span><b>Order:</b> ${data.processRank} of ${data.totalBurgs}</span>
      <div><b>Initial Demand:</b> ${renderDemandTotals(initialDemand)}</div>
    </div>`;

  const accessibleResourceRows = data.goodsPull
    .map(resource => {
      const good = goodById.get(resource.goodId);
      const baseValue = good?.value ?? 0;
      const projectedGain = Math.max(0, resource.chainValue - baseValue);

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderGoodLabel(resource.goodId))}
        ${renderDataCell(rn(resource.pull, 2), "right")}
        ${renderPriceCell(baseValue)}
        ${renderPriceCell(projectedGain, projectedGain > 0.001 ? styles.positive : styles.subtle)}
        ${renderDataCell(renderDemandCoverage(good, resource.pull), "right")}
      </tr>`;
    })
    .join("");

  const accessibleResourcesTable = accessibleResourceRows
    ? /*html*/ `<table style="${styles.table}">
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Resource")}
          ${renderHeaderCell("Units", "right", "Raw units from flood-fill cells")}
          ${renderHeaderCell("Base Price", "right", "Authored reference price for this resource")}
          ${renderHeaderCell("Projected Gain", "right", "Estimated extra per-unit value from reachable downstream chains")}
          ${renderHeaderCell("Demand Coverage", "right", "Demand categories this accessible resource can help cover at current pulled units")}
        </tr></thead>
        <tbody>${accessibleResourceRows}</tbody>
      </table>`
    : `<i style="${styles.empty}">No goods reached this burg</i>`;

  let stepIndex = 0;
  const stepRows = data.jobs.flatMap(job => {
    const logId = `productionSteplog${stepIndex++}`;
    const logHtml = renderDecisionDetails(job.log);
    const rowAttrs = logHtml
      ? ` data-log-target="${logId}" style="${styles.bodyRow};cursor:pointer" title="Click to expand decision details"`
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
        ${
          job.score !== undefined
            ? renderValueCell("Score", job.score, job.score >= 0)
            : renderDataCell("—", "right", styles.subtle)
        }
      </tr>`,
        renderLogRow(logId, logHtml)
      ];
    }

    const buyItems = job.recipe.filter(item => item.fromMarket > 0);
    const rows: string[] = [];

    if (buyItems.length) {
      for (const item of buyItems) {
        rows.push(/*html*/ `<tr style="${styles.buyRow}">
          ${renderDataCell(renderTaggedGood(item.goodId, "BUY"))}
          ${renderDataCell(rn(item.fromMarket, 2), "right")}
          <td style="${styles.cell}">Market purchase for ${goodDot(job.goodId)}${goodName(job.goodId)}</td>
          ${renderValueCell("Spent", item.marketCost, false)}
        </tr>`);
      }
    }

    const cultureSuffix =
      job.cultureModifier !== 1
        ? ` <span style="${styles.muted}" title="Culture bonus">x${rn(job.cultureModifier, 2)}</span>`
        : "";
    const allInputs = job.recipe
      .map(item => {
        const total = item.fromInventory + item.fromMarket;
        return total > 0 ? `${renderGoodLabel(item.goodId)} ${rn(total, 2)}` : "";
      })
      .filter(Boolean)
      .join(` <span style="${styles.divider}">+</span> `);
    const details = allInputs ? `Manufacturing from ${allInputs}` : "Manufacturing";

    rows.push(/*html*/ `<tr${rowAttrs}>
      ${renderDataCell(renderTaggedGood(job.goodId, "MFG", cultureSuffix))}
      ${renderDataCell(rn(job.units, 2), "right")}
      <td style="${styles.cell}">${details}</td>
      ${job.score !== undefined ? renderValueCell("Score", job.score, job.score >= 0) : renderDataCell("—", "right", styles.subtle)}
    </tr>`);

    rows.push(renderLogRow(logId, logHtml));

    return rows;
  });

  const jobsTable = stepRows.length
    ? /*html*/ `<table style="${styles.table}">
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Good")}
          ${renderHeaderCell("Units", "right")}
          ${renderHeaderCell("Details")}
          ${renderHeaderCell("Value", "right")}
        </tr></thead>
        <tbody>${stepRows.join("")}</tbody>
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
      const aManufactured = Boolean(goodById.get(+aId)?.recipes?.length);
      const bManufactured = Boolean(goodById.get(+bId)?.recipes?.length);
      if (aManufactured !== bManufactured) return aManufactured ? -1 : 1;
      return (bAmount as number) - (aAmount as number);
    })
    .map(([goodId, amount]) => {
      const id = +goodId;
      const good = goodById.get(id);
      const sellPrice = good?.sellPrice ?? good?.value ?? 0;
      const baseValue = good?.value ?? 0;
      const isManufactured = Boolean(good?.recipes?.length);
      const kind = isManufactured ? "MFG" : "RAW";
      const sellValue = amount * sellPrice;
      const ingredientCost = isManufactured ? mfgCostByGood[id] || 0 : 0;
      const costPerUnit = isManufactured && amount > 0 ? rn(ingredientCost / amount, 2) : 0;
      const profit = sellValue - ingredientCost;
      const profitColor = profit >= 0 ? styles.positive : styles.negative;
      const sellColor =
        sellPrice < baseValue * 0.99 ? styles.warning : sellPrice > baseValue * 1.01 ? styles.positive : "";

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderTaggedGood(id, kind))}
        ${renderDataCell(rn(amount, 2), "right")}
        ${renderPriceCell(costPerUnit)}
        ${renderPriceCell(sellPrice, sellColor)}
        ${renderPriceCell(sellValue)}
        ${renderPriceCell(profit, profitColor)}
      </tr>`;
    })
    .join("");

  const summaryHtml = /*html*/ `
    <div style="${styles.summaryBar}">
      <span title="Initial demand minus final covered demand"><b>Uncovered demand:</b> ${renderDemandTotals(uncoveredDemand, true)}</span>
       <span title="Total revenue"><b>Total revenue:</b> <span style="font-weight:600; ${data.phaseRevenue >= 0 ? styles.positive : styles.negative}">${formatPrice(data.phaseRevenue)}</span></span>
    </div>`;

  const finalTableContent = finalRows
    ? /*html*/ `<table style="${styles.table}">
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Good")}
          ${renderHeaderCell("Units", "right")}
          ${renderHeaderCell("Cost/unit", "right", "Average ingredient cost per unit (MFG only)")}
          ${renderHeaderCell("Sell price", "right")}
          ${renderHeaderCell("Revenue", "right")}
          ${renderHeaderCell("Profit", "right", "Revenue minus ingredient cost (MFG only)")}
        </tr></thead>
        <tbody>${finalRows}</tbody>
      </table>`
    : `<i style="${styles.empty}">No output produced</i>`;
  const finalTable = `${finalTableContent}${summaryHtml}`;

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent" style="max-height:65vh;overflow-y:auto">
      ${statsHtml}
      ${renderSection(accessibleResourcesTitle, accessibleResourcesTable)}
      ${renderSection("Production Steps", jobsTable)}
      ${renderSection("Final Output", finalTable)}
    </div>
  `;

  const overviewContent = alertMessage.querySelector<HTMLElement>("#productionOverviewContent");
  if (overviewContent) {
    overviewContent.onclick = event => {
      const target = event.target as HTMLElement;
      const row = target.closest<HTMLTableRowElement>("tr[data-log-target]");
      if (!row) return;

      const logId = row.dataset.logTarget;
      if (!logId) return;
      const detailsRow = overviewContent.querySelector<HTMLTableRowElement>(`#${logId}`);
      if (!detailsRow) return;

      const isOpen = detailsRow.style.display !== "none";
      detailsRow.style.display = isOpen ? "none" : "table-row";
    };
  }

  $("#alert").dialog({
    width: "48em",
    resizable: true,
    title: `Production Overview: ${burg.name}`
  });
}

declare global {
  interface Window {
    ProductionOverview: {open: typeof open};
  }
}

window.ProductionOverview = {open};
