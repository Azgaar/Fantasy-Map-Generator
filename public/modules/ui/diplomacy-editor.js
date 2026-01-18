"use strict";
function editDiplomacy() {
  if (customization) return;
  if (pack.states.filter(s => s.i && !s.removed).length < 2)
    return tip("There should be at least 2 states to edit the diplomacy", false, "error");

  const body = document.getElementById("diplomacyBodySection");

  closeDialogs("#diplomacyEditor, .stable");
  if (!layerIsOn("toggleStates")) toggleStates();
  if (!layerIsOn("toggleBorders")) toggleBorders();
  if (layerIsOn("toggleProvinces")) toggleProvinces();
  if (layerIsOn("toggleCultures")) toggleCultures();
  if (layerIsOn("toggleBiomes")) toggleBiomes();
  if (layerIsOn("toggleReligions")) toggleReligions();

  const relations = {
    Ally: {
      inText: "is an ally of",
      color: "#00b300",
      tip: "Allies formed a defensive pact and protect each other in case of third party aggression"
    },
    Friendly: {
      inText: "is friendly to",
      color: "#d4f8aa",
      tip: "State is friendly to anouther state when they share some common interests"
    },
    Neutral: {
      inText: "is neutral to",
      color: "#edeee8",
      tip: "Neutral means states relations are neither positive nor negative"
    },
    Suspicion: {
      inText: "is suspicious of",
      color: "#eeafaa",
      tip: "Suspicion means state has a cautious distrust of another state"
    },
    Enemy: {inText: "is at war with", color: "#e64b40", tip: "Enemies are states at war with each other"},
    Unknown: {
      inText: "does not know about",
      color: "#a9a9a9",
      tip: "Relations are unknown if states do not have enough information about each other"
    },
    Rival: {
      inText: "is a rival of",
      color: "#ad5a1f",
      tip: "Rivalry is a state of competing for dominance in the region"
    },
    Vassal: {inText: "is a vassal of", color: "#87CEFA", tip: "Vassal is a state having obligation to its suzerain"},
    Suzerain: {
      inText: "is suzerain to",
      color: "#00008B",
      tip: "Suzerain is a state having some control over its vassals"
    }
  };

  refreshDiplomacyEditor();
  viewbox.style("cursor", "crosshair").on("click", selectStateOnMapClick);

  if (modules.editDiplomacy) return;
  modules.editDiplomacy = true;

  $("#diplomacyEditor").dialog({
    title: "Diplomacy Editor",
    resizable: false,
    width: fitContent(),
    close: closeDiplomacyEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });

  // add listeners
  document.getElementById("diplomacyEditorRefresh").addEventListener("click", refreshDiplomacyEditor);
  document.getElementById("diplomacyEditStyle").addEventListener("click", () => editStyle("regions"));
  document.getElementById("diplomacyRegenerate").addEventListener("click", regenerateRelations);
  document.getElementById("diplomacyReset").addEventListener("click", resetRelations);
  document.getElementById("diplomacyShowMatrix").addEventListener("click", showRelationsMatrix);
  document.getElementById("diplomacyHistory").addEventListener("click", showRelationsHistory);
  document.getElementById("diplomacyExport").addEventListener("click", downloadDiplomacyData);

  body.addEventListener("click", function (ev) {
    const el = ev.target;
    if (el.parentElement.classList.contains("Self")) return;

    if (el.classList.contains("changeRelations")) {
      const line = el.parentElement;
      const subjectId = +line.dataset.id;
      const objectId = +body.querySelector("div.Self").dataset.id;
      const currentRelation = line.dataset.relations;

      selectRelation(subjectId, objectId, currentRelation);
      return;
    }

    // select state of clicked line
    body.querySelector("div.Self").classList.remove("Self");
    el.parentElement.classList.add("Self");
    refreshDiplomacyEditor();
  });

  function refreshDiplomacyEditor() {
    diplomacyEditorAddLines();
    showStateRelations();
  }

  // add line for each state
  function diplomacyEditorAddLines() {
    const states = pack.states;
    const selectedLine = body.querySelector("div.Self");
    const selectedId = selectedLine ? +selectedLine.dataset.id : states.find(s => s.i && !s.removed).i;
    const selectedName = states[selectedId].name;

    COArenderer.trigger("stateCOA" + selectedId, states[selectedId].coa);
    let lines = /* html */ `<div class="states Self" data-id=${selectedId} data-tip="List below shows relations to ${selectedName}">
      <div style="width: max-content">${states[selectedId].fullName}</div>
      <svg class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${selectedId}"></use></svg>
    </div>`;

    for (const state of states) {
      if (!state.i || state.removed || state.i === selectedId) continue;
      const relation = state.diplomacy[selectedId];
      const {color, inText} = relations[relation];

      const tip = `${state.name} ${inText} ${selectedName}`;
      const tipSelect = `${tip}. Click to see relations to ${state.name}`;
      const tipChange = `Click to change relations. ${tip}`;

      const name = state.fullName.length < 23 ? state.fullName : state.name;
      COArenderer.trigger("stateCOA" + state.i, state.coa);

      lines += /* html */ `<div class="states" data-id=${state.i} data-name="${name}" data-relations="${relation}">
        <svg data-tip="${tipSelect}" class="coaIcon" viewBox="0 0 200 200"><use href="#stateCOA${state.i}"></use></svg>
        <div data-tip="${tipSelect}" style="width: 12em">${name}</div>
        <div data-tip="${tipChange}" class="changeRelations" style="width: 6em">
          <fill-box fill="${color}" size=".9em"></fill-box>
          ${relation}
        </div>
      </div>`;
    }
    body.innerHTML = lines;

    // add listeners
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseenter", ev => stateHighlightOn(ev)));
    body.querySelectorAll("div.states").forEach(el => el.addEventListener("mouseleave", ev => stateHighlightOff(ev)));

    applySorting(diplomacyHeader);
    $("#diplomacyEditor").dialog();
  }

  function stateHighlightOn(event) {
    if (!layerIsOn("toggleStates")) return;
    const state = +event.target.dataset.id;
    if (customization || !state) return;
    const d = regions.select("#state" + state).attr("d");

    const path = debug
      .append("path")
      .attr("class", "highlight")
      .attr("d", d)
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-width", 1)
      .attr("opacity", 1)
      .attr("filter", "url(#blur1)");

    const l = path.node().getTotalLength(),
      dur = (l + 5000) / 2;
    const i = d3.interpolateString("0," + l, l + "," + l);
    path
      .transition()
      .duration(dur)
      .attrTween("stroke-dasharray", function () {
        return t => i(t);
      });
  }

  function stateHighlightOff(event) {
    debug.selectAll(".highlight").each(function () {
      d3.select(this).transition().duration(1000).attr("opacity", 0).remove();
    });
  }

  function showStateRelations() {
    const selectedLine = body.querySelector("div.Self");
    const sel = selectedLine ? +selectedLine.dataset.id : pack.states.find(s => s.i && !s.removed).i;
    if (!sel) return;
    if (!layerIsOn("toggleStates")) toggleStates();

    statesBody.selectAll("path").each(function () {
      if (this.id.slice(0, 9) === "state-gap") return; // exclude state gap element
      const id = +this.id.slice(5); // state id

      const relation = pack.states[id].diplomacy[sel];
      const color = relations[relation]?.color || "#4682b4";

      this.setAttribute("fill", color);
      statesBody.select("#state-gap" + id).attr("stroke", color);
      statesHalo.select("#state-border" + id).attr("stroke", d3.color(color).darker().hex());
    });
  }

  function selectStateOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    const state = pack.cells.state[i];
    if (!state) return;
    const selectedLine = body.querySelector("div.Self");
    if (+selectedLine.dataset.id === state) return;

    selectedLine.classList.remove("Self");
    body.querySelector("div[data-id='" + state + "']").classList.add("Self");
    refreshDiplomacyEditor();
  }

  function selectRelation(subjectId, objectId, currentRelation) {
    const states = pack.states;
    const subject = states[subjectId];

    const relationsSelector = Object.entries(relations)
      .map(
        ([relation, {color, inText, tip}]) => /* html */ `
          <div data-tip="${tip}">
            <label class="pointer">
              <input type="radio" name="relationSelect" value="${relation}"
              ${currentRelation === relation && "checked"} >
              <fill-box fill="${color}" size=".8em"></fill-box>
              ${inText}
          </label>
          </div>
        `
      )
      .join("");

    const objectsSelector = states
      .filter(s => s.i && !s.removed && s.i !== subjectId)
      .map(
        s => /* html */ `
          <div data-tip="${s.fullName}">
            <input id="selectState${s.i}" class="checkbox" type="checkbox" name="objectSelect" value="${s.i}"
            ${s.i === objectId && "checked"} />
            <label for="selectState${s.i}" class="checkbox-label">
              <svg class="coaIcon" viewBox="0 0 200 200">
                <use href="#stateCOA${s.i}"></use>
              </svg>
              ${s.fullName}
            </label>
          </div>
        `
      )
      .join("");

    alertMessage.innerHTML = /* html */ `
      <form id='relationsForm' style="overflow: hidden; display: flex; flex-direction: column; gap: .3em; padding: 0.1em 0;">
        <header>
          <svg class="coaIcon" viewBox="0 0 200 200">
            <use href="#stateCOA${subject.i}"></use>
          </svg>
          <b>${subject.fullName}</b>
        </header>

        <main style='display: flex; gap: 1em;'>
          <section style="display: flex; flex-direction: column; gap: .3em;">${relationsSelector}</section>
          <section style="display: flex; flex-direction: column; gap: .3em;">${objectsSelector}</section>
        </main>
      </form>
    `;

    $("#alert").dialog({
      width: fitContent(),
      title: `Change relations`,
      buttons: {
        Apply: function () {
          const formData = new FormData(byId("relationsForm"));
          const newRelation = formData.get("relationSelect");
          const objectIds = [...formData.getAll("objectSelect")].map(Number);

          for (const objectId of objectIds) {
            changeRelation(subjectId, objectId, currentRelation, newRelation);
          }
          $(this).dialog("close");
        },
        Cancel: function () {
          $(this).dialog("close");
        }
      }
    });
  }

  function changeRelation(subjectId, objectId, oldRelation, newRelation) {
    if (newRelation === oldRelation) return;
    const states = pack.states;
    const chronicle = states[0].diplomacy;

    const subjectName = states[subjectId].name;
    const objectName = states[objectId].name;

    states[subjectId].diplomacy[objectId] = newRelation;
    states[objectId].diplomacy[subjectId] =
      newRelation === "Vassal" ? "Suzerain" : newRelation === "Suzerain" ? "Vassal" : newRelation;

    // update relation history
    const change = () => [
      `Relations change`,
      `${subjectName}-${getAdjective(objectName)} relations changed to ${newRelation.toLowerCase()}`
    ];
    const ally = () => [`Defence pact`, `${subjectName} entered into defensive pact with ${objectName}`];
    const vassal = () => [`Vassalization`, `${subjectName} became a vassal of ${objectName}`];
    const suzerain = () => [`Vassalization`, `${subjectName} vassalized ${objectName}`];
    const rival = () => [`Rivalization`, `${subjectName} and ${objectName} became rivals`];
    const unknown = () => [
      `Relations severance`,
      `${subjectName} recalled their ambassadors and wiped all the records about ${objectName}`
    ];
    const war = () => [`War declaration`, `${subjectName} declared a war on its enemy ${objectName}`];
    const peace = () => {
      const treaty = `${subjectName} and ${objectName} agreed to cease fire and signed a peace treaty`;
      const changed =
        newRelation === "Ally"
          ? ally()
          : newRelation === "Vassal"
          ? vassal()
          : newRelation === "Suzerain"
          ? suzerain()
          : newRelation === "Unknown"
          ? unknown()
          : change();
      return [`War termination`, treaty, changed[1]];
    };

    if (oldRelation === "Enemy") chronicle.push(peace());
    else if (newRelation === "Enemy") chronicle.push(war());
    else if (newRelation === "Vassal") chronicle.push(vassal());
    else if (newRelation === "Suzerain") chronicle.push(suzerain());
    else if (newRelation === "Ally") chronicle.push(ally());
    else if (newRelation === "Unknown") chronicle.push(unknown());
    else if (newRelation === "Rival") chronicle.push(rival());
    else chronicle.push(change());

    refreshDiplomacyEditor();
    if (diplomacyMatrix.offsetParent) {
      document.getElementById("diplomacyMatrixBody").innerHTML = "";
      showRelationsMatrix();
    }
  }

  function regenerateRelations() {
    States.generateDiplomacy();
    refreshDiplomacyEditor();
  }

  function resetRelations() {
    const selectedId = +body.querySelector("div.Self")?.dataset?.id;
    if (!selectedId) return;
    const states = pack.states;

    states[selectedId].diplomacy.forEach((relations, index) => {
      if (relations !== "x") {
        states[selectedId].diplomacy[index] = "Neutral";
        states[index].diplomacy[selectedId] = "Neutral";
      }
    });

    refreshDiplomacyEditor();
  }

  function showRelationsHistory() {
    const chronicle = pack.states[0].diplomacy;

    let message = /* html */ `<div autocorrect="off" spellcheck="false">`;
    chronicle.forEach((entry, index) => {
      message += `<div>`;
      entry.forEach((l, entryIndex) => {
        message += /* html */ `<div contenteditable="true" data-id="${index}-${entryIndex}"
          ${entryIndex ? "" : "style='font-weight:bold'"}>${l}</div>`;
      });
      message += `&#8205;</div>`;
    });

    if (!chronicle.length) {
      pack.states[0].diplomacy = [[]];
      message += /* html */ `<div><div contenteditable="true" data-id="0-0">No historical records</div>&#8205;</div>`;
    }

    alertMessage.innerHTML =
      message +
      `</div><div class="info-line">Type to edit. Press Enter to add a new line, empty the element to remove it</div>`;
    alertMessage
      .querySelectorAll("div[contenteditable='true']")
      .forEach(el => el.addEventListener("input", changeReliationsHistory));

    $("#alert").dialog({
      title: "Relations history",
      position: {my: "center", at: "center", of: "svg"},
      buttons: {
        Save: function () {
          const data = this.querySelector("div").innerText.split("\n").join("\r\n");
          const name = getFileName("Relations history") + ".txt";
          downloadFile(data, name);
        },
        Clear: function () {
          pack.states[0].diplomacy = [];
          $(this).dialog("close");
        },
        Close: function () {
          $(this).dialog("close");
        }
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
    const valid = states.map(state => state.i);
    const diplomacyMatrixBody = document.getElementById("diplomacyMatrixBody");

    let table = `<table><thead><tr><th data-tip='&#8205;'></th>`;
    table += states.map(state => `<th data-tip='Relations to ${state.fullName}'>${state.name}</th>`).join("") + `</tr>`;
    table += `<tbody>`;

    states.forEach(state => {
      table +=
        `<tr data-id=${state.i}><th data-tip='Relations of ${state.fullName}'>${state.name}</th>` +
        state.diplomacy
          .filter((v, i) => valid.includes(i))
          .map((relation, index) => {
            const relationObj = relations[relation];
            if (!relationObj) return `<td class='${relation}'>${relation}</td>`;

            const objectState = pack.states[valid[index]];
            const tip = `${state.fullName} ${relationObj.inText} ${objectState.fullName}`;
            return `<td data-id=${objectState.i} data-tip='${tip}' class='${relation}'>${relation}</td>`;
          })
          .join("") +
        "</tr>";
    });

    table += `</tbody></table>`;
    diplomacyMatrixBody.innerHTML = table;

    const tableEl = diplomacyMatrixBody.querySelector("table");
    tableEl.addEventListener("click", function (event) {
      const el = event.target;
      if (el.tagName !== "TD") return;

      const currentRelation = el.innerText;
      if (!relations[currentRelation]) return;

      const subjectId = +el.closest("tr")?.dataset?.id;
      const objectId = +el?.dataset?.id;

      selectRelation(subjectId, objectId, currentRelation);
    });

    $("#diplomacyMatrix").dialog({
      title: "Relations matrix",
      position: {my: "center", at: "center", of: "svg"},
      buttons: {}
    });
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
    if (layerIsOn("toggleStates")) drawStates();
    else toggleStates();
    debug.selectAll(".highlight").remove();
  }
}
