import { ensureEl, formatPrice, rn } from "../utils";

let isInitialized = false;
let activeGoodId = -1;

function open(goodId?: number, anchor = "#marketsOverview"): void {
  if (goodId !== undefined) activeGoodId = goodId;
  rebuildGoodSelect();
  addLines();

  $("#marketsGoodCompare").dialog({
    title: "Compare Prices",
    position: { my: "right top", at: "left-10 top", of: anchor, collision: "fit" }
  });

  if (!isInitialized) {
    ensureEl("marketsGoodCompareSelect").on("change", () => {
      activeGoodId = +ensureEl<HTMLSelectElement>("marketsGoodCompareSelect").value;
      addLines();
    });
    ensureEl("marketsGoodCompareRefresh").on("click", addLines);
    ensureEl("marketsGoodComparePercentage").on("click", togglePercentageMode);
    ensureEl("marketsGoodCompareExport").on("click", downloadCsv);
    isInitialized = true;
  }
}

function addLines(): void {
  const body = ensureEl("marketsGoodCompareBody");
  if (body.dataset.type === "percentage") body.dataset.type = "absolute";

  const good = activeGoodId >= 0 ? Goods.get(activeGoodId) : undefined;
  if (!good) {
    body.innerHTML = "Select a good";
    updateFooter(0, 0);
    return;
  }

  let lines = "";
  let totalStock = 0;
  let priceSum = 0;

  for (const market of pack.markets) {
    const centerName = Markets.getName(market);
    const goodData = market.goods[good.i];
    const stock = rn(goodData?.stock ?? 0, 2);
    const price = rn(goodData?.price ?? 0, 2);
    totalStock += stock;
    priceSum += price;

    lines += /*html*/ `<div class="states" data-id="${market.i}" data-market="${centerName}" data-stock="${stock}" data-price="${price}">
      <fill-box fill="${market.color}"></fill-box>
      <div style="width:9em">${centerName}</div>
      <div data-type="stock" style="width:5em">${stock}</div>
      <div style="width:7em">${formatPrice(price)}</div>
    </div>`;
  }
  body.innerHTML = lines;
  updateFooter(rn(totalStock, 2), rn(priceSum / pack.markets.length, 2));
  applySorting(ensureEl("marketsGoodCompareHeader"));
  $("#marketsGoodCompare").dialog({ width: fitContent() });
}

function updateFooter(totalStock: number, avgPrice: number): void {
  ensureEl("marketsGoodCompareFooterStock").innerHTML = String(totalStock);
  ensureEl("marketsGoodCompareFooterPrice").innerHTML = formatPrice(avgPrice);
}

function togglePercentageMode(): void {
  const body = ensureEl("marketsGoodCompareBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const rows = Array.from(body.querySelectorAll<HTMLElement>(":scope > div"));
    let totalStock = 0;
    for (const row of rows) {
      totalStock += +row.dataset.stock! || 0;
    }
    rows.forEach(row => {
      row.querySelectorAll<HTMLElement>("div[data-type]").forEach(cell => {
        const type = cell.dataset.type!;
        const val = +row.dataset[type]! || 0;
        cell.textContent = totalStock ? `${rn((val / totalStock) * 100, 2)}%` : "0%";
      });
    });
  } else {
    body.dataset.type = "absolute";
    addLines();
  }
}

function downloadCsv(): void {
  const good = activeGoodId >= 0 ? Goods.get(activeGoodId) : undefined;
  const goodName = good?.name ?? "Unknown";
  let csv = `Market,Stock (${goodName}),Price (${goodName})\n`;
  for (const market of pack.markets) {
    const centerName = Markets.getName(market);
    const goodData = good ? market.goods[good.i] : undefined;
    const stock = rn(goodData?.stock ?? 0, 2);
    const price = rn(goodData?.price ?? 0, 2);
    csv += `${centerName},${stock},${price}\n`;
  }
  downloadFile(csv, `${getFileName(`Compare_Prices_${goodName}`)}.csv`);
}

function rebuildGoodSelect(): void {
  const select = ensureEl<HTMLSelectElement>("marketsGoodCompareSelect");
  const prev = activeGoodId >= 0 ? activeGoodId : +select.value;
  const sortedGoods = [...pack.goods].sort((a, b) => a.name.localeCompare(b.name));
  select.innerHTML = sortedGoods
    .map(g => `<option value="${g.i}" ${g.i === prev ? "selected" : ""}>${g.name}</option>`)
    .join("");
  if (prev >= 0 && Goods.get(prev)) {
    activeGoodId = prev;
    select.value = String(prev);
  } else {
    activeGoodId = sortedGoods[0]?.i ?? 0;
    select.value = String(activeGoodId);
  }
}

export const ComparePrices = { open };
