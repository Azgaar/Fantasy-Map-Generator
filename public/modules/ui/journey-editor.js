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
  if (!pack.journey) pack.journey = { stops: [] };
  if (window.JourneyPack) window.JourneyPack.normalizePackJourney(pack.journey, pack);
}

function journeyStopSelectOptions(currentRef) {
  ensurePackJourney();
  const JP = window.JourneyPack;
  let html = "";
  const known = new Set();

  if (!currentRef) {
    html +=
      '<option value="" disabled selected>Choose marker or burg…</option>';
  }

  if (JP) {
    html += '<optgroup label="Markers">';
    for (const m of pack.markers || []) {
      if (m.i == null || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
      const ref = JP.markerJourneyStopRef(m.i);
      known.add(ref);
      const sel = ref === currentRef ? " selected" : "";
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
      const sel = ref === currentRef ? " selected" : "";
      const nm = b.name && String(b.name).trim() !== "" ? b.name : `Burg ${b.i}`;
      const label = `${nm} (${rn(b.x, 2)}, ${rn(b.y, 2)})`;
      html += `<option value="${journeyEscapeAttr(ref)}"${sel}>${journeyEscapeText(label)}</option>`;
    }
    html += "</optgroup>";
  }

  if (currentRef && !known.has(currentRef)) {
    html += `<option value="${journeyEscapeAttr(currentRef)}" selected>${journeyEscapeText("[missing stop]")}</option>`;
  }
  return html;
}

function journeyLegToSelectValue(leg) {
  const JP = window.JourneyPack;
  if (!JP || !leg) return "";
  return JP.journeyLegToRefString(leg);
}

function journeyRenderStopRows(container) {
  ensurePackJourney();
  const stops = pack.journey.stops;
  const rows = stops.length === 0 ? [null] : stops;
  rows.forEach((leg, i) => {
    const currentRef = leg ? journeyLegToSelectValue(leg) : "";
    const showRemove = stops.length > 0;
    const removeStyle = showRemove ? "" : "visibility:hidden;pointer-events:none";
    container.insertAdjacentHTML(
      "beforeend",
      /* html */ `<div class="editorLine journey-stop-row" data-stop-index="${i}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.5em 1em;align-items:center">
        <span><b>#</b>${i + 1}</span>
        <select class="journey-stop-select" data-tip="Stop: marker or burg (position follows the map)" data-stop-index="${i}">${journeyStopSelectOptions(currentRef)}</select>
        <span data-tip="Remove this leg" class="icon-trash-empty pointer journey-stop-remove" data-stop-index="${i}" style="${removeStyle}"></span>
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
  const stBody = ensureEl("journeyEditorStopsBody");
  stBody.innerHTML = "";
  ensurePackJourney();
  journeyRenderStopRows(stBody);
}

function journeyEditorRootChange(ev) {
  const t = ev.target;

  if (t.classList.contains("journey-stop-select")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +row.dataset.stopIndex;
    if (!Number.isFinite(idx)) return;
    const val = t.value;
    ensurePackJourney();
    const JP = window.JourneyPack;
    if (!JP || !val) return;
    const leg = JP.journeyRefStringToLeg(val);
    if (!leg) return;

    const stops = pack.journey.stops;
    if (stops.length === 0) {
      stops.push(leg);
    } else {
      stops[idx] = leg;
    }
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyEditorRootClick(ev) {
  const t = ev.target;

  if (t.classList.contains("journey-stop-remove")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +row.dataset.stopIndex;
    if (!Number.isFinite(idx)) return;
    ensurePackJourney();
    pack.journey.stops.splice(idx, 1);
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyAppendStopRef(stopRef) {
  ensurePackJourney();
  const JP = window.JourneyPack;
  if (!JP || !JP.resolveJourneyStopPosition) return;
  const ctx = { burgs: pack.burgs ?? [], markers: pack.markers ?? [] };
  if (!JP.resolveJourneyStopPosition(stopRef, ctx)) return;
  const leg = JP.journeyRefStringToLeg(stopRef);
  if (!leg) return;
  pack.journey.stops.push(leg);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorAddLegClick() {
  ensurePackJourney();
  const stops = pack.journey.stops;
  if (!stops.length) {
    tip("Choose the first stop in the Journey row (marker or burg), then use + to add legs.", false, "warn");
    return;
  }
  stops.push(stops[stops.length - 1]);
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
      const stopRef = circleEl.getAttribute("data-journey-stop-ref");
    if (stopRef) {
      journeyAppendStopRef(stopRef);
      return;
    }
    return;
  }

  tip("Add stops from the Journey dropdown (markers and burgs only).", false, "info");
}

function closeJourneyEditor() {
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
    "Build the path with markers and burgs only—each leg follows live map positions. Use + to repeat the last stop. Click a journey circle to append that stop again. Undo / Clear affect the path only.",
    true,
  );
  viewbox.style("cursor", "default").on("click.journey", journeyEditorOnClick);

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
    pack.journey.stops.pop();
    journeyEditorRefreshBody();
    drawJourney();
  });

  $("#journeyEditorClear").on("click.journeyEd", () => {
    ensurePackJourney();
    pack.journey.stops = [];
    journeyEditorRefreshBody();
    drawJourney();
  });

  $("#journeyEditorDone").on("click.journeyEd", () => $("#journeyEditor").dialog("close"));

  journeyEditorRefreshBody();
}
