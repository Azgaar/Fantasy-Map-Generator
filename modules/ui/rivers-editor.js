"use strict";
function editRiver(id) {
  if (customization) return;
  if (elSelected && id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  document.getElementById("toggleCells").dataset.forced = +!layerIsOn("toggleCells");
  if (!layerIsOn("toggleCells")) toggleCells();

  elSelected = d3.select("#" + id);

  viewbox.on("touchmove mousemove", showEditorTips);
  debug.append("g").attr("id", "controlCells");
  debug.append("g").attr("id", "controlPoints");

  updateRiverData();

  const river = getRiver();
  const {cells, points} = river;
  const riverPoints = Rivers.getRiverPoints(cells, points);
  drawControlPoints(riverPoints, cells);
  drawRiverCells(cells);

  $("#riverEditor").dialog({
    title: "Edit River",
    resizable: false,
    position: {my: "left+40 center", at: "center", of: "svg", collision: "fit"},
    close: closeRiverEditor
  });

  if (modules.editRiver) return;
  modules.editRiver = true;

  // add listeners
  document.getElementById("riverName").addEventListener("input", changeName);
  document.getElementById("riverType").addEventListener("input", changeType);
  document.getElementById("riverNameCulture").addEventListener("click", generateNameCulture);
  document.getElementById("riverNameRandom").addEventListener("click", generateNameRandom);
  document.getElementById("riverMainstem").addEventListener("change", changeParent);
  document.getElementById("riverSourceWidth").addEventListener("input", changeSourceWidth);
  document.getElementById("riverWidthFactor").addEventListener("input", changeWidthFactor);
  document.getElementById("riverNew").addEventListener("click", toggleRiverCreationMode);
  document.getElementById("riverEditStyle").addEventListener("click", () => editStyle("rivers"));
  document.getElementById("riverElevationProfile").addEventListener("click", showElevationProfile);
  document.getElementById("riverLegend").addEventListener("click", editRiverLegend);
  document.getElementById("riverRemove").addEventListener("click", removeRiver);

  function showEditorTips() {
    tip("Drag control points for minor change, to change cells add a new river", true);
    showMainTip();
  }

  function getRiver() {
    const riverId = +elSelected.attr("id").slice(5);
    const river = pack.rivers.find(r => r.i === riverId);
    return river;
  }

  function updateRiverData() {
    const r = getRiver();

    document.getElementById("riverName").value = r.name;
    document.getElementById("riverType").value = r.type;

    const parentSelect = document.getElementById("riverMainstem");
    parentSelect.options.length = 0;
    const parent = r.parent || r.i;
    const sortedRivers = pack.rivers.slice().sort((a, b) => (a.name > b.name ? 1 : -1));
    sortedRivers.forEach(river => {
      const opt = new Option(river.name, river.i, false, river.i === parent);
      parentSelect.options.add(opt);
    });
    document.getElementById("riverBasin").value = pack.rivers.find(river => river.i === r.basin).name;

    document.getElementById("riverDischarge").value = r.discharge + " m³/s";
    document.getElementById("riverSourceWidth").value = r.sourceWidth;
    document.getElementById("riverWidthFactor").value = r.widthFactor;

    updateRiverLength(r);
    updateRiverWidth(r);
  }

  function updateRiverLength(river) {
    river.length = rn(elSelected.node().getTotalLength() / 2, 2);
    const length = `${river.length * distanceScaleInput.value} ${distanceUnitInput.value}`;
    document.getElementById("riverLength").value = length;
  }

  function updateRiverWidth(river) {
    const {addMeandering, getWidth, getOffset} = Rivers;
    const {cells, discharge, widthFactor, sourceWidth} = river;
    const meanderedPoints = addMeandering(cells);
    river.width = getWidth(getOffset(discharge, meanderedPoints.length, widthFactor, sourceWidth));

    const width = `${rn(river.width * distanceScaleInput.value, 3)} ${distanceUnitInput.value}`;
    document.getElementById("riverWidth").value = width;
  }

  function drawControlPoints(points, cells) {
    debug
      .select("#controlPoints")
      .selectAll("circle")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", d => d[0])
      .attr("cy", d => d[1])
      .attr("r", 0.6)
      .attr("data-cell", (d, i) => cells[i])
      .attr("data-i", (d, i) => i)
      .call(d3.drag().on("start", dragControlPoint));
  }

  function drawRiverCells(cells) {
    debug
      .select("#controlCells")
      .selectAll("polygon.current")
      .data(cells)
      .join("polygon")
      .attr("points", d => getPackPolygon(d))
      .attr("class", "current");
  }

  function drawAvailableCells(cells) {
    debug
      .select("#controlCells")
      .selectAll("polygon.available")
      .data(cells)
      .join("polygon")
      .attr("points", d => getPackPolygon(d))
      .attr("class", "available");
  }

  function dragControlPoint() {
    const {c, r, fl, conf} = pack.cells;
    const river = getRiver();
    const {cells} = river;

    const initCell = +this.dataset.cell;
    const index = +this.dataset.i;
    const prev = cells[index - 1];
    const next = cells[index + 1];
    const availableCells = conf[initCell]
      ? []
      : c[initCell]
          .filter(neib => !r[neib])
          .filter(neib => !prev || c[neib].includes(prev))
          .filter(neib => !next || c[neib].includes(next));

    let movedToCell = null;
    drawAvailableCells(availableCells);

    d3.event.on("drag", function () {
      const {x, y} = d3.event;
      const currentCell = findCell(x, y);

      if (initCell !== currentCell) {
        if (availableCells.includes(currentCell)) movedToCell = currentCell;
        else return;
      } else movedToCell = null;

      this.setAttribute("cx", x);
      this.setAttribute("cy", y);
      this.__data__ = [rn(x, 1), rn(y, 1)];
      redrawRiver();
    });

    d3.event.on("end", () => {
      if (movedToCell) {
        this.dataset.cell = movedToCell;
        river.cells[index] = movedToCell;

        r[initCell] = 0;
        r[movedToCell] = river.i;
        const sourceFlux = fl[initCell];
        fl[initCell] = fl[movedToCell];
        fl[movedToCell] = sourceFlux;
        drawRiverCells(river.cells);
      }

      debug.select("#controlCells").selectAll("polygon.available").remove();
    });
  }

  function redrawRiver() {
    const river = getRiver();
    river.points = debug.selectAll("#controlPoints > *").data();
    const {cells, widthFactor, sourceWidth} = river;
    const meanderedPoints = Rivers.addMeandering(cells, river.points);

    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    const path = Rivers.getRiverPath(meanderedPoints, widthFactor, sourceWidth);
    elSelected.attr("d", path);

    updateRiverLength(river);
    if (modules.elevation) showEPForRiver(elSelected.node());
  }

  function changeName() {
    getRiver().name = this.value;
  }

  function changeType() {
    getRiver().type = this.value;
  }

  function generateNameCulture() {
    const r = getRiver();
    r.name = riverName.value = Rivers.getName(r.mouth);
  }

  function generateNameRandom() {
    const r = getRiver();
    if (r) r.name = riverName.value = Names.getBase(rand(nameBases.length - 1));
  }

  function changeParent() {
    const r = getRiver();
    r.parent = +this.value;
    r.basin = pack.rivers.find(river => river.i === r.parent).basin;
    document.getElementById("riverBasin").value = pack.rivers.find(river => river.i === r.basin).name;
  }

  function changeSourceWidth() {
    const river = getRiver();
    river.sourceWidth = +this.value;
    updateRiverWidth(river);
    redrawRiver();
  }

  function changeWidthFactor() {
    const river = getRiver();
    river.widthFactor = +this.value;
    updateRiverWidth(river);
    redrawRiver();
  }

  function showElevationProfile() {
    modules.elevation = true;
    showEPForRiver(elSelected.node());
  }

  function editRiverLegend() {
    const id = elSelected.attr("id");
    const river = getRiver();
    editNotes(id, river.name + " " + river.type);
  }

  function toggleRiverCreationMode() {
    if (document.getElementById("riverNew").classList.contains("pressed")) exitRiverCreationMode();
    else {
      document.getElementById("riverNew").classList.add("pressed");
      tip("Click on map to add control points", true, "warn");
      viewbox.on("click", addPointOnClick).style("cursor", "crosshair");
      elSelected.on("click", null);
    }
  }

  function addPointOnClick() {
    if (!elSelected.attr("data-new")) {
      debug.select("#controlPoints").selectAll("circle").remove();
      const id = getNextId("river");
      elSelected = d3.select(elSelected.node().parentNode).append("path").attr("id", id).attr("data-new", 1);
    }

    // add control point
    const point = d3.mouse(this);
    // addControlPoint([point[0], point[1]]);
    redrawRiver();
  }

  function exitRiverCreationMode() {
    riverNew.classList.remove("pressed");
    clearMainTip();
    viewbox.on("click", clicked).style("cursor", "default");

    if (!elSelected.attr("data-new")) return; // no need to create a new river
    elSelected.attr("data-new", null);

    // add a river
    const r = +elSelected.attr("id").slice(5);
    const node = elSelected.node();
    const length = node.getTotalLength() / 2;

    const cells = [];

    const segments = Math.ceil(length / 4);
    const increment = rn((length / segments) * 1e5);
    for (let i = increment * segments, c = i; i >= 0; i -= increment, c += increment) {
      const p = node.getPointAtLength(i / 1e5);
      const cell = findCell(p.x, p.y);
      if (!pack.cells.r[cell]) pack.cells.r[cell] = r;
      cells.push(cell);
    }

    const source = cells[0];
    const mouth = last(cells);
    const name = Rivers.getName(mouth);
    const smallLength = pack.rivers.map(r => r.length || 0).sort((a, b) => a - b)[Math.ceil(pack.rivers.length * 0.15)];
    const type = length < smallLength ? rw({Creek: 9, River: 3, Brook: 3, Stream: 1}) : "River";

    const discharge = rn(cells.length * 20 * Math.random());
    const widthFactor = +document.getElementById("riverWidthFactor").value;
    const sourceWidth = +document.getElementById("riverSourceWidth").value;

    pack.rivers.push({i: r, source, mouth, discharge, length, width: sourceWidth, widthFactor, sourceWidth, parent: 0, name, type, basin: r});
  }

  function removeRiver() {
    alertMessage.innerHTML = "Are you sure you want to remove the river and all its tributaries";
    $("#alert").dialog({
      resizable: false,
      width: "22em",
      title: "Remove river and tributaries",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          const river = +elSelected.attr("id").slice(5);
          Rivers.remove(river);
          elSelected.remove(); // keep if river if missed in pack.rivers
          $("#riverEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function closeRiverEditor() {
    exitRiverCreationMode();
    elSelected.on("click", null);
    debug.select("#controlPoints").remove();
    debug.select("#controlCells").remove();
    unselect();

    const forced = +document.getElementById("toggleCells").dataset.forced;
    document.getElementById("toggleCells").dataset.forced = 0;
    if (forced && layerIsOn("toggleCells")) toggleCells();
  }
}
