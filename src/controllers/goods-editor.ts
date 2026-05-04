import {pointer} from "d3";
import type {Good} from "../modules/goods-generator";
import {ensureEl, unique} from "../utils";
import {getHeight} from "../utils/unitUtils";

let isInitialized = false;
let visibleTags = new Set<string>();

export function open() {
  if (customization) return;
  closeDialogs("#goodsEditor, .stable");
  if (!layerIsOn("toggleGoods")) toggleGoods();

  goodsEditorAddLines();

  $("#goodsEditor").dialog({
    title: "Trade Goods Editor",
    resizable: false,
    width: "auto",
    close: closeGoodsEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  if (!isInitialized) {
    // add listeners once per session, dialog is re-opened on each open
    ensureEl("goodsEditorRefresh").on("click", goodsEditorAddLines);
    ensureEl("goodsLegend").on("click", toggleLegend);
    ensureEl("goodsPercentage").on("click", togglePercentageMode);
    ensureEl("goodsTagsFilter").on("click", openTagsVisibilityDialog);
    ensureEl("goodsAssign").on("click", enterResourceAssignMode);
    ensureEl("goodsAdd").on("click", goodAdd);
    ensureEl("goodsRestore").on("click", goodsRestoreDefaults);
    ensureEl("goodsExport").on("click", downloadGoodsData);
    ensureEl("goodsUnpinAll").on("click", unpinAllGoods);
    ensureEl("goodsProductionDebug").on("click", openProductionDebug);

    ensureEl("goodsBody").on("click", ev => {
      const el = ev.target as HTMLElement;
      const cl = el.classList;
      const line = el.parentNode as HTMLElement;
      const good = Goods.get(+line.dataset.id!);
      if (!good) return;
      if (cl.contains("goodEdit")) return editGood(good);
      if (cl.contains("icon-pin")) return pinResource(good, el);
      if (cl.contains("icon-trash-empty")) return removeResource(good, line);
    });

    isInitialized = true;
  }
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

function goodsEditorAddLines() {
  const body = ensureEl("goodsBody");
  let lines = "";

  for (const good of pack.goods) {
    const distribution = good.distribution || "";
    const bonusString = Object.entries(good.bonus)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    const tags = good.tags.join(", ");
    const stroke = Goods.getStroke(good.color);

    const buyPrice = good.buyPrice ?? good.value;
    const sellPrice = good.sellPrice ?? good.value;
    const buyColor =
      good.buyPrice == null ? "" : buyPrice > good.value ? "color:#c84" : buyPrice < good.value ? "color:#4a4" : "";
    const sellColor =
      good.sellPrice == null ? "" : sellPrice < good.value ? "color:#c84" : sellPrice > good.value ? "color:#4a4" : "";

    lines += `<div class="states goods"
          data-id=${good.i} data-name="${good.name}" data-color="${good.color}"
          data-tags="${tags}" data-chance="${good.chance}" data-bonus="${bonusString}"
          data-value="${good.value}" data-model="${distribution}" data-cells="${good.cells}"
          data-buyprice="${buyPrice}" data-sellprice="${sellPrice}">
        <svg data-tip="Good icon" width="2em" height="2em" class="goodIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
          <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <div data-tip="Good name" class="goodName">${good.name}</div>
        <div data-tip="Good tags" class="goodTags" title="${tags}">${tags}</div>
        <div data-tip="Number of cells with good" class="goodCells">${good.cells}</div>
        <div data-tip="Buy price (base: ${good.value}). Rises as more is extracted." class="goodBuyPrice" style="${buyColor}">${buyPrice}</div>
        <div data-tip="Sell price (base: ${good.value}). Falls as more is manufactured." class="goodSellPrice" style="${sellColor}">${sellPrice}</div>
        <span data-tip="Edit good" class="icon-pencil goodEdit hide"></span>
        <span data-tip="Toggle good exclusive visibility (pin)" class="icon-pin inactive hide"></span>
        <span data-tip="Remove good" class="icon-trash-empty hide"></span>
      </div>`;
  }
  body.innerHTML = lines;

  ensureEl("goodsNumber").innerHTML = String(pack.goods.length);

  body.querySelectorAll("div.states").forEach(el => void el.on("click", selectResourceOnLineClick));

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("goodsHeader")!);
  applyTagVisibilityFilter();
  $("#goodsEditor").dialog({width: fitContent()});
}

function openTagsVisibilityDialog() {
  const allTags = new Set(pack.goods.flatMap(good => good.tags));
  const selected = new Set(visibleTags);

  const tagsMarkup = allTags.size
    ? Array.from(allTags)
        .map(
          tag =>
            `<label style="display:block; margin:.2em 0"><input type="checkbox" class="goodTagFilterCheck native" value="${tag}" ${selected.has(tag) ? "checked" : ""} /> ${tag}</label>`
        )
        .join("")
    : '<div style="color:#666">No tags available</div>';

  alertMessage.innerHTML = `
    <div style="margin-bottom:.5em" data-tip="Only goods with at least one selected tag remain visible in the editor list">
      Visible tags filter
    </div>
    <div style="max-height: 15em; overflow: auto; border: 1px solid #ccc; padding: .4em;">${tagsMarkup}</div>
  `;

  $("#alert").dialog({
    resizable: false,
    title: "Filter goods by tags",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      "Clear filter": function () {
        visibleTags = new Set<string>();
        applyTagVisibilityFilter();
        $(this).dialog("close");
      },
      Apply: function () {
        const checks = Array.from(alertMessage.querySelectorAll<HTMLInputElement>(".goodTagFilterCheck:checked"));
        visibleTags = new Set(checks.map(check => check.value));
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
  const biomeLabel = (id: number): string =>
    (typeof biomesData !== "undefined" && biomesData.name?.[id]) || `biome ${id}`;
  const SHORE: Record<number, string> = {"-1": "water", "0": "inland", "1": "coast", "2": "near coast"} as any;

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

function uploadImage(type: string, uploadTo: HTMLElement, callback: (type: string, id: string) => void) {
  const input = (type === "image" ? ensureEl("imageToLoad") : ensureEl("svgToLoad")) as HTMLInputElement;
  const file = input.files![0];
  input.value = "";

  if (file.size > 200000)
    return void tip(
      `File is too big, please optimize file size up to 200kB and re-upload. Recommended size is 48x48 px and up to 10kB`,
      true,
      "error",
      5000
    );

  const reader = new FileReader();
  reader.onload = readerEvent => {
    const target = readerEvent.target;
    if (!target) return;
    const result = target.result as string;
    const id = `good-custom-${Math.random().toString(36).slice(-6)}`;

    if (type === "image") {
      const svg = /*html*/ `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><image x="0" y="0" width="200" height="200" href="${result}"/></svg>`;
      uploadTo.insertAdjacentHTML("beforeend", svg);
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
          "The file should be prepared for load to FMG. If you don't know why it's happening, try to upload the raster image",
          false,
          "error"
        );

      const icon = uploadTo.appendChild(svg);
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

function toggleLegend() {
  if (legend.selectAll("*").size()) {
    clearLegend();
    return;
  }

  const data = pack.goods
    .filter(good => good.i && good.cells)
    .sort((a, b) => (b.cells || 0) - (a.cells || 0))
    .map(good => [good.i, good.color, good.name]);
  drawLegend("Goods", data);
}

function togglePercentageMode() {
  const body = ensureEl("goodsBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const totalCells = Array.from(pack.cells.good as Uint8Array).filter(r => r !== 0).length;

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      el.querySelector(".goodCells")!.innerHTML = `${rn((+el.dataset.cells! / totalCells) * 100)}%`;
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
    position: {
      my: "right top",
      at: "right-10 top+10",
      of: "svg",
      collision: "fit"
    }
  });

  tip("Select good line in editor, click on cells to remove or add a good", true);
  viewbox.on("click", changeResourceOnCellClick);

  body.querySelector<HTMLElement>("div.states:not(.hiddenByTag)")?.classList.add("selected");

  const someArePinned = pack.goods.some(good => good.pinned);
  if (someArePinned) unpinAllGoods();
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
    const resourceToRemove = Goods.get(pack.cells.good[cellId]);
    if (resourceToRemove) {
      resourceToRemove.cells! -= 1;
      const goodCellsEl = body.querySelector<HTMLElement>(`div.states[data-id='${resourceToRemove.i}'] > .goodCells`);
      if (goodCellsEl) goodCellsEl.innerHTML = String(resourceToRemove.cells);
    }
    pack.cells.good[cellId] = 0;
  } else {
    const resourceId = +selected.dataset.id!;
    const resource = Goods.get(resourceId);
    if (!resource) return;

    resource.cells! += 1;
    const goodCellsEl = body.querySelector<HTMLElement>(`div.states[data-id='${resourceId}'] > .goodCells`);
    if (goodCellsEl) goodCellsEl.innerHTML = String(resource.cells);
    pack.cells.good[cellId] = resourceId;
  }

  goods.selectAll("*").remove();
  drawGoods();
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
    .querySelectorAll<HTMLElement>(".goodName, .goodType, .goodTags, .goodCells, .goodEdit, svg, .icon-trash-empty")
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

function editGood(good: Good) {
  openGoodDialog(good);
}

function goodAdd() {
  openGoodDialog();
}

function openGoodDialog(goodToEdit?: Good) {
  const isEdit = Boolean(goodToEdit);
  const editedGood = goodToEdit;
  const editedType = editedGood?.recipes ? "manufactured" : "raw";

  const standardIcons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const customIconsEl = ensureEl("defs-icons");
  const customIcons = customIconsEl ? Array.from(customIconsEl.querySelectorAll("svg")).map(el => el.id) : [];
  const iconOptions = [...standardIcons, ...customIcons]
    .map(icon => {
      const selected = editedGood ? editedGood.icon === icon : icon === "good-unknown";
      return `<option value="${icon}" ${selected ? "selected" : ""}>${icon}</option>`;
    })
    .join("");

  const allBonuses = unique([
    ...pack.goods.flatMap(good => Object.keys(good.bonus)),
    ...Object.keys(editedGood?.bonus || {})
  ]);
  const bonusInputsHtml = allBonuses
    .map(
      bonus => `<span>
        ${getBonusIcon(bonus)}
        <div style="display: inline-block; width: 5em;">${capitalize(bonus)}</div>
        <input id="newGoodBonus_${bonus}" type="number" style="width: 3em;" step="1" min="0" max="9" value="${(editedGood?.bonus as Record<string, number> | undefined)?.[bonus] || 0}" />
      </span>`
    )
    .join("");

  type RecipeIngredientDraft = {id: number; amount: number};
  type RecipeDraft = RecipeIngredientDraft[];
  const recipeDrafts: RecipeDraft[] = (editedGood?.recipes || [])
    .map(recipe =>
      Object.entries(recipe)
        .map(([id, amount]) => ({id: +id, amount: +amount}))
        .filter(ingredient => Number.isInteger(ingredient.id) && ingredient.amount > 0)
    )
    .filter(recipe => recipe.length > 0);

  const biomeProductionToText = (biomeProduction?: Partial<Record<number, number>>): string => {
    if (!biomeProduction) return "";
    return Object.entries(biomeProduction)
      .sort(([a], [b]) => +a - +b)
      .map(([biomeId, amount]) => `${biomeId}:${amount}`)
      .join(", ");
  };

  const biomeReference = biomesData.i.map((biomeId: number) => `${biomeId}:${biomesData.name[biomeId]}`).join(" | ");

  alertMessage.innerHTML = /*html*/ `
    <div style="display:grid; grid-template-columns: 8em 1fr; align-items:center;">
      <label for="newGoodName">Name*</label>
      <input id="newGoodName" value="${editedGood?.name || ""}" />

      <label for="newGoodType">Type*</label>
      <select id="newGoodType">
        <option value="raw" ${editedType !== "manufactured" ? "selected" : ""}>raw</option>
        <option value="manufactured" ${editedType === "manufactured" ? "selected" : ""}>manufactured</option>
      </select>

      <label for="newGoodTags">Tags</label>
      <input id="newGoodTags" value="${editedGood?.tags.join(", ") || ""}" placeholder="comma separated" />

      <label for="newGoodValue">Value*</label>
      <input id="newGoodValue" type="number" min="0" step="1" value="${editedGood?.value ?? 1}" />

      <label for="newGoodChance">Chance*</label>
      <input id="newGoodChance" type="number" min="0" max="100" step="0.1" value="${editedGood?.chance ?? 3}" />

      <label for="newGoodUnit">Unit</label>
      <input id="newGoodUnit" placeholder="e.g. wagon, barrel" value="${editedGood?.unit || ""}" />

      <label for="newGoodIcon">Icon</label>
      <div style="display:flex; align-items:center; gap:.4em;">
        <select id="newGoodIcon" style="width: 8em;">${iconOptions}</select>
        <svg width="20" height="20" viewBox="0 0 200 200" style="flex-shrink:0"><use id="newGoodIconPreview" href="#${editedGood?.icon || "good-unknown"}"/></svg>
        <button id="newGoodUploadIconRaster" class="icon-upload" data-tip="Upload raster icon"></button>
        <button id="newGoodUploadIconVector" class="icon-upload-cloud" data-tip="Upload vector (SVG) icon"></button>
        <input id="newGoodColor" type="color" data-tip="Set a stroke color" style="width:3em; height:14px; padding:0; border:none;" value="${editedGood?.color || "#ff5959"}" />
      </div>

      <label for="newGoodBonuses" style="align-self: start;">Bonuses</label>
      <div id="newGoodBonuses" style="display: grid; grid-template-columns: 1fr 1fr;">${bonusInputsHtml}</div>
    </div>

    <div id="newGoodRawFields">
      <label style="display:block; margin-bottom:.2em">Distribution function:</label>
      <textarea id="newGoodDistribution" style="width:100%; height:4em; font-family:monospace; font-size:.9em; box-sizing:border-box" spellcheck="false" placeholder="e.g. biome(5, 6, 7, 8, 9)">${editedGood?.distribution || ""}</textarea>
      <div id="newGoodDistributionPreview" style="color:#555; font-size:.9em; min-height:1.2em; margin-top:.2em">${editedGood?.distribution ? interpretDistribution(editedGood.distribution) : ""}</div>
      <label style="display:block; margin:.5em 0 .2em">Biome baseline production (biomeId:amount):</label>
      <input id="newGoodBiomeProduction" style="width:100%; box-sizing:border-box" spellcheck="false" placeholder="e.g. 6:0.5, 7:0.5, 8:0.5" value="${biomeProductionToText(editedGood?.biome)}" />
      <div style="color:#666; font-size:.85em; margin-top:.2em">${biomeReference}</div>
    </div>

    <div id="newGoodManufacturedFields" style="display:none;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.4em;">
        <label>Recipes*</label>
        <button id="newGoodAddRecipe">+ Add recipe</button>
      </div>
      <div id="newGoodRecipeList" style="display:flex; flex-direction:column; gap:.45em;"></div>
    </div>

    <div id="newGoodError" style="color:#b20000; min-height:1.2em"></div>
  `;

  const typeSelect = ensureEl("newGoodType") as HTMLSelectElement;
  const rawFields = ensureEl("newGoodRawFields");
  const manufacturedFields = ensureEl("newGoodManufacturedFields");
  const distributionInput = ensureEl("newGoodDistribution") as HTMLTextAreaElement;
  const distributionPreview = ensureEl("newGoodDistributionPreview");

  const recipeList = ensureEl("newGoodRecipeList");
  const defaultGoodId = pack.goods[0]?.i ?? 0;

  const getGoodOptions = (selectedId: number) =>
    pack.goods
      .map(good => `<option value="${good.i}" ${good.i === selectedId ? "selected" : ""}>${good.name}</option>`)
      .join("");

  const renderRecipes = () => {
    if (!recipeDrafts.length) recipeDrafts.push([{id: defaultGoodId, amount: 1}]);
    recipeList.innerHTML = recipeDrafts
      .map(
        (recipe, recipeIndex) => /*html*/ `
          <div class="recipeOption" style="border: 1px solid #ccc;" data-recipe-index="${recipeIndex}" >
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 0.3em 0.7em 0 0;">
              <span>Recipe ${recipeIndex + 1}</span>
              <div style="display:flex; gap:.3em;">
                <span class="recipeAddIngredient icon-plus" data-recipe-index="${recipeIndex}"></span>
                <span class="recipeRemoveOption icon-trash-empty" data-recipe-index="${recipeIndex}"></span>
              </div>
            </div>
            <div class="recipeIngredients" style="display:flex; flex-direction:column; gap:.2em;">
              ${recipe
                .map(
                  (ingredient, ingredientIndex) => /*html*/ `
                    <div style="display:grid; grid-template-columns: 1fr 5em 1.5em; gap:.25em; align-items: center;" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">
                      <select class="recipeGoodSelect" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}">${getGoodOptions(ingredient.id)}</select>
                      <input class="recipeAmountInput" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" type="number" min="1" step="1" value="${ingredient.amount}" />
                      <span class="recipeRemoveIngredient icon-trash-empty" data-recipe-index="${recipeIndex}" data-ingredient-index="${ingredientIndex}" />
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
        const recipeIndex = +select.dataset.recipeIndex!;
        const ingredientIndex = +select.dataset.ingredientIndex!;
        recipeDrafts[recipeIndex][ingredientIndex].id = +select.value;
      };
    });

    recipeList.querySelectorAll<HTMLInputElement>(".recipeAmountInput").forEach(input => {
      input.onchange = () => {
        const recipeIndex = +input.dataset.recipeIndex!;
        const ingredientIndex = +input.dataset.ingredientIndex!;
        const amount = +input.value;
        recipeDrafts[recipeIndex][ingredientIndex].amount = Number.isFinite(amount) && amount > 0 ? amount : 1;
        input.value = String(recipeDrafts[recipeIndex][ingredientIndex].amount);
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeAddIngredient").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        recipeDrafts[recipeIndex].push({id: defaultGoodId, amount: 1});
        renderRecipes();
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveIngredient").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        const ingredientIndex = +button.dataset.ingredientIndex!;
        if (recipeDrafts[recipeIndex].length > 1) {
          recipeDrafts[recipeIndex].splice(ingredientIndex, 1);
          renderRecipes();
        }
      };
    });

    recipeList.querySelectorAll<HTMLButtonElement>(".recipeRemoveOption").forEach(button => {
      button.onclick = event => {
        event.preventDefault();
        const recipeIndex = +button.dataset.recipeIndex!;
        recipeDrafts.splice(recipeIndex, 1);
        renderRecipes();
      };
    });
  };

  ensureEl("newGoodAddRecipe").on("click", event => {
    event.preventDefault();
    recipeDrafts.push([{id: defaultGoodId, amount: 1}]);
    renderRecipes();
  });
  renderRecipes();

  const syncTypeFields = () => {
    const isRaw = typeSelect.value === "raw";
    rawFields.style.display = isRaw ? "" : "none";
    manufacturedFields.style.display = isRaw ? "none" : "";
  };

  distributionInput.oninput = () => {
    try {
      distributionPreview.textContent = distributionInput.value.trim()
        ? interpretDistribution(distributionInput.value.trim())
        : "";
    } catch {
      distributionPreview.textContent = "";
    }
  };

  typeSelect.onchange = syncTypeFields;
  syncTypeFields();

  // icon preview + upload
  const iconSelect = ensureEl<HTMLSelectElement>("newGoodIcon");
  const iconPreview = ensureEl("newGoodIconPreview") as unknown as SVGUseElement;
  iconSelect.onchange = () => iconPreview.setAttribute("href", `#${iconSelect.value}`);

  const uploadTo = ensureEl("defs-icons")!;
  const onIconUpload = (_type: string, id: string) => {
    iconPreview.setAttribute("href", `#${id}`);
    iconSelect.innerHTML += `<option value="${id}">${id}</option>`;
    iconSelect.value = id;
  };
  ensureEl("newGoodUploadIconRaster").onclick = () => (ensureEl("imageToLoad") as HTMLInputElement).click();
  ensureEl("newGoodUploadIconVector").onclick = () => (ensureEl("svgToLoad") as HTMLInputElement).click();
  ensureEl("imageToLoad").onchange = () => uploadImage("image", uploadTo, onIconUpload);
  ensureEl("svgToLoad").onchange = () => uploadImage("svg", uploadTo, onIconUpload);

  $("#alert").dialog({
    width: "30em",
    resizable: false,
    title: isEdit ? "Edit good" : "Add new good",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      [isEdit ? "Apply" : "Add"]: function () {
        const error = ensureEl("newGoodError");
        error.textContent = "";

        const type = ensureEl<HTMLSelectElement>("newGoodType").value as "raw" | "manufactured";
        const name = ensureEl<HTMLInputElement>("newGoodName").value.trim();
        const tagsInput = ensureEl<HTMLInputElement>("newGoodTags").value.trim();
        const value = +ensureEl<HTMLInputElement>("newGoodValue").value;
        const chance = +ensureEl<HTMLInputElement>("newGoodChance").value;
        const unit = ensureEl<HTMLInputElement>("newGoodUnit").value.trim();
        const icon = ensureEl<HTMLSelectElement>("newGoodIcon").value;
        const color = ensureEl<HTMLInputElement>("newGoodColor").value;
        const distribution = distributionInput.value.trim();
        const biomeProductionInput = ensureEl<HTMLInputElement>("newGoodBiomeProduction").value.trim();

        const tags = unique(tagsInput.split(",").map(tag => tag.trim().toLocaleLowerCase()));

        const bonusObj: Record<string, number> = {};
        allBonuses.forEach(bonus => {
          const bonusInput = document.getElementById(`newGoodBonus_${bonus}`) as HTMLInputElement | null;
          if (!bonusInput) return;
          const v = parseInt(bonusInput.value, 10);
          if (!Number.isNaN(v) && v > 0) bonusObj[bonus] = v;
        });

        if (!name) {
          error.textContent = "Name is required";
          return;
        }
        if (!Number.isFinite(value) || value < 0) {
          error.textContent = "Value must be a valid non-negative number";
          return;
        }
        if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
          error.textContent = "Chance must be between 0 and 100";
          return;
        }

        const getNextId = () => {
          let nextId = pack.goods?.at(-1)?.i ?? 1;
          while (Goods.get(nextId)) nextId++;
          return nextId;
        };

        const applyBase = (target: Good) => {
          target.name = name;
          target.tags = tags;
          target.icon = icon;
          target.color = color;
          target.value = value;
          target.chance = chance;
          target.unit = unit;
          target.bonus = bonusObj;
        };

        const distributionMethods = {
          random: (..._args: any[]) => true,
          nth: (..._args: any[]) => true,
          minHabitability: (..._args: any[]) => true,
          habitability: (..._args: any[]) => true,
          elevation: (..._args: any[]) => true,
          biome: (..._args: any[]) => true,
          minHeight: (..._args: any[]) => true,
          maxHeight: (..._args: any[]) => true,
          minTemp: (..._args: any[]) => true,
          maxTemp: (..._args: any[]) => true,
          shore: (..._args: any[]) => true,
          type: (..._args: any[]) => true,
          river: (..._args: any[]) => true
        };

        const parseBiomeProduction = (): Record<number, number> | null => {
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

            if (!Number.isInteger(biomeId) || !biomesData.i.includes(biomeId)) {
              error.textContent = `Invalid biome id in biome production: ${chunk}`;
              return null;
            }
            if (!Number.isFinite(amount) || amount <= 0) {
              error.textContent = `Invalid biome amount in biome production: ${chunk}`;
              return null;
            }

            result[biomeId] = amount;
          }

          return result;
        };

        if (type === "raw") {
          const biomeProduction = parseBiomeProduction();
          if (biomeProduction === null) return;

          if (distribution) {
            try {
              const allMethods = `{${Object.keys(distributionMethods).join(", ")}}`;
              new Function(allMethods, `return ${distribution}`)(distributionMethods);
            } catch (err) {
              error.textContent = `Distribution error: ${(err as Error).message || err}`;
              return;
            }
          }

          if (editedGood) {
            applyBase(editedGood);
            editedGood.distribution = distribution || undefined;
            editedGood.biome = Object.keys(biomeProduction).length ? biomeProduction : undefined;
            delete editedGood.recipes;
          } else {
            pack.goods.push({
              i: getNextId(),
              name,
              tags,
              icon,
              color,
              value,
              chance,
              distribution: distribution || undefined,
              biome: Object.keys(biomeProduction).length ? biomeProduction : undefined,
              unit,
              bonus: bonusObj,
              culture: {},
              cells: 0
            });
          }
        } else {
          const recipes: Record<number, number>[] = [];

          for (const recipe of recipeDrafts) {
            const recipeData: Record<number, number> = {};

            for (const ingredient of recipe) {
              if (!Number.isInteger(ingredient.id) || !Goods.get(ingredient.id)) {
                error.textContent = `Recipe references unknown good id: ${ingredient.id}`;
                return;
              }
              if (!Number.isFinite(ingredient.amount) || ingredient.amount <= 0) {
                error.textContent = `Invalid recipe amount for good id: ${ingredient.id}`;
                return;
              }

              recipeData[ingredient.id] = (recipeData[ingredient.id] || 0) + ingredient.amount;
            }

            if (!Object.keys(recipeData).length) {
              error.textContent = "Each recipe must contain at least one ingredient";
              return;
            }

            recipes.push(recipeData);
          }

          if (!recipes.length) {
            error.textContent = "At least one recipe is required for manufactured goods";
            return;
          }

          if (editedGood) {
            applyBase(editedGood);
            editedGood.recipes = recipes;
            delete editedGood.distribution;
            delete editedGood.biome;
          } else {
            pack.goods.push({
              i: getNextId(),
              name,
              tags,
              icon,
              color,
              value,
              chance,
              recipes,
              unit,
              bonus: bonusObj,
              culture: {},
              cells: 0
            });
          }
        }

        tip(isEdit ? "Good is updated" : "Good is added", false, "success", 5000);
        goodsEditorAddLines();
        goods.selectAll("*").remove();
        drawGoods();
        $(this).dialog("close");
      }
    }
  });
}

function openProductionDebug() {
  const validBurgs = (pack.burgs as any[]).filter((b: any) => b.i && !b.removed);
  if (!validBurgs.length) {
    tip("No burgs available. Generate a world first.", true, "error");
    return;
  }

  validBurgs.sort((a: any, b: any) => (b.population || 0) - (a.population || 0));

  const burgOptions = validBurgs
    .map((b: any) => `<option value="${b.i}">${b.name} (pop: ${b.population ?? 0})</option>`)
    .join("");

  const renderDebug = (burgId: number): string => {
    const debug = Production.getDebugData(burgId);
    if (!debug) {
      return `<div style="color:#888;padding:1em;text-align:center">No production data for this burg.<br>Run map generation or regenerate production first.</div>`;
    }

    const goods = pack.goods;
    const goodName = (id: number) => goods[id]?.name ?? `#${id}`;
    const goodColor = (id: number) => goods[id]?.color ?? "#888";
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const goodDot = (id: number) => {
      const c = goodColor(id);
      return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,0.2);margin-right:3px;vertical-align:middle;flex-shrink:0"></span>`;
    };

    // ── Section 1: Stats bar ────────────────────────────────────────────────
    const cellPct = debug.cellsBudget > 0 ? Math.round((debug.cellsReached / debug.cellsBudget) * 100) : 0;
    const statsHtml = `
      <div style="background:#f5f5f5;border-radius:4px;padding:.4em .8em;margin-bottom:.8em;display:flex;flex-wrap:wrap;gap:.8em;font-size:.85em">
        <span><b>Population:</b> ${debug.population}</span>
        <span><b>Cells:</b> ${debug.cellsReached} / ${debug.cellsBudget} (${cellPct}%)</span>
        <span><b>Culture type:</b> ${debug.cultureType}</span>
        <span><b>Process rank:</b> #${debug.processRank} of ${debug.totalBurgs}</span>
      </div>`;

    // ── Section 2: Goods Pool ───────────────────────────────────────────────
    const poolRows = debug.goodsPull
      .map(g => {
        const baseVal = goods[g.goodId]?.value ?? 0;
        const cvExtra =
          g.chainValue > baseVal + 0.01
            ? ` <span style="color:#4a4;font-size:.78em">(+${r2(g.chainValue - baseVal)})</span>`
            : "";
        const foodBadge = g.isFood
          ? `<span style="background:#fff3cd;color:#856404;font-size:.75em;padding:0 3px;border-radius:2px;margin-left:3px">food</span>`
          : "";
        const cultureMod =
          g.cultureModifier !== 1 ? `<span style="color:#888;font-size:.8em"> ×${r2(g.cultureModifier)}</span>` : "";
        const buyP = r2(debug.pricesAtStart.buy[g.goodId] ?? baseVal);
        const buyColor = buyP > baseVal ? "color:#c84" : buyP < baseVal ? "color:#4a4" : "";
        return `<tr>
        <td style="padding:.2em .4em">${goodDot(g.goodId)}${goodName(g.goodId)}${foodBadge}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(g.pull)}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(g.pull * g.cultureModifier)}${cultureMod}</td>
        <td style="text-align:right;padding:.2em .4em">${r2(g.chainValue)}${cvExtra}</td>
        <td style="text-align:right;padding:.2em .4em;font-weight:bold">${r2(g.priority)}</td>
        <td style="text-align:right;padding:.2em .4em;${buyColor}">${buyP}</td>
      </tr>`;
      })
      .join("");

    const poolHtml = `
      <div style="margin-bottom:.8em">
        <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
          📦 Goods Pool — ${debug.goodsPull.length} goods available (sorted by priority)
        </div>
        ${
          poolRows
            ? `<table style="width:100%;border-collapse:collapse;font-size:.82em">
          <thead><tr style="background:#eee">
            <th style="text-align:left;padding:.2em .4em">Good</th>
            <th style="text-align:right;padding:.2em .4em" title="Raw pull from flood-fill cells">Pull</th>
            <th style="text-align:right;padding:.2em .4em" title="Pull × culture modifier">Effective</th>
            <th style="text-align:right;padding:.2em .4em" title="Elevated by downstream profitable chains">Chain Value</th>
            <th style="text-align:right;padding:.2em .4em" title="Effective × chain value × food bonus (initial queue key)">Priority</th>
            <th style="text-align:right;padding:.2em .4em" title="Buy price when this burg was processed">Buy Price</th>
          </tr></thead>
          <tbody>${poolRows}</tbody>
        </table>`
            : `<i style="color:#888">No goods reached this burg</i>`
        }
      </div>`;

    // ── Section 3: Raw Production (Pass 1) ─────────────────────────────────
    const rawEntries = Object.entries(debug.rawInventoryAfterPass1).filter(([, v]) => v > 0);
    const totalRaw = rawEntries.reduce((s, [, v]) => s + v, 0);
    const rawRows = rawEntries
      .sort(([, a], [, b]) => b - a)
      .map(([gid, amount]) => {
        const id = +gid;
        const pct = totalRaw > 0 ? (amount / totalRaw) * 100 : 0;
        const c = goodColor(id);
        return `<tr>
          <td style="padding:.2em .4em">${goodDot(id)}${goodName(id)}</td>
          <td style="text-align:right;padding:.2em .4em">${r2(amount)}</td>
          <td style="padding:0 .4em;width:7em">
            <div style="background:#eee;border-radius:2px;height:.8em;overflow:hidden">
              <div style="background:${c};width:${Math.min(pct, 100).toFixed(1)}%;height:100%"></div>
            </div>
          </td>
          <td style="text-align:right;color:#888;font-size:.8em;padding:.2em .4em">${pct.toFixed(0)}%</td>
        </tr>`;
      })
      .join("");

    const rawHtml = `
      <div style="margin-bottom:.8em">
        <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
          ⚒ Raw Production — Pass 1 (${debug.population} workers)
        </div>
        ${
          rawRows
            ? `<table style="width:100%;border-collapse:collapse;font-size:.82em">
          <thead><tr style="background:#eee">
            <th style="text-align:left;padding:.2em .4em">Good</th>
            <th style="text-align:right;padding:.2em .4em">Units</th>
            <th colspan="2" style="padding:.2em .4em">Share</th>
          </tr></thead>
          <tbody>${rawRows}</tbody>
        </table>`
            : `<i style="color:#888">No raw goods produced</i>`
        }
      </div>`;

    // ── Section 4: Manufacturing (Pass 2) ──────────────────────────────────
    const mfgRows = debug.manufactured
      .map(m => {
        const ingText = m.recipeIngredients
          .map(ing => `${goodDot(ing.goodId)}${goodName(ing.goodId)}&nbsp;×${r2(ing.consumed)}`)
          .join(`<span style="color:#888;margin:0 .3em">+</span>`);
        const profColor = m.profit > 0 ? "color:#4a4" : "color:#c44";
        const sellAtTime = r2(debug.pricesAtStart.sell[m.goodId] ?? 0);
        return `<tr>
        <td style="padding:.2em .4em">${goodDot(m.goodId)}<b>${goodName(m.goodId)}</b></td>
        <td style="text-align:right;padding:.2em .4em">${r2(m.producedAmount)}</td>
        <td style="text-align:right;padding:.2em .4em;${profColor}" title="Sell price − ingredient cost">${r2(m.profit)}</td>
        <td style="text-align:right;padding:.2em .4em;color:#888">${sellAtTime}</td>
        <td style="padding:.2em .4em;font-size:.82em;color:#555">${ingText}</td>
      </tr>`;
      })
      .join("");

    const mfgHtml = `
      <div style="margin-bottom:.8em">
        <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
          🔨 Manufacturing — Pass 2 (${debug.manufactured.length} goods crafted)
        </div>
        ${
          mfgRows
            ? `<table style="width:100%;border-collapse:collapse;font-size:.82em">
          <thead><tr style="background:#eee">
            <th style="text-align:left;padding:.2em .4em">Output</th>
            <th style="text-align:right;padding:.2em .4em">Units</th>
            <th style="text-align:right;padding:.2em .4em" title="Sell price − ingredient buy cost">Profit/u</th>
            <th style="text-align:right;padding:.2em .4em" title="Sell price at time of processing">Sell Price</th>
            <th style="text-align:left;padding:.2em .4em">Ingredients consumed</th>
          </tr></thead>
          <tbody>${mfgRows}</tbody>
        </table>`
            : `<i style="color:#888">No manufacturing performed</i>`
        }
      </div>`;

    // ── Section 5: Final Output ─────────────────────────────────────────────
    const finalEntries = Object.entries(debug.finalInventory).filter(([, v]) => v > 0);
    const finalTotalValue = finalEntries.reduce((s, [gid, amt]) => {
      const sp = goods[+gid]?.sellPrice ?? goods[+gid]?.value ?? 0;
      return s + amt * sp;
    }, 0);

    const finalRows = finalEntries
      .sort(([, a], [, b]) => b - a)
      .map(([gid, amount]) => {
        const id = +gid;
        const sp = goods[id]?.sellPrice ?? goods[id]?.value ?? 0;
        const bv = goods[id]?.value ?? 0;
        const isManufactured = !!goods[id]?.recipes?.length;
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

    const finalHtml = `
      <div>
        <div style="font-weight:bold;border-bottom:1px solid #ccc;padding-bottom:.2em;margin-bottom:.4em;font-size:.9em">
          📊 Final Output — total market value: <b>${r2(finalTotalValue)}</b>
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

    return statsHtml + poolHtml + rawHtml + mfgHtml + finalHtml;
  };

  const firstBurgId = validBurgs[0].i;

  alertMessage.innerHTML = /*html*/ `
    <div style="display:flex;align-items:center;gap:.5em;margin-bottom:.8em">
      <label for="prodDebugBurgSelect" style="white-space:nowrap;font-weight:bold">Burg:</label>
      <select id="prodDebugBurgSelect" style="flex:1">${burgOptions}</select>
    </div>
    <div id="prodDebugContent" style="max-height:65vh;overflow-y:auto">
      ${renderDebug(firstBurgId)}
    </div>
  `;

  (ensureEl("prodDebugBurgSelect") as HTMLSelectElement).onchange = function () {
    ensureEl("prodDebugContent").innerHTML = renderDebug(+(this as HTMLSelectElement).value);
  };

  $("#alert").dialog({
    width: "48em",
    resizable: true,
    title: "Production Debug",
    buttons: {
      Close: function () {
        $(this).dialog("close");
      }
    }
  });
}

function downloadGoodsData() {
  const body = ensureEl("goodsBody");
  let data = "Id,Good,Color,Type,Tags,Value,Bonus,Chance,Model,Cells\n";

  body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
    const goodId = +el.dataset.id!;
    const good = Goods.get(goodId);
    if (!good) return;
    const type = good.recipes ? "manufactured" : "raw";

    data += `${el.dataset.id},`;
    data += `${el.dataset.name},`;
    data += `${el.dataset.color},`;
    data += `"${type}",`;
    data += `${el.dataset.tags},`;
    data += `${el.dataset.value},`;
    data += `${el.dataset.bonus},`;
    data += `${el.dataset.chance},`;
    data += `${el.dataset.model},`;
    data += `${el.dataset.cells}\n`;
  });

  const name = `${getFileName("Goods")}.csv`;
  downloadFile(data, name);
}

function pinResource(good: Good, el: HTMLElement) {
  const pin = el.classList.contains("inactive");
  el.classList.toggle("inactive");

  if (pin) good.pinned = true;
  else delete good.pinned;

  goods.selectAll("*").remove();
  drawGoods();

  const someArePinned = pack.goods.some(good => good.pinned);
  const unpinAll = ensureEl("goodsUnpinAll")!;
  someArePinned ? unpinAll.classList.remove("hidden") : unpinAll.classList.add("hidden");
}

function unpinAllGoods() {
  const body = ensureEl("goodsBody");
  pack.goods.forEach(good => {
    delete good.pinned;
  });
  goods.selectAll("*").remove();
  drawGoods();

  ensureEl("goodsUnpinAll").classList.add("hidden");
  body.querySelectorAll(":scope > div > span.icon-pin").forEach(el => {
    el.classList.add("inactive");
  });
}

function removeResource(good: Good, line: HTMLElement) {
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

    goods.selectAll("*").remove();
    drawGoods();
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
  unpinAllGoods();
  ensureEl("goodsBody").innerHTML = "";
}

declare global {
  var GoodsEditor: {open: () => void};
}

window.GoodsEditor = {open};
