"use strict";

// Tectonic Plate Editor
// Visualizes tectonic plates and allows editing plate properties (type, velocity)
// then regenerates terrain from the modified plate configuration

let tectonicViewMode = "plates"; // "plates" or "heights"

function editTectonics() {
  if (customization) return tip("Please exit the customization mode first", false, "error");

  if (!window.tectonicGenerator || !window.tectonicMetadata) {
    return tip("Tectonic data not available. Generate a map using a Tectonic template first.", false, "error");
  }

  closeDialogs(".stable");
  tectonicViewMode = "plates";

  const plates = window.tectonicGenerator.getPlates();
  const plateIds = window.tectonicMetadata.plateIds;
  const plateColors = generatePlateColors(plates.length);

  drawPlateOverlay(plateIds, plateColors, plates);
  buildPlateList(plates, plateColors);

  $("#tectonicEditor").dialog({
    title: "Tectonic Plate Editor",
    resizable: false,
    width: "22em",
    position: {my: "right top", at: "right-10 top+10", of: "svg"},
    close: closeTectonicEditor
  });

  if (modules.editTectonics) return;
  modules.editTectonics = true;

  byId("tectonicRegenerate").addEventListener("click", regenerateFromEditor);
  byId("tectonicToggleOverlay").addEventListener("click", togglePlateOverlay);
  byId("tectonicApplyMap").addEventListener("click", applyToMap);
  byId("tectonicClose").addEventListener("click", () => $("#tectonicEditor").dialog("close"));
}

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

// Height-to-color function matching FMG's heightmap editor
function tectonicHeightColor(h) {
  if (h < 20) {
    // Ocean: deep blue to light blue
    const t = h / 20;
    const r = Math.round(30 + t * 40);
    const g = Math.round(60 + t * 80);
    const b = Math.round(120 + t * 100);
    return `rgb(${r},${g},${b})`;
  } else {
    // Land: green to brown to white
    const t = (h - 20) / 80;
    if (t < 0.3) {
      const s = t / 0.3;
      return `rgb(${Math.round(80 + s * 60)},${Math.round(160 + s * 40)},${Math.round(60 + s * 20)})`;
    } else if (t < 0.7) {
      const s = (t - 0.3) / 0.4;
      return `rgb(${Math.round(140 + s * 60)},${Math.round(200 - s * 80)},${Math.round(80 - s * 40)})`;
    } else {
      const s = (t - 0.7) / 0.3;
      return `rgb(${Math.round(200 + s * 55)},${Math.round(120 + s * 135)},${Math.round(40 + s * 215)})`;
    }
  }
}

function drawPlateOverlay(plateIds, plateColors, plates) {
  viewbox.select("#tectonicOverlay").remove();
  const overlay = viewbox.insert("g", "#terrs").attr("id", "tectonicOverlay");
  const numCells = plateIds.length;

  for (let i = 0; i < numCells; i++) {
    const pid = plateIds[i];
    if (pid < 0 || pid >= plates.length) continue;

    const points = getGridPolygon(i);
    if (!points) continue;

    overlay.append("polygon")
      .attr("points", points)
      .attr("fill", plateColors[pid])
      .attr("fill-opacity", 0.35)
      .attr("stroke", plateColors[pid])
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 0.2)
      .attr("data-plate", pid)
      .on("click", function () {
        highlightPlate(pid, plateColors);
      });
  }

  drawVelocityArrows(overlay, plates, plateIds, plateColors);
}

function drawHeightOverlay(heights) {
  viewbox.select("#tectonicOverlay").remove();
  const overlay = viewbox.insert("g", "#terrs").attr("id", "tectonicOverlay");
  const numCells = heights.length;

  for (let i = 0; i < numCells; i++) {
    const points = getGridPolygon(i);
    if (!points) continue;

    overlay.append("polygon")
      .attr("points", points)
      .attr("fill", tectonicHeightColor(heights[i]))
      .attr("fill-opacity", 0.85)
      .attr("stroke", tectonicHeightColor(heights[i]))
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 0.1);
  }
}

function drawVelocityArrows(overlay, plates, plateIds, plateColors) {
  const arrowGroup = overlay.append("g").attr("id", "velocityArrows");

  for (const plate of plates) {
    const centroid = computeGridPlateCentroid(plate.id, plateIds);
    if (!centroid) continue;

    const [cx, cy] = centroid;
    const vel = plate.velocity;
    const arrowScale = 30;
    const dx = vel[0] * arrowScale;
    const dy = -vel[1] * arrowScale;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag < 2) continue;

    arrowGroup.append("line")
      .attr("x1", cx).attr("y1", cy)
      .attr("x2", cx + dx).attr("y2", cy + dy)
      .attr("stroke", plateColors[plate.id])
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.9)
      .attr("marker-end", "url(#tectonicArrowhead)");

    arrowGroup.append("text")
      .attr("x", cx).attr("y", cy - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", plateColors[plate.id])
      .attr("stroke", "#000")
      .attr("stroke-width", 0.3)
      .attr("paint-order", "stroke")
      .text(`P${plate.id}`);
  }

  if (!document.getElementById("tectonicArrowhead")) {
    const defs = d3.select("svg").select("defs");
    defs.append("marker")
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
}

function computeGridPlateCentroid(plateId, plateIds) {
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i < plateIds.length; i++) {
    if (plateIds[i] !== plateId) continue;
    const [x, y] = grid.points[i];
    sumX += x;
    sumY += y;
    count++;
  }
  if (count === 0) return null;
  return [sumX / count, sumY / count];
}

function highlightPlate(plateId, plateColors) {
  viewbox.select("#tectonicOverlay").selectAll("polygon")
    .attr("fill-opacity", function () {
      return +this.getAttribute("data-plate") === plateId ? 0.6 : 0.15;
    });

  const row = byId(`tectonicPlate_${plateId}`);
  if (row) {
    row.scrollIntoView({behavior: "smooth", block: "nearest"});
    row.style.outline = "2px solid " + plateColors[plateId];
    setTimeout(() => row.style.outline = "", 1500);
  }
}

function buildPlateList(plates, plateColors) {
  const container = byId("tectonicPlateList");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.fontSize = "11px";

  const header = document.createElement("tr");
  header.innerHTML = `
    <th style="width:30px">ID</th>
    <th style="width:60px">Type</th>
    <th>Velocity</th>
    <th style="width:50px">Dir</th>
  `;
  table.appendChild(header);

  for (const plate of plates) {
    const row = document.createElement("tr");
    row.id = `tectonicPlate_${plate.id}`;
    row.style.borderBottom = "1px solid #444";
    row.style.cursor = "pointer";

    const vel = plate.velocity;
    const speed = Math.sqrt(vel[0] * vel[0] + vel[1] * vel[1] + vel[2] * vel[2]).toFixed(2);
    const dirDeg = Math.round(Math.atan2(-vel[1], vel[0]) * 180 / Math.PI);

    row.innerHTML = `
      <td style="text-align:center">
        <span style="display:inline-block;width:12px;height:12px;background:${plateColors[plate.id]};border-radius:2px;vertical-align:middle"></span>
        ${plate.id}
      </td>
      <td>
        <select data-plate="${plate.id}" class="plateTypeSelect" style="font-size:10px;width:100%">
          <option value="continental" ${!plate.isOceanic ? "selected" : ""}>Land</option>
          <option value="oceanic" ${plate.isOceanic ? "selected" : ""}>Ocean</option>
        </select>
      </td>
      <td style="text-align:center">
        <input type="range" data-plate="${plate.id}" class="plateSpeedRange"
          min="0" max="1.5" step="0.05" value="${speed}"
          style="width:60px;vertical-align:middle">
        <span class="plateSpeedLabel" style="font-size:9px">${speed}</span>
      </td>
      <td style="text-align:center">
        <input type="number" data-plate="${plate.id}" class="plateDirInput"
          min="-180" max="180" step="15" value="${dirDeg}"
          style="width:45px;font-size:10px">
      </td>
    `;

    row.addEventListener("click", (e) => {
      if (e.target.tagName === "SELECT" || e.target.tagName === "INPUT") return;
      highlightPlate(plate.id, plateColors);
    });

    table.appendChild(row);
  }

  container.appendChild(table);

  container.querySelectorAll(".plateTypeSelect").forEach(select => {
    select.addEventListener("change", function () {
      const pid = +this.getAttribute("data-plate");
      plates[pid].isOceanic = this.value === "oceanic";
    });
  });

  container.querySelectorAll(".plateSpeedRange").forEach(slider => {
    slider.addEventListener("input", function () {
      const pid = +this.getAttribute("data-plate");
      const plate = plates[pid];
      const newSpeed = +this.value;
      this.parentElement.querySelector(".plateSpeedLabel").textContent = newSpeed.toFixed(2);

      const oldSpeed = Math.sqrt(plate.velocity[0] ** 2 + plate.velocity[1] ** 2 + plate.velocity[2] ** 2);
      if (oldSpeed > 0.001) {
        const scale = newSpeed / oldSpeed;
        plate.velocity[0] *= scale;
        plate.velocity[1] *= scale;
        plate.velocity[2] *= scale;
      } else {
        plate.velocity[0] = newSpeed;
        plate.velocity[1] = 0;
        plate.velocity[2] = 0;
      }
    });
  });

  container.querySelectorAll(".plateDirInput").forEach(input => {
    input.addEventListener("change", function () {
      const pid = +this.getAttribute("data-plate");
      const plate = plates[pid];
      const dirRad = (+this.value) * Math.PI / 180;
      const speed = Math.sqrt(plate.velocity[0] ** 2 + plate.velocity[1] ** 2 + plate.velocity[2] ** 2);
      plate.velocity[0] = Math.cos(dirRad) * speed;
      plate.velocity[1] = -Math.sin(dirRad) * speed;
      plate.velocity[2] = 0;
    });
  });
}

function regenerateFromEditor() {
  const generator = window.tectonicGenerator;
  if (!generator) return tip("No tectonic generator available", false, "error");

  tip("Regenerating terrain from edited plates...", true, "warn");

  setTimeout(() => {
    try {
      const result = generator.regenerate();

      // Update grid heights
      grid.cells.h = result.heights;
      window.tectonicMetadata = result.metadata;

      // Show the regenerated heightmap as a visual overlay
      tectonicViewMode = "heights";
      drawHeightOverlay(result.heights);

      // Log changes for debugging
      let water = 0, land = 0, minH = 100, maxH = 0;
      for (let i = 0; i < result.heights.length; i++) {
        const h = result.heights[i];
        if (h < 20) water++; else land++;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
      console.log(`Tectonic regeneration: ${land} land (${(land / result.heights.length * 100).toFixed(1)}%), heights ${minH}-${maxH}`);

      tip("Terrain regenerated. Click 'Apply to Map' to regenerate the full map.", true, "success");
    } catch (e) {
      console.error("Tectonic regeneration failed:", e);
      tip("Regeneration failed: " + e.message, false, "error");
    }
  }, 50);
}

function applyToMap() {
  if (!window.tectonicGenerator) return tip("No tectonic generator available", false, "error");

  // Close the editor overlay
  closeTectonicEditor();
  $("#tectonicEditor").dialog("close");

  tip("Rebuilding map from edited tectonics...", true, "warn");

  setTimeout(() => {
    try {
      // grid.cells.h is already set by regenerateFromEditor
      // Run the full downstream pipeline WITHOUT regenerating the heightmap
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
  const overlay = viewbox.select("#tectonicOverlay");

  if (tectonicViewMode === "heights") {
    // Switch back to plate view
    tectonicViewMode = "plates";
    const plates = window.tectonicGenerator.getPlates();
    const plateColors = generatePlateColors(plates.length);
    drawPlateOverlay(window.tectonicMetadata.plateIds, plateColors, plates);
    return;
  }

  if (overlay.empty()) {
    const plates = window.tectonicGenerator.getPlates();
    const plateColors = generatePlateColors(plates.length);
    drawPlateOverlay(window.tectonicMetadata.plateIds, plateColors, plates);
  } else {
    const visible = overlay.style("display") !== "none";
    overlay.style("display", visible ? "none" : null);
  }
}

function closeTectonicEditor() {
  viewbox.select("#tectonicOverlay").remove();
  d3.select("#tectonicArrowhead").remove();
  tectonicViewMode = "plates";
}
