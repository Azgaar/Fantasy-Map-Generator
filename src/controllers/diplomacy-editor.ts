// Set relations to a state by clicking or dragging over other states on the map
import { type D3DragEvent, drag, pointer, select } from "d3";
import { destroyDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { getInverseRelation, RELATIONS } from "@/data/diplomacy";
import { removeRelationsMark, showRelations } from "@/renderers/overlays/diplomacy";
import type { Point } from "@/types/global";
import { ensureEl, findEl } from "@/utils";
import { createBrushStroke } from "@/utils/brushUtils";

interface EditorOptions {
  /** another state was picked in the editor */
  onSelect?: (stateId: number) => void;
  onClose?: () => void;
}

// a stroke keeps the diplomacy of the states it touched as it was before, and the [subject, object] pairs it set
type Stroke = { diplomacy: Map<number, string[] | undefined>; pairs: [number, number][] };

const dialogId = "diplomacyEditor";

let stateId = 0;
let chosenRelation = Object.keys(RELATIONS)[0]; // kept between openings
let options: EditorOptions = {};
let strokes: Stroke[] = [];
let activeStroke: Stroke | null = null;
let frame = 0;

const isValidState = (id: number): boolean => !!id && !!pack.states[id] && !pack.states[id].removed;

/** Open the editor for the state; an open editor switches to it */
function open(state = 0, editorOptions?: EditorOptions): void {
  if (findEl(dialogId)) {
    if (editorOptions) options = editorOptions;
    selectState(state);
    return;
  }
  if (customization) return;

  const states = pack.states.filter(s => s.i && !s.removed);
  if (states.length < 2) {
    tip("There should be at least 2 states to edit the diplomacy", false, "error");
    return;
  }
  if (editorOptions) options = editorOptions;
  stateId = isValidState(state) ? state : states[0].i;

  renderDialog(states);
  Layers.show("states", "borders");
  Layers.hide("provinces", "cultures", "biomes", "religions");
  showRelations(stateId);

  select<SVGGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", null)
    .call(
      drag<SVGGElement, unknown>()
        .container(() => ensureEl<SVGGElement>("viewbox"))
        .filter((event: MouseEvent & TouchEvent) => {
          const at = pointer(event.touches?.[0] ?? event, ensureEl("viewbox")) as Point;
          return !event.button && getStateAt(at) > 0;
        })
        .on("start", startStroke)
    );

  $(`#${dialogId}`).dialog({
    title: "Diplomacy Editor",
    resizable: false,
    width: "fit-content",
    position: { my: "right top-27", at: "left-10 top", of: "#diplomacyOverview", collision: "fit" },
    close: onDialogClose
  });
  tip("Click or drag over states to set their relation. Shift + click to select another state", true);
}

function close(): void {
  if (findEl(dialogId)) $(`#${dialogId}`).dialog("close");
}

function renderDialog(states: typeof pack.states): void {
  const relations = Object.entries(RELATIONS)
    .map(
      ([relation, { color, tip }]) => /* html */ `<label class="pointer" data-tip="${tip}">
        <input type="radio" name="diplomacyRelation" value="${relation}" ${relation === chosenRelation ? "checked" : ""} />
        <fill-box fill="${color}" size=".8em"></fill-box>${relation}
      </label>`
    )
    .join("");
  const sources = states
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(state => `<option value="${state.i}">${state.name}</option>`)
    .join("");

  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${dialogId}" class="dialog" style="display: flex; flex-direction: column; gap: 0.3em">
      <label style="display: flex; align-items: center; gap: 0.3em" data-tip="States you click get the chosen relation to this state. Shift + click on the map to select another state">
        Relations to
        <select id="diplomacyEditorState" style="flex-grow: 1">${sources}</select>
      </label>
      <div style="display: grid; grid-template-rows: repeat(3, auto); grid-auto-flow: column; gap: .2em">${relations}</div>
      <div style="margin-top: .3em">
        <button id="diplomacyEditorUndo" aria-label="Undo" data-tip="Undo last change" class="icon-ccw" disabled></button>
        <button id="diplomacyEditorApply" aria-label="Apply" data-tip="Apply changes" class="icon-check"></button>
        <button id="diplomacyEditorDiscard" aria-label="Discard" data-tip="Discard all changes since the last Apply" class="icon-cancel" disabled></button>
      </div>
    </div>`
  );

  ensureEl(dialogId).addEventListener("change", event => {
    const input = event.target as HTMLInputElement;
    if (input.name === "diplomacyRelation") chosenRelation = input.value;
  });
  const stateSelect = ensureEl<HTMLSelectElement>("diplomacyEditorState");
  stateSelect.value = String(stateId);
  stateSelect.addEventListener("change", () => selectState(+stateSelect.value));
  ensureEl("diplomacyEditorUndo").addEventListener("click", undo);
  ensureEl("diplomacyEditorApply").addEventListener("click", apply);
  ensureEl("diplomacyEditorDiscard").addEventListener("click", discard);
}

function selectState(id: number): void {
  if (!isValidState(id) || id === stateId) return;
  stateId = id;
  ensureEl<HTMLSelectElement>("diplomacyEditorState").value = String(id);
  showRelations(id);
  options.onSelect?.(id);
}

function getStateAt([x, y]: Point): number {
  const cell = Pack.findCell(x, y);
  const id = cell === undefined ? 0 : pack.cells.state[cell];
  return isValidState(id) ? id : 0;
}

// a drag starting on a state paints; one starting elsewhere pans the map
function startStroke(event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  const origin: Point = [event.x, event.y];
  if ((event.sourceEvent as MouseEvent).shiftKey) {
    selectState(getStateAt(origin));
    return;
  }

  const relation = chosenRelation;
  const stroke: Stroke = { diplomacy: new Map(), pairs: [] };
  activeStroke = stroke;
  const path = createBrushStroke(1, (x, y) => {
    if (paintState(stroke, getStateAt([x, y]), relation)) frame ||= requestAnimationFrame(redraw);
  });
  path.moveTo(...origin);

  event
    .on("drag", ({ x, y }: D3DragEvent<SVGGElement, unknown, unknown>) => path.moveTo(x, y))
    .on("end", () => {
      activeStroke = null;
      if (!stroke.pairs.length) return;
      strokes.push(stroke);
      updateHistoryButtons();
      redraw();
    });
}

// the painted state takes the relation towards the edited one, which takes the inverse back
function paintState(stroke: Stroke, id: number, relation: string): boolean {
  if (!id || id === stateId) return false;
  const subject = pack.states[id];
  const object = pack.states[stateId];
  const inverse = getInverseRelation(relation);
  if (subject.diplomacy?.[stateId] === relation && object.diplomacy?.[id] === inverse) return false;

  for (const state of [subject, object]) {
    if (!stroke.diplomacy.has(state.i)) stroke.diplomacy.set(state.i, state.diplomacy?.slice());
    state.diplomacy ??= [];
  }
  subject.diplomacy![stateId] = relation;
  object.diplomacy![id] = inverse;
  stroke.pairs.push([id, stateId]);
  return true;
}

function revert(stroke: Stroke): void {
  for (const [id, diplomacy] of stroke.diplomacy) pack.states[id].diplomacy = diplomacy;
}

// the chronicle gets one record per painted pair whose relation differs from before the first stroke
function apply(): void {
  const original = new Map<number, string[] | undefined>();
  const pairs = new Map<string, [number, number]>();
  for (const stroke of strokes) {
    for (const [id, diplomacy] of stroke.diplomacy) if (!original.has(id)) original.set(id, diplomacy);
    for (const [a, b] of stroke.pairs) pairs.set(a < b ? `${a}-${b}` : `${b}-${a}`, [a, b]);
  }

  const chronicle = States.getChronicle();
  for (const [subjectId, objectId] of pairs.values()) {
    const oldRelation = original.get(subjectId)?.[objectId];
    const newRelation = pack.states[subjectId].diplomacy![objectId];
    if (newRelation !== oldRelation)
      chronicle.push(States.getRelationRecord(subjectId, objectId, oldRelation, newRelation));
  }

  strokes = [];
  close();
}

function undo(): void {
  const stroke = strokes.pop();
  if (!stroke) return;
  revert(stroke);
  updateHistoryButtons();
  redraw();
}

/** Revert every change since the last Apply; returns whether there were any */
function revertAll(): boolean {
  if (activeStroke) strokes.push(activeStroke);
  activeStroke = null;
  const changed = strokes.length > 0;
  while (strokes.length) revert(strokes.pop()!);
  return changed;
}

function discard(): void {
  if (!revertAll()) return;
  updateHistoryButtons();
  redraw();
}

function updateHistoryButtons(): void {
  const empty = !strokes.length;
  ensureEl<HTMLButtonElement>("diplomacyEditorUndo").disabled = empty;
  ensureEl<HTMLButtonElement>("diplomacyEditorDiscard").disabled = empty;
}

function redraw(): void {
  cancelAnimationFrame(frame);
  frame = 0;
  showRelations(stateId);
  refreshEditors();
}

// closing without Apply discards the changes
function onDialogClose(): void {
  const changed = revertAll();
  cancelAnimationFrame(frame);
  frame = 0;

  applyDefaultViewboxEvents();
  removeRelationsMark();
  Layers.draw("states");
  clearMainTip();
  destroyDialog(dialogId);
  if (changed) refreshEditors();

  const { onClose } = options;
  options = {};
  onClose?.();
}

export const DiplomacyEditor = { open, close };
