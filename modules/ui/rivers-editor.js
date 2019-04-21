"use strict";
function editRiver() {
  if (customization) return;
  if (elSelected && d3.event.target.id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  const node = d3.event.target;
  elSelected = d3.select(node).on("click", addInterimControlPoint)
    .call(d3.drag().on("start", dragRiver)).classed("draggable", true);
  viewbox.on("touchmove mousemove", showEditorTips);
  debug.append("g").attr("id", "controlPoints").attr("transform", elSelected.attr("transform"));
  drawControlPoints(node);
  updateValues(node);

  $("#riverEditor").dialog({
    title: "Edit River", resizable: false,
    position: {my: "center top+20", at: "top", of: d3.event, collision: "fit"},
    close: closeRiverEditor
  });

  if (modules.editRiver) return;
  modules.editRiver = true;

  // add listeners
  document.getElementById("riverWidthShow").addEventListener("click", showRiverWidth);
  document.getElementById("riverWidthHide").addEventListener("click", hideRiverWidth);
  document.getElementById("riverWidthInput").addEventListener("input", changeWidth);
  document.getElementById("riverIncrement").addEventListener("input", changeIncrement);
  
  document.getElementById("riverResizeShow").addEventListener("click", showRiverSize);
  document.getElementById("riverResizeHide").addEventListener("click", hideRiverSize);
  document.getElementById("riverAngle").addEventListener("input", changeAngle);
  document.getElementById("riverScale").addEventListener("input", changeScale);
  document.getElementById("riverReset").addEventListener("click", resetTransformation);

  document.getElementById("riverCopy").addEventListener("click", copyRiver);
  document.getElementById("riverNew").addEventListener("click", toggleRiverCreationMode);
  document.getElementById("riverLegend").addEventListener("click", editRiverLegend);
  document.getElementById("riverRemove").addEventListener("click", removeRiver);

  function showEditorTips() {
    showMainTip();
    if (d3.event.target.parentNode.id === elSelected.attr("id")) tip("Drag to move, click to add a control point"); else
    if (d3.event.target.parentNode.id === "controlPoints") tip("Drag to move, click to delete the control point");
  }

  function updateValues(node) {
    const tr = parseTransform(node.getAttribute("transform"));
    document.getElementById("riverAngle").value = tr[2];
    document.getElementById("riverAngleValue").innerHTML = Math.abs(+tr[2]) + "&#xb0;";
    document.getElementById("riverScale").value = tr[5];
    document.getElementById("riverWidthInput").value = node.dataset.width;
    document.getElementById("riverIncrement").value = node.dataset.increment;
  }

  function dragRiver() {
    const x = d3.event.x, y = d3.event.y;
    const tr = parseTransform(elSelected.attr("transform"));

    d3.event.on("drag", function() {
      let xc = d3.event.x, yc = d3.event.y;
      let transform = `translate(${(+tr[0]+xc-x)},${(+tr[1]+yc-y)}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      elSelected.attr("transform", transform);
      debug.select("#controlPoints").attr("transform", transform);
    });
  }

  function drawControlPoints(node) {
    const l = node.getTotalLength() / 2;
    const segments = Math.ceil(l / 5);
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
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", .5)
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
    if (points.length === 2) {elSelected.attr("d", `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`); return;}
    const d = Rivers.getPath(points, +riverWidthInput.value, +riverIncrement.value);
    elSelected.attr("d", d);
    updateRiverLength();
  }

  function updateRiverLength(l = elSelected.node().getTotalLength() / 2) {
    const tr = parseTransform(elSelected.attr("transform"));
    riverLength.innerHTML = rn(l * tr[5] * distanceScale.value) + " " + distanceUnit.value;
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
      .attr("cx", point[0]).attr("cy", point[1]).attr("r", .5)
      .call(d3.drag().on("drag", dragControlPoint))
      .on("click", clickControlPoint);

      redrawRiver();
  }

  function showRiverWidth() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("riverWidthSection").style.display = "inline-block";
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
  
  function showRiverSize() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "none");
    document.getElementById("riverResizeSection").style.display = "inline-block";
  }

  function hideRiverSize() {
    document.querySelectorAll("#riverEditor > button").forEach(el => el.style.display = "inline-block");
    document.getElementById("riverResizeSection").style.display = "none";
  }  

  function changeAngle() {
    const tr = parseTransform(elSelected.attr("transform"));
    riverAngleValue.innerHTML = Math.abs(+this.value) + "&#xb0;";
    const c = elSelected.node().getBBox();
    const angle = +this.value, scale = +tr[5];
    const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)*scale} ${(c.y+c.height/2)*scale}) scale(${scale})`;
    elSelected.attr("transform", transform);
    debug.select("#controlPoints").attr("transform", transform); 
  }
  
  function changeScale() {
    const tr = parseTransform(elSelected.attr("transform"));
    const scaleOld = +tr[5],scale = +this.value;
    const c = elSelected.node().getBBox();
    const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
    const trX = +tr[0] + cx * (scaleOld - scale);
    const trY = +tr[1] + cy * (scaleOld - scale);
    const scX = +tr[3] * scale / scaleOld;
    const scY = +tr[4] * scale / scaleOld;
    const transform = `translate(${trX},${trY}) rotate(${tr[2]} ${scX} ${scY}) scale(${scale})`;
    elSelected.attr("transform", transform);
    debug.select("#controlPoints").attr("transform", transform);
    updateRiverLength();
  }

  function resetTransformation() {
    elSelected.attr("transform", null);
    debug.select("#controlPoints").attr("transform", null);
    riverAngle.value = 0;
    riverAngleValue.innerHTML = "0&#xb0;";
    riverScale.value = 1;
    updateRiverLength();
  }

  function copyRiver() {
    const tr = parseTransform(elSelected.attr("transform"));
    const d = elSelected.attr("d");
    let x = 2, y = 2;
    let transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
    while (rivers.selectAll("[transform='" + transform + "'][d='" + d + "']").size() > 0) {
      x += 2; y += 2;
      transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
    }

    rivers.append("path").attr("d", d).attr("transform", transform).attr("id", getNextId("river"))
      .attr("data-width", elSelected.attr("data-width")).attr("data-increment", elSelected.attr("data-increment"));
  }
 
  function toggleRiverCreationMode() {
    document.getElementById("riverNew").classList.toggle("pressed");
    if (document.getElementById("riverNew").classList.contains("pressed")) {
      tip("Click on map to add control points", true);
      viewbox.on("click", addPointOnClick).style("cursor", "crosshair");
      elSelected.on("click", null);
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
      elSelected.on("click", addInterimControlPoint).attr("data-new", null)
        .call(d3.drag().on("start", dragRiver)).classed("draggable", true);
    }
  }

  function addPointOnClick() {
    if (!elSelected.attr("data-new")) {
      debug.select("#controlPoints").selectAll("circle").remove();
      const id = getNextId("river");
      elSelected = d3.select(elSelected.node().parentNode).append("path").attr("id", id)
        .attr("data-new", 1).attr("data-width", 2).attr("data-increment", 1);
    }

    // add control point
    const point = d3.mouse(this);
    addControlPoint([point[0], point[1]]);
    redrawRiver();
  }
  
  
  function editRiverLegend() {
    const id = elSelected.attr("id");
    editLegends(id, id);
  }  

  function removeRiver() {
    alertMessage.innerHTML = "Are you sure you want to remove the river?";
    $("#alert").dialog({resizable: false, title: "Remove river",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          elSelected.remove();
          $("#riverEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function closeRiverEditor() {
    elSelected.attr("data-new", null).on("click", null);
    clearMainTip();
    riverNew.classList.remove("pressed");    
    debug.select("#controlPoints").remove();
    unselect();
  }

}
