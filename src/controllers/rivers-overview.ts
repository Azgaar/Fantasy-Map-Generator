import { mean } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/components/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/components/dialog/sorting";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/components/dialog/table";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import { downloadFile, getFileName } from "@/utils";
import { ensureEl, rn } from "../utils";

const dialogId = "riversOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
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
  const searchText = ensureEl<HTMLInputElement>("riversSearch").value.toLowerCase().trim();
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
  closeDialogs(`#${dialogId}, .stable`);
  if (!layerIsOn("toggleRivers")) toggleRivers();

  renderDialog();
  riversTable.reset();

  showDomDialog({
    content: ensureEl(dialogId),
    onClose: closeRiversOverview,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Rivers Overview",
    width: "fit-content"
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
      <button id="riversExport" data-tip="Save rivers-related data as a text file (.csv)" class="icon-download"></button>
      <button id="riversRemoveAll" data-tip="Remove all rivers" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  bindColumnSorting(dialogId, riversTable.reset);
  applyLineHighlighting(dialogId, ({ cellId }) => {
    const riverId = pack.cells.r[cellId];
    if (riverId) return riverId;
    return undefined;
  });

  ensureEl("riversOverviewRefresh").addEventListener("click", riversTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("addNewRiver").addEventListener("click", () => void Controllers.RiverAutoCreator.toggle());
  ensureEl("riverCreateNew").addEventListener("click", createNewRiver);
  ensureEl("riversExport").addEventListener("click", downloadRiversData);
  ensureEl("riversRemoveAll").addEventListener("click", triggerAllRiversRemove);
  ensureEl("riversSearch").addEventListener("input", riversTable.reset);
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
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.addEventListener("click", zoomToRiver));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openRiverEditor));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerRiverRemove));

  renderEditorPagination(ensureEl("riversFooter"), view, riversTable.goto);
}

function zoomToRiver(this: HTMLElement): void {
  const riverId = Number((this.closest(".states") as HTMLElement).dataset.id);
  const river = pack.rivers.find((candidate: River) => candidate.i === riverId);
  if (!river) return;
  const points = Rivers.getRiverPoints(river.cells, river.points ?? null);
  zoomTo(mean(points, point => point[0])!, mean(points, point => point[1])!, 3, 1600);
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
  const id = Number((this.closest(".states") as HTMLElement).dataset.id);
  void Controllers.RiverEditor.open(id);
}

function triggerRiverRemove(this: HTMLElement): void {
  const river = +(this.closest(".states") as HTMLElement).dataset.id!;
  confirmationDialog({
    confirm: "Remove",
    message: "Are you sure you want to remove the river? All tributaries will be auto-removed",
    onConfirm: () => {
      Rivers.remove(river);
      riversTable.refresh();
    },
    title: "Remove river"
  });
}

function triggerAllRiversRemove(): void {
  confirmationDialog({
    confirm: "Remove",
    message: "Are you sure you want to remove all rivers?",
    onConfirm: removeAllRivers,
    title: "Remove all rivers"
  });
}

function removeAllRivers(): void {
  pack.rivers = [];
  pack.cells.r = new Uint16Array(pack.cells.i.length);
  if (layerIsOn("toggleRivers")) drawRivers();
  riversTable.refresh();
}

export const RiversOverview = { open };
