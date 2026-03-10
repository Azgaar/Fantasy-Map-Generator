"use strict";
function editReliefIcon() {
  if (customization) return;
  closeDialogs(".stable");

  // Switch from WebGL to editable SVG <use> elements
  undrawRelief();
  drawRelief("svg");

  if (!layerIsOn("toggleRelief")) toggleRelief();
  terrain.selectAll("use").call(d3.drag().on("drag", dragReliefIcon)).classed("draggable", true);

  // Click-to-select: delegation on the terrain group covers existing and newly added <use> elements.
  terrain.on("click.reliefSelect", function () {
    if (d3.event.target.tagName !== "use") return;
    if (!reliefIndividual.classList.contains("pressed")) return;
    elSelected = d3.select(d3.event.target);
    updateReliefIconSelected();
    updateReliefSizeInput();
  });

  // When called from the Tools button there is no d3 click event; fall back to the first <use>.
  // When called from a map click, prefer the actual clicked element if it is a <use>.
  const clickTarget = d3.event && d3.event.target;
  const useTarget = clickTarget && clickTarget.tagName === "use" ? clickTarget : terrain.select("use").node();
  elSelected = d3.select(useTarget);

  restoreEditMode();
  updateReliefIconSelected();
  updateReliefSizeInput();

  $("#reliefEditor").dialog({
    title: "Edit Relief Icons",
    resizable: false,
    width: "27em",
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeReliefEditor
  });

  if (modules.editReliefIcon) return;
  modules.editReliefIcon = true;

  // add listeners
  byId("reliefIndividual").addEventListener("click", enterIndividualMode);
  byId("reliefBulkAdd").addEventListener("click", enterBulkAddMode);
  byId("reliefBulkRemove").addEventListener("click", enterBulkRemoveMode);

  byId("reliefSize").addEventListener("input", changeIconSize);
  byId("reliefSizeNumber").addEventListener("input", changeIconSize);
  byId("reliefEditorSet").addEventListener("change", changeIconsSet);
  reliefIconsDiv.querySelectorAll("svg").forEach(el => el.addEventListener("click", changeIcon));

  byId("reliefEditStyle").addEventListener("click", () => editStyle("terrain"));
  byId("reliefCopy").addEventListener("click", copyIcon);
  byId("reliefMoveFront").addEventListener("click", () => elSelected.raise());
  byId("reliefMoveBack").addEventListener("click", () => elSelected.lower());
  byId("reliefRemove").addEventListener("click", removeIcon);

  function dragReliefIcon() {
    const dx = +this.getAttribute("x") - d3.event.x;
    const dy = +this.getAttribute("y") - d3.event.y;

    // initialise from current attrs so "end" has valid values even if drag never fires
    let newX = +this.getAttribute("x");
    let newY = +this.getAttribute("y");

    d3.event.on("drag", function () {
      newX = dx + d3.event.x;
      newY = dy + d3.event.y;
      this.setAttribute("x", newX);
      this.setAttribute("y", newY);
    });

    d3.event.on("end", function () {
      const id = this.dataset.id;
      const icon = pack.relief.find(icon => icon.i === +id);
      if (icon) {
        icon.x = newX;
        icon.y = newY;
      }
    });
  }

  function restoreEditMode() {
    if (!reliefTools.querySelector("button.pressed")) enterIndividualMode();
    else if (reliefBulkAdd.classList.contains("pressed")) enterBulkAddMode();
    else if (reliefBulkRemove.classList.contains("pressed")) enterBulkRemoveMode();
  }

  function updateReliefIconSelected() {
    if (!elSelected.node()) return;
    const type = elSelected.attr("href");
    if (!type) return;
    const button = reliefIconsDiv.querySelector("svg[data-type='" + type + "']");
    if (!button) return;

    reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => b.classList.remove("pressed"));
    button.classList.add("pressed");
    reliefIconsDiv.querySelectorAll("div").forEach(b => (b.style.display = "none"));
    button.parentNode.style.display = "block";
    reliefEditorSet.value = button.parentNode.dataset.type;
  }

  function updateReliefSizeInput() {
    if (!elSelected.node()) return;
    const size = +elSelected.attr("width");
    if (!size) return;
    reliefSize.value = reliefSizeNumber.value = rn(size);
  }

  function enterIndividualMode() {
    reliefTools.querySelectorAll("button.pressed").forEach(b => b.classList.remove("pressed"));
    reliefIndividual.classList.add("pressed");

    reliefSizeDiv.style.display = "block";
    reliefRadiusDiv.style.display = "none";
    reliefSpacingDiv.style.display = "none";
    reliefIconsSeletionAny.style.display = "none";

    removeCircle();
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
    if (!pressedType || pressedType.id === "reliefIconsSeletionAny") {
      // nothing or "any" pressed — select first specific type
      if (pressedType) reliefIconsSeletionAny.classList.remove("pressed");
      reliefIconsDiv.querySelector("svg:not(#reliefIconsSeletionAny)")?.classList.add("pressed");
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
    if (!pressed) return tip("Please select an icon", false, error);

    const type = pressed.dataset.type;
    const r = +reliefRadiusNumber.value;
    const spacing = +reliefSpacingNumber.value;
    const size = +reliefSizeNumber.value;

    // quadtree for spacing checks; positions (sorted by bottom-y) for painter's z-order
    const tree = d3.quadtree();
    const positions = [];
    terrain.selectAll("use").each(function () {
      const cx = +this.getAttribute("x") + this.getAttribute("width") / 2;
      const cy = +this.getAttribute("y") + this.getAttribute("height") / 2;
      tree.add([cx, cy]);
      const box = this.getBBox();
      positions.push(box.y + box.height);
    });
    positions.sort((a, b) => a - b);

    d3.event.on("drag", function () {
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      d3.range(Math.ceil(r / 10)).forEach(function () {
        const a = Math.PI * 2 * Math.random();
        const rad = r * Math.random();
        const cx = p[0] + rad * Math.cos(a);
        const cy = p[1] + rad * Math.sin(a);

        if (tree.find(cx, cy, spacing)) return; // too close to existing icon
        if (pack.cells.h[findCell(cx, cy)] < 20) return; // on water cell

        const h = rn((size / 2) * (Math.random() * 0.4 + 0.8), 2);
        const x = rn(cx - h, 2);
        const y = rn(cy - h, 2);
        const z = y + h * 2;
        const s = rn(h * 2, 2);

        // binary insertion: find first sorted position whose bottom-y exceeds z
        let insertIdx = 0;
        while (insertIdx < positions.length && positions[insertIdx] <= z) insertIdx++;
        positions.splice(insertIdx, 0, z);

        const newIcon = {i: pack.relief.length, href: type, x, y, s};
        pack.relief.push(newIcon);
        tree.add([cx, cy]);

        terrain
          .insert("use", ":nth-child(" + (insertIdx + 1) + ")")
          .attr("data-id", newIcon.i)
          .attr("href", type)
          .attr("x", x)
          .attr("y", y)
          .attr("width", s)
          .attr("height", s)
          .call(d3.drag().on("drag", dragReliefIcon))
          .classed("draggable", true);
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

    viewbox.style("cursor", "crosshair").call(d3.drag().on("start", dragToRemove)).on("touchmove mousemove", moveBrush);
    tip("Drag to remove relief icons in radius", true);
  }

  function dragToRemove() {
    const pressed = reliefIconsDiv.querySelector("svg.pressed");
    if (!pressed) return tip("Please select an icon", false, error);

    const r = +reliefRadiusNumber.value;
    const type = pressed.dataset.type;
    const icons = type ? terrain.selectAll("use[href='" + type + "']") : terrain.selectAll("use");
    const tree = d3.quadtree();
    icons.each(function () {
      const x = +this.getAttribute("x") + this.getAttribute("width") / 2;
      const y = +this.getAttribute("y") + this.getAttribute("height") / 2;
      tree.add([x, y, this]);
    });

    d3.event.on("drag", function () {
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);
      const found = findAllInQuadtree(p[0], p[1], r, tree);
      if (!found.length) return;
      const removedIds = new Set(found.map(f => +f[2].dataset.id));
      found.forEach(f => f[2].remove());
      pack.relief = pack.relief.filter(ic => !removedIds.has(ic.i));
    });
  }

  function changeIconSize(event) {
    if (!reliefIndividual.classList.contains("pressed") || !elSelected.node()) return;

    const size = +event.target.value;
    reliefSize.value = reliefSizeNumber.value = rn(size);

    const shift = (size - +elSelected.attr("width")) / 2;
    const x = rn(+elSelected.attr("x") - shift, 2);
    const y = rn(+elSelected.attr("y") - shift, 2);
    elSelected.attr("width", size).attr("height", size).attr("x", x).attr("y", y);

    const id = +elSelected.node().dataset.id;
    const icon = pack.relief.find(ic => ic.i === id);
    if (icon) {
      icon.s = size;
      icon.x = x;
      icon.y = y;
    }
  }

  function changeIconsSet() {
    const set = reliefEditorSet.value;
    reliefIconsDiv.querySelectorAll("div").forEach(b => (b.style.display = "none"));
    reliefIconsDiv.querySelector("div[data-type='" + set + "']").style.display = "block";
  }

  function changeIcon() {
    if (this.classList.contains("pressed")) return;

    reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => b.classList.remove("pressed"));
    this.classList.add("pressed");

    if (reliefIndividual.classList.contains("pressed") && elSelected.node()) {
      const type = this.dataset.type;
      elSelected.attr("href", type);
      const id = +elSelected.node().dataset.id;
      const icon = pack.relief.find(ic => ic.i === id);
      if (icon) icon.href = type;
    }
  }

  function copyIcon() {
    if (!elSelected.node()) return;
    const parent = elSelected.node().parentNode;
    const copy = elSelected.node().cloneNode(true);

    let x = +elSelected.attr("x") - 3,
      y = +elSelected.attr("y") - 3;
    while (parent.querySelector("[x='" + x + "'][y='" + y + "']")) {
      x -= 3;
      y -= 3;
    }

    const newId = pack.relief.length;
    const href = elSelected.attr("href");
    const s = +elSelected.attr("width");
    copy.setAttribute("x", x);
    copy.setAttribute("y", y);
    copy.dataset.id = String(newId);
    pack.relief.push({i: newId, href, x, y, s});
    parent.insertBefore(copy, null);
    d3.select(copy).call(d3.drag().on("drag", dragReliefIcon)).classed("draggable", true);
  }

  function removeIcon() {
    if (!elSelected.node() && !reliefBulkRemove.classList.contains("pressed")) return;
    let selection = null;
    const pressed = reliefTools.querySelector("button.pressed");
    if (!pressed || pressed.id === "reliefIndividual") {
      alertMessage.innerHTML = "Are you sure you want to remove the icon?";
      selection = elSelected;
    } else {
      const type = reliefIconsDiv.querySelector("svg.pressed")?.dataset.type;
      selection = type ? terrain.selectAll("use[href='" + type + "']") : terrain.selectAll("use");
      const size = selection.size();
      alertMessage.innerHTML = type
        ? `Are you sure you want to remove all ${type} icons (${size})?`
        : `Are you sure you want to remove all icons (${size})?`;
    }

    $("#alert").dialog({
      resizable: false,
      title: "Remove relief icons",
      buttons: {
        Remove: function () {
          if (selection) {
            const idsToRemove = new Set();
            selection.each(function () {
              idsToRemove.add(+this.dataset.id);
            });
            pack.relief = pack.relief.filter(ic => !idsToRemove.has(ic.i));
            selection.remove();
          }
          $(this).dialog("close");
          $("#reliefEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function closeReliefEditor() {
    terrain.on("click.reliefSelect", null);
    terrain.selectAll("use").call(d3.drag().on("drag", null)).classed("draggable", false);
    removeCircle();
    unselect();
    clearMainTip();
    undrawRelief();
    drawRelief();
  }
}
