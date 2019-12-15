"use strict";
function editDiplomacy() {
  if (customization) return;
  if (pack.states.filter(s => s.i && !s.removed).length < 2) {
    tip("There should be at least 2 states to edit the diplomacy", false, "error");
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
  const description = [" is an ally of ", " is friendly to ", " is neutral to ", " is suspicious of ", 
    " is at war with ", " does not know about ", " is a rival of ", " is a vassal of ", " is suzerain to "];
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
  document.getElementById("diplomacyEditStyle").addEventListener("click", () => editStyle("regions"));
  document.getElementById("diplomacyRegenerate").addEventListener("click", regenerateRelations);
  document.getElementById("diplomacyMatrix").addEventListener("click", showRelationsMatrix);
  document.getElementById("diplomacyHistory").addEventListener("click", showRelationsHistory);
  document.getElementById("diplomacyExport").addEventListener("click", downloadDiplomacyData);
  document.getElementById("diplomacySelect").addEventListener("click", diplomacyChangeRelations);

  function refreshDiplomacyEditor() {
    diplomacyEditorAddLines();
    showStateRelations();
  }

  // add line for each state
  function diplomacyEditorAddLines() {
    const states = pack.states;
    const selectedLine = body.querySelector("div.Self");
    const sel = selectedLine ? +selectedLine.dataset.id : states.find(s => s.i && !s.removed).i;
    const selName = states[sel].fullName;
    diplomacySelect.style.display = "none";

    let lines = `<div class="states Self" data-id=${sel}>
      <div data-tip="List below shows relations to ${selName}" style="width: 100%">${selName}</div>
    </div>`;

    for (const s of states) {
      if (!s.i || s.removed || s.i === sel) continue;
      const relation = s.diplomacy[sel];
      const index = statuses.indexOf(relation);
      const color = colors[index];
      const tip = s.fullName + description[index] + selName;
      const tipSelect = `${tip}. Click to see relations to ${s.name}`;
      const tipChange = `${tip}. Click to change relations to ${selName}`;

      lines += `<div class="states" data-id=${s.i} data-name="${s.fullName}" data-relations="${relation}">
        <div data-tip="${tipSelect}" style="width:12em">${s.fullName}</div>
        <svg data-tip="${tipChange}" width=".9em" height=".9em" style="margin-bottom:-1px" class="changeRelations">
          <rect x="0" y="0" width="100%" height="100%" fill="${color}" class="fillRect pointer" style="pointer-events: none"></rect>
        </svg>
        <input data-tip="${tipChange}" class="changeRelations diplomacyRelations" value="${relation}" readonly/>
      </div>`;
    }
    body.innerHTML = lines;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => stateHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => stateHighlightOff(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("click", selectStateOnLineClick));
    body.querySelectorAll(".changeRelations").forEach(el => el.addEventListener("click", toggleDiplomacySelect));

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

  function toggleDiplomacySelect(event) {
    event.stopPropagation();
    const select = document.getElementById("diplomacySelect");
    const show = select.style.display === "none";
    if (!show) {select.style.display = "none"; return;}
    select.style.display = "block";
    const input = event.target.closest("div").querySelector("input");
    select.style.left = input.getBoundingClientRect().left + "px";
    select.style.top = input.getBoundingClientRect().bottom + "px";
    body.dataset.state = event.target.closest("div.states").dataset.id;
  }

  function diplomacyChangeRelations(event) {
    event.stopPropagation();
    diplomacySelect.style.display = "none";
    const subject = body.dataset.state;
    const rel = event.target.innerHTML;

    const states = pack.states, chronicle = states[0].diplomacy;
    const selectedLine = body.querySelector("div.Self");
    const object = selectedLine ? +selectedLine.dataset.id : states.find(s => s.i && !s.removed).i;
    if (!object) return;
    const objectName = states[object].name; // object of relations change
    const subjectName = states[subject].name; // subject of relations change - actor

    const oldRel = states[subject].diplomacy[object];
    if (rel === oldRel) return;
    states[subject].diplomacy[object] = rel;
    states[object].diplomacy[subject] = rel === "Vassal" ? "Suzerain" : rel === "Suzerain" ? "Vassal" : rel;

    // update relation history
    const change = () => [`Relations change`, `${subjectName}-${getAdjective(objectName)} relations changed to ${rel.toLowerCase()}`];
    const ally = () => [`Defence pact`, `${subjectName} entered into defensive pact with ${objectName}`];
    const vassal = () => [`Vassalization`, `${subjectName} became a vassal of ${objectName}`];
    const suzerain = () => [`Vassalization`, `${subjectName} vassalized ${objectName}`];
    const rival = () => [`Rivalization`, `${subjectName} and ${objectName} became rivals`];
    const unknown = () => [`Relations severance`, `${subjectName} recalled their ambassadors and wiped all the records about ${objectName}`];
    const war = () => [`War declaration`, `${subjectName} declared a war on its enemy ${objectName}`];
    const peace = () => {
      const treaty = `${subjectName} and ${objectName} agreed to cease fire and signed a peace treaty`;
      const changed = rel === "Ally" ? ally() 
        : rel === "Vassal" ? vassal() 
        : rel === "Suzerain" ? suzerain() 
        : rel === "Unknown" ? unknown() 
        : change();
      return [`War termination`, treaty, changed[1]];
    }

    if (oldRel === "Enemy") chronicle.push(peace()); else
    if (rel === "Enemy") chronicle.push(war()); else
    if (rel === "Vassal") chronicle.push(vassal()); else
    if (rel === "Suzerain") chronicle.push(suzerain()); else
    if (rel === "Ally") chronicle.push(ally()); else
    if (rel === "Unknown") chronicle.push(unknown()); else
    if (rel === "Rival") chronicle.push(rival()); else
    chronicle.push(change());

    refreshDiplomacyEditor();
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
          const data = this.querySelector("div").innerText.split("\n").join("\r\n");
          const name = getFileName("Relations history") + ".txt";
          downloadFile(data, name);
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

    let message = `<table class="matrix-table"><tr><th data-tip='&#8205;'></th>`;
    message += states.map(s => `<th data-tip='See relations to ${s.fullName}'>${s.name}</th>`).join("") + `</tr>`; // headers
    states.forEach(s => {
      message += `<tr><th data-tip='See relations of ${s.fullName}'>${s.name}</th>` + s.diplomacy
        .filter((v, i) => valid.includes(i)).map((r, i) => {
          const desc = description[statuses.indexOf(r)];
          const tip = desc ? s.fullName + desc + pack.states[valid[i]].fullName : '&#8205;';
          return `<td data-tip='${tip}' class='${r}'>${r}</td>`
        }).join("") + "</tr>";
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

    const name = getFileName("Relations") + ".csv";
    downloadFile(data, name);
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
