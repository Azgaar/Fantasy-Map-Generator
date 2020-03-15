"use strict";
function overviewMilitary() {
  if (customization) return;
  closeDialogs("#militaryOverview, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();

  const body = document.getElementById("militaryBody");
  addLines();
  $("#militaryOverview").dialog();

  if (modules.overviewMilitary) return;
  modules.overviewMilitary = true;
  updateHeaders();

  $("#militaryOverview").dialog({
    title: "Military Overview", resizable: false, width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("militaryOverviewRefresh").addEventListener("click", addLines);
  document.getElementById("militaryOptionsButton").addEventListener("click", militaryCustomize);
  document.getElementById("militaryOverviewRecalculate").addEventListener("click", militaryRecalculate);
  document.getElementById("militaryExport").addEventListener("click", downloadMilitaryData);

  body.addEventListener("change", function(ev) {
    const el = ev.target, line = el.parentNode, state = +line.dataset.id, type = el.dataset.type;
    if (type && type !== "alert") changeForces(state, line, type, +el.value); else
    if (type === "alert") changeAlert(state, line, +el.value);
  });

  // update military types in header and tooltips
  function updateHeaders() {
    const header = document.getElementById("militaryHeader");
    header.querySelectorAll(".removable").forEach(el => el.remove());
    const insert = html => document.getElementById("militaryTotal").insertAdjacentHTML("beforebegin", html);
    for (const u of options.military) {
      const label = capitalize(u.name.replace(/_/g, ' '));
      insert(`<div data-tip="State ${u.name} units number. Click to sort" class="sortable removable" data-sortby="${u.name}">${label}&nbsp;</div>`);
    }
    header.querySelectorAll(".removable").forEach(function(e) {
      e.addEventListener("click", function() {sortLines(this);});
    });
  }

  // add line for each state
  function addLines() {
    body.innerHTML = "";
    let lines = "";
    const states = pack.states.filter(s => s.i && !s.removed);

    for (const s of states) {
      const population = rn((s.rural + s.urban * urbanization.value) * populationRate.value);
      const getForces = u => s.military.reduce((s, r) => s+(r.u[u.name]||0), 0);
      const total = options.military.reduce((s, u) => s + getForces(u) * u.crew, 0);
      const rate = total / population * 100;

      const sortData = options.military.map(u => `data-${u.name}="${getForces(u)}"`).join(" ");
      const lineData = options.military.map(u => `<input data-type="${u.name}" data-tip="State ${u.name} units number" type="number" min=0 step=1 value="${getForces(u)}">`).join(" ");

      lines += `<div class="states" data-id=${s.i} data-state="${s.name}" ${sortData} data-total="${total}" data-population="${population}" data-rate="${rate}" data-alert="${s.alert}">
        <svg data-tip="${s.fullName}" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${s.color}" class="fillRect"></svg>
        <input data-tip="${s.fullName}" style="width:6em" value="${s.name}" readonly>
        ${lineData}
        <div data-type="total" data-tip="Total state military personnel (considering crew)"><b>${si(total)}</b></div>
        <div data-tip="State population">${si(population)}</div>
        <div data-type="rate" data-tip="Military personnel rate (% of state population). Depends on war alert">${rn(rate, 2)}%</div>
        <input data-type="alert" data-tip="War Alert. Modifier to military forces number, depends of political situation" type="number" min=0 step=.01 value="${rn(s.alert, 2)}">
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);
    updateFooter();

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => stateHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => stateHighlightOff(ev)));
    applySorting(militaryHeader);
  }

  function changeForces(state, line, type, value) {
    const s = pack.states[state];
    if (!s.military.alert) {tip("Value won't be applied as War Alert is 0. Change Alert value to positive first", false, "error"); return;}

    line.dataset[type] = value;
    s.military[type] = value / populationRate.value / s.military.alert;
    updateTotal(s.military, line);
    updateFooter();
  }

  function changeAlert(state, line, alert) {
    const s = pack.states[state];
    s.military.alert = line.dataset.alert = alert;
    const getForces = u => rn(s.military[u.name] * alert * populationRate.value)||0;
    options.military.forEach(u => line.dataset[u.name] = line.querySelector(`input[data-type='${u.name}']`).value = getForces(u));
    updateTotal(s.military, line);
    updateFooter();
  }

  function updateTotal(m, line) {
    line.dataset.total = rn(d3.sum(options.military.map(u => (m[u.name]||0) * u.crew)) * m.alert * populationRate.value);
    line.dataset.rate = line.dataset.total / line.dataset.population * 100;
    line.querySelector("div[data-type='total']>b").innerHTML = si(line.dataset.total);
    line.querySelector("div[data-type='rate']").innerHTML = rn(line.dataset.rate, 2) + "%";
  }

  function updateFooter() {
    const lines = Array.from(body.querySelectorAll(":scope > div"));
    const statesNumber = militaryFooterStates.innerHTML = pack.states.filter(s => s.i && !s.removed).length;
    militaryFooterForces.innerHTML = si(d3.sum(lines.map(el => el.dataset.total)) / statesNumber);
    militaryFooterRate.innerHTML = rn(d3.sum(lines.map(el => el.dataset.rate)) / statesNumber, 2) + "%";
    militaryFooterAlert.innerHTML = rn(d3.sum(lines.map(el => el.dataset.alert)) / statesNumber, 2);
  }

  function stateHighlightOn(event) {
    if (!layerIsOn("toggleStates")) return;
    const state = +event.target.dataset.id;
    if (customization || !state) return;
    const path = regions.select("#state"+state).attr("d");
    debug.append("path").attr("class", "highlight").attr("d", path)
      .attr("fill", "none").attr("stroke", "red").attr("stroke-width", 1).attr("opacity", 1)
      .attr("filter", "url(#blur1)").call(transition);
  }

  function transition(path) {
    const duration = (path.node().getTotalLength() + 5000) / 2;
    path.transition().duration(duration).attrTween("stroke-dasharray", tweenDash);
  }

  function tweenDash() {
    const l = this.getTotalLength();
    const i = d3.interpolateString("0," + l, l + "," + l);
    return t => i(t);
  }

  function removePath(path) {
    path.transition().duration(1000).attr("opacity", 0).remove();
  }

  function stateHighlightOff() {
    debug.selectAll(".highlight").each(function(el) {
      d3.select(this).call(removePath);
    });
  }

  function militaryCustomize() {
    const types = ["default", "melee", "ranged", "mounted", "machinery", "naval"];
    const table = document.getElementById("militaryOptions").querySelector("tbody");
    removeUnitLines();
    options.military.map(u => addUnitLine(u));

    $("#militaryOptions").dialog({
      title: "Edit Military Units", resizable: false, width: fitContent(),
      position: {my: "center", at: "center", of: "svg"},
      buttons: {
        Apply: function() {applyMilitaryOptions(); $(this).dialog("close");},
        Add: () => addUnitLine({name: "custom", rural: 0.2, urban: 0.5, crew: 1, type: "default"}),
        Restore: restoreDefaultUnits,
        Cancel: function() {$(this).dialog("close");}
      }, open: function() {
        const buttons = $(this).dialog("widget").find(".ui-dialog-buttonset > button");
        buttons[0].addEventListener("mousemove", () => tip("Apply military units settings. All forces will be recalculated!"));
        buttons[1].addEventListener("mousemove", () => tip("Add new military unit to the table"));
        buttons[2].addEventListener("mousemove", () => tip("Restore default military units and settings"));
        buttons[3].addEventListener("mousemove", () => tip("Close the window without saving the changes"));
      }
    });

    function removeUnitLines() {
      table.querySelectorAll("tr").forEach(el => el.remove());
    }

    function addUnitLine(u) {
      const row = `<tr>
        <td><input data-tip="Type unit name. If name is changed for existing unit, old unit will be replaced" value="${u.name}"></td>
        <td><input data-tip="Enter conscription percentage for rural population" type="number" min=0 max=100 step=.01 value="${u.rural}"></td>
        <td><input data-tip="Enter conscription percentage for urban population" type="number" min=0 max=100 step=.01 value="${u.urban}"></td>
        <td><input data-tip="Enter average number of people in crew" type="number" min=1 step=1 value="${u.crew}"></td>
        <td><select data-tip="Select unit type to apply special rules on forces recalculation">${types.map(t => `<option ${u.type === t ? "selected" : ""} value="${t}">${t}</option>`).join(" ")}</select></td>
        <td data-tip="Check if unit is separate and can be stacked only with units of the same type">
          <input id="${u.name}Separate" type="checkbox" class="checkbox" checked=${u.separate}>
          <label for="${u.name}Separate" class="checkbox-label"></label>
        </td>
        <td data-tip="Remove the unit"><span data-tip="Remove unit type" class="icon-trash-empty pointer" onclick="this.parentElement.parentElement.remove();"></span></td>
      </tr>`;
      table.insertAdjacentHTML("beforeend", row);
    }

    function restoreDefaultUnits() {
      removeUnitLines();
      [{name:"infantry", rural:.25, urban:.2, crew:1, type:"melee", separate:0},
      {name:"archers", rural:.12, urban:.2, crew:1, type:"ranged", separate:0},
      {name:"cavalry", rural:.12, urban:.03, crew:3, type:"mounted", separate:0},
      {name:"artillery", rural:0, urban:.03, crew:8, type:"machinery", separate:0},
      {name:"fleet", rural:0, urban:.015, crew:100, type:"naval", separate:1}].map(u => addUnitLine(u));
    }

    function applyMilitaryOptions() {
      options.military = Array.from(table.querySelectorAll("tr")).map(r => {
        const [name, rural, urban, crew, type, separate] = Array.from(r.querySelectorAll("input, select")).map(d => d.value||d.checked);
        return {name:name.replace(/[&\/\\#, +()$~%.'":*?<>{}]/g, '_'), rural:+rural||0, urban:+urban||0, crew:+crew||0, type, separate:+separate||0};
      });
      localStorage.setItem("military", JSON.stringify(options.military));
      calculateMilitaryForces();
      updateHeaders();
      addLines();
    }

  }

  function militaryRecalculate() {
    calculateMilitaryForces();
    addLines();
  }

  function downloadMilitaryData() {
    const units = options.military.map(u => u.name);
    let data = "Id,State,"+units.map(u => capitalize(u)).join(",")+",Total,Population,Rate,War Alert\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.state + ",";
      data += units.map(u => el.dataset[u]).join(",") + ",";
      data += el.dataset.total + ",";
      data += el.dataset.population + ",";
      data += el.dataset.rate + ",";
      data += el.dataset.alert + "\n";
    });

    const name = getFileName("Military") + ".csv";
    downloadFile(data, name);
  }

}