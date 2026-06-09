"use strict";

const routesPage = {page: 1};
const ROUTES_SORT_ACCESSORS = {
  name: route => route.name || "",
  group: route => route.group || "",
  length: route => route.length
};

function overviewRoutes() {
  if (customization) return;
  closeDialogs("#routesOverview, .stable");
  if (!layerIsOn("toggleRoutes")) toggleRoutes();

  const body = ensureEl("routesBody");
  routesPage.page = 1;
  routesOverviewAddLines();
  $("#routesOverview").dialog();

  if (modules.overviewRoutes) return;
  modules.overviewRoutes = true;

  $("#routesOverview").dialog({
    title: "Routes Overview",
    resizable: false,
    width: fitContent(),
    position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" }
  });

  // add listeners
  ensureEl("routesOverviewRefresh").on("click", routesOverviewAddLines);
  ensureEl("routesCreateNew").on("click", createRoute);
  ensureEl("routesExport").on("click", downloadRoutesData);
  ensureEl("routesLockAll").on("click", toggleLockAll);
  ensureEl("routesRemoveAll").on("click", triggerAllRoutesRemove);
  ensureEl("routesSearch").on("input", () => {
    routesPage.page = 1;
    routesOverviewAddLines();
  });
  bindEditorSortReset(ensureEl("routesHeader"), () => {
    routesPage.page = 1;
    routesOverviewAddLines();
  });

  // add line for each route
  function routesOverviewAddLines() {
    body.innerHTML = "";
    let lines = "";

    let filteredRoutes = pack.routes.slice(); // copy so cross-page sort never mutates pack.routes order

    // route name/length are computed lazily; populate them for the whole set so search,
    // sort, footer averages and CSV export are consistent across all pages, not just the visible one
    for (const route of filteredRoutes) {
      if (!route.points || route.points.length < 2) continue;
      route.name = route.name || Routes.generateName(route);
      route.length = route.length || Routes.getLength(route.i);
    }

    const searchText = ensureEl("routesSearch").value.toLowerCase().trim();
    if (searchText) {
      filteredRoutes = filteredRoutes.filter(route => {
        const name = (route.name || "").toLowerCase();
        const group = (route.group || "").toLowerCase();
        return name.includes(searchText) || group.includes(searchText);
      });
    }

    sortDataByActiveHeader(ensureEl("routesHeader"), filteredRoutes, ROUTES_SORT_ACCESSORS);
    const pageInfo = getEditorPage(filteredRoutes, routesPage);

    for (const route of pageInfo.items) {
      if (!route.points || route.points.length < 2) continue;
      const length = rn(route.length * distanceScale) + " " + distanceUnitInput.value;

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
    routesFooterNumber.innerHTML = `${filteredRoutes.length} of ${pack.routes.length}`;
    const averageLength = rn(d3.mean(filteredRoutes.map(r => r.length)) || 0) || 0;
    routesFooterLength.innerHTML = averageLength * distanceScale + " " + distanceUnitInput.value;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.on("mouseenter", routeHighlightOn));
    body.querySelectorAll("div.states").forEach(el => el.on("mouseleave", routeHighlightOff));
    body.querySelectorAll("div > span.icon-target").forEach(el => el.on("click", zoomToRoute));
    body.querySelectorAll("div > span.icon-pencil").forEach(el => el.on("click", openRouteEditor));
    body.querySelectorAll("div > span.locks").forEach(el => el.on("click", toggleLockStatus));
    body.querySelectorAll("div > span.icon-trash-empty").forEach(el => el.on("click", triggerRouteRemove));

    renderEditorPagination(ensureEl("routesFooter"), pageInfo, page => {
      routesPage.page = page;
      routesOverviewAddLines();
    });
  }

  function routeHighlightOn(event) {
    if (!layerIsOn("toggleRoutes")) toggleRoutes();
    const routeId = +event.target.dataset.id;
    routes
      .select("#route" + routeId)
      .attr("stroke", "red")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "none");
  }

  function routeHighlightOff(e) {
    const routeId = +e.target.dataset.id;
    routes
      .select("#route" + routeId)
      .attr("stroke", null)
      .attr("stroke-width", null)
      .attr("stroke-dasharray", null);
  }

  function zoomToRoute() {
    const routeId = +this.parentNode.dataset.id;
    const route = routes.select("#route" + routeId).node();
    highlightElement(route, 3);
  }

  function downloadRoutesData() {
    let data = "Id,Route,Group,Length\n"; // headers

    const searchText = ensureEl("routesSearch").value.toLowerCase().trim();
    const exported = pack.routes.filter(route => {
      if (!route.points || route.points.length < 2) return false; // skip degenerate routes (never rendered)
      if (!searchText) return true;
      const name = (route.name || "").toLowerCase();
      const group = (route.group || "").toLowerCase();
      return name.includes(searchText) || group.includes(searchText);
    });

    exported.forEach(function (route) {
      route.name = route.name || Routes.generateName(route);
      route.length = route.length || Routes.getLength(route.i);
      const length = rn(route.length * distanceScale) + " " + distanceUnitInput.value;
      data += [route.i, route.name, route.group, length].join(",") + "\n";
    });

    const name = getFileName("Routes") + ".csv";
    downloadFile(data, name);
  }

  function openRouteEditor() {
    const routeId = "route" + this.parentNode.dataset.id;
    editRoute(routeId);
  }

  function toggleLockStatus() {
    const routeId = +this.parentNode.dataset.id;
    const route = pack.routes.find(route => route.i === routeId);
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

  function toggleLockAll() {
    const allLocked = pack.routes.every(route => route.lock);

    pack.routes.forEach(route => {
      route.lock = !allLocked;
    });

    routesOverviewAddLines();
    ensureEl("routesLockAll").className = allLocked ? "icon-lock" : "icon-lock-open";
  }

  function triggerRouteRemove() {
    const routeId = +this.parentNode.dataset.id;
    confirmationDialog({
      title: "Remove route",
      message: "Are you sure you want to remove the route? <br>This action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => {
        const route = pack.routes.find(r => r.i === routeId);
        Routes.remove(route);
        routesOverviewAddLines();
      }
    });
  }

  function triggerAllRoutesRemove() {
    const toRemove = pack.routes.filter(route => !route.lock);
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
        Remove: function () {
          const routesToRemove = pack.routes.filter(route => !route.lock);
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
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }
}
