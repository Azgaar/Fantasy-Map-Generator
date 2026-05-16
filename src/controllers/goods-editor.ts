import { pointer } from "d3";
import type { DemandCategory, Good } from "../modules/goods-generator";
import { DEMAND_CATEGORY_ICONS, DEMAND_PRIORITY } from "../modules/goods-generator";
import { BONUS_RESOURCE_PRODUCTION } from "../modules/trade-generator";
import { drawGoods, toggleGoods } from "../renderers/draw-goods";
import { ensureEl, unique } from "../utils";
import { getHeight } from "../utils/unitUtils";
import { ProductionChains } from "./production-chains";

let isInitialized = false;
const visibleTags = new Set<string>();
const pinnedGoods = new Set<number>();

export function open() {
  if (customization) return;
  closeDialogs("#goodsEditor, .stable");
  if (!layerIsOn("toggleGoods")) toggleGoods();

  goodsEditorAddLines();

  $("#goodsEditor").dialog({
    title: "Goods Editor",
    resizable: false,
    width: "auto",
    close: closeGoodsEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });

  if (!isInitialized) {
    ensureEl("goodsEditorRefresh").on("click", goodsEditorAddLines);
    ensureEl("goodsPercentage").on("click", togglePercentageMode);
    ensureEl("goodsTagsFilter").on("click", openTagsVisibilityDialog);
    ensureEl("goodsAssign").on("click", enterResourceAssignMode);
    ensureEl("goodsAdd").on("click", () => openGoodDialog());
    ensureEl("goodsRestore").on("click", goodsRestoreDefaults);
    ensureEl("goodsExport").on("click", downloadGoodsData);
    ensureEl("goodsUnpinAll").on("click", unpinAllGoods);
    ensureEl("goodsChains").on("click", () => ProductionChains.open());

    ensureEl("goodsBody").on("click", ev => {
      const el = ev.target as HTMLElement;
      const cl = el.classList;
      const line = el.parentNode as HTMLElement;
      const good = Goods.get(+line.dataset.id!);
      if (!good) return;
      if (cl.contains("goodEdit")) return openGoodDialog(good);
      if (cl.contains("icon-pin")) return pinGood(good, el);
      if (cl.contains("icon-trash-empty")) return removeGood(good, line);
    });

    isInitialized = true;
  }
}

function goodsEditorAddLines() {
  const body = ensureEl("goodsBody");
  const production = getProduction();
  let lines = "";

  const renderTypeBadge = (type: string) => {
    const commonStyles =
      "display:inline-block;border-radius:3px;padding:0 .4em;font-size:0.8em;font-weight:bold;line-height:1.35";
    if (type === "RAW")
      return `<span style="${commonStyles};background:#d0e7f5;color:#036" data-tip="Raw goods are produced by rural population in cells based on biome availability and bonus resources assigned to cells">RAW</span>`;
    return `<span style="${commonStyles};background:#f8e7bf;color:#b67a00" data-tip="Manufactured goods are produced in burgs">MFG</span>`;
  };

  for (const good of pack.goods) {
    const types = [good.recipes && "MFG", good.distribution && "RAW"].filter(Boolean) as string[];
    const goodProduction = production[good.i] || { burg: 0, cell: 0, bonus: 0 };
    const produced = rn(goodProduction.burg + goodProduction.cell + goodProduction.bonus);
    const producedTip = `Total good production: ${produced}⚒. Burgs: ${rn(goodProduction.burg, 2)}⚒. Cells: ${rn(goodProduction.cell, 2)}⚒. Bonus resource: ${rn(goodProduction.bonus, 2)}⚒ (${BONUS_RESOURCE_PRODUCTION}⚒ per cell with explicit good assigned)`;

    lines += /*html*/ `<div class="states goods" data-id=${good.i} data-name="${good.name}" data-color="${good.color}" data-value="${good.value}" data-produced="${produced}" data-type="${types.join(",")}">
        <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${Goods.getStroke(good.color)}"/>
          <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <div data-tip="Good name" class="goodName">${good.name}</div>
        <div data-tip="Good types" class="goodType" style="width: 6em;">${types.map(renderTypeBadge).join(" ")}</div>
        <div data-tip="${producedTip}. Click to see burgs producing this good" class="goodProduced pointer" style="vertical-align: middle;">
          <div style="display: inline-block;">${produced}</div>
          <div style="display: inline-block; width: 0.4em; font-size: 1.5em;">⚒</div>
        </div>
        <div data-tip="Base price" class="goodBasePrice">🟡 ${good.value}</div>
        <span data-tip="Edit good" class="icon-pencil goodEdit hide"></span>
        <span data-tip="Toggle good exclusive visibility (pin)" class="icon-pin ${pinnedGoods.has(good.i) ? "" : "inactive"} hide"></span>
        <span data-tip="Remove good" class="icon-trash-empty hide goodRemove"></span>
      </div>`;
  }
  body.innerHTML = lines;

  const totalProduced = Object.values(production)
    .map(p => p.burg + p.cell + p.bonus)
    .reduce((sum, v) => sum + v, 0);
  ensureEl("goodsNumber").innerHTML = String(pack.goods.length);
  ensureEl("goodsProduced").innerHTML = String(rn(totalProduced));

  body.querySelectorAll("div.states").forEach(el => void el.on("click", selectResourceOnLineClick));
  body.querySelectorAll<HTMLButtonElement>(".goodProduced").forEach(el => {
    el.addEventListener("click", ev => {
      ev.stopPropagation();
      openProducersDialog(Number(el.parentElement?.dataset?.id));
    });
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("goodsHeader")!);
  applyTagVisibilityFilter();
  $("#goodsEditor").dialog({ width: fitContent() });
}

function openProducersDialog(goodId: number) {
  const good = Goods.get(goodId);
  if (!good) return;

  const producers = pack.burgs
    .filter(b => b.i && !b.removed && (b.produced?.[goodId] ?? 0) > 0)
    .map(b => ({ burg: b, units: b.produced![goodId] }))
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
    width: "20em"
  });
}

function _getRuralAvailability(): number[] {
  const resources: number[] = [];
  const { cells, goods } = pack;

  for (const cellId of cells.i) {
    const explicitGoodId = cells.good[cellId];
    if (explicitGoodId) resources[explicitGoodId] = (resources[explicitGoodId] || 0) + BONUS_RESOURCE_PRODUCTION;

    const population = Math.max(0, cells.pop[cellId] || 0);
    if (population <= 0) continue;

    const biomeId = cells.biome[cellId];
    for (const good of goods) {
      const biomeProduction = good.biome?.[biomeId] || 0;
      if (!biomeProduction) continue;
      resources[good.i] = (resources[good.i] || 0) + population * biomeProduction;
    }
  }

  return resources;
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
    if (!burg || burg.removed || !burg.produced) continue;
    for (const goodId in burg.produced) {
      addProduction(Number(goodId), burg.produced[goodId] || 0, "burg");
    }
  }

  return production;
}

function getBonusIcon(bonus: string): string {
  if (bonus === "fleet") return `<span data-tip="Fleet bonus" class="icon-anchor"></span>`;
  if (bonus === "defence") return `<span data-tip="Defence bonus" class="icon-chess-rook"></span>`;
  if (bonus === "prestige") return `<span data-tip="Prestige bonus" class="icon-star"></span>`;
  if (bonus === "artillery") return `<span data-tip="Artillery bonus" class="icon-rocket"></span>`;
  if (bonus === "infantry") return `<span data-tip="Infantry bonus" class="icon-chess-pawn"></span>`;
  if (bonus === "population") return `<span data-tip="Population bonus" class="icon-male"></span>`;
  if (bonus === "archers") return `<span data-tip="Archers bonus" class="icon-dot-circled"></span>`;
  if (bonus === "cavalry") return `<span data-tip="Cavalry bonus" class="icon-chess-knight"></span>`;
  return "";
}

function openTagsVisibilityDialog() {
  const tags = unique(pack.goods.flatMap(good => good.tags));
  const renderTag = (tag: string) =>
    `<label><input type="checkbox" class="native" value="${tag}" ${visibleTags.has(tag) ? "checked" : ""} /> ${tag}</label>`;
  const tagsMarkup = tags.length ? tags.map(renderTag).join("") : '<div style="color:#666">No tags available</div>';

  alertMessage.innerHTML = `
    <div data-tip="Only goods with at least one selected tag remain visible in the editor list" style="display: grid; grid-template-columns: 1fr 1fr 1fr;">${tagsMarkup}</div>
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
    line.classList.toggle("hiddenByTag", !matches);
  });

  const filterBtn = ensureEl("goodsTagsFilter");
  if (filterBtn) filterBtn.classList.toggle("active", hasFilter);
}

function interpretDistribution(dist: string): string {
  const biomeLabel = (id: number): string => biomesData.name?.[id] || `biome ${id}`;
  const SHORE: Record<number, string> = {
    "-2": "deep ocean",
    "-1": "shallow ocean",
    "1": "coastal land",
    "2": "near coast land"
  };

  return dist
    .replace(/biome\(([^)]+)\)/g, (_, args) => {
      const names = args.split(",").map((a: string) => biomeLabel(parseInt(a.trim(), 10)));
      return names.length === 1 ? `${names[0]} biome` : `${names.join("/")} biomes`;
    })
    .replace(/minHeight\((-?\d+(?:\.\d+)?)\)/g, (_, h) => {
      try {
        return `min height ${getHeight(+h, true)}`;
      } catch {
        return `min height h=${h}`;
      }
    })
    .replace(/maxHeight\((-?\d+(?:\.\d+)?)\)/g, (_, h) => {
      try {
        return `max height ${getHeight(+h, true)}`;
      } catch {
        return `max height h=${h}`;
      }
    })
    .replace(/minTemp\((-?\d+(?:\.\d+)?)\)/g, (_, t) => `min temp ${t}°C`)
    .replace(/maxTemp\((-?\d+(?:\.\d+)?)\)/g, (_, t) => `max temp ${t}°C`)
    .replace(/shore\(([^)]+)\)/g, (_, args) => {
      const labels = args.split(",").map((a: string) => {
        const v = parseInt(a.trim(), 10);
        return SHORE[v] ?? `ring ${v}`;
      });
      return labels.join("/");
    })
    .replace(/type\(([^)]+)\)/g, (_, args) => {
      const types = args
        .replace(/["']/g, "")
        .split(",")
        .map((a: string) => a.trim());
      return `type: ${types.join("/")}`;
    })
    .replace(/river\(\)/g, "river presence")
    .replace(/minHabitability\((\d+)\)/g, (_, n) => `habitability ≥ ${n}%`)
    .replace(/habitability\(\)/g, "more habitable areas")
    .replace(/elevation\(\)/g, "more elevated areas")
    .replace(/nth\((\d+)\)/g, (_, n) => `1 in ${n} cells`)
    .replace(/random\((\d+)\)/g, (_, n) => `${n}% chance`)
    .replace(/\s*&&\s*/g, " AND ")
    .replace(/\s*\|\|\s*/g, " OR ")
    .replace(/!\s*/g, "NOT ")
    .replace(/\s+/g, " ")
    .trim();
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

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      totalProduced += +el.dataset.produced! || 0;
    });

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      const producedEl = el.querySelector<HTMLElement>(".goodProduced");
      if (producedEl) {
        const produced = +el.dataset.produced! || 0;
        producedEl.innerHTML = `${rn(totalProduced ? (produced / totalProduced) * 100 : 0, 2)}%`;
      }
    });
  } else {
    body.dataset.type = "absolute";
    goodsEditorAddLines();
  }
}

function enterResourceAssignMode(this: HTMLElement) {
  const body = ensureEl("goodsBody");
  if (this.classList.contains("pressed")) return exitResourceAssignMode();
  customization = 14;
  this.classList.add("pressed");
  if (!layerIsOn("toggleGoods")) toggleGoods();
  if (!layerIsOn("toggleCells")) {
    ensureEl<HTMLButtonElement>("toggleCells").dataset.forced = "true";
    toggleCells();
  }

  ensureEl("goodsEditor")!
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("goodsFooter").style.display = "none";
  body.querySelectorAll<HTMLElement>(".goodEdit, .icon-trash-empty").forEach(e => {
    e.style.pointerEvents = "none";
  });

  $("#goodsEditor").dialog({
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  tip("Select good line in editor, click on cells to remove or add a good", true);
  viewbox.on("click", changeResourceOnCellClick);

  body.querySelector<HTMLElement>("div.states:not(.hiddenByTag)")?.classList.add("selected");

  if (pinnedGoods.size) unpinAllGoods();
}

function selectResourceOnLineClick(this: HTMLElement) {
  const body = ensureEl("goodsBody");
  if (customization !== 14) return;
  body.querySelector<HTMLElement>("div.selected")?.classList.remove("selected");
  this.classList.add("selected");
}

function changeResourceOnCellClick(this: SVGElement) {
  const body = ensureEl("goodsBody");
  const point = pointer(event, this);
  const cellId = findCell(point[0], point[1]);
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
  }

  goods.selectAll("*").remove();
  goodsEditorAddLines();
  drawGoods(pinnedGoods);
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
  ensureEl("goodsFooter").style.display = "block";
  body
    .querySelectorAll<HTMLElement>(
      ".goodName, .goodType, .goodProduced, .goodBasePrice, .goodBuyPrice, .goodSellPrice, .goodEdit, svg, .icon-trash-empty"
    )
    .forEach(e => {
      e.style.pointerEvents = "";
    });
  if (!close) {
    $("#goodsEditor").dialog({
      position: {
        my: "right top",
        at: "right-10 top+10",
        of: "svg",
        collision: "fit"
      }
    });
  }

  restoreDefaultEvents();
  clearMainTip();
  const selected = body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function openGoodDialog(editedGood?: Good) {
  const icons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const renderIconOption = (icon: string) =>
    /*html*/ `<option value="${icon}" ${editedGood?.icon === icon ? "selected" : ""}>${icon}</option>`;

  const allBonuses = unique(pack.goods.flatMap(good => Object.keys(good.bonus || {})));
  const renderBonus = (bonus: string) => /*html*/ `<span>
        ${getBonusIcon(bonus)}
        <div style="display: inline-block; width: 5em;">${capitalize(bonus)}</div>
        <input id="newGoodBonus_${bonus}" type="number" style="width: 4em;" step="1" min="0" max="9" value="${(editedGood?.bonus as Record<string, number> | undefined)?.[bonus] || 0}" />
      </span>`;

  const renderDemanCoverage = (category: DemandCategory) => /*html*/ `<span>
        <div style="display: inline-block; width: 6em; white-space: nowrap;">${DEMAND_CATEGORY_ICONS[category]} ${capitalize(category)}</div>
        <input id="newGoodDemandCoverage_${category}" type="number" style="width: 4em;" step="0.05" min="0" value="${editedGood?.demandCoverage?.[category] || 0}" />
      </span>`;

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

      <label for="newGoodBonuses" style="align-self: start;">Bonuses</label>
      <div id="newGoodBonuses" style="display: grid; grid-template-columns: 1fr 1fr;">${allBonuses.map(renderBonus).join("")}</div>

      <label for="newGoodDemandCoverage" style="align-self: start;">Demand Coverage</label>
      <div id="newGoodDemandCoverage" style="display: grid; grid-template-columns: 1fr 1fr; gap: .2em;">${DEMAND_PRIORITY.map(renderDemanCoverage).join("")}</div>
    </div>

    <div>
      <label style="display:block; margin-bottom:.2em" data-tip="For raw resources: controls where and how this good is produced directly from the environment (e.g. biome, elevation, temperature)">Distribution function:</label>
      <textarea id="newGoodDistribution" style="width:100%; height:4em; font-family:monospace; font-size:.9em; box-sizing:border-box" spellcheck="false" placeholder="e.g. biome(5, 6, 7, 8, 9)">${editedGood?.distribution || ""}</textarea>
      <div id="newGoodDistributionPreview" style="color:#555; font-size:.9em; min-height:1.2em; margin-top:.2em">${editedGood?.distribution ? interpretDistribution(editedGood.distribution) : ""}</div>
      <label style="display:block; margin:.5em 0 .2em" data-tip="For raw resources: sets the baseline production per biome (biomeId: amount)">Biome baseline production:</label>
      <input id="newGoodBiomeProduction" style="width:100%; box-sizing:border-box" spellcheck="false" placeholder="e.g. 6:0.5, 7:0.5, 8:0.5" value="${Object.entries(
        editedGood?.biome || {}
      )
        .map(([id, amount]) => `${id}: ${amount}`)
        .join(", ")}" />
      <div style="color:#666; font-size:.85em; margin-top:.2em">${biomesData.i.map(id => `${id}: ${biomesData.name[id]}`).join(" | ")}</div>
    </div>

    <div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.4em;">
        <label data-tip="For manufactured goods: recipes define which other goods are required to produce this good">Recipes</label>
        <button id="newGoodAddRecipe">Add recipe</button>
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

  ensureEl("newGoodAddRecipe").on("click", event => {
    event.preventDefault();
    recipes.push({ [defaultGoodId]: 1 });
    renderRecipes();
  });

  const distributionInput = ensureEl<HTMLTextAreaElement>("newGoodDistribution");
  const distributionPreview = ensureEl("newGoodDistributionPreview");
  distributionInput.oninput = () => {
    try {
      distributionPreview.textContent = distributionInput.value.trim()
        ? interpretDistribution(distributionInput.value.trim())
        : "";
    } catch {
      distributionPreview.textContent = "";
    }
  };

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
        const distribution = ensureEl<HTMLInputElement>("newGoodDistribution").value.trim();
        const biomeProductionInput = ensureEl<HTMLInputElement>("newGoodBiomeProduction").value.trim();
        const biomeProduction = parseBiomeProduction();

        const bonuses: Record<string, number> = {};
        allBonuses.forEach(bonus => {
          const bonusInput = document.getElementById(`newGoodBonus_${bonus}`) as HTMLInputElement | null;
          if (!bonusInput) return;
          const v = parseInt(bonusInput.value, 10);
          if (!Number.isNaN(v) && v > 0) bonuses[bonus] = v;
        });

        const demandCoverage: Partial<Record<DemandCategory, number>> = {};
        DEMAND_PRIORITY.forEach(category => {
          const demandCoverageInput = document.getElementById(
            `newGoodDemandCoverage_${category}`
          ) as HTMLInputElement | null;
          if (!demandCoverageInput) return;
          const v = Number(demandCoverageInput.value);
          if (Number.isFinite(v) && v > 0) demandCoverage[category] = v;
        });

        if (!name) errors.push("Name is required");
        if (!Number.isFinite(value) || value < 0) errors.push("Value must be a valid non-negative number");
        if (!Number.isFinite(chance) || chance < 0 || chance > 100) errors.push("Chance must be between 0 and 100");

        function parseBiomeProduction(): Record<number, number> | null {
          if (!biomeProductionInput) return {};

          const result: Record<number, number> = {};
          const chunks = biomeProductionInput
            .split(",")
            .map(chunk => chunk.trim())
            .filter(Boolean);

          for (const chunk of chunks) {
            const [biomeRaw, amountRaw] = chunk.split(":").map(part => part.trim());
            const biomeId = Number(biomeRaw);
            const amount = Number(amountRaw);

            if (!Number.isInteger(biomeId) || !biomesData.i.includes(biomeId))
              errors.push(`Invalid biome id in biome production: ${biomeId}`);
            if (!Number.isFinite(amount) || amount <= 0)
              errors.push(`Invalid amount in biome production for biome ${biomeId}: ${amountRaw}`);

            result[biomeId] = amount;
          }

          return result;
        }

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

        if (editedGood) {
          editedGood.name = name;
          editedGood.tags = tags;
          editedGood.icon = icon;
          editedGood.color = color;
          editedGood.value = value;
          editedGood.chance = chance;
          editedGood.unit = unit;
          editedGood.bonus = bonuses;
          editedGood.demandCoverage = demandCoverage;
          if (distribution) editedGood.distribution = distribution;
          if (biomeProduction) editedGood.biome = biomeProduction;
          if (recipes) editedGood.recipes = recipes;
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
            bonus: bonuses,
            demandCoverage,
            distribution: distribution || undefined,
            biome: biomeProduction || undefined,
            recipes: recipes.length ? recipes : undefined
          });
        }

        tip(editedGood ? "Good is updated" : "Good is added", false, "success", 5000);
        goodsEditorAddLines();
        drawGoods(pinnedGoods);
        $("#alert").dialog("close");
      }
    }
  });
}

function downloadGoodsData() {
  const body = ensureEl("goodsBody");
  let data = "Id,Good,Color,Type,Tags,Value,Bonus,Demand Coverage,Chance,Model,Cells\n";

  // TODO: update based on data, not display
  body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
    const goodId = +el.dataset.id!;
    const good = Goods.get(goodId);
    if (!good) return;

    data += `${el.dataset.id},`;
    data += `${el.dataset.name},`;
    data += `${el.dataset.color},`;
    data += `${el.dataset.tags},`;
    data += `${el.dataset.value},`;
    data += `${el.dataset.bonus},`;
    data += `${el.dataset.demandcoverage},`;
    data += `${el.dataset.chance},`;
    data += `${el.dataset.model},`;
    data += `${el.dataset.cells}\n`;
  });

  const name = `${getFileName("Goods")}.csv`;
  downloadFile(data, name);
}

function pinGood(good: Good, el: HTMLElement) {
  if (pinnedGoods.has(good.i)) {
    pinnedGoods.delete(good.i);
  } else {
    pinnedGoods.add(good.i);
  }

  el.classList.toggle("inactive");
  const unpinAll = ensureEl("goodsUnpinAll");
  pinnedGoods.size ? unpinAll.classList.remove("hidden") : unpinAll.classList.add("hidden");

  drawGoods(pinnedGoods);
}

function unpinAllGoods() {
  pinnedGoods.clear();
  drawGoods();
  goodsEditorAddLines();
  ensureEl("goodsUnpinAll").classList.add("hidden");
}

function removeGood(good: Good, line: HTMLElement) {
  if (customization) return;

  const message = "Are you sure you want to remove the resource? <br>This action cannot be reverted";
  const onConfirm = () => {
    for (const i of pack.cells.i) {
      if (pack.cells.good[i] === good.i) {
        pack.cells.good[i] = 0;
      }
    }

    pack.goods = pack.goods.filter(g => g.i !== good.i);
    line.remove();
    ensureEl("goodsNumber").innerHTML = String(pack.goods.length);

    drawGoods(pinnedGoods);
  };
  confirmationDialog({
    title: "Remove resource",
    message,
    confirm: "Remove",
    onConfirm
  });
}

function closeGoodsEditor() {
  if (customization === 14) exitResourceAssignMode("close");
  ensureEl("goodsBody").innerHTML = "";
}

declare global {
  var GoodsEditor: { open: () => void };
}

window.GoodsEditor = { open };
