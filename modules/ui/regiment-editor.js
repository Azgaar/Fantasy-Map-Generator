"use strict";
function editRegiment() {
  if (customization) return;
  closeDialogs(".stable");
  // if (!layerIsOn("toggleArmies")) toggleArmies();

  armies.selectAll(":scope > g").classed("draggable", true);
  armies.selectAll(":scope > g > g").call(d3.drag().on("drag", dragRegiment));
  elSelected = d3.event.target;
  if (!pack.states[elSelected.dataset.state]) return;
  if (!regiment()) return;
  updateRegimentData(regiment());
  drawBase();

  $("#regimentEditor").dialog({
    title: "Edit Regiment", resizable: false, close: closeEditor,
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeEditor
  });

  if (modules.editRegiment) return;
  modules.editRegiment = true;

  // add listeners
  document.getElementById("regimentNameRestore").addEventListener("click", restoreName);
  document.getElementById("regimentType").addEventListener("click", changeType);
  document.getElementById("regimentName").addEventListener("change", changeName);
  document.getElementById("regimentRegenerateLegend").addEventListener("click", regenerateLegend);
  document.getElementById("regimentLegend").addEventListener("click", editLegend);
  document.getElementById("regimentSplit").addEventListener("click", splitRegiment);
  document.getElementById("regimentAdd").addEventListener("click", toggleAdd);
  document.getElementById("regimentAttach").addEventListener("click", toggleAttach);
  document.getElementById("regimentRemove").addEventListener("click", removeRegiment);

  // get regiment data element
  function regiment() {
    return pack.states[elSelected.dataset.state].military.find(r => r.i == elSelected.dataset.id);
  }

  function updateRegimentData(regiment) {
    document.getElementById("regimentType").className = regiment.n ? "icon-anchor" :"icon-users";
    document.getElementById("regimentName").value = regiment.name;
    const composition = document.getElementById("regimentComposition");

    composition.innerHTML = options.military.map(u => {
      return `<div data-tip="${capitalize(u.name)} number. Input to change">
        <div class="label">${capitalize(u.name)}:</div>
        <input data-u="${u.name}" type="number" min=0 step=1 value="${(regiment.u[u.name]||0)}">
        <i>${u.type}</i></div>`
    }).join("");

    composition.querySelectorAll("input").forEach(el => el.addEventListener("change", changeUnit));
  }

  function drawBase() {
    const reg = regiment();
    const tr = parseTransform(elSelected.parentNode.getAttribute("transform"));
    const tx = +tr[0], ty = +tr[1];
    const x2 = +elSelected.nextSibling.getAttribute("x"), y2 = +elSelected.nextSibling.getAttribute("y");

    const clr = pack.states[elSelected.dataset.state].color;
    const base = viewbox.insert("g", "g#armies").attr("id", "regimentBase");
    base.on("mouseenter", d => {tip("Regiment base. Drag to re-base the regiment", true);}).on("mouseleave", d => {tip('', true);});

    base.append("line").attr("x1", reg.x).attr("y1", reg.y).attr("x2", x2+tx).attr("y2", y2+ty).attr("class", "dragLine");
    base.append("circle").attr("cx", reg.x).attr("cy", reg.y).attr("r", 2).attr("fill", clr).call(d3.drag().on("drag", dragBase));
  }

  function changeType() {
    const reg = regiment();
    reg.n = +!reg.n;
    document.getElementById("regimentType").className = reg.n ? "icon-anchor" :"icon-users";

    const size = 3;
    elSelected.setAttribute("x", reg.n ? reg.x-size*2 : reg.x-size*3);
    elSelected.setAttribute("width", reg.n ? size*4 : size*6);
  }

  function changeName() {
    elSelected.dataset.name = regiment().name = this.value;
  }

  function restoreName() {
    const reg = regiment(), regs = pack.states[elSelected.dataset.state].military;
    const name = Military.getName(reg, regs);
    elSelected.dataset.name = reg.name = document.getElementById("regimentName").value = name;
  }

  function changeUnit() {
    const u = this.dataset.u;
    const reg = regiment();
    reg.u[u] = (+this.value)||0;
    reg.a = d3.sum(Object.values(reg.u));
    elSelected.nextSibling.innerHTML = reg.a;
    if (militaryOverviewRefresh.offsetParent) militaryOverviewRefresh.click();
  }

  function splitRegiment() {
    const reg = regiment(), u1 = reg.u;
    const state = elSelected.dataset.state, military = pack.states[state].military;
    const i = last(military).i + 1, u2 = Object.assign({}, u1); // u clone

    Object.keys(u1).forEach(u => u1[u] = Math.ceil(u1[u]/2)); // halved old reg
    Object.keys(u2).forEach(u => u2[u] = Math.floor(u2[u]/2)); // halved new reg
    reg.a = d3.sum(Object.values(u1)); // old reg total
    const a = d3.sum(Object.values(u2)); // new reg total

    const newReg = {a, cell:reg.cell, i, n:reg.n, u:u2, x:reg.x, y:reg.y};
    newReg.name = Military.getName(newReg, military);
    military.push(newReg);

    elSelected.parentNode.remove(); // undraw old reg
    Military.drawRegiment(reg, state, reg.x, reg.y-6); // draw old reg above
    Military.drawRegiment(newReg, state, reg.x, reg.y+6); // draw new reg below

    $("#regimentEditor").dialog("close");
  }

  function toggleAdd() {
    document.getElementById("regimentAdd").classList.toggle("pressed");
    if (document.getElementById("regimentAdd").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", addRegimentOnClick);
      tip("Click on map to create new regiment or fleet", true);
    } else {
      clearMainTip();
      viewbox.on("click", clicked).style("cursor", "default");
    }
  }

  function addRegimentOnClick() {
    const point = d3.mouse(this);
    const cell = findCell(point[0], point[1]);
    const x = pack.cells.p[cell][0], y = pack.cells.p[cell][1];
    const state = elSelected.dataset.state, military = pack.states[state].military;
    const i = military.length ? last(military).i + 1 : 0;
    const n = +(pack.cells.h[cell] < 20); // naval or land
    const reg = {a:0, cell, i, n, u:{}, x, y};
    reg.name = Military.getName(reg, military);
    military.push(reg);
    Military.drawRegiment(reg, state);
    toggleAdd();
  }

  function toggleAttach() {
    document.getElementById("regimentAttach").classList.toggle("pressed");
    if (document.getElementById("regimentAttach").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", attachRegimentOnClick);
      tip("Click on another regiment to unite both regiments. The current regiment will be removed", true);
      armies.selectAll(":scope > g").classed("draggable", false);
    } else {
      clearMainTip();
      armies.selectAll(":scope > g").classed("draggable", true);
      viewbox.on("click", clicked).style("cursor", "default");
    }
  }

  function attachRegimentOnClick() {
    const target = d3.event.target, army = target.parentElement.parentElement;

    if (army.parentElement.id !== "armies") {
      tip("Please click on a regiment", false, "error");
      return;
    }

    if (target === elSelected) {
      tip("Cannot attach regiment to itself. Please click on another regiment", false, "error");
      return;
    }

    if (army !== elSelected.parentElement.parentElement) {
      tip("Cannot attach this regiment to regiment of other state", false, "error");
      return;
    };
    
    const reg = regiment(); // reg to be attached
    const sel = pack.states[target.dataset.state].military.find(r => r.i == target.dataset.id); // reg to attach to

    for (const unit of options.military) {
      const u = unit.name;
      if (reg.u[u]) sel.u[u] ? sel.u[u] += reg.u[u] : sel.u[u] = reg.u[u];
    }
    sel.a = d3.sum(Object.values(sel.u)); // reg total
    target.nextSibling.innerHTML = sel.a; // update selected reg total text

    // remove attached regiment
    const military = pack.states[elSelected.dataset.state].military;
    military.splice(military.indexOf(reg), 1);
    const index = notes.findIndex(n => n.id === elSelected.parentNode.id);
    if (index != -1) notes.splice(index, 1);
    elSelected.parentNode.remove();

    $("#regimentEditor").dialog("close");
  }

  function regenerateLegend() {
    const index = notes.findIndex(n => n.id === elSelected.parentNode.id);
    if (index != -1) notes.splice(index, 1);

    const s = pack.states[elSelected.dataset.state];
    Military.generateNote(regiment(), s);
  }

  function editLegend() {
    editNotes(elSelected.parentNode.id, regiment().name);
  }

  function removeRegiment() {
    alertMessage.innerHTML = "Are you sure you want to remove the regiment?";
    $("#alert").dialog({resizable: false, title: "Remove regiment",
      buttons: {
        Remove: function() {
          $(this).dialog("close");
          const military = pack.states[elSelected.dataset.state].military;
          const regIndex = military.indexOf(regiment());
          if (regIndex === -1) return;
          military.splice(regIndex, 1);

          const index = notes.findIndex(n => n.id === elSelected.parentNode.id);
          if (index != -1) notes.splice(index, 1);
          elSelected.parentNode.remove();

          if (militaryOverviewRefresh.offsetParent) militaryOverviewRefresh.click();
          $("#regimentEditor").dialog("close");
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });
  }

  function dragRegiment() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;
    d3.select(this).raise();
    d3.select(this.parentNode).raise();

    const self = elSelected.parentNode === this;
    const baseLine = viewbox.select("g#regimentBase > line");
    const x2 = +elSelected.nextSibling.getAttribute("x");
    const y2 = +elSelected.nextSibling.getAttribute("y");

    d3.event.on("drag", function() {
      const x = dx + d3.event.x, y = dy + d3.event.y;
      this.setAttribute("transform", `translate(${(x)},${(y)})`);
      if (self) baseLine.attr("x2", x2+x).attr("y2", y2+y);
    });
  }

  function dragBase() {
    const tr = parseTransform(this.getAttribute("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;
    const baseLine = viewbox.select("g#regimentBase > line");

    d3.event.on("drag", function() {
      const x = dx + d3.event.x, y = dy + d3.event.y;
      this.setAttribute("transform", `translate(${(x)},${(y)})`);
      baseLine.attr("x1", d3.event.x).attr("y1", d3.event.y);
    });

    d3.event.on("end", function() {
      const reg = regiment();
      const x = d3.event.x, y = d3.event.y, cell = findCell(x, y);
      reg.cell = cell, reg.x = x, reg.y = y;

    });
  }

  function closeEditor() {
    armies.selectAll(":scope > g").classed("draggable", false);
    armies.selectAll("g>g").call(d3.drag().on("drag", null));
    viewbox.select("g#regimentBase").remove();
    document.getElementById("regimentAdd").classList.remove("pressed");
    document.getElementById("regimentAttach").classList.remove("pressed");
    restoreDefaultEvents();
    elSelected = null;
  }

}