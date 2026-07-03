import { drag, easeSinIn, pointer, select, sum, transition } from "d3";
import { destroyDialogIfExists, ensureEl, getPackPolygon, getRandomColor, isLand, rn, si } from "../utils";

function open(): void {
  if (customization) return;
  closeDialogs("#biomesEditor, .stable");
  if (!layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleStates")) toggleStates();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleReligions")) toggleReligions();
  if (layerIsOn("toggleProvinces")) toggleProvinces();

  renderDialog();
  refreshBiomesEditor();

  $("#biomesEditor").dialog({
    title: "Biomes Editor",
    resizable: false,
    close: closeBiomesEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("biomesEditor");
  const html = /* html */ `<div id="biomesEditor" class="dialog stable">
      <div id="biomesHeader" class="header" style="grid-template-columns: 12em 10em 5em 6em 7em">
        <div data-tip="Click to sort by biome name" class="sortable alphabetically" data-sortby="name">
          Biome&nbsp;
        </div>
        <div data-tip="Click to sort by biome habitability" class="sortable hide" data-sortby="habitability">
          Habitability&nbsp;
        </div>
        <div
          data-tip="Click to sort by biome cells number"
          class="sortable hide icon-sort-number-down"
          data-sortby="cells"
        >
          Cells&nbsp;
        </div>
        <div data-tip="Click to sort by biome area" class="sortable hide" data-sortby="area">Area&nbsp;</div>
        <div data-tip="Click to sort by biome population" class="sortable hide" data-sortby="population">
          Population&nbsp;
        </div>
      </div>
      <div id="biomesBody" class="table" data-type="absolute"></div>
      <div id="biomesFooter" class="totalLine">
        <div data-tip="Number of land biomes" style="margin-left: 12px">
          Biomes:&nbsp;<span id="biomesFooterBiomes">0</span>
        </div>
        <div data-tip="Total land cells number" style="margin-left: 12px">
          Cells:&nbsp;<span id="biomesFooterCells">0</span>
        </div>
        <div data-tip="Total land area" style="margin-left: 12px">
          Land Area:&nbsp;<span id="biomesFooterArea">0</span>
        </div>
        <div data-tip="Total population" style="margin-left: 12px">
          Population:&nbsp;<span id="biomesFooterPopulation">0</span>
        </div>
      </div>
      <div id="biomesBottom">
        <button id="biomesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button id="biomesEditStyle" data-tip="Edit biomes style in Style Editor" class="icon-adjust"></button>
        <button id="biomesLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
        <button
          id="biomesPercentage"
          data-tip="Toggle percentage / absolute values views"
          class="icon-percent"
        ></button>
        <button
          id="biomesManually"
          data-tip="Manually re-assign biomes to not follow the default moisture/temperature pattern"
          class="icon-brush"
        ></button>
        <div id="biomesManuallyButtons" style="display: none">
          <div data-tip="Change brush size. Shortcut: + to increase; – to decrease" style="margin-block: 0.3em">
            Brush size:
            <slider-input id="biomesBrush" min="1" max="100" value="15"></slider-input>
          </div>
          <button id="biomesManuallyApply" data-tip="Apply current assignment" class="icon-check"></button>
          <button id="biomesManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
        </div>
        <button id="biomesAdd" data-tip="Add a custom biome" class="icon-plus"></button>
        <button
          id="biomesRestore"
          data-tip="Restore the defaults and re-define biomes based on current moisture and temperature"
          class="icon-history"
        ></button>
        <button
          id="biomesExport"
          data-tip="Save biomes-related data as a text file (.csv)"
          class="icon-download"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("biomesEditorRefresh").on("click", refreshBiomesEditor);
  ensureEl("biomesEditStyle").on("click", () => editStyle("biomes"));
  ensureEl("biomesLegend").on("click", toggleLegend);
  ensureEl("biomesPercentage").on("click", togglePercentageMode);
  ensureEl("biomesManually").on("click", enterBiomesCustomizationMode);
  ensureEl("biomesManuallyApply").on("click", applyBiomesChange);
  ensureEl("biomesManuallyCancel").on("click", () => exitBiomesCustomizationMode());
  ensureEl("biomesRestore").on("click", restoreInitialBiomes);
  ensureEl("biomesAdd").on("click", addCustomBiome);
  ensureEl("biomesExport").on("click", downloadBiomesData);

  applySortingByHeader("biomesHeader");

  ensureEl("biomesBody").addEventListener("click", ev => {
    const el = ev.target as HTMLElement;
    const cl = el.classList;
    if (el.tagName === "FILL-BOX") biomeChangeColor(el);
    else if (cl.contains("icon-info-circled")) openWiki(el);
    else if (cl.contains("icon-trash-empty")) removeCustomBiome(el);
    if (customization === 6) selectBiomeOnLineClick(el);
  });

  ensureEl("biomesBody").addEventListener("change", ev => {
    const el = ev.target as HTMLInputElement;
    const cl = el.classList;
    if (cl.contains("biomeName")) biomeChangeName(el);
    else if (cl.contains("biomeHabitability")) biomeChangeHabitability(el);
  });
}

function refreshBiomesEditor(): void {
  biomesCollectStatistics();
  biomesEditorAddLines();
}

function biomesCollectStatistics(): void {
  const cells = pack.cells;
  const array = new Uint8Array(biomesData.i.length);
  biomesData.cells = Array.from(array);
  biomesData.area = Array.from(array);
  biomesData.rural = Array.from(array);
  biomesData.urban = Array.from(array);

  for (const i of cells.i) {
    if (cells.h[i] < 20) continue;
    const b = cells.biome[i];
    biomesData.cells[b] += 1;
    biomesData.area[b] += cells.area[i];
    biomesData.rural[b] += cells.pop[i];
    const burg = cells.burg[i] ? pack.burgs[cells.burg[i]] : null;
    if (burg) biomesData.urban[b] += burg.population ?? 0;
  }
}

function biomesEditorAddLines(): void {
  const unit = ` ${getAreaUnit()}`;
  const b = biomesData;
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;

  for (const i of b.i) {
    if (!i || b.name[i] === "removed") continue; // ignore water and removed biomes
    const area = getArea(b.area![i]);
    const rural = b.rural![i] * populationRate;
    const urban = b.urban![i] * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}`;
    totalArea += area;
    totalPopulation += population;

    lines += /* html */ `
      <div
        class="states biomes"
        data-id="${i}"
        data-name="${b.name[i]}"
        data-habitability="${b.habitability[i]}"
        data-cells=${b.cells![i]}
        data-area=${area}
        data-population=${population}
        data-color=${b.color[i]}
      >
        <fill-box fill="${b.color[i]}"></fill-box>
        <input data-tip="Biome name. Click and type to change" class="biomeName" value="${b.name[i]}" autocorrect="off" spellcheck="false" />
        <span data-tip="Biome habitability percent" class="hide">%</span>
        <input data-tip="Biome habitability percent. Click and set new value to change" type="number" min="0" max="9999" class="biomeHabitability hide" value=${b.habitability[i]} />
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="biomeCells hide">${b.cells![i]}</div>
        <span data-tip="Biome area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Biome area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="biomePopulation hide">${si(population)}</div>
        <span data-tip="Open Wikipedia article about the biome" class="icon-info-circled pointer hide"></span>
        ${i > 12 && !b.cells![i] ? '<span data-tip="Remove the custom biome" class="icon-trash-empty hide"></span>' : ""}
      </div>
    `;
  }
  const body = ensureEl("biomesBody");
  body.innerHTML = lines;

  // update footer
  const totalMapArea = getArea(sum(pack.cells.area));
  ensureEl("biomesFooterBiomes").innerHTML = String(body.querySelectorAll(":scope > div").length);
  ensureEl("biomesFooterCells").innerHTML = String(pack.cells.h.filter(h => h >= 20).length);
  const footerArea = ensureEl("biomesFooterArea");
  footerArea.innerHTML = si(totalArea) + unit;
  ensureEl("biomesFooterPopulation").innerHTML = si(totalPopulation);
  footerArea.dataset.area = String(totalArea);
  footerArea.dataset.mapArea = String(totalMapArea);
  ensureEl("biomesFooterPopulation").dataset.population = String(totalPopulation);

  // add listeners
  body.querySelectorAll("div.biomes").forEach(el => {
    el.addEventListener("mouseenter", biomeHighlightOn);
  });
  body.querySelectorAll("div.biomes").forEach(el => {
    el.addEventListener("mouseleave", biomeHighlightOff);
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(ensureEl("biomesHeader"));
  $("#biomesEditor").dialog({ width: fitContent() });
}

function biomeHighlightOn(event: Event): void {
  if (customization === 6) return;
  const biome = +(event.target as HTMLElement).dataset.id!;
  const animate = transition().duration(2000).ease(easeSinIn);
  select(`#biomes > #biome${biome}`).raise().transition(animate).attr("stroke-width", 2).attr("stroke", "#cd4c11");
}

function biomeHighlightOff(event: Event): void {
  if (customization === 6) return;
  const biome = +(event.target as HTMLElement).dataset.id!;
  const color = biomesData.color[biome];
  select(`#biomes > #biome${biome}`).transition().attr("stroke-width", 0.7).attr("stroke", color);
}

function biomeChangeColor(el: HTMLElement): void {
  const currentFill = el.getAttribute("fill")!;
  const biome = +(el.parentNode as HTMLElement).dataset.id!;

  const callback = (newFill: string): void => {
    el.setAttribute("fill", newFill);
    biomesData.color[biome] = newFill;
    select(`#biomes > #biome${biome}`).attr("fill", newFill).attr("stroke", newFill);
  };

  openPicker(currentFill, callback);
}

function biomeChangeName(el: HTMLInputElement): void {
  const biome = +(el.parentNode as HTMLElement).dataset.id!;
  (el.parentNode as HTMLElement).dataset.name = el.value;
  biomesData.name[biome] = el.value;
}

function biomeChangeHabitability(el: HTMLInputElement): void {
  const biome = +(el.parentNode as HTMLElement).dataset.id!;
  const failed = Number.isNaN(+el.value) || +el.value < 0 || +el.value > 9999;
  if (failed) {
    el.value = String(biomesData.habitability[biome]);
    tip("Please provide a valid number in range 0-9999", false, "error");
    return;
  }
  biomesData.habitability[biome] = +el.value;
  (el.parentNode as HTMLElement).dataset.habitability = el.value;
  recalculatePopulation();
  refreshBiomesEditor();
}

function openWiki(el: HTMLElement): void {
  const biomeName = (el.parentNode as HTMLElement).dataset.name;
  if (biomeName === "Custom" || !biomeName) {
    tip("Please fill in the biome name", false, "error");
    return;
  }

  const wikiBase = "https://en.wikipedia.org/wiki/";
  const pages: Record<string, string> = {
    "Hot desert": "Desert_climate#Hot_desert_climates",
    "Cold desert": "Desert_climate#Cold_desert_climates",
    Savanna: "Tropical_and_subtropical_grasslands,_savannas,_and_shrublands",
    Grassland: "Temperate_grasslands,_savannas,_and_shrublands",
    "Tropical seasonal forest": "Seasonal_tropical_forest",
    "Temperate deciduous forest": "Temperate_deciduous_forest",
    "Tropical rainforest": "Tropical_rainforest",
    "Temperate rainforest": "Temperate_rainforest",
    Taiga: "Taiga",
    Tundra: "Tundra",
    Glacier: "Glacier",
    Wetland: "Wetland"
  };
  const customBiomeLink = `https://en.wikipedia.org/w/index.php?search=${biomeName}`;
  const link = pages[biomeName] ? wikiBase + pages[biomeName] : customBiomeLink;
  openURL(link);
}

function toggleLegend(): void {
  if (legend.selectAll("*").size()) {
    clearLegend();
    return;
  } // hide legend
  const d = biomesData;
  const data = Array.from(d.i)
    .filter(i => d.cells![i])
    .sort((a, b) => d.area![b] - d.area![a])
    .map(i => [i, d.color[i], d.name[i]]);
  drawLegend("Biomes", data);
}

function togglePercentageMode(): void {
  const body = ensureEl("biomesBody");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const totalCells = +ensureEl("biomesFooterCells").innerHTML;
    const footerArea = ensureEl("biomesFooterArea");
    const totalArea = +footerArea.dataset.area!;
    const totalMapArea = +footerArea.dataset.mapArea!;
    const totalPopulation = +ensureEl("biomesFooterPopulation").dataset.population!;

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      el.querySelector(".biomeCells")!.innerHTML = `${rn((+el.dataset.cells! / totalCells) * 100)}%`;
      el.querySelector(".biomeArea")!.innerHTML = `${rn((+el.dataset.area! / totalArea) * 100)}%`;
      el.querySelector(".biomePopulation")!.innerHTML = `${rn((+el.dataset.population! / totalPopulation) * 100)}%`;
    });

    // update footer to show land percentage of total map
    footerArea.innerHTML = `${rn((totalArea / totalMapArea) * 100)}%`;
  } else {
    body.dataset.type = "absolute";
    biomesEditorAddLines();
  }
}

function addCustomBiome(): void {
  const b = biomesData;
  const i = biomesData.i.length;
  if (i > 254) {
    tip("Maximum number of biomes reached (255), data cleansing is required", false, "error");
    return;
  }

  b.i.push(i);
  b.color.push(getRandomColor());
  b.habitability.push(50);
  b.name.push("Custom");
  b.iconsDensity.push(0);
  b.icons.push([]);
  b.cost.push(50);

  b.rural!.push(0);
  b.urban!.push(0);
  b.cells!.push(0);
  b.area!.push(0);

  const unit = getAreaUnit();
  const line = /* html */ `<div class="states biomes" data-id="${i}" data-name="${b.name[i]}" data-habitability=${b.habitability[i]} data-cells=0 data-area=0 data-population=0 data-color=${b.color[i]}>
    <fill-box fill="${b.color[i]}"></fill-box>
    <input data-tip="Biome name. Click and type to change" class="biomeName" value="${b.name[i]}" autocorrect="off" spellcheck="false">
    <span data-tip="Biome habitability percent" class="hide">%</span>
    <input data-tip="Biome habitability percent. Click and set new value to change" type="number" min=0 max=9999 step=1 class="biomeHabitability hide" value=${b.habitability[i]}>
    <span data-tip="Cells count" class="icon-check-empty hide"></span>
    <div data-tip="Cells count" class="biomeCells hide">${b.cells![i]}</div>
    <span data-tip="Biome area" style="padding-right: 4px" class="icon-map-o hide"></span>
    <div data-tip="Biome area" class="biomeArea hide">0 ${unit}</div>
    <span data-tip="Total population: 0" class="icon-male hide"></span>
    <div data-tip="Total population: 0" class="biomePopulation hide">0</div>
    <span data-tip="Remove the custom biome" class="icon-trash-empty hide"></span>
  </div>`;

  const body = ensureEl("biomesBody");
  body.insertAdjacentHTML("beforeend", line);
  ensureEl("biomesFooterBiomes").innerHTML = String(body.querySelectorAll(":scope > div").length);
  $("#biomesEditor").dialog({ width: fitContent() });
}

function removeCustomBiome(el: HTMLElement): void {
  const biome = +(el.parentNode as HTMLElement).dataset.id!;
  (el.parentNode as HTMLElement).remove();
  biomesData.name[biome] = "removed";
  ensureEl("biomesFooterBiomes").innerHTML = String(+ensureEl("biomesFooterBiomes").innerHTML - 1);
}

function downloadBiomesData(): void {
  const unit = areaUnit.value === "square" ? `${distanceUnitInput.value}2` : areaUnit.value;
  let data = `Id,Biome,Color,Habitability,Cells,Area ${unit},Population\n`; // headers

  ensureEl("biomesBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      data += `${el.dataset.id},`;
      data += `${el.dataset.name},`;
      data += `${el.dataset.color},`;
      data += `${el.dataset.habitability}%,`;
      data += `${el.dataset.cells},`;
      data += `${el.dataset.area},`;
      data += `${el.dataset.population}\n`;
    });

  const name = `${getFileName("Biomes")}.csv`;
  downloadFile(data, name);
}

function enterBiomesCustomizationMode(): void {
  if (!layerIsOn("toggleBiomes")) toggleBiomes();
  customization = 6;
  biomes.append("g").attr("id", "temp");

  document.querySelectorAll<HTMLElement>("#biomesBottom > button").forEach(el => {
    el.style.display = "none";
  });
  document.querySelectorAll<HTMLElement>("#biomesBottom > div").forEach(el => {
    el.style.display = "block";
  });
  ensureEl("biomesBody").querySelector("div.biomes")!.classList.add("selected");

  ensureEl("biomesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("biomesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "none";
    });
  ensureEl("biomesFooter").style.display = "none";
  $("#biomesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg" } });

  tip("Click on biome to select, drag the circle to change biome", true);
  select(viewbox.node()!)
    .style("cursor", "crosshair")
    .on("click", selectBiomeOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", dragBiomeBrush))
    .on("touchmove mousemove", moveBiomeBrush);
}

function selectBiomeOnLineClick(line: HTMLElement): void {
  const selected = ensureEl("biomesBody").querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
  line.classList.add("selected");
}

function selectBiomeOnMapClick(this: SVGElement, event: any): void {
  const point = pointer(event, this);
  const i = findCell(point[0], point[1])!;
  if (pack.cells.h[i] < 20) {
    tip("You cannot reassign water via biomes. Please edit the Heightmap to change water", false, "error");
    return;
  }

  const assigned = select("#biomes").select("#temp").select(`polygon[data-cell='${i}']`);
  const biome = assigned.size() ? +assigned.attr("data-biome") : pack.cells.biome[i];

  ensureEl("biomesBody").querySelector("div.selected")?.classList.remove("selected");
  ensureEl("biomesBody").querySelector(`div[data-id='${biome}']`)!.classList.add("selected");
}

function dragBiomeBrush(this: SVGElement, event: any): void {
  const r = +ensureEl<HTMLInputElement>("biomesBrush").value;

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const p = pointer(dragEvent, this);
    moveCircle(p[0], p[1], r);

    const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1])!];
    const selection = found.filter(i => isLand(i, pack));
    if (selection) changeBiomeForSelection(selection);
  });
}

// change region within selection
function changeBiomeForSelection(selection: number[]): void {
  const temp = select("#biomes").select("#temp");
  const selected = ensureEl("biomesBody").querySelector<HTMLElement>("div.selected")!;

  const biomeNew = selected.dataset.id!;
  const color = biomesData.color[+biomeNew];

  selection.forEach(i => {
    const exists = temp.select(`polygon[data-cell='${i}']`);
    const biomeOld = exists.size() ? exists.attr("data-biome") : String(pack.cells.biome[i]);
    if (biomeNew === biomeOld) return;

    // change or append new element
    if (exists.size()) exists.attr("data-biome", biomeNew).attr("fill", color).attr("stroke", color);
    else
      temp
        .append("polygon")
        .attr("data-cell", i)
        .attr("data-biome", biomeNew)
        .attr("points", getPackPolygon(i, pack))
        .attr("fill", color)
        .attr("stroke", color);
  });
}

function moveBiomeBrush(this: SVGElement, event: any): void {
  showMainTip();
  const point = pointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("biomesBrush").value;
  moveCircle(point[0], point[1], radius);
}

function applyBiomesChange(): void {
  const changed = select("#biomes").select("#temp").selectAll<SVGPolygonElement, unknown>("polygon");
  changed.each(function () {
    const i = +this.dataset.cell!;
    const b = +this.dataset.biome!;
    pack.cells.biome[i] = b;
  });

  if (changed.size()) {
    drawBiomes();
    refreshBiomesEditor();
  }
  exitBiomesCustomizationMode();
}

function exitBiomesCustomizationMode(close?: boolean): void {
  customization = 0;
  select("#biomes").select("#temp").remove();
  removeCircle();

  document.querySelectorAll<HTMLElement>("#biomesBottom > button").forEach(el => {
    el.style.display = "inline-block";
  });
  document.querySelectorAll<HTMLElement>("#biomesBottom > div").forEach(el => {
    el.style.display = "none";
  });

  ensureEl("biomesBody")
    .querySelectorAll<HTMLElement>("div > input, select, span, svg")
    .forEach(e => {
      e.style.pointerEvents = "all";
    });
  ensureEl("biomesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  ensureEl("biomesFooter").style.display = "block";
  if (!close) $("#biomesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg" } });

  restoreDefaultEvents();
  clearMainTip();
  const selected = document.querySelector("#biomesBody > div.selected");
  if (selected) selected.classList.remove("selected");
}

function restoreInitialBiomes(): void {
  biomesData = Biomes.getDefault();
  Biomes.define();
  drawBiomes();
  recalculatePopulation();
  refreshBiomesEditor();
}

function closeBiomesEditor(): void {
  exitBiomesCustomizationMode(true);
  $("#biomesEditor").dialog("destroy");
  ensureEl("biomesEditor").remove();
}

export const BiomesEditor = { open };
