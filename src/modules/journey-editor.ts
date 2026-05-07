/**
 * Journey editor dialog — bundled TS mirroring routes/markers editor patterns.
 */
import { rn } from "../utils/numberUtils";
import type { JourneyResolutionContext } from "./journey-model";
import {
  buildJourneyResolutionContext,
  burgJourneyStopRef,
  ensurePackJourneyNormalized,
  journeyLegToRefString,
  journeyRefStringToLeg,
  markerJourneyStopRef,
  resolveJourneyStopPosition,
} from "./journey-model";

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeText(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resolutionCtx(): JourneyResolutionContext {
  return buildJourneyResolutionContext(pack.burgs ?? [], pack.markers ?? []);
}

function journeyStopSelectOptions(currentRef: string): string {
  ensurePackJourneyNormalized(pack);
  let html = "";
  const known = new Set<string>();

  if (!currentRef) {
    html +=
      '<option value="" disabled selected>Choose marker or burg…</option>';
  }

  html += '<optgroup label="Markers">';
  for (const m of pack.markers || []) {
    if (m.i == null || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const ref = markerJourneyStopRef(m.i);
    known.add(ref);
    const sel = ref === currentRef ? " selected" : "";
    const typeLabel = m.type ? String(m.type) : "Marker";
    const label = `${typeLabel} #${m.i} (${rn(m.x, 2)}, ${rn(m.y, 2)})`;
    html += `<option value="${escapeAttr(ref)}"${sel}>${escapeText(label)}</option>`;
  }
  html += "</optgroup>";

  html += '<optgroup label="Burgs">';
  for (const b of pack.burgs || []) {
    if (b.removed || b.i == null || !Number.isFinite(b.x) || !Number.isFinite(b.y))
      continue;
    const ref = burgJourneyStopRef(b.i);
    known.add(ref);
    const sel = ref === currentRef ? " selected" : "";
    const nm =
      b.name && String(b.name).trim() !== "" ? String(b.name) : `Burg ${b.i}`;
    const label = `${nm} (${rn(b.x, 2)}, ${rn(b.y, 2)})`;
    html += `<option value="${escapeAttr(ref)}"${sel}>${escapeText(label)}</option>`;
  }
  html += "</optgroup>";

  if (currentRef && !known.has(currentRef)) {
    html += `<option value="${escapeAttr(currentRef)}" selected>${escapeText("[missing stop]")}</option>`;
  }
  return html;
}

function journeyLegToSelectValue(
  leg: import("./journey-model").JourneyStopLeg | null,
): string {
  if (!leg) return "";
  return journeyLegToRefString(leg);
}

function journeyRenderStopRows(container: HTMLElement): void {
  ensurePackJourneyNormalized(pack);
  const stops = pack.journey!.stops;
  const rows = stops.length === 0 ? [null] : stops;
  rows.forEach((leg, i) => {
    const currentRef = leg ? journeyLegToSelectValue(leg) : "";
    const showRemove = stops.length > 0;
    const removeStyle = showRemove
      ? ""
      : "visibility:hidden;pointer-events:none";
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

function journeyEditorRefreshBody(): void {
  const stBody = ensureEl("journeyEditorStopsBody");
  stBody.innerHTML = "";
  ensurePackJourneyNormalized(pack);
  journeyRenderStopRows(stBody);
}

function journeyEditorRootChange(ev: Event): void {
  const t = ev.target as HTMLElement;

  if (t.classList.contains("journey-stop-select")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +(row as HTMLElement).dataset.stopIndex!;
    if (!Number.isFinite(idx)) return;
    const val = (t as HTMLSelectElement).value;
    ensurePackJourneyNormalized(pack);
    if (!val) return;
    const leg = journeyRefStringToLeg(val);
    if (!leg) return;

    const stops = pack.journey!.stops;
    if (stops.length === 0) {
      stops.push(leg);
    } else {
      stops[idx] = leg;
    }
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyEditorRootClick(ev: Event): void {
  const t = ev.target as HTMLElement;

  if (t.classList.contains("journey-stop-remove")) {
    const row = t.closest("[data-stop-index]");
    if (!row) return;
    const idx = +(row as HTMLElement).dataset.stopIndex!;
    if (!Number.isFinite(idx)) return;
    ensurePackJourneyNormalized(pack);
    pack.journey!.stops.splice(idx, 1);
    journeyEditorRefreshBody();
    drawJourney();
  }
}

function journeyAppendStopRef(stopRef: string): void {
  ensurePackJourneyNormalized(pack);
  const ctx = resolutionCtx();
  if (!resolveJourneyStopPosition(stopRef, ctx)) return;
  const leg = journeyRefStringToLeg(stopRef);
  if (!leg) return;
  pack.journey!.stops.push(leg);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorAddLegClick(): void {
  ensurePackJourneyNormalized(pack);
  const stops = pack.journey!.stops;
  if (!stops.length) {
    tip(
      "Choose the first stop in the Journey row (marker or burg), then use + to add legs.",
      false,
      "warn",
    );
    return;
  }
  stops.push(stops[stops.length - 1]);
  journeyEditorRefreshBody();
  drawJourney();
}

function journeyEditorOnClick(): void {
  const d3g = globalThis as typeof globalThis & {
    d3?: { event?: { sourceEvent?: Event } };
  };
  const evt =
    d3g.d3?.event?.sourceEvent ?? window.event;
  const target = evt?.target as HTMLElement | undefined;

  let circleEl: Element | null = null;
  if (target?.classList?.contains("journey-waypoint")) circleEl = target;
  else if (target?.closest?.(".journey-waypoint"))
    circleEl = target.closest(".journey-waypoint");

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

function closeJourneyEditor(): void {
  ensureEl("journeyEditorStopsBody").innerHTML = "";
  viewbox.on("click.journey", null).style("cursor", null);
  clearMainTip();
  restoreDefaultEvents();
}

function editJourney(): void {
  if (customization) return;
  closeDialogs("#journeyEditor, .stable");
  ensurePackJourneyNormalized(pack);

  if (!layerIsOn("toggleJourney")) toggleJourney();

  tip(
    "Build the path with markers and burgs only—each leg follows live map positions. Use + to repeat the last stop. Click a journey circle to append that stop again. Undo / Clear affect the path only.",
    true,
  );
  viewbox.style("cursor", "default").on("click.journey", journeyEditorOnClick);

  $("#journeyEditor").dialog({
    title: "Journey editor",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeJourneyEditor,
  });

  if (modules.editJourney) {
    journeyEditorRefreshBody();
    return;
  }
  modules.editJourney = true;

  $("#journeyEditorRoot")
    .on("change.journeyEd", journeyEditorRootChange)
    .on("click.journeyEd", journeyEditorRootClick);

  $("#journeyEditorAddLeg").on("click.journeyEd", journeyEditorAddLegClick);

  $("#journeyEditorUndo").on("click.journeyEd", () => {
    ensurePackJourneyNormalized(pack);
    pack.journey!.stops.pop();
    journeyEditorRefreshBody();
    drawJourney();
  });

  $("#journeyEditorClear").on("click.journeyEd", () => {
    ensurePackJourneyNormalized(pack);
    pack.journey!.stops = [];
    journeyEditorRefreshBody();
    drawJourney();
  });

  $("#journeyEditorDone").on("click.journeyEd", () =>
    $("#journeyEditor").dialog("close"),
  );

  journeyEditorRefreshBody();
}

if (typeof window !== "undefined") {
  window.editJourney = editJourney;
}

export { editJourney };
