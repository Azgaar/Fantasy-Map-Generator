import { type D3DragEvent, drag, select } from "d3";
import "@/components/fill-box";
import { destroyDialog } from "@/components/dialog/dialog-helpers";
import type { FillBoxElement } from "@/components/fill-box";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import {
  openPaintOverlay,
  type PaintOverlayCell,
  removePaintOverlay,
  removePaintOverlayCells,
  updatePaintOverlay
} from "@/renderers/overlays/paint-overlay";
import { ensureEl, getPointer } from "@/utils";

export interface PaintEditorItem {
  id: number;
  name: string;
  color: string;
}

interface CommonPaintEditorOptions {
  title: string;
  parentDialogId: string;
  onClose: () => void;
  items: readonly PaintEditorItem[];
  dontOverrideControl?: boolean;
  landOnlyControl?: boolean;
}

export interface PaintEditorOptions extends CommonPaintEditorOptions {
  mode?: "single";
  getValue: (cell: number) => number;
  filterCell?: (cell: number, currentValue: number, nextValue: number) => boolean;
  onApply: (changes: ReadonlyMap<number, number>) => void;
}

interface MultiplePaintEditorOptions extends CommonPaintEditorOptions {
  mode: "multiple";
  getValue: (cell: number) => readonly number[];
  filterCell?: (cell: number, currentValues: readonly number[], nextValue: number) => boolean;
  onApply: (changes: ReadonlyMap<number, readonly number[]>) => void;
}

type OpenPaintEditorOptions = PaintEditorOptions | MultiplePaintEditorOptions;
type PaintChanges = Map<number, readonly number[]>;
type PaintHistoryEntry = Map<number, readonly number[] | undefined>;

interface PaintEditorState {
  options: OpenPaintEditorOptions;
  itemsById: ReadonlyMap<number, PaintEditorItem>;
  changes: PaintChanges;
  history: PaintHistoryEntry[];
  selectedId: number | undefined;
  finalized: boolean;
}

const dialogId = "paintEditor" as const;
const historyLimit = 100;
const customizationMode = 2;
const defaultBrushRadius = 12;
const eraseAllValue = -1;

let state: PaintEditorState | null = null;

function open(options: OpenPaintEditorOptions): void {
  if (customization) return;

  $(`#${options.parentDialogId}`).dialog("close");
  customization = customizationMode;

  const items = sortItems(options.items);
  state = {
    options,
    itemsById: new Map(items.map(item => [item.id, item])),
    changes: new Map(),
    history: [],
    selectedId: items[0]?.id,
    finalized: false
  };

  try {
    renderDialog(options, items);
    renderItems(items);
    openPaintOverlay();
    addListeners();

    $(ensureEl(dialogId)).dialog({
      title: options.title,
      resizable: false,
      position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
      close: cancel
    });

    tip("Click to select, drag to paint", true);
  } catch (error) {
    close(options.onClose);
    throw error;
  }
}

function sortItems(items: readonly PaintEditorItem[]): PaintEditorItem[] {
  const pinned = items[0]?.id <= 0 ? items.slice(0, 1) : [];
  const sortable = items.slice(pinned.length).sort((a, b) => a.name.localeCompare(b.name));
  return [...pinned, ...sortable];
}

function renderDialog(options: OpenPaintEditorOptions, items: readonly PaintEditorItem[]): void {
  destroyDialog(dialogId);

  const selectedColor = items[0]?.color ?? "#ffffff";

  const dontOverrideControl = options.dontOverrideControl
    ? `<label data-tip="Only paint cells whose current value is 0 (neutral)" style="display: flex; align-items: center"><input id="paintEditorDontOverride" class="checkbox native" type="checkbox">Do not override existing</label>`
    : "";
  const landOnlyControl = options.landOnlyControl
    ? `<label style="display: flex; align-items: center"><input id="paintEditorLandOnly" class="checkbox native" type="checkbox" checked> Change land only</label>`
    : "";
  const html = /* html */ `<div id="${dialogId}" class="dialog" style="display: flex; flex-direction: column; gap: 0.6em">
    <div style="display: grid; gap: 0.5em;">
      <label style="display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.4em">Paint: <select id="paintEditorSelect"></select><fill-box id="paintEditorFill" fill="${selectedColor}" size="1.4em" data-tip="Selected paint color" disabled></fill-box></label>
      <slider-input id="paintEditorBrush" min="1" max="100" value="${defaultBrushRadius}">Brush size:</slider-input>
    </div>
    <div id="paintEditorControls" style="display: flex; flex-direction: column; align-items: center; gap: 0.4em;">${dontOverrideControl}${landOnlyControl}</div>
    <div style="display: flex; gap: 0.4em;">
      <button id="paintEditorUndo" aria-label="Undo" data-tip="Undo last brush stroke" class="icon-ccw" disabled></button>
      <button id="paintEditorApply" aria-label="Apply" data-tip="Apply painted changes" class="icon-check"></button>
      <button id="paintEditorCancel" aria-label="Cancel" data-tip="Cancel painted changes" class="icon-cancel"></button>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);
}

function renderItems(items: readonly PaintEditorItem[]): void {
  const itemSelect = ensureEl<HTMLSelectElement>("paintEditorSelect");
  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.name;
    itemSelect.appendChild(option);
  }
}

function updatePreview(cells: readonly number[]): void {
  const { changes, itemsById } = getState();
  const updates: PaintOverlayCell[] = [];
  const revertedCells: number[] = [];

  for (const cell of cells) {
    const values = changes.get(cell);
    if (values === undefined) revertedCells.push(cell);
    else updates.push({ cell, values: values.map(id => ({ id, color: itemsById.get(id)?.color ?? "#ffffff" })) });
  }

  updatePaintOverlay(pack, updates);
  removePaintOverlayCells(revertedCells);
}

function addListeners(): void {
  ensureEl<HTMLSelectElement>("paintEditorSelect").addEventListener("change", handleItemChange);
  ensureEl("paintEditorUndo").addEventListener("click", undo);
  ensureEl("paintEditorApply").addEventListener("click", apply);
  ensureEl("paintEditorCancel").addEventListener("click", cancel);
  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", handleMapClick)
    .call(drag<SVGElement, unknown>().on("start", handleDragStart))
    .on("touchmove mousemove", handlePointerMove);
}

function handleItemChange(event: Event): void {
  selectItem(+(event.currentTarget as HTMLSelectElement).value);
}

function handleMapClick(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const cell = Pack.findCell(x, y);
  if (cell === undefined) return;

  const value = getCurrentValues(cell).at(-1);
  if (value !== undefined) selectItem(value);
}

function handleDragStart(this: SVGElement, event: D3DragEvent<SVGElement, unknown, unknown>): void {
  const radius = getRadius();
  const historyEntry: PaintHistoryEntry = new Map();
  let recorded = false;

  event.on("drag", (dragEvent: D3DragEvent<SVGElement, unknown, unknown>) => {
    if (!dragEvent.dx && !dragEvent.dy) return;

    const [x, y] = getPointer(dragEvent, this);
    moveCircle(x, y, radius);

    const found = radius > 5 ? Pack.findAll(x, y, radius) : [Pack.findCell(x, y)];
    const cells = found.filter((cell): cell is number => cell !== undefined);
    const selectedId = getState().selectedId;
    if (!cells.length || selectedId === undefined || !paintCells(cells, selectedId, historyEntry) || recorded) return;

    recordHistory(historyEntry);
    recorded = true;
  });
}

function handlePointerMove(this: SVGElement, event: MouseEvent | TouchEvent): void {
  const [x, y] = getPointer(event, this);
  moveCircle(x, y, getRadius());

  const cell = Pack.findCell(x, y);
  if (cell === undefined) return;

  const { itemsById } = getState();
  const names = getCurrentValues(cell)
    .map(value => itemsById.get(value)?.name)
    .filter((name): name is string => Boolean(name));
  tip(names.join(", ") || "No assignment");
}

function selectItem(id: number): boolean {
  const activeState = getState();
  const item = activeState.itemsById.get(id);
  if (!item) return false;

  activeState.selectedId = id;
  ensureEl<HTMLSelectElement>("paintEditorSelect").value = String(id);
  ensureEl<FillBoxElement>("paintEditorFill").fill = item.color;
  return true;
}

function getRadius(): number {
  const brush = ensureEl<HTMLInputElement>("paintEditorBrush");
  return +(brush.value || brush.getAttribute("value") || defaultBrushRadius);
}

function getBaseValues(cell: number): readonly number[] {
  const { options } = getState();
  return options.mode === "multiple" ? options.getValue(cell) : [options.getValue(cell)];
}

function getCurrentValues(cell: number): readonly number[] {
  return getState().changes.get(cell) ?? getBaseValues(cell);
}

function paintCells(cells: readonly number[], nextValue: number, historyEntry: PaintHistoryEntry): boolean {
  const { options, changes } = getState();
  const isErase = options.mode === "multiple" && nextValue === eraseAllValue;
  const landOnly = options.landOnlyControl && ensureEl<HTMLInputElement>("paintEditorLandOnly").checked;
  const dontOverride =
    options.dontOverrideControl && ensureEl<HTMLInputElement>("paintEditorDontOverride").checked && !isErase;
  let changed = false;
  const changedCells: number[] = [];

  for (const cell of cells) {
    const currentValues = getCurrentValues(cell);
    if (landOnly && pack.cells.h[cell] < 20) continue;
    if (dontOverride && currentValues.some(value => value !== 0)) continue;

    const nextValues = getNextValues(options, cell, currentValues, nextValue);
    if (!nextValues || arraysEqual(nextValues, currentValues)) continue;

    if (!historyEntry.has(cell)) historyEntry.set(cell, changes.get(cell));
    if (arraysEqual(nextValues, getBaseValues(cell))) changes.delete(cell);
    else changes.set(cell, nextValues);
    changed = true;
    changedCells.push(cell);
  }

  if (changed) updatePreview(changedCells);
  return changed;
}

function getNextValues(
  options: OpenPaintEditorOptions,
  cell: number,
  currentValues: readonly number[],
  nextValue: number
): readonly number[] | null {
  if (options.mode === "multiple") {
    if (options.filterCell && !options.filterCell(cell, currentValues, nextValue)) return null;
    if (nextValue === eraseAllValue) return [];
    return currentValues.includes(nextValue) ? currentValues : [...currentValues, nextValue];
  }

  if (options.filterCell && !options.filterCell(cell, currentValues[0], nextValue)) return null;
  return [nextValue];
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function recordHistory(entry: PaintHistoryEntry): void {
  const activeState = getState();
  activeState.history.push(entry);
  if (activeState.history.length > historyLimit) activeState.history.shift();
  ensureEl<HTMLButtonElement>("paintEditorUndo").disabled = false;
}

function undo(): void {
  const activeState = getState();
  const entry = activeState.history.pop();
  if (!entry) return;

  for (const [cell, values] of entry) {
    if (values === undefined) activeState.changes.delete(cell);
    else activeState.changes.set(cell, values);
  }
  updatePreview([...entry.keys()]);
  ensureEl<HTMLButtonElement>("paintEditorUndo").disabled = !activeState.history.length;
}

function apply(): void {
  finish(true);
}

function cancel(): void {
  finish(false);
}

function finish(shouldApply: boolean): void {
  const activeState = state;
  if (!activeState || activeState.finalized) return;
  activeState.finalized = true;

  try {
    if (shouldApply) {
      const { options, changes } = activeState;
      if (options.mode === "multiple") options.onApply(new Map(changes));
      else options.onApply(new Map([...changes].map(([cell, values]) => [cell, values[0]])));
    }
  } finally {
    close(activeState.options.onClose);
  }
}

function cleanup(): void {
  state = null;
  destroyDialog(dialogId);
  removePaintOverlay();
  removeCircle();
  applyDefaultViewboxEvents();
  clearMainTip();
  if (customization === customizationMode) customization = 0;
}

function close(onClose: () => void): void {
  try {
    cleanup();
  } finally {
    onClose();
  }
}

function getState(): PaintEditorState {
  if (!state) throw new Error("Paint editor is not open");
  return state;
}

export const PaintEditor = { open };
