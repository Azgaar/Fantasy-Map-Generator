import { select, sum } from "d3";
import { Controllers } from "@/controllers";
import { Icons } from "@/model/icons";
import type { Regiment } from "@/model/political/military-generator";
import type { State } from "@/model/political/states-generator";
import { Tags } from "@/model/tags";
import { drawRegiment } from "@/renderers/draw-military";
import { Layers } from "@/renderers/layers";
import { Csv } from "@/services/io/csv";
import { closeDialogs, destroyDialog, updateDialog } from "@/ui/dialog/dialog-helpers";
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
import { applyDefaultViewboxEvents } from "@/ui/map/viewbox-events";
import { clearMainTip, tip } from "@/ui/tooltips";
import { capitalize, ensureEl, findEl, getLatitude, getLongitude, getPointer, last, si } from "@/utils";
import { sentences, t } from "@/utils/i18n";

const dialogId = "regimentsOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { stateId: number; search: string };

type RegimentRow = { state: State; regiment: Regiment };
let columns: EditorColumn<RegimentRow>[] = [];
const regimentsTable = initEditorTable<RegimentRow>({ getData: getRegimentsData, onUpdate: renderRegimentsPage });

function open(state?: number): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ stateId: -1, search: "" }));
  filterState.search ??= "";
  filterState.stateId ??= -1;
  closeDialogs(".stable");
  Layers.show("military");

  if (state !== undefined) filterState.stateId = state;
  renderDialog();
  updateFilter();
  regimentsTable.reset();

  $("#regimentsOverview").dialog({
    title: t("Regiments Overview"),
    resizable: false,
    width: "fit-content",
    close: closeRegimentsOverview,
    position
  });
}

function renderDialog(): void {
  columns = getRegimentColumns();
  destroyDialog("regimentsOverview");
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div id="regimentsBody" class="table" data-type="absolute">
        ${renderEditorHeader({ dialogId, columns })}
      </div>
      <div id="regimentsFilters" class="editorFilters">
        <label for="regimentsSearch" data-tip="${t("Filter by name, state, or tag")}">
          ${t("Search")}: <input id="regimentsSearch" type="search" />
        </label>
        <label for="regimentsFilter" data-tip="${t("Select state")}">
          ${t("State")}: <select id="regimentsFilter"></select>
        </label>
      </div>
      <div id="regimentsFooter" class="totalLine"></div>
      <div id="regimentsBottom" class="editorToolbar">
        <button id="regimentsOverviewRefresh" data-tip="${t("Refresh")}" class="icon-cw"></button>
        <button
          id="regimentsPercentage"
          data-tip="${t("Toggle percentage / absolute values views")}"
          class="icon-percent"
        ></button>
        <button id="regimentsAddNew" data-tip="${t("Add")}" class="icon-user-plus"></button>
        <button
          id="regimentsExport"
          data-tip="${t("Save data as a CSV file")}"
          class="icon-download"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  ensureEl<HTMLInputElement>("regimentsSearch").value = filterState.search;
  bindColumnSorting(dialogId, regimentsTable.reset);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });

  const body = ensureEl("regimentsBody");

  ensureEl("regimentsOverviewRefresh").addEventListener("click", refreshRegimentsOverview);
  ensureEl("regimentsPercentage").addEventListener("click", togglePercentageMode);
  ensureEl("regimentsAddNew").addEventListener("click", toggleAdd);
  ensureEl("regimentsExport").addEventListener("click", downloadRegimentsData);
  ensureEl("regimentsSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    regimentsTable.reset();
  });
  ensureEl("regimentsFilter").addEventListener("change", event => {
    filterState.stateId = +(event.target as HTMLSelectElement).value;
    dialogState.set(dialogId, "filters", filterState);
    regimentsTable.reset();
  });

  body.addEventListener("click", async event => {
    const vis = (event.target as HTMLElement).closest<HTMLElement>(".regimentVisibility");
    if (vis) {
      const rowEl = vis.closest<HTMLElement>(".states")!;
      const stateId = +rowEl.dataset.s!;
      const regId = +rowEl.dataset.id!;
      const reg = pack.states[stateId]?.military?.find(r => r.i === regId);
      if (reg) {
        reg.hidden = !reg.hidden;
        vis.className = `regimentVisibility pointer ${reg.hidden ? "icon-eye-off" : "icon-eye"}`;
        Layers.draw("military");
      }
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-edit-regiment]");
    if (!target) return;
    Controllers.RegimentEditor.open(`#${target.dataset.editRegiment}`);
  });
}

function closeRegimentsOverview(): void {
  if (ensureEl("regimentsAddNew").classList.contains("pressed")) toggleAdd();
  $("#regimentsOverview").dialog("destroy");
  ensureEl("regimentsOverview").remove();
}

const unitColumnKey = (name: string) => `unit:${name}`;

function getRegimentColumns(): EditorColumn<RegimentRow>[] {
  const unitColumns: EditorColumn<RegimentRow>[] = options.map.military.units.map(unit => ({
    key: unitColumnKey(unit.name),
    label: capitalize(unit.name.replace(/_/g, " ")),
    width: "5em",
    mobileHidden: true,
    tip: sentences(t("{{unit}} units number", { unit: unit.name }), t("Click to sort")),
    sortBy: row => row.regiment.u[unit.name] || 0
  }));

  return [
    { key: "color", width: "1.2em", permanent: true },
    {
      key: "state",
      label: t("State"),
      width: "7em",
      permanent: true,
      sortBy: row => row.state.name || "",
      sortType: "alpha"
    },
    { key: "emblem", width: "1.2em" },
    {
      key: "name",
      label: t("Name"),
      width: "15em",
      permanent: true,
      sortBy: row => row.regiment.name || "",
      sortType: "alpha"
    },
    ...unitColumns,
    {
      key: "total",
      label: t("Total"),
      width: "5em",
      defaultSort: "desc",
      sortBy: row => row.regiment.a,
      tip: sentences(t("Total military personnel (not considering crew)"), t("Click to sort"))
    },
    {
      key: "tags",
      label: t("Tags"),
      width: "10em",
      hidden: true,
      sortBy: row => Tags.format(row.regiment.tags),
      sortType: "alpha"
    },
    {
      key: "visibility",
      width: "1.4em",
      sortBy: row => (row.regiment.hidden ? 1 : 0),
      tip: t("Toggle visibility")
    },
    { key: "edit", width: "1.4em", permanent: true }
  ];
}

function getRegimentsData(): RegimentRow[] {
  const rows: RegimentRow[] = [];
  const search = filterState.search.toLowerCase().trim();
  for (const state of pack.states) {
    if (!state.i || state.removed || !state.military?.length) continue;
    if (filterState.stateId !== -1 && state.i !== filterState.stateId) continue;
    for (const regiment of state.military) {
      if (search && !Tags.matches(search, regiment.name, regiment.tags, [state.name || ""])) continue;
      rows.push({ state, regiment });
    }
  }
  return sortDataByColumns(dialogId, rows, columns);
}

function refreshRegimentsOverview(): void {
  updateFilter();
  regimentsTable.refresh();
}

function renderRegimentsPage(view: TableView<RegimentRow>): void {
  const body = ensureEl("regimentsBody");
  const percentage = body.dataset.type === "percentage";
  const unitTotals = Object.fromEntries(
    options.map.military.units.map(unit => [unit.name, sum(view.all.map(row => row.regiment.u[unit.name] || 0))])
  );
  const total = sum(view.all.map(row => row.regiment.a));
  const percent = (value: number, all: number) => `${Math.round(all ? (value / all) * 100 : 0)}%`;

  const lines = view.rows
    .map(({ state, regiment }) => {
      const unitCells = options.map.military.units
        .map(unit => {
          const value = regiment.u[unit.name] || 0;
          return `<div data-col="${unitColumnKey(unit.name)}" data-tip="${t("{{unit}} units number", { unit: capitalize(unit.name) })}">${percentage ? percent(value, unitTotals[unit.name]) : value}</div>`;
        })
        .join("");
      const emblem = `<span data-col="emblem" data-tip="${t("Regiment's emblem")}">${Icons.html(regiment.icon ?? "")}</span>`;

      return /* html */ `<div class="states" data-id="${regiment.i}" data-s="${state.i}">
        <fill-box data-col="color" data-tip="${state.fullName}" fill="${state.color}" disabled></fill-box>
        <input data-col="state" data-tip="${state.fullName}" value="${state.name}" readonly />
        ${emblem}
        <input data-col="name" data-tip="${t("Name")}" value="${regiment.name}" readonly />
        ${unitCells}
        <div data-col="total" data-tip="${t("Total military personnel (not considering crew)")}" style="font-weight:bold">${percentage ? percent(regiment.a, total) : regiment.a}</div>
        <div data-col="tags">
          <input
            data-tip="${t("Regiment tags (comma-separated)")}"
            class="regimentTags"
            value="${Tags.format(regiment.tags)}"
            placeholder="${t("Tags")}"
            autocorrect="off"
            spellcheck="false"
          />
        </div>
        <span data-col="visibility" data-tip="${t("Toggle visibility")}" class="regimentVisibility pointer ${regiment.hidden ? "icon-eye-off" : "icon-eye"}"></span>
        <span data-col="edit" data-tip="${t("Edit Regiment")}" data-edit-regiment="regiment${state.i}-${regiment.i}" class="icon-pencil pointer"></span>
      </div>`;
    })
    .join("");

  body.querySelectorAll(":scope > .states").forEach(line => {
    line.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);

  const footer = ensureEl("regimentsFooter");
  footer.innerHTML = /* html */ `<div style="margin-left:4px">${t("Regiments")}:&nbsp;${view.all.length}</div>
    ${options.map.military.units.map(unit => `<div data-col="${unitColumnKey(unit.name)}" style="margin-left:12px">${capitalize(unit.name)}:&nbsp;${si(unitTotals[unit.name])}</div>`).join("")}
    <div data-col="total" style="margin-left:12px">${t("Total")}:&nbsp;${si(total)}</div>`;
  renderEditorPagination(footer, view, regimentsTable.goto);

  body.querySelectorAll<HTMLElement>(":scope > .states").forEach(line => {
    line.addEventListener("mouseenter", regimentHighlightOn);
    line.addEventListener("mouseleave", regimentHighlightOff);
  });
  body.querySelectorAll<HTMLInputElement>(".regimentTags").forEach(el => {
    void el.addEventListener("change", regimentChangeTags);
  });
  updateDialog(dialogId, { width: "fit-content", position });
}

function regimentChangeTags(this: HTMLInputElement): void {
  const line = this.closest(".states") as HTMLElement;
  const stateId = Number(line.dataset.s);
  const regId = Number(line.dataset.id);
  const regiment = pack.states[stateId]?.military?.find(r => r.i === regId);
  if (!regiment) return;
  Tags.set(regiment, this.value);
  this.value = Tags.format(regiment.tags);
  if (filterState.search) regimentsTable.refresh();
}

function updateFilter(): void {
  if (filterState.stateId !== -1 && !pack.states.some(s => s.i === filterState.stateId && !s.removed)) {
    filterState.stateId = -1;
  }
  const filter = ensureEl<HTMLSelectElement>("regimentsFilter");
  filter.options.length = 0; // remove all options
  filter.options.add(new Option(t("All"), "-1", false, filterState.stateId === -1));
  const statesSorted = pack.states.filter(s => s.i && !s.removed).sort((a, b) => (a.name! > b.name! ? 1 : -1));
  statesSorted.forEach(s => {
    filter.options.add(new Option(s.name, String(s.i), false, s.i === filterState.stateId));
  });
  dialogState.set(dialogId, "filters", filterState);
}

function regimentHighlightOn(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.s!;
  const id = +target.dataset.id!;
  if (customization || !state) return;
  select<SVGGElement, unknown>(`#armies > g > g#regiment${state}-${id}`)
    .transition()
    .duration(2000)
    .style("fill", "#ff0000");
}

function regimentHighlightOff(event: Event): void {
  const target = event.target as HTMLElement;
  const state = +target.dataset.s!;
  const id = +target.dataset.id!;
  select<SVGGElement, unknown>(`#armies > g > g#regiment${state}-${id}`)
    .transition()
    .duration(1000)
    .style("fill", null);
}

function togglePercentageMode(): void {
  const body = ensureEl("regimentsBody");
  body.dataset.type = body.dataset.type === "absolute" ? "percentage" : "absolute";
  regimentsTable.refresh();
}

function toggleAdd(): void {
  const button = ensureEl("regimentsAddNew");
  button.classList.toggle("pressed");
  if (button.classList.contains("pressed")) {
    select<SVGGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addRegimentOnClick);
    tip(t("Click on map to create new regiment or fleet"), true);
    findEl("regimentAdd")?.classList.add("pressed");
  } else {
    clearMainTip();
    applyDefaultViewboxEvents();
    refreshRegimentsOverview();
    findEl("regimentAdd")?.classList.remove("pressed");
  }
}

function addRegimentOnClick(this: SVGGElement, event: MouseEvent): void {
  const state = filterState.stateId;
  if (state === -1) {
    tip(t("Please select state from the list"), false, "error");
    return;
  }

  const point = getPointer(event, this);
  const cell = Pack.findCell(point[0], point[1]);
  if (cell === undefined) return;
  const x = pack.cells.p[cell][0];
  const y = pack.cells.p[cell][1];
  const military = pack.states[state].military!;
  const i = military.length ? last(military).i + 1 : 0;
  const n = +(pack.cells.h[cell] < 20); // naval or land
  const reg: Regiment = {
    a: 0,
    cell,
    i,
    n,
    u: {},
    x,
    y,
    bx: x,
    by: y,
    state,
    icon: Icons.glyph("🛡️"),
    name: "",
    tags: [],
    t: 0,
    s: 0,
    type: ""
  };
  reg.name = Military.getName(reg, military);
  military.push(reg);
  Military.generateNote(reg, pack.states[state]); // add legend
  drawRegiment(reg, state);
  toggleAdd();
}

function downloadRegimentsData(): void {
  const units = options.map.military.units.map(u => u.name);
  const { coordinates } = options.map.geography;
  const { width, height } = options.map.graph;
  const headers = [
    "State",
    "Id",
    "Icon",
    "Name",
    ...units.map(u => capitalize(u)),
    "Total",
    "Tags",
    "X",
    "Y",
    "Latitude",
    "Longitude",
    "Base X",
    "Base Y",
    "Base Latitude",
    "Base Longitude"
  ];
  const rows = pack.states
    .filter(s => s.i && !s.removed)
    .flatMap(s =>
      (s.military ?? []).map(r => [
        s.name,
        r.i,
        Icons.glyphText(r.icon ?? "") ?? r.icon,
        r.name,
        ...units.map(unit => r.u[unit]),
        r.t,
        Tags.format(r.tags),
        r.x,
        r.y,
        getLatitude(r.y, coordinates, height, 2),
        getLongitude(r.x, coordinates, width, 2),
        r.bx,
        r.by,
        getLatitude(r.by, coordinates, height, 2),
        getLongitude(r.bx, coordinates, width, 2)
      ])
    );
  Csv.download("Regiments", headers, rows);
}

export const RegimentsOverview = { open, exportCsv: downloadRegimentsData };
