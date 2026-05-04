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

  // pack.goods is shuffled during generation; must look up by good.i, not array position
  const goodById = new Map(pack.goods.map((g: Good) => [g.i, g]));
  const goodName = (id: number) => goodById.get(id)?.name ?? `#${id}`;
  const goodColor = (id: number) => goodById.get(id)?.color ?? "#888";
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const goodDot = (id: number) => {
    const c = goodColor(id);
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,0.2);margin-right:3px;vertical-align:middle;flex-shrink:0"></span>`;
  };

  // ── Section 1: Stats bar ────────────────────────────────────────────────
  const cellPct = data.cellsBudget > 0 ? Math.round((data.cellsReached / data.cellsBudget) * 100) : 0;
  const statsHtml = /*html*/ `
    <div style="background:#f5f5f5;border-radius:4px;padding:.4em .8em;margin-bottom:.8em;display:flex;flex-wrap:wrap;gap:.8em;font-size:.85em">
      <span><b>Population:</b> ${data.population}</span>
      <span><b>Cells:</b> ${data.cellsReached} / ${data.cellsBudget} (${cellPct}%)</span>
      <span><b>Culture type:</b> ${data.cultureType}</span>
      <span><b>Process rank:</b> #${data.processRank} of ${data.totalBurgs}</span>
    </div>`;

  // ── Section 2: Goods Pool ───────────────────────────────────────────────
  const poolRows = data.goodsPull
    .map(g => {
      const baseVal = goodById.get(g.goodId)?.value ?? 0;
      const cvExtra =
        g.chainValue > baseVal + 0.01
          ? ` <span style="color:#4a4;font-size:.78em">(+${r2(g.chainValue - baseVal)})</span>`
          : "";
      const buyP = r2(data.pricesAtStart.buy[g.goodId] ?? baseVal);
      const buyColor = buyP > baseVal ? "color:#c84" : buyP < baseVal ? "color:#4a4" : "";
      return /*html*/ `<tr>
        <td style="padding:.2em .4em">${goodDot(g.goodId)}${goodName(g.goodId)}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(g.pull)}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(g.chainValue)}${cvExtra}</td>
        <td style="text-align:right;padding:.2em .4em;font-weight:bold">${r2(g.priority)}</td>
        <td style="text-align:right;padding:.2em .4em;${buyColor}">${buyP}</td>
      </tr>`;
    })
    .join("");

  const poolHtml = /*html*/ `
    <div style="margin-bottom:.8em">
      <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
        Goods Pool
      </div>
      ${
        poolRows
          ? /*html*/ `<table style="width:100%;border-collapse:collapse;font-size:.82em">
        <thead><tr style="background:#eee">
          <th style="text-align:left;padding:.2em .4em">Good</th>
          <th style="text-align:right;padding:.2em .4em" title="Raw units from flood-fill cells">Pool</th>
          <th style="text-align:right;padding:.2em .4em" title="Elevated by downstream profitable chains">Chain Value</th>
          <th style="text-align:right;padding:.2em .4em" title="Pool × chain value × food bonus (initial queue key)">Priority</th>
          <th style="text-align:right;padding:.2em .4em" title="Buy price when this burg was processed">Buy Price</th>
        </tr></thead>
        <tbody>${poolRows}</tbody>
      </table>`
          : /*html*/ `<i style="color:#888">No goods reached this burg</i>`
      }
    </div>`;

  // ── Section 3: Population Jobs ──────────────────────────────────────────
  const jobRows = data.jobs
    .map(job => {
      const workerLabel = `<td style="padding:.2em .4em;color:#888;font-size:.8em">${Math.ceil(job.tick)}</td>`;
      const typeBadge = job.isRaw
        ? `<span style="background:#f0e8e8;color:#a44;font-size:.72em;padding:0 3px;border-radius:2px">RAW</span>`
        : `<span style="background:#e8f0e8;color:#4a4;font-size:.72em;padding:0 3px;border-radius:2px">MFG</span>`;
      const cultureMod =
        job.cultureModifier !== 1
          ? `<span style="color:#888;font-size:.78em" title="Culture bonus"> ×${r2(job.cultureModifier)}</span>`
          : "";
      const recipeText = job.recipe?.length
        ? `<span style="color:#888;font-size:.8em">&nbsp;(${job.recipe
            .map(r => `${goodDot(r.goodId)}${r2(r.consumed)}`)
            .join(" + ")})</span>`
        : "";
      const profitText =
        job.profit !== undefined
          ? `<span style="color:${job.profit > 0 ? "#4a4" : "#c44"};font-size:.78em" title="profit per unit"> +${r2(job.profit)}</span>`
          : "";
      return `<tr>
        ${workerLabel}
        <td style="padding:.2em .4em">${typeBadge}</td>
        <td style="padding:.2em .4em">${goodDot(job.goodId)}${goodName(job.goodId)}${cultureMod}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(job.units)}</td>
        <td style="padding:.2em .4em;font-size:.82em;color:#555">${recipeText}${profitText}</td>
      </tr>`;
    })
    .join("");

  const jobsHtml = /*html*/ `
    <div style="margin-bottom:.8em">
      <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
        Production Distribution
      </div>
      ${
        jobRows
          ? /*html*/ `<table style="width:100%;border-collapse:collapse;font-size:.82em">
        <thead><tr style="background:#eee">
          <th style="text-align:left;padding:.2em .4em">Worker</th>
          <th style="text-align:left;padding:.2em .4em">Type</th>
          <th style="text-align:left;padding:.2em .4em">Good</th>
          <th style="text-align:right;padding:.2em .4em">Units</th>
          <th style="text-align:left;padding:.2em .4em">Details</th>
        </tr></thead>
        <tbody>${jobRows}</tbody>
      </table>`
          : /*html*/ `<i style="color:#888">No production actions recorded</i>`
      }
    </div>`;

  // ── Section 4: Final Output ─────────────────────────────────────────────
  const finalEntries = Object.entries(data.finalInventory).filter(([, v]) => v > 0);
  const finalTotalValue = finalEntries.reduce((s, [gid, amt]) => {
    const g = goodById.get(+gid);
    const sp = g?.sellPrice ?? g?.value ?? 0;
    return s + amt * sp;
  }, 0);

  const finalRows = finalEntries
    .sort(([, a], [, b]) => b - a)
    .map(([gid, amount]) => {
      const id = +gid;
      const g = goodById.get(id);
      const sp = g?.sellPrice ?? g?.value ?? 0;
      const bv = g?.value ?? 0;
      const isManufactured = Boolean(g?.recipes?.length);
      const typeBadge = isManufactured
        ? `<span style="background:#e8f0e8;color:#4a4;font-size:.75em;padding:0 3px;border-radius:2px;margin-left:3px">MFG</span>`
        : `<span style="background:#f0e8e8;color:#a44;font-size:.75em;padding:0 3px;border-radius:2px;margin-left:3px">RAW</span>`;
      const spColor = sp < bv * 0.99 ? "color:#c84" : sp > bv * 1.01 ? "color:#4a4" : "";
      return `<tr>
        <td style="padding:.2em .4em">${goodDot(id)}${goodName(id)}${typeBadge}</td>
        <td style="text-align:right;padding:.2em .4em">${amount}</td>
        <td style="text-align:right;padding:.2em .4em;${spColor}">${r2(sp)}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(amount * sp)}</td>
      </tr>`;
    })
    .join("");

  const finalHtml = /*html*/ `
    <div>
      <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
        Final Output — total market value: <b>${r2(finalTotalValue)}</b>
      </div>
      ${
        finalRows
          ? `<table style="width:100%;border-collapse:collapse;font-size:.82em">
        <thead><tr style="background:#eee">
          <th style="text-align:left;padding:.2em .4em">Good</th>
          <th style="text-align:right;padding:.2em .4em">Units</th>
          <th style="text-align:right;padding:.2em .4em">Sell Price</th>
          <th style="text-align:right;padding:.2em .4em">Value</th>
        </tr></thead>
        <tbody>${finalRows}</tbody>
        <tfoot><tr style="background:#f5f5f5;font-weight:bold">
          <td colspan="3" style="text-align:right;padding:.2em .4em">Total:</td>
          <td style="text-align:right;padding:.2em .4em">${r2(finalTotalValue)}</td>
        </tfoot>
      </table>`
          : `<i style="color:#888">No output produced</i>`
      }
    </div>`;

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent" style="max-height:65vh;overflow-y:auto">
      ${statsHtml + poolHtml + jobsHtml + finalHtml}
    </div>
  `;

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
