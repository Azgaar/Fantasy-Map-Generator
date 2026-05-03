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
    ensureEl("goodsMoreData").on("click", toggleMoreData);
    ensureEl("goodsEditorRefresh").on("click", goodsEditorAddLines);
    ensureEl("goodsLegend").on("click", toggleLegend);
    ensureEl("goodsPercentage").on("click", togglePercentageMode);
    ensureEl("goodsTagsFilter").on("click", openTagsVisibilityDialog);
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
      if (cl.contains("goodTags")) return changeTags(good, line, el);
      if (cl.contains("goodModel") && !good.recipe) return changeDistribution(good, line, el);
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
  let lines = "";

  for (const good of pack.goods) {
    const stroke = Goods.getStroke(good.color);
    const isRaw = !good.recipe;
    const goodType = isRaw ? "raw" : "manufactured";
    const distribution = good.distribution || "";
    const readable = distribution ? interpretDistribution(distribution) : "";
    const bonusArray = Object.entries(good.bonus).flatMap(([k, v]) =>
      Array(v as number).fill(k)
    ) as unknown as string[];
    const bonusHTML = bonusArray.map((bonus: string) => getBonusIcon(bonus)).join("");
    const bonusString = Object.entries(good.bonus)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    const tags = good.tags.join(", ");

    lines += `<div class="states goods"
          data-id=${good.i} data-name="${good.name}" data-color="${good.color}" data-type="${goodType}"
          data-tags="${tags}" data-chance="${good.chance}" data-bonus="${bonusString}"
          data-value="${good.value}" data-model="${distribution}" data-cells="${good.cells}">
        <svg data-tip="Good icon. Click to change" width="2em" height="2em" class="goodIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${good.color}" stroke="${stroke}"/>
          <use href="#${good.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <input data-tip="Good name. Click and tags to change" class="goodName" value="${good.name}" autocorrect="off" spellcheck="false">
        <div data-tip="Good type" class="goodType">${goodType}</div>
        <div data-tip="Good tags. Click to add or remove tags" class="goodTags" title="${tags}">${tags}</div>
        <div data-tip="Number of cells with good" class="goodCells">${good.cells}</div>

        <span data-tip="Good basic value" class="hide" style="margin-right: -0.3em">🟡</span>
        <input data-tip="Good basic value. Click and type to change" class="goodValue hide" value="${good.value}" type="number" min=0 max=100 step=1 />
        <div data-tip="Good bonus. Click to change" class="goodBonus hide" title="${bonusString}">${bonusHTML || "<span style='opacity:0'>place</span>"}</div>

        <input data-tip="Good generation chance in eligible cell. Click and type to change" class="goodChance hidden show" value="${good.chance}" type="number" min=0 max=100 step=.1 />
        <div data-tip="Good distribution condition. Click to edit" class="goodModel hidden show" title="${distribution}">${readable}</div>

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

function changeTags(good: Good, line: HTMLElement, el: HTMLElement) {
  let selectedTags = [...good.tags];

  const render = () => {
    const allTags = new Set(pack.goods.flatMap(good => good.tags));
    const assignedTags = selectedTags.length
      ? selectedTags
          .map(
            tag => `<span style="display:inline-flex; align-items:center; margin:.1em .2em .1em 0; padding:.1em .35em; border:1px solid #bbb; border-radius: .35em;">
              <span>${tag}</span>
              <button type="button" class="goodTagRemove" data-tag="${tag}" style="margin-left:.35em; line-height:1; border:none; background:transparent; cursor:pointer">x</button>
              </span>`
          )
          .join("")
      : '<span style="color:#666">No tags assigned</span>';

    const knownTags = allTags.size
      ? Array.from(allTags)
          .map(
            tag =>
              `<label style="display:block; margin:.15em 0"><input type="checkbox" class="goodKnownTagCheck native" value="${tag}" ${selectedTags.some(value => value === tag) ? "checked" : ""} /> ${tag}</label>`
          )
          .join("")
      : '<span style="color:#666">No tags in goods list yet</span>';

    alertMessage.innerHTML = `
      <div style="margin-bottom:.5em" data-tip="Tags are free text labels used only for data organization">
        Assigned tags:
      </div>
      <div id="goodAssignedTags" style="margin-bottom:.6em">${assignedTags}</div>

      <div style="margin-bottom:.35em">
        <input id="goodTagToAdd" placeholder="New tag" style="width: 14em" />
        <button id="goodTagAddButton" type="button">Add</button>
      </div>

      <div data-tip="Toggle existing tags on or off">
        Known tags:
      </div>
      <div style="max-height: 12em; overflow: auto; border: 1px solid #ccc; padding: .4em;">${knownTags}</div>
    `;

    alertMessage.querySelectorAll<HTMLButtonElement>(".goodTagRemove").forEach(btn => {
      btn.onclick = () => {
        const tag = btn.dataset.tag || "";
        selectedTags = selectedTags.filter(value => value !== tag);
        render();
      };
    });

    alertMessage.querySelectorAll<HTMLInputElement>(".goodKnownTagCheck").forEach(check => {
      check.onchange = () => {
        const tag = check.value.trim();
        if (!tag) return;
        if (check.checked && !selectedTags.some(value => value === tag)) selectedTags.push(tag);
        if (!check.checked) selectedTags = selectedTags.filter(value => value !== tag);
        selectedTags = [...new Set(selectedTags)];
        render();
      };
    });

    const addInput = ensureEl("goodTagToAdd") as HTMLInputElement;
    ensureEl("goodTagAddButton").onclick = () => {
      let tag = addInput.value.trim();
      tag = tag.replace(/[<>"'%,;&]/g, "");

      if (!tag) return;
      if (!selectedTags.some(value => value === tag)) selectedTags.push(tag);
      selectedTags = [...new Set(selectedTags)];
      render();
    };
  };

  render();
  $("#alert").dialog({
    width: "20em",
    title: "Edit tags",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        good.tags = [...new Set(selectedTags)];
        line.dataset.tags = good.tags.join(",");
        el.innerHTML = good.tags.join(", ") || "<span style='opacity:0'>place</span>";
        applyTagVisibilityFilter();

        $(this).dialog("close");
      }
    }
  });
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
    .replace(/river\(\)/g, "near river")
    .replace(/minHabitability\((\d+)\)/g, (_, n) => `habitability ≥ ${n}%`)
    .replace(/habitability\(\)/g, "random by habitability")
    .replace(/elevation\(\)/g, "random by elevation")
    .replace(/nth\((\d+)\)/g, (_, n) => `1 in ${n} cells`)
    .replace(/random\((\d+)\)/g, (_, n) => `${n}% chance`)
    .replace(/\s*&&\s*/g, " AND ")
    .replace(/\s*\|\|\s*/g, " OR ")
    .replace(/!\s*/g, "NOT ")
    .replace(/\s+/g, " ")
    .trim();
}

function changeDistribution(good: Good, line: HTMLElement, el: HTMLElement) {
  const current = good.distribution || "";
  const wikiURL = "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Goods:-spread-functions";

  alertMessage.innerHTML = /*html*/ `
    <div style="margin-bottom:.4em">Distribution function (spread condition):</div>
    <textarea id="goodDistributionInput" style="width:100%; height:5em; font-family:monospace; font-size:.9em; box-sizing:border-box" spellcheck="false">${current}</textarea>
    <div style="margin:.3em 0; color:#555; font-size:.9em; min-height:1.2em" id="goodDistributionPreview">${current ? interpretDistribution(current) : ""}</div>
    <div id="goodDistributionError" style="color:#b20000; min-height:1em"></div>
  `;

  const input = ensureEl("goodDistributionInput") as HTMLTextAreaElement;
  const previewEl = ensureEl("goodDistributionPreview");
  input.oninput = () => {
    try {
      previewEl.textContent = input.value.trim() ? interpretDistribution(input.value.trim()) : "";
    } catch {
      previewEl.textContent = "";
    }
  };

  $("#alert").dialog({
    width: "30em",
    resizable: false,
    title: "Change distribution",
    buttons: {
      Help: () => openURL(wikiURL),
      Cancel: function () {
        $(this).dialog("close");
      },
      Apply: function () {
        const fn = input.value.trim();
        const errorEl = ensureEl("goodDistributionError");
        errorEl.textContent = "";
        if (!fn) {
          good.distribution = undefined;
          el.innerHTML = "";
          el.setAttribute("title", "");
          line.dataset.model = "";
          $(this).dialog("close");
          return;
        }
        try {
          const allMethods = `{${Object.keys(Goods.methods).join(", ")}}`;
          new Function(allMethods, `return ${fn}`)({...Goods.methods});
        } catch (err) {
          errorEl.textContent = `Error: ${(err as Error).message || err}`;
          return;
        }
        good.distribution = fn;
        const readable = interpretDistribution(fn);
        el.innerHTML = readable;
        el.setAttribute("title", fn);
        line.dataset.model = fn;
        $(this).dialog("close");
      }
    }
  });
}

function changeBonus(good: Good, line: HTMLElement, el: HTMLElement) {
  const bonuses = [...new Set(pack.goods.flatMap(good => Object.keys(good.bonus)))].sort();
  const inputs = bonuses.map(
    bonus => `<div style="margin-bottom:.2em">
        ${getBonusIcon(bonus)}
        <div style="display: inline-block; width: 8em">${capitalize(bonus)}</div>
        <input id="goodBonus_${bonus}" style="width: 4.1em" type="number" step="1" min="0" max="9" value="${good.bonus[bonus as keyof Good["bonus"]] || 0}" />
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
  } else {
    body.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.add("hidden"));
    header.querySelectorAll<HTMLElement>(".show").forEach(el => void el.classList.add("hidden"));
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
  body.querySelectorAll<HTMLElement>(".goodName, .goodTags, .goodChance, .goodCells, svg").forEach(e => {
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
  body.querySelectorAll<HTMLElement>(".goodName, .goodTags, .goodChance, .goodCells, svg").forEach(e => {
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
  const standardIcons = Array.from(ensureEl("good-icons").querySelectorAll("symbol")).map(el => el.id);
  const customIconsEl = ensureEl("defs-icons");
  const customIcons = customIconsEl ? Array.from(customIconsEl.querySelectorAll("svg")).map(el => el.id) : [];
  const iconOptions = [...standardIcons, ...customIcons]
    .map(icon => `<option value="${icon}" ${icon === "good-unknown" ? "selected" : ""}>${icon}</option>`)
    .join("");

  const allBonuses = unique(pack.goods.flatMap(good => Object.keys(good.bonus)));
  const bonusInputsHtml = allBonuses
    .map(
      bonus => `<span>
        ${getBonusIcon(bonus)}
        <div style="display: inline-block; width: 5em;">${capitalize(bonus)}</div>
        <input id="newGoodBonus_${bonus}" type="number" style="width: 3em;" step="1" min="0" max="9" value="0" />
      </span>`
    )
    .join("");

  alertMessage.innerHTML = /*html*/ `
    <div style="display:grid; grid-template-columns: 8em 1fr; align-items:center;">
      <label for="newGoodName">Name*</label>
      <input id="newGoodName" value="" />

      <label for="newGoodType">Type*</label>
      <select id="newGoodType">
        <option value="raw" selected>raw</option>
        <option value="manufactured">manufactured</option>
      </select>

      <label for="newGoodTags">Tags</label>
      <input id="newGoodTags" value="" placeholder="comma separated" />

      <label for="newGoodValue">Value*</label>
      <input id="newGoodValue" type="number" min="0" step="1" value="1" />

      <label for="newGoodChance">Chance*</label>
      <input id="newGoodChance" type="number" min="0" max="100" step="0.1" value="3" />

      <label for="newGoodUnit">Unit</label>
      <input id="newGoodUnit" placeholder="e.g. wagon, barrel" />

      <label for="newGoodIcon">Icon</label>
      <div style="display:flex; align-items:center; gap:.4em;">
        <select id="newGoodIcon" style="width: 8em;">${iconOptions}</select>
        <svg width="20" height="20" viewBox="0 0 200 200" style="flex-shrink:0"><use id="newGoodIconPreview" href="#good-unknown"/></svg>
        <button id="newGoodUploadIconRaster" class="icon-upload" data-tip="Upload raster icon"></button>
        <button id="newGoodUploadIconVector" class="icon-upload-cloud" data-tip="Upload vector (SVG) icon"></button>
        <input id="newGoodColor" type="color" data-tip="Set a stroke color" style="width:3em; height:14px; padding:0; border:none;" value="#ff5959" />
      </div>

      <label for="newGoodBonuses" style="align-self: start;">Bonuses</label>
      <div id="newGoodBonuses" style="display: grid; grid-template-columns: 1fr 1fr;">${bonusInputsHtml}</div>
    </div>

    <div id="newGoodRawFields">
      <label style="display:block; margin-bottom:.2em">Distribution function:</label>
      <textarea id="newGoodDistribution" style="width:100%; height:4em; font-family:monospace; font-size:.9em; box-sizing:border-box" spellcheck="false" placeholder="e.g. biome(5, 6, 7, 8, 9)"></textarea>
      <div id="newGoodDistributionPreview" style="color:#555; font-size:.9em; min-height:1.2em; margin-top:.2em"></div>
    </div>

    <div id="newGoodManufacturedFields" style="display:none;">
      <div style="display:grid; grid-template-columns: 8em 1fr; align-items:center;">
        <label for="newGoodRecipe">Recipe*</label>
        <input id="newGoodRecipe" placeholder="goodId:amount, goodId:amount" spellcheck="false" />
        <div></div>
        <div style="color:#666; font-size:.95em">Example: 4:1, 34:2</div>
      </div>
    </div>

    <div id="newGoodError" style="color:#b20000; min-height:1.2em"></div>
  `;

  const typeSelect = ensureEl("newGoodType") as HTMLSelectElement;
  const rawFields = ensureEl("newGoodRawFields");
  const manufacturedFields = ensureEl("newGoodManufacturedFields");
  const distributionInput = ensureEl("newGoodDistribution") as HTMLTextAreaElement;
  const distributionPreview = ensureEl("newGoodDistributionPreview");

  const syncTypeFields = () => {
    const isRaw = typeSelect.value === "raw";
    rawFields.style.display = isRaw ? "block" : "none";
    manufacturedFields.style.display = isRaw ? "none" : "block";
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
    title: "Add new good",
    buttons: {
      Cancel: function () {
        $(this).dialog("close");
      },
      Add: function () {
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
        const recipeInput = ensureEl<HTMLInputElement>("newGoodRecipe").value.trim();

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

        if (type === "raw") {
          if (distribution) {
            try {
              const allMethods = `{${Object.keys(Goods.methods).join(", ")}}`;
              new Function(allMethods, `return ${distribution}`)({...Goods.methods});
            } catch (err) {
              error.textContent = `Distribution error: ${(err as Error).message || err}`;
              return;
            }
          }

          pack.goods.push({
            i: getNextId(),
            name,
            tags,
            icon,
            color,
            value,
            chance,
            distribution: distribution || undefined,
            unit,
            bonus: bonusObj,
            culture: {},
            cells: 0
          });
        } else {
          if (!recipeInput) {
            error.textContent = "Recipe is required for manufactured goods";
            return;
          }

          const recipe: Record<number, number> = {};
          const chunks = recipeInput
            .split(",")
            .map(chunk => chunk.trim())
            .filter(Boolean);

          for (const chunk of chunks) {
            const [idRaw, amountRaw] = chunk.split(":").map(part => part.trim());
            const id = Number(idRaw);
            const amount = Number(amountRaw);

            if (!Number.isInteger(id) || !Number.isFinite(amount) || amount <= 0) {
              error.textContent = `Invalid recipe entry: ${chunk}. Use goodId:amount`;
              return;
            }
            if (!Goods.get(id)) {
              error.textContent = `Recipe references unknown good id: ${id}`;
              return;
            }
            recipe[id] = amount;
          }

          if (!Object.keys(recipe).length) {
            error.textContent = "Recipe must contain at least one ingredient";
            return;
          }

          pack.goods.push({
            i: getNextId(),
            name,
            tags,
            icon,
            color,
            value,
            chance,
            recipe,
            unit,
            bonus: bonusObj,
            culture: {},
            cells: 0
          });
        }

        tip("Good is added", false, "success", 5000);
        goodsEditorAddLines();
        $(this).dialog("close");
      }
    }
  });
}

function downloadGoodsData() {
  const body = ensureEl("goodsBody");
  let data = "Id,Good,Color,Type,Tags,Value,Bonus,Chance,Model,Cells\n";

  body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
    data += `${el.dataset.id},`;
    data += `${el.dataset.name},`;
    data += `${el.dataset.color},`;
    data += `"${el.dataset.type}",`;
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
