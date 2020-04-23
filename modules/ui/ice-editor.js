"use strict";
function editIce() {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleIce")) toggleIce();

  elSelected = d3.select(d3.event.target);
  const type = elSelected.attr("type") ? "Glacier" : "Iceberg";
  document.getElementById("iceRandomize").style.display = type === "Glacier" ? "none" : "inline-block";
  document.getElementById("iceSize").style.display = type === "Glacier" ? "none" : "inline-block";
  if (type === "Iceberg") document.getElementById("iceSize").value = +elSelected.attr("size");
  ice.selectAll("*").classed("draggable", true).call(d3.drag().on("drag", dragElement));

  $("#iceEditor").dialog({
    title: "Edit "+type, resizable: false,
    position: {my: "center top+60", at: "top", of: d3.event, collision: "fit"},
    close: closeEditor
  });

  if (modules.editIce) return;
  modules.editIce = true;

  // add listeners
  document.getElementById("iceEditStyle").addEventListener("click", () => editStyle("ice"));
  document.getElementById("iceRandomize").addEventListener("click", randomizeShape);
  document.getElementById("iceSize").addEventListener("input", changeSize);
  document.getElementById("iceNew").addEventListener("click", toggleAdd);
  document.getElementById("iceRemove").addEventListener("click", removeIce);

  function randomizeShape() {
    const c = grid.points[+elSelected.attr("cell")];
    const s = +elSelected.attr("size");
    const i = ra(grid.cells.i), cn = grid.points[i];
    const poly = getGridPolygon(i).map(p => [p[0]-cn[0], p[1]-cn[1]]);
    const points = poly.map(p => [rn(c[0] + p[0] * s, 2), rn(c[1] + p[1] * s, 2)]);
    elSelected.attr("points", points);
  }

  function changeSize() {
    const c = grid.points[+elSelected.attr("cell")];
    const s = +elSelected.attr("size");
    const flat = elSelected.attr("points").split(",").map(el => +el);
    const pairs = [];
    while (flat.length) pairs.push(flat.splice(0,2));
    const poly = pairs.map(p => [(p[0]-c[0]) / s, (p[1]-c[1]) / s]);
    const size = +this.value;
    const points = poly.map(p => [rn(c[0] + p[0] * size, 2), rn(c[1] + p[1] * size, 2)]);
    elSelected.attr("points", points).attr("size", size);
  }

  function toggleAdd() {
    document.getElementById("iceNew").classList.toggle("pressed");
    if (document.getElementById("iceNew").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", addIcebergOnClick);
      tip("Click on map to create an iceberg. Hold Shift to add multiple", true);
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
    }
  }

  function addIcebergOnClick() {
    const point = d3.mouse(this);
    const i = findGridCell(point[0], point[1]);
    const c = grid.points[i];
    const s = +document.getElementById("iceSize").value;

    const points = getGridPolygon(i).map(p => [(p[0] + (c[0]-p[0]) / s)|0, (p[1] + (c[1]-p[1]) / s)|0]);
    const iceberg = ice.append("polygon").attr("points", points).attr("cell", i).attr("size", s);
    iceberg.call(d3.drag().on("drag", dragElement));
    if (d3.event.shiftKey === false) toggleAdd();
  }

  function removeIce() {
    const type = elSelected.attr("type") ? "Glacier" : "Iceberg";
    alertMessage.innerHTML = `Are you sure you want to remove the ${type}?`;
    $("#alert").dialog({resizable: false, title: "Remove "+type,
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          elSelected.remove();
          $("#iceEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function dragElement() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      this.setAttribute("transform", `translate(${(dx+x)},${(dy+y)})`);
    });
  }

  function closeEditor() {
    ice.selectAll("*").classed("draggable", false).call(d3.drag().on("drag", null));
    clearMainTip();
    iceNew.classList.remove("pressed");
    unselect();
  }
}
