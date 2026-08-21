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
  dontOverrideCotrol?: boolean;
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

const dialogId = "paintEditor";
const overlayId = "paintEditorOverlay";
const historyLimit = 100;
const customizationMode = 2;
const defaultBrushRadius = 12;

let cancelActiveSession: (() => void) | null = null;

function render(options: OpenPaintEditorOptions): HTMLElement {
  destroyDialog(dialogId);
  const dontOverrideControl = options.dontOverrideCotrol
    ? `<label data-tip="Only paint cells whose current value is 0"><input id="paintEditorDontOverride" class="checkbox native" type="checkbox"> Do not override existing</label>`
    : "";
  const landOnlyControl = options.landOnlyControl
    ? `<label><input id="paintEditorLandOnly" class="checkbox native" type="checkbox" checked> Change land only</label>`
    : "";
  const eraseControl =
    options.mode === "multiple"
      ? `<button id="paintEditorErase" type="button" class="icon-eraser" aria-label="Erase" data-tip="Toggle removal mode. Shortcut: Ctrl"></button>`
      : "";
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="${dialogId}" class="dialog">
      <div style="display: grid; gap: 0.5em; padding: 0.5em">
        <label style="display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 0.4em">Paint: <select id="paintEditorSelect"></select></label>
        <slider-input id="paintEditorBrush" min="1" max="100" value="${defaultBrushRadius}">Brush size:</slider-input>
      </div>
      <div id="paintEditorControls" style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.4em; padding: 0 0.5em 0.5em">${dontOverrideControl}${landOnlyControl}${eraseControl}</div>
      <div style="display: flex; gap: 0.4em; justify-content: flex-end; padding: 0 0.5em 0.5em">
        <button id="paintEditorUndo" aria-label="Undo" data-tip="Undo last brush stroke" class="icon-ccw" disabled></button>
        <button id="paintEditorApply" aria-label="Apply" data-tip="Apply painted changes" class="icon-check"></button>
        <button id="paintEditorCancel" aria-label="Cancel" data-tip="Cancel painted changes" class="icon-cancel"></button>
      </div>
    </div>`
  );
  return ensureEl(dialogId);
}

function renderItems(itemSelect: HTMLSelectElement, items: readonly PaintEditorItem[]): void {
  for (const item of items) {
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = item.name;
    itemSelect.appendChild(option);
  }
}

function open(options: OpenPaintEditorOptions): void {
  if (customization) return;
  closeDialogs();

  cancelActiveSession?.();
  customization = customizationMode;

  const dialog = render(options);
  const itemSelect = ensureEl<HTMLSelectElement>("paintEditorSelect");
  const brush = ensureEl<HTMLInputElement>("paintEditorBrush");
  const undoButton = ensureEl<HTMLButtonElement>("paintEditorUndo");
  const initialItem = options.items[0];
  const colors = new Map(options.items.map(item => [item.id, item.color]));
  const names = new Map(options.items.map(item => [item.id, item.name]));
  const changes = new Map<number, readonly number[]>();
  const history: Map<number, readonly number[]>[] = [];
  const overlay = select("#debug").append("g").attr("id", overlayId).style("fill-opacity", 0.7);
  let selectedId = initialItem?.id;
  let finalized = false;

  renderItems(itemSelect, options.items);
  document.getElementById("paintEditorErase")?.addEventListener("click", event => {
    (event.currentTarget as HTMLElement).classList.toggle("pressed");
  });

  const getRadius = () => +(brush.value || brush.getAttribute("value") || defaultBrushRadius);
  const getBaseValues = (cell: number): readonly number[] =>
    options.mode === "multiple" ? options.getValue(cell) : [options.getValue(cell)];
  const getCurrentValues = (cell: number) => changes.get(cell) ?? getBaseValues(cell);
  const isDontOverrideEnabled = () => ensureEl<HTMLInputElement>("paintEditorDontOverride").checked;
  const isLandOnlyEnabled = () => ensureEl<HTMLInputElement>("paintEditorLandOnly").checked;
  const isEraseEnabled = () => ensureEl("paintEditorErase").classList.contains("pressed");

  const selectItem = (id: number): boolean => {
    if (!options.items.some(item => item.id === id)) return false;
    selectedId = id;
    itemSelect.value = String(id);
    return true;
  };

  type PaintPolygon = { cell: number; value: number | null; key: string };
  const renderChanges = () => {
    const polygons = [...changes].flatMap<PaintPolygon>(([cell, values]) =>
      values.length
        ? values.map((value, index) => ({ cell, value, key: `${cell}-${value}-${index}` }))
        : [{ cell, value: null, key: `${cell}-empty` }]
    );
    overlay
      .selectAll<SVGPolygonElement, PaintPolygon>("polygon")
      .data(polygons, ({ key }) => key)
      .join("polygon")
      .attr("data-cell", ({ cell }) => cell)
      .attr("data-value", ({ value }) => value ?? "")
      .attr("points", ({ cell }) => getPackPolygon(cell, pack).join(" "))
      .attr("fill", ({ value }) => (value === null ? "#ffffff" : (colors.get(value) ?? "#ffffff")))
      .attr("stroke", ({ value }) => (value === null ? "#555555" : (colors.get(value) ?? "#ffffff")));
  };

  const paintCells = (cells: readonly number[], nextValue: number): boolean => {
    let changed = false;
    for (const cell of cells) {
      const currentValues = getCurrentValues(cell);
      const isErase = options.mode === "multiple" && isEraseEnabled();
      if (options.landOnlyControl && isLandOnlyEnabled() && pack.cells.h[cell] < 20) continue;
      if (
        options.dontOverrideCotrol &&
        !isErase &&
        isDontOverrideEnabled() &&
        currentValues.some(value => value !== 0)
      ) {
        continue;
      }

      let nextValues: readonly number[];
      if (options.mode === "multiple") {
        if (options.filterCell && !options.filterCell(cell, currentValues, nextValue)) continue;
        nextValues = isErase
          ? currentValues.filter(value => value !== nextValue)
          : currentValues.includes(nextValue)
            ? currentValues
            : [...currentValues, nextValue];
      } else {
        const currentValue = currentValues[0];
        if (options.filterCell && !options.filterCell(cell, currentValue, nextValue)) continue;
        nextValues = [nextValue];
      }

      if (
        nextValues.length === currentValues.length &&
        nextValues.every((value, index) => value === currentValues[index])
      ) {
        continue;
      }

      const baseValues = getBaseValues(cell);
      if (nextValues.length === baseValues.length && nextValues.every((value, index) => value === baseValues[index])) {
        changes.delete(cell);
      } else {
        changes.set(cell, nextValues);
      }
      changed = true;
    }
    if (changed) renderChanges();
    return changed;
  };

  const cleanup = () => {
    if (cancelActiveSession === cancel) cancelActiveSession = null;
    history.length = 0;
    destroyDialog(dialogId);
    select(`#${overlayId}`).remove();
    removeCircle();
    if (document.getElementById("viewbox")) applyDefaultViewboxEvents();
    clearMainTip();
    if (customization === customizationMode) customization = 0;
  };

  const finish = (apply: boolean) => {
    if (finalized) return;
    finalized = true;
    try {
      if (apply) {
        if (options.mode === "multiple") options.apply(new Map(changes));
        else options.apply(new Map([...changes].map(([cell, values]) => [cell, values[0]])));
      }
    } finally {
      cleanup();
    }
  };

  const cancel = () => finish(false);
  cancelActiveSession = cancel;

  const undo = () => {
    const snapshot = history.pop();
    if (!snapshot) return;
    changes.clear();
    for (const [cell, value] of snapshot) changes.set(cell, value);
    renderChanges();
    undoButton.disabled = !history.length;
  };

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .on("click", function (event: MouseEvent) {
      const [x, y] = getPointer(event, this);
      const cell = findCell(x, y);
      if (cell !== undefined) {
        const values = getCurrentValues(cell);
        const value = values.at(-1);
        if (value !== undefined) selectItem(value);
      }
    })
    .call(
      drag<SVGElement, unknown>().on("start", function (event: D3DragEvent<SVGElement, unknown, unknown>) {
        const radius = getRadius();
        const snapshot = new Map(changes);
        let recorded = false;

        event.on("drag", (dragEvent: D3DragEvent<SVGElement, unknown, unknown>) => {
          if (!dragEvent.dx && !dragEvent.dy) return;
          const [x, y] = getPointer(dragEvent, this);
          moveCircle(x, y, radius);

          const found = radius > 5 ? findAllCellsInRadius(x, y, radius, pack) : [findCell(x, y)];
          const cells = found.filter((cell): cell is number => cell !== undefined);
          if (!cells.length || selectedId === undefined || !paintCells(cells, selectedId) || recorded) return;

          history.push(snapshot);
          if (history.length > historyLimit) history.shift();
          undoButton.disabled = false;
          recorded = true;
        });
      })
    )
    .on("touchmove mousemove", function (event: MouseEvent | TouchEvent) {
      const [x, y] = getPointer(event, this);
      moveCircle(x, y, getRadius());
      const cell = findCell(x, y);
      if (cell === undefined) return;
      const hoveredNames = getCurrentValues(cell).flatMap(value => names.get(value) ?? []);
      tip(`${hoveredNames.join(", ") || "No assignment"}. Click to select, drag to paint`);
    });

  itemSelect.addEventListener("change", () => selectItem(+itemSelect.value));
  undoButton.addEventListener("click", undo);
  ensureEl("paintEditorApply").addEventListener("click", () => finish(true));
  ensureEl("paintEditorCancel").addEventListener("click", cancel);

  $(dialog).dialog({
    title: options.title,
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "svg", collision: "fit" },
    close: cancel
  });

  if (selectedId !== undefined) selectItem(selectedId);
  tip("Click to select, drag to paint", true);
}

export const PaintEditor = { open };
