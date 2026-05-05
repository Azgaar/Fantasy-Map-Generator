import type {Good} from "../modules/goods-generator";

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
      title: `Production Overview — ${burg.name}`,
      buttons: {
        Close: function () {
          $(this).dialog("close");
        }
      }
    });
    return;
  }

  const goodById = new Map(pack.goods.map((g: Good) => [g.i, g]));
  const goodName = (id: number) => goodById.get(id)?.name ?? `#${id}`;
  const goodColor = (id: number) => goodById.get(id)?.color ?? "#888";
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const styles = {
    muted: "color:#777",
    subtle: "color:#999",
    divider: "color:#bbb",
    positive: "color:#2a6",
    negative: "color:#c44",
    warning: "color:#c84",
    sectionTitle: "font-weight:600;border-bottom:1px solid #ccc;padding-bottom:.3em;margin-bottom:.45em;font-size:1em",
    statsBar: "margin-bottom:.85em;display:flex;flex-wrap:wrap;gap:.85em;font-size:.92em;",
    table: "width:100%;border-collapse:collapse;font-size:.92em;line-height:1.35",
    headRow: "background:#eee",
    bodyRow: "border-bottom:1px solid #f0f0f0",
    buyRow: "background:#fffaf2;border-bottom:1px solid #f3e4c7",
    cell: "padding:.38em .55em;vertical-align:top",
    cellRight: "padding:.38em .55em;vertical-align:top;text-align:right",
    debugRow: "display:none;background:#fafafa;border-bottom:1px solid #ececec",
    debugCell: "padding:0 .5em;",
    empty: "color:#888;font-style:italic",
    summaryBar:
      "display:flex;gap:1.2em;flex-wrap:wrap;background:#f0f5f0;border-radius:4px;padding:.55em .8em;margin-top:.6em;font-size:.9em;line-height:1.4"
  };

  const goodDot = (id: number) => {
    const color = goodColor(id);
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,0.2);margin-right:6px;vertical-align:middle;flex-shrink:0"></span>`;
  };

  const typeBadge = (kind: "RAW" | "MFG" | "BUY") => {
    if (kind === "RAW") {
      return `<span style="display:inline-block;background:#f0e8e8;color:#a44;border-radius:3px;padding:.08em .38em;font-size:.78em;font-weight:600">RAW</span>`;
    }
    if (kind === "BUY") {
      return `<span style="display:inline-block;background:#f6ead8;color:#b06a00;border-radius:3px;padding:.08em .38em;font-size:.78em;font-weight:600">BUY</span>`;
    }
    return `<span style="display:inline-block;background:#e8f0e8;color:#4a4;border-radius:3px;padding:.08em .38em;font-size:.78em;font-weight:600">MFG</span>`;
  };

  const renderGoodLabel = (id: number, suffix = "") => `${goodDot(id)}${goodName(id)}${suffix}`;
  const renderDataCell = (content: string, align: "left" | "right" = "left", extra = "") =>
    `<td style="${align === "right" ? styles.cellRight : styles.cell}${extra ? `;${extra}` : ""}">${content}</td>`;
  const renderHeaderCell = (content: string, align: "left" | "right" = "left", title = "") =>
    `<th style="${align === "right" ? styles.cellRight : styles.cell}"${title ? ` title="${title}"` : ""}>${content}</th>`;
  const renderSection = (title: string, content: string) =>
    `<div style="margin-bottom:.9em"><div style="${styles.sectionTitle}">${title}</div>${content}</div>`;
  const renderValueCell = (label: string, value: number, positive = true) =>
    renderDataCell(`${label}: ${r2(value)}`, "right", `${positive ? styles.positive : styles.warning}`);
  const renderDecisionDetails = (
    decisionDebug?: {
      summary: string;
      candidateCount: number;
      alternatives: Array<{kind: "extract" | "manufacture"; goodId: number; score: number; summary: string}>;
    } | null
  ) => {
    if (!decisionDebug) return "";
    const alternatives = decisionDebug.alternatives.length
      ? decisionDebug.alternatives.map(option => `<div style="margin-top:.2em">• ${option.summary}</div>`).join("")
      : `<div style="margin-top:.2em;${styles.subtle}">No other feasible alternatives</div>`;

    return /*html*/ `<div>
      <div><b>Decision basis:</b> highest score among ${decisionDebug.candidateCount} feasible options.</div>
      <div style="margin-top:.2em"><b>Selected:</b> ${decisionDebug.summary}</div>
      <div style="margin-top:.35em"><b>Alternatives:</b>${alternatives}</div>
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
          ? ` <span style="${styles.positive};font-size:.9em">(+${r2(goodPull.chainValue - baseValue)})</span>`
          : "";
      const buyPrice = r2(data.pricesAtStart.buy[goodPull.goodId] ?? baseValue);
      const buyColor = buyPrice > baseValue ? styles.warning : buyPrice < baseValue ? styles.positive : "";

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(renderGoodLabel(goodPull.goodId))}
        ${renderDataCell(String(r2(goodPull.pull)), "right")}
        ${renderDataCell(`${r2(goodPull.chainValue)}${chainExtra}`, "right")}
        ${renderDataCell(String(r2(goodPull.priority)), "right", "font-weight:600")}
        ${renderDataCell(String(buyPrice), "right", buyColor)}
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
    const debugId = `productionStepDebug${stepIndex++}`;
    const debugHtml = renderDecisionDetails(job.decisionDebug);
    const rowAttrs = debugHtml
      ? ` data-debug-target="${debugId}" style="${styles.bodyRow};cursor:pointer" title="Click to expand decision details"`
      : ` style="${styles.bodyRow}"`;

    if (job.kind === "extract") {
      const cultureSuffix =
        job.cultureModifier !== 1
          ? ` <span style="${styles.muted};font-size:.9em" title="Culture bonus">x${r2(job.cultureModifier)}</span>`
          : "";

      const details = "Local resource production";
      return [
        /*html*/ `<tr${rowAttrs}>
        ${renderDataCell(typeBadge("RAW"))}
        ${renderDataCell(renderGoodLabel(job.goodId, cultureSuffix))}
        ${renderDataCell(String(r2(job.units)), "right")}
        <td style="${styles.cell}">${details}</td>
        ${
          job.projectedGain !== undefined
            ? renderValueCell("Gain", job.projectedGain, job.projectedGain >= 0)
            : renderDataCell("—", "right", styles.subtle)
        }
      </tr>`,
        debugHtml
          ? /*html*/ `<tr id="${debugId}" style="${styles.debugRow}">
        <td colspan="5" style="${styles.debugCell}">${debugHtml}</td>
      </tr>`
          : ""
      ];
    }

    const buyItems = job.recipe.filter(item => item.fromMarket > 0);
    const rows: string[] = [];

    if (buyItems.length) {
      for (const item of buyItems) {
        rows.push(/*html*/ `<tr style="${styles.buyRow}">
          ${renderDataCell(typeBadge("BUY"))}
          ${renderDataCell(renderGoodLabel(item.goodId))}
          ${renderDataCell(String(r2(item.fromMarket)), "right")}
          <td style="${styles.cell}">Market purchase for ${goodDot(job.goodId)}${goodName(job.goodId)}</td>
          ${renderValueCell("Spent", item.marketCost, false)}
        </tr>`);
      }
    }

    const cultureSuffix =
      job.cultureModifier !== 1
        ? ` <span style="${styles.muted};font-size:.9em" title="Culture bonus">x${r2(job.cultureModifier)}</span>`
        : "";
    const allInputs = job.recipe
      .map(item => {
        const total = item.fromInventory + item.fromMarket;
        return total > 0 ? `${renderGoodLabel(item.goodId)} ${r2(total)}` : "";
      })
      .filter(Boolean)
      .join(` <span style="${styles.divider}">+</span> `);
    const details = allInputs ? `Manufacturing from ${allInputs}` : "Manufacturing";

    rows.push(/*html*/ `<tr${rowAttrs}>
      ${renderDataCell(typeBadge("MFG"))}
      ${renderDataCell(renderGoodLabel(job.goodId, cultureSuffix))}
      ${renderDataCell(String(r2(job.units)), "right")}
      <td style="${styles.cell}">${details}</td>
      ${job.score !== undefined ? renderValueCell("Gain", job.score, job.score >= 0) : renderDataCell("—", "right", styles.subtle)}
    </tr>`);

    if (debugHtml) {
      rows.push(/*html*/ `<tr id="${debugId}" style="${styles.debugRow}">
      <td colspan="5" style="${styles.debugCell}">${debugHtml}</td>
    </tr>`);
    }

    return rows;
  });

  const jobsTable = stepRows.length
    ? /*html*/ `<table style="${styles.table}">
        <thead><tr style="${styles.headRow}">
          ${renderHeaderCell("Type")}
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
  let totalRawRevenue = 0;
  let totalMfgRevenue = 0;
  let totalMfgCost = 0;

  for (const [goodId, amount] of finalEntries) {
    const good = goodById.get(+goodId);
    const sellPrice = good?.sellPrice ?? good?.value ?? 0;
    if (good?.recipes?.length) {
      totalMfgRevenue += amount * sellPrice;
      totalMfgCost += mfgCostByGood[+goodId] || 0;
    } else {
      totalRawRevenue += amount * sellPrice;
    }
  }

  const mfgProfit = totalMfgRevenue - totalMfgCost;
  const netWealth = totalRawRevenue + mfgProfit;

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
      const badge = typeBadge(isManufactured ? "MFG" : "RAW");
      const sellValue = amount * sellPrice;
      const sellColor =
        sellPrice < baseValue * 0.99 ? styles.warning : sellPrice > baseValue * 1.01 ? styles.positive : "";

      if (isManufactured) {
        const ingredientCost = mfgCostByGood[id] || 0;
        const profit = sellValue - ingredientCost;
        const margin = sellValue > 0 ? Math.round((profit / sellValue) * 100) : 0;
        const costPerUnit = amount > 0 ? r2(ingredientCost / amount) : "—";
        const profitColor = profit >= 0 ? styles.positive : styles.negative;

        return /*html*/ `<tr style="${styles.bodyRow}">
          ${renderDataCell(`${renderGoodLabel(id)}${badge ? ` <span style="margin-left:4px">${badge}</span>` : ""}`)}
          ${renderDataCell(String(r2(amount)), "right")}
          ${renderDataCell(String(costPerUnit), "right", styles.muted)}
          ${renderDataCell(String(r2(sellPrice)), "right", sellColor)}
          ${renderDataCell(String(r2(sellValue)), "right")}
          ${renderDataCell(`${r2(profit)} <span style="font-size:.9em;${styles.muted}">(${margin}%)</span>`, "right", profitColor)}
        </tr>`;
      }

      return /*html*/ `<tr style="${styles.bodyRow}">
        ${renderDataCell(`${renderGoodLabel(id)} <span style="margin-left:4px">${badge}</span>`)}
        ${renderDataCell(String(r2(amount)), "right")}
        ${renderDataCell("—", "right", styles.subtle)}
        ${renderDataCell(String(r2(sellPrice)), "right", sellColor)}
        ${renderDataCell(String(r2(sellValue)), "right")}
        ${renderDataCell("—", "right", styles.subtle)}
      </tr>`;
    })
    .join("");

  const summaryHtml = /*html*/ `
    <div style="${styles.summaryBar}">
      <span title="Revenue from raw goods"><b>Raw:</b> ${r2(totalRawRevenue)}</span>
      <span title="Revenue from manufactured goods before subtracting ingredient costs"><b>MFG revenue:</b> ${r2(totalMfgRevenue)}</span>
      <span title="Total ingredient cost spent on market purchases"><b>MFG cost:</b> ${r2(totalMfgCost)}</span>
      <span title="MFG revenue minus ingredient cost"><b>MFG profit:</b> <span style="${mfgProfit >= 0 ? styles.positive : styles.negative}">${r2(mfgProfit)}</span></span>
      <span title="Raw revenue + MFG profit"><b>Net wealth:</b> <span style="${netWealth >= 0 ? `${styles.positive};font-weight:600` : `${styles.negative};font-weight:600`}">${r2(netWealth)}</span></span>
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
    <div id="productionOverviewContent" style="max-height:65vh;overflow-y:auto;font-size:1em">
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
      const row = target.closest<HTMLTableRowElement>("tr[data-debug-target]");
      if (!row) return;

      const debugId = row.dataset.debugTarget;
      if (!debugId) return;
      const detailsRow = overviewContent.querySelector<HTMLTableRowElement>(`#${debugId}`);
      if (!detailsRow) return;

      const isOpen = detailsRow.style.display !== "none";
      detailsRow.style.display = isOpen ? "none" : "table-row";
    };
  }

  $("#alert").dialog({
    width: "48em",
    resizable: true,
    title: `Production Overview — ${burg.name}`,
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

declare global {
  interface Window {
    ProductionOverview: {open: typeof open};
  }
}

window.ProductionOverview = {open};
