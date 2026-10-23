import { mean, select } from "d3";
import { Controllers } from "@/controllers";
import { Lakes } from "@/model/physical/lakes";
import type { River } from "@/model/physical/river-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Tags } from "@/model/tags";
import { getRiverBox, toggleBasinHighlight } from "@/renderers/draw-rivers";
import { Layers } from "@/renderers/layers";
import { highlightArea } from "@/renderers/overlays/highlight";
import { Csv } from "@/services/io/csv";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/ui/dialog/dialog-helpers";
import { applyLineHighlighting } from "@/ui/dialog/highlighting";
import { bindColumnSorting, sortDataByColumns } from "@/ui/dialog/sorting";
import { dialogState } from "@/ui/dialog/state";
import {
  type EditorColumn,
  initColumnVisibility,
  initEditorTable,
  renderEditorHeader,
  renderEditorPagination,
  type TableView
} from "@/ui/dialog/table";
import { tip } from "@/ui/tooltips";
import { sentences, t } from "@/utils/i18n";
import { ensureEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

const dialogId = "riversOverview" as const;
const CSV_COLUMNS = ["Id", "River", "Type", "Discharge", "Length", "Width", "Basin", "Tags"];
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string };

const columns: EditorColumn<River>[] = [
  { key: "locate", width: "1.4em", permanent: true },
  {
    key: "name",
    label: t("River"),
    width: "8em",
    permanent: true,
    sortBy: river => river.name || "",
    sortType: "alpha"
  },
  {
    key: "type",
    label: t("Type"),
    width: "5em",
    mobileHidden: true,
    sortBy: river => river.type || "",
    sortType: "alpha"
  },
  {
    key: "discharge",
    label: t("Discharge"),
    width: "7em",
    mobileHidden: true,
    tip: t("Click to sort by discharge (flux in m3/s)"),
    sortBy: river => river.discharge,
    defaultSort: "desc"
  },
  {
    key: "length",
    label: t("Length"),
    width: "5em",
    sortBy: river => river.length
  },
  {
    key: "width",
    label: t("Width"),
    width: "5em",
    mobileHidden: true,
    sortBy: river => river.width
  },
  {
    key: "basin",
    label: t("Basin"),
    width: "9em",
    sortBy: river => pack.rivers.find(({ i }) => i === river.basin)?.name || "",
    sortType: "alpha"
  },
  {
    key: "tags",
    label: t("Tags"),
    width: "10em",
    hidden: true,
    sortBy: river => Tags.format(river.tags),
    sortType: "alpha"
  },
  { key: "edit", width: "1.1em" },
  { key: "lock", width: "1.1em" },
  { key: "remove", width: "1.4em", permanent: true }
];

function getRiversById(): Map<number, River> {
  return new Map<number, River>(pack.rivers.map((river: River) => [river.i, river]));
}

function getFilteredRivers(riversById: Map<number, River>): River[] {
  const searchText = filterState.search.toLowerCase().trim();
  if (!searchText) return pack.rivers.slice();

  return pack.rivers.filter((r: River) => {
    const basin = riversById.get(r.basin);
    const basinName = basin ? basin.name || "" : "";
    return Tags.matches(searchText, r.name, r.tags, [r.type, basinName]);
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
  if (options.app.mode) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("rivers");

  renderDialog();
  riversTable.reset();

  $(`#${dialogId}`).dialog({
    title: t("Rivers Overview"),
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
      <label for="riversSearch" data-tip="${t("Filter by name, type, basin, or tag")}">${t("Search")}: <input id="riversSearch" type="search" /></label>
    </div>
    <div id="riversFooter" class="totalLine">
      <div data-tip="${t("Rivers number")}" style="margin-left: 4px">${t("Rivers")}:&nbsp;<span id="riversFooterNumber">0</span></div>
      <div data-tip="${t("Average discharge")}" style="margin-left: 12px" data-col="discharge">${t("Average discharge")}:&nbsp;<span id="riversFooterDischarge">0</span></div>
      <div data-tip="${t("Average length")}" style="margin-left: 12px" data-col="length">${t("Length")}:&nbsp;<span id="riversFooterLength">0</span></div>
      <div data-tip="${t("Average mouth width")}" style="margin-left: 12px" data-col="width">${t("Width")}:&nbsp;<span id="riversFooterWidth">0</span></div>
    </div>
    <div id="riversBottom" class="editorToolbar">
      <button id="riversOverviewRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
      <button id="addNewRiver" data-tip="${sentences(t("Automatically add river starting from clicked cell"), t("Hold Shift to add multiple"))}" class="icon-plus"></button>
      <button id="riverCreateNew" data-tip="${t("Create a new river selecting river cells")}" class="icon-map-pin"></button>
      <button id="riversBasinHighlight" data-tip="${t("Toggle basin highlight mode")}" class="icon-sitemap"></button>
      <button id="riversExport" data-tip="${t("Save data as a CSV file")}" class="icon-download"></button>
      <button id="riversImport" data-tip="${t("Upload data from a CSV file")}" class="icon-upload"></button>
      <button id="riversLockAll" data-tip="${t("Lock or unlock all rivers")}" class="icon-lock"></button>
      <button id="riversRemoveAll" data-tip="${t("Remove all unlocked rivers (locked rivers are kept)")}" class="icon-trash"></button>
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
  ensureEl("riversBasinHighlight").addEventListener("click", () => void toggleBasinHighlight());
  ensureEl("riversExport").addEventListener("click", downloadRiversData);
  ensureEl("riversImport").addEventListener("click", () => Csv.pick(uploadRiversCsv));
  ensureEl("riversLockAll").addEventListener("click", toggleLockAll);
  ensureEl("riversRemoveAll").addEventListener("click", triggerAllRiversRemove);
  ensureEl("riversSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    riversTable.reset();
  });
}

function closeRiversOverview(): void {
  destroyDialog("riversOverview");
  const view = riversTable.view();
  view.rows = [];
  view.all = [];
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
  const unit = options.map.units.distance.unit;
  const riversById = getRiversById();

  for (const r of view.rows) {
    const discharge = `${r.discharge} m³/s`;
    const length = `${rn(r.length * options.map.units.distance.scale)} ${unit}`;
    const width = `${rn(r.width * options.map.units.distance.scale, 3)} ${unit}`;
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
        <span data-tip="${t("Locate on map")}" class="icon-target" data-col="locate"></span>
        <div data-tip="${t("Name")}" data-col="name">${r.name}</div>
        <div data-tip="${t("River type name")}" data-col="type">${r.type}</div>
        <div data-tip="${t("River discharge (flux power)")}" data-col="discharge">${discharge}</div>
        <div data-tip="${t("River length from source to mouth")}" data-col="length">${length}</div>
        <div data-tip="${t("River mouth width")}" data-col="width">${width}</div>
        <input data-tip="${t("River basin (name of the main stem)")}" class="stateName" value="${basin}" disabled data-col="basin" />
        <div data-col="tags">
          <input
            data-tip="${t("Tags (comma-separated)")}"
            class="riverTags"
            value="${Tags.format(r.tags)}"
            placeholder="${t("Tags")}"
            autocorrect="off"
            spellcheck="false"
          />
        </div>
        <span data-col="edit" data-tip="${t("Edit River")}" class="icon-pencil"></span>
        <span data-col="lock" class="locks pointer ${
          r.lock ? "icon-lock" : "icon-lock-open inactive"
        }" data-lock-tip></span>
        <span data-col="remove" data-tip="${t("Remove")}" class="icon-trash-empty"></span>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("riversFooterNumber").innerHTML = t("{{shown}} of {{total}}", {
    shown: view.all.length,
    total: pack.rivers.length
  });
  const averageDischarge = rn(mean(view.all.map(r => r.discharge))!) || 0;
  ensureEl("riversFooterDischarge").innerHTML = `${averageDischarge} m³/s`;
  const averageLength = rn(mean(view.all.map(r => r.length))!) || 0;
  ensureEl("riversFooterLength").innerHTML = `${averageLength * options.map.units.distance.scale} ${unit}`;
  const averageWidth = rn(mean(view.all.map(r => r.width))!, 3) || 0;
  ensureEl("riversFooterWidth").innerHTML = `${rn(averageWidth * options.map.units.distance.scale, 3)} ${unit}`;

  // add listeners
  body
    .querySelectorAll("div.states")
    .forEach(el => void el.addEventListener("mouseenter", (ev: Event) => riverHighlightOn(ev)));
  body
    .querySelectorAll("div.states")
    .forEach(el => void el.addEventListener("mouseleave", (ev: Event) => riverHighlightOff(ev)));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.addEventListener("click", zoomToRiver));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openRiverEditor));
  body.querySelectorAll("input.riverTags").forEach(el => void el.addEventListener("change", riverChangeTags));
  body.querySelectorAll("div > span.locks").forEach(el => void el.addEventListener("click", toggleLockStatus));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerRiverRemove));

  renderEditorPagination(ensureEl("riversFooter"), view, riversTable.goto);
}

function riverChangeTags(this: HTMLInputElement): void {
  const line = this.closest(".states") as HTMLElement;
  const riverId = Number(line.dataset.id);
  const river = pack.rivers.find(r => r.i === riverId);
  if (!river) return;

  Tags.set(river, this.value);
  this.value = Tags.format(river.tags);
  if (filterState.search) riversTable.refresh();
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
  const box = getRiverBox(r);
  if (box) highlightArea(box, 3);
}

function downloadRiversData(): void {
  const riversById = getRiversById();
  const { scale, unit } = options.map.units.distance;
  const rows = riversTable
    .view()
    .all.map((r: River) => [
      r.i,
      r.name,
      r.type,
      `${r.discharge} m³/s`,
      `${rn(r.length * scale)} ${unit}`,
      `${rn(r.width * scale, 3)} ${unit}`,
      riversById.get(r.basin)?.name || "",
      Tags.format(r.tags)
    ]);
  Csv.download("Rivers", CSV_COLUMNS, rows);
}

function openRiverEditor(this: HTMLElement): void {
  const id = `river${(this.closest(".states") as HTMLElement).dataset.id}`;
  void Controllers.RiverEditor.open(id);
}

function triggerRiverRemove(this: HTMLElement): void {
  const river = +(this.closest(".states") as HTMLElement).dataset.id!;
  confirmationDialog({
    title: t("Remove"),
    message: t("Are you sure you want to remove the river? All tributaries will be auto-removed"),
    confirm: t("Remove"),
    width: "22em",
    onConfirm: () => {
      Rivers.remove(river);
      Layers.draw("rivers", "labels");
      riversTable.refresh();
    }
  });
}

function toggleLockStatus(this: HTMLElement): void {
  const river = pack.rivers.find(r => r.i === +(this.closest(".states") as HTMLElement).dataset.id!);
  if (!river) return;
  Rivers.setLocked(river.i, !river.lock);
  this.className = `locks pointer ${river.lock ? "icon-lock" : "icon-lock-open inactive"}`;
}

function toggleLockAll(): void {
  const allLocked = pack.rivers.every(river => river.lock);
  for (const river of pack.rivers) Rivers.setLocked(river.i, !allLocked);
  riversTable.refresh();
  ensureEl("riversLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function triggerAllRiversRemove(): void {
  const toRemove = pack.rivers.filter(river => !river.lock).length;
  if (!toRemove) {
    if (!pack.rivers.length) tip(t("There are no rivers to remove"), false, "error");
    else
      tip(t("All rivers are locked. Unlock rivers to remove them, or use Lock all to unlock first."), false, "error");
    return;
  }

  const locked = pack.rivers.length - toRemove;
  confirmationDialog({
    title: locked ? t("Remove unlocked rivers") : t("Remove all rivers"),
    message: locked
      ? sentences(
          t("Remove all unlocked rivers ({{rivers}})?", { rivers: toRemove }),
          t("Locked rivers to keep: {{locked}}", { locked })
        )
      : t("Are you sure you want to remove all rivers?"),
    confirm: t("Remove"),
    onConfirm: removeAllRivers
  });
}

function removeAllRivers(): void {
  const kept = new Set(pack.rivers.filter(river => river.lock).map(river => river.i));
  pack.rivers = pack.rivers.filter(river => kept.has(river.i));
  pack.cells.r = pack.cells.r.map(r => (kept.has(r) ? r : 0));
  Lakes.cleanupLakeData(); // lakes drop the removed rivers from their inlets and outlet
  Layers.draw("rivers", "labels");
  riversTable.refresh();
}

/** Update existing rivers from a CSV in the export format */
async function uploadRiversCsv(text: string): Promise<void> {
  const find = (id: number) => pack.rivers.find(river => river.i === id);
  const updated = await Controllers.CsvUpload.update(
    text,
    CSV_COLUMNS,
    { find, text: ["River", "Type", "Tags"] },
    (id, row) => {
      const river = find(id)!;
      row.apply("River", name => Rivers.rename(river.i, name), river.name);
      row.apply("Type", type => Rivers.setType(river.i, type), river.type);
      row.assign("Tags", tags => Tags.set(river, tags), Tags.format(river.tags));
    }
  );
  if (!updated) return;

  Layers.draw("rivers", "labels");
  riversTable.refresh();
}

export const RiversOverview = { open };
