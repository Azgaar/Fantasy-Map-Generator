import { mean, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog, updateDialog } from "@/components/dialog/dialog-helpers";
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
import { tip } from "@/components/tooltips";
import { Controllers } from "@/controllers";
import { type Route, UNNAMED_ROUTE } from "@/generators/routes-generator";
import { highlightElement } from "@/renderers/overlays/highlight";
import { downloadFile, getFileName } from "@/utils";
import { ensureEl, rn } from "../utils";

const dialogId = "routesOverview" as const;
const position = { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" };
let filterState: { search: string };

const columns: EditorColumn<Route>[] = [
  { key: "locate", width: "1.4em", permanent: true },
  {
    key: "name",
    label: "Route",
    width: "15em",
    permanent: true,
    sortBy: route => route.name || "",
    sortType: "alpha"
  },
  {
    key: "group",
    label: "Group",
    width: "7em",
    sortBy: route => route.group || "",
    sortType: "alpha"
  },
  {
    key: "length",
    label: "Length",
    width: "6em",
    sortBy: route => route.length || 0,
    defaultSort: "desc"
  },
  { key: "actions", width: "3.2em", permanent: true, align: "right" }
];

function getFilteredRoutes(): Route[] {
  const searchText = filterState.search.toLowerCase().trim();
  const routes = pack.routes.filter((route: Route) => Boolean(route.points) && route.points.length >= 2);

  for (const route of routes) {
    route.name = route.name || Routes.generateName(route) || UNNAMED_ROUTE;
    route.length = route.length || Routes.getLength(route.i);
  }

  if (!searchText) return routes;

  return routes.filter((route: Route) => {
    const name = (route.name || "").toLowerCase();
    const group = (route.group || "").toLowerCase();
    return name.includes(searchText) || group.includes(searchText);
  });
}

const routesTable = initEditorTable<Route>({
  getData: () => sortDataByColumns(dialogId, getFilteredRoutes(), columns),
  onUpdate: renderRoutesPage
});

function open(): void {
  if (customization) return;
  filterState = dialogState.get(dialogId, "filters", () => ({ search: "" }));
  closeDialogs(`#${dialogId}, .stable`);
  Layers.show("routes");

  renderDialog();
  routesTable.reset();

  $(`#${dialogId}`).dialog({
    title: "Routes Overview",
    resizable: false,
    width: "fit-content",
    position,
    close: closeRoutesOverview
  });
}

function renderDialog(): void {
  destroyDialog("routesOverview");

  const html = /* html */ `<div id="routesOverview" class="dialog stable editorDialog">
    <div id="routesBody" class="table">${renderEditorHeader({ dialogId, columns })}</div>
    <div id="routesFilters" class="editorFilters">
      <label for="routesSearch" data-tip="Filter by name or group">Search: <input id="routesSearch" type="search" /></label>
    </div>
    <div id="routesFooter" class="totalLine">
      <div data-tip="Routes number" style="margin-left: 4px">Routes:&nbsp;<span id="routesFooterNumber">0</span></div>
      <div data-tip="Average length" style="margin-left: 12px" data-col="length">Average length:&nbsp;<span id="routesFooterLength">0</span></div>
    </div>
    <div id="routesBottom" class="editorToolbar">
      <button id="routesOverviewRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="routesCreateNew" data-tip="Create a new route selecting route cells" class="icon-map-pin"></button>
      <button id="routesExport" data-tip="Save routes-related data as a text file (.csv)" class="icon-download"></button>
      <button id="routesLockAll" data-tip="Lock or unlock all routes" class="icon-lock"></button>
      <button id="routesRemoveAll" data-tip="Remove all unlocked routes (locked routes are kept)" class="icon-trash"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
  ensureEl<HTMLInputElement>("routesSearch").value = filterState.search;
  bindColumnSorting(dialogId, routesTable.reset);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("routesOverviewRefresh").addEventListener("click", routesTable.refresh);
  initColumnVisibility({
    dialogId,
    columns,
    onUpdate: () => updateDialog(dialogId, { width: "fit-content", position })
  });
  ensureEl("routesCreateNew").addEventListener("click", createNewRoute);
  ensureEl("routesExport").addEventListener("click", downloadRoutesData);
  ensureEl("routesLockAll").addEventListener("click", toggleLockAll);
  ensureEl("routesRemoveAll").addEventListener("click", triggerAllRoutesRemove);
  ensureEl("routesSearch").addEventListener("input", event => {
    filterState.search = (event.target as HTMLInputElement).value;
    dialogState.set(dialogId, "filters", filterState);
    routesTable.reset();
  });
}

function closeRoutesOverview(): void {
  destroyDialog("routesOverview");
}

function createNewRoute(): void {
  Controllers.RouteCreator.open();
}

// totals span the full filtered set, not just the current page
function renderRoutesPage(view: TableView<Route>): void {
  const body = ensureEl("routesBody");
  body.querySelectorAll(".states").forEach(row => {
    row.remove();
  });
  let lines = "";

  for (const route of view.rows) {
    const length = `${rn((route.length || 0) * distanceScale)} ${distanceUnitInput.value}`;

    lines += /* html */ `<div
        class="states"
        data-id="${route.i}"
        data-name="${route.name}"
        data-group="${route.group}"
        data-length="${route.length}"
      >
        <span data-tip="Locate the route" class="icon-target" data-col="locate"></span>
        <div data-tip="Route name" data-col="name">${route.name}</div>
        <div data-tip="Route group" data-col="group">${route.group}</div>
        <div data-tip="Route length" data-col="length">${length}</div>
        <div data-col="actions">
          <span data-tip="Edit route" class="icon-pencil"></span>
          <span class="locks pointer ${
            route.lock ? "icon-lock" : "icon-lock-open inactive"
          }" onmouseover="showElementLockTip(event)"></span>
          <span data-tip="Remove route" class="icon-trash-empty"></span>
        </div>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  ensureEl("routesFooterNumber").innerHTML = `${view.all.length} of ${pack.routes.length}`;
  const averageLength = rn(mean(view.all.map(r => r.length)) || 0) || 0;
  ensureEl("routesFooterLength").innerHTML = `${averageLength * distanceScale} ${distanceUnitInput.value}`;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseenter", routeHighlightOn));
  body.querySelectorAll("div.states").forEach(el => void el.addEventListener("mouseleave", routeHighlightOff));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.addEventListener("click", zoomToRoute));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.addEventListener("click", openRouteEditor));
  body.querySelectorAll("div > span.locks").forEach(el => void el.addEventListener("click", toggleLockStatus));
  body
    .querySelectorAll("div > span.icon-trash-empty")
    .forEach(el => void el.addEventListener("click", triggerRouteRemove));

  renderEditorPagination(ensureEl("routesFooter"), view, routesTable.goto);
}

function routeHighlightOn(event: Event): void {
  Layers.show("routes");
  const routeId = +(event.target as HTMLElement).dataset.id!;
  select("#routes")
    .select(`#route${routeId}`)
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "none");
}

function routeHighlightOff(e: Event): void {
  const routeId = +(e.target as HTMLElement).dataset.id!;
  select("#routes")
    .select(`#route${routeId}`)
    .attr("stroke", null)
    .attr("stroke-width", null)
    .attr("stroke-dasharray", null);
}

function zoomToRoute(this: HTMLElement): void {
  const routeId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const route = select("#routes").select(`#route${routeId}`).node() as Element;
  highlightElement(route, 3);
}

function downloadRoutesData(): void {
  let data = "Id,Route,Group,Length\n"; // headers

  // export the full sorted+filtered set (all pages), not the DOM (which only holds the current page)
  const exported = routesTable.view().all;
  exported.forEach((route: Route) => {
    const length = `${rn((route.length || 0) * distanceScale)} ${distanceUnitInput.value}`;
    data += `${[route.i, route.name, route.group, length].join(",")}\n`;
  });

  const name = `${getFileName("Routes")}.csv`;
  downloadFile(data, name);
}

function openRouteEditor(this: HTMLElement): void {
  const routeId = `route${(this.closest(".states") as HTMLElement).dataset.id}`;
  void Controllers.RouteEditor.open(routeId);
}

function toggleLockStatus(this: HTMLElement): void {
  const routeId = +(this.closest(".states") as HTMLElement).dataset.id!;
  const route = pack.routes.find((route: Route) => route.i === routeId);
  if (!route) return;

  route.lock = !route.lock;
  if (this.classList.contains("icon-lock")) {
    this.classList.remove("icon-lock");
    this.classList.add("icon-lock-open");
    this.classList.add("inactive");
  } else {
    this.classList.remove("icon-lock-open");
    this.classList.add("icon-lock");
    this.classList.remove("inactive");
  }
}

function toggleLockAll(): void {
  const allLocked = pack.routes.every((route: Route) => route.lock);

  pack.routes.forEach((route: Route) => {
    route.lock = !allLocked;
  });

  routesTable.refresh();
  ensureEl("routesLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function triggerRouteRemove(this: HTMLElement): void {
  const routeId = +(this.closest(".states") as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "Remove route",
    message: "Are you sure you want to remove the route? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      const route = pack.routes.find((r: Route) => r.i === routeId) as Route;
      Routes.remove(route);
      Layers.draw("labels");
      routesTable.refresh();
    }
  });
}

function triggerAllRoutesRemove(): void {
  const toRemove = pack.routes.filter((route: Route) => !route.lock);
  if (!toRemove.length) {
    if (!pack.routes.length) {
      tip("There are no routes to remove", false, "error");
    } else {
      tip("All routes are locked. Unlock routes to remove them, or use Lock all to unlock first.", false, "error");
    }
    return;
  }

  const lockedCount = pack.routes.length - toRemove.length;
  alertMessage.innerHTML =
    lockedCount > 0
      ? /* html */ `Remove all <b>unlocked</b> routes (${toRemove.length})? <b>${lockedCount}</b> locked route(s) will be kept. This cannot be undone.`
      : /* html */ `Are you sure you want to remove all routes? This action can't be undone`;

  $("#alert").dialog({
    resizable: false,
    title: lockedCount > 0 ? "Remove unlocked routes" : "Remove all routes",
    buttons: {
      Remove: function (this: any) {
        const routesToRemove = pack.routes.filter((route: Route) => !route.lock);
        if (!routesToRemove.length) {
          if (!pack.routes.length) {
            tip("There are no routes to remove", false, "error");
          } else {
            tip("All routes are now locked; nothing was removed.", false, "error");
          }
          $(this).dialog("close");
          return;
        }
        for (const route of routesToRemove) {
          Routes.remove(route);
        }
        pack.cells.routes = Routes.buildLinks(pack.routes);
        Layers.draw("labels");
        routesTable.refresh();
        $(this).dialog("close");
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

export const RoutesOverview = { open };
