"use strict";
function editDiplomacy() {
  if (customization) return;
  if (pack.states.filter(s => s.i && !s.removed).length < 2) {
    tip("There should be at least 2 states to edit the diplomacy", false, "Error");
    return;
  }

  closeDialogs("#diplomacyEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleProvinces")) toggleProvinces();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();

  const body = document.getElementById("diplomacyBodySection");
  const statuses = ["Ally", "Friendly", "Neutral", "Suspicion", "Enemy", "Unknown", "Rival", "Vassal", "Suzerain"];
  const colors = ["#00b300", "#d4f8aa", "#edeee8", "#f3c7c4", "#e64b40", "#a9a9a9", "#ad5a1f", "#87CEFA", "#00008B"];
  refreshDiplomacyEditor();

  tip("Click on a state to see its diplomatic relations", false, "warning");
  viewbox.style("cursor", "crosshair").on("click", selectStateOnMapClick);

  if (modules.editDiplomacy) return;
  modules.editDiplomacy = true;

  $("#diplomacyEditor").dialog({
    title: "Diplomacy Editor", resizable: false, width: fitContent(), close: closeDiplomacyEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("diplomacyEditorRefresh").addEventListener("click", refreshDiplomacyEditor);
  document.getElementById("diplomacyRegenerate").addEventListener("click", regenerateRelations);
  document.getElementById("diplomacyMatrix").addEventListener("click", showRelationsMatrix);
  document.getElementById("diplomacyHistory").addEventListener("click", showRelationsHistory);
  document.getElementById("diplomacyExport").addEventListener("click", downloadDiplomacyData);

  function refreshDiplomacyEditor() {
    diplomacyEditorAddLines();
    showStateRelations();
  }

  // add line for each state
  function diplomacyEditorAddLines() {
    const states = pack.states;
    const selectedLine = body.querySelector("div.Self");
    const sel = selectedLine ? +selectedLine.dataset.id : states.find(s => s.i && !s.removed).i;

    let lines = `<div class="states Self" data-id=${sel}>
      <div data-tip="Selected state" style="width: 100%">${states[sel].fullName}</div>
    </div>`;

    for (const s of states) {
      if (!s.i || s.removed || s.i === sel) continue;
      const color = colors[statuses.indexOf(s.diplomacy[sel])];

      lines += `<div class="states" data-id=${s.i} data-name="${s.fullName}" data-relations="${s.diplomacy[sel]}">
        <div data-tip="Click to show relations for this state" class="stateName">${s.fullName}</div>
        <input data-tip="Relations color" class="stateColor" type="color" value="${color}" disabled>
        <select data-tip="Diplomacal relations. Click to change" class="diplomacyRelations">${getRelations(s.diplomacy[sel])}</select>
      </div>`;
    }
    body.innerHTML = lines;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => stateHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => stateHighlightOff(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("click", selectStateOnLineClick));
    body.querySelectorAll("div > select.diplomacyRelations").forEach(el => el.addEventListener("click", ev => ev.stopPropagation()));
    body.querySelectorAll("div > select.diplomacyRelations").forEach(el => el.addEventListener("change", diplomacyChangeRelations));

    applySorting(diplomacyHeader);
    $("#diplomacyEditor").dialog();
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

  function getRelations(relations) {
    let options = "";
    statuses.forEach(s => options += `<option ${relations === s ? "selected" : ""} value="${s}">${s}</option>`);
    return options;
  }

  function showStateRelations() {
    const selectedLine = body.querySelector("div.Self");
    const sel = selectedLine ? +selectedLine.dataset.id : pack.states.find(s => s.i && !s.removed).i;
    if (!sel) return;
    if (!layerIsOn("toggleStates")) toggleStates();

    statesBody.selectAll("path").each(function() {
      if (this.id.slice(0, 9) === "state-gap") return; // exclude state gap element
      const id = +this.id.slice(5); // state id
      const index = statuses.indexOf(pack.states[id].diplomacy[sel]); // status index
      const clr = index !== -1 ? colors[index] : "#4682b4"; // Self (bluish)
      this.setAttribute("fill", clr);
      statesBody.select("#state-gap"+id).attr("stroke", clr);
      statesHalo.select("#state-border"+id).attr("stroke", d3.color(clr).darker().hex());
    });
  }

  function selectStateOnLineClick() {
    if (this.classList.contains("Self")) return;
    body.querySelector("div.Self").classList.remove("Self");
    this.classList.add("Self");
    refreshDiplomacyEditor();
  }

  function selectStateOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    const state = pack.cells.state[i];
    if (!state) return;
    const selectedLine = body.querySelector("div.Self");
    if (+selectedLine.dataset.id === state) return;

    selectedLine.classList.remove("Self");
    body.querySelector("div[data-id='"+state+"']").classList.add("Self");
    refreshDiplomacyEditor();
  }

  function diplomacyChangeRelations() {
    const states = pack.states;
    const selectedLine = body.querySelector("div.Self");
    const sel = selectedLine ? +selectedLine.dataset.id : states.find(s => s.i && !s.removed).i;
    if (!sel) return;
    const state = +this.parentNode.dataset.id;
    const rel = this.value, oldRel = states[state].diplomacy[sel];
    states[state].diplomacy[sel] = rel;
    this.parentNode.dataset.relations = rel;
    
    const statusTo = rel === "Vassal" ? "Suzerain" : rel === "Suzerain" ? "Vassal" : rel;
    states[sel].diplomacy[state] = statusTo;

    // update relation history
    const change = [`Relations change`, `${states[sel].name}-${trimVowels(states[state].name)}ian relations changed to ${rel}`];
    const vassal = [`Vassalization`, `${states[state].name} became a vassal of ${states[sel].name}`];
    const vassalized = [`Vassalization`, `${states[state].name} vassalized ${states[sel].name}`];
    const war = [`War declaration`, `${states[sel].name} declared a war on its enemy ${states[state].name}`];
    const peace = [`War termination`, `${states[sel].name} and ${states[state].name} agreed to cease fire and signed a peace treaty`];
    peace.push(rel === "Vassal" ? vassal[1] : rel === "Suzerain" ? vassalized[1] : change[1]);

    if (oldRel === "Enemy") states[0].diplomacy.push(peace);
    else states[0].diplomacy.push(rel === "Vassal" ? vassal : rel === "Suzerain" ? vassalized : rel === "Enemy" ? war : change);

    const color = colors[statuses.indexOf(rel)];
    this.parentNode.querySelector("input.stateColor").value = color;
    showStateRelations();
  }

  function regenerateRelations() {
    BurgsAndStates.generateDiplomacy();
    refreshDiplomacyEditor();
  }

  function showRelationsHistory() {
    const chronicle = pack.states[0].diplomacy;
    if (!chronicle.length) {tip("Relations history is blank", false, "error"); return;}

    let message = `<div autocorrect="off" spellcheck="false">`;
    chronicle.forEach((e, d) => {
      message += `<div>`;
      e.forEach((l, i) => message += `<div contenteditable="true" data-id="${d}-${i}"${i ? "" : " style='font-weight:bold'"}>${l}</div>`);
      message += `&#8205;</div>`;
    });
    alertMessage.innerHTML = message + `</div><i id="info-line">Type to edit. Press Enter to add a new line, empty the element to remove it</i>`;
    alertMessage.querySelectorAll("div[contenteditable='true']").forEach(el => el.addEventListener("input", changeReliationsHistory));

    $("#alert").dialog({title: "Relations history", position: {my: "center", at: "center", of: "svg"},
      buttons: {
        Save: function() {
          const text = this.querySelector("div").innerText.split("\n").join("\r\n");
          const dataBlob = new Blob([text], {type: "text/plain"});
          const url = window.URL.createObjectURL(dataBlob);
          const link = document.createElement("a");
          document.body.appendChild(link);
          link.download = "state_relations_history" + Date.now() + ".txt";
          link.href = url;
          link.click();
          window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
        },
        Clear: function() {pack.states[0].diplomacy = []; $(this).dialog("close");},
        Close: function() {$(this).dialog("close");}
      }
    });
  }

  function changeReliationsHistory() {
    const i = this.dataset.id.split("-");
    const group = pack.states[0].diplomacy[i[0]];
    if (this.innerHTML === "") {
      group.splice(i[1], 1);
      this.remove();
    } else group[i[1]] = this.innerHTML;
  }

  function showRelationsMatrix() {
    const states = pack.states.filter(s => s.i && !s.removed);
    const valid = states.map(s => s.i);

    let message = `<table class="matrix-table"><tr><th></th>`;
    message += states.map(s => `<th>${s.name}</th>`).join("") + `</tr>`; // headers
    states.forEach(s => {
      message += `<tr><th>${s.name}</th>` + s.diplomacy.filter((v, i) => valid.includes(i)).map(r => `<td class='${r}'>${r}</td>`).join("") + "</tr>";
    });
    message += `</table>`;
    alertMessage.innerHTML = message;
    $("#alert").dialog({title: "Relations matrix", width: fitContent(), position: {my: "center", at: "center", of: "svg"}, buttons: {}});
  }

  function downloadDiplomacyData() {
    const states = pack.states.filter(s => s.i && !s.removed);
    const valid = states.map(s => s.i);

    let data = "," + states.map(s => s.name).join(",") + "\n"; // headers
    states.forEach(s => {
      const rels = s.diplomacy.filter((v, i) => valid.includes(i));
      data += s.name + "," + rels.join(",") + "\n";
    });

    const dataBlob = new Blob([data], {type: "text/plain"});
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.download = "state_relations_data" + Date.now() + ".csv";
    link.href = url;
    link.click();
    window.setTimeout(function() {window.URL.revokeObjectURL(url);}, 2000);
  }

  function closeDiplomacyEditor() {
    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector("div.Self");
    if (selected) selected.classList.remove("Self");
    if (layerIsOn("toggleStates")) drawStates(); else toggleStates();
    debug.selectAll(".highlight").remove();
  }
}
