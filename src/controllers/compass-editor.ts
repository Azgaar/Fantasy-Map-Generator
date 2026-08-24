import { destroyDialog } from "@/components/dialog/dialog-helpers";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { updateCompassStyle } from "@/controllers/editor-mutations";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import {
  clearMapInteractionOverlay,
  invalidatePixiRendererLayer,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import type { CompassLayerStyle } from "@/renderers/scene/styles";
import { ensureEl, rn } from "@/utils";

const COMPASS_SOURCE_SIZE = 440;
let initialPoint: { x: number; y: number } | null = null;

function open(): void {
  if (customization) return;
  if (!window.LayerControls.isLayerOn("toggleCompass")) window.LayerControls.toggleLayer("toggleCompass");
  getMapRendererStyle(style); // hydrate the complete semantic style before editing it in place
  renderDialog();
  updateInputs();
  renderOverlay();
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editCompassHandle as EventListener);

  showDomDialog({
    content: ensureEl("compassEditor"),
    onClose: close,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Wind Rose",
    width: "18em"
  });
}

function renderDialog(): void {
  destroyDialog("compassEditor");
  ensureEl("dialogs").insertAdjacentHTML(
    "beforeend",
    /* html */ `<div id="compassEditor" class="dialog">
      <div data-tip="Horizontal map position"><div class="label">X:</div><input id="compassEditorX" type="number" step="1" /></div>
      <div data-tip="Vertical map position"><div class="label">Y:</div><input id="compassEditorY" type="number" step="1" /></div>
      <div data-tip="Wind rose scale"><div class="label">Scale:</div><input id="compassEditorScale" type="number" min="0.02" max="2" step="0.01" /></div>
      <div data-tip="Wind rose opacity"><div class="label">Opacity:</div><input id="compassEditorOpacity" type="number" min="0" max="1" step="0.05" /></div>
    </div>`
  );
  for (const id of ["compassEditorX", "compassEditorY", "compassEditorScale", "compassEditorOpacity"]) {
    ensureEl<HTMLInputElement>(id).addEventListener("input", updateFromInputs);
  }
}

function getCompassStyle(): CompassLayerStyle {
  return style.mapRenderer!.compass;
}

function updateInputs(): void {
  const compass = getCompassStyle();
  ensureEl<HTMLInputElement>("compassEditorX").value = String(compass.x);
  ensureEl<HTMLInputElement>("compassEditorY").value = String(compass.y);
  ensureEl<HTMLInputElement>("compassEditorScale").value = String(compass.scale);
  ensureEl<HTMLInputElement>("compassEditorOpacity").value = String(compass.opacity);
}

function updateFromInputs(): void {
  const patch = {
    opacity: clamp(+ensureEl<HTMLInputElement>("compassEditorOpacity").value, 0, 1),
    scale: clamp(+ensureEl<HTMLInputElement>("compassEditorScale").value, 0.02, 2),
    x: +ensureEl<HTMLInputElement>("compassEditorX").value,
    y: +ensureEl<HTMLInputElement>("compassEditorY").value
  };
  if (updateCompassStyle(getCompassStyle(), patch).changed) invalidatePixiRendererLayer("compass");
  renderOverlay();
}

function editCompassHandle(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  if (event.detail.handleId !== "compass:position") return;
  const compass = getCompassStyle();
  if (event.detail.phase === "start") {
    initialPoint = { x: compass.x, y: compass.y };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (initialPoint && updateCompassStyle(compass, initialPoint).changed) invalidatePixiRendererLayer("compass");
    initialPoint = null;
    updateInputs();
    renderOverlay();
    return;
  }
  if (event.detail.phase === "move") {
    const point = { x: rn(event.detail.worldPoint.x, 2), y: rn(event.detail.worldPoint.y, 2) };
    if (updateCompassStyle(compass, point).changed) invalidatePixiRendererLayer("compass");
    return;
  }
  if (event.detail.phase !== "end") return;
  initialPoint = null;
  updateInputs();
  renderOverlay();
}

function renderOverlay(): void {
  const compass = getCompassStyle();
  const size = COMPASS_SOURCE_SIZE * compass.scale;
  updateMapInteractionOverlay({
    handles: [{ id: "compass:position", label: "Move wind rose", point: { x: compass.x, y: compass.y } }],
    selection: [
      {
        height: size,
        kind: "bounds",
        width: size,
        x: compass.x - size / 2,
        y: compass.y - size / 2
      }
    ]
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function close(): void {
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editCompassHandle as EventListener);
  initialPoint = null;
  clearMapInteractionOverlay();
  destroyDialog("compassEditor");
}

export const CompassEditor = { open };
