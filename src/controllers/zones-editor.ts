import { drag, pointer, select, sum } from "d3";
import type { Zone } from "@/generators/zones-generator";
import { destroyDialogIfExists, ensureEl, getPackPolygon, rn, si, unique } from "../utils";

interface ZoneCellDatum {
  cell: number;
  zoneId: number;
  fill: string;
}

function open(): void {
  closeDialogs("#zonesEditor, .stable");
  if (!layerIsOn("toggleZones")) toggleZones();

  renderDialog();
  updateFilters();
  zonesEditorAddLines();

  $("#zonesEditor").dialog({
    title: "Zones Editor",
    resizable: false,
    close: closeZonesEditor,
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });
}

function renderDialog(): void {
  destroyDialogIfExists("zonesEditor");
  const editorHtml = /* html */ `<div id="zonesEditor" class="dialog stable">
      <div id="customHeader" class="header" style="grid-template-columns: 13em 7em 6em 5em 9em">
        <div data-tip="Zone description">Description&nbsp;</div>
        <div data-tip="Zone type">Type&nbsp;</div>
        <div data-tip="Zone cells count" class="hide">Cells&nbsp;</div>
        <div data-tip="Zone area" class="hide">Area&nbsp;</div>
        <div data-tip="Zone population" class="hide">Population&nbsp;</div>
      </div>
      <div id="zonesBodySection" class="table" data-type="absolute"></div>
      <div id="zonesFooter" class="totalLine">
        <div data-tip="Number of zones" style="margin-left: 5px">
          Zones:&nbsp;<span id="zonesFooterNumber">0</span>
        </div>
        <div data-tip="Total cells number" style="margin-left: 12px">
          Cells:&nbsp;<span id="zonesFooterCells">0</span>
        </div>
        <div data-tip="Total map area" style="margin-left: 12px">Area:&nbsp;<span id="zonesFooterArea">0</span></div>
        <div data-tip="Total map population" style="margin-left: 12px">
          Population:&nbsp;<span id="zonesFooterPopulation">0</span>
        </div>
      </div>
      <div id="zonesBottom">
        <button id="zonesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
        <button id="zonesEditStyle" data-tip="Edit zones style in Style Editor" class="icon-adjust"></button>
        <button
          id="zonesLegend"
          data-tip="Toggle Legend box (shows all non-hidden zones)"
          class="icon-list-bullet"
        ></button>
        <button
          id="zonesPercentage"
          data-tip="Toggle percentage / absolute values views"
          class="icon-percent"
        ></button>
        <button id="zonesManually" data-tip="Re-assign zones" class="icon-brush"></button>
        <div id="zonesManuallyButtons" style="display: none">
          <div data-tip="Change brush size. Shortcut: + to increase; – to decrease" style="margin-block: 0.3em">
            Brush size:
            <slider-input id="zonesBrush" min="1" max="100" value="8"></slider-input>
          </div>
          <div>
            <input id="zonesBrushLandOnly" class="checkbox" type="checkbox" checked />
            <label for="zonesBrushLandOnly" class="checkbox-label"><i>Change land only</i></label>
          </div>
          <div style="margin-top: 0.3em">
            <button id="zonesManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
            <button id="zonesManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
            <button
              id="zonesRemove"
              data-tip="Click to toggle the removal mode on brush dragging"
              data-shortcut="Ctrl"
              class="icon-eraser"
            ></button>
          </div>
        </div>
        <button id="zonesAdd" data-tip="Add new zone layer" class="icon-plus"></button>
        <button id="zonesExport" data-tip="Download zones-related data" class="icon-download"></button>
        <div id="zonesFilters" data-tip="Show only zones of selected type" style="display: inline-block">
          Type:
          <select id="zonesFilterType"></select>
        </div>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);

  const body = ensureEl("zonesBodySection");

  ensureEl("zonesFilterType").on("click", updateFilters);
  ensureEl("zonesFilterType").on("change", filterZonesByType);
  ensureEl("zonesEditorRefresh").on("click", zonesEditorAddLines);
  ensureEl("zonesEditStyle").on("click", () => editStyle("zones"));
  ensureEl("zonesLegend").on("click", toggleLegend);
  ensureEl("zonesPercentage").on("click", togglePercentageMode);
  ensureEl("zonesManually").on("click", enterZonesManualAssignent);
  ensureEl("zonesManuallyApply").on("click", applyZonesManualAssignent);
  ensureEl("zonesManuallyCancel").on("click", cancelZonesManualAssignent);
  ensureEl("zonesAdd").on("click", addZonesLayer);
  ensureEl("zonesExport").on("click", downloadZonesData);
  ensureEl("zonesRemove").on("click", (e: Event) => (e.target as HTMLElement).classList.toggle("pressed"));

  body.on("click", (ev: Event) => {
    const line = (ev.target as HTMLElement).closest<HTMLElement>("div.states");
    if (!line) return;
    const zone = pack.zones.find(z => z.i === +line.dataset.id!);
    if (!zone) return;

    if (customization) {
      if (zone.hidden) return;
      body.querySelector("div.selected")?.classList.remove("selected");
      line.classList.add("selected");
      return;
    }

    const target = ev.target as HTMLElement;
    const fillBox = target.closest("fill-box");
    if (fillBox) changeFill(fillBox.getAttribute("fill")!, zone);
    else if (target.classList.contains("zonePopulation")) changePopulation(zone);
    else if (target.classList.contains("zoneRemove")) zoneRemove(zone);
    else if (target.classList.contains("zoneHide")) toggleVisibility(zone);
    else if (target.classList.contains("zoneFog")) toggleFog(zone, target.classList);
  });

  body.on("input", (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    const line = target.closest<HTMLElement>("div.states");
    if (!line) return;
    const zone = pack.zones.find(z => z.i === +line.dataset.id!);
    if (!zone) return;

    if (target.classList.contains("zoneName")) changeDescription(zone, target.value);
    else if (target.classList.contains("zoneType")) changeType(zone, target.value);
  });

  $(body).sortable({
    items: "div.states",
    handle: ".icon-resize-vertical",
    containment: "parent",
    axis: "y",
    update: movezone
  });
}

function closeZonesEditor(): void {
  exitZonesManualAssignment("close");
  $("#zonesEditor").dialog("destroy");
  ensureEl("zonesEditor").remove();
}

// update type filter with a list of used types
function updateFilters(): void {
  const filterSelect = ensureEl<HTMLSelectElement>("zonesFilterType");
  const types = unique(pack.zones.map(zone => zone.type));
  const typeToFilterBy = types.includes(filterSelect.value) ? filterSelect.value : "all";

  filterSelect.innerHTML = `<option value='all'>all</option>${types
    .map(type => `<option value="${type}">${type}</option>`)
    .join("")}`;
  filterSelect.value = typeToFilterBy;
}

// add line for each zone
function zonesEditorAddLines(): void {
  const body = ensureEl("zonesBodySection");
  const typeToFilterBy = ensureEl<HTMLSelectElement>("zonesFilterType").value;
  const filteredZones = typeToFilterBy === "all" ? pack.zones : pack.zones.filter(zone => zone.type === typeToFilterBy);

  const lines = filteredZones.map(({ i, name, type, cells, color, hidden }) => {
    const area = getArea(sum(cells.map(c => pack.cells.area[c])));
    const rural = sum(cells.map(c => pack.cells.pop[c])) * populationRate;
    const urban =
      sum(cells.map(c => pack.cells.burg[c]).map(b => pack.burgs[b]?.population ?? 0)) * populationRate * urbanization;
    const population = rn(rural + urban);
    const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}. Click to change`;
    const focused = select<SVGElement, unknown>("#deftemp").select(`#fog #focusZone${i}`).size();

    return /* html */ `<div class="states" data-id="${i}" data-color="${color}" data-description="${name}"
      data-type="${type}" data-cells=${cells.length} data-area=${area} data-population=${population} style="${hidden ? "opacity: 0.5" : ""}">
      <fill-box fill="${color}"></fill-box>
      <input data-tip="Zone description. Click and type to change" style="width: 11em" class="zoneName" value="${name}" autocorrect="off" spellcheck="false">
      <input data-tip="Zone type. Click and type to change" class="zoneType" value="${type}">
      <span data-tip="Cells count" class="icon-check-empty hide"></span>
      <div data-tip="Cells count" class="stateCells hide">${cells.length}</div>
      <span data-tip="Zone area" style="padding-right:4px" class="icon-map-o hide"></span>
      <div data-tip="Zone area" class="biomeArea hide">${`${si(area)} ${getAreaUnit()}`}</div>
      <span data-tip="${populationTip}" class="icon-male hide"></span>
      <div data-tip="${populationTip}" class="zonePopulation hide pointer">${si(population)}</div>
      <span data-tip="Drag to raise or lower the zone" class="icon-resize-vertical hide"></span>
      <span data-tip="Toggle zone focus" class="zoneFog icon-pin ${focused ? "" : "inactive"} hide ${cells.length ? "" : "placeholder"}"></span>
      <span data-tip="Toggle zone visibility" class="zoneHide icon-eye hide ${cells.length ? "" : " placeholder"}"></span>
      <span data-tip="Remove zone" class="zoneRemove icon-trash-empty hide"></span>
    </div>`;
  });

  body.innerHTML = lines.join("");

  // update footer
  const totalArea = getArea(graphWidth * graphHeight);
  const footerArea = ensureEl("zonesFooterArea");
  footerArea.dataset.area = String(totalArea);
  const totalPop =
    (sum(pack.cells.pop) + sum(pack.burgs.filter(b => !b.removed).map(b => b.population ?? 0)) * urbanization) *
    populationRate;
  ensureEl("zonesFooterPopulation").dataset.population = String(totalPop);
  ensureEl("zonesFooterNumber").innerHTML = `${filteredZones.length} of ${pack.zones.length}`;
  ensureEl("zonesFooterCells").innerHTML = String(pack.cells.i.length);
  footerArea.innerHTML = `${si(totalArea)} ${getAreaUnit()}`;
  ensureEl("zonesFooterPopulation").innerHTML = si(totalPop);

  body.querySelectorAll("div.states").forEach(el => {
    el.on("mouseenter", zoneHighlightOn);
  });
  body.querySelectorAll("div.states").forEach(el => {
    el.on("mouseleave", zoneHighlightOff);
  });

  if (body.dataset.type === "percentage") {
    body.dataset.type = "absolute";
    togglePercentageMode();
  }
  $("#zonesEditor").dialog({ width: fitContent() });
}

function zoneHighlightOn(this: HTMLElement): void {
  const zoneId = this.dataset.id;
  select<SVGGElement, unknown>("#zones").select(`#zone${zoneId}`).style("outline", "1px solid red");
}

function zoneHighlightOff(this: HTMLElement): void {
  const zoneId = this.dataset.id;
  select<SVGGElement, unknown>("#zones").select(`#zone${zoneId}`).style("outline", null);
}

function filterZonesByType(): void {
  drawZones();
  zonesEditorAddLines();
}

function movezone(_ev: unknown, ui: { item: ArrayLike<HTMLElement> & { index(): number } }): void {
  const zone = pack.zones.find(z => z.i === +ui.item[0].dataset.id!);
  if (!zone) return;
  const oldIndex = pack.zones.indexOf(zone);
  const newIndex = ui.item.index();
  if (oldIndex === newIndex) return;

  pack.zones.splice(oldIndex, 1);
  pack.zones.splice(newIndex, 0, zone);
  drawZones();
}

function enterZonesManualAssignent(): void {
  if (!layerIsOn("toggleZones")) toggleZones();
  customization = 10;
  const body = ensureEl("zonesBodySection");

  document.querySelectorAll<HTMLElement>("#zonesBottom > *").forEach(el => {
    el.style.display = "none";
  });
  ensureEl("zonesManuallyButtons").style.display = "inline-block";
  ensureEl("zonesEditor")
    .querySelectorAll(".hide")
    .forEach(el => {
      el.classList.add("hidden");
    });
  ensureEl("zonesFooter").style.display = "none";
  body.querySelectorAll<HTMLElement>("div > input, select, svg").forEach(e => {
    e.style.pointerEvents = "none";
  });
  $("#zonesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  tip("Click to select a zone, drag to paint a zone", true);
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", selectZoneOnMapClick)
    .call(drag<SVGElement, unknown>().on("start", dragZoneBrush))
    .on("touchmove mousemove", moveZoneBrush);

  body.querySelector("div")?.classList.add("selected");

  // draw zones as individual cells
  select<SVGGElement, unknown>("#zones").selectAll("*").remove();

  const filterBy = ensureEl<HTMLSelectElement>("zonesFilterType").value;
  const isFiltered = filterBy && filterBy !== "all";
  const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
  const data = visibleZones.flatMap(({ i, cells, color }) => cells.map(cell => ({ cell, zoneId: i, fill: color })));
  select<SVGGElement, unknown>("#zones")
    .selectAll<SVGPolygonElement, ZoneCellDatum>("polygon")
    .data(data, d => `${d.zoneId}-${d.cell}`)
    .enter()
    .append("polygon")
    .attr("points", d => getPackPolygon(d.cell, pack))
    .attr("fill", d => d.fill)
    .attr("data-zone", d => d.zoneId)
    .attr("data-cell", d => d.cell);
}

function selectZoneOnMapClick(event: any): void {
  const target = event.target as HTMLElement;
  if ((target.parentElement as HTMLElement).id !== "zones") return;
  const zoneId = target.dataset.zone;
  const el = ensureEl("zonesBodySection").querySelector(`div[data-id='${zoneId}']`);

  ensureEl("zonesBodySection").querySelector("div.selected")?.classList.remove("selected");
  el?.classList.add("selected");
}

function dragZoneBrush(this: SVGElement, event: any): void {
  const radius = +ensureEl<HTMLInputElement>("zonesBrush").value;
  const eraseMode = ensureEl("zonesRemove").classList.contains("pressed");
  const landOnly = ensureEl<HTMLInputElement>("zonesBrushLandOnly").checked;

  event.on("drag", (dragEvent: any) => {
    if (!dragEvent.dx && !dragEvent.dy) return;
    const [x, y] = pointer(dragEvent, this);
    moveCircle(x, y, radius);

    let selection = radius > 5 ? findAll(x, y, radius) : [findCell(x, y)!];
    if (landOnly) selection = selection.filter(i => pack.cells.h[i] >= 20);
    if (!selection.length) return;

    const zoneId = +ensureEl("zonesBodySection").querySelector<HTMLElement>("div.selected")!.dataset.id!;
    const zone = pack.zones.find(z => z.i === zoneId);
    if (!zone) return;

    if (eraseMode) {
      const data = select<SVGGElement, unknown>("#zones")
        .selectAll<SVGPolygonElement, ZoneCellDatum>("polygon")
        .data()
        .filter(d => !(d.zoneId === zoneId && selection.includes(d.cell)));
      select<SVGGElement, unknown>("#zones")
        .selectAll<SVGPolygonElement, ZoneCellDatum>("polygon")
        .data(data, d => `${d.zoneId}-${d.cell}`)
        .exit()
        .remove();
    } else {
      const data: ZoneCellDatum[] = selection.map(cell => ({ cell, zoneId, fill: zone.color }));
      select<SVGGElement, unknown>("#zones")
        .selectAll<SVGPolygonElement, ZoneCellDatum>("polygon")
        .data(data, d => `${d.zoneId}-${d.cell}`)
        .enter()
        .append("polygon")
        .attr("points", d => getPackPolygon(d.cell, pack))
        .attr("fill", d => d.fill)
        .attr("data-zone", d => d.zoneId)
        .attr("data-cell", d => d.cell);
    }
  });
}

function moveZoneBrush(this: SVGElement, event: any): void {
  showMainTip();
  const [x, y] = pointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("zonesBrush").value;
  moveCircle(x, y, radius);
}

function applyZonesManualAssignent(): void {
  const data = select<SVGGElement, unknown>("#zones").selectAll<SVGPolygonElement, ZoneCellDatum>("polygon").data();
  const zoneCells = data.reduce<Record<number, number[]>>((acc, d) => {
    if (!acc[d.zoneId]) acc[d.zoneId] = [];
    acc[d.zoneId].push(d.cell);
    return acc;
  }, {});

  const filterBy = ensureEl<HTMLSelectElement>("zonesFilterType").value;
  const isFiltered = filterBy && filterBy !== "all";
  const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
  visibleZones.forEach(zone => {
    zone.cells = zoneCells[zone.i] || [];
  });

  drawZones();
  zonesEditorAddLines();
  exitZonesManualAssignment();
}

function cancelZonesManualAssignent(): void {
  drawZones();
  exitZonesManualAssignment();
}

function exitZonesManualAssignment(close?: string): void {
  customization = 0;
  removeCircle();
  document.querySelectorAll<HTMLElement>("#zonesBottom > *").forEach(el => {
    el.style.display = "inline-block";
  });
  ensureEl("zonesManuallyButtons").style.display = "none";

  ensureEl("zonesEditor")
    .querySelectorAll(".hide:not(.show)")
    .forEach(el => {
      el.classList.remove("hidden");
    });
  ensureEl("zonesFooter").style.display = "block";
  ensureEl("zonesBodySection")
    .querySelectorAll<HTMLElement>("div > input, select, svg")
    .forEach(e => {
      e.style.pointerEvents = "all";
    });
  if (!close)
    $("#zonesEditor").dialog({ position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" } });

  restoreDefaultEvents();
  clearMainTip();

  const selected = ensureEl("zonesBodySection").querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

function changeFill(fill: string, zone: Zone): void {
  const callback = (newFill: string): void => {
    zone.color = newFill;
    drawZones();
    zonesEditorAddLines();
  };

  openPicker(fill, callback);
}

function toggleVisibility(zone: Zone): void {
  if (zone.hidden) delete zone.hidden;
  else zone.hidden = true;

  drawZones();
  zonesEditorAddLines();
}

function toggleFog(zone: Zone, cl: DOMTokenList): void {
  const inactive = cl.contains("inactive");
  cl.toggle("inactive");

  if (inactive) {
    const path = select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).attr("d");
    fog(`focusZone${zone.i}`, path);
  } else {
    unfog(`focusZone${zone.i}`);
  }
}

function toggleLegend(): void {
  if (legend.selectAll("*").size()) {
    clearLegend();
    return;
  } // hide legend

  const filterBy = ensureEl<HTMLSelectElement>("zonesFilterType").value;
  const isFiltered = filterBy && filterBy !== "all";
  const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
  const data = visibleZones.map(({ i, name, color }) => [`zone${i}`, color, name]);
  drawLegend("Zones", data);
}

function togglePercentageMode(): void {
  const body = ensureEl("zonesBodySection");
  if (body.dataset.type === "absolute") {
    body.dataset.type = "percentage";
    const totalCells = +ensureEl("zonesFooterCells").innerHTML;
    const totalArea = +ensureEl("zonesFooterArea").dataset.area!;
    const totalPopulation = +ensureEl("zonesFooterPopulation").dataset.population!;

    body.querySelectorAll<HTMLElement>(":scope > div").forEach(el => {
      el.querySelector(".stateCells")!.innerHTML = `${rn((+el.dataset.cells! / totalCells) * 100, 2)}%`;
      el.querySelector(".biomeArea")!.innerHTML = `${rn((+el.dataset.area! / totalArea) * 100, 2)}%`;
      el.querySelector(".zonePopulation")!.innerHTML = `${rn((+el.dataset.population! / totalPopulation) * 100, 2)}%`;
    });
  } else {
    body.dataset.type = "absolute";
    zonesEditorAddLines();
  }
}

function addZonesLayer(): void {
  const zoneId = pack.zones.length ? Math.max(...pack.zones.map(z => z.i)) + 1 : 0;
  const name = "Unknown zone";
  const type = "Unknown";
  const color = `url(#hatch${zoneId % 42})`;
  pack.zones.push({ i: zoneId, name, type, color, cells: [] });

  zonesEditorAddLines();
  drawZones();
}

function downloadZonesData(): void {
  const unit = areaUnit.value === "square" ? `${distanceUnitInput.value}2` : areaUnit.value;
  let data = `Id,Color,Description,Type,Cells,Area ${unit},Population\n`; // headers

  ensureEl("zonesBodySection")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      data += `${el.dataset.id},`;
      data += `${el.dataset.color},`;
      data += `${el.dataset.description},`;
      data += `${el.dataset.type},`;
      data += `${el.dataset.cells},`;
      data += `${el.dataset.area},`;
      data += `${el.dataset.population}\n`;
    });

  const name = `${getFileName("Zones")}.csv`;
  downloadFile(data, name);
}

function changeDescription(zone: Zone, value: string): void {
  zone.name = value;
  select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).attr("data-description", value);
}

function changeType(zone: Zone, value: string): void {
  zone.type = value;
  select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).attr("data-type", value);
}

function changePopulation(zone: Zone): void {
  const landCells = zone.cells.filter(i => pack.cells.h[i] >= 20);
  if (!landCells.length) {
    tip("Zone does not have any land cells, cannot change population", false, "error");
    return;
  }

  const burgs = pack.burgs.filter(b => !b.removed && landCells.includes(b.cell));
  const rural = rn(sum(landCells.map(i => pack.cells.pop[i])) * populationRate);
  const urban = rn(
    sum(landCells.map(i => pack.cells.burg[i]).map(b => pack.burgs[b]?.population ?? 0)) * populationRate * urbanization
  );
  const total = rural + urban;
  const l = (n: number): string => Number(n).toLocaleString();

  alertMessage.innerHTML = /* html */ `Rural: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> Urban:
    <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${burgs.length ? "" : "disabled"} />
    <p>Total population: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`;

  const ruralPop = ensureEl<HTMLInputElement>("ruralPop");
  const urbanPop = ensureEl<HTMLInputElement>("urbanPop");

  const update = (): void => {
    const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
    if (Number.isNaN(totalNew)) return;
    ensureEl("totalPop").innerHTML = l(totalNew);
    ensureEl("totalPopPerc").innerHTML = String(rn((totalNew / total) * 100));
  };

  ruralPop.oninput = () => update();
  urbanPop.oninput = () => update();

  $("#alert").dialog({
    resizable: false,
    title: "Change zone population",
    width: "24em",
    buttons: {
      Apply: function (this: HTMLElement) {
        applyPopulationChange();
        $(this).dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    },
    position: { my: "center", at: "center", of: "svg" }
  });

  function applyPopulationChange(): void {
    const ruralChange = +ruralPop.value / rural;
    if (Number.isFinite(ruralChange) && ruralChange !== 1) {
      landCells.forEach(i => {
        pack.cells.pop[i] *= ruralChange;
      });
    }
    if (!Number.isFinite(ruralChange) && +ruralPop.value > 0) {
      const points = +ruralPop.value / populationRate;
      const pop = rn(points / landCells.length);
      landCells.forEach(i => {
        pack.cells.pop[i] = pop;
      });
    }

    const urbanChange = +urbanPop.value / urban;
    if (Number.isFinite(urbanChange) && urbanChange !== 1) {
      burgs.forEach(b => {
        b.population = rn((b.population ?? 0) * urbanChange, 4);
      });
    }
    if (!Number.isFinite(urbanChange) && +urbanPop.value > 0) {
      const points = +urbanPop.value / populationRate / urbanization;
      const population = rn(points / burgs.length, 4);
      burgs.forEach(b => {
        b.population = population;
      });
    }

    if (layerIsOn("togglePopulation")) drawPopulation();
    zonesEditorAddLines();
  }
}

function zoneRemove(zone: Zone): void {
  confirmationDialog({
    title: "Remove zone",
    message: "Are you sure you want to remove the zone? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      pack.zones = pack.zones.filter(z => z.i !== zone.i);
      select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).remove();
      unfog(`focusZone${zone.i}`);
      zonesEditorAddLines();
    }
  });
}

export const ZonesEditor = { open };
