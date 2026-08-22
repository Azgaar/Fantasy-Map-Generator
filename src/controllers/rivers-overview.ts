import { mean, select } from "d3";
import { closeDialogs, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import { dialogState } from "@/components/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { Layers } from "@/components/layers";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName } from "@/utils";
import { ensureEl, rn } from "../utils";

const dialogId = "riversOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string };

const columns: EditorColumn<River>[] = [
  { key: "locate", width: "1.4em", permanent: true },
  {
    key: "name",
    label: "River",
    width: "8em",
    permanent: true,
    sortBy: river => river.name || "",
    sortType: "alpha"
  },
  {
    key: "type",
    label: "Type",
    width: "5em",
    mobileHidden: true,
    sortBy: river => river.type || "",
    sortType: "alpha"
  },
  {
    key: "discharge",
    label: "Discharge",
    width: "7em",
    mobileHidden: true,
    tip: "Click to sort by discharge (flux in m3/s)",
    sortBy: river => river.discharge,
    defaultSort: "desc"
  },
  {
    key: "length",
    label: "Length",
    width: "5em",
    sortBy: river => river.length
  },
  {
    key: "width",
    label: "Width",
    width: "5em",
    mobileHidden: true,
    sortBy: river => river.width
  },
  {
    key: "basin",
    label: "Basin",
    width: "9em",
    sortBy: river => pack.rivers.find(({ i }) => i === river.basin)?.name || "",
    sortType: "alpha"
  },
  { key: "actions", width: "2.2em", permanent: true, align: "right" }
];

function getRiversById(): Map<number, River> {
  return new Map<number, River>(pack.rivers.map((river: River) => [river.i, river]));
}

function getFilteredRivers(riversById: Map<number, River>): River[] {
  const searchText = filterState.search.toLowerCase().trim();
  if (!searchText) return pack.rivers.slice();

  return pack.rivers.filter((r: River) => {
    const name = (r.name || "").toLowerCase();
    const type = (r.type || "").toLowerCase();
    const basin = riversById.get(r.basin);
    const basinName = basin ? (basin.name || "").toLowerCase() : "";
    return name.includes(searchText) || type.includes(searchText) || basinName.includes(searchText);
  });
}

const riversTable = initEditorTable<River>({
  getData: () => {
    const riversById = getRiversById();
    const filtered = getFilteredRivers(riversById);
    return sortDataByColumns(dialogId, filtered, columns);
  },
  onUpdate: renderRiversPage
});

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("rivers");

  renderDialog();
  riversTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Rivers Overview",
    resizable: false,
    width: "fit-content",
    position,
    close: closeRiversOverview
  });
}

function renderDialog(): void {
  destroyDialog("riversOverview");

  const html = /* html */ `<div id="riversOverview" class="dialog stable editorDialog">
    <div id="riversBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>
    <div id="riversFilters" class="editorFilters">
      <label for="riversSearch" data-tip="Filter by name, type or basin">Search: <input id="riversSearch" type="search" /></label>
    </div>
    <div id="riversFooter" class="totalLine">
      <div data-tip="Rivers number" style="margin-left: 4px">Rivers:&nbsp;<span id="riversFooterNumber">0</span></div>
      <div data-tip="Average discharge" style="margin-left: 12px" data-col="discharge">Average discharge:&nbsp;<span id="riversFooterDischarge">0</span></div>
      <div data-tip="Average length" style="margin-left: 12px" data-col="length">Length:&nbsp;<span id="riversFooterLength">0</span></div>
      <div data-tip="Average mouth width" style="margin-left: 12px" data-col="width">Width:&nbsp;<span id="riversFooterWidth">0</span></div>
    </div>
    <div id="riversBottom" class="editorToolbar">
      <button id="riversOverviewRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="addNewRiver" data-tip="Automatically add river starting from clicked cell. Hold Shift to add multiple" class="icon-plus"></button>
      <button id="riverCreateNew" data-tip="Create a new river selecting river cells" class="icon-map-pin"></button>
      <button id="riversBasinHighlight" data-tip="Toggle basin highlight mode" class="icon-sitemap"></button>
      <button id="riversExport" data-tip="Save rivers-related data as a text file (.csv)" class="icon-download"></button>
      <button id="riversRemoveAll" data-tip="Remove all rivers" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl<HTMLInputElement>("riversSearch").value = filterState.search;
  bindColumnSorting(dialogId, riversTable.reset);
  applyLineHighlighting(dialogId, ({ target, cellId }) => {
    const riverId = pack.cells.r[cellId];
    if (riverId) return riverId;
    const river = target.closest<SVGElement>("#rivers [id^='river']");
    return river && /^river\d+$/.test(river.id) ? Number(river.id.slice(5)) : undefined;
  });

  ensureEl("riversOverviewRefresh").addEventListener("click", riversTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("addNewRiver").addEventListener("click", () => void Controllers.RiverAutoCreator.toggle());
  ensureEl("riverCreateNew").addEventListener("click", createNewRiver);
  ensureEl("riversBasinHighlight").addEventListener("click", toggleBasinsHightlight);
  ensureEl("riversExport").addEventListener("click", downloadRiversData);
  ensureEl("riversRemoveAll").addEventListener("click", triggerAllRiversRemove);
  ensureEl("riversSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    riversTable.reset();
  });
}

function closeRiversOverview(): void {
  destroyDialog("riversOverview");
}

function createNewRiver(): void {
  void Controllers.RiverCreator.open();
}

function renderRiversPage(view: TableView<River>): void {
  const body = ensureEl("riversBody");
  body.querySelectorAll(":scope > .states").forEach(row => {
    row.remove();
  });
  let lines = "";
  const unit = distanceUnitInput.value;
  const riversById = getRiversById();

  for (const r of view.rows) {
    const discharge = `${r.discharge} m³/s`;
    const length = `${rn(r.length * distanceScale)} ${unit}`;
    const width = `${rn(r.width * distanceScale, 3)} ${unit}`;
    const basin = riversById.get(r.basin)?.name;

    lines += /* html */ `<div
        class="states"
        data-id=${r.i}
        data-name="${r.name}"
        data-type="${r.type}"
        data-discharge="${r.discharge}"
        data-length="${r.length}"
        data-width="${r.width}"
        data-basin="${basin}"
      >
        <span data-tip="Locate the river" class="icon-target" data-col="locate"></span>
        <div data-tip="River name" data-col="name">${r.name}</div>
        <div data-tip="River type name" data-col="type">${r.type}</div>
        <div data-tip="River discharge (flux power)" data-col="discharge">${discharge}</div>
        <div data-tip="River length from source to mouth" data-col="length">${length}</div>
        <div data-tip="River mouth width" data-col="width">${width}</div>
        <input data-tip="River basin (name of the main stem)" class="stateName" value="${basin}" disabled data-col="basin" />
        <div data-col="actions">
          <span data-tip="Edit river" class="icon-pencil"></span>
          <span data-tip="Remove river" class="icon-trash-empty"></span>
        </div>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("riversFooterNumber").innerHTML = `${view.all.length} of ${pack.rivers.length}`;
  const averageDischarge = rn(mean(view.all.map(r => r.discharge))!) || 0;
  ensureEl("riversFooterDischarge").innerHTML = `${averageDischarge} m³/s`;
  const averageLength = rn(mean(view.all.map(r => r.length))!) || 0;
  ensureEl("riversFooterLength").innerHTML = `${averageLength * distanceScale} ${unit}`;
  const averageWidth = rn(mean(view.all.map(r => r.width))!, 3) || 0;
  ensureEl("riversFooterWidth").innerHTML = `${rn(averageWidth * distanceScale, 3)} ${unit}`;

  // add listeners
  body
    .querySelectorAll("div.states")
    .forEach(el => void el.addEventListener("mouseenter", (ev: Event) => riverHighlightOn(ev)));
  body
    .querySelectorAll("div.states")
    .forEach(el => void el.addEventListener("mouseleave", (ev: Event) => riverHighlightOff(ev)));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.addEventListener("click", zoomToRiver));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openRiverEditor));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerRiverRemove));

  renderEditorPagination(ensureEl("riversFooter"), view, riversTable.goto);
}

function riverHighlightOn(event: Event): void {
  Layers.show("rivers");
  const r = +(event.target as HTMLElement).dataset.id!;
  select("#rivers").select(`#river${r}`).attr("stroke", "red").attr("stroke-width", 1);
}

function riverHighlightOff(e: Event): void {
  const r = +(e.target as HTMLElement).dataset.id!;
  select("#rivers").select(`#river${r}`).attr("stroke", null).attr("stroke-width", null);
}

function zoomToRiver(this: HTMLElement): void {
  const r = +(this.closest(".states") as HTMLElement).dataset.id!;
  const river = select("#rivers").select(`#river${r}`).node() as Element;
  highlightElement(river, 3);
}

function toggleBasinsHightlight(): void {
  if (select("#rivers").attr("data-basin") === "hightlighted") {
    select("#rivers").selectAll("*").attr("fill", null);
    select("#rivers").attr("data-basin", null);
  } else {
    select("#rivers").attr("data-basin", "hightlighted");
    const basins = [...new Set(pack.rivers.map((r: River) => r.basin))];
    const colors = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ];

    basins.forEach((b, i) => {
      const color = colors[i % colors.length];
      pack.rivers
        .filter((r: River) => r.basin === b)
        .forEach((r: River) => {
          select("#rivers").select(`#river${r.i}`).attr("fill", color);
        });
    });
  }
}

function downloadRiversData(): void {
  let data = "Id,River,Type,Discharge,Length,Width,Basin\n"; // headers

  const riversById = getRiversById();
  const exported = riversTable.view().all;

  exported.forEach((r: River) => {
    const discharge = `${r.discharge} m³/s`;
    const length = `${rn(r.length * distanceScale)} ${distanceUnitInput.value}`;
    const width = `${rn(r.width * distanceScale, 3)} ${distanceUnitInput.value}`;
    const basin = riversById.get(r.basin)?.name || "";
    data += `${[r.i, r.name, r.type, discharge, length, width, basin].join(",")}\n`;
  });

  const name = `${getFileName("Rivers")}.csv`;
  downloadFile(data, name);
}

function openRiverEditor(this: HTMLElement): void {
  const id = `river${(this.closest(".states") as HTMLElement).dataset.id}`;
  void Controllers.RiverEditor.open(id);
}

function triggerRiverRemove(this: HTMLElement): void {
  const river = +(this.closest(".states") as HTMLElement).dataset.id!;
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove the river? All tributaries will be auto-removed`;

  $("#alert").dialog({
    resizable: false,
    width: "22em",
    title: "Remove river",
    buttons: {
      Remove: function (this: any) {
        Rivers.remove(river);
        Layers.draw("labels");
        riversTable.refresh();
        $(this).dialog("close");
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function triggerAllRiversRemove(): void {
  alertMessage.innerHTML = /* html */ `Are you sure you want to remove all rivers?`;
  $("#alert").dialog({
    resizable: false,
    title: "Remove all rivers",
    buttons: {
      Remove: function (this: any) {
        $(this).dialog("close");
        removeAllRivers();
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function removeAllRivers(): void {
  pack.rivers = [];
  pack.cells.r = new Uint16Array(pack.cells.i.length);
  select("#rivers").selectAll("*").remove();
  Layers.draw("labels");
  riversTable.refresh();
}

export const RiversOverview = { open };
