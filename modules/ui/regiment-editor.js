"use strict";
function editRegiment(selector) {
  if (customization) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleMilitary")) toggleMilitary();

  armies.selectAll(":scope > g").classed("draggable", true);
  armies.selectAll(":scope > g > g").call(d3.drag().on("drag", dragRegiment));
  elSelected = selector ? document.querySelector(selector) : d3.event.target.parentElement; // select g element
  if (!pack.states[elSelected.dataset.state]) return;
  if (!regiment()) return;
  updateRegimentData(regiment());
  drawBase();

  $("#regimentEditor").dialog({
    title: "Edit Regiment",
    resizable: false,
    close: closeEditor,
    position: {my: "left top", at: "left+10 top+10", of: "#map"}
  });

  if (fmg.modules.editRegiment) return;
  fmg.modules.editRegiment = true;

  // add listeners
  document.getElementById("regimentNameRestore").addEventListener("click", restoreName);
  document.getElementById("regimentType").addEventListener("click", changeType);
  document.getElementById("regimentName").addEventListener("change", changeName);
  document.getElementById("regimentEmblem").addEventListener("input", changeEmblem);
  document.getElementById("regimentEmblemSelect").addEventListener("click", selectEmblem);
  document.getElementById("regimentAttack").addEventListener("click", toggleAttack);
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
    document.getElementById("regimentType").className = regiment.n ? "icon-anchor" : "icon-users";
    document.getElementById("regimentName").value = regiment.name;
    document.getElementById("regimentEmblem").value = regiment.icon;
    const composition = document.getElementById("regimentComposition");

    composition.innerHTML = options.military
      .map(u => {
        return `<div data-tip="${capitalize(u.name)} number. Input to change">
        <div class="label">${capitalize(u.name)}:</div>
        <input data-u="${u.name}" type="number" min=0 step=1 value="${regiment.u[u.name] || 0}">
        <i>${u.type}</i></div>`;
      })
      .join("");

    composition.querySelectorAll("input").forEach(el => el.addEventListener("change", changeUnit));
  }

  function drawBase() {
    const reg = regiment();
    const clr = pack.states[elSelected.dataset.state].color;
    const base = viewbox
      .insert("g", "g#armies")
      .attr("id", "regimentBase")
      .attr("stroke-width", 0.3)
      .attr("stroke", "#000")
      .attr("cursor", "move");
    base
      .on("mouseenter", () => {
        tip("Regiment base. Drag to re-base the regiment", true);
      })
      .on("mouseleave", () => {
        tip("", true);
      });

    base
      .append("line")
      .attr("x1", reg.bx)
      .attr("y1", reg.by)
      .attr("x2", reg.x)
      .attr("y2", reg.y)
      .attr("class", "regimentDragLine");
    base
      .append("circle")
      .attr("cx", reg.bx)
      .attr("cy", reg.by)
      .attr("r", 2)
      .attr("fill", clr)
      .call(d3.drag().on("drag", dragBase));
  }

  function changeType() {
    const reg = regiment();
    reg.n = +!reg.n;
    document.getElementById("regimentType").className = reg.n ? "icon-anchor" : "icon-users";

    const size = +armies.attr("box-size");
    const baseRect = elSelected.querySelectorAll("rect")[0];
    const iconRect = elSelected.querySelectorAll("rect")[1];
    const icon = elSelected.querySelector(".regimentIcon");
    const x = reg.n ? reg.x - size * 2 : reg.x - size * 3;
    baseRect.setAttribute("x", x);
    baseRect.setAttribute("width", reg.n ? size * 4 : size * 6);
    iconRect.setAttribute("x", x - size * 2);
    icon.setAttribute("x", x - size);
    elSelected.querySelector("text").innerHTML = Military.getTotal(reg);
  }

  function changeName() {
    elSelected.dataset.name = regiment().name = this.value;
  }

  function restoreName() {
    const reg = regiment(),
      regs = pack.states[elSelected.dataset.state].military;
    const name = Military.getName(reg, regs);
    elSelected.dataset.name = reg.name = document.getElementById("regimentName").value = name;
  }

  function selectEmblem() {
    selectIcon(regimentEmblem.value, v => {
      regimentEmblem.value = v;
      changeEmblem();
    });
  }

  function changeEmblem() {
    const emblem = document.getElementById("regimentEmblem").value;
    regiment().icon = elSelected.querySelector(".regimentIcon").innerHTML = emblem;
  }

  function changeUnit() {
    const u = this.dataset.u;
    const reg = regiment();
    reg.u[u] = +this.value || 0;
    reg.a = d3.sum(Object.values(reg.u));
    elSelected.querySelector("text").innerHTML = Military.getTotal(reg);
    if (militaryOverviewRefresh.offsetParent) militaryOverviewRefresh.click();
    if (regimentsOverviewRefresh.offsetParent) regimentsOverviewRefresh.click();
  }

  function splitRegiment() {
    const reg = regiment(),
      u1 = reg.u;
    const state = +elSelected.dataset.state,
      military = pack.states[state].military;
    const i = last(military).i + 1,
      u2 = Object.assign({}, u1); // u clone

    Object.keys(u2).forEach(u => (u2[u] = Math.floor(u2[u] / 2))); // halved new reg
    const a = d3.sum(Object.values(u2)); // new reg total
    if (!a) {
      tip("Not enough forces to split", false, "error");
      return;
    } // nothing to add

    // update old regiment
    Object.keys(u1).forEach(u => (u1[u] = Math.ceil(u1[u] / 2))); // halved old reg
    reg.a = d3.sum(Object.values(u1)); // old reg total
    regimentComposition.querySelectorAll("input").forEach(el => (el.value = reg.u[el.dataset.u] || 0));
    elSelected.querySelector("text").innerHTML = Military.getTotal(reg);

    // create new regiment
    const shift = +armies.attr("box-size") * 2;
    const y = function (x, y) {
      do {
        y += shift;
      } while (military.find(r => r.x === x && r.y === y));
      return y;
    };
    const newReg = {
      a,
      cell: reg.cell,
      i,
      n: reg.n,
      u: u2,
      x: reg.x,
      y: y(reg.x, reg.y),
      bx: reg.bx,
      by: reg.by,
      state,
      icon: reg.icon
    };
    newReg.name = Military.getName(newReg, military);
    military.push(newReg);
    Military.generateNote(newReg, pack.states[state]); // add legend
    Military.drawRegiment(newReg, state); // draw new reg below

    if (regimentsOverviewRefresh.offsetParent) regimentsOverviewRefresh.click();
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
    const x = pack.cells.p[cell][0],
      y = pack.cells.p[cell][1];
    const state = +elSelected.dataset.state,
      military = pack.states[state].military;
    const i = military.length ? last(military).i + 1 : 0;
    const n = +(pack.cells.h[cell] < 20); // naval or land
    const reg = {a: 0, cell, i, n, u: {}, x, y, bx: x, by: y, state, icon: "🛡️"};
    reg.name = Military.getName(reg, military);
    military.push(reg);
    Military.generateNote(reg, pack.states[state]); // add legend
    Military.drawRegiment(reg, state);
    if (regimentsOverviewRefresh.offsetParent) regimentsOverviewRefresh.click();
    toggleAdd();
  }

  function toggleAttack() {
    document.getElementById("regimentAttack").classList.toggle("pressed");
    if (document.getElementById("regimentAttack").classList.contains("pressed")) {
      viewbox.style("cursor", "crosshair").on("click", attackRegimentOnClick);
      tip("Click on another regiment to initiate battle", true);
      armies.selectAll(":scope > g").classed("draggable", false);
    } else {
      clearMainTip();
      armies.selectAll(":scope > g").classed("draggable", true);
      viewbox.on("click", clicked).style("cursor", "default");
    }
  }

  function attackRegimentOnClick() {
    const target = d3.event.target,
      regSelected = target.parentElement,
      army = regSelected.parentElement;
    const oldState = +elSelected.dataset.state,
      newState = +regSelected.dataset.state;

    if (army.parentElement.id !== "armies") {
      tip("Please click on a regiment to attack", false, "error");
      return;
    }
    if (regSelected === elSelected) {
      tip("Regiment cannot attack itself", false, "error");
      return;
    }
    if (oldState === newState) {
      tip("Cannot attack fraternal regiment", false, "error");
      return;
    }

    const attacker = regiment();
    const defender = pack.states[regSelected.dataset.state].military.find(r => r.i == regSelected.dataset.id);
    if (!attacker.a || !defender.a) {
      tip("Regiment has no troops to battle", false, "error");
      return;
    }

    // save initial position to temp attribute
    (attacker.px = attacker.x), (attacker.py = attacker.y);
    (defender.px = defender.x), (defender.py = defender.y);

    // move attacker to defender
    Military.moveRegiment(attacker, defender.x, defender.y - 8);

    // draw battle icon
    const attack = d3
      .transition()
      .delay(300)
      .duration(700)
      .ease(d3.easeSinInOut)
      .on("end", () => new Battle(attacker, defender));
    svg
      .append("text")
      .attr("x", window.innerWidth / 2)
      .attr("y", window.innerHeight / 2)
      .text("⚔️")
      .attr("font-size", 0)
      .attr("opacity", 1)
      .style("dominant-baseline", "central")
      .style("text-anchor", "middle")
      .transition(attack)
      .attr("font-size", 1000)
      .attr("opacity", 0.2)
      .remove();

    clearMainTip();
    $("#regimentEditor").dialog("close");
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
    const target = d3.event.target,
      regSelected = target.parentElement,
      army = regSelected.parentElement;
    const oldState = +elSelected.dataset.state,
      newState = +regSelected.dataset.state;

    if (army.parentElement.id !== "armies") {
      tip("Please click on a regiment", false, "error");
      return;
    }
    if (regSelected === elSelected) {
      tip("Cannot attach regiment to itself. Please click on another regiment", false, "error");
      return;
    }

    const reg = regiment(); // reg to be attached
    const sel = pack.states[newState].military.find(r => r.i == regSelected.dataset.id); // reg to attach to

    for (const unit of options.military) {
      const u = unit.name;
      if (reg.u[u]) sel.u[u] ? (sel.u[u] += reg.u[u]) : (sel.u[u] = reg.u[u]);
    }
    sel.a = d3.sum(Object.values(sel.u)); // reg total
    regSelected.querySelector("text").innerHTML = Military.getTotal(sel); // update selected reg total text

    // remove attached regiment
    const military = pack.states[oldState].military;
    military.splice(military.indexOf(reg), 1);
    const index = notes.findIndex(n => n.id === elSelected.id);
    if (index != -1) notes.splice(index, 1);
    elSelected.remove();

    if (regimentsOverviewRefresh.offsetParent) regimentsOverviewRefresh.click();
    $("#regimentEditor").dialog("close");
    editRegiment("#" + regSelected.id);
  }

  function regenerateLegend() {
    const index = notes.findIndex(n => n.id === elSelected.id);
    if (index != -1) notes.splice(index, 1);

    const s = pack.states[elSelected.dataset.state];
    Military.generateNote(regiment(), s);
  }

  function editLegend() {
    editNotes(elSelected.id, regiment().name);
  }

  function removeRegiment() {
    alertMessage.innerHTML = "Are you sure you want to remove the regiment?";
    $("#alert").dialog({
      resizable: false,
      title: "Remove regiment",
      buttons: {
        Remove: function () {
          $(this).dialog("close");
          const military = pack.states[elSelected.dataset.state].military;
          const regIndex = military.indexOf(regiment());
          if (regIndex === -1) return;
          military.splice(regIndex, 1);

          const index = notes.findIndex(n => n.id === elSelected.id);
          if (index != -1) notes.splice(index, 1);
          elSelected.remove();

          if (militaryOverviewRefresh.offsetParent) militaryOverviewRefresh.click();
          if (regimentsOverviewRefresh.offsetParent) regimentsOverviewRefresh.click();
          $("#regimentEditor").dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function dragRegiment() {
    d3.select(this).raise();
    d3.select(this.parentNode).raise();

    const reg = pack.states[this.dataset.state].military.find(r => r.i == this.dataset.id);
    const size = +armies.attr("box-size");
    const w = reg.n ? size * 4 : size * 6;
    const h = size * 2;
    const x1 = x => rn(x - w / 2, 2);
    const y1 = y => rn(y - size, 2);

    const baseRect = this.querySelector("rect");
    const text = this.querySelector("text");
    const iconRect = this.querySelectorAll("rect")[1];
    const icon = this.querySelector(".regimentIcon");

    const self = elSelected === this;
    const baseLine = viewbox.select("g#regimentBase > line");

    d3.event.on("drag", function () {
      const x = (reg.x = d3.event.x),
        y = (reg.y = d3.event.y);

      baseRect.setAttribute("x", x1(x));
      baseRect.setAttribute("y", y1(y));
      text.setAttribute("x", x);
      text.setAttribute("y", y);
      iconRect.setAttribute("x", x1(x) - h);
      iconRect.setAttribute("y", y1(y));
      icon.setAttribute("x", x1(x) - size);
      icon.setAttribute("y", y);
      if (self) baseLine.attr("x2", x).attr("y2", y);
    });
  }

  function dragBase() {
    const baseLine = viewbox.select("g#regimentBase > line");
    const reg = regiment();

    d3.event.on("drag", function () {
      this.setAttribute("cx", d3.event.x);
      this.setAttribute("cy", d3.event.y);
      baseLine.attr("x1", d3.event.x).attr("y1", d3.event.y);
    });

    d3.event.on("end", function () {
      reg.bx = d3.event.x;
      reg.by = d3.event.y;
    });
  }

  function closeEditor() {
    armies.selectAll(":scope > g").classed("draggable", false);
    armies.selectAll("g>g").call(d3.drag().on("drag", null));
    viewbox.selectAll("g#regimentBase").remove();
    document.getElementById("regimentAdd").classList.remove("pressed");
    document.getElementById("regimentAttack").classList.remove("pressed");
    document.getElementById("regimentAttach").classList.remove("pressed");
    restoreDefaultEvents();
    elSelected = null;
  }
}
