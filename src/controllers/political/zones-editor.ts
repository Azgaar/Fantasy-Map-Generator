import { select, sum } from "d3";
import { Controllers } from "@/controllers";
import type { Zone } from "@/model/political/zones-generator";
import { Zones } from "@/model/political/zones-generator";
import { Tags } from "@/model/tags";
import { getArea, getAreaUnit } from "@/model/units";
import { zonesFilter } from "@/renderers/draw-zones";
import { Layers } from "@/renderers/layers";
import { LegendBoxes } from "@/renderers/legend-boxes";
import { fog, unfog } from "@/renderers/overlays/fogging";
import { Csv } from "@/services/io/csv";
import type { LegendItem } from "@/types/legend";
import { Dialog } from "@/ui/dialog/dialog";
import { noteIcon } from "@/ui/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/ui/dialog/highlighting";
import { dialogState } from "@/ui/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import type { FillBoxElement } from "@/ui/elements/fill-box";
import { sortableList } from "@/ui/sortable-list";
import { tip } from "@/ui/tooltips";
import { unique } from "@/utils/array-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl } from "@/utils/node-utils";
import { rn, si } from "@/utils/number-utils";
import { errorText } from "@/utils/string-utils";

const dialogId = "zonesEditor" as const;
const CSV_COLUMNS = ["Id", "Color", "Description", "Type", "Tags", "Cells", "Area", "Population"];
const LEGEND_NAME = "Zones"; // the legend box this editor toggles
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string };

type ZoneRow = { zone: Zone; area: number; rural: number; urban: number; population: number };
const columns: EditorColumn<ZoneRow>[] = [
  { key: "description", label: t("Description"), width: "13em", permanent: true },
  { key: "type", label: t("Type"), width: "7em" },
  { key: "cells", label: t("Cells"), width: "5em" },
  { key: "area", label: t("Area"), width: "7em" },
  { key: "population", label: t("Population"), width: "6em" },
  {
    key: "tags",
    label: t("Tags"),
    width: "10em",
    hidden: true
  },
  { key: "note", width: "1.1em" },
  { key: "reorder", width: "1.1em" },
  { key: "focus", width: "1.1em" },
  { key: "visibility", width: "1.1em" },
  { key: "remove", width: "1.4em", permanent: true }
];
const zonesTable = initEditorTable<ZoneRow>({ getData: getZonesData, onUpdate: renderZonesPage });

function open(): void {
  Dialog.closeAll("#zonesEditor, .stable");
  Layers.show("zones");

  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  filterState.search ??= "";

  renderDialog();
  updateFilters();
  zonesTable.reset();

  Dialog.open("zonesEditor", {
    title: t("Zones Editor"),
    onClose: closeZonesEditor,
    position
  });
}

function renderDialog(): void {
  Dialog.destroy("zonesEditor");
  const editorHtml = /* html */ `<div id="zonesEditor" class="dialog stable editorDialog">
      ${renderEditorHeader({ dialogId, columns })}
      <div id="zonesBodySection" class="table" data-type="absolute"></div>
      <div id="zonesFilters" class="editorFilters">
        <label for="zonesSearch" data-tip="${t("Filter by description, type, or tag")}">
          ${t("Search")}: <input id="zonesSearch" type="search" />
        </label>
        <label for="zonesFilterType" data-tip="${t("Show only zones of selected type")}">
          ${t("Type")}: <select id="zonesFilterType"></select>
        </label>
      </div>
      <div id="zonesFooter" class="totalLine">
        <div data-tip="${t("Number of zones")}" style="margin-left: 5px">
          ${t("Zones")}:&nbsp;<span id="zonesFooterNumber">0</span>
        </div>
        <div data-tip="${t("Number of cells")}" style="margin-left: 12px">
          ${t("Cells")}:&nbsp;<span id="zonesFooterCells">0</span>
        </div>
        <div data-tip="${t("Total map area")}" style="margin-left: 12px">${t("Area")}:&nbsp;<span id="zonesFooterArea">0</span></div>
        <div data-tip="${t("Total map population")}" style="margin-left: 12px">
          ${t("Population")}:&nbsp;<span id="zonesFooterPopulation">0</span>
        </div>
      </div>
      <div id="zonesBottom">
        <button id="zonesEditorRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button id="zonesEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-adjust"></button>
        <button
          id="zonesLegend"
          data-tip="${t("Toggle Legend box")}"
          class="icon-list-bullet"
        ></button>
        <button
          id="zonesPercentage"
          data-tip="${t("Toggle percentage / absolute values views")}"
          class="icon-percent"
        ></button>
        <button id="zonesManually" data-tip="${t("Re-assign zones")}" class="icon-brush"></button>
        <button id="zonesAdd" data-tip="${t("Add")}" class="icon-plus"></button>
        <button id="zonesExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
        <button id="zonesImport" data-tip="${t("Upload data from a CSV file")}" class="icon-upload"></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  ensureEl<HTMLInputElement>("zonesSearch").value = filterState.search;
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => Dialog.update(dialogId, { width: "fit-content", position })
  });
  applyLineHighlighting("zonesEditor", ({ target }) => {
    const zone = target.closest<SVGElement>("#zones [id^='zone']");
    return zone && /^zone\d+$/.test(zone.id) ? Number(zone.id.slice(4)) : undefined;
  });

  const body = ensureEl("zonesBodySection");
  ensureEl("zonesFilterType").addEventListener("click", updateFilters);
  ensureEl("zonesFilterType").addEventListener("change", filterZonesByType);
  ensureEl("zonesSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    zonesTable.reset();
  });
  ensureEl("zonesEditorRefresh").addEventListener("click", zonesTable.refresh);
  ensureEl("zonesEditStyle").addEventListener("click", () => void Controllers.StyleEditor.open("zones"));
  ensureEl("zonesLegend").addEventListener("click", toggleLegend);
  ensureEl("zonesPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("zonesManually").addEventListener("click", openPaintEditor);
  ensureEl("zonesAdd").addEventListener("click", addZonesLayer);
  ensureEl("zonesExport").addEventListener("click", downloadZonesData);
  ensureEl("zonesImport").addEventListener("click", () => Csv.pick(uploadZonesCsv));

  body.addEventListener("click", (ev: Event) => {
    const line = (ev.target as HTMLElement).closest<HTMLElement>("div.states");
    if (!line) return;
    const zone = pack.zones.find(z => z.i === +line.dataset.id!);
    if (!zone) return;

    const target = ev.target as HTMLElement;
    const fillBox = target.closest("fill-box");
    if (fillBox) changeFill(fillBox as FillBoxElement, zone);
    else if (target.classList.contains("zonePopulation")) changePopulation(zone);
    else if (target.classList.contains("icon-book")) void Controllers.NotesEditor.open({ type: "zone", id: zone.i });
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

  body.addEventListener("change", (ev: Event) => {
    const target = ev.target as HTMLInputElement;
    const line = target.closest<HTMLElement>("div.states");
    if (!line) return;
    const zone = pack.zones.find(z => z.i === +line.dataset.id!);
    if (!zone) return;

    if (target.classList.contains("zoneTags")) {
      Tags.set(zone, target.value);
      target.value = Tags.format(zone.tags);
      if (filterState.search) zonesTable.refresh();
    }
  });

  sortableList(body, { items: "div.states", handle: ".icon-resize-vertical", onReorder: movezone });
}

function closeZonesEditor(): void {
  Controllers.ColorPicker.close();
  const view = zonesTable.view();
  view.rows = [];
  view.all = [];
  Dialog.destroy("zonesEditor");
}

// update type filter with a list of used types
function updateFilters(): void {
  const filterSelect = ensureEl<HTMLSelectElement>("zonesFilterType");
  const types = unique(pack.zones.map(zone => zone.type));
  if (!types.includes(zonesFilter.type)) {
    zonesFilter.type = "all";
    Layers.draw("zones"); // the filtered-out type is gone, the map must stop hiding zones
  }

  filterSelect.innerHTML = `<option value='all'>${t("All")}</option>${types
    .map(type => `<option value="${type}">${type}</option>`)
    .join("")}`;
  filterSelect.value = zonesFilter.type;
}

// add line for each zone
function getZonesData(): ZoneRow[] {
  const filterBy = zonesFilter.type;
  const search = filterState.search.toLowerCase().trim();
  let zones = filterBy === "all" ? pack.zones : pack.zones.filter(zone => zone.type === filterBy);
  if (search) {
    zones = zones.filter(zone => Tags.matches(search, zone.name, zone.tags, [zone.type]));
  }
  return zones.map(zone => {
    const area = getArea(sum(zone.cells.map(cell => pack.cells.area[cell])));
    const [rural, urban] = getZonePopulation(zone);
    return { zone, area, rural, urban, population: rn(rural + urban) };
  });
}

/** Rural and urban people of a zone */
function getZonePopulation(zone: Zone): [number, number] {
  const { scale, urbanization } = options.map.units.population;
  const rural = sum(zone.cells.map(cell => pack.cells.pop[cell])) * scale;
  const urban =
    sum(zone.cells.map(cell => pack.burgs[pack.cells.burg[cell]]?.population ?? 0)) * scale * urbanization.rate;
  return [rural, urban];
}

function renderZonesPage(view: TableView<ZoneRow>): void {
  const body = ensureEl("zonesBodySection");
  const totalArea = getArea(options.map.graph.width * options.map.graph.height);
  const totalPopulation =
    (sum(pack.cells.pop) +
      sum(pack.burgs.filter(b => !b.removed).map(b => b.population ?? 0)) *
        options.map.units.population.urbanization.rate) *
    options.map.units.population.scale;
  const percentage = body.dataset.type === "percentage";
  const lines = view.rows.map(
    ({ zone: { i, name, type, cells, color, hidden, tags }, area, rural, urban, population }) => {
      const populationTip = sentences(
        `${t("Total population")}: ${si(population)}`,
        `${t("Rural population")}: ${si(rural)}`,
        `${t("Urban population")}: ${si(urban)}`,
        t("Click to edit")
      );
      const focused = select<SVGElement, unknown>("#deftemp").select(`#fog #focusZone${i}`).size();

      return /* html */ `<div class="states" data-id="${i}" style="${hidden ? "opacity: 0.5" : ""}">
      <div data-col="description" style="display:flex; align-items:center"><fill-box fill="${color}"></fill-box><input data-tip="${sentences(t("Zone description"), t("Click and type to change"))}" style="width: 11em" class="zoneName" value="${name}" autocorrect="off" spellcheck="false"></div>
      <div data-col="type"><input data-tip="${sentences(t("Zone type"), t("Click and type to change"))}" class="zoneType" value="${type}"></div>
      <div data-col="cells"><span data-tip="${t("Number of cells")}" class="icon-check-empty"></span><span data-tip="${t("Number of cells")}" class="stateCells">${percentage ? `${rn((cells.length / pack.cells.i.length) * 100, 2)}%` : cells.length}</span></div>
      <div data-col="area"><span data-tip="${t("Zone area")}" class="icon-map-o" style="padding-right: 2px"></span><span data-tip="${t("Zone area")}" class="biomeArea">${percentage ? `${rn((area / totalArea) * 100, 2)}%` : `${si(area)} ${getAreaUnit()}`}</span></div>
      <div data-col="population"><span data-tip="${populationTip}" class="icon-male"></span><span data-tip="${populationTip}" class="zonePopulation pointer">${percentage ? `${rn((population / totalPopulation) * 100, 2)}%` : si(population)}</span></div>
      <div data-col="tags">
        <input
          data-tip="${t("Zone tags (comma-separated)")}"
          class="zoneTags"
          value="${Tags.format(tags)}"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      ${noteIcon(t("Edit free text notes (legend)"))}
      <span data-col="reorder" data-tip="${t("Drag to raise or lower the zone")}" class="icon-resize-vertical"></span>
      <span data-col="focus" data-tip="${t("Toggle zone focus")}" class="zoneFog icon-pin ${focused ? "" : "inactive"} ${cells.length ? "" : "placeholder"}"></span>
      <span data-col="visibility" data-tip="${t("Toggle zone visibility")}" class="zoneHide icon-eye ${cells.length ? "" : " placeholder"}"></span>
      <span data-col="remove" data-tip="${t("Remove")}" class="zoneRemove icon-trash-empty"></span>
    </div>`;
    }
  );

  body.innerHTML = lines.join("");

  // update footer
  const footerArea = ensureEl("zonesFooterArea");
  footerArea.dataset.area = String(totalArea);
  ensureEl("zonesFooterPopulation").dataset.population = String(totalPopulation);
  ensureEl("zonesFooterNumber").innerHTML = t("{{shown}} of {{total}}", {
    shown: view.all.length,
    total: pack.zones.length
  });
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

  Dialog.update(dialogId, { width: "fit-content", position });
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

function movezone(item: HTMLElement): void {
  const zone = pack.zones.find(z => z.i === +item.dataset.id!);
  if (!zone) return;
  const nextId = item.nextElementSibling instanceof HTMLElement ? +item.nextElementSibling.dataset.id! : null;
  const previousId =
    item.previousElementSibling instanceof HTMLElement ? +item.previousElementSibling.dataset.id! : null;
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
    title: t("Paint Zones"),
    parentDialogId: dialogId,
    onClose: open,
    mode: "multiple",
    items: [
      { id: -1, name: t("No zone"), color: "#ffffff" },
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
  if (findEl(dialogId)) zonesTable.refresh();
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
  const getItems = () => {
    const filterBy = zonesFilter.type;
    const isFiltered = filterBy !== "all";
    const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
    return visibleZones.map(({ i, name, color }): LegendItem => [`zone${i}`, color, name]);
  };
  LegendBoxes.toggle(LEGEND_NAME, getItems, t("No zones to show"));
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
  pack.zones.push({ i: zoneId, name, type, color, cells: [], tags: [] });

  zonesTable.refresh();
  Layers.draw("zones");
}

function downloadZonesData(): void {
  const unit =
    options.map.units.area.unit === "square" ? `${options.map.units.distance.unit}2` : options.map.units.area.unit;
  const rows = getZonesData().map(({ zone, area, population }) => [
    zone.i,
    zone.color,
    zone.name,
    zone.type,
    Tags.format(zone.tags),
    zone.cells.length,
    area,
    population
  ]);
  Csv.download(
    "Zones",
    CSV_COLUMNS.map(column => (column === "Area" ? `Area ${unit}` : column)),
    rows
  );
}

function changeDescription(zone: Zone, value: string): void {
  if (!value.trim()) return;
  Zones.rename(zone.i, value);
  select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).attr("data-description", zone.name);
}

function changeType(zone: Zone, value: string): void {
  if (!value.trim()) return;
  Zones.setType(zone.i, value);
  select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).attr("data-type", zone.type);
}

function changePopulation(zone: Zone): void {
  const landCells = zone.cells.filter(i => pack.cells.h[i] >= 20);
  if (!landCells.length) {
    tip(t("Zone does not have any land cells, cannot change population"), false, "error");
    return;
  }

  const burgs = pack.burgs.filter(b => !b.removed && landCells.includes(b.cell));
  const rural = rn(sum(landCells.map(i => pack.cells.pop[i])) * options.map.units.population.scale);
  const urban = rn(
    sum(landCells.map(i => pack.cells.burg[i]).map(b => pack.burgs[b]?.population ?? 0)) *
      options.map.units.population.scale *
      options.map.units.population.urbanization.rate
  );
  const total = rural + urban;
  const l = (n: number): string => Number(n).toLocaleString();

  Dialog.message({
    message: /* html */ `${t("Rural")}: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> ${t("Urban")}:
    <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${burgs.length ? "" : "disabled"} />
    <p>${t("Total population")}: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`,
    title: t("Change zone population"),
    width: "24em",
    buttons: [
      {
        label: t("Apply"),
        onClick: () => {
          applyPopulationChange();
        }
      },
      { label: t("Cancel") }
    ]
  });

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

  function applyPopulationChange(): void {
    try {
      Zones.setPopulation(zone.i, +ruralPop.value || 0, +urbanPop.value || 0);
    } catch (error) {
      tip(errorText(error), false, "error");
      return;
    }
    Layers.draw("population");
    zonesTable.refresh();
  }
}

function zoneRemove(zone: Zone): void {
  Dialog.confirm({
    title: t("Remove"),
    message: `${t("Are you sure you want to remove the zone?")}<br>${t("This action cannot be reverted")}`,
    confirm: t("Remove"),
    onConfirm: () => {
      Zones.remove(zone.i);
      select<SVGGElement, unknown>("#zones").select(`#zone${zone.i}`).remove();
      unfog(`focusZone${zone.i}`);
      zonesTable.refresh();
    }
  });
}

/** Update existing zones from a CSV in the export format */
async function uploadZonesCsv(text: string): Promise<void> {
  const find = (id: number) => pack.zones.find(zone => zone.i === id);
  const textColumns = ["Description", "Type", "Tags"];
  const updated = await Controllers.CsvUpload.update(
    text,
    CSV_COLUMNS,
    { find, units: ["Area"], text: textColumns },
    (id, row) => {
      const zone = find(id)!;
      row.apply("Description", name => Zones.rename(zone.i, name), zone.name);
      row.apply("Color", color => Zones.recolor(zone.i, color), zone.color); // recolor rejects hatched fills, so keep them when unchanged
      row.apply("Type", type => Zones.setType(zone.i, type), zone.type);
      row.assign("Tags", tags => Tags.set(zone, tags), Tags.format(zone.tags));
      row.population(getZonePopulation(zone), (rural, urban) => Zones.setPopulation(zone.i, rural, urban), [
        "Population"
      ]);
    }
  );
  if (!updated) return;

  Layers.draw("zones");
  zonesTable.refresh();
}

export const ZonesEditor = { open, exportCsv: downloadZonesData };
