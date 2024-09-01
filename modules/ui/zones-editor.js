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
  byId("zonesRemove").on("click", e => e.target.classList.toggle("pressed"));

  body.on("click", function (ev) {
    const line = ev.target.closest("div.states");
    const zone = pack.zones.find(z => z.i === +line.dataset.id);
    if (!zone) return;

    if (customization) {
      if (zone.hidden) return;
      body.querySelector("div.selected").classList.remove("selected");
      line.classList.add("selected");
      return;
    }

    if (ev.target.closest("fill-box")) changeFill(ev.target.closest("fill-box").getAttribute("fill"), zone);
    else if (ev.target.classList.contains("zonePopulation")) changePopulation(zone);
    else if (ev.target.classList.contains("zoneRemove")) zoneRemove(zone);
    else if (ev.target.classList.contains("zoneHide")) toggleVisibility(zone);
    else if (ev.target.classList.contains("zoneFog")) toggleFog(zone, ev.target.classList);
  });

  body.on("input", function (ev) {
    const line = ev.target.closest("div.states");
    const zone = pack.zones.find(z => z.i === +line.dataset.id);
    if (!zone) return;

    if (ev.target.classList.contains("zoneName")) changeDescription(zone, ev.target.value);
    else if (ev.target.classList.contains("zoneType")) changeType(zone, ev.target.value);
  });

  // update type filter with a list of used types
  function updateFilters() {
    const filterSelect = byId("zonesFilterType");
    const types = unique(pack.zones.map(zone => zone.type));
    const typeToFilterBy = types.includes(zonesFilterType.value) ? zonesFilterType.value : "all";

    filterSelect.innerHTML =
      "<option value='all'>all</option>" + types.map(type => `<option value="${type}">${type}</option>`).join("");
    filterSelect.value = typeToFilterBy;
  }

  // add line for each zone
  function zonesEditorAddLines() {
    const typeToFilterBy = byId("zonesFilterType").value;
    const filteredZones =
      typeToFilterBy === "all" ? pack.zones : pack.zones.filter(zone => zone.type === typeToFilterBy);

    const lines = filteredZones.map(({i, name, type, cells, color, hidden}) => {
      const area = getArea(d3.sum(cells.map(i => pack.cells.area[i])));
      const rural = d3.sum(cells.map(i => pack.cells.pop[i])) * populationRate;
      const urban =
        d3.sum(cells.map(i => pack.cells.burg[i]).map(b => pack.burgs[b].population)) * populationRate * urbanization;
      const population = rn(rural + urban);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(
        rural
      )}; Urban population: ${si(urban)}. Click to change`;
      const focused = defs.select("#fog #focusZone" + i).size();

      return /* html */ `<div class="states" data-id="${i}" data-color="${color}" data-description="${name}"
        data-type="${type}" data-cells=${cells.length} data-area=${area} data-population=${population} style="${
        hidden && "opacity: 0.5"
      }">
        <fill-box fill="${color}"></fill-box>
        <input data-tip="Zone description. Click and type to change" style="width: 11em" class="zoneName" value="${name}" autocorrect="off" spellcheck="false">
        <input data-tip="Zone type. Click and type to change" class="zoneType" value="${type}">
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="stateCells hide">${cells.length}</div>
        <span data-tip="Zone area" style="padding-right:4px" class="icon-map-o hide"></span>
        <div data-tip="Zone area" class="biomeArea hide">${si(area) + " " + getAreaUnit()}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="zonePopulation hide pointer">${si(population)}</div>
        <span data-tip="Drag to raise or lower the zone" class="icon-resize-vertical hide"></span>
        <span data-tip="Toggle zone focus" class="zoneFog icon-pin ${focused ? "" : "inactive"} hide ${
        cells.length ? "" : "placeholder"
      }"></span>
        <span data-tip="Toggle zone visibility" class="zoneHide icon-eye hide ${
          cells.length ? "" : " placeholder"
        }"></span>
        <span data-tip="Remove zone" class="zoneRemove icon-trash-empty hide"></span>
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
    zonesFooterNumber.innerHTML = `${filteredZones.length} of ${pack.zones.length}`;
    zonesFooterCells.innerHTML = pack.cells.i.length;
    zonesFooterArea.innerHTML = si(totalArea) + " " + getAreaUnit();
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
    const zoneId = event.target.dataset.id;
    zones.select("#zone" + zoneId).style("outline", "1px solid red");
  }

  function zoneHighlightOff(event) {
    const zoneId = event.target.dataset.id;
    zones.select("#zone" + zoneId).style("outline", null);
  }

  function filterZonesByType() {
    drawZones();
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
    const zone = pack.zones.find(z => z.i === +ui.item[0].dataset.id);
    const oldIndex = pack.zones.indexOf(zone);
    const newIndex = ui.item.index();
    if (oldIndex === newIndex) return;

    pack.zones.splice(oldIndex, 1);
    pack.zones.splice(newIndex, 0, zone);
    drawZones();
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

    // draw zones as individual cells
    zones.selectAll("*").remove();

    const filterBy = byId("zonesFilterType").value;
    const isFiltered = filterBy && filterBy !== "all";
    const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
    const data = visibleZones.map(({i, cells, color}) => cells.map(cell => ({cell, zoneId: i, fill: color}))).flat();
    zones
      .selectAll("polygon")
      .data(data, d => `${d.zoneId}-${d.cell}`)
      .enter()
      .append("polygon")
      .attr("points", d => getPackPolygon(d.cell))
      .attr("fill", d => d.fill)
      .attr("data-zone", d => d.zoneId)
      .attr("data-cell", d => d.cell);
  }

  function selectZoneOnMapClick() {
    if (d3.event.target.parentElement.id !== "zones") return;
    const zoneId = d3.event.target.dataset.zone;
    const el = body.querySelector("div[data-id='" + zoneId + "']");

    body.querySelector("div.selected").classList.remove("selected");
    el.classList.add("selected");
  }

  function dragZoneBrush() {
    const radius = +byId("zonesBrush").value;
    const eraseMode = byId("zonesRemove").classList.contains("pressed");
    const landOnly = byId("zonesBrushLandOnly").checked;

    d3.event.on("drag", () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const [x, y] = d3.mouse(this);
      moveCircle(x, y, radius);

      let selection = radius > 5 ? findAll(x, y, radius) : [findCell(x, y)];
      if (landOnly) selection = selection.filter(i => pack.cells.h[i] >= 20);
      if (!selection.length) return;

      const zoneId = +body.querySelector("div.selected")?.dataset.id;
      const zone = pack.zones.find(z => z.i === zoneId);
      if (!zone) return;

      if (eraseMode) {
        const data = zones
          .selectAll("polygon")
          .data()
          .filter(d => !(d.zoneId === zoneId && selection.includes(d.cell)));
        zones
          .selectAll("polygon")
          .data(data, d => `${d.zoneId}-${d.cell}`)
          .exit()
          .remove();
      } else {
        const data = selection.map(cell => ({cell, zoneId, fill: zone.color}));
        zones
          .selectAll("polygon")
          .data(data, d => `${d.zoneId}-${d.cell}`)
          .enter()
          .append("polygon")
          .attr("points", d => getPackPolygon(d.cell))
          .attr("fill", d => d.fill)
          .attr("data-zone", d => d.zoneId)
          .attr("data-cell", d => d.cell);
      }
    });
  }

  function moveZoneBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +zonesBrush.value;
    moveCircle(...point, radius);
  }

  function applyZonesManualAssignent() {
    const data = zones.selectAll("polygon").data();
    const zoneCells = data.reduce((acc, d) => {
      if (!acc[d.zoneId]) acc[d.zoneId] = [];
      acc[d.zoneId].push(d.cell);
      return acc;
    }, {});

    const filterBy = byId("zonesFilterType").value;
    const isFiltered = filterBy && filterBy !== "all";
    const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
    visibleZones.forEach(zone => (zone.cells = zoneCells[zone.i] || []));

    drawZones();
    zonesEditorAddLines();
    exitZonesManualAssignment();
  }

  function cancelZonesManualAssignent() {
    drawZones();
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

    const selected = body.querySelector("div.selected");
    if (selected) selected.classList.remove("selected");
  }

  function changeFill(fill, zone) {
    const callback = newFill => {
      zone.color = newFill;
      drawZones();
      zonesEditorAddLines();
    };

    openPicker(fill, callback);
  }

  function toggleVisibility(zone) {
    const isHidden = Boolean(zone.hidden);
    if (isHidden) delete zone.hidden;
    else zone.hidden = true;

    drawZones();
    zonesEditorAddLines();
  }

  function toggleFog(zone, cl) {
    const inactive = cl.contains("inactive");
    cl.toggle("inactive");

    if (inactive) {
      const path = zones.select("#zone" + zone.i).attr("d");
      fog("focusZone" + zone.i, path);
    } else {
      unfog("focusZone" + zone.i);
    }
  }

  function toggleLegend() {
    const filterBy = byId("zonesFilterType").value;
    const isFiltered = filterBy && filterBy !== "all";
    const visibleZones = pack.zones.filter(zone => !zone.hidden && (!isFiltered || zone.type === filterBy));
    const data = visibleZones.map(({i, name, color}) => ["zone" + i, color, name]);
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
        el.querySelector(".zonePopulation").innerHTML = rn((+el.dataset.population / totalPopulation) * 100, 2) + "%";
      });
    } else {
      body.dataset.type = "absolute";
      zonesEditorAddLines();
    }
  }

  function addZonesLayer() {
    const zoneId = pack.zones.length ? Math.max(...pack.zones.map(z => z.i)) + 1 : 0;
    const name = "Unknown zone";
    const type = "Unknown";
    const color = "url(#hatch" + (zoneId % 42) + ")";
    pack.zones.push({i: zoneId, name, type, color, cells: []});

    zonesEditorAddLines();
    drawZones();
  }

  function downloadZonesData() {
    const unit = areaUnit.value === "square" ? distanceUnitInput.value + "2" : areaUnit.value;
    let data = "Id,Color,Description,Type,Cells,Area " + unit + ",Population\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function (el) {
      data += el.dataset.id + ",";
      data += el.dataset.color + ",";
      data += el.dataset.description + ",";
      data += el.dataset.type + ",";
      data += el.dataset.cells + ",";
      data += el.dataset.area + ",";
      data += el.dataset.population + "\n";
    });

    const name = getFileName("Zones") + ".csv";
    downloadFile(data, name);
  }

  function changeDescription(zone, value) {
    zone.name = value;
    zones.select("#zone" + zone.i).attr("data-description", value);
  }

  function changeType(zone, value) {
    zone.type = value;
    zones.select("#zone" + zone.i).attr("data-type", value);
  }

  function changePopulation(zone) {
    const landCells = zone.cells.filter(i => pack.cells.h[i] >= 20);
    if (!landCells.length) return tip("Zone does not have any land cells, cannot change population", false, "error");

    const burgs = pack.burgs.filter(b => !b.removed && landCells.includes(b.cell));
    const rural = rn(d3.sum(landCells.map(i => pack.cells.pop[i])) * populationRate);
    const urban = rn(
      d3.sum(landCells.map(i => pack.cells.burg[i]).map(b => pack.burgs[b].population)) * populationRate * urbanization
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
        landCells.forEach(i => (pack.cells.pop[i] *= ruralChange));
      }
      if (!isFinite(ruralChange) && +ruralPop.value > 0) {
        const points = ruralPop.value / populationRate;
        const pop = rn(points / landCells.length);
        landCells.forEach(i => (pack.cells.pop[i] = pop));
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
    confirmationDialog({
      title: "Remove zone",
      message: "Are you sure you want to remove the zone? <br>This action cannot be reverted",
      confirm: "Remove",
      onConfirm: () => {
        pack.zones = pack.zones.filter(z => z.i !== zone.i);
        zones.select("#zone" + zone.i).remove();
        unfog("focusZone" + zone.i);
        zonesEditorAddLines();
      }
    });
  }
}
