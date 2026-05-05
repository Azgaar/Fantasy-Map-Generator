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
          <th style="text-align:right;padding:.2em .4em" title="Raw units from flood-fill cells">Units</th>
          <th style="text-align:right;padding:.2em .4em" title="Elevated by downstream profitable chains">Chain Value</th>
          <th style="text-align:right;padding:.2em .4em" title="Pool × chain value × food bonus (initial queue key)">Priority</th>
          <th style="text-align:right;padding:.2em .4em" title="Buy price when this burg was processed">Buy Price</th>
        </tr></thead>
        <tbody>${poolRows}</tbody>
      </table>`
          : /*html*/ `<i style="color:#888">No goods reached this burg</i>`
      }
    </div>`;

  // ── Section 3: Production Steps ────────────────────────────────────────
  // Manufacture jobs may include a market-buy phase that spends money but not a worker.
  // Show these as separate rows so the decision sequence is readable step-by-step.
  const stepRows = data.jobs.flatMap(job => {
    const workerNo = Math.ceil(job.tick);

    if (job.kind === "extract") {
      const cultureMod =
        job.cultureModifier !== 1
          ? ` <span style="color:#888;font-size:.78em" title="Culture bonus">x${r2(job.cultureModifier)}</span>`
          : "";
      const details = [
        `Extract from local pool`,
        job.projectedGain !== undefined
          ? `<span style="color:${job.projectedGain >= 0 ? "#2a6" : "#c44"}">Plan gain: ${r2(job.projectedGain)}</span>`
          : ""
      ]
        .filter(Boolean)
        .join(` <span style="color:#bbb">|</span> `);

      return [
        /*html*/ `<tr>
        <td style="padding:.2em .4em;color:#888;font-size:.8em">${workerNo}</td>
        <td style="padding:.2em .4em"><span style="background:#f0e8e8;color:#a44;font-size:.72em;padding:0 3px;border-radius:2px">RAW</span></td>
        <td style="padding:.2em .4em">${goodDot(job.goodId)}${goodName(job.goodId)}${cultureMod}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(job.units)}</td>
        <td style="padding:.2em .4em;color:#555">${details}</td>
      </tr>`
      ];
    }

    const buyItems = job.recipe.filter(r => r.fromMarket > 0);
    const useItems = job.recipe.filter(r => r.fromInventory > 0);
    const rows: string[] = [];

    if (buyItems.length) {
      const boughtText = buyItems
        .map(r => `${goodDot(r.goodId)}${goodName(r.goodId)} ${r2(r.fromMarket)} for ${r2(r.marketCost)}`)
        .join(` <span style="color:#bbb">+</span> `);
      const totalSpent = buyItems.reduce((sum, r) => sum + r.marketCost, 0);

      rows.push(/*html*/ `<tr style="background:#fffaf2">
        <td style="padding:.2em .4em;color:#aaa;font-size:.8em">-</td>
        <td style="padding:.2em .4em"><span style="background:#f6ead8;color:#b06a00;font-size:.72em;padding:0 3px;border-radius:2px">BUY</span></td>
        <td style="padding:.2em .4em">Market purchase</td>
        <td style="text-align:right;padding:.2em .4em;color:#aaa">—</td>
        <td style="padding:.2em .4em;font-size:.82em;color:#555">${boughtText} <span style="color:#bbb">|</span> <span style="color:#b06a00">Spent ${r2(totalSpent)}</span></td>
      </tr>`);
    }

    const usedText = useItems.length
      ? `Used stock: ${useItems.map(r => `${goodDot(r.goodId)}${goodName(r.goodId)} ${r2(r.fromInventory)}`).join(` <span style="color:#bbb">+</span> `)}`
      : "Used stock: none";
    const boughtInputsText = buyItems.length
      ? `Bought: ${buyItems.map(r => `${goodDot(r.goodId)}${goodName(r.goodId)} ${r2(r.fromMarket)}`).join(` <span style="color:#bbb">+</span> `)}`
      : "Bought: none";
    const cultureMod =
      job.cultureModifier !== 1
        ? ` <span style="color:#888;font-size:.78em" title="Culture bonus">x${r2(job.cultureModifier)}</span>`
        : "";
    const details = [
      usedText,
      boughtInputsText,
      job.score !== undefined
        ? `<span style="color:${job.score >= 0 ? "#2a6" : "#c44"}">Plan gain: ${r2(job.score)}</span>`
        : ""
    ]
      .filter(Boolean)
      .join(` <span style="color:#bbb">|</span> `);

    rows.push(/*html*/ `<tr>
      <td style="padding:.2em .4em;color:#888;font-size:.8em">${workerNo}</td>
      <td style="padding:.2em .4em"><span style="background:#e8f0e8;color:#4a4;font-size:.72em;padding:0 3px;border-radius:2px">MFG</span></td>
      <td style="padding:.2em .4em">${goodDot(job.goodId)}${goodName(job.goodId)}${cultureMod}</td>
      <td style="text-align:right;padding:.2em .4em">${r2(job.units)}</td>
      <td style="padding:.2em .4em;color:#555">${details}</td>
    </tr>`);

    return rows;
  });

  const jobRows = stepRows.join("");

  const jobsHtml = /*html*/ `
    <div style="margin-bottom:.8em">
      <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
        Production Steps
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
  // Accumulate ingredient cost per manufactured good from job log
  const mfgCostByGood: Record<number, number> = {};
  for (const job of data.jobs) {
    if (job.kind === "manufacture" && job.recipe) {
      // marketCost is the actual wealth spent; fromInventory items are opportunity-cost only
      const marketSpend = job.recipe.reduce((s, r) => s + r.marketCost, 0);
      mfgCostByGood[job.goodId] = (mfgCostByGood[job.goodId] || 0) + marketSpend;
    }
  }

  const finalEntries = Object.entries(data.finalInventory).filter(([, v]) => v > 0);

  // Totals first pass
  let totalRawRevenue = 0;
  let totalMfgRevenue = 0;
  let totalMfgCost = 0;
  for (const [gid, amount] of finalEntries) {
    const g = goodById.get(+gid);
    const sp = g?.sellPrice ?? g?.value ?? 0;
    if (g?.recipes?.length) {
      totalMfgRevenue += amount * sp;
      totalMfgCost += mfgCostByGood[+gid] || 0;
    } else {
      totalRawRevenue += amount * sp;
    }
  }
  const mfgProfit = totalMfgRevenue - totalMfgCost;
  const netWealth = totalRawRevenue + mfgProfit;

  const finalRows = finalEntries
    .sort(([aid, a], [bid, b]) => {
      const aM = Boolean(goodById.get(+aid)?.recipes?.length);
      const bM = Boolean(goodById.get(+bid)?.recipes?.length);
      if (aM !== bM) return aM ? -1 : 1;
      return (b as number) - (a as number);
    })
    .map(([gid, amount]) => {
      const id = +gid;
      const g = goodById.get(id);
      const sp = g?.sellPrice ?? g?.value ?? 0;
      const bv = g?.value ?? 0;
      const isManufactured = Boolean(g?.recipes?.length);
      const typeBadge = isManufactured
        ? `<span style="background:#e8f0e8;color:#4a4;font-size:.75em;padding:0 3px;border-radius:2px;margin-left:3px">MFG</span>`
        : `<span style="background:#f0e8e8;color:#a44;font-size:.75em;padding:0 3px;border-radius:2px;margin-left:3px">RAW</span>`;
      const sellValue = amount * sp;

      if (isManufactured) {
        const ingrCost = mfgCostByGood[id] || 0;
        const profit = sellValue - ingrCost;
        const margin = sellValue > 0 ? Math.round((profit / sellValue) * 100) : 0;
        const costPerUnit = amount > 0 ? r2(ingrCost / amount) : "—";
        const profitColor = profit >= 0 ? "color:#2a6" : "color:#c44";
        const spColor = sp < bv * 0.99 ? "color:#c84" : sp > bv * 1.01 ? "color:#4a4" : "";
        return `<tr>
          <td style="padding:.2em .4em">${goodDot(id)}${goodName(id)}${typeBadge}</td>
          <td style="text-align:right;padding:.2em .4em">${r2(amount)}</td>
          <td style="text-align:right;padding:.2em .4em;color:#888">${costPerUnit}</td>
          <td style="text-align:right;padding:.2em .4em;${spColor}">${r2(sp)}</td>
          <td style="text-align:right;padding:.2em .4em">${r2(sellValue)}</td>
          <td style="text-align:right;padding:.2em .4em;${profitColor}">${r2(profit)} <span style="font-size:.78em;color:#888">(${margin}%)</span></td>
        </tr>`;
      } else {
        const spColor = sp < bv * 0.99 ? "color:#c84" : sp > bv * 1.01 ? "color:#4a4" : "";
        return `<tr>
          <td style="padding:.2em .4em">${goodDot(id)}${goodName(id)}${typeBadge}</td>
          <td style="text-align:right;padding:.2em .4em">${r2(amount)}</td>
          <td style="text-align:right;padding:.2em .4em;color:#aaa">—</td>
          <td style="text-align:right;padding:.2em .4em;${spColor}">${r2(sp)}</td>
          <td style="text-align:right;padding:.2em .4em">${r2(sellValue)}</td>
          <td style="text-align:right;padding:.2em .4em;color:#aaa">—</td>
        </tr>`;
      }
    })
    .join("");

  const wealthColor = netWealth > 0 ? "color:#2a6;font-weight:bold" : "color:#c44;font-weight:bold";
  const summaryHtml = /*html*/ `
    <div style="display:flex;gap:1.2em;flex-wrap:wrap;background:#f0f5f0;border-radius:4px;padding:.4em .8em;margin-top:.5em;font-size:.83em">
      <span title="Revenue from raw goods"><b>Raw:</b> ${r2(totalRawRevenue)}</span>
      <span title="Revenue from manufactured goods before subtracting ingredient costs"><b>MFG revenue:</b> ${r2(totalMfgRevenue)}</span>
      <span title="Total ingredient cost consumed in manufacturing"><b>MFG cost:</b> ${r2(totalMfgCost)}</span>
      <span title="MFG revenue minus ingredient cost"><b>MFG profit:</b> <span style="${mfgProfit >= 0 ? "color:#2a6" : "color:#c44"}">${r2(mfgProfit)}</span></span>
      <span title="Raw revenue + MFG profit — total value created after subtracting all input costs"><b>Net wealth:</b> <span style="${wealthColor}">${r2(netWealth)}</span></span>
    </div>`;

  const finalHtml = /*html*/ `
    <div>
      <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
        Final Output
      </div>
      ${
        finalRows
          ? `<table style="width:100%;border-collapse:collapse;font-size:.82em">
        <thead><tr style="background:#eee">
          <th style="text-align:left;padding:.2em .4em">Good</th>
          <th style="text-align:right;padding:.2em .4em">Units</th>
          <th style="text-align:right;padding:.2em .4em" title="Average ingredient cost per unit (MFG only)">Cost/unit</th>
          <th style="text-align:right;padding:.2em .4em">Sell price</th>
          <th style="text-align:right;padding:.2em .4em">Revenue</th>
          <th style="text-align:right;padding:.2em .4em" title="Revenue minus ingredient cost (MFG only)">Profit</th>
        </tr></thead>
        <tbody>${finalRows}</tbody>
      </table>
      ${summaryHtml}`
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
