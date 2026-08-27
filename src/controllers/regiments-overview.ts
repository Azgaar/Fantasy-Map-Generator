import { select, sum } from "d3";
import { closeDialogs, updateDialog } from "@/components/dialog/dialog-helpers";
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
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { State } from "@/generators/states-generator";
import { drawRegiment } from "@/renderers/draw-military";
import { downloadFile, getFileName, getLatitude, getLongitude } from "@/utils";
import type { Regiment } from "../generators/military-generator";
import { capitalize, ensureEl, findEl, getPointer, last, si } from "../utils";

const dialogId = "regimentsOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { stateId: number };

type RegimentRow = { state: State; regiment: Regiment };
let columns: EditorColumn<RegimentRow>[] = [];
const regimentsTable = initEditorTable<RegimentRow>({ getData: getRegimentsData, onUpdate: renderRegimentsPage });

function open(state?: number): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ stateId: -1 }));
  closeDialogs(".stable");
  Layers.show("military");

  if (state !== undefined) filterState.stateId = state;
  renderDialog();
  updateFilter();
  regimentsTable.reset();

  $("#regimentsOverview").dialog({
    title: "Regiments Overview",
    resizable: false,
    width: "fit-content",
    close: closeRegimentsOverview,
    position
  });
}

function renderDialog(): void {
  columns = getRegimentColumns();
  document.getElementById("regimentsOverview")?.remove();
  const editorHtml = /* html */ `<div id="${dialogId}" class="dialog stable editorDialog">
      <div id="regimentsBody" class="table" data-type="absolute">
        ${renderEditorHeader({ dialogId, columns })}
      </div>
      <div id="regimentsFooter" class="totalLine"></div>
      <div id="regimentsBottom" class="editorToolbar">
        <button id="regimentsOverviewRefresh" data-tip="Refresh the overview screen" class="icon-cw"></button>
        <button
          id="regimentsPercentage"
          data-tip="Toggle percentage / absolute values views"
          class="icon-percent"
        ></button>
        <button id="regimentsAddNew" data-tip="Add new Regiment" class="icon-user-plus"></button>
        <div data-tip="Select state" style="display: inline-block">
          <span>State: </span
          ><select id="regimentsFilter"></select>
        </div>
        <button
          id="regimentsExport"
          data-tip="Save military-related data as a text file (.csv)"
          class="icon-download"
        ></button>
      </div>
    </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
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
  ensureEl("regimentsFilter").addEventListener("change", event => {
    filterState.stateId = +(event.target as HTMLSelectElement).value;
    dialogState.set(dialogId, "filters", filterState);
    regimentsTable.reset();
  });

  body.addEventListener("click", async event => {
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
  const unitColumns: EditorColumn<RegimentRow>[] = options.military.map(unit => ({
    key: unitColumnKey(unit.name),
    label: capitalize(unit.name.replace(/_/g, " ")),
    width: "5em",
    mobileHidden: true,
    tip: `Regiment ${unit.name} units number. Click to sort`,
    sortBy: row => row.regiment.u[unit.name] || 0
  }));

  return [
    { key: "color", width: "1.2em", permanent: true },
    {
      key: "state",
      label: "State",
      width: "7em",
      permanent: true,
      sortBy: row => row.state.name || "",
      sortType: "alpha"
    },
    { key: "emblem", width: "1.2em" },
    {
      key: "name",
      label: "Name",
      width: "15em",
      permanent: true,
      sortBy: row => row.regiment.name || "",
      sortType: "alpha"
    },
    ...unitColumns,
    {
      key: "total",
      label: "Total",
      width: "5em",
      defaultSort: "desc",
      sortBy: row => row.regiment.a,
      tip: "Total military personnel (not considering crew). Click to sort"
    },
    { key: "actions", width: "1.4em", permanent: true, align: "right" }
  ];
}

function getRegimentsData(): RegimentRow[] {
  const rows: RegimentRow[] = [];
  for (const state of pack.states) {
    if (!state.i || state.removed || !state.military?.length) continue;
    if (filterState.stateId !== -1 && state.i !== filterState.stateId) continue;
    for (const regiment of state.military) rows.push({ state, regiment });
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
    options.military.map(unit => [unit.name, sum(view.all.map(row => row.regiment.u[unit.name] || 0))])
  );
  const total = sum(view.all.map(row => row.regiment.a));
  const percent = (value: number, all: number) => `${Math.round(all ? (value / all) * 100 : 0)}%`;

  const lines = view.rows
    .map(({ state, regiment }) => {
      const unitCells = options.military
        .map(unit => {
          const value = regiment.u[unit.name] || 0;
          return `<div data-col="${unitColumnKey(unit.name)}" data-tip="${capitalize(unit.name)} units number">${percentage ? percent(value, unitTotals[unit.name]) : value}</div>`;
        })
        .join("");
      const emblem =
        regiment.icon!.startsWith("http") || regiment.icon!.startsWith("data:image")
          ? `<img data-col="emblem" src="${regiment.icon}" data-tip="Regiment's emblem">`
          : `<span data-col="emblem" data-tip="Regiment's emblem">${regiment.icon}</span>`;

      return /* html */ `<div class="states" data-id="${regiment.i}" data-s="${state.i}">
        <fill-box data-col="color" data-tip="${state.fullName}" fill="${state.color}" disabled></fill-box>
        <input data-col="state" data-tip="${state.fullName}" value="${state.name}" readonly />
        ${emblem}
        <input data-col="name" data-tip="Regiment's name" value="${regiment.name}" readonly />
        ${unitCells}
        <div data-col="total" data-tip="Total military personnel (not considering crew)" style="font-weight:bold">${percentage ? percent(regiment.a, total) : regiment.a}</div>
        <div data-col="actions"><span data-tip="Edit regiment" data-edit-regiment="regiment${state.i}-${regiment.i}" class="icon-pencil pointer"></span></div>
      </div>`;
    })
    .join("");

  body.querySelectorAll(":scope > .states").forEach(line => {
    line.remove();
  });
  body.insertAdjacentHTML("beforeend", lines);

  const footer = ensureEl("regimentsFooter");
  footer.innerHTML = /* html */ `<div style="margin-left:4px">Regiments:&nbsp;${view.all.length}</div>
    ${options.military.map(unit => `<div data-col="${unitColumnKey(unit.name)}" style="margin-left:12px">${capitalize(unit.name)}:&nbsp;${si(unitTotals[unit.name])}</div>`).join("")}
    <div data-col="total" style="margin-left:12px">Total:&nbsp;${si(total)}</div>`;
  renderEditorPagination(footer, view, regimentsTable.goto);

  body.querySelectorAll<HTMLElement>(":scope > .states").forEach(line => {
    line.addEventListener("mouseenter", regimentHighlightOn);
    line.addEventListener("mouseleave", regimentHighlightOff);
  });
  updateDialog(dialogId, { width: "fit-content", position });
}

function updateFilter(): void {
  if (filterState.stateId !== -1 && !pack.states.some(s => s.i === filterState.stateId && !s.removed)) {
    filterState.stateId = -1;
  }
  const filter = ensureEl<HTMLSelectElement>("regimentsFilter");
  filter.options.length = 0; // remove all options
  filter.options.add(new Option("all", "-1", false, filterState.stateId === -1));
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
    tip("Click on map to create new regiment or fleet", true);
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
    tip("Please select state from the list", false, "error");
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
    icon: "🛡️",
    name: "",
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
  const units = options.military.map(u => u.name);
  let data = `State,Id,Icon,Name,${units.map(u => capitalize(u)).join(",")},X,Y,Latitude,Longitude,Base X,Base Y,Base Latitude,Base Longitude\n`; // headers

  for (const s of pack.states) {
    if (!s.i || s.removed || !s.military?.length) continue;

    for (const r of s.military) {
      data += `${s.name},`;
      data += `${r.i},`;
      data += `${r.icon},`;
      data += `${r.name},`;
      data += `${units.map(unit => r.u[unit]).join(",")},`;

      data += `${r.x},`;
      data += `${r.y},`;
      data += `${getLatitude(r.y, mapCoordinates, graphHeight, 2)},`;
      data += `${getLongitude(r.x, mapCoordinates, graphWidth, 2)},`;

      data += `${r.bx},`;
      data += `${r.by},`;
      data += `${getLatitude(r.by, mapCoordinates, graphHeight, 2)},`;
      data += `${getLongitude(r.bx, mapCoordinates, graphWidth, 2)}\n`;
    }
  }

  const name = `${getFileName("Regiments")}.csv`;
  downloadFile(data, name);
}

export const RegimentsOverview = { open };
