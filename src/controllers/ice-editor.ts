import { select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { Ice } from "@/generators/ice-generator";
import { redrawIceberg } from "@/renderers/draw-ice";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { ensureEl, findGridCell } from "../utils";
import { moveIce } from "./editor-mutations";

let selectedIceId: number | null = null;

function open(target: number | SVGElement): void {
  if (customization) return;
  const id = typeof target === "number" ? target : Number(target.dataset.id);
  if (document.getElementById("iceEditor") && id === selectedIceId) return;
  const iceElement = getIce(id);
  if (!iceElement) return;

  closeDialogs(".stable");
  if (!window.LayerControls.isLayerOn("toggleIce")) window.LayerControls.toggleLayer("toggleIce");

  selectedIceId = id;
  const isGlacier = iceElement.type === "glacier";
  const type = isGlacier ? "Glacier" : "Iceberg";

  renderDialog();

  const randomizeBtn = ensureEl("iceRandomize");
  const sizeInput = ensureEl<HTMLInputElement>("iceSize");
  randomizeBtn.style.display = isGlacier ? "none" : "inline-block";
  sizeInput.style.display = isGlacier ? "none" : "inline-block";
  if (!isGlacier) sizeInput.value = String(iceElement.size);
  renderIceOverlay();
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, moveSelectedIce as EventListener);

  showDomDialog({
    content: ensureEl("iceEditor"),
    onClose: closeEditor,
    placement: "top-center",
    placementOffset: { x: 0, y: 60 },
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: `Edit ${type}`
  });
}

function renderDialog(): void {
  destroyDialog("iceEditor");

  const html = /* html */ `<div id="iceEditor" class="dialog">
    <button id="iceEditStyle" data-tip="Edit style in Style Editor" class="icon-brush"></button>
    <button id="iceRandomize" data-tip="Randomize Iceberg shape" class="icon-shuffle"></button>
    <input id="iceSize" data-tip="Change Iceberg size" type="range" min=".05" max="2" step=".01" />
    <button id="iceNew" data-tip="Add an Iceberg (click on map)" class="icon-plus"></button>
    <button id="iceRemove" data-tip="Remove the element" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("iceEditStyle").addEventListener("click", () => window.StyleEditor.edit("ice"));
  ensureEl("iceRandomize").addEventListener("click", randomizeShape);
  ensureEl<HTMLInputElement>("iceSize").addEventListener("input", changeSize);
  ensureEl("iceNew").addEventListener("click", toggleAdd);
  ensureEl("iceRemove").addEventListener("click", removeIce);
}

function randomizeShape(): void {
  const selectedId = selectedIceId;
  if (selectedId === null) return;
  Ice.randomizeIcebergShape(selectedId);
  redrawIceberg(selectedId);
  renderIceOverlay();
}

function changeSize(this: HTMLInputElement): void {
  const newSize = +this.value;
  const selectedId = selectedIceId;
  if (selectedId === null) return;
  Ice.changeIcebergSize(selectedId, newSize);
  redrawIceberg(selectedId);
  renderIceOverlay();
}

function toggleAdd(): void {
  const iceNewBtn = ensureEl("iceNew");
  iceNewBtn.classList.toggle("pressed");
  if (iceNewBtn.classList.contains("pressed")) {
    select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", addIcebergOnClick);
    tip("Click on map to create an iceberg. Hold Shift to add multiple", true);
  } else {
    clearMainTip();
    applyDefaultViewboxEvents();
  }
}

function addIcebergOnClick(event: PointerEvent): void {
  const point = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!point) return;
  const i = findGridCell(point.x, point.y, grid);
  const size = +ensureEl<HTMLInputElement>("iceSize").value || 1;

  Ice.addIceberg(i, size);
  redrawIceberg(pack.ice.at(-1)?.i ?? -1);

  if (event.shiftKey === false) toggleAdd();
}

function removeIce(): void {
  const selectedId = selectedIceId;
  const selected = selectedId === null ? null : getIce(selectedId);
  if (!selected) return;
  const type = selected.type === "glacier" ? "Glacier" : "Iceberg";
  confirmationDialog({
    confirm: "Remove",
    message: `Are you sure you want to remove the ${type}?`,
    onConfirm: () => {
      Ice.removeIce(selected.i);
      redrawIceberg(selected.i);
      closeEditor();
    },
    title: `Remove ${type}`
  });
}

function moveSelectedIce(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  if (event.detail.handleId !== "ice-move" || !["move", "end"].includes(event.detail.phase)) return;
  const selected = selectedIceId === null ? null : getIce(selectedIceId);
  if (!selected) return;
  const mutation = moveIce(pack, selected.i, event.detail.worldPoint);
  if (mutation.changed) redrawIceberg(selected.i);
  if (event.detail.phase === "end") queueMicrotask(renderIceOverlay);
}

function closeEditor(): void {
  const wasAdding = ensureEl("iceNew").classList.contains("pressed");
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, moveSelectedIce as EventListener);
  selectedIceId = null;
  clearMapInteractionOverlay();
  clearMainTip();
  ensureEl("iceNew").classList.remove("pressed");
  if (wasAdding) applyDefaultViewboxEvents();
  destroyDialog("iceEditor");
}

function renderIceOverlay(): void {
  const selected = selectedIceId === null ? null : getIce(selectedIceId);
  if (!selected) {
    clearMapInteractionOverlay();
    return;
  }
  const [offsetX, offsetY] = selected.offset ?? [0, 0];
  const points = selected.points.map(([x, y]) => ({ x: x + offsetX, y: y + offsetY }));
  const center = getIceBaseCenter(selected);
  updateMapInteractionOverlay({
    handles: [
      {
        id: "ice-move",
        label: `Move ${selected.type}`,
        point: { x: center.x + offsetX, y: center.y + offsetY }
      }
    ],
    selection: [{ kind: "polygon", points }]
  });
}

function getIce(id: number): Ice | undefined {
  return pack.ice.find(ice => ice.i === id);
}

function getIceBaseCenter(ice: Ice): { x: number; y: number } {
  const count = Math.max(ice.points.length, 1);
  return {
    x: ice.points.reduce((sum, [x]) => sum + x, 0) / count,
    y: ice.points.reduce((sum, [, y]) => sum + y, 0) / count
  };
}

export const IceEditor = { open };
