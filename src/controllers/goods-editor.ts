import {pointer} from "d3";
import type {Good} from "../modules/goods-generator";
import {ensureEl} from "../utils";

let isInitialized = false;

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
    position: {my: "right top", at: "right-10 top+10", of: "svg"}
  });

  if (!isInitialized) {
    // add listeners once per session, dialog is re-opened on each open
    ensureEl("goodsMoreData").on("click", toggleMoreData);
    ensureEl("goodsEditorRefresh").on("click", goodsEditorAddLines);
    ensureEl("goodsLegend").on("click", toggleLegend);
    ensureEl("goodsPercentage").on("click", togglePercentageMode);
    ensureEl("goodsAssign").on("click", enterResourceAssignMode);
    ensureEl("goodsAdd").on("click", goodAdd);
    ensureEl("goodsRestore").on("click", goodsRestoreDefaults);
    ensureEl("goodsExport").on("click", downloadGoodsData);
    ensureEl("goodsUnpinAll").on("click", unpinAllGoods);

    ensureEl("goodsBody").on("click", ev => {
      const el = ev.target as HTMLElement;
      const cl = el.classList;
      const line = el.parentNode as HTMLElement;
      const good = Goods.get(+line.dataset.id!);
      if (!good) return;
      if (cl.contains("goodIcon")) return changeIcon(good, line, el);
      if (cl.contains("goodCategory")) return changeCategory(good, line, el);
      if (cl.contains("goodModel")) return changeModel(good, line, el);
      if (cl.contains("goodBonus")) return changeBonus(good, line, el);
      if (cl.contains("icon-pin")) return pinResource(good, el);
      if (cl.contains("icon-trash-empty")) return removeResource(good, line);
    });

    ensureEl("goodsBody").on("change", ev => {
      const el = ev.target as HTMLInputElement;
      const cl = el.classList;
      const line = el.parentNode as HTMLElement;
      const good = Goods.get(+line.dataset.id!);
      if (!good) return;
      if (cl.contains("goodName")) return changeName(good, el.value, line);
      if (cl.contains("goodValue")) return changeValue(good, el.value, line);
      if (cl.contains("goodChance")) return changeChance(good, el.value, line);
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
  const addTitle = (string: string, max: number) => (string.length < max ? "" : `title="${string}"`);
  let lines = "";

  for (const r of pack.goods) {
    const stroke = Goods.getStroke(r.color);
    const model = r.model.replaceAll("_", " ");
    const bonusArray = Object.entries(r.bonus).flatMap(([k, v]) => Array(v as number).fill(k)) as unknown as string[];
    const bonusHTML = bonusArray.map((bonus: string) => getBonusIcon(bonus)).join("");
    const bonusString = Object.entries(r.bonus)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");

    lines += `<div class="states goods"
          data-id=${r.i} data-name="${r.name}" data-color="${r.color}"
          data-category="${r.category}" data-chance="${r.chance}" data-bonus="${bonusString}"
          data-value="${r.value}" data-model="${r.model}" data-cells="${r.cells}">
        <svg data-tip="Good icon. Click to change" width="2em" height="2em" class="goodIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${r.color}" stroke="${stroke}"/>
          <use href="#${r.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <input data-tip="Good name. Click and category to change" class="goodName" value="${r.name}" autocorrect="off" spellcheck="false">
        <div data-tip="Good category. Select to change" class="goodCategory">${r.category}</div>
        <input data-tip="Good generation chance in eligible cell. Click and type to change" class="goodChance hidden show" value="${r.chance}" type="number" min=0 max=100 step=.1 />
        <div data-tip="Number of cells with good" class="goodCells">${r.cells}</div>

        <div data-tip="Good spread model. Click to change" class="goodModel hidden show" ${addTitle(model, 8)}>${model}</div>
        <span data-tip="Good basic value" class="hide" style="margin-right: -0.3em">🟡</span>
        <input data-tip="Good basic value. Click and type to change" class="goodValue hide" value="${r.value}" type="number" min=0 max=100 step=1 />
        <div data-tip="Good bonus. Click to change" class="goodBonus hide" title="${bonusString}">${bonusHTML || "<span style='opacity:0'>place</span>"}</div>

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

  const moreDataBtn = ensureEl("goodsMoreData");
  if (moreDataBtn?.classList.contains("active")) {
    body.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.remove("hidden"));
  }
  $("#goodsEditor").dialog({width: fitContent()});
}

function changeCategory(good: Good, line: HTMLElement, el: HTMLElement) {
  const categories = [...new Set(pack.goods.map(good => good.category))].sort();
  const categoryOptions = (category: string) =>
    (categories as string[])
      .map(c => `<option ${c === category ? "selected" : ""} value="${c}">${c}</option>`)
      .join("");

  alertMessage.innerHTML = `
      <div style="margin-bottom:.2em" data-tip="Select category from the list">
        <div style="display: inline-block; width: 9em">Select category:</div>
        <select style="width: 9em" id="resouceCategorySelect">${categoryOptions(line.dataset.category!)}</select>
      </div>

      <div style="margin-bottom:.2em" data-tip="Type new category name">
        <div style="display: inline-block; width: 9em">Custom category:</div>
        <input style="width: 9em" id="resouceCategoryAdd" placeholder="Category name" />
      </div>
    `;

  $("#alert").dialog({
    resizable: false,
    title: "Change category",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        applyChanges();
        $(this).dialog("close");
      }
    }
  });

  function applyChanges() {
    const custom = (ensureEl("resouceCategoryAdd") as HTMLInputElement).value;
    const select = (ensureEl("resouceCategorySelect") as HTMLSelectElement).value;
    const category = custom ? capitalize(custom) : select;
    good.category = line.dataset.category = el.innerHTML = category;
  }
}

function changeModel(good: Good, line: HTMLElement, el: HTMLElement) {
  const model = line.dataset.model!;
  const modelOptions = Object.keys(Goods.models)
    .sort()
    .map(m => `<option ${m === model ? "selected" : ""} value="${m}">${m.replaceAll("_", " ")}</option>`)
    .join("");
  const wikiURL = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Resources:-spread-functions";
  const onSelect =
    "resouceModelFunction.innerHTML = Goods.models[this.value] || ' '; resouceModelCustomName.value = ''; resouceModelCustomFunction.value = ''";

  alertMessage.innerHTML = `
      <fieldset data-tip="Select one of the predefined spread models from the list" style="border: 1px solid #999; margin-bottom: 1em">
        <legend>Predefined models</legend>
        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Name:</div>
          <select onchange="${onSelect}" style="width: 18em" id="resouceModelSelect">
            <option value=""><i>Custom</i></option>
            ${modelOptions}
          </select>
        </div>

        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Function:</div>
          <div id="resouceModelFunction" style="display: inline-block; width: 18em; font-family: monospace; border: 1px solid #ccc; padding: 3px; font-size: .95em;vertical-align: middle">
            ${Goods.models[model as keyof typeof Goods.models] || " "}
          </div>
        </div>
      </fieldset>

      <fieldset data-tip="Advanced option. Define custom spread model, click on 'Help' for details" style="border: 1px solid #999">
        <legend>Custom model</legend>
        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Name:</div>
          <input style="width: 18em" id="resouceModelCustomName" value="${good.custom ? good.model : ""}" />
        </div>

        <div>
          <div style="display: inline-block; width: 6em">Function:</div>
          <input style="width: 18.75em; font-family: monospace; font-size: .95em" id="resouceModelCustomFunction" spellcheck="false" value="${good.custom || ""}"/>
        </div>
      </fieldset>

      <div id="goodModelMessage" style="color: #b20000; margin: .4em 1em 0"></div>
    `;

  $("#alert").dialog({
    resizable: false,
    title: "Change spread model",
    buttons: {
      Help: () => openURL(wikiURL),
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        applyChanges(this);
      }
    }
  });

  function applyChanges(dialog: object) {
    const customName = (ensureEl("resouceModelCustomName") as HTMLInputElement).value;
    const customFn = (ensureEl("resouceModelCustomFunction") as HTMLInputElement).value;

    const message = ensureEl("goodModelMessage")!;
    if (customName && !customFn) {
      message.innerHTML = "Error. Custom model function is required";
      return;
    }
    if (!customName && customFn) {
      message.innerHTML = "Error. Custom model name is required";
      return;
    }
    message.innerHTML = "";

    if (customName && customFn) {
      try {
        const allMethods = `{${Object.keys(Goods.methods).join(", ")}}`;
        const fn = new Function(allMethods, `return ${customFn}`);
        fn({...Goods.methods});
      } catch (err) {
        message.innerHTML = `Error. ${(err as Error).message || err}`;
        return;
      }

      good.model = line.dataset.model = el.innerHTML = customName;
      el.setAttribute("title", customName.length > 7 ? customName : "");
      good.custom = customFn;
      $(dialog).dialog("close");
      return;
    }

    const selectedModel = (ensureEl("resouceModelSelect") as HTMLSelectElement).value;
    if (!selectedModel) {
      message.innerHTML = "Error. Model is not set";
      return;
    }

    good.model = line.dataset.model = el.innerHTML = selectedModel;
    el.setAttribute("title", selectedModel.length > 7 ? selectedModel : "");
    $(dialog).dialog("close");
  }
}

function changeBonus(good: Good, line: HTMLElement, el: HTMLElement) {
  const bonuses = [...new Set(pack.goods.flatMap(good => Object.keys(good.bonus)))].sort();
  const inputs = bonuses.map(
    bonus => `<div style="margin-bottom:.2em">
        ${getBonusIcon(bonus)}
        <div style="display: inline-block; width: 8em">${capitalize(bonus)}</div>
        <input id="goodBonus_${bonus}" style="width: 4.1em" type="number" step="1" min="0" max="9" value="${good.bonus[bonus] || 0}" />
      </div>`
  );

  alertMessage.innerHTML = inputs.join("");
  $("#alert").dialog({
    resizable: false,
    title: "Change bonus",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        applyChanges();
        $(this).dialog("close");
      }
    }
  });

  function applyChanges() {
    const bonusObj: Record<string, number> = {};
    bonuses.forEach(bonus => {
      const bonusEl = ensureEl(`goodBonus_${bonus}`) as HTMLInputElement;
      const value = parseInt(bonusEl.value, 10);
      if (Number.isNaN(value) || !value) return;
      bonusObj[bonus] = value;
    });

    const bonusArray = Object.entries(bonusObj).flatMap(([k, v]) => Array(v).fill(k)) as unknown as string[];
    const bonusHTML = bonusArray.map((bonus: string) => getBonusIcon(bonus)).join("");
    const bonusString = Object.entries(bonusObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");

    good.bonus = bonusObj;
    el.innerHTML = bonusHTML || "<span style='opacity:0'>place</span>";
    line.dataset.bonus = bonusString;
    el.setAttribute("title", bonusString);
  }
}

function changeName(good: Good, name: string, line: HTMLElement) {
  good.name = line.dataset.name = name;
}

function changeValue(good: Good, value: string, line: HTMLElement) {
  good.value = +value;
  line.dataset.value = value;
}

function changeChance(good: Good, chance: string, line: HTMLElement) {
  good.chance = +chance;
  line.dataset.chance = chance;
}

function changeIcon(good: Good, line: HTMLElement, _el: HTMLElement) {
  const standardIcons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const standardIconsOptions = standardIcons.map(icon => `<option value=${icon}>${icon}</option>`);

  const customIconsEl = ensureEl("defs-icons");
  const customIcons = customIconsEl ? Array.from(customIconsEl.querySelectorAll("svg")).map(el => el.id) : [];
  const customIconsOptions = customIcons.map(icon => `<option value=${icon}>${icon}</option>`);

  const select = ensureEl("goodSelectIcon") as HTMLSelectElement;
  select.innerHTML = standardIconsOptions.join("") + customIconsOptions.join("");
  select.value = good.icon;

  const preview = ensureEl("goodIconPreview") as unknown as SVGUseElement;
  preview.setAttribute("href", `#${good.icon}`);

  const viewBoxSection = ensureEl("goodIconEditorViewboxFields") as HTMLElement;
  viewBoxSection.style.display = "none";

  $("#goodIconEditor").dialog({
    resizable: false,
    title: "Change Icon",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      "Change color": () => changeColor(good, line, _el),
      Apply: function () {
        $(this).dialog("close");

        good.icon = select.value;
        line.querySelector("svg.goodIcon > use")!.setAttribute("href", `#${select.value}`);
        drawGoods();
      }
    },
    position: {my: "center bottom", at: "center", of: "svg"}
  });

  const uploadTo = ensureEl("defs-icons")!;
  const onUpload = (type: string, id: string) => {
    preview.setAttribute("href", `#${id}`);
    select.innerHTML += `<option value=${id}>${id}</option>`;
    select.value = id;

    if (type === "image") return;

    const iconEl = ensureEl(id)!;
    viewBoxSection.style.display = "block";
    const viewBoxAttr = iconEl.getAttribute("viewBox");
    const initialViewBox = viewBoxAttr ? viewBoxAttr.split(" ") : [0, 0, 200, 200];
    const inputs = viewBoxSection.querySelectorAll("input");
    const changeInput = () => {
      const viewBox = Array.from(inputs)
        .map(input => (input as HTMLInputElement).value)
        .join(" ");
      iconEl.setAttribute("viewBox", viewBox);
    };
    inputs.forEach((input, i) => {
      (input as HTMLInputElement).value = String(initialViewBox[i]);
      (input as HTMLInputElement).onchange = changeInput;
    });
  };

  select.onchange = () => preview.setAttribute("href", `#${select.value}`);
  ensureEl("goodUploadIconRaster").onclick = () => (ensureEl("imageToLoad") as HTMLInputElement).click();
  ensureEl("goodUploadIconVector").onclick = () => (ensureEl("svgToLoad") as HTMLInputElement).click();
  ensureEl("imageToLoad").onchange = () => uploadImage("image", uploadTo, onUpload);
  ensureEl("svgToLoad").onchange = () => uploadImage("svg", uploadTo, onUpload);
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

function changeColor(good: Good, line: HTMLElement, _el: HTMLElement) {
  const circle = line.querySelector("circle")!;

  const callback = (fill: string) => {
    const stroke = Goods.getStroke(fill);
    circle.setAttribute("fill", fill);
    circle.setAttribute("stroke", stroke);
    good.color = fill;
    good.stroke = stroke;
    goods.selectAll(`circle[data-i='${good.i}']`).attr("fill", fill).attr("stroke", stroke);
    line.dataset.color = fill;
  };

  openPicker(good.color, callback, {allowHatching: false});
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

function toggleMoreData() {
  const body = ensureEl("goodsBody");
  const btn = ensureEl("goodsMoreData")!;
  const header = ensureEl("goodsHeader")!;
  const isActive = btn.classList.toggle("active");

  if (isActive) {
    body.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.remove("hidden"));
    header.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.remove("hidden"));
    header.style.gridTemplateColumns = "2em 8em 5em 6em 4.4em 7em 5em 5em 2em";
  } else {
    body.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.add("hidden"));
    header.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.add("hidden"));
    header.style.gridTemplateColumns = "2em 8em 5em 4.4em 5em 5em 2em";
  }
  $("#goodsEditor").dialog({width: fitContent()});
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

  document
    .getElementById("goodsEditor")!
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("goodsFooter").style.display = "none";
  body.querySelectorAll<HTMLElement>(".goodName, .goodCategory, .goodChance, .goodCells, svg").forEach(e => {
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

  body.querySelector<HTMLElement>("div")?.classList.add("selected");

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
  body.querySelectorAll<HTMLElement>(".goodName, .goodCategory, .goodChance, .goodCells, svg").forEach(e => {
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

function goodAdd() {
  if (pack.goods.length >= 256) return tip("Maximum number of goods is reached", false, "error");

  let i = pack.goods[pack.goods.length - 1].i;
  while (Goods.get(i)) {
    i++;
  }

  const good: Good = {
    i,
    name: `Good${i}`,
    category: "Unknown",
    icon: "good-unknown",
    color: "#ff5959",
    value: 1,
    chance: 10,
    model: "habitability",
    unit: "",
    bonus: {population: 1} as Record<string, number>,
    culture: {} as Record<string, number>,
    cells: 0
  };
  pack.goods.push(good);
  tip("Good is added", false, "success", 3000);
  goodsEditorAddLines();
}

function downloadGoodsData() {
  const body = ensureEl("goodsBody");
  let data = "Id,Good,Color,Category,Value,Bonus,Chance,Model,Cells\n";

  body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
    data += `${el.dataset.id},`;
    data += `${el.dataset.name},`;
    data += `${el.dataset.color},`;
    data += `${el.dataset.category},`;
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
