import { mean } from "d3";
import { Controllers } from "@/controllers";
import type { Route } from "@/generators/routes-generator";
import { ensureEl, rn } from "../utils";

let isInitialized = false;

function overviewRoutes(): void {
  if (customization) return;
  closeDialogs("#routesOverview, .stable");
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  routesOverviewAddLines();
  $("#routesOverview").dialog();

  if (isInitialized) return;
  isInitialized = true;

  $("#routesOverview").dialog({
    title: "Routes Overview",
    resizable: false,
    width: fitContent(),
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  // add listeners
  ensureEl("routesOverviewRefresh").on("click", routesOverviewAddLines);
  ensureEl("routesCreateNew").on("click", () => void Controllers.RouteCreator.open());
  ensureEl("routesExport").on("click", downloadRoutesData);
  ensureEl("routesLockAll").on("click", toggleLockAll);
  ensureEl("routesRemoveAll").on("click", triggerAllRoutesRemove);
  ensureEl("routesSearch").on("input", routesOverviewAddLines);
}

// add line for each route
function routesOverviewAddLines(): void {
  const body = ensureEl("routesBody");
  body.innerHTML = "";
  let lines = "";

  let filteredRoutes: Route[] = pack.routes;

  const searchText = ensureEl<HTMLInputElement>("routesSearch").value.toLowerCase().trim();
  if (searchText) {
    filteredRoutes = filteredRoutes.filter(route => {
      const name = (route.name || "").toLowerCase();
      const group = (route.group || "").toLowerCase();
      return name.includes(searchText) || group.includes(searchText);
    });
  }

  for (const route of filteredRoutes) {
    if (!route.points || route.points.length < 2) continue;
    route.name = route.name || Routes.generateName(route);
    route.length = route.length || Routes.getLength(route.i);
    const length = `${rn(route.length * distanceScale)} ${distanceUnitInput.value}`;

    lines += /* html */ `<div
        class="states"
        data-id="${route.i}"
        data-name="${route.name}"
        data-group="${route.group}"
        data-length="${route.length}"
      >
        <span data-tip="Locate the route" class="icon-target"></span>
        <div data-tip="Route name" style="width: 15em; margin-left: 0.4em;">${route.name}</div>
        <div data-tip="Route group" style="width: 8em;">${route.group}</div>
        <div data-tip="Route length" style="width: 6em;">${length}</div>
        <span data-tip="Edit route" class="icon-pencil"></span>
        <span class="locks pointer ${
          route.lock ? "icon-lock" : "icon-lock-open inactive"
        }" onmouseover="showElementLockTip(event)"></span>
        <span data-tip="Remove route" class="icon-trash-empty"></span>
      </div>`;
  }
  body.insertAdjacentHTML("beforeend", lines);

  // update footer
  ensureEl("routesFooterNumber").innerHTML = `${filteredRoutes.length} of ${pack.routes.length}`;
  const averageLength = rn(mean(filteredRoutes.map(r => r.length)) || 0) || 0;
  ensureEl("routesFooterLength").innerHTML = `${averageLength * distanceScale} ${distanceUnitInput.value}`;

  // add listeners
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseenter", routeHighlightOn));
  body.querySelectorAll("div.states").forEach(el => void el.on("mouseleave", routeHighlightOff));
  body.querySelectorAll("div > span.icon-target").forEach(el => void el.on("click", zoomToRoute));
  body.querySelectorAll("div > span.icon-pencil").forEach(el => void el.on("click", openRouteEditor));
  body.querySelectorAll("div > span.locks").forEach(el => void el.on("click", toggleLockStatus));
  body.querySelectorAll("div > span.icon-trash-empty").forEach(el => void el.on("click", triggerRouteRemove));

  applySorting(ensureEl("routesHeader"));
}

function routeHighlightOn(event: Event): void {
  if (!layerIsOn("toggleRoutes")) toggleRoutes();
  const routeId = +(event.target as HTMLElement).dataset.id!;
  routes.select(`#route${routeId}`).attr("stroke", "red").attr("stroke-width", 2).attr("stroke-dasharray", "none");
}

function routeHighlightOff(e: Event): void {
  const routeId = +(e.target as HTMLElement).dataset.id!;
  routes.select(`#route${routeId}`).attr("stroke", null).attr("stroke-width", null).attr("stroke-dasharray", null);
}

function zoomToRoute(this: HTMLElement): void {
  const routeId = +(this.parentNode as HTMLElement).dataset.id!;
  const route = routes.select(`#route${routeId}`).node() as Element;
  highlightElement(route, 3);
}

function downloadRoutesData(): void {
  let data = "Id,Route,Group,Length\n"; // headers

  ensureEl("routesBody")
    .querySelectorAll<HTMLElement>(":scope > div")
    .forEach(el => {
      const d = el.dataset;
      const length = `${rn(+d.length! * distanceScale)} ${distanceUnitInput.value}`;
      data += `${[d.id, d.name, d.group, length].join(",")}\n`;
    });

  const name = `${getFileName("Routes")}.csv`;
  downloadFile(data, name);
}

function openRouteEditor(this: HTMLElement): void {
  const routeId = `route${(this.parentNode as HTMLElement).dataset.id}`;
  void Controllers.RouteEditor.open(routeId);
}

function toggleLockStatus(this: HTMLElement): void {
  const routeId = +(this.parentNode as HTMLElement).dataset.id!;
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

  routesOverviewAddLines();
  ensureEl("routesLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
}

function triggerRouteRemove(this: HTMLElement): void {
  const routeId = +(this.parentNode as HTMLElement).dataset.id!;
  confirmationDialog({
    title: "Remove route",
    message: "Are you sure you want to remove the route? <br>This action cannot be reverted",
    confirm: "Remove",
    onConfirm: () => {
      const route = pack.routes.find((r: Route) => r.i === routeId) as Route;
      Routes.remove(route);
      routesOverviewAddLines();
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
        routesOverviewAddLines();
        $(this).dialog("close");
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

export const RoutesOverview = { open: overviewRoutes };
