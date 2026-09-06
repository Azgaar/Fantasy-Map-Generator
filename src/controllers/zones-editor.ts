import { select, sum } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import type { FillBoxElement } from "@/components/fill-box";
import { Layers } from "@/components/layers";
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import type { Zone } from "@/generators/zones-generator";
import { clearLegend, drawLegend } from "@/renderers/draw-legend";
import { zonesFilter } from "@/renderers/draw-zones";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { downloadFile, getArea, getAreaUnit, getFileName } from "@/utils";
import { ensureEl, rn, si, unique } from "../utils";

const dialogId = "zonesEditor" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };

type ZoneRow = { zone: Zone; area: number; rural: number; urban: number; population: number };
const columns: EditorColumn<ZoneRow>[] = [
  { key: "description", label: "Description", width: "13em", permanent: true },
  { key: "type", label: "Type", width: "7em" },
  { key: "cells", label: "Cells", width: "5em" },
  { key: "area", label: "Area", width: "7em" },
  { key: "population", label: "Population", width: "6em" },
  { key: "actions", width: "4.2em", permanent: true, align: "right" }
];
const zonesTable = initEditorTable<ZoneRow>({ getData: getZonesData, onUpdate: renderZonesPage });

function open(): void {
  closeDialogs("#zonesEditor, .stable");
  Layers.show("zones");

  renderDialog();
  updateFilters();
  zonesTable.reset();

  $("#zonesEditor").dialog({
    title: "Zones Editor",
    resizable: false,
    close: closeZonesEditor,
    position
  });
}

function renderDialog(): void {
  destroyDialog("zonesEditor");
  const editorHtml = /* html */ `<div id="zonesEditor" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
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
        <button id="zonesAdd" data-tip="Add new zone layer" class="icon-plus"></button>
        <button id="zonesExport" data-tip="Download zones-related data" class="icon-download"></button>
        <div id="zonesFilters" data-tip="Show only zones of selected type" style="display: inline-block">
          Type:
          <select id="zonesFilterType"></select>
        </div>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  applyLineHighlighting("zonesEditor", ({ target }) => {
    const zone = target.closest<SVGElement>("#zones [id^='zone']");
    return zone && /^zone\d+$/.test(zone.id) ? Number(zone.id.slice(4)) : undefined;
  });

  const body = ensureEl("zonesBodySection");
  ensureEl("zonesFilterType").addEventListener("click", updateFilters);
  ensureEl("zonesFilterType").addEventListener("change", filterZonesByType);
  ensureEl("zonesEditorRefresh").addEventListener("click", zonesTable.refresh);
  ensureEl("zonesEditStyle").addEventListener("click", () => editStyle("zones"));
  ensureEl("zonesLegend").addEventListener("click", toggleLegend);
  ensureEl("zonesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("zonesManually").addEventListener("click", openPaintEditor);
  ensureEl("zonesAdd").addEventListener("click", addZonesLayer);
  ensureEl("zonesExport").addEventListener("click", downloadZonesData);

  body.addEventListener("click", (ev: Event) => {
    const line = (ev.target as HTMLElement).closest<HTMLElement>("div.states");
    if (!line) return;
    const zone = pack.zones.find(z => z.i === +line.dataset.id!);
    if (!zone) return;

    const target = ev.target as HTMLElement;
    const fillBox = target.closest("fill-box");
    if (fillBox) changeFill(fillBox as FillBoxElement, zone);
    else if (target.classList.contains("zonePopulation")) changePopulation(zone);
    else if (target.classList.contains("zoneRemove")) zoneRemove(zone);
    else if (target.classList.contains("zoneHide")) toggleVisibility(zone);
    else if (target.classList.contains("zoneFog")) toggleFog(zone, target.classList);
  });

  body.addEventListener("input", (ev: Event) => {
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
  $("#zonesEditor").dialog("destroy");
  ensureEl("zonesEditor").remove();
}

// update type filter with a list of used types
function updateFilters(): void {
  const filterSelect = ensureEl<HTMLSelectElement>("zonesFilterType");
  const types = unique(pack.zones.map(zone => zone.type));
  if (!types.includes(zonesFilter.type)) {
    zonesFilter.type = "all";
    Layers.draw("zones"); // the filtered-out type is gone, the map must stop hiding zones
  }

  filterSelect.innerHTML = `<option value='all'>all</option>${types
    .map(type => `<option value="${type}">${type}</option>`)
    .join("")}`;
  filterSelect.value = zonesFilter.type;
}

// add line for each zone
function getZonesData(): ZoneRow[] {
  const filterBy = zonesFilter.type;
  const zones = filterBy === "all" ? pack.zones : pack.zones.filter(zone => zone.type === filterBy);
  return zones.map(zone => {
    const area = getArea(sum(zone.cells.map(cell => pack.cells.area[cell])));
    const rural = sum(zone.cells.map(cell => pack.cells.pop[cell])) * populationRate;
    const urban =
      sum(zone.cells.map(cell => pack.cells.burg[cell]).map(burg => pack.burgs[burg]?.population ?? 0)) *
      populationRate *
      urbanization;
    return { zone, area, rural, urban, population: rn(rural + urban) };
  });
}

function renderZonesPage(view: TableView<ZoneRow>): void {
  const body = ensureEl("zonesBodySection");
  const totalArea = getArea(graphWidth * graphHeight);
  const totalPopulation =
    (sum(pack.cells.pop) + sum(pack.burgs.filter(b => !b.removed).map(b => b.population ?? 0)) * urbanization) *
    populationRate;
  const percentage = body.dataset.type === "percentage";
  const lines = view.rows.map(({ zone: { i, name, type, cells, color, hidden }, area, rural, urban, population }) => {
    const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}. Click to change`;
    const focused = select<SVGElement, unknown>("#deftemp").select(`#fog #focusZone${i}`).size();

    return /* html */ `<div class="states" data-id="${i}" style="${hidden ? "opacity: 0.5" : ""}">
      <div data-col="description" style="display:flex; align-items:center"><fill-box fill="${color}"></fill-box><input data-tip="Zone description. Click and type to change" style="width: 11em" class="zoneName" value="${name}" autocorrect="off" spellcheck="false"></div>
      <div data-col="type"><input data-tip="Zone type. Click and type to change" class="zoneType" value="${type}"></div>
      <div data-col="cells"><span data-tip="Cells count" class="icon-check-empty"></span><span data-tip="Cells count" class="stateCells">${percentage ? `${rn((cells.length / pack.cells.i.length) * 100, 2)}%` : cells.length}</span></div>
      <div data-col="area"><span data-tip="Zone area" class="icon-map-o" style="padding-right: 2px"></span><span data-tip="Zone area" class="biomeArea">${percentage ? `${rn((area / totalArea) * 100, 2)}%` : `${si(area)} ${getAreaUnit()}`}</span></div>
      <div data-col="population"><span data-tip="${populationTip}" class="icon-male"></span><span data-tip="${populationTip}" class="zonePopulation pointer">${percentage ? `${rn((population / totalPopulation) * 100, 2)}%` : si(population)}</span></div>
      <div data-col="actions"><span data-tip="Drag to raise or lower the zone" class="icon-resize-vertical"></span><span data-tip="Toggle zone focus" class="zoneFog icon-pin ${focused ? "" : "inactive"} ${cells.length ? "" : "placeholder"}"></span><span data-tip="Toggle zone visibility" class="zoneHide icon-eye ${cells.length ? "" : " placeholder"}"></span><span data-tip="Remove zone" class="zoneRemove icon-trash-empty"></span></div>
    </div>`;
  });

  body.innerHTML = lines.join("");

  // update footer
  const footerArea = ensureEl("zonesFooterArea");
  footerArea.dataset.area = String(totalArea);
  ensureEl("zonesFooterPopulation").dataset.population = String(totalPopulation);
  ensureEl("zonesFooterNumber").innerHTML = `${view.all.length} of ${pack.zones.length}`;
  ensureEl("zonesFooterCells").innerHTML = String(pack.cells.i.length);
  footerArea.innerHTML = `${si(totalArea)} ${getAreaUnit()}`;
  ensureEl("zonesFooterPopulation").innerHTML = si(totalPopulation);
  renderEditorPagination(ensureEl("zonesFooter"), view, zonesTable.goto);

  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseenter", zoneHighlightOn);
  });
  body.querySelectorAll("div.states").forEach(el => {
    el.addEventListener("mouseleave", zoneHighlightOff);
  });

  updateDialog(dialogId, { width: "fit-content", position });
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
  zonesFilter.type = ensureEl<HTMLSelectElement>("zonesFilterType").value;
  Layers.draw("zones");
  zonesTable.reset();
}

function movezone(_ev: unknown, ui: { item: ArrayLike<HTMLElement> & { index(): number } }): void {
  const zone = pack.zones.find(z => z.i === +ui.item[0].dataset.id!);
  if (!zone) return;
  const nextId =
    ui.item[0].nextElementSibling instanceof HTMLElement ? +ui.item[0].nextElementSibling.dataset.id! : null;
  const previousId =
    ui.item[0].previousElementSibling instanceof HTMLElement ? +ui.item[0].previousElementSibling.dataset.id! : null;
  pack.zones.splice(pack.zones.indexOf(zone), 1);
  const nextIndex = nextId === null ? -1 : pack.zones.findIndex(item => item.i === nextId);
  const previousIndex = previousId === null ? -1 : pack.zones.findIndex(item => item.i === previousId);
  const newIndex = nextIndex >= 0 ? nextIndex : previousIndex >= 0 ? previousIndex + 1 : pack.zones.length;
  pack.zones.splice(newIndex, 0, zone);
  Layers.draw("zones");
}

function openPaintEditor(): void {
  Layers.show("zones");

  const visibleZones = getZonesData()
    .map(row => row.zone)
    .filter(zone => !zone.hidden);

  const zonesByCell = new Map<number, number[]>();
  for (const zone of visibleZones) {
    for (const cell of zone.cells) {
      const zoneIds = zonesByCell.get(cell);
      if (zoneIds) zoneIds.push(zone.i);
      else zonesByCell.set(cell, [zone.i]);
    }
  }

  void Controllers.PaintEditor.open({
    title: "Paint Zones",
    parentDialogId: dialogId,
    onClose: open,
    mode: "multiple",
    items: [
      { id: -1, name: "No zone", color: "#ffffff" },
      ...visibleZones.map(zone => ({ id: zone.i, name: zone.name, color: zone.color }))
    ],
    landOnlyControl: true,
    getValue: cell => zonesByCell.get(cell) ?? [],
    onApply: changes => applyZonePaint(visibleZones, changes)
  });
}

function applyZonePaint(zones: readonly Zone[], changes: ReadonlyMap<number, readonly number[]>): void {
  const cellsByZone = new Map(zones.map(zone => [zone.i, new Set(zone.cells)]));
  for (const [cell, zoneIds] of changes) {
    for (const cells of cellsByZone.values()) cells.delete(cell);
    for (const zoneId of zoneIds) cellsByZone.get(zoneId)?.add(cell);
  }
  for (const zone of zones) zone.cells = [...cellsByZone.get(zone.i)!];

  Layers.draw("zones");
  if (document.getElementById(dialogId)) zonesTable.refresh();
}

function changeFill(fillBox: FillBoxElement, zone: Zone): void {
  const currentFill = fillBox.getAttribute("fill")!;

  const callback = (newFill: string): void => {
    fillBox.fill = newFill;
    zone.color = newFill;
    Layers.draw("zones");
  };

  void Controllers.ColorPicker.open(currentFill, callback);
}

function toggleVisibility(zone: Zone): void {
  if (zone.hidden) delete zone.hidden;
  else zone.hidden = true;

  Layers.draw("zones");
  zonesTable.refresh();
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
  if (select("#legend").selectAll("*").size()) {
    clearLegend();
    return;
  } // hide legend

  const filterBy = zonesFilter.type;
  const isFiltered = filterBy !== "all";
  const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
  const data = visibleZones.map(({ i, name, color }) => [`zone${i}`, color, name]);
  drawLegend("Zones", data);
}

function togglePercentageMode(): void {
  const body = ensureEl("zonesBodySection");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  zonesTable.refresh();
}

function addZonesLayer(): void {
  const zoneId = pack.zones.length ? Math.max(...pack.zones.map(z => z.i)) + 1 : 0;
  const name = "Unknown zone";
  const type = "Unknown";
  const color = `url(#hatch${zoneId % 42})`;
  pack.zones.push({ i: zoneId, name, type, color, cells: [] });

  zonesTable.refresh();
  Layers.draw("zones");
}

function downloadZonesData(): void {
  const unit = areaUnit.value === "square" ? `${distanceUnitInput.value}2` : areaUnit.value;
  let data = `Id,Color,Description,Type,Cells,Area ${unit},Population\n`; // headers

  for (const { zone, area, population } of getZonesData()) {
    data += `${zone.i},${zone.color},${zone.name},${zone.type},${zone.cells.length},${area},${population}\n`;
  }

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

    Layers.draw("population");
    zonesTable.refresh();
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
      zonesTable.refresh();
    }
  });
}

export const ZonesEditor = { open };
