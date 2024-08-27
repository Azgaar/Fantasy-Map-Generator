"use strict";

function editZones() {
  closeDialogs();
  if (!layerIsOn("toggleZones")) toggleZones();
  const body = byId("zonesBodySection");

  updateFilters();
  zonesEditorAddLines();

  if (modules.editZones) return;
  modules.editZones = true;

  $("#zonesEditor").dialog({
    title: "Zones Editor",
    resizable: false,
    close: () => exitZonesManualAssignment("close"),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  byId("zonesFilterType").on("click", updateFilters);
  byId("zonesFilterType").on("change", filterZonesByType);
  byId("zonesEditorRefresh").on("click", zonesEditorAddLines);
  byId("zonesEditStyle").on("click", () => editStyle("zones"));
  byId("zonesLegend").on("click", toggleLegend);
  byId("zonesPercentage").on("click", togglePercentageMode);
  byId("zonesManually").on("click", enterZonesManualAssignent);
  byId("zonesManuallyApply").on("click", applyZonesManualAssignent);
  byId("zonesManuallyCancel").on("click", cancelZonesManualAssignent);
  byId("zonesAdd").on("click", addZonesLayer);
  byId("zonesExport").on("click", downloadZonesData);
  byId("zonesRemove").on("click", toggleEraseMode);

  body.on("click", function (ev) {
    const el = ev.target,
      cl = el.classList,
      zone = el.parentNode.dataset.id;
    if (el.tagName === "FILL-BOX") changeFill(el);
    else if (cl.contains("culturePopulation")) changePopulation(zone);
    else if (cl.contains("icon-trash-empty")) zoneRemove(zone);
    else if (cl.contains("icon-eye")) toggleVisibility(el);
    else if (cl.contains("icon-pin")) toggleFog(zone, cl);
    if (customization) selectZone(el);
  });

  body.on("input", function (ev) {
    const el = ev.target;
    const zone = zones.select("#" + el.parentNode.dataset.id);

    if (el.classList.contains("zoneName")) zone.attr("data-description", el.value);
    else if (el.classList.contains("zoneType")) zone.attr("data-type", el.value);
  });

  // update type filter with a list of used types
  function updateFilters() {
    const types = unique(pack.zones.map(zone => zone.type));

    const filterSelect = byId("zonesFilterType");
    const typeToFilterBy = types.includes(zonesFilterType.value) ? zonesFilterType.value : "all";

    filterSelect.innerHTML =
      "<option value='all'>all</option>" + types.map(type => `<option value="${type}">${type}</option>`).join("");
    filterSelect.value = typeToFilterBy;
  }

  // add line for each zone
  function zonesEditorAddLines() {
    const unit = " " + getAreaUnit();

    const typeToFilterBy = byId("zonesFilterType").value;
    const filteredZones =
      typeToFilterBy === "all" ? pack.zones : pack.zones.filter(zone => zone.type === typeToFilterBy);

    const lines = filteredZones.map(({i, name, type, cells, color, hidden}) => {
      const area = getArea(d3.sum(cells.map(i => pack.cells.area[i])));
      const rural = d3.sum(cells.map(i => pack.cells.pop[i])) * populationRate;
      const urban =
        d3.sum(cells.map(i => pack.cells.burg[i]).map(b => pack.burgs[b].population)) * populationRate * urbanization;
      const population = rural + urban;
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(
        rural
      )}; Urban population: ${si(urban)}. Click to change`;
      const focused = defs.select("#fog #focusZone" + i).size();

      return `<div class="states" data-id="zone${i}" data-fill="${color}" data-description="${name}"
        data-type="${type}" data-cells=${cells.length} data-area=${area} data-population=${population}>
        <fill-box fill="${color}"></fill-box>
        <input data-tip="Zone description. Click and type to change" style="width: 11em" class="zoneName" value="${name}" autocorrect="off" spellcheck="false">
        <input data-tip="Zone type. Click and type to change" class="zoneType" value="${type}">
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="stateCells hide">${cells.length}</div>
        <span data-tip="Zone area" style="padding-right:4px" class="icon-map-o hide"></span>
        <div data-tip="Zone area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
        <span data-tip="Drag to raise or lower the zone" class="icon-resize-vertical hide"></span>
        <span data-tip="Toggle zone focus" class="icon-pin ${focused ? "" : " inactive"} hide ${
        cells.length ? "" : " placeholder"
      }"></span>
        <span data-tip="Toggle zone visibility" class="icon-eye ${hidden ? " inactive" : ""} hide ${
        cells.length ? "" : " placeholder"
      }"></span>
        <span data-tip="Remove zone" class="icon-trash-empty hide"></span>
      </div>`;
    });

    body.innerHTML = lines.join("");

    // update footer
    const totalArea = getArea(graphWidth * graphHeight);
    zonesFooterArea.dataset.area = totalArea;
    const totalPop =
      (d3.sum(pack.cells.pop) + d3.sum(pack.burgs.filter(b => !b.removed).map(b => b.population)) * urbanization) *
      populationRate;
    zonesFooterPopulation.dataset.population = totalPop;
    zonesFooterNumber.innerHTML = `${filteredZones.length} of ${zones.length}`;
    zonesFooterCells.innerHTML = pack.cells.i.length;
    zonesFooterArea.innerHTML = si(totalArea) + unit;
    zonesFooterPopulation.innerHTML = si(totalPop);

    body.querySelectorAll("div.states").forEach(el => el.on("mouseenter", zoneHighlightOn));
    body.querySelectorAll("div.states").forEach(el => el.on("mouseleave", zoneHighlightOff));

    if (body.dataset.type === "percentage") {
      body.dataset.type = "absolute";
      togglePercentageMode();
    }
    $("#zonesEditor").dialog({width: fitContent()});
  }

  function zoneHighlightOn(event) {
    const zone = event.target.dataset.id;
    zones.select("#" + zone).style("outline", "1px solid red");
  }

  function zoneHighlightOff(event) {
    const zone = event.target.dataset.id;
    zones.select("#" + zone).style("outline", null);
  }

  function filterZonesByType() {
    const typeToFilterBy = this.value;
    const zones = Array.from(document.querySelectorAll("#zones > g"));

    for (const zone of zones) {
      const type = zone.dataset.type;
      const visible = typeToFilterBy === "all" || type === typeToFilterBy;
      zone.style.display = visible ? "block" : "none";
    }

    zonesEditorAddLines();
  }

  $(body).sortable({
    items: "div.states",
    handle: ".icon-resize-vertical",
    containment: "parent",
    axis: "y",
    update: movezone
  });

  function movezone(_ev, ui) {
    const zone = $("#" + ui.item.attr("data-id"));
    const prev = $("#" + ui.item.prev().attr("data-id"));
    if (prev) {
      zone.insertAfter(prev);
      return;
    }
    const next = $("#" + ui.item.next().attr("data-id"));
    if (next) zone.insertBefore(next);
  }

  function enterZonesManualAssignent() {
    if (!layerIsOn("toggleZones")) toggleZones();
    customization = 10;
    document.querySelectorAll("#zonesBottom > *").forEach(el => (el.style.display = "none"));
    byId("zonesManuallyButtons").style.display = "inline-block";

    zonesEditor.querySelectorAll(".hide").forEach(el => el.classList.add("hidden"));
    zonesFooter.style.display = "none";
    body.querySelectorAll("div > input, select, svg").forEach(e => (e.style.pointerEvents = "none"));
    $("#zonesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    tip("Click to select a zone, drag to paint a zone", true);
    viewbox
      .style("cursor", "crosshair")
      .on("click", selectZoneOnMapClick)
      .call(d3.drag().on("start", dragZoneBrush))
      .on("touchmove mousemove", moveZoneBrush);

    body.querySelector("div").classList.add("selected");
    zones.selectAll("g").each(function () {
      this.setAttribute("data-init", this.getAttribute("data-cells"));
    });
  }

  function selectZone(el) {
    body.querySelector("div.selected").classList.remove("selected");
    el.classList.add("selected");
  }

  function selectZoneOnMapClick() {
    if (d3.event.target.parentElement.parentElement.id !== "zones") return;
    const zone = d3.event.target.parentElement.id;
    const el = body.querySelector("div[data-id='" + zone + "']");
    selectZone(el);
  }

  function dragZoneBrush() {
    const radius = +byId("zonesBrush").value;
    const eraseMode = byId("zonesRemove").classList.contains("pressed");
    const landOnly = byId("zonesBrushLandOnly").checked;

    const selected = body.querySelector("div.selected");
    const zone = zones.select("#" + selected.dataset.id);
    const base = zone.attr("id") + "_"; // id generic part

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const [x, y] = d3.mouse(this);
      moveCircle(x, y, radius);

      let selection = radius > 5 ? findAll(x, y, radius) : [findCell(x, y, radius)];
      if (landOnly) selection = selection.filter(i => pack.cells.h[i] >= 20);
      if (!selection) return;

      const dataCells = zone.attr("data-cells");
      let cells = dataCells ? dataCells.split(",").map(i => +i) : [];

      if (eraseMode) {
        // remove
        selection.forEach(i => {
          const index = cells.indexOf(i);
          if (index === -1) return;
          zone.select("polygon#" + base + i).remove();
          cells.splice(index, 1);
        });
      } else {
        // add
        selection.forEach(i => {
          if (cells.includes(i)) return;
          cells.push(i);
          zone
            .append("polygon")
            .attr("points", getPackPolygon(i))
            .attr("id", base + i);
        });
      }

      zone.attr("data-cells", cells);
    });
  }

  function moveZoneBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +zonesBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyZonesManualAssignent() {
    zones.selectAll("g").each(function () {
      if (this.dataset.cells) return;
      // all zone cells are removed
      unfog("focusZone" + this.id);
      this.style.display = "block";
    });

    zonesEditorAddLines();
    exitZonesManualAssignment();
  }

  // restore initial zone cells
  function cancelZonesManualAssignent() {
    zones.selectAll("g").each(function () {
      const zone = d3.select(this);
      const dataCells = zone.attr("data-init");
      const cells = dataCells ? dataCells.split(",").map(i => +i) : [];
      zone.attr("data-cells", cells);
      zone.selectAll("*").remove();
      const base = zone.attr("id") + "_"; // id generic part
      zone
        .selectAll("*")
        .data(cells)
        .enter()
        .append("polygon")
        .attr("points", d => getPackPolygon(d))
        .attr("id", d => base + d);
    });

    exitZonesManualAssignment();
  }

  function exitZonesManualAssignment(close) {
    customization = 0;
    removeCircle();
    document.querySelectorAll("#zonesBottom > *").forEach(el => (el.style.display = "inline-block"));
    byId("zonesManuallyButtons").style.display = "none";

    zonesEditor.querySelectorAll(".hide:not(.show)").forEach(el => el.classList.remove("hidden"));
    zonesFooter.style.display = "block";
    body.querySelectorAll("div > input, select, svg").forEach(e => (e.style.pointerEvents = "all"));
    if (!close)
      $("#zonesEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

    restoreDefaultEvents();
    clearMainTip();
    zones.selectAll("g").each(function () {
      this.removeAttribute("data-init");
    });
    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function changeFill(el) {
    const fill = el.getAttribute("fill");
    const callback = newFill => {
      el.fill = newFill;
      byId(el.parentNode.dataset.id).setAttribute("fill", newFill);
    };

    openPicker(fill, callback);
  }

  function toggleVisibility(el) {
    const zone = zones.select("#" + el.parentNode.dataset.id);
    const inactive = zone.style("display") === "none";
    inactive ? zone.style("display", "block") : zone.style("display", "none");
    el.classList.toggle("inactive");
  }

  function toggleFog(z, cl) {
    const dataCells = zones.select("#" + z).attr("data-cells");
    if (!dataCells) return;

    const path =
        "M" +
        dataCells
          .split(",")
          .map(c => getPackPolygon(+c))
          .join("M") +
        "Z",
      id = "focusZone" + z;
    cl.contains("inactive") ? fog(id, path) : unfog(id);
    cl.toggle("inactive");
  }

  function toggleLegend() {
    if (legend.selectAll("*").size()) {
      clearLegend();
      return;
    } // hide legend
    const data = [];

    zones.selectAll("g").each(function () {
      const id = this.dataset.id;
      const description = this.dataset.description;
      const fill = this.getAttribute("fill");
      data.push([id, fill, description]);
    });

    drawLegend("Zones", data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === "absolute") {
      body.dataset.type = "percentage";
      const totalCells = +zonesFooterCells.innerHTML;
      const totalArea = +zonesFooterArea.dataset.area;
      const totalPopulation = +zonesFooterPopulation.dataset.population;

      body.querySelectorAll(":scope > div").forEach(function (el) {
        el.querySelector(".stateCells").innerHTML = rn((+el.dataset.cells / totalCells) * 100, 2) + "%";
        el.querySelector(".biomeArea").innerHTML = rn((+el.dataset.area / totalArea) * 100, 2) + "%";
        el.querySelector(".culturePopulation").innerHTML =
          rn((+el.dataset.population / totalPopulation) * 100, 2) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      zonesEditorAddLines();
    }
  }

  function addZonesLayer() {
    const id = getNextId("zone");
    const description = "Unknown zone";
    const type = "Unknown";
    const fill = "url(#hatch" + (id.slice(4) % 42) + ")";
    zones
      .append("g")
      .attr("id", id)
      .attr("data-description", description)
      .attr("data-type", type)
      .attr("data-cells", "")
      .attr("fill", fill);

    zonesEditorAddLines();
  }

  function downloadZonesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,Fill,Description,Type,Cells,Area " + unit + ",Population\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      data += el.dataset.id + ",";
      data += el.dataset.fill + ",";
      data += el.dataset.description + ",";
      data += el.dataset.type + ",";
      data += el.dataset.cells + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const name = getFileName("Zones") + ".csv";
    downloadFile(data, name);
  }

  function toggleEraseMode() {
    this.classList.toggle("pressed");
  }

  function changePopulation(zone) {
    const dataCells = zones.select("#" + zone).attr("data-cells");
    const cells = dataCells
      ? dataCells
          .split(",")
          .map(i => +i)
          .filter(i => pack.cells.h[i] >= 20)
      : [];
    if (!cells.length) {
      tip("Zone does not have any land cells, cannot change population", false, "error");
      return;
    }
    const burgs = pack.burgs.filter(b => !b.removed && cells.includes(b.cell));

    const rural = rn(d3.sum(cells.map(i => pack.cells.pop[i])) * populationRate);
    const urban = rn(
      d3.sum(cells.map(i => pack.cells.burg[i]).map(b => pack.burgs[b].population)) * populationRate * urbanization
    );
    const total = rural + urban;
    const l = n => Number(n).toLocaleString();

    alertMessage.innerHTML = /* html */ `Rural: <input type="number" min="0" step="1" id="ruralPop" value=${rural} style="width:6em" /> Urban:
      <input type="number" min="0" step="1" id="urbanPop" value=${urban} style="width:6em" ${
      burgs.length ? "" : "disabled"
    } />
      <p>Total population: ${l(total)} ⇒ <span id="totalPop">${l(
      total
    )}</span> (<span id="totalPopPerc">100</span>%)</p>`;

    const update = function () {
      const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
      if (isNaN(totalNew)) return;
      totalPop.innerHTML = l(totalNew);
      totalPopPerc.innerHTML = rn((totalNew / total) * 100);
    };

    ruralPop.oninput = () => update();
    urbanPop.oninput = () => update();

    $("#alert").dialog({
      resizable: false,
      title: "Change zone population",
      width: "24em",
      buttons: {
        Apply: function () {
          applyPopulationChange();
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      },
      position: {my: "center", at: "center", of: "svg"}
    });

    function applyPopulationChange() {
      const ruralChange = ruralPop.value / rural;
      if (isFinite(ruralChange) && ruralChange !== 1) {
        cells.forEach(i => (pack.cells.pop[i] *= ruralChange));
      }
      if (!isFinite(ruralChange) && +ruralPop.value > 0) {
        const points = ruralPop.value / populationRate;
        const pop = rn(points / cells.length);
        cells.forEach(i => (pack.cells.pop[i] = pop));
      }

      const urbanChange = urbanPop.value / urban;
      if (isFinite(urbanChange) && urbanChange !== 1) {
        burgs.forEach(b => (b.population = rn(b.population * urbanChange, 4)));
      }
      if (!isFinite(urbanChange) && +urbanPop.value > 0) {
        const points = urbanPop.value / populationRate / urbanization;
        const population = rn(points / burgs.length, 4);
        burgs.forEach(b => (b.population = population));
      }

      zonesEditorAddLines();
    }
  }

  function zoneRemove(zone) {
    zones.select("#" + zone).remove();
    unfog("focusZone" + zone);
    zonesEditorAddLines();
  }
}
