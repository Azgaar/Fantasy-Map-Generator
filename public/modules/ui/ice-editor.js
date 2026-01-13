"use strict";
function editIce() {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleIce")) toggleIce();

  elSelected = d3.select(d3.event.target);
  const index = +elSelected.attr("data-index");
  const isGlacier = elSelected.attr("type") === "iceShield";
  const type = isGlacier ? "Glacier" : "Iceberg";

  document.getElementById("iceRandomize").style.display = isGlacier ? "none" : "inline-block";
  document.getElementById("iceSize").style.display = isGlacier ? "none" : "inline-block";
  if (!isGlacier) document.getElementById("iceSize").value = +elSelected.attr("size");

  ice.selectAll("*").classed("draggable", true).call(d3.drag().on("drag", dragElement));

  $("#iceEditor").dialog({
    title: "Edit " + type,
    resizable: false,
    position: {my: "center top+60", at: "top", of: d3.event, collision: "fit"},
    close: closeEditor
  });

  if (modules.editIce) return;
  modules.editIce = { currentIndex: index };

  // add listeners
  document.getElementById("iceEditStyle").addEventListener("click", () => editStyle("ice"));
  document.getElementById("iceRandomize").addEventListener("click", randomizeShape);
  document.getElementById("iceSize").addEventListener("input", changeSize);
  document.getElementById("iceNew").addEventListener("click", toggleAdd);
  document.getElementById("iceRemove").addEventListener("click", removeIce);

  function randomizeShape() {
    const idx = modules.editIce.currentIndex;
    Ice.randomizeIcebergShape(idx);
    redrawIce();
    elSelected = ice.selectAll(`[data-index="${idx}"]`).node();
    elSelected = d3.select(elSelected);
  }

  function changeSize() {
    const newSize = +this.value;
    const idx = modules.editIce.currentIndex;
    Ice.changeIcebergSize(idx, newSize);
    redrawIce();
    elSelected = ice.selectAll(`[data-index="${idx}"]`).node();
    elSelected = d3.select(elSelected);
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
    const [x, y] = d3.mouse(this);
    const i = findGridCell(x, y, grid);
    const size = +document.getElementById("iceSize")?.value || 1;

    Ice.addIceberg(i, size);
    redrawIce();

    if (d3.event.shiftKey === false) toggleAdd();
  }

  function removeIce() {
    const type = isGlacier ? "Glacier" : "Iceberg";
    alertMessage.innerHTML = /* html */ `Are you sure you want to remove the ${type}?`;
    $("#alert").dialog({
      resizable: false,
      title: "Remove " + type,
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          Ice.removeIce(isGlacier ? "glacier" : "iceberg", index);
          redrawIce();
          $("#iceEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function dragElement() {
    const isGlacier = elSelected.attr("type") === "iceShield";
    const idx = +elSelected.attr("data-index");
    const initialTransform = parseTransform(this.getAttribute("transform"));
    const dx = initialTransform[0] - d3.event.x;
    const dy = initialTransform[1] - d3.event.y;

    d3.event.on("drag", function () {
      const x = d3.event.x;
      const y = d3.event.y;
      const transform = `translate(${dx + x},${dy + y})`;
      this.setAttribute("transform", transform);
      
      // Update data model with new position
      const offset = [dx + x, dy + y];
      const iceData = isGlacier ? pack.ice.glaciers[idx] : pack.ice.icebergs[idx];
      if (iceData) {
        // Store offset for visual positioning, actual geometry stays in points
        iceData.offset = offset;
      }
    });
  }

  function closeEditor() {
    ice.selectAll("*").classed("draggable", false).call(d3.drag().on("drag", null));
    clearMainTip();
    iceNew.classList.remove("pressed");
    unselect();
    // Clean up handlers
    if (modules.editIce && typeof modules.editIce === "object") {
      modules.editIce = false;
    }
  }
}

