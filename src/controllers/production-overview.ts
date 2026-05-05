import type {Good} from "../modules/goods-generator";
import type {DecisionCandidate, Log} from "../modules/production-generator";
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
    $("#alert").dialog({resizable: false, title: `Production Overview: ${burg.name}`});
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
    statsBar: "margin-bottom:.85em;display:flex;flex-wrap:wrap;gap:.85em;",
    table: "width:100%;border-collapse:collapse;line-height:1.35",
    headRow: "background:#eee",
    bodyRow: "border-bottom:1px solid #f0f0f0",
    buyRow: "background:#fffaf2;border-bottom:1px solid #f3e4c7",
    cell: "padding:.38em .55em;vertical-align:top",
    cellRight: "padding:.38em .55em;vertical-align:top;text-align:right",
    logRow: "display:none;background:#fafafa;border-bottom:1px solid #ececec",
    logCell: "padding:0 .5em;",
    empty: "color:#888;font-style:italic",
    summaryBar:
      "display:flex;gap:1.2em;flex-wrap:wrap;background:#f0f5f0;border-radius:4px;padding:.55em .8em;margin-top:.6em;line-height:1.4"
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
  const sameNumber = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const formatCulture = (cultureModifier: number) =>
    cultureModifier !== 1 ? `, culture x${rn(cultureModifier, 2)}` : "";
  const formatUnits = (units: number) => (units !== 1 ? `, units ${rn(units, 2)}` : "");
  const formatScore = (decisionScore: number, projectedGain: number) =>
    sameNumber(decisionScore, projectedGain) ? "" : `, score ${rn(decisionScore, 2)}`;
  const formatPrice = (value: number | string) => `🟡 ${typeof value === "number" ? rn(value, 2) : value}`;
  const renderDecisionCandidate = (candidate: DecisionCandidate) => {
    if (candidate.kind === "extract") {
      return /*html*/ `<div>
        ${typeBadge("RAW")} <b>${goodName(candidate.goodId)}</b>: chain ${rn(candidate.chainValue, 2)}${formatCulture(candidate.cultureModifier)}${formatUnits(candidate.units)}, available ${rn(candidate.available, 2)}, projected ${rn(candidate.projectedGain, 2)}${formatScore(candidate.decisionScore, candidate.projectedGain)}
      </div>`;
    }

    const ingredients = candidate.ingredients
      .map(
        (item: {goodId: number; amount: number; buyPrice: number; available: number}) =>
          `${goodName(item.goodId)} ${rn(item.amount, 2)} @ ${formatPrice(item.buyPrice)} (avail ${rn(item.available, 2)})`
      )
      .join(", ");
    return /*html*/ `<div>
      <div>${typeBadge("MFG")} <b>${goodName(candidate.goodId)}</b>: sell ${formatPrice(candidate.sellPrice)}${formatCulture(candidate.cultureModifier)}${formatUnits(candidate.units)}, projected ${rn(candidate.projectedGain, 2)}${formatScore(candidate.decisionScore, candidate.projectedGain)}</div>
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

  const statsHtml = /*html*/ `
    <div style="${styles.statsBar}">
      <span><b>Population:</b> ${data.population}</span>
      <span><b>Cells:</b> ${data.cellsReached}/${data.cellsBudget}</span>
      <span><b>Culture type:</b> ${data.cultureType}</span>
      <span><b>Order:</b> ${data.processRank} of ${data.totalBurgs}</span>
    </div>`;

  const poolRows = data.goodsPull
    .map(goodPull => {
      const baseValue = goodById.get(goodPull.goodId)?.value ?? 0;
      const chainExtra =
        goodPull.chainValue > baseValue + 0.01
          ? ` <span style="${styles.positive}">(+${rn(goodPull.chainValue - baseValue, 2)})</span>`
          : "";
      const buyPrice = rn(data.pricesAtStart.buy[goodPull.goodId] ?? baseValue, 2);
      const buyColor = buyPrice > baseValue ? styles.warning : buyPrice < baseValue ? styles.positive : "";

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderGoodLabel(goodPull.goodId))}
        ${renderDataCell(rn(goodPull.pull, 2), "right")}
        ${renderDataCell(`${rn(goodPull.chainValue, 2)}${chainExtra}`, "right")}
        ${renderDataCell(rn(goodPull.priority, 2), "right")}
        ${renderPriceCell(buyPrice, buyColor)}
      </tr>`;
    })
    .join("");

  const poolTable = poolRows
    ? /*html*/ `<table style="${styles.table}">
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Good")}
          ${renderHeaderCell("Units", "right", "Raw units from flood-fill cells")}
          ${renderHeaderCell("Chain Value", "right", "Elevated by downstream profitable chains")}
          ${renderHeaderCell("Priority", "right", "Initial heuristic ordering")}
          ${renderHeaderCell("Buy Price", "right", "Buy price when this burg was processed")}
        </tr></thead>
        <tbody>${poolRows}</tbody>
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
        ${renderDataCell(String(rn(job.units, 2)), "right")}
        <td style="${styles.cell}">${details}</td>
        ${
          job.projectedGain !== undefined
            ? renderValueCell("Gain", job.projectedGain, job.projectedGain >= 0)
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
          ${renderDataCell(typeBadge("BUY"))}
          ${renderDataCell(renderTaggedGood(item.goodId, "BUY"))}
          ${renderDataCell(String(rn(item.fromMarket, 2)), "right")}
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
      ${renderDataCell(typeBadge("MFG"))}
      ${renderDataCell(renderTaggedGood(job.goodId, "MFG", cultureSuffix))}
      ${renderDataCell(String(rn(job.units, 2)), "right")}
      <td style="${styles.cell}">${details}</td>
      ${job.score !== undefined ? renderValueCell("Gain", job.score, job.score >= 0) : renderDataCell("—", "right", styles.subtle)}
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
  const netWealth = finalEntries.reduce((total, [goodId, amount]) => {
    const good = goodById.get(+goodId);
    const sellPrice = good?.sellPrice ?? good?.value ?? 0;
    const sellValue = amount * sellPrice;
    const ingredientCost = good?.recipes?.length ? mfgCostByGood[+goodId] || 0 : 0;
    return total + sellValue - ingredientCost;
  }, 0);

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
      <span title="Raw revenue + MFG profit"><b>Net wealth:</b> <span style="${netWealth >= 0 ? `${styles.positive};font-weight:600` : `${styles.negative};font-weight:600`}">${rn(netWealth, 2)}</span></span>
    </div>`;

  const finalTable = finalRows
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
      </table>${summaryHtml}`
    : `<i style="${styles.empty}">No output produced</i>`;

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent" style="max-height:65vh;overflow-y:auto">
      ${statsHtml}
      ${renderSection("Goods Pool", poolTable)}
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

  $("#alert").dialog({width: "48em", resizable: true, title: `Production Overview: ${burg.name}`});
}

declare global {
  interface Window {
    ProductionOverview: {open: typeof open};
  }
}

window.ProductionOverview = {open};
