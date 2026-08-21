import { type D3DragEvent, drag, select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import { ensureEl, findAllCellsInRadius, getPackPolygon, getPointer } from "@/utils";

export interface PaintEditorItem {
  id: number;
  name: string;
  color: string;
}

interface CommonPaintEditorOptions {
  title: string;
  items: readonly PaintEditorItem[];
  dontOverrideControl?: boolean;
  landOnlyControl?: boolean;
}

export interface PaintEditorOptions extends CommonPaintEditorOptions {
  mode?: "single";
  getValue: (cell: number) => number;
  filterCell?: (cell: number, currentValue: number, nextValue: number) => boolean;
  apply: (changes: ReadonlyMap<number, number>) => void;
}

interface MultiplePaintEditorOptions extends CommonPaintEditorOptions {
  mode: "multiple";
  getValue: (cell: number) => readonly number[];
  filterCell?: (cell: number, currentValues: readonly number[], nextValue: number) => boolean;
  apply: (changes: ReadonlyMap<number, readonly number[]>) => void;
}

type OpenPaintEditorOptions = PaintEditorOptions | MultiplePaintEditorOptions;
type PaintChanges = Map<number, readonly number[]>;
type PaintPolygon = { cell: number; value: number | null; key: string };

interface PaintEditorState {
  options: OpenPaintEditorOptions;
  itemsById: ReadonlyMap<number, PaintEditorItem>;
  changes: PaintChanges;
  history: PaintChanges[];
  selectedId: number | undefined;
  finalized: boolean;
}

const dialogId = "paintEditor" as const;
const overlayId = "paintEditorOverlay" as const;
const historyLimit = 100;
const customizationMode = 2;
const defaultBrushRadius = 12;
const eraseAllValue = -1;

let state: PaintEditorState | null = null;

function open(options: OpenPaintEditorOptions): void {
  if (customization) return;
  cleanup();
  closeDialogs();

  customization = customizationMode;
  state = {
    options,
    itemsById: new Map(options.items.map(item => [item.id, item])),
    changes: new Map(),
    history: [],
    selectedId: options.items[0]?.id,
    finalized: false
  };

  try {
    renderDialog(options);
    renderItems(options.items);
    renderOverlay();
    addListeners();

    $(ensureEl(dialogId)).dialog({
      title: options.title,
      resizable: false,
      position: { my: "right top", at: "right-10 top+10", of: "svg", collision: "fit" },
      close: cancel
    });

    tip("Click to select, drag to paint", true);
  } catch (error) {
    cleanup();
    throw error;
  }
}

function renderDialog(options: OpenPaintEditorOptions): void {
  destroyDialog(dialogId);

  const dontOverrideControl = options.dontOverrideControl
    ? `<label data-tip="Only paint cells whose current value is 0" style="display: flex; align-items: center"><input id="paintEditorDontOverride" class="checkbox native" type="checkbox">Do not override existing</label>`
    : "";
  const landOnlyControl = options.landOnlyControl
    ? `<label style="display: flex; align-items: center"><input id="paintEditorLandOnly" class="checkbox native" type="checkbox" checked> Change land only</label>`
    : "";
  const html = /* html */ `<div id="${dialogId}" class="dialog" style="display: flex; flex-direction: column; gap: 0.6em">
    <div style="display: grid; gap: 0.5em;">
      <label style="display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 0.4em">Paint: <select id="paintEditorSelect"></select></label>
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

function renderOverlay(): void {
  select(`#${overlayId}`).remove();
  select("#debug").append("g").attr("id", overlayId).style("fill-opacity", 0.7);
}

function renderChanges(): void {
  const { changes, itemsById } = getState();
  const polygons = [...changes].flatMap<PaintPolygon>(([cell, values]) =>
    values.length
      ? values.map((value, index) => ({ cell, value, key: `${cell}-${value}-${index}` }))
      : [{ cell, value: null, key: `${cell}-empty` }]
  );

  select<SVGGElement, unknown>(`#${overlayId}`)
    .selectAll<SVGPolygonElement, PaintPolygon>("polygon")
    .data(polygons, ({ key }) => key)
    .join("polygon")
    .attr("data-cell", ({ cell }) => cell)
    .attr("data-value", ({ value }) => value ?? "")
    .attr("points", ({ cell }) => getPackPolygon(cell, pack).join(" "))
    .attr("fill", ({ value }) => (value === null ? "#ffffff" : (itemsById.get(value)?.color ?? "#ffffff")))
    .attr("stroke", ({ value }) => (value === null ? "#555555" : (itemsById.get(value)?.color ?? "#ffffff")));
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
  const cell = findCell(x, y);
  if (cell === undefined) return;

  const value = getCurrentValues(cell).at(-1);
  if (value !== undefined) selectItem(value);
}

function handleDragStart(this: SVGElement, event: D3DragEvent<SVGElement, unknown, unknown>): void {
  const { changes } = getState();
  const radius = getRadius();
  const snapshot = new Map(changes);
  let recorded = false;

  event.on("drag", (dragEvent: D3DragEvent<SVGElement, unknown, unknown>) => {
    if (!dragEvent.dx && !dragEvent.dy) return;

    const [x, y] = getPointer(dragEvent, this);
    moveCircle(x, y, radius);

    const found = radius > 5 ? findAllCellsInRadius(x, y, radius, pack) : [findCell(x, y)];
    const cells = found.filter((cell): cell is number => cell !== undefined);
    const selectedId = getState().selectedId;
    if (!cells.length || selectedId === undefined || !paintCells(cells, selectedId) || recorded) return;

    recordHistory(snapshot);
    recorded = true;
  });
}

function handlePointerMove(this: SVGElement, event: MouseEvent | TouchEvent): void {
  const [x, y] = getPointer(event, this);
  moveCircle(x, y, getRadius());

  const cell = findCell(x, y);
  if (cell === undefined) return;

  const { itemsById } = getState();
  const names = getCurrentValues(cell)
    .map(value => itemsById.get(value)?.name)
    .filter((name): name is string => Boolean(name));
  tip(names.join(", ") || "No assignment");
}

function selectItem(id: number): boolean {
  const activeState = getState();
  if (!activeState.itemsById.has(id)) return false;

  activeState.selectedId = id;
  ensureEl<HTMLSelectElement>("paintEditorSelect").value = String(id);
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

function paintCells(cells: readonly number[], nextValue: number): boolean {
  const { options, changes } = getState();
  const isErase = options.mode === "multiple" && nextValue === eraseAllValue;
  const landOnly = options.landOnlyControl && ensureEl<HTMLInputElement>("paintEditorLandOnly").checked;
  const dontOverride =
    options.dontOverrideControl && ensureEl<HTMLInputElement>("paintEditorDontOverride").checked && !isErase;
  let changed = false;

  for (const cell of cells) {
    const currentValues = getCurrentValues(cell);
    if (landOnly && pack.cells.h[cell] < 20) continue;
    if (dontOverride && currentValues.some(value => value !== 0)) continue;

    const nextValues = getNextValues(options, cell, currentValues, nextValue);
    if (!nextValues || arraysEqual(nextValues, currentValues)) continue;

    if (arraysEqual(nextValues, getBaseValues(cell))) changes.delete(cell);
    else changes.set(cell, nextValues);
    changed = true;
  }

  if (changed) renderChanges();
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

function recordHistory(snapshot: PaintChanges): void {
  const activeState = getState();
  activeState.history.push(snapshot);
  if (activeState.history.length > historyLimit) activeState.history.shift();
  ensureEl<HTMLButtonElement>("paintEditorUndo").disabled = false;
}

function undo(): void {
  const activeState = getState();
  const snapshot = activeState.history.pop();
  if (!snapshot) return;

  activeState.changes.clear();
  for (const [cell, values] of snapshot) activeState.changes.set(cell, values);
  renderChanges();
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
      if (options.mode === "multiple") options.apply(new Map(changes));
      else options.apply(new Map([...changes].map(([cell, values]) => [cell, values[0]])));
    }
  } finally {
    cleanup();
  }
}

function cleanup(): void {
  const hadSession = state !== null;
  state = null;
  destroyDialog(dialogId);
  select(`#${overlayId}`).remove();
  removeCircle();
  if (hadSession && document.getElementById("viewbox")) applyDefaultViewboxEvents();
  if (hadSession) clearMainTip();
  if (customization === customizationMode) customization = 0;
}

function getState(): PaintEditorState {
  if (!state) throw new Error("Paint editor is not open");
  return state;
}

export const PaintEditor = { open };
