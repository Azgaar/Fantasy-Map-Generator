import type {Burg} from "../modules/burgs-generator";
import type {DemandCategory} from "../modules/goods-generator";
import {DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY, DEMAND_TARGET_FACTORS} from "../modules/goods-generator";
import type {DecisionCandidate, DemandEffect} from "../modules/production-generator";
import type {Deal} from "../modules/trade-generator";
import {getPackPolygon, rn} from "../utils";

type Type = "RAW" | "MFG" | "BUY" | "SELL";
const RESOURCE_CELLS_LAYER = "productionOverviewResourceCells";

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

  const getDealSpent = (deal: Deal) => deal.units * deal.prices.marketBuy;
  const getSellerTaxRate = (deal: Deal) => {
    if (deal.phase !== "local-sale") return 0;
    const seller = pack.burgs[deal.sellerId];
    return seller ? Trade.getSalesTaxRate(seller) : 0;
  };
  const getDealTax = (deal: Deal) => {
    if (deal.phase !== "local-sale") return 0;
    return deal.units * deal.prices.marketSell * getSellerTaxRate(deal);
  };
  const getDealRevenue = (deal: Deal) => deal.units * deal.prices.marketSell;
  const getDealNetRevenue = (deal: Deal) => getDealRevenue(deal) - getDealTax(deal);

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
    {
      productionBuyDeals: [] as Deal[],
      burgSaleDeals: [] as Deal[],
      demandFillDeals: [] as Deal[]
    }
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
  const modifierBadge = (modifier: number) =>
    `<span style="display:inline-block;margin-left:4px;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35;background:#edf1f4;color:#5f6f7a" title="Culture type production modifier. Produced units are multiplied by this value.">x${rn(modifier, 2)}</span>`;

  const renderGoodLabel = (id: number, suffix = "") => `${goodDot(id)}${goodName(id)}${suffix}`;
  const renderDataCell = (content: string | number, align: "left" | "right" = "left", extra = "") =>
    `<td style="${align === "right" ? styles.cellRight : styles.cell}${extra ? `;${extra}` : ""}">${content}</td>`;
  const renderHeaderCell = (content: string, align: "left" | "right" = "left", title = "") =>
    `<th style="${align === "right" ? styles.cellRight : styles.cell}"${title ? ` title="${title}"` : ""}>${content}</th>`;
  const renderSection = (title: string, content: string, titleTooltip = "") =>
    `<div style="margin-bottom:.9em"><div style="${styles.sectionTitle}"${titleTooltip ? ` title="${titleTooltip}"` : ""}>${title}</div>${content}</div>`;
  const renderPriceCell = (value: number | string, extra = "") => renderDataCell(formatPrice(value), "right", extra);
  const renderIncomeCell = (value: number) => {
    const extraStyle = value >= 0 ? styles.positive : styles.warning;
    return `<td style="${styles.cellRight};${extraStyle}">${formatPrice(value)}</td>`;
  };
  const renderTable = (params: {
    colWidths: string[];
    headers: Array<{label: string; align?: "left" | "right"; title?: string}>;
    rows: string[];
    empty: string;
  }) => {
    const {colWidths, headers, rows, empty} = params;
    if (!rows.length) return `<i style="${styles.empty}">${empty}</i>`;

    return /*html*/ `<table style="${styles.table}">
      <colgroup>${colWidths.map(width => `<col style="width: ${width};">`).join("")}</colgroup>
      <thead><tr style="${styles.headRow}">${headers
        .map(header => renderHeaderCell(header.label, header.align || "left", header.title || ""))
        .join("")}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
  };
  const renderSummaryBar = (
    items: Array<{
      label: string;
      value: string;
      title: string;
      valueStyle?: string;
    }>
  ) =>
    /*html*/ `<div style="${styles.summaryBar}">${items
      .map(
        item =>
          `<span title="${item.title}"><b>${item.label}:</b> <span style="font-weight:600; ${item.valueStyle || ""}">${item.value}</span></span>`
      )
      .join("")}</div>`;

  const renderTaggedGood = (id: number, type: Type, suffix = "") =>
    `${renderGoodLabel(id, suffix)} <span style="margin-left:4px">${typeBadge(type)}</span>`;
  const renderLogRow = (targetId: string, detailsHtml: string) =>
    detailsHtml
      ? /*html*/ `<tr id="${targetId}" style="display:none">
          <td colspan="4" style="${styles.detailsCell}">${detailsHtml}</td>
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

      return `${typeBadge("RAW")} <b>${goodName(candidate.goodId)}</b>: ${factors.join(" × ")} = ${renderCandidateScore(candidate.score)}`;
    }

    const margin = Math.max(0, candidate.revenue - candidate.ingredientCost);
    const ingredients = candidate.ingredients
      .map(ingredient => {
        const sources = [
          ingredient.amount === ingredient.fromInventory ? "from inventory" : null,
          ingredient.fromInventory > 0 && ingredient.amount !== ingredient.fromInventory
            ? `${rn(ingredient.fromInventory, 2)} from inventory`
            : null,
          ingredient.amount === ingredient.fromMarket ? "from market" : null,
          ingredient.fromMarket > 0 && ingredient.amount !== ingredient.fromMarket
            ? `${rn(ingredient.fromMarket, 2)} from market`
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

    return `<div>${typeBadge("MFG")} <b>${goodName(candidate.goodId)}</b>: ${factors.join(" × ")} = ${renderCandidateScore(candidate.score)}</div>
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
  const renderCalculationDetails = (expression: string, value: number, label: string) =>
    /*html*/ `<div><b>Deal calculation:</b> ${expression} = <b>${formatPrice(value)}</b> ${label}</div>`;
  const renderBuyDetails = (units: number, unitPrice: number, totalCost: number) =>
    renderCalculationDetails(`unit ${rn(units, 2)} × buy price ${rn(unitPrice, 2)}`, -totalCost, "spent");
  const renderSaleDetails = (deal: Deal) =>
    renderCalculationDetails(
      `unit ${rn(deal.units, 2)} × sell price ${rn(deal.prices.marketSell, 2)} - sales tax ${rn(getDealTax(deal), 2)}`,
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
    const {targetId, goodId, type, units, details, income, detailsHtml} = params;
    return [
      /*html*/ `<tr data-target="${targetId}" style="${styles.bodyRow};cursor:pointer" title="Click to expand deal details">
        ${renderDataCell(renderTaggedGood(goodId, type))}
        ${renderDataCell(rn(units, 2), "right")}
        <td style="${styles.cell}">${details}</td>
        ${renderIncomeCell(income)}
      </tr>`,
      renderLogRow(targetId, detailsHtml)
    ];
  };
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
  const phaseRevenue = burgSaleDeals.reduce((sum, deal) => sum + getDealNetRevenue(deal), 0);
  const ingredientCosts = productionBuyDeals.reduce((sum, deal) => sum + getDealSpent(deal), 0);
  const grossProduct = phaseRevenue - ingredientCosts;
  const totalTax = burgSaleDeals.reduce((sum, deal) => sum + getDealTax(deal), 0);
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
  const {resources: burgResources, cells: resourceCells} = Production.collectBurgResources(burg, globalResources);
  renderResourceCellsDebugLayer(resourceCells);

  const accessibleResourceRows = Object.entries(burgResources)
    .sort((a, b) => b[1] - a[1])
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
    ? renderTable({
        colWidths: ["30%", "10%", "20%", "40%"],
        headers: [
          {label: "Resource"},
          {label: "Units", align: "right", title: "Raw units from flood-fill cells"},
          {label: "Base Price", align: "right", title: "Authored reference price for this resource"},
          {
            label: "Demand Coverage",
            align: "right",
            title: "Demand categories this accessible resource can help cover at current pulled units"
          }
        ],
        rows: [accessibleResourceRows],
        empty: "No goods reached this burg"
      })
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
      const cultureSuffix = job.cultureModifier !== 1 ? ` ${modifierBadge(job.cultureModifier)}` : "";

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

    const cultureSuffix = job.cultureModifier !== 1 ? ` ${modifierBadge(job.cultureModifier)}` : "";
    const allInputs = job.recipe
      .map(item => `${rn(item.fromInventory + item.fromMarket, 2)} ${goodDot(item.goodId)}`)
      .join(` and `);

    const buyItems = job.recipe.filter(item => item.fromMarket > 0.001);
    for (const item of buyItems) {
      const detailsId = `deal-details-${stepIndex++}`;
      rows.push(
        ...renderExpandableDealRow({
          targetId: detailsId,
          goodId: item.goodId,
          type: "BUY",
          units: item.fromMarket,
          details: `Market purchase for ${goodDot(job.goodId)} production`,
          income: -item.marketCost,
          detailsHtml: renderBuyDetails(item.fromMarket, item.marketCost / item.fromMarket, item.marketCost)
        })
      );
    }

    rows.push(/*html*/ `<tr${rowAttrs}>
       ${renderDataCell(renderTaggedGood(job.goodId, "MFG", cultureSuffix))}
       ${renderDataCell(rn(job.units, 2), "right")}
       <td style="${styles.cell}">${`Manufacturing from ${allInputs}`}</td>
       ${renderDataCell("", "right", styles.subtle)}
     </tr>`);
    rows.push(renderLogRow(candidatesId, candidatesHtml));

    return rows;
  });

  const demandFillRows = demandFillDeals.flatMap(deal => {
    demandFillUnitsByGood[deal.goodId] = (demandFillUnitsByGood[deal.goodId] || 0) + deal.units;
    const detailsId = `deal-details-${stepIndex++}`;
    return renderExpandableDealRow({
      targetId: detailsId,
      goodId: deal.goodId,
      type: "BUY",
      units: deal.units,
      details: "Demand fill from local market",
      income: -getDealSpent(deal),
      detailsHtml: renderBuyDetails(deal.units, deal.prices.marketBuy, getDealSpent(deal))
    });
  });

  const saleRows = burgSaleDeals.flatMap(deal => {
    const detailsId = `deal-details-${stepIndex++}`;
    return renderExpandableDealRow({
      targetId: detailsId,
      goodId: deal.goodId,
      type: "SELL",
      units: deal.units,
      details: "Sale to local market",
      income: getDealNetRevenue(deal),
      detailsHtml: renderSaleDetails(deal)
    });
  });

  const jobsTableRows = [...stepRows, ...saleRows, ...demandFillRows];
  const jobsTable = renderTable({
    colWidths: ["30%", "10%", "40%", "20%"],
    headers: [
      {label: "Good"},
      {label: "Units", align: "right"},
      {label: "Details"},
      {
        label: "Income",
        align: "right",
        title: "Money flow for deal rows: negative for BUY, positive for SELL. Pure production rows are blank."
      }
    ],
    rows: jobsTableRows,
    empty: "No production actions recorded"
  });

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

  const demandSummaryHtml = renderSummaryBar([
    {
      label: "Uncovered Demand",
      value: renderDemand(uncoveredDemand, true) || "none",
      title: "Initial demand minus final covered demand"
    }
  ]);

  const historySummaryHtml = renderSummaryBar([
    {
      label: "Gross Product",
      value: formatPrice(grossProduct),
      title:
        "Gross Product is local sale revenue minus purchased ingredient costs during the production. It excludes retained inventory and later demand-fill purchases.",
      valueStyle: grossProduct >= 0 ? styles.positive : styles.negative
    },
    {
      label: "Weath",
      value: formatPrice(productPerCapita),
      title:
        "Gross product per population point. This is the burg's gross product divided by population, a per-capita productivity measure for the current production run.",
      valueStyle: productPerCapita >= 0 ? styles.positive : styles.negative
    },
    {
      label: "Total Tax",
      value: formatPrice(totalTax),
      title:
        "Sales tax is paid by the seller on local sale deals. It is deducted from gross sale value and transferred to the state treasury.",
      valueStyle: totalTax >= 0 ? styles.warning : styles.subtle
    },
    {
      label: "Treasury",
      value: formatPrice(wealthAfter),
      title: "Net burg treasury after local buying, local sales, and final local demand fill.",
      valueStyle: wealthAfter >= 0 ? styles.positive : styles.negative
    }
  ]);

  const historySection = `${jobsTable}${historySummaryHtml}`;

  const finalTableContent = renderTable({
    colWidths: ["30%", "10%", "15%", "15%", "30%"],
    headers: [
      {label: "Good"},
      {label: "Units", align: "right"},
      {
        label: "Unit Cost",
        align: "right",
        title: "Average purchased-input cost per locally produced unit. Raw and bought goods stay at 0."
      },
      {
        label: "Allocated Cost",
        align: "right",
        title: "Purchased-input cost allocated to retained locally produced units."
      },
      {
        label: "Demand Coverage",
        align: "right",
        title: "Demand categories covered by the retained units in this row."
      }
    ],
    rows: finalRows ? [finalRows] : [],
    empty: "No output produced"
  });

  const finalTable = `${finalTableContent}${demandSummaryHtml}`;

  alertMessage.innerHTML = /*html*/ `
    <div id="productionOverviewContent">
      ${statsHtml}
      ${renderSection("Accessible Resources", accessibleResourcesTable, "Raw resources reachable by this burg before production choices are made.")}
      ${renderSection("Production and Trade history", historySection, "Chronological local production, market purchases, sales, and demand-fill operations for this burg.")}
      ${renderSection("Retained Inventory", finalTable, "Goods kept after production and market interaction to cover this burg's own demand.")}
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
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"},
    close: () => {
      debug.select(`#${RESOURCE_CELLS_LAYER}`).remove();
    }
  });
}

function renderResourceCellsDebugLayer(resourceCells: number[]): void {
  debug.select(`#${RESOURCE_CELLS_LAYER}`).remove();
  const layer = debug.append("g").attr("id", RESOURCE_CELLS_LAYER).attr("pointer-events", "none");

  layer
    .selectAll("polygon")
    .data(resourceCells)
    .enter()
    .append("polygon")
    .attr("points", (cellId: number) => getPackPolygon(cellId, pack))
    .attr("fill", "#4a90e24d")
    .attr("stroke", "#2f5f9e")
    .attr("stroke-width", 0.5);
}

declare global {
  interface Window {
    ProductionOverview: {open: typeof open};
  }
}

window.ProductionOverview = {open};
