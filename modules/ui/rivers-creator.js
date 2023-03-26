"use strict";
function createRiver() {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleRivers")) toggleRivers();

  document.getElementById("toggleCells").dataset.forced = +!layerIsOn("toggleCells");
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add river point, click again to remove", true);
  debug.append("g").attr("id", "controlCells");
  viewbox.style("cursor", "crosshair").on("click", onCellClick);

  createRiver.cells = [];
  const body = document.getElementById("riverCreatorBody");

  $("#riverCreator").dialog({
    title: "Create River",
    resizable: false,
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeRiverCreator
  });

  if (modules.createRiver) return;
  modules.createRiver = true;

  // add listeners
  document.getElementById("riverCreatorComplete").addEventListener("click", addRiver);
  document.getElementById("riverCreatorCancel").addEventListener("click", () => $("#riverCreator").dialog("close"));
  body.addEventListener("click", function (ev) {
    const el = ev.target;
    const cl = el.classList;
    const cell = +el.parentNode.dataset.cell;
    if (cl.contains("editFlux")) pack.cells.fl[cell] = +el.value;
    else if (cl.contains("icon-trash-empty")) removeCell(cell);
  });

  function onCellClick() {
    const cell = findCell(...d3.mouse(this));

    if (createRiver.cells.includes(cell)) removeCell(cell);
    else addCell(cell);
  }

  function addCell(cell) {
    createRiver.cells.push(cell);
    drawCells(createRiver.cells);

    const flux = pack.cells.fl[cell];
    const line = `<div class="editorLine" data-cell="${cell}">
      <span>Cell ${cell}</span>
      <span data-tip="Set flux affects river width" style="margin-left: 0.4em">Flux</span>
      <input type="number" min=0 value="${flux}" class="editFlux" style="width: 5em"/>
      <span data-tip="Remove the cell" class="icon-trash-empty pointer"></span>
    </div>`;
    body.innerHTML += line;
  }

  function removeCell(cell) {
    createRiver.cells = createRiver.cells.filter(c => c !== cell);
    drawCells(createRiver.cells);
    body.querySelector(`div[data-cell='${cell}']`)?.remove();
  }

  function drawCells(cells) {
    debug
      .select("#controlCells")
      .selectAll(`polygon`)
      .data(cells)
      .join("polygon")
      .attr("points", d => getPackPolygon(d))
      .attr("class", "current");
  }

  function addRiver() {
    const {rivers, cells} = pack;
    const {addMeandering, getApproximateLength, getWidth, getOffset, getName, getRiverPath, getBasin, getNextId} =
      Rivers;

    const riverCells = createRiver.cells;
    if (riverCells.length < 2) return tip("Add at least 2 cells", false, "error");

    const riverId = getNextId(rivers);
    const parent = cells.r[last(riverCells)] || riverId;

    riverCells.forEach(cell => {
      if (!cells.r[cell]) cells.r[cell] = riverId;
    });

    const source = riverCells[0];
    const mouth = parent === riverId ? last(riverCells) : riverCells[riverCells.length - 2];
    const sourceWidth = 0.05;
    const defaultWidthFactor = rn(1 / (pointsInput.dataset.cells / 10000) ** 0.25, 2);
    const widthFactor = 1.2 * defaultWidthFactor;

    const meanderedPoints = addMeandering(riverCells);

    const discharge = cells.fl[mouth]; // m3 in second
    const length = getApproximateLength(meanderedPoints);
    const width = getWidth(getOffset(discharge, meanderedPoints.length, widthFactor, sourceWidth));
    const name = getName(mouth);
    const basin = getBasin(parent);

    rivers.push({
      i: riverId,
      source,
      mouth,
      discharge,
      length,
      width,
      widthFactor,
      sourceWidth,
      parent,
      cells: riverCells,
      basin,
      name,
      type: "River"
    });
    const id = "river" + riverId;

    // render river
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    viewbox
      .select("#rivers")
      .append("path")
      .attr("id", id)
      .attr("d", getRiverPath(meanderedPoints, widthFactor, sourceWidth));

    editRiver(id);
  }

  function closeRiverCreator() {
    body.innerHTML = "";
    debug.select("#controlCells").remove();
    restoreDefaultEvents();
    clearMainTip();

    const forced = +document.getElementById("toggleCells").dataset.forced;
    document.getElementById("toggleCells").dataset.forced = 0;
    if (forced && layerIsOn("toggleCells")) toggleCells();
  }
}
