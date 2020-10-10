"use strict";
function editReliefIcon() {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRelief")) toggleRelief();

  terrain.selectAll("use").call(d3.drag().on("drag", dragReliefIcon)).classed("draggable", true);
  elSelected = d3.select(d3.event.target);

  restoreEditMode();
  updateReliefIconSelected();
  updateReliefSizeInput();

  $("#reliefEditor").dialog({
    title: "Edit Relief Icons", resizable: false, width: "27em",
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeReliefEditor
  });

  if (modules.editReliefIcon) return;
  modules.editReliefIcon = true;

  // add listeners
  document.getElementById("reliefIndividual").addEventListener("click", enterIndividualMode);
  document.getElementById("reliefBulkAdd").addEventListener("click", enterBulkAddMode);
  document.getElementById("reliefBulkRemove").addEventListener("click", enterBulkRemoveMode);

  document.getElementById("reliefSize").addEventListener("input", changeIconSize);
  document.getElementById("reliefSizeNumber").addEventListener("input", changeIconSize);
  document.getElementById("reliefEditorSet").addEventListener("change", changeIconsSet);
  reliefIconsDiv.querySelectorAll("svg").forEach(el => el.addEventListener("click", changeIcon));

  document.getElementById("reliefEditStyle").addEventListener("click", () => editStyle("terrain"));
  document.getElementById("reliefCopy").addEventListener("click", copyIcon);
  document.getElementById("reliefMoveFront").addEventListener("click", () => elSelected.raise());
  document.getElementById("reliefMoveBack").addEventListener("click", () => elSelected.lower());
  document.getElementById("reliefRemove").addEventListener("click", removeIcon);

  function dragReliefIcon() {
    const dx = +this.getAttribute("x") - d3.event.x;
    const dy = +this.getAttribute("y") - d3.event.y;

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      this.setAttribute("x", dx+x);
      this.setAttribute("y", dy+y);
    });
  }

  function restoreEditMode() {
    if (!reliefTools.querySelector("button.pressed")) enterIndividualMode(); else
    if (reliefBulkAdd.classList.contains("pressed")) enterBulkAddMode(); else
    if (reliefBulkRemove.classList.contains("pressed")) enterBulkRemoveMode();
  }

  function updateReliefIconSelected() {
    const type = elSelected.attr("data-type");
    const button = reliefIconsDiv.querySelector("svg[data-type='"+type+"']");

    reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => b.classList.remove("pressed"));
    button.classList.add("pressed");
    reliefIconsDiv.querySelectorAll("div").forEach(b => b.style.display = "none");
    button.parentNode.style.display = "block";
    reliefEditorSet.value = button.parentNode.dataset.type;
  }

  function updateReliefSizeInput() {
    const size = +elSelected.attr("data-size");
    reliefSize.value = reliefSizeNumber.value = rn(size);
  }

  function enterIndividualMode() {
    reliefTools.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
    reliefIndividual.classList.add("pressed");

    reliefSizeDiv.style.display = "block";
    reliefRadiusDiv.style.display = "none";
    reliefSpacingDiv.style.display = "none";
    reliefIconsSeletionAny.style.display = "none";

    updateReliefSizeInput();
    restoreDefaultEvents();
    clearMainTip();
  }

  function enterBulkAddMode() {
    reliefTools.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
    reliefBulkAdd.classList.add("pressed");

    reliefSizeDiv.style.display = "block";
    reliefRadiusDiv.style.display = "block";
    reliefSpacingDiv.style.display = "block";
    reliefIconsSeletionAny.style.display = "none";

    const pressedType = reliefIconsDiv.querySelector("svg.pressed");
    if (pressedType.id === "reliefIconsSeletionAny") { // in "any" is pressed, select first type
      reliefIconsSeletionAny.classList.remove("pressed");
      reliefIconsDiv.querySelector("svg").classList.add("pressed");
    }

    viewbox.style("cursor", "crosshair").call(d3.drag().on("start", dragToAdd)).on("touchmove mousemove", moveBrush);
    tip("Drag to place relief icons within radius", true);
  }

  function moveBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +reliefRadiusNumber.value;
    moveCircle(point[0], point[1], radius);
  }

  function dragToAdd() {
    const pressed = reliefIconsDiv.querySelector("svg.pressed");
    if (!pressed) {tip("Please select an icon", false, error); return;}

    const type = pressed.dataset.type;
    const r = +reliefRadiusNumber.value;
    const spacing = +reliefSpacingNumber.value;
    const size = +reliefSizeNumber.value;

    // build a quadtree
    const tree = d3.quadtree();
    const positions = [];
    terrain.selectAll("use").each(function() {
      const x = +this.getAttribute("x") + this.getAttribute("width") / 2;
      const y = +this.getAttribute("y") + this.getAttribute("height") / 2;
      tree.add([x, y, x]);
      const box = this.getBBox();
      positions.push(box.y + box.height);
    });

    d3.event.on("drag", function() {
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      d3.range(Math.ceil(r/10)).forEach(function() {
        const a = Math.PI * 2 * Math.random();
        const rad = r * Math.random();
        const cx = p[0] + rad * Math.cos(a);
        const cy = p[1] + rad * Math.sin(a);

        if (tree.find(cx, cy, spacing)) return; // too close to existing icon
        if (pack.cells.h[findCell(cx, cy)] < 20) return; // on water cell

        const h = rn(size / 2 * (Math.random() * .4 + .8), 2);
        const x = rn(cx-h, 2);
        const y = rn(cy-h, 2);
        const z = y + h * 2;

        let nth = 1;
        while (positions[nth] && z > positions[nth]) {nth++;}

        tree.add([cx, cy]);
        positions.push(z);
        terrain.insert("use", ":nth-child("+nth+")").attr("xlink:href", type).attr("data-type", type)
          .attr("x", x).attr("y", y).attr("data-size", h*2).attr("width", h*2).attr("height", h*2);
      });

    });
  }

  function enterBulkRemoveMode() {
    reliefTools.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
    reliefBulkRemove.classList.add("pressed");

    reliefSizeDiv.style.display = "none";
    reliefRadiusDiv.style.display = "block";
    reliefSpacingDiv.style.display = "none";
    reliefIconsSeletionAny.style.display = "inline-block";

    viewbox.style("cursor", "crosshair").call(d3.drag().on("start", dragToRemove)).on("touchmove mousemove", moveBrush);;
    tip("Drag to remove relief icons in radius", true);
  }

  function dragToRemove() {
    const pressed = reliefIconsDiv.querySelector("svg.pressed");
    if (!pressed) {tip("Please select an icon", false, error); return;}

    const r = +reliefRadiusNumber.value;
    const type = pressed.dataset.type;
    const icons = type ? terrain.selectAll("use[data-type='"+type+"']") : terrain.selectAll("use");
    const tree = d3.quadtree();
    icons.each(function() {
      const x = +this.getAttribute("x") + this.getAttribute("width") / 2;
      const y = +this.getAttribute("y") + this.getAttribute("height") / 2;
      tree.add([x, y, this]);
    });

    d3.event.on("drag", function() {
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);
      tree.findAll(p[0], p[1], r).forEach(f => f[2].remove());
    });
  }

  function changeIconSize() {
    const size = +reliefSizeNumber.value;
    if (!reliefIndividual.classList.contains("pressed")) return;

    const shift = (size - +elSelected.attr("width")) / 2;
    elSelected.attr("width", size).attr("height", size).attr("data-size", size);
    const x = +elSelected.attr("x"), y = +elSelected.attr("y");
    elSelected.attr("x", x-shift).attr("y", y-shift);
  }

  function changeIconsSet() {
    const set = reliefEditorSet.value;
    reliefIconsDiv.querySelectorAll("div").forEach(b => b.style.display = "none");
    reliefIconsDiv.querySelector("div[data-type='" + set + "']").style.display = "block";
  }

  function changeIcon() {
    if (this.classList.contains("pressed")) return;

    reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => b.classList.remove("pressed"))
    this.classList.add("pressed");

    if (reliefIndividual.classList.contains("pressed")) {
      const type = this.dataset.type;
      elSelected.attr("xlink:href", type).attr("data-type", type);
    }
  }

  function copyIcon() {
    const parent = elSelected.node().parentNode;
    const copy = elSelected.node().cloneNode(true);

    let x = +elSelected.attr("x") - 3, y = +elSelected.attr("y") - 3;
    while (parent.querySelector("[x='"+x+"']","[x='"+y+"']")) {
      x -= 3; y -= 3;
    }

    copy.setAttribute("x", x);
    copy.setAttribute("y", y);
    parent.insertBefore(copy, null);
  }

  function removeIcon() {
    alertMessage.innerHTML = `Are you sure you want to remove the icon?`;
    $("#alert").dialog({resizable: false, title: "Remove relief icon",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          elSelected.remove();
          $("#reliefEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function closeReliefEditor() {
    terrain.selectAll("use").call(d3.drag().on("drag", null)).classed("draggable", false);
    removeCircle();
    unselect();
    clearMainTip();
  }
}
