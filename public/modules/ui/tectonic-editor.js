"use strict";

// Tectonic Plate Editor
// Click plates to select & edit, drag arrows to set velocity/direction
// Paint mode: brush to reassign cells between plates

let tectonicViewMode = "plates"; // "plates" or "heights"
let tectonicPlateColors = [];
let tectonicSelectedPlate = -1;
let tectonicPaintMode = false;
let tectonicBrushRadius = 10;

function editTectonics() {
  if (customization) return tip("Please exit the customization mode first", false, "error");

  if (!window.tectonicGenerator || !window.tectonicMetadata) {
    return tip("Tectonic data not available. Generate a map using a Tectonic template first.", false, "error");
  }

  closeDialogs(".stable");
  tectonicViewMode = "plates";
  tectonicSelectedPlate = -1;
  tectonicPaintMode = false;

  const plates = window.tectonicGenerator.getPlates();
  tectonicPlateColors = generatePlateColors(plates.length);

  drawPlateOverlay();
  closePlatePopup();
  updatePaintButtonState();

  $("#tectonicEditor").dialog({
    title: "Tectonic Plate Editor",
    resizable: false,
    width: "20em",
    position: {my: "right top", at: "right-10 top+10", of: "svg"},
    close: closeTectonicEditor
  });

  if (modules.editTectonics) return;
  modules.editTectonics = true;

  byId("tectonicRegenerate").addEventListener("click", regenerateFromEditor);
  byId("tectonicToggleOverlay").addEventListener("click", togglePlateOverlay);
  byId("tectonicApplyMap").addEventListener("click", applyToMap);
  byId("tectonicPaintToggle").addEventListener("click", togglePaintMode);
  byId("tectonicBrushSize").addEventListener("input", function () {
    tectonicBrushRadius = +this.value;
    byId("tectonicBrushSizeLabel").textContent = this.value;
  });
  byId("tectonicClose").addEventListener("click", () => $("#tectonicEditor").dialog("close"));
}

// ---- Color Utilities ----

function generatePlateColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 360 / count + 15) % 360;
    const sat = 60 + (i % 3) * 15;
    const lit = 45 + (i % 2) * 15;
    colors.push(`hsl(${hue}, ${sat}%, ${lit}%)`);
  }
  return colors;
}

function tectonicHeightColor(h) {
  if (h < 20) {
    const t = h / 20;
    return `rgb(${Math.round(30 + t * 40)},${Math.round(60 + t * 80)},${Math.round(120 + t * 100)})`;
  }
  const t = (h - 20) / 80;
  if (t < 0.3) {
    const s = t / 0.3;
    return `rgb(${Math.round(80 + s * 60)},${Math.round(160 + s * 40)},${Math.round(60 + s * 20)})`;
  }
  if (t < 0.7) {
    const s = (t - 0.3) / 0.4;
    return `rgb(${Math.round(140 + s * 60)},${Math.round(200 - s * 80)},${Math.round(80 - s * 40)})`;
  }
  const s = (t - 0.7) / 0.3;
  return `rgb(${Math.round(200 + s * 55)},${Math.round(120 + s * 135)},${Math.round(40 + s * 215)})`;
}

// ---- Overlay Drawing ----

function drawPlateOverlay() {
  const plates = window.tectonicGenerator.getPlates();
  const plateIds = window.tectonicMetadata.plateIds;
  const colors = tectonicPlateColors;

  viewbox.select("#tectonicOverlay").remove();
  const overlay = viewbox.insert("g", "#terrs").attr("id", "tectonicOverlay");

  const cellGroup = overlay.append("g").attr("id", "plateCells");
  for (let i = 0; i < plateIds.length; i++) {
    const pid = plateIds[i];
    if (pid < 0 || pid >= plates.length) continue;
    const points = getGridPolygon(i);
    if (!points) continue;

    const selected = pid === tectonicSelectedPlate;
    cellGroup.append("polygon")
      .attr("points", points)
      .attr("fill", colors[pid])
      .attr("fill-opacity", tectonicSelectedPlate === -1 ? 0.35 : (selected ? 0.55 : 0.15))
      .attr("stroke", colors[pid])
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 0.2)
      .attr("data-plate", pid)
      .attr("data-cell", i)
      .on("click", function () {
        if (!tectonicPaintMode) selectPlate(pid);
      });
  }

  drawVelocityArrows(overlay, plates, plateIds, colors);
}

function drawHeightOverlay(heights) {
  viewbox.select("#tectonicOverlay").remove();
  const overlay = viewbox.insert("g", "#terrs").attr("id", "tectonicOverlay");

  for (let i = 0; i < heights.length; i++) {
    const points = getGridPolygon(i);
    if (!points) continue;
    const c = tectonicHeightColor(heights[i]);
    overlay.append("polygon")
      .attr("points", points)
      .attr("fill", c)
      .attr("fill-opacity", 0.85)
      .attr("stroke", c)
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 0.1);
  }
}

function drawVelocityArrows(overlay, plates, plateIds, colors) {
  ensureArrowheadMarker();
  const arrowGroup = overlay.append("g").attr("id", "velocityArrows");
  const arrowScale = 30;

  for (const plate of plates) {
    const centroid = computeGridPlateCentroid(plate.id, plateIds);
    if (!centroid) continue;

    const [cx, cy] = centroid;
    const vel = plate.velocity;
    const dx = vel[0] * arrowScale;
    const dy = -vel[1] * arrowScale;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const tipX = cx + dx;
    const tipY = cy + dy;

    arrowGroup.append("line")
      .attr("class", "velocityLine")
      .attr("data-plate", plate.id)
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", tipX).attr("y2", tipY)
      .attr("stroke", colors[plate.id])
      .attr("stroke-width", mag < 2 ? 1 : 2)
      .attr("stroke-opacity", 0.9)
      .attr("stroke-dasharray", mag < 2 ? "2,2" : "none")
      .attr("marker-end", "url(#tectonicArrowhead)");

    arrowGroup.append("circle")
      .attr("class", "velocityHandle")
      .attr("data-plate", plate.id)
      .attr("cx", tipX).attr("cy", tipY)
      .attr("r", 5)
      .attr("fill", colors[plate.id])
      .attr("fill-opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("cursor", "grab")
      .call(d3.drag()
        .on("start", function () { d3.select(this).attr("cursor", "grabbing"); })
        .on("drag", function () { dragVelocityHandle(this, plate, cx, cy, arrowScale); })
        .on("end", function () { d3.select(this).attr("cursor", "grab"); })
      );

    arrowGroup.append("text")
      .attr("x", cx).attr("y", cy - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", colors[plate.id])
      .attr("stroke", "#000")
      .attr("stroke-width", 0.3)
      .attr("paint-order", "stroke")
      .attr("cursor", "pointer")
      .text(`P${plate.id}`)
      .on("click", function () { selectPlate(plate.id); });
  }
}

function dragVelocityHandle(handle, plate, cx, cy, arrowScale) {
  const [mx, my] = d3.mouse(viewbox.node());
  d3.select(handle).attr("cx", mx).attr("cy", my);
  viewbox.select(`.velocityLine[data-plate="${plate.id}"]`)
    .attr("x2", mx).attr("y2", my);

  plate.velocity[0] = (mx - cx) / arrowScale;
  plate.velocity[1] = -(my - cy) / arrowScale;
  plate.velocity[2] = 0;

  if (tectonicSelectedPlate === plate.id) updatePopupValues(plate);
}

function ensureArrowheadMarker() {
  if (document.getElementById("tectonicArrowhead")) return;
  d3.select("svg").select("defs").append("marker")
    .attr("id", "tectonicArrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 8).attr("refY", 5)
    .attr("markerWidth", 6).attr("markerHeight", 6)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#fff")
    .attr("stroke", "#333")
    .attr("stroke-width", 0.5);
}

function computeGridPlateCentroid(plateId, plateIds) {
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < plateIds.length; i++) {
    if (plateIds[i] !== plateId) continue;
    sumX += grid.points[i][0];
    sumY += grid.points[i][1];
    count++;
  }
  if (count === 0) return null;
  return [sumX / count, sumY / count];
}

// ---- Plate Selection & Popup ----

function selectPlate(plateId) {
  const plates = window.tectonicGenerator.getPlates();
  if (plateId < 0 || plateId >= plates.length) return;

  tectonicSelectedPlate = plateId;

  viewbox.select("#plateCells").selectAll("polygon")
    .attr("fill-opacity", function () {
      return +this.getAttribute("data-plate") === plateId ? 0.55 : 0.15;
    });

  showPlatePopup(plates[plateId]);
}

function showPlatePopup(plate) {
  closePlatePopup();

  const plateIds = window.tectonicMetadata.plateIds;
  const centroid = computeGridPlateCentroid(plate.id, plateIds);
  if (!centroid) return;

  let cellCount = 0;
  for (let i = 0; i < plateIds.length; i++) {
    if (plateIds[i] === plate.id) cellCount++;
  }
  const pct = (cellCount / plateIds.length * 100).toFixed(1);

  const vel = plate.velocity;
  const speed = Math.sqrt(vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2);
  const dirDeg = Math.round(Math.atan2(-vel[1], vel[0]) * 180 / Math.PI);
  const color = tectonicPlateColors[plate.id];

  const popup = document.createElement("div");
  popup.id = "tectonicPlatePopup";
  popup.style.cssText = `
    position: absolute; z-index: 1000;
    background: rgba(30,30,30,0.95); color: #eee;
    border: 2px solid ${color}; border-radius: 6px;
    padding: 10px 14px; font-size: 12px;
    min-width: 180px; pointer-events: auto;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  `;

  popup.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <strong style="color:${color}">Plate ${plate.id}</strong>
      <span style="font-size:10px;color:#999">${cellCount} cells (${pct}%)</span>
    </div>
    <div style="margin-bottom:6px">
      <label style="font-size:11px">Type: </label>
      <select id="popupPlateType" style="font-size:11px;margin-left:4px">
        <option value="continental" ${!plate.isOceanic ? "selected" : ""}>Continental</option>
        <option value="oceanic" ${plate.isOceanic ? "selected" : ""}>Oceanic</option>
      </select>
    </div>
    <div style="margin-bottom:6px">
      <label style="font-size:11px">Speed: </label>
      <input id="popupPlateSpeed" type="range" min="0" max="1.5" step="0.05" value="${speed.toFixed(2)}"
        style="width:80px;vertical-align:middle">
      <span id="popupSpeedLabel" style="font-size:10px">${speed.toFixed(2)}</span>
    </div>
    <div style="margin-bottom:8px">
      <label style="font-size:11px">Direction: </label>
      <input id="popupPlateDir" type="range" min="-180" max="180" step="5" value="${dirDeg}"
        style="width:80px;vertical-align:middle">
      <span id="popupDirLabel" style="font-size:10px">${dirDeg}&deg;</span>
    </div>
    <div style="font-size:10px;color:#888;text-align:center">
      Drag arrow or use sliders &bull; Enable Paint to reshape
    </div>
  `;

  document.body.appendChild(popup);

  const svgEl = document.querySelector("svg");
  const ctm = svgEl.getScreenCTM();
  const screenX = centroid[0] * ctm.a + ctm.e;
  const screenY = centroid[1] * ctm.d + ctm.f;
  popup.style.left = Math.min(screenX + 20, window.innerWidth - 220) + "px";
  popup.style.top = Math.max(screenY - 60, 10) + "px";

  byId("popupPlateType").addEventListener("change", function () {
    plate.isOceanic = this.value === "oceanic";
  });

  byId("popupPlateSpeed").addEventListener("input", function () {
    const newSpeed = +this.value;
    byId("popupSpeedLabel").textContent = newSpeed.toFixed(2);
    const oldSpeed = Math.sqrt(plate.velocity[0] ** 2 + plate.velocity[1] ** 2 + plate.velocity[2] ** 2);
    if (oldSpeed > 0.001) {
      const s = newSpeed / oldSpeed;
      plate.velocity[0] *= s;
      plate.velocity[1] *= s;
      plate.velocity[2] *= s;
    } else {
      plate.velocity[0] = newSpeed;
      plate.velocity[1] = 0;
      plate.velocity[2] = 0;
    }
    redrawArrowForPlate(plate);
  });

  byId("popupPlateDir").addEventListener("input", function () {
    const deg = +this.value;
    byId("popupDirLabel").textContent = deg + "\u00B0";
    const speed = Math.sqrt(plate.velocity[0] ** 2 + plate.velocity[1] ** 2 + plate.velocity[2] ** 2);
    const rad = deg * Math.PI / 180;
    plate.velocity[0] = Math.cos(rad) * speed;
    plate.velocity[1] = -Math.sin(rad) * speed;
    plate.velocity[2] = 0;
    redrawArrowForPlate(plate);
  });
}

function updatePopupValues(plate) {
  const speedEl = byId("popupPlateSpeed");
  const dirEl = byId("popupPlateDir");
  if (!speedEl || !dirEl) return;

  const vel = plate.velocity;
  const speed = Math.sqrt(vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2);
  const dirDeg = Math.round(Math.atan2(-vel[1], vel[0]) * 180 / Math.PI);

  speedEl.value = speed.toFixed(2);
  byId("popupSpeedLabel").textContent = speed.toFixed(2);
  dirEl.value = dirDeg;
  byId("popupDirLabel").textContent = dirDeg + "\u00B0";
}

function redrawArrowForPlate(plate) {
  const plateIds = window.tectonicMetadata.plateIds;
  const centroid = computeGridPlateCentroid(plate.id, plateIds);
  if (!centroid) return;

  const arrowScale = 30;
  const [cx, cy] = centroid;
  const tipX = cx + plate.velocity[0] * arrowScale;
  const tipY = cy + -plate.velocity[1] * arrowScale;

  viewbox.select(`.velocityLine[data-plate="${plate.id}"]`)
    .attr("x2", tipX).attr("y2", tipY);
  viewbox.select(`.velocityHandle[data-plate="${plate.id}"]`)
    .attr("cx", tipX).attr("cy", tipY);
}

function closePlatePopup() {
  const popup = byId("tectonicPlatePopup");
  if (popup) popup.remove();
}

// ---- Paint Mode ----

function togglePaintMode() {
  tectonicPaintMode = !tectonicPaintMode;
  updatePaintButtonState();

  if (tectonicPaintMode) {
    if (tectonicSelectedPlate === -1) {
      tip("Select a plate first (click on a plate), then paint to expand it", true, "warn");
      tectonicPaintMode = false;
      updatePaintButtonState();
      return;
    }
    enterPaintMode();
  } else {
    exitPaintMode();
  }
}

function updatePaintButtonState() {
  const btn = byId("tectonicPaintToggle");
  if (!btn) return;
  btn.classList.toggle("pressed", tectonicPaintMode);
  btn.textContent = tectonicPaintMode ? "Paint: ON" : "Paint";

  const brushControls = byId("tectonicBrushControls");
  if (brushControls) brushControls.style.display = tectonicPaintMode ? "block" : "none";
}

function enterPaintMode() {
  tip(`Paint mode: drag on map to assign cells to Plate ${tectonicSelectedPlate}`, true, "warn");
  viewbox.style("cursor", "crosshair");

  // Add drag handler for painting
  viewbox.call(
    d3.drag()
      .on("start", paintStart)
      .on("drag", paintDrag)
      .on("end", paintEnd)
  );
}

function exitPaintMode() {
  viewbox.style("cursor", "default");
  // Restore default zoom behavior
  viewbox.on(".drag", null);
  svg.call(zoom);
  removeBrushCircle();
  clearMainTip();
}

function paintStart() {
  if (!tectonicPaintMode || tectonicSelectedPlate === -1) return;
  const [x, y] = d3.mouse(this);
  paintCellsAt(x, y);
}

function paintDrag() {
  if (!tectonicPaintMode || tectonicSelectedPlate === -1) return;
  const [x, y] = d3.mouse(this);
  moveBrushCircle(x, y);
  paintCellsAt(x, y);
}

function paintEnd() {
  if (!tectonicPaintMode) return;
  removeBrushCircle();
  // Redraw overlay to reflect changes
  drawPlateOverlay();
}

function paintCellsAt(x, y) {
  const r = tectonicBrushRadius;
  const cellsInRadius = findGridAll(x, y, r);
  if (!cellsInRadius || cellsInRadius.length === 0) return;

  const generator = window.tectonicGenerator;
  const plateIds = window.tectonicMetadata.plateIds;

  // Reassign cells on the sphere
  generator.reassignCells(cellsInRadius, tectonicSelectedPlate);

  // Update grid-level metadata to match
  for (const gc of cellsInRadius) {
    plateIds[gc] = tectonicSelectedPlate;
  }

  // Update visual overlay for painted cells
  const colors = tectonicPlateColors;
  const cellGroup = viewbox.select("#plateCells");
  for (const gc of cellsInRadius) {
    const poly = cellGroup.select(`polygon[data-cell="${gc}"]`);
    if (!poly.empty()) {
      poly.attr("fill", colors[tectonicSelectedPlate])
        .attr("stroke", colors[tectonicSelectedPlate])
        .attr("data-plate", tectonicSelectedPlate)
        .attr("fill-opacity", 0.55);
    }
  }
}

function moveBrushCircle(x, y) {
  let circle = byId("tectonicBrushCircle");
  if (!circle) {
    const svg = viewbox.node().ownerSVGElement;
    const ns = "http://www.w3.org/2000/svg";
    circle = document.createElementNS(ns, "circle");
    circle.id = "tectonicBrushCircle";
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", tectonicPlateColors[tectonicSelectedPlate] || "#fff");
    circle.setAttribute("stroke-width", "1.5");
    circle.setAttribute("stroke-dasharray", "4,3");
    circle.setAttribute("pointer-events", "none");
    viewbox.node().appendChild(circle);
  }
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", tectonicBrushRadius);
}

function removeBrushCircle() {
  const circle = byId("tectonicBrushCircle");
  if (circle) circle.remove();
}

// ---- Actions ----

function regenerateFromEditor() {
  const generator = window.tectonicGenerator;
  if (!generator) return tip("No tectonic generator available", false, "error");

  if (tectonicPaintMode) { exitPaintMode(); tectonicPaintMode = false; updatePaintButtonState(); }
  closePlatePopup();
  tip("Regenerating terrain preview...", true, "warn");

  setTimeout(() => {
    try {
      const result = generator.regenerate();
      grid.cells.h = result.heights;
      window.tectonicMetadata = result.metadata;

      tectonicViewMode = "heights";
      drawHeightOverlay(result.heights);

      let water = 0, land = 0, minH = 100, maxH = 0;
      for (let i = 0; i < result.heights.length; i++) {
        const h = result.heights[i];
        if (h < 20) water++; else land++;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
      console.log(`Tectonic regen: ${land} land (${(land / result.heights.length * 100).toFixed(1)}%), heights ${minH}-${maxH}`);

      tip("Preview ready. Click 'Apply to Map' to rebuild.", true, "success");
    } catch (e) {
      console.error("Tectonic regeneration failed:", e);
      tip("Regeneration failed: " + e.message, false, "error");
    }
  }, 50);
}

function applyToMap() {
  if (!window.tectonicGenerator) return tip("No tectonic generator available", false, "error");

  if (tectonicPaintMode) { exitPaintMode(); tectonicPaintMode = false; updatePaintButtonState(); }
  closePlatePopup();
  closeTectonicEditor();
  $("#tectonicEditor").dialog("close");

  tip("Rebuilding map from edited tectonics...", true, "warn");

  setTimeout(() => {
    try {
      undraw();
      pack = {};

      Features.markupGrid();
      addLakesInDeepDepressions();
      openNearSeaLakes();

      OceanLayers();
      defineMapSize();
      calculateMapCoordinates();
      calculateTemperatures();
      generatePrecipitation();

      reGraph();
      Features.markupPack();
      createDefaultRuler();

      Rivers.generate();
      Biomes.define();
      Features.defineGroups();

      Ice.generate();

      rankCells();
      Cultures.generate();
      Cultures.expand();

      Burgs.generate();
      States.generate();
      Routes.generate();
      Religions.generate();

      Burgs.specify();
      States.collectStatistics();
      States.defineStateForms();

      Provinces.generate();
      Provinces.getPoles();

      Rivers.specify();
      Lakes.defineNames();

      Military.generate();
      Markers.generate();
      Zones.generate();

      drawScaleBar(scaleBar, scale);
      Names.getMapName();

      drawLayers();
      if (ThreeD.options.isOn) ThreeD.redraw();

      fitMapToScreen();
      clearMainTip();
      tip("Map rebuilt from edited tectonics", true, "success");
    } catch (e) {
      console.error("Failed to rebuild map:", e);
      tip("Rebuild failed: " + e.message, false, "error");
    }
  }, 100);
}

function togglePlateOverlay() {
  if (tectonicViewMode === "heights") {
    tectonicViewMode = "plates";
    tectonicSelectedPlate = -1;
    drawPlateOverlay();
    return;
  }

  const overlay = viewbox.select("#tectonicOverlay");
  if (overlay.empty()) {
    drawPlateOverlay();
  } else {
    const visible = overlay.style("display") !== "none";
    overlay.style("display", visible ? "none" : null);
  }
}

function closeTectonicEditor() {
  if (tectonicPaintMode) { exitPaintMode(); tectonicPaintMode = false; }
  closePlatePopup();
  viewbox.select("#tectonicOverlay").remove();
  d3.select("#tectonicArrowhead").remove();
  tectonicViewMode = "plates";
  tectonicSelectedPlate = -1;
}
