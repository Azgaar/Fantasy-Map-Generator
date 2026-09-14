import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { MapBrush } from "@/components/map-brush";
import { clearMainTip, tip } from "@/components/tooltips";
import { GraphOverride } from "@/generators/graph-override";
import { drawMesh, removeMesh } from "@/renderers/overlays/vertex-mesh";
import type { Point } from "@/types/global";
import { ensureEl } from "@/utils";
import { findVertices, VertexBrush } from "./vertex-brush";

type Edit = { before: Map<number, Point>; after: Map<number, Point> };
let history: Edit[] = [];
let index = 0;
const baseline = new Map<number, Point>();
let active: VertexBrush | null = null;
let source: typeof pack.vertices | null = null;
let radius = 10;
let brush: MapBrush | null = null;
let events: AbortController | null = null;

function open(): void {
  if (customization || source) return;
  closeDialogs();

  source = pack.vertices;
  customization = 18;
  brush = new MapBrush({
    id: "wrapRadius",
    label: "Radius:",
    radius,
    min: 1,
    max: 100,
    keyStep: 1, // the tool is used at sizes where the usual step of 5 is a leap
    spacing: () => 0, // a wrap stroke is continuous, it does not stamp
    onStart: (point, size) => {
      if (source !== pack.vertices) return;
      active = new VertexBrush(point, size);
      return next => active?.move(next); // the layers hold still until the drag ends
    },
    onEnd: finishStroke,
    onMove: (point, size) => {
      if (source === pack.vertices) drawMesh(active ? [...active.before.keys()] : findVertices(point, size));
    },
    onResize: value => {
      radius = value;
    }
  });

  render();
  addListeners();
  brush.attach();
  tip("Wrap tool: drag to reshape cells, Shift + drag to resize the brush, Space + drag to pan the map", true);
  updateControls();
}

function render(): void {
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="wrapTool" class="dialog">
    <div style="max-width: 22em">Use for <strong>small shape adjustments only</strong>. Use the Heightmap Editor for significant changes.</div>
    <div style="margin-top: 0.5em">${brush?.markup ?? ""}</div>
    <div id="wrapBottom" style="margin-top: 0.4em">
      <button id="wrapUndo" data-tip="Undo the last stroke (Ctrl + Z)" class="icon-ccw" disabled></button>
      <button id="wrapRedo" data-tip="Redo the stroke (Ctrl + Y)" class="icon-cw" disabled></button>
      <button id="wrapApply" data-tip="Apply the changes and keep editing" class="icon-check" disabled></button>
      <button id="wrapReset" data-tip="Drop the edits made in this session and its history" class="icon-eraser" disabled></button>
      <button id="wrapRevert" data-tip="Revert all vertex edits ever made on this map" class="icon-trash-empty"></button>
    </div>
  </div>`
  );

  $("#wrapTool").dialog({
    title: "Wrap Tool",
    resizable: false,
    width: "auto",
    closeOnEscape: false,
    position: { my: "right top", at: "right-10 top+10", of: "svg" },
    close: cleanup
  });
}

function addListeners(): void {
  events = new AbortController();
  const signal = events.signal;

  ensureEl("wrapUndo").addEventListener("click", undo, { signal });
  ensureEl("wrapRedo").addEventListener("click", redo, { signal });
  ensureEl("wrapApply").addEventListener("click", applyEdits, { signal });
  ensureEl("wrapReset").addEventListener("click", reset, { signal });
  ensureEl("wrapRevert").addEventListener("click", revert, { signal });

  document.addEventListener("keydown", keydown, { signal, capture: true });
  window.addEventListener("blur", abortStroke, { signal });
}

function finishStroke(): void {
  const stroke = active;
  active = null;
  if (!stroke || source !== pack.vertices) return;

  const before = new Map([...stroke.before].filter(([id, p]) => String(p) !== String(pack.vertices.p[id])));
  if (before.size) {
    for (const [id, point] of before) if (!baseline.has(id)) baseline.set(id, point);
    remember({ before, after: new Map([...before.keys()].map(id => [id, pack.vertices.p[id]])) });
  }

  redraw();
  updateControls();
}

function remember(edit: Edit): void {
  history.splice(index);
  history.push(edit);
  if (history.length > 1000) history.shift();
  index = history.length;
}

function apply(points: Map<number, Point>): void {
  if (source !== pack.vertices) return;
  GraphOverride.movePackVertices(points);
  redraw();
  updateControls();
}

function abortStroke(): void {
  const stroke = active;
  active = null;
  if (stroke) apply(stroke.before);
}

function undo(): void {
  abortStroke();
  if (index) apply(history[--index].before);
}

function redo(): void {
  abortStroke();
  if (index < history.length) apply(history[index++].after);
}

/** drop the edits made in this session and its history, keeping the tool open */
function reset(): void {
  abortStroke();
  const restore = restorable();
  history = [];
  index = 0;
  if (restore.size) apply(restore);
  else updateControls();
}

/** session edits as a map of vertex id to the position it had when the session started */
function restorable(): Map<number, Point> {
  return new Map([...baseline].filter(([id, p]) => String(p) !== String(pack.vertices.p[id])));
}

/** commit what is done so far and start a fresh session without leaving the tool */
function applyEdits(): void {
  abortStroke();
  history = [];
  index = 0;
  baseline.clear();
  updateControls();
}

/** drop every vertex edit on the map, including the ones loaded from the file */
function revert(): void {
  abortStroke();
  confirmationDialog({
    title: "Revert vertex edits",
    message: `All vertex edits made on this map, including the ones made in earlier sessions,
      will be reverted. The action cannot be undone`,
    confirm: "Revert",
    onConfirm: () => {
      if (source !== pack.vertices) return;
      GraphOverride.revert();
      history = [];
      index = 0;
      baseline.clear();
      redraw();
      updateControls();
    }
  });
}

function keydown(event: KeyboardEvent): void {
  const target = event.target;
  if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;

  const command = event.ctrlKey || event.metaKey;
  if (event.key === "Escape") {
    if (active) abortStroke();
    else close();
  } else if (command && event.key.toLowerCase() === "z") {
    if (event.shiftKey) redo();
    else undo();
  } else if (command && event.key.toLowerCase() === "y") redo();
  else return;

  event.preventDefault();
  event.stopImmediatePropagation();
}

function updateControls(): void {
  if (!source) return;
  const edited = restorable().size > 0;
  ensureEl<HTMLButtonElement>("wrapUndo").disabled = index === 0;
  ensureEl<HTMLButtonElement>("wrapRedo").disabled = index === history.length;
  ensureEl<HTMLButtonElement>("wrapApply").disabled = !edited;
  ensureEl<HTMLButtonElement>("wrapReset").disabled = !edited;
  ensureEl<HTMLButtonElement>("wrapRevert").disabled = !Object.keys(GraphOverride.state.pack?.vertices?.p ?? {}).length;
}

const LAYERS_TO_REDRAW = [
  "landmass",
  "coastline",
  "lakes",
  "heightmap",
  "cells",
  "states",
  "provinces",
  "borders",
  "biomes",
  "cultures",
  "religions",
  "zones",
  "markets",
  "goods",
  "fogging"
] as const;

function redraw(): void {
  if (source !== pack.vertices) return;
  Layers.draw(...LAYERS_TO_REDRAW);
  brush?.refresh();
}

function close(): void {
  $("#wrapTool").dialog("close"); // the dialog calls cleanup back
}

function cleanup(): void {
  abortStroke();
  const discarded = restorable(); // what was not applied is discarded on close
  if (discarded.size) apply(discarded);

  source = null;
  customization = 0;
  events?.abort();
  events = null;
  brush?.detach();
  brush = null;

  removeMesh();
  clearMainTip();
  history = [];
  index = 0;
  baseline.clear();
  destroyDialog("wrapTool");
}

export const WrapTool = { open };
