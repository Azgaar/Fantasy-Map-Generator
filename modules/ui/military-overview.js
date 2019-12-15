"use strict";
function overviewMilitary() {
  if (customization) return;
  closeDialogs("#militaryOverview, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();

  const body = document.getElementById("militaryBody");
  militaryOverviewAddLines();
  $("#militaryOverview").dialog();

  if (modules.overviewMilitary) return;
  modules.overviewMilitary = true;

  $("#militaryOverview").dialog({
    title: "Military Overview", resizable: false, width: fitContent(),
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("militaryOverviewRefresh").addEventListener("click", militaryOverviewAddLines);
  document.getElementById("militaryExport").addEventListener("click", downloadMilitaryData);

  // add line for each river
  function militaryOverviewAddLines() {
    body.innerHTML = "";
    let lines = "", militaryTotal = 0;

    const states = pack.states.filter(s => s.i && !s.removed);
    const popRate = +populationRate.value;

    for (const s of states) {
      const total = (s.military.infantry + s.military.cavalry + s.military.archers + s.military.fleet / 10);
      const rate = total / (s.rural + s.urban * urbanization.value) * 100;
      militaryTotal += total;

      lines += `<div class="states" data-id=${s.i} data-state="${s.name}" data-infantry="${s.military.infantry}"
          data-archers="${s.military.archers}" data-cavalry="${s.military.cavalry}" data-reserve="${s.military.reserve}"
          data-fleet="${s.military.fleet}" data-rate="${rate}" data-total="${total}">
        <svg data-tip="State color" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${s.color}" class="fillRect"></svg>
        <input data-tip="State name" class="stateName" value="${s.name}" readonly>

        <input data-tip="State infantry number" type="number" class="militaryArmy" min=0 step=1 value="${rn(s.military.infantry * popRate)}">
        <input data-tip="State archers number" type="number" class="militaryArmy" min=0 step=1 value="${rn(s.military.archers * popRate)}">
        <input data-tip="State cavalry number" type="number" class="militaryArmy" min=0 step=1 value="${rn(s.military.cavalry * popRate)}">
        <input data-tip="Number of ships in state navy" class="militaryFleet" type="number" min=0 step=1 value="${s.military.fleet}">

        <div data-tip="Total military personnel (including ships crew)">${si(total * popRate)}</div>
        <div data-tip="Armed forces personnel (% of state population). Depends on diplomatic situation">${rn(rate, 2)}%</div>
        <div data-tip="State manpower (reserve)">${si(s.military.reserve * popRate)}</div>
      </div>`;
    }
    body.insertAdjacentHTML("beforeend", lines);

    // update footer
    militaryFooterStates.innerHTML = states.length;
    militaryFooterAverage.innerHTML = si(militaryTotal / states.length * popRate);

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => stateHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => stateHighlightOff(ev)));
    applySorting(militaryHeader);
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

  function downloadMilitaryData() {
    let data = "Id,River,Type,Length,Basin\n"; // headers

    body.querySelectorAll(":scope > div").forEach(function(el) {
      data += el.dataset.id + ",";
      data += el.dataset.name + ",";
      data += el.dataset.type + ",";
      data += el.querySelector(".biomeArea").innerHTML + ",";
      data += el.dataset.basin + "\n";
    });

    const name = getFileName("Military") + ".csv";
    downloadFile(data, name);
  }

}
