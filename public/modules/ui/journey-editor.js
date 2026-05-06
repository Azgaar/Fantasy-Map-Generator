"use strict";

function journeyEscapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function journeyEscapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ensurePackJourney() {
  if (!pack.journey) pack.journey = { stopIds: [], waypoints: [] };
  if (window.JourneyPack) window.JourneyPack.normalizePackJourney(pack.journey, pack);
}

function journeyGetWaypoint(id) {
  ensurePackJourney();
  return pack.journey.waypoints.find(w => w.id === id);
}

function journeyStopSelectOptions(currentId) {
  ensurePackJourney();
  const JP = window.JourneyPack;
  let html = "";
  const known = new Set();

  if (!currentId) {
    html +=
      '<option value="" disabled selected>Choose point, marker, or burg…</option>';
  }

  html += '<optgroup label="Points">';
  for (const w of pack.journey.waypoints) {
    known.add(w.id);
    const sel = w.id === currentId ? " selected" : "";
    html += `<option value="${journeyEscapeAttr(w.id)}"${sel}>${journeyEscapeText(w.name)} (${rn(w.x, 2)}, ${rn(w.y, 2)})</option>`;
  }
  html += "</optgroup>";

  if (JP) {
    html += '<optgroup label="Markers">';
    for (const m of pack.markers || []) {
      if (m.i == null || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
      const ref = JP.markerJourneyStopRef(m.i);
      known.add(ref);
      const sel = ref === currentId ? " selected" : "";
      const typeLabel = m.type ? String(m.type) : "Marker";
      const label = `${typeLabel} #${m.i} (${rn(m.x, 2)}, ${rn(m.y, 2)})`;
      html += `<option value="${journeyEscapeAttr(ref)}"${sel}>${journeyEscapeText(label)}</option>`;
    }
    html += "</optgroup>";

    html += '<optgroup label="Burgs">';
    for (const b of pack.burgs || []) {
      if (b.removed || b.i == null || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      const ref = JP.burgJourneyStopRef(b.i);
      known.add(ref);
      const sel = ref === currentId ? " selected" : "";
      const nm = b.name && String(b.name).trim() !== "" ? b.name : `Burg ${b.i}`;
      const label = `${nm} (${rn(b.x, 2)}, ${rn(b.y, 2)})`;
      html += `<option value="${journeyEscapeAttr(ref)}"${sel}>${journeyEscapeText(label)}</option>`;
    }
    html += "</optgroup>";
  }

  if (currentId && !known.has(currentId)) {
    html += `<option value="${journeyEscapeAttr(currentId)}" selected>${journeyEscapeText("[missing stop]")}</option>`;
  }
  return html;
}

function journeyRenderStopRows(container) {
  ensurePackJourney();
  const ids = pack.journey.stopIds;
  const rows = ids.length === 0 ? [""] : ids;
  rows.forEach((sid, i) => {
    const showRemove = ids.length > 0;
    const removeStyle = showRemove ? "" : "visibility:hidden;pointer-events:none";
    container.insertAdjacentHTML(
      "beforeend",
      /* html */ `<div class="editorLine journey-stop-row" data-stop-index="${i}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.5em 1em;align-items:center">
        <span><b>#</b>${i + 1}</span>
        <select class="journey-stop-select" data-tip="Stop for this leg: Points, Markers, then Burgs" data-stop-index="${i}">${journeyStopSelectOptions(sid)}</select>
        <span data-tip="Remove this leg from the journey" class="icon-trash-empty pointer journey-stop-remove" data-stop-index="${i}" style="${removeStyle}"></span>
      </div>`,
    );
  });
}

function journeyEditorRefreshStopsOnly() {
  const stBody = ensureEl("journeyEditorStopsBody");
  stBody.innerHTML = "";
  journeyRenderStopRows(stBody);
}

function journeyEditorRefreshBody() {
  const wpBody = ensureEl("journeyEditorWaypointsBody");
  const stBody = ensureEl("journeyEditorStopsBody");
  wpBody.innerHTML = "";
  stBody.innerHTML = "";
  ensurePackJourney();

  pack.journey.waypoints.forEach(w => {
    const inUse = pack.journey.stopIds.includes(w.id);
    const delTip = inUse
      ? "Remove this waypoint from the journey before deleting"
      : "Delete waypoint";
    const delClass = "icon-trash-empty journey-waypoint-delete";
    const delStyle = inUse ? "opacity:0.35;pointer-events:none" : "";
    wpBody.insertAdjacentHTML(
      "beforeend",
      /* html */ `<div class="editorLine journey-waypoint-row" style="display:grid;grid-template-columns:1fr 6em 6em auto;gap:0.5em 1em;align-items:center" data-waypoint-id="${journeyEscapeAttr(w.id)}">
        <label style="display:flex;align-items:center;gap:0.35em"><b>Name</b><input type="text" class="journey-waypoint-name" data-waypoint-id="${journeyEscapeAttr(w.id)}" value="${journeyEscapeAttr(w.name)}" style="width:100%" /></label>
        <label style="display:flex;align-items:center;gap:0.35em"><b>X</b><input type="number" step="any" class="journey-waypoint-coord" data-coord="x" data-waypoint-id="${journeyEscapeAttr(w.id)}" value="${w.x}" /></label>
        <label style="display:flex;align-items:center;gap:0.35em"><b>Y</b><input type="number" step="any" class="journey-waypoint-coord" data-coord="y" data-waypoint-id="${journeyEscapeAttr(w.id)}" value="${w.y}" /></label>
        <span data-tip="${journeyEscapeAttr(delTip)}" class="${delClass}" data-waypoint-id="${journeyEscapeAttr(w.id)}" style="${delStyle}"></span>
      </div>`,
    );
  });

  journeyRenderStopRows(stBody);
}

function journeyEditorRootChange(ev) {
  const t = ev.target;

  if (t.classList.contains("journey-stop-select")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +row.dataset.stopIndex;
    if (!Number.isFinite(idx)) return;
    const newId = t.value;
    ensurePackJourney();
    if (!newId) return;
    pack.journey.stopIds[idx] = newId;
    journeyEditorRefreshBody();
    drawJourney();
    return;
  }

  if (t.classList.contains("journey-waypoint-name")) {
    const id = t.dataset.waypointId;
    const w = journeyGetWaypoint(id);
    if (!w) return;
    w.name = t.value;
    journeyEditorRefreshStopsOnly();
    return;
  }

  if (t.classList.contains("journey-waypoint-coord")) {
    const id = t.dataset.waypointId;
    const w = journeyGetWaypoint(id);
    if (!w) return;
    const coord = t.dataset.coord;
    const v = parseFloat(t.value);
    if (!Number.isFinite(v)) return;
    const rnVal = rn(v, 2);
    if (coord === "x") w.x = rnVal;
    else if (coord === "y") w.y = rnVal;
    else return;
    t.value = rnVal;
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyEditorRootClick(ev) {
  const t = ev.target;

  if (t.classList.contains("journey-waypoint-delete")) {
    const id = t.dataset.waypointId;
    if (!id) return;
    ensurePackJourney();
    if (pack.journey.stopIds.includes(id)) return;
    pack.journey.waypoints = pack.journey.waypoints.filter(w => w.id !== id);
    journeyEditorRefreshBody();
    drawJourney();
    return;
  }

  if (t.classList.contains("journey-stop-remove")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +row.dataset.stopIndex;
    if (!Number.isFinite(idx)) return;
    ensurePackJourney();
    pack.journey.stopIds.splice(idx, 1);
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyAppendStop(stopRef) {
  ensurePackJourney();
  const JP = window.JourneyPack;
  if (!JP || !JP.resolveJourneyStopPosition) return;
  const ctx = { burgs: pack.burgs ?? [], markers: pack.markers ?? [] };
  if (!JP.resolveJourneyStopPosition(stopRef, pack.journey, ctx)) return;
  pack.journey.stopIds.push(stopRef);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyWaypointIdAtRoundedCoords(x, y) {
  ensurePackJourney();
  const rx = rn(x, 2);
  const ry = rn(y, 2);
  const matches = pack.journey.waypoints.filter(w => rn(w.x, 2) === rx && rn(w.y, 2) === ry);
  if (matches.length === 1) return matches[0].id;
  return null;
}

function journeyAppendNewWaypoint(xy) {
  ensurePackJourney();
  const JP = window.JourneyPack;
  if (!JP) return;
  const id = JP.newWaypointId();
  const name = JP.nextDefaultWaypointName(pack.journey.waypoints);
  pack.journey.waypoints.push({
    id,
    name,
    x: rn(xy[0], 2),
    y: rn(xy[1], 2),
  });
  pack.journey.stopIds.push(id);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorAddLegClick() {
  ensurePackJourney();
  const stops = pack.journey.stopIds;
  if (!stops.length) {
    tip("Choose the first stop in the Journey row (point, marker, or burg), then use Add leg for more.", false, "warn");
    return;
  }
  const pick = stops[stops.length - 1];
  stops.push(pick);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorOnClick() {
  const evt = d3.event.sourceEvent || window.event;
  const target = evt.target;

  let circleEl = null;
  if (target?.classList?.contains("journey-waypoint")) circleEl = target;
  else if (target?.closest?.(".journey-waypoint")) circleEl = target.closest(".journey-waypoint");

  if (circleEl) {
    const stopRef =
      circleEl.getAttribute("data-journey-stop-ref") ||
      circleEl.getAttribute("data-journey-waypoint-id");
    if (stopRef) {
      journeyAppendStop(stopRef);
      return;
    }
    const x = +circleEl.getAttribute("data-jx");
    const y = +circleEl.getAttribute("data-jy");
    const resolved = journeyWaypointIdAtRoundedCoords(x, y);
    if (resolved) journeyAppendStop(resolved);
    else journeyAppendNewWaypoint([x, y]);
    return;
  }

  const pt = d3.mouse(this);
  journeyAppendNewWaypoint([rn(pt[0], 2), rn(pt[1], 2)]);
}

function closeJourneyEditor() {
  ensureEl("journeyEditorWaypointsBody").innerHTML = "";
  ensureEl("journeyEditorStopsBody").innerHTML = "";
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
    "Use the Journey dropdown to start at a point, marker, or burg—no map click required. Click the map to add a new point stop. Click a journey circle to repeat that stop. Add leg copies the last stop. Edit free points in the Waypoints section. Undo removes the last leg; Clear clears legs only.",
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

  $("#journeyEditorRoot").on("change.journeyEd", journeyEditorRootChange).on("click.journeyEd", journeyEditorRootClick);

  $("#journeyEditorAddLeg").on("click.journeyEd", journeyEditorAddLegClick);

  $("#journeyEditorUndo").on("click.journeyEd", () => {
    ensurePackJourney();
    pack.journey.stopIds.pop();
    journeyEditorRefreshBody();
    drawJourney();
  });

  $("#journeyEditorClear").on("click.journeyEd", () => {
    ensurePackJourney();
    pack.journey.stopIds = [];
    journeyEditorRefreshBody();
    drawJourney();
  });

  $("#journeyEditorDone").on("click.journeyEd", () => $("#journeyEditor").dialog("close"));

  journeyEditorRefreshBody();
}
