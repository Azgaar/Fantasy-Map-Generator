"use strict";
function editRiver(id) {
  if (customization) return;
  if (elSelected && d3.event && d3.event.target.id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  const node = id ? document.getElementById(id) : d3.event.target;
  elSelected = d3.select(node).on("click", addInterimControlPoint);
  viewbox.on("touchmove mousemove", showEditorTips);
  debug.append("g").attr("id", "controlPoints").attr("transform", elSelected.attr("transform"));
  drawControlPoints(node);
  updateRiverName(node);

  $("#riverEditor").dialog({
    title: "Edit River", resizable: false,
    position: {my: "center top+80", at: "top", of: node, collision: "fit"},
    close: closeRiverEditor
  });

  if (modules.editRiver) return;
  modules.editRiver = true;

  // add listeners
  document.getElementById("riverNameShow").addEventListener("click", showRiverName);
  document.getElementById("riverNameHide").addEventListener("click", hideRiverName);
  document.getElementById("riverName").addEventListener("input", changeName);
  document.getElementById("riverType").addEventListener("input", changeType);
  document.getElementById("riverNameCulture").addEventListener("click", generateNameCulture);
  document.getElementById("riverNameRandom").addEventListener("click", generateNameRandom);

  document.getElementById("riverWidthShow").addEventListener("click", showRiverWidth);
  document.getElementById("riverWidthHide").addEventListener("click", hideRiverWidth);
  document.getElementById("riverWidthInput").addEventListener("input", changeWidth);
  document.getElementById("riverIncrement").addEventListener("input", changeIncrement);
  document.getElementById("riverElevationProfile").addEventListener("click", showElevationProfile);
  
  document.getElementById("riverEditStyle").addEventListener("click", () => editStyle("rivers"));
  document.getElementById("riverNew").addEventListener("click", toggleRiverCreationMode);
  document.getElementById("riverLegend").addEventListener("click", editRiverLegend);
  document.getElementById("riverRemove").addEventListener("click", removeRiver);

  function showEditorTips() {
    showMainTip();
    if (d3.event.target.parentNode.id === elSelected.attr("id")) tip("Drag to move, click to add a control point"); else
    if (d3.event.target.parentNode.id === "controlPoints") tip("Drag to move, click to delete the control point");
  }

  function updateRiverName(node) {
    const river = +node.id.slice(5);
    const r = pack.rivers.find(r => r.i === river);
    riverName.value = r.name;
    riverType.value = r.type;
  }

  function drawControlPoints(node) {
    const l = node.getTotalLength() / 2;
    const segments = Math.ceil(l / 4);
    const increment = rn(l / segments * 1e5);
    for (let i=increment*segments, c=i; i >= 0; i -= increment, c += increment) {
      const p1 = node.getPointAtLength(i / 1e5);
      const p2 = node.getPointAtLength(c / 1e5);
      addControlPoint([(p1.x + p2.x) / 2, (p1.y + p2.y) / 2]);
    }
    updateRiverLength(l);
  }

  function addControlPoint(point) {
    debug.select("#controlPoints").append("circle")
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", .8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);
  }

  function dragControlPoint() {
    this.setAttribute("cx", d3.event.x);
    this.setAttribute("cy", d3.event.y);
    redrawRiver();
  }

  function redrawRiver() {
    const points = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      points.push([+this.getAttribute("cx"), +this.getAttribute("cy")]);
    });

    if (points.length === 1) return;
    if (points.length === 2) {
      const p0 = points[0], p1 = points[1];
      const angle = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      const sin = Math.sin(angle), cos = Math.cos(angle);
      elSelected.attr("d", `M${p0[0]},${p0[1]} L${p1[0]},${p1[1]} l${-sin/2},${cos/2} Z`);
      return;
    }
    const [d, length] = Rivers.getPath(points, +riverWidthInput.value, +riverIncrement.value);
    elSelected.attr("d", d);
    updateRiverLength(length);

    if (modules.elevation) {
      showEPForRiver(elSelected.node());
    }
  }

  function updateRiverLength(l = elSelected.node().getTotalLength() / 2) {
    const tr = parseTransform(elSelected.attr("transform"));
    const length = l * tr[5];
    riverLength.innerHTML = rn(length * distanceScaleInput.value) + " " + distanceUnitInput.value;
    const river = +elSelected.attr("id").slice(5);
    const r = pack.rivers.find(r => r.i === river);
    if (r) r.length = length;
  }

  function clickControlPoint() {
    this.remove();
    redrawRiver();
  }

  function addInterimControlPoint() {
    const point = d3.mouse(this);

    const dists = [];
    debug.select("#controlPoints").selectAll("circle").each(function() {
      const x = +this.getAttribute("cx");
      const y = +this.getAttribute("cy");
      dists.push((point[0] - x) ** 2 + (point[1] - y) ** 2);
    });

    let index = dists.length;
    if (dists.length > 1) {
      const sorted = dists.slice(0).sort((a, b) => a-b);
      const closest = dists.indexOf(sorted[0]);
      const next = dists.indexOf(sorted[1]);
      if (closest <= next) index = closest+1; else index = next+1;
    }

    const before = ":nth-child(" + (index + 1) + ")";
    debug.select("#controlPoints").insert("circle", before)
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", .8)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);

      redrawRiver();
  }

  function showRiverName() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("riverNameSection").style.display = "inline-block";
    const river = +elSelected.attr("id").slice(5);
    const r = pack.rivers.find(r => r.i === river);
    if (!r) return;
    document.getElementById("riverName").value = r.name;
    document.getElementById("riverType").value = r.type;
  }

  function hideRiverName() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("riverNameSection").style.display = "none";
  }

  function changeName() {
    const river = +elSelected.attr("id").slice(5);
    const r = pack.rivers.find(r => r.i === river);
    if (r) r.name = this.value;
  }

  function changeType() {
    const river = +elSelected.attr("id").slice(5);
    const r = pack.rivers.find(r => r.i === river);
    if (r) r.type = this.value;
  }

  function generateNameCulture() {
    const river = +elSelected.attr("id").slice(5);
    const r = pack.rivers.find(r => r.i === river);
    if (r) r.name = riverName.value = Rivers.getName(r.mouth);
  }

  function generateNameRandom() {
    const river = +elSelected.attr("id").slice(5);
    const r = pack.rivers.find(r => r.i === river);
    if (r) r.name = riverName.value = Names.getBase(rand(nameBases.length-1));
  }

  function showElevationProfile() {
    modules.elevation = true;
    showEPForRiver(elSelected.node());
  }

  function showRiverWidth() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("riverWidthSection").style.display = "inline-block";
    document.getElementById("riverWidthInput").value = elSelected.attr("data-width");
    document.getElementById("riverIncrement").value = elSelected.attr("data-increment");
  }

  function hideRiverWidth() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("riverWidthSection").style.display = "none";
  }
  
  function changeWidth() {
    elSelected.attr("data-width", this.value);
    redrawRiver();
  }

  function changeIncrement() {
    elSelected.attr("data-increment", this.value);
    redrawRiver();
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
      elSelected = d3.select(elSelected.node().parentNode).append("path").attr("id", id)
        .attr("data-new", 1).attr("data-width", 1).attr("data-increment", .5);
    }

    // add control point
    const point = d3.mouse(this);
    addControlPoint([point[0], point[1]]);
    redrawRiver();
  }
  
  
  function editRiverLegend() {
    const id = elSelected.attr("id");
    editNotes(id, id);
  }

  function removeRiver() {
    alertMessage.innerHTML = "Are you sure you want to remove the river? All tributaries will be auto-removed";
    $("#alert").dialog({resizable: false, width: "22em", title: "Remove river",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          const river = +elSelected.attr("id").slice(5);
          Rivers.remove(river);
          $("#riverEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function exitRiverCreationMode() {
    riverNew.classList.remove("pressed");
    clearMainTip();
    viewbox.on("click", clicked).style("cursor", "default");
    elSelected.on("click", addInterimControlPoint);

    if (!elSelected.attr("data-new")) return; // no need to create a new river
    elSelected.attr("data-new", null);

    // add a river
    const r = +elSelected.attr("id").slice(5);
    const node = elSelected.node(), length = node.getTotalLength() / 2;

    const cells = [];
    const segments = Math.ceil(length / 8), increment = rn(length / segments * 1e5);
    for (let i=increment*segments, c=i; i >= 0; i -= increment, c += increment) {
      const p = node.getPointAtLength(i / 1e5);
      const cell = findCell(p.x, p.y);
      if (!pack.cells.r[cell]) pack.cells.r[cell] = r;
      cells.push(cell);
    }

    const source = cells[0], mouth = last(cells);
    const name = Rivers.getName(mouth);
    const smallLength = pack.rivers.map(r => r.length||0).sort((a,b) => a-b)[Math.ceil(pack.rivers.length * .15)];
    const type = length < smallLength ? rw({"Creek":9, "River":3, "Brook":3, "Stream":1}) : "River";
    pack.rivers.push({i:r, parent:0, length, source, mouth, basin:r, name, type});
  }

  function closeRiverEditor() {
    exitRiverCreationMode();
    elSelected.on("click", null);
    debug.select("#controlPoints").remove();
    unselect();
  }
}
