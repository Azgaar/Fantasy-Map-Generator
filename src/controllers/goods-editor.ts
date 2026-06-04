import { pointer } from "d3";
import { CULTURE_TYPES } from "../modules/cultures-generator";
import type { DemandCategory, Good } from "../modules/goods-generator";
import { BONUS_RESOURCE_PRODUCTION, DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY } from "../modules/goods-generator";
import { isDealRecord, isMfgRecord } from "../modules/production-generator";
import { drawGoods, toggleGoods } from "../renderers/draw-goods";
import { ensureEl, getRandomColor, unique } from "../utils";
import { DistributionEditor } from "./goods-distribution-editor";
import { ProductionChains } from "./production-chains";

let isInitialized = false;
const visibleTags = new Set<string>();
const displayedGoods = new Set<number>();
let displayedGoodsInitialized = false;

function ensureDisplayedGoodsInitialized() {
  if (displayedGoodsInitialized) return;
  displayedGoodsInitialized = true;
  if (!pack.goods?.length) return;

  const production = getProduction();
  let bestId = pack.goods[0].i;
  let bestTotal = -1;
  for (const good of pack.goods) {
    const p = production[good.i];
    const total = p ? p.burg + p.cell + p.bonus : 0;
    if (total > bestTotal) {
      bestTotal = total;
      bestId = good.i;
    }
  }
  displayedGoods.add(bestId);
}

function getDisplayedGoods(): Set<number> {
  ensureDisplayedGoodsInitialized();
  for (const id of displayedGoods) if (!Goods.get(id)) displayedGoods.delete(id); // drop goods removed since selection
  return displayedGoods;
}

export function open() {
  if (customization) return;
  closeDialogs("#goodsEditor, .stable");

  ensureDisplayedGoodsInitialized();
  if (!layerIsOn("toggleGoods")) toggleGoods();
  else drawGoods(displayedGoods);

  goodsEditorAddLines();

  $("#goodsEditor").dialog({
    title: "Goods Editor",
    close: closeGoodsEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });

  if (!isInitialized) {
    ensureEl("goodsEditorRefresh").on("click", goodsEditorAddLines);
    ensureEl("goodsPercentage").on("click", togglePercentageMode);
    ensureEl("goodsTagsFilter").on("click", openTagsVisibilityDialog);
    ensureEl("goodsAssign").on("click", enterResourceAssignMode);
    ensureEl("goodsAdd").on("click", () => editGoodDialog());
    ensureEl("goodsRestore").on("click", goodsRestoreDefaults);
    ensureEl("goodsExport").on("click", downloadGoodsData);
    ensureEl("goodsDisplayAll").on("change", toggleAllDisplayed);
    ensureEl("goodsChains").on("click", () => ProductionChains.open());
    ensureEl("goodsRegenerateGoods").on("click", requestGoodsRegeneration);
    ensureEl("goodsRegenerateProduction").on("click", requestProductionRegeneration);

    ensureEl("goodsBody").on("click", ev => {
      const el = ev.target as HTMLElement;
      const cl = el.classList;
      const line = el.parentNode as HTMLElement;
      const good = Goods.get(+line.dataset.id!);
      if (!good) return;
      if (cl.contains("goodEdit")) return editGoodDialog(good);
      if (cl.contains("goodDisplayed")) return toggleDisplayedGood(good, el as HTMLInputElement);
      if (cl.contains("icon-trash-empty")) return removeGood(good, line);
    });

    isInitialized = true;
  }
}

function goodsEditorAddLines() {
  const body = ensureEl("goodsBody");
  const production = getProduction();
  const stockData = getAllStockData();
  let lines = "";

  const renderTypeBadge = (type: string) => {
    const commonStyles =
      "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
    if (type === "RAW")
      return `<span style="${commonStyles};background:#d0e7f5;color:#036" data-tip="Raw goods are produced by rural population in cells based on biome availability and in cells and burgs when bonus resource is assigned to cells">RAW</span>`;
    return `<span style="${commonStyles};background:#f8e7bf;color:#b67a00" data-tip="Manufactured goods are produced in burgs">MFG</span>`;
  };

  for (const good of pack.goods) {
    const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean) as string[];
    const goodProduction = production[good.i] || { burg: 0, cell: 0, bonus: 0 };
    const produced = rn(goodProduction.burg + goodProduction.cell + goodProduction.bonus);
    const producedTip = `Total good production: ${produced}⚒. Burgs: ${rn(goodProduction.burg, 2)}⚒. Cells: ${rn(goodProduction.cell, 2)}⚒. Bonus resource: ${rn(goodProduction.bonus, 2)}⚒ (${BONUS_RESOURCE_PRODUCTION}⚒ per cell with explicit good assigned)`;
    const stock = rn(stockData[good.i]?.total ?? 0);
    const stockTip = `Total stock in all markets and burg inventories: ${stock} units`;

    lines += /*html*/ `<div class="states goods" data-id=${good.i} data-name="${good.name}" data-color="${good.color}" data-baseprice="${good.value}" data-produced="${produced}" data-stock="${stock}" data-type="${types.join(",")}" data-tags="${good.tags?.join(",")}">
        <input type="checkbox" data-tip="Toggle this good on the Goods map" class="native goodDisplayed hide" style="padding: 0; margin: 0; vertical-align: middle; width: 1.2em;" ${displayedGoods.has(good.i) ? "checked" : ""} />
        <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
          <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <div data-tip="Good name" class="goodName">${good.name}</div>
        <div data-tip="Good types" class="goodType" style="width: 6em;">${types.map(renderTypeBadge).join(" ")}</div>
        <div data-tip="${producedTip}. Click to see burgs producing this good" class="goodProduced pointer hide" style="vertical-align: middle;">
          <div style="display: inline-block;">${produced}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.5em;">⚒</div>
        </div>
        <div data-tip="${stockTip}. Click to see breakdown by location" class="goodStock pointer hide" style="vertical-align: middle;">
          <div style="display: inline-block;">${stock}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.2em;">⛁</div>
        </div>
        <div data-tip="Base (initial) price. Click to compare prices across markets" class="goodBasePrice pointer hide">🟡 ${good.value}</div>
        <span data-tip="Edit good" class="icon-pencil goodEdit hide"></span>
        <span data-tip="Remove good" class="icon-trash-empty hide goodRemove"></span>
      </div>`;
  }
  body.innerHTML = lines;

  const totalProduced = Object.values(production)
    .map(p => p.burg + p.cell + p.bonus)
    .reduce((sum, v) => sum + v, 0);
  const totalStock = Object.values(stockData).reduce((sum, d) => sum + d.total, 0);
  ensureEl("goodsDisplayed").innerHTML = String(displayedGoods.size);
  ensureEl("goodsNumber").innerHTML = String(pack.goods.length);
  ensureEl("goodsProduced").innerHTML = String(rn(totalProduced));
  ensureEl("goodsStock").innerHTML = String(rn(totalStock));

  body.querySelectorAll("div.states").forEach(el => void el.on("click", selectResourceOnLineClick));
  body.querySelectorAll<HTMLButtonElement>(".goodProduced").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      openProducersDialog(Number(el.parentElement?.dataset?.id));
    });
  });

  body.querySelectorAll<HTMLElement>(".goodStock").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      const goodId = Number((el.closest<HTMLElement>(".states") as HTMLElement).dataset.id);
      openStockDialog(goodId);
    });
  });

  body.querySelectorAll<HTMLElement>(".goodBasePrice").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      const goodId = Number((el.closest<HTMLElement>(".states") as HTMLElement).dataset.id);
      window.ComparePrices.open(goodId, "#goodsEditor");
    });
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  updateDisplayAllCheckbox();
  applySorting(ensureEl("goodsHeader")!);
  applyTagVisibilityFilter();
  $("#goodsEditor").dialog({ width: fitContent() });
}

function openProducersDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const producers = pack.burgs
    .filter(b => b.i && !b.removed)
    .map(b => ({ burg: b, units: Production.getBurgProduction(b)[goodId] ?? 0 }))
    .filter(({ units }) => units > 0)
    .sort((a, b) => b.units - a.units);

  if (!producers.length) {
    alertMessage.innerHTML = `<i style="color:#888">No burgs produced ${good.name}.</i>`;
  } else {
    const header = /*html*/ `
          <div class="header" style="grid-template-columns: 1.6em 7em 4em;">
            <div></div>
            <div>Burg</div>
            <div>Units</div>
         </div>`;
    const rows = producers
      .map(
        ({ burg, units }) => /*html*/ `
          <div data-tip="Click to zoom to burg" class="states pointer" data-x="${burg.x} " data-y="${burg.y}" data-id="${burg.i}">
            <div class="icon-dot-circled" style="width:1em"></div>
            <div style="width:7em;">${burg.name}</div>
            <div style="width:4em;">${units}</div>
          </div>`
      )
      .join("");
    alertMessage.innerHTML = header + rows;
    alertMessage.querySelectorAll<HTMLElement>(".states").forEach(row => {
      row.on("click", () => {
        zoomTo(Number(row.dataset.x), Number(row.dataset.y), 8, 2000);
      });
    });
  }

  $("#alert").dialog({
    resizable: false,
    title: `${good.name} producers`,
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

type StockSource = { name: string; type: "market" | "burg"; x: number; y: number; id: number; stock: number };

function getAllStockData(): Record<number, { total: number; sources: StockSource[] }> {
  const dealById = new Map((pack.deals || []).map(d => [d.i, d]));
  const result: Record<number, { total: number; sources: StockSource[] }> = {};
  for (const good of pack.goods) result[good.i] = { total: 0, sources: [] };

  for (const market of pack.markets || []) {
    const centerBurg = pack.burgs[market.centerBurgId];
    if (!centerBurg) continue;
    const x = centerBurg.x ?? 0;
    const y = centerBurg.y ?? 0;
    const marketName = centerBurg.name || `Market ${market.i}`;

    for (const [goodIdStr, { stock }] of Object.entries(market.goods)) {
      const goodId = +goodIdStr;
      if (!result[goodId] || stock <= 0) continue;
      result[goodId].total += stock;
      result[goodId].sources.push({ name: marketName, type: "market", x, y, id: market.i, stock });
    }
  }

  for (const burg of pack.burgs as any[]) {
    if (!burg?.i || burg.removed || !burg.production) continue;

    const netInventory: Record<number, number> = {};
    for (const record of burg.production) {
      if (isMfgRecord(record)) {
        netInventory[record.goodId] = (netInventory[record.goodId] || 0) + record.units;
        for (const item of record.recipe) {
          netInventory[item.goodId] = (netInventory[item.goodId] || 0) - item.units;
        }
      } else if (isDealRecord(record)) {
        const deal = dealById.get(record.dealId);
        if (!deal) continue;
        if (deal.buyerType === "burg" && deal.buyer === burg.i) {
          netInventory[deal.good] = (netInventory[deal.good] || 0) + deal.units;
        } else if (deal.sellerType === "burg" && deal.seller === burg.i) {
          netInventory[deal.good] = (netInventory[deal.good] || 0) - deal.units;
        }
      } else {
        netInventory[record.goodId] = (netInventory[record.goodId] || 0) + record.units;
      }
    }

    for (const [goodIdStr, units] of Object.entries(netInventory)) {
      const goodId = +goodIdStr;
      if (!result[goodId] || units <= 0.001) continue;
      const roundedUnits = rn(units, 2);
      result[goodId].total += roundedUnits;
      result[goodId].sources.push({
        name: burg.name || `Burg ${burg.i}`,
        type: "burg",
        x: burg.x ?? 0,
        y: burg.y ?? 0,
        id: burg.i,
        stock: roundedUnits
      });
    }
  }

  for (const good of pack.goods) result[good.i].total = rn(result[good.i].total, 2);

  return result;
}

function openStockDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const stockData = getAllStockData();
  const data = stockData[goodId];
  const sources = data?.sources ?? [];

  if (!sources.length) {
    alertMessage.innerHTML = `<i style="color:#888">No stock of ${good.name} found in any market or burg inventory.</i>`;
  } else {
    const header = /*html*/ `
      <div class="header" style="grid-template-columns: 1.6em 7em 4em;">
        <div></div>
        <div>Location</div>
        <div>Units</div>
      </div>`;
    const rows = [...sources]
      .sort((a, b) => b.stock - a.stock)
      .map(
        source => /*html*/ `
        <div data-tip="Click to zoom to location" class="states pointer" data-x="${source.x}" data-y="${source.y}" data-id="${source.id}">
          <div class="${source.type === "market" ? "icon-store" : "icon-dot-circled"}" style="width:1em"></div>
          <div style="width:7em;">${source.name}</div>
          <div style="width:4em;">${source.stock}</div>
        </div>`
      )
      .join("");
    alertMessage.innerHTML = header + rows;
    alertMessage.querySelectorAll<HTMLElement>(".states").forEach(row => {
      row.on("click", () => {
        zoomTo(Number(row.dataset.x), Number(row.dataset.y), 8, 2000);
      });
    });
  }

  $("#alert").dialog({
    resizable: false,
    title: `${good.name} stock`,
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

function getProduction() {
  const production: Record<number, { burg: number; cell: number; bonus: number }> = {};
  const addProduction = (goodId: number, amount: number, type: "burg" | "cell" | "bonus") => {
    if (!production[goodId]) production[goodId] = { burg: 0, cell: 0, bonus: 0 };
    production[goodId][type] += amount;
  };

  // rural production
  const productionByBiome = Goods.getBiomesProduction();
  for (const cellId of pack.cells.i) {
    const biomeId = pack.cells.biome[cellId];
    const bonusGoodId = pack.cells.good[cellId];

    if (bonusGoodId) addProduction(bonusGoodId, BONUS_RESOURCE_PRODUCTION, "bonus");

    const population = pack.cells.pop[cellId];
    if (population <= 0) continue;

    for (const { goodId, production } of productionByBiome[biomeId] || []) {
      addProduction(goodId, population * production, "cell");
    }
  }

  // burg production
  for (const burg of pack.burgs) {
    if (!burg || burg.removed || !burg.production) continue;
    const produced = Production.getBurgProduction(burg);
    for (const goodId in produced) {
      addProduction(Number(goodId), produced[goodId] || 0, "burg");
    }
  }

  return production;
}

function openTagsVisibilityDialog() {
  const tags = unique(pack.goods.flatMap(good => good.tags));
  const renderTag = (tag: string) =>
    `<label style="display: flex; align-items: center;"><input type="checkbox" class="native" value="${tag}" ${visibleTags.has(tag) ? "checked" : ""} /> ${tag}</label>`;
  const tagsMarkup = tags.length ? tags.map(renderTag).join("") : '<div style="color:#666">No tags available</div>';

  alertMessage.innerHTML = `
    <div data-tip="Only goods with at least one selected tag remain visible in the editor list" style="display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 0.3em;">${tagsMarkup}</div>
  `;

  $("#alert").dialog({
    resizable: false,
    title: "Filter goods by tags",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      "Clear filter": function () {
        visibleTags.clear();
        applyTagVisibilityFilter();
        $(this).dialog("close");
      },
      Apply: function () {
        const checks = Array.from(alertMessage.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked"));
        visibleTags.clear();
        checks.forEach(check => void visibleTags.add(check.value));
        applyTagVisibilityFilter();
        $(this).dialog("close");
      }
    }
  });
}

function applyTagVisibilityFilter() {
  const body = ensureEl("goodsBody");
  const hasFilter = visibleTags.size > 0;

  body.querySelectorAll<HTMLElement>(":scope > div.states").forEach(line => {
    const lineTags = line.dataset.tags?.split(",") || [];
    const matches = !hasFilter || lineTags.some(tag => visibleTags.has(tag));
    line.classList.toggle("hidden", !matches);
  });

  const filterBtn = ensureEl("goodsTagsFilter");
  if (filterBtn) filterBtn.classList.toggle("active", hasFilter);
}

function uploadImage(type: "image" | "svg", callback: (type: string, id: string) => void) {
  const input = ensureEl<HTMLInputElement>(type === "image" ? "imageToLoad" : "svgToLoad");
  const file = input.files![0];
  input.value = "";

  if (file.size > 200000) {
    tip(
      `File is too big, please optimize file size up to 200kB and re-upload. Recommended size is 48x48 px and up to 10kB`,
      true,
      "error",
      5000
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = readerEvent => {
    const target = readerEvent.target;
    if (!target) return;

    const result = target.result as string;
    const id = `good-custom-${Math.random().toString(36).slice(-6)}`;
    const goodIcons = ensureEl("good-icons");

    if (type === "image") {
      const svg = /*html*/ `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><image x="0" y="0" width="200" height="200" href="${result}"/></svg>`;
      goodIcons.insertAdjacentHTML("beforeend", svg);
    } else {
      const el = document.createElement("html");
      el.innerHTML = result;

      el.querySelectorAll("*").forEach(el => {
        const attributes = el.getAttributeNames();
        attributes.forEach(attr => {
          if (attr.includes("inkscape") || attr.includes("sodipodi")) el.removeAttribute(attr);
        });
      });

      if (result.includes("from the Noun Project")) el.querySelectorAll("text").forEach(textEl => void textEl.remove());

      const svg = el.querySelector("svg");
      if (!svg)
        return void tip(
          "The file should be prepared for load to FMG. If you don't know why it's happening, try to upload raster image",
          false,
          "error"
        );

      const icon = goodIcons.appendChild(svg);
      icon.id = id;
      icon.setAttribute("width", "200");
      icon.setAttribute("height", "200");
    }

    callback(type, id);
  };

  if (type === "image") reader.readAsDataURL(file);
  else reader.readAsText(file);
}

function goodsRestoreDefaults() {
  confirmationDialog({
    title: "Restore default goods",
    message: "Are you sure you want to restore default goods? <br>This action cannot be reverted",
    confirm: "Restore",
    onConfirm: regenerateGoods
  });
}

function togglePercentageMode() {
  const body = ensureEl("goodsBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    let totalProduced = 0;
    let totalStock = 0;

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      totalProduced += +el.dataset.produced! || 0;
      totalStock += +el.dataset.stock! || 0;
    });

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      const producedEl = el.querySelector<HTMLElement>(".goodProduced");
      if (producedEl) {
        const produced = +el.dataset.produced! || 0;
        producedEl.innerHTML = `${rn(totalProduced ? (produced / totalProduced) * 100 : 0, 2)}%`;
      }
      const stockEl = el.querySelector<HTMLElement>(".goodStock");
      if (stockEl) {
        const stock = +el.dataset.stock! || 0;
        stockEl.innerHTML = `${rn(totalStock ? (stock / totalStock) * 100 : 0, 2)}%`;
      }
    });
  } else {
    body.dataset.type = "absolute";
    goodsEditorAddLines();
  }
}

function enterResourceAssignMode(this: HTMLElement) {
  if (this.classList.contains("pressed")) return exitResourceAssignMode();
  customization = 14;
  this.classList.add("pressed");
  if (!layerIsOn("toggleGoods")) toggleGoods();
  if (!layerIsOn("toggleCells")) {
    ensureEl<HTMLButtonElement>("toggleCells").dataset.forced = "true";
    toggleCells();
  }

  ensureEl("goodsEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("goodsHeader").style = "grid-template-columns: 7.5em 6em; margin-left: 22px;";

  $("#goodsEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  tip("Select good line in editor, click on cells to remove or add a bonus resource", true);
  viewbox.on("click", changeResourceOnCellClick);
}

function selectResourceOnLineClick(this: HTMLElement) {
  if (customization !== 14) return;
  const body = ensureEl("goodsBody");
  body.querySelector<HTMLElement>("div.selected")?.classList.remove("selected");
  this.classList.add("selected");
}

function changeResourceOnCellClick(this: SVGElement) {
  const body = ensureEl("goodsBody");
  const point = pointer(event, this);
  const cellId = findCell(...point);
  if (cellId === undefined) return;

  const selected = body.querySelector<HTMLElement>("div.selected");
  if (!selected) return;

  if (pack.cells.good[cellId]) {
    pack.cells.good[cellId] = 0;
  } else {
    const resourceId = +selected.dataset.id!;
    const resource = Goods.get(resourceId);
    if (!resource) return;
    pack.cells.good[cellId] = resourceId;
    displayedGoods.add(resourceId); // keep the freshly assigned good visible on the map
  }

  drawGoods(displayedGoods);
}

function exitResourceAssignMode(close?: string) {
  const body = ensureEl("goodsBody");
  customization = 0;
  ensureEl("goodsAssign").classList.remove("pressed");

  if (layerIsOn("toggleCells")) {
    const toggler = ensureEl<HTMLButtonElement>("toggleCells");
    if (toggler.dataset.forced) toggleCells();
    delete toggler.dataset.forced;
  }

  ensureEl("goodsEditor")
    .querySelectorAll(".hide")
    .forEach(el => void el.classList.remove("hidden"));
  ensureEl("goodsHeader").style = "grid-template-columns: 4em 7.4em 7em 6.8em 6em 4.6em 1.6em;";

  if (!close) goodsEditorAddLines();

  restoreDefaultEvents();
  clearMainTip();
  const selected = body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

type MultiplierDimKey = "cultureType" | "culture" | "state" | "religion" | "biome";

function getMultiplierEntityName(dim: MultiplierDimKey, id: string): string {
  if (dim === "cultureType") return id;
  if (dim === "culture") return pack.cultures[+id]?.name ?? `Culture ${id}`;
  if (dim === "state") return pack.states[+id]?.name ?? `State ${id}`;
  if (dim === "religion") return pack.religions[+id]?.name ?? `Religion ${id}`;
  return biomesData.name[+id] ?? `Biome ${id}`;
}

function openMultiplierPopup(
  dim: MultiplierDimKey,
  currentValues: Partial<Record<string, number>>,
  onApply: (values: Partial<Record<string, number>>) => void
) {
  type Entity = { id: string; name: string; color?: string };

  let entities: Entity[];
  let label: string;

  switch (dim) {
    case "cultureType":
      entities = CULTURE_TYPES.map(ct => ({ id: ct, name: ct }));
      label = "Culture Type";
      break;
    case "culture":
      entities = pack.cultures
        .filter(c => c.i && !c.removed)
        .map(c => ({ id: String(c.i), name: c.name, color: c.color }));
      label = "Culture";
      break;
    case "state":
      entities = pack.states
        .filter(s => s.i && !s.removed)
        .map(s => ({ id: String(s.i), name: s.fullName || s.name, color: s.color }));
      label = "State";
      break;
    case "religion":
      entities = pack.religions
        .filter(r => r.i && !r.removed)
        .map(r => ({ id: String(r.i), name: r.name, color: r.color }));
      label = "Religion";
      break;
    case "biome":
      entities = biomesData.i.map(id => ({ id: String(id), name: biomesData.name[id], color: biomesData.color[id] }));
      label = "Biome";
      break;
  }

  const rows = entities.map(entity => {
    const val = currentValues[entity.id] ?? 1;
    const dot = `<span style="display:inline-block; width:.85em; height:.85em; border-radius:50%; background:${entity.color || getRandomColor()}; flex-shrink:0;"></span>`;
    return `${dot}<span>${entity.name}</span><input type="number" class="mPopupInput" data-id="${entity.id}" min="0" step="0.1" style="width:5em;" value="${val}" />`;
  });

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `
    <div style="max-height:320px; overflow-y:auto; padding:.2em;">
      <div style="display:grid; grid-template-columns:auto 1fr 5em; gap:.3em .5em; align-items:center;">${rows.join("")}</div>
    </div>
  `;

  $(popupEl).dialog({
    title: `${label} multipliers`,
    width: "22em",
    resizable: false,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const inputs = Array.from(popupEl.querySelectorAll<HTMLInputElement>(".mPopupInput"));
        const result: Partial<Record<string, number>> = {};
        for (const input of inputs) {
          const id = input.dataset.id!;
          const v = Number(input.value);
          if (Number.isFinite(v) && v >= 0 && v !== 1) result[id] = v;
        }
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function openDemandCoveragePopup(
  currentValues: Partial<Record<DemandCategory, number>>,
  onApply: (values: Partial<Record<DemandCategory, number>>) => void
) {
  const rows = DEMAND_PRIORITY.map(cat => {
    const val = currentValues[cat] ?? 0;
    return `<span>${DEMAND_CATEGORY_ICONS[cat]} ${capitalize(cat)}</span><input type="number" class="dcPopupInput" data-cat="${cat}" min="0" step="0.05" style="width:5em;" value="${val}" />`;
  }).join("");

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 5em;gap:.3em .5em;align-items:center;padding:.2em;">${rows}</div>`;

  $(popupEl).dialog({
    title: "Demand Coverage",
    width: "18em",
    resizable: false,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const result: Partial<Record<DemandCategory, number>> = {};
        popupEl.querySelectorAll<HTMLInputElement>(".dcPopupInput").forEach(input => {
          const cat = input.dataset.cat as DemandCategory;
          const v = Number(input.value);
          if (Number.isFinite(v) && v > 0) result[cat] = v;
        });
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function openBiomeProductionPopup(
  currentValues: Partial<Record<number, number>>,
  onApply: (values: Partial<Record<number, number>>) => void
) {
  const rows = (biomesData.i as number[])
    .map(id => {
      const val = currentValues[id] ?? 0;
      return `<span>${biomesData.name[id] ?? `Biome ${id}`}</span><input type="number" class="bpPopupInput" data-id="${id}" min="0" step="0.01" style="width:5em;" value="${val}" />`;
    })
    .join("");

  const popupEl = document.createElement("div");
  document.body.appendChild(popupEl);
  popupEl.innerHTML = `<div style="max-height:320px;overflow-y:auto;padding:.2em;"><div style="display:grid;grid-template-columns:1fr 5em;gap:.3em .5em;align-items:center;">${rows}</div></div>`;

  $(popupEl).dialog({
    title: "Biome Baseline Production",
    width: "22em",
    resizable: false,
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const result: Partial<Record<number, number>> = {};
        popupEl.querySelectorAll<HTMLInputElement>(".bpPopupInput").forEach(input => {
          const id = Number(input.dataset.id!);
          const v = Number(input.value);
          if (Number.isFinite(v) && v > 0) result[id] = v;
        });
        onApply(result);
        $(this).dialog("close");
      }
    },
    close: () => {
      $(popupEl).dialog("destroy");
      popupEl.remove();
    }
  });
}

function editGoodDialog(editedGood?: Good) {
  const icons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const renderIconOption = (icon: string) =>
    /*html*/ `<option value="${icon}" ${editedGood?.icon === icon ? "selected" : ""}>${icon}</option>`;

  const demandCoverageState: Partial<Record<DemandCategory, number>> = { ...(editedGood?.demandCoverage || {}) };
  const biomeOutputState: Partial<Record<number, number>> = { ...(editedGood?.biomeOutput || {}) };

  const demandCoverageSummary = (): string => {
    const entries = DEMAND_PRIORITY.map(cat => [cat, demandCoverageState[cat] ?? 0] as const).filter(([, v]) => v > 0);
    if (!entries.length) return "none";
    return entries.map(([cat, v]) => `${DEMAND_CATEGORY_ICONS[cat]} ${capitalize(cat)}: ${v}`).join(", ");
  };

  const biomeOutputSummary = (): string => {
    const entries = Object.entries(biomeOutputState).filter(([, v]) => (v ?? 0) > 0);
    if (!entries.length) return "none";
    return entries.map(([id, v]) => `${biomesData.name[Number(id)]}: ${v}`).join(", ");
  };

  const multipliers: { [K in MultiplierDimKey]?: Partial<Record<string, number>> } = {
    cultureType: { ...((editedGood?.multipliers?.cultureType as any) ?? {}) },
    culture: { ...((editedGood?.multipliers?.culture as any) ?? {}) },
    state: { ...((editedGood?.multipliers?.state as any) ?? {}) },
    religion: { ...((editedGood?.multipliers?.religion as any) ?? {}) },
    biome: { ...((editedGood?.multipliers?.biome as any) ?? {}) }
  };

  const multiplierSummary = (dim: MultiplierDimKey): string => {
    const vals = multipliers[dim] ?? {};
    const entries = Object.entries(vals).filter(([, v]) => v !== 1);
    if (!entries.length) return "none";
    return entries.map(([id, v]) => `${getMultiplierEntityName(dim, id)} ×${rn(v!, 2)}`).join(", ");
  };

  const renderMultiplierRow = (
    dim: MultiplierDimKey,
    label: string
  ) => /*html*/ `<div style="display: grid; grid-template-columns: 1fr 2fr auto; align-items: self-start; column-gap: 0.4em;">
      ${label}
      <span id="mSummary_${dim}">${multiplierSummary(dim)}</span>
      <button class="mEdit icon-pencil" data-dim="${dim}" data-tip="${label} multipliers"></button>
    </div>`;

  alertMessage.innerHTML = /*html*/ `
    <div style="display:grid; grid-template-columns: 7em 1fr; align-items:center;">
      <label for="newGoodName">Name*</label>
      <input id="newGoodName" value="${editedGood?.name || ""}" />

      <label for="newGoodTags">Tags</label>
      <input id="newGoodTags" value="${editedGood?.tags.join(", ") || ""}" placeholder="comma separated" />

      <label for="newGoodValue">Base Price*</label>
      <span><input id="newGoodValue" type="number" min="0" step="1" value="${editedGood?.value ?? 1}" /> 🟡</span>

      <label for="newGoodChance">Chance</label>
      <input id="newGoodChance" type="number" min="0" max="100" step="0.1" value="${editedGood?.chance ?? 1}" />

      <label for="newGoodUnit">Unit</label>
      <input id="newGoodUnit" placeholder="e.g. wagon, barrel" value="${editedGood?.unit || ""}" />

      <label for="newGoodIcon">Icon*</label>
      <div style="display:flex; align-items:center; gap:.4em;">
        <select id="newGoodIcon" style="width: 8em;">${icons.map(renderIconOption).join("")}</select>
        <svg width="20" height="20" viewBox="0 0 200 200" style="flex-shrink:0"><use id="newGoodIconPreview" href="#${editedGood?.icon || "good-unknown"}"/></svg>
        <button id="newGoodUploadIconRaster" class="icon-upload" data-tip="Upload raster icon"></button>
        <button id="newGoodUploadIconVector" class="icon-upload-cloud" data-tip="Upload vector (SVG) icon"></button>
        <input id="newGoodColor" type="color" data-tip="Set a stroke color" style="width:3em; height:14px; padding:0; border:none;" value="${editedGood?.color || "#ff5959"}" />
      </div>

      <label style="align-self:start;" data-tip="How much of each demand category this good satisfies. Click the pencil icon to edit.">Demand Coverage</label>
      <div style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:.4em;">
        <span id="demandCoverageSummary">${demandCoverageSummary()}</span>
        <button class="dcEdit icon-pencil" data-tip="Edit demand coverage"></button>
      </div>

      <label style="align-self:start;" data-tip="Per-dimension production multipliers. 1 = no effect, 0 = fully suppressed. Click the pencil icon to edit each dimension.">Multipliers</label>
      <div style="display:flex;flex-direction:column;">
        ${renderMultiplierRow("cultureType", "CultureType")}
        ${renderMultiplierRow("culture", "Culture")}
        ${renderMultiplierRow("state", "State")}
        ${renderMultiplierRow("religion", "Religion")}
        ${renderMultiplierRow("biome", "Biome")}
      </div>

      <label data-tip="For raw resources: sets the baseline production per biome" style="align-self:start;">Rural cell production:</label>
      <div style="display:flex; justify-content: space-between; align-items: flex-start;">
        <span id="biomeProductionSummary">${biomeOutputSummary()}</span>
        <button class="bpEdit icon-pencil" data-tip="Edit biome baseline production"></button>
      </div>

      <label data-tip="For raw resources: controls where and how this good is produced directly from the environment (e.g. biome, elevation, temperature)">Distribution:</label>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div id="newGoodDistribution" style="color:#555; font-size:.9em; font-family:monospace;">${editedGood?.distribution || ""}</div>
        <button id="newGoodDistributionEditor" class="icon-pencil" data-tip="Open the Distribution visual editor"></button>
      </div>
    </div>

    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.4em;">
        <label data-tip="For manufactured goods: recipes define which other goods are required to produce this good">Recipes</label>
        <button id="newGoodAddRecipe" class="icon-plus"></button>
      </div>
      <div id="newGoodRecipeList" style="display:flex; flex-direction:column; gap:.45em;"></div>
    </div>

    <div id="newGoodError" style="color:#b20000; min-height:1.2em"></div>
  `;

  const recipes: Record<number, number>[] = editedGood?.recipes || [];
  const recipeList = ensureEl("newGoodRecipeList");

  const defaultGoodId = pack.goods[0]?.i ?? 0;
  const sortedGoods = [...pack.goods].sort((a, b) => a.name.localeCompare(b.name));

  const renderRecipes = () => {
    recipeList.innerHTML = recipes
      .map(
        (recipe, recipeIndex) => /*html*/ `
          <div class="recipeOption" style="border: 1px solid #ccc;" data-recipe-index="${recipeIndex}" >
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 0.2em;">
              <span>Recipe ${recipeIndex + 1}</span>
              <div style="display:flex; gap:.3em;">
                <span class="recipeAddIngredient icon-plus pointer" data-recipe-index="${recipeIndex}"></span>
                <span class="recipeRemoveOption icon-trash-empty pointer" data-recipe-index="${recipeIndex}"></span>
              </div>
            </div>
            <div class="recipeIngredients" style="display:flex; flex-direction:column; gap:.2em;">
              ${Object.entries(recipe)
                .map(
                  ([ingredientId, amount], ingredientIndex) => /*html*/ `
                    <div style="display:grid; grid-template-columns: 1fr 5em 1.5em; gap:.25em; align-items: center;" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">
                      <select class="recipeGoodSelect" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">${sortedGoods.map(good => `<option value="${good.i}" ${good.i === Number(ingredientId) ? "selected" : ""}>${good.name}</option>`).join("")}</select>
                      <input class="recipeAmountInput" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" type="number" min="1" step="1" value="${amount}" />
                      <span class="recipeRemoveIngredient icon-trash-empty pointer" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" />
                    </div>`
                )
                .join("")}
            </div>
          </div>
        `
      )
      .join("");

    recipeList.querySelectorAll<HTMLSelectElement>(".recipeGoodSelect").forEach(select => {
      select.onchange = () => {
        const selectedGoodId = +select.value;
        const recipeIndex = +select.dataset.recipeIndex!;
        const ingredientIndex = +select.dataset.ingredientIndex!;
        const recipe = recipes[recipeIndex];

        const oldAmount = recipe[ingredientIndex] || 0;
        delete recipe[ingredientIndex];
        recipe[selectedGoodId] = oldAmount;
        renderRecipes();
      };
    });

    recipeList.querySelectorAll<HTMLInputElement>(".recipeAmountInput").forEach(input => {
      input.onchange = () => {
        const recipeIndex = +input.dataset.recipeIndex!;
        const ingredientIndex = +input.dataset.ingredientIndex!;
        const recipe = recipes[recipeIndex];
        const ingredientId = Number(Object.keys(recipe)[ingredientIndex]);
        recipe[ingredientId] = +input.value;
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeAddIngredient").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        const recipe = recipes[recipeIndex];
        const newIngredientId = Object.keys(recipe).length
          ? Math.max(...Object.keys(recipe).map(id => +id)) + 1
          : defaultGoodId;
        recipe[newIngredientId] = 1;
        renderRecipes();
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveIngredient").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        const ingredientIndex = +button.dataset.ingredientIndex!;
        const recipe = recipes[recipeIndex];
        if (Object.keys(recipe).length > 1) {
          const ingredientId = Number(Object.keys(recipe)[ingredientIndex]);
          delete recipe[ingredientId];
          renderRecipes();
        }
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveOption").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        recipes.splice(recipeIndex, 1);
        renderRecipes();
      };
    });
  };
  renderRecipes();

  alertMessage.querySelectorAll<HTMLButtonElement>(".mEdit").forEach(btn => {
    btn.addEventListener("click", () => {
      const dim = btn.dataset.dim as MultiplierDimKey;
      openMultiplierPopup(dim, multipliers[dim] ?? {}, values => {
        multipliers[dim] = values;
        const summaryEl = document.getElementById(`mSummary_${dim}`);
        if (summaryEl) summaryEl.textContent = multiplierSummary(dim);
      });
    });
  });

  alertMessage.querySelector<HTMLButtonElement>(".dcEdit")!.addEventListener("click", () => {
    openDemandCoveragePopup({ ...demandCoverageState }, values => {
      (Object.keys(demandCoverageState) as DemandCategory[]).forEach(k => void delete demandCoverageState[k]);
      Object.assign(demandCoverageState, values);
      const summaryEl = document.getElementById("demandCoverageSummary");
      if (summaryEl) summaryEl.textContent = demandCoverageSummary();
    });
  });

  alertMessage.querySelector<HTMLButtonElement>(".bpEdit")!.addEventListener("click", () => {
    openBiomeProductionPopup({ ...biomeOutputState }, values => {
      Object.keys(biomeOutputState).forEach(k => void delete biomeOutputState[+k]);
      Object.assign(biomeOutputState, values);
      const summaryEl = document.getElementById("biomeProductionSummary");
      if (summaryEl) summaryEl.textContent = biomeOutputSummary();
    });
  });

  ensureEl("newGoodAddRecipe").on("click", event => {
    event.preventDefault();
    recipes.push({ [defaultGoodId]: 1 });
    renderRecipes();
  });

  ensureEl("newGoodDistributionEditor").on("click", () => {
    const distEl = ensureEl("newGoodDistribution");
    DistributionEditor.open(dist => {
      distEl.textContent = dist;
    }, distEl.textContent?.trim() ?? "");
  });

  const iconSelect = ensureEl<HTMLSelectElement>("newGoodIcon");
  iconSelect.onchange = () => ensureEl("newGoodIconPreview").setAttribute("href", `#${iconSelect.value}`);

  const onIconUpload = (_type: string, id: string) => {
    ensureEl("newGoodIconPreview").setAttribute("href", `#${id}`);
    iconSelect.innerHTML += `<option value="${id}">${id}</option>`;
    iconSelect.value = id;
  };
  ensureEl("newGoodUploadIconRaster").onclick = () => (ensureEl("imageToLoad") as HTMLInputElement).click();
  ensureEl("newGoodUploadIconVector").onclick = () => (ensureEl("svgToLoad") as HTMLInputElement).click();
  ensureEl("imageToLoad").onchange = () => uploadImage("image", onIconUpload);
  ensureEl("svgToLoad").onchange = () => uploadImage("svg", onIconUpload);

  $("#alert").dialog({
    width: "30em",
    resizable: false,
    title: editedGood ? "Edit good" : "Add new good",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      [editedGood ? "Apply" : "Add"]: () => {
        const errors: string[] = [];

        const name = ensureEl<HTMLInputElement>("newGoodName").value.trim();
        const tagsInput = ensureEl<HTMLInputElement>("newGoodTags").value.trim();
        const tags = unique(tagsInput.split(",").map(tag => tag.trim().toLocaleLowerCase()));
        const value = +ensureEl<HTMLInputElement>("newGoodValue").value;
        const chance = +ensureEl<HTMLInputElement>("newGoodChance").value;
        const unit = ensureEl<HTMLInputElement>("newGoodUnit").value.trim();
        const icon = ensureEl<HTMLSelectElement>("newGoodIcon").value;
        const color = ensureEl<HTMLInputElement>("newGoodColor").value;
        const distribution = ensureEl("newGoodDistribution").textContent?.trim() ?? "";

        if (!name) errors.push("Name is required");
        if (!Number.isFinite(value) || value < 0) errors.push("Value must be a valid non-negative number");
        if (!Number.isFinite(chance) || chance < 0 || chance > 100) errors.push("Chance must be between 0 and 100");

        if (distribution) {
          try {
            const methods = Goods.getMethods();
            const allMethods = `{${Object.keys(methods).join(", ")}}`;
            new Function(allMethods, `return ${distribution}`)(methods);
          } catch (err) {
            errors.push(`Distribution function is invalid: ${(err as Error).message || err}`);
          }
        }

        for (const recipe of recipes) {
          for (const [ingredientId, ingredientAmount] of Object.entries(recipe)) {
            const id = Number(ingredientId);
            const good = Goods.get(id);
            if (!good) errors.push(`Recipe references unknown good id: ${id}`);
            const amount = Number(ingredientAmount);
            if (Number.isNaN(amount) || !Number.isFinite(amount) || amount <= 0)
              errors.push(`Invalid recipe amount for good ${good?.name}`);
          }

          if (!Object.keys(recipe).length) errors.push("Each recipe must have at least one ingredient");
        }

        ensureEl("newGoodError").textContent = errors.join(". ");
        if (errors.length) return;

        function buildFinalMultipliers(): Good["multipliers"] {
          const result: Good["multipliers"] = {};
          for (const [dimKey, vals] of Object.entries(multipliers) as [
            MultiplierDimKey,
            Partial<Record<string, number>>
          ][]) {
            const nonDefault = Object.fromEntries(
              Object.entries(vals ?? {}).filter(([, v]) => v !== undefined && v !== 1)
            );
            if (Object.keys(nonDefault).length) (result as any)[dimKey] = nonDefault;
          }
          return Object.keys(result).length ? result : undefined;
        }

        if (editedGood) {
          editedGood.name = name;
          editedGood.tags = tags;
          editedGood.icon = icon;
          editedGood.color = color;
          editedGood.value = value;
          editedGood.chance = chance;
          editedGood.unit = unit;
          editedGood.demandCoverage = demandCoverageState;
          editedGood.multipliers = buildFinalMultipliers();
          if (distribution) editedGood.distribution = distribution;
          if (Object.keys(biomeOutputState).length) editedGood.biomeOutput = biomeOutputState;
          if (recipes.length) editedGood.recipes = recipes;
        } else {
          const getNextId = () => {
            let nextId = pack.goods?.at(-1)?.i ?? 1;
            while (Goods.get(nextId)) nextId++;
            return nextId;
          };

          pack.goods.push({
            i: getNextId(),
            name,
            tags,
            icon,
            color,
            value,
            chance,
            unit,
            demandCoverage: demandCoverageState,
            multipliers: buildFinalMultipliers(),
            distribution: distribution || undefined,
            biomeOutput: Object.keys(biomeOutputState).length ? biomeOutputState : undefined,
            recipes: recipes.length ? recipes : undefined
          });
          Goods.sync();
        }

        tip(editedGood ? "Good is updated" : "Good is added", false, "success", 5000);
        goodsEditorAddLines();
        drawGoods(displayedGoods);
        $("#alert").dialog("close");
      }
    }
  });
}

function downloadGoodsData() {
  const cellsByGood: Record<number, number> = {};
  for (const goodId of pack.cells.good) {
    if (goodId) cellsByGood[goodId] = (cellsByGood[goodId] || 0) + 1;
  }

  const production = getProduction();
  const stockData = getAllStockData();

  let data = "Id,Good,Color,Type,Tags,Value,Demand Coverage,Chance,Model,Cells,Produced,Stock\n";

  for (const good of pack.goods) {
    const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean).join(";");
    const tags = good.tags.join(";");
    const demandCoverage = Object.entries(good.demandCoverage || {})
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    const cells = cellsByGood[good.i] || 0;
    const goodProduction = production[good.i] || { burg: 0, cell: 0, bonus: 0 };
    const produced = rn(goodProduction.burg + goodProduction.cell + goodProduction.bonus);
    const stock = stockData[good.i]?.total ?? 0;

    data += `${good.i},${good.name},${good.color},${types},${tags},${good.value},${demandCoverage},${good.chance ?? ""},${good.distribution ?? ""},${cells},${produced},${stock}\n`;
  }

  const name = `${getFileName("Goods")}.csv`;
  downloadFile(data, name);
}

function toggleDisplayedGood(good: Good, el: HTMLInputElement) {
  if (el.checked) displayedGoods.add(good.i);
  else displayedGoods.delete(good.i);

  updateDisplayAllCheckbox();
  drawGoods(displayedGoods);
}

function toggleAllDisplayed(this: HTMLInputElement) {
  displayedGoods.clear();
  if (this.checked) for (const good of pack.goods) displayedGoods.add(good.i);

  ensureEl("goodsBody")
    .querySelectorAll<HTMLInputElement>(".goodDisplayed")
    .forEach(checkbox => {
      const id = Number((checkbox.closest(".states") as HTMLElement).dataset.id);
      checkbox.checked = displayedGoods.has(id);
    });

  drawGoods(displayedGoods);
}

function updateDisplayAllCheckbox() {
  const master = ensureEl<HTMLInputElement>("goodsDisplayAll");
  const total = pack.goods.length;
  master.checked = total > 0 && displayedGoods.size === total;
  master.indeterminate = displayedGoods.size > 0 && displayedGoods.size < total;
  ensureEl("goodsDisplayed").innerHTML = String(displayedGoods.size);
}

function requestGoodsRegeneration() {
  confirmationDialog({
    title: "Regenerate bonus goods",
    message:
      "Are you sure you want to regenerate bonus goods placement? Generation will be based on the current Goods settings and WON'T effect production or trade",
    confirm: "Regenerate",
    onConfirm: window.regenerateGoods
  });
}

function requestProductionRegeneration() {
  confirmationDialog({
    title: "Regenerate production",
    message:
      "Are you sure you want to regenerate production and trade for all goods? Generation will be based on the current Goods settings and bonus goods placement",
    confirm: "Regenerate",
    onConfirm: window.regenerateProduction
  });
}

function removeGood(good: Good, line: HTMLElement) {
  const message = "Are you sure you want to remove the resource? <br>This action cannot be reverted";
  const onConfirm = () => {
    for (const i of pack.cells.i) {
      if (pack.cells.good[i] === good.i) {
        pack.cells.good[i] = 0;
      }
    }

    pack.goods = pack.goods.filter(g => g.i !== good.i);
    Goods.sync();
    displayedGoods.delete(good.i);
    line.remove();
    ensureEl("goodsNumber").innerHTML = String(pack.goods.length);

    updateDisplayAllCheckbox();
    drawGoods(displayedGoods);
  };
  confirmationDialog({ title: "Remove resource", message, confirm: "Remove", onConfirm });
}

function closeGoodsEditor() {
  if (customization === 14) exitResourceAssignMode("close");
  ensureEl("goodsBody").innerHTML = "";
}

declare global {
  var GoodsEditor: { open: () => void; getDisplayedGoods: () => Set<number> };
}

window.GoodsEditor = { open, getDisplayedGoods };
