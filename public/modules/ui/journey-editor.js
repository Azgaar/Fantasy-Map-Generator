"use strict";

function ensurePackJourney() {
  if (!pack.journey || !Array.isArray(pack.journey.points)) pack.journey = {points: []};
}

function journeyMergeSelectHTML(fromIndex) {
  let opts =
    '<option value="">Match stop…</option>';
  const pts = pack.journey.points;
  for (let j = 0; j < pts.length; j++) {
    if (j === fromIndex) continue;
    const pj = pts[j];
    opts += `<option value="${j}">#${j + 1} (${pj[0]}, ${pj[1]})</option>`;
  }
  return opts;
}

function journeyEditorRefreshBody() {
  const body = ensureEl("journeyEditorBody");
  body.innerHTML = "";
  ensurePackJourney();
  pack.journey.points.forEach((pt, i) => {
    body.insertAdjacentHTML(
      "beforeend",
      /* html */ `<div class="editorLine journey-editor-row" style="display:grid;grid-template-columns:auto 1fr 1fr minmax(10em,auto) auto;gap:0.5em 1em;align-items:center" data-index="${i}">
        <span><b>#</b>${i + 1}</span>
        <label style="display:flex;align-items:center;gap:0.35em"><b>X</b><input type="number" step="any" class="journey-coord-input" data-coord="x" value="${pt[0]}" /></label>
        <label style="display:flex;align-items:center;gap:0.35em"><b>Y</b><input type="number" step="any" class="journey-coord-input" data-coord="y" value="${pt[1]}" /></label>
        <select class="journey-merge-select" data-tip="Set this stop to the same map position as another">${journeyMergeSelectHTML(i)}</select>
        <span data-tip="Remove this waypoint" class="icon-trash-empty pointer"></span>
      </div>`,
    );
  });
}

function journeyEditorBodyChange(ev) {
  const t = ev.target;
  const row = t.closest("[data-index]");
  if (!row) return;
  const idx = +row.dataset.index;
  if (!Number.isFinite(idx)) return;

  if (t.classList.contains("journey-merge-select")) {
    const j = +t.value;
    if (t.value === "" || !Number.isFinite(j)) return;
    ensurePackJourney();
    const pts = pack.journey.points;
    if (j < 0 || j >= pts.length || idx < 0 || idx >= pts.length || idx === j) {
      t.value = "";
      return;
    }
    pts[idx][0] = rn(pts[j][0], 2);
    pts[idx][1] = rn(pts[j][1], 2);
    t.value = "";
    journeyEditorRefreshBody();
    drawJourney();
    return;
  }

  if (t.classList.contains("journey-coord-input")) {
    ensurePackJourney();
    const pts = pack.journey.points;
    if (idx < 0 || idx >= pts.length) return;
    const coord = t.dataset.coord;
    const v = parseFloat(t.value);
    if (!Number.isFinite(v)) return;
    const rnVal = rn(v, 2);
    if (coord === "x") pts[idx][0] = rnVal;
    else if (coord === "y") pts[idx][1] = rnVal;
    t.value = rnVal;
    drawJourney();
  }
}

function journeyAppendPoint(xy) {
  ensurePackJourney();
  pack.journey.points.push(xy);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorOnClick() {
  const evt = d3.event.sourceEvent || window.event;
  const target = evt.target;

  let x;
  let y;
  if (target?.classList?.contains("journey-waypoint")) {
    x = +target.getAttribute("data-jx");
    y = +target.getAttribute("data-jy");
  } else if (target?.closest?.(".journey-waypoint")) {
    const el = target.closest(".journey-waypoint");
    x = +el.getAttribute("data-jx");
    y = +el.getAttribute("data-jy");
  } else {
    const pt = d3.mouse(this);
    x = rn(pt[0], 2);
    y = rn(pt[1], 2);
  }

  journeyAppendPoint([x, y]);

  if (!evt.shiftKey) {
    // keep dialog open like route creator; Shift adds multiple quickly
  }
}

function closeJourneyEditor() {
  ensureEl("journeyEditorBody").innerHTML = "";
  viewbox.on("click.journey", null).style("cursor", null);
  clearMainTip();
  restoreDefaultEvents();
}

function editJourney() {
  if (customization) return;
  closeDialogs("#journeyEditor, .stable");
  ensurePackJourney();

  if (!layerIsOn("toggleJourney")) toggleJourney();

  tip(
    "Click the map to add the next stop, or an existing circle to revisit it. Edit X/Y in the list to nudge a stop. Use “Match stop…” to snap one stop to another’s position. Shift: add several stops quickly.",
    true,
  );
  viewbox.style("cursor", "crosshair").on("click.journey", journeyEditorOnClick);

  $("#journeyEditor").dialog({
    title: "Journey editor",
    resizable: false,
    position: {my: "left top", at: "left+10 top+10", of: "#map"},
    close: closeJourneyEditor,
  });

  if (modules.editJourney) {
    journeyEditorRefreshBody();
    return;
  }
  modules.editJourney = true;

  ensureEl("journeyEditorBody").on("change", journeyEditorBodyChange);

  ensureEl("journeyEditorBody").on("click", ev => {
    if (!ev.target.classList.contains("icon-trash-empty")) return;
    const row = ev.target.closest("[data-index]");
    if (!row) return;
    const idx = +row.dataset.index;
    if (!Number.isFinite(idx)) return;
    ensurePackJourney();
    pack.journey.points.splice(idx, 1);
    journeyEditorRefreshBody();
    drawJourney();
  });

  ensureEl("journeyEditorUndo").on("click", () => {
    ensurePackJourney();
    pack.journey.points.pop();
    journeyEditorRefreshBody();
    drawJourney();
  });

  ensureEl("journeyEditorClear").on("click", () => {
    ensurePackJourney();
    pack.journey.points = [];
    journeyEditorRefreshBody();
    drawJourney();
  });

  ensureEl("journeyEditorDone").on("click", () => $("#journeyEditor").dialog("close"));

  journeyEditorRefreshBody();
}
