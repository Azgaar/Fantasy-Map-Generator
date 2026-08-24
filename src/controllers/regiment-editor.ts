import { closeDialogs, confirmationDialog, destroyDialog, refreshEditors } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import {
  insertMilitaryRegiment,
  mergeMilitaryRegiments,
  moveMilitaryRegiment,
  moveRegimentBase,
  removeMilitaryRegiment,
  replaceMilitaryRegimentUnits,
  rotateMilitaryRegiment,
  setMilitaryRegimentIcon,
  setMilitaryRegimentName,
  setMilitaryRegimentNaval,
  setMilitaryRegimentUnit
} from "@/controllers/editor-mutations";
import type { Regiment } from "@/generators/military-generator";
import { drawMilitary } from "@/renderers/draw-military";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionGeometry,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  pickPixiRenderer,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import { getMapRendererStyle } from "@/renderers/scene/map-style-state";
import { speak } from "@/utils";
import { capitalize, ensureEl, last, rn } from "../utils";

type RegimentKey = { regimentId: number; stateId: number };
type RegimentMode = "add" | "attach" | "attack" | null;
type RegimentHandle = "base" | "position" | "rotation";

let selectedRegiment: RegimentKey | null = null;
let activeHandle: { initialAngle?: number; initialPoint?: { x: number; y: number }; kind: RegimentHandle } | null =
  null;
let activeMode: RegimentMode = null;

function open(stateId: number, regimentId: number): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!window.LayerControls.isLayerOn("toggleMilitary")) window.LayerControls.toggleLayer("toggleMilitary");

  const regiment = getRegimentById(stateId, regimentId);
  if (!regiment) return;
  selectedRegiment = { regimentId, stateId };
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editRegimentHandle as EventListener);

  renderDialog();
  updateRegimentData(regiment);
  renderRegimentOverlay();

  showDomDialog({
    content: ensureEl("regimentEditor"),
    onClose: closeEditor,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Regiment"
  });
}

function renderDialog(): void {
  destroyDialog("regimentEditor");
  const editorHtml = /* html */ `<div id="regimentEditor" class="dialog">
    <div id="regimentBody" style="padding-bottom: 0.3em">
      <div style="padding-bottom: 0.2em">
        <button id="regimentType" data-tip="Regiment type (land or naval). Click to change"></button>
        <input id="regimentName" data-tip="Type to rename the regiment" autocorrect="off" spellcheck="false" style="width: 13em" />
        <span id="regimentNameSpeak" data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
        <i id="regimentNameRestore" data-tip="Click to restore regiment's default name" class="icon-ccw pointer"></i>
      </div>
      <div data-tip="Regiment emblem" style="display: flex; align-items: center">
        <div class="label">Emblem:</div>
        <div id="regimentEmblem" style="font-size: 1.5em; width: 3.7em"></div>
        <button id="regimentEmblemChange" style="padding: 0; width: 4.5em">change</button>
      </div>
      <div id="regimentComposition" class="table"></div>
    </div>
    <div id="regimentBottom">
      <button id="regimentAttack" data-tip="Attack foreign regiment" class="icon-target"></button>
      <button id="regimentAdd" data-tip="Create a new regiment or fleet" class="icon-user-plus"></button>
      <button id="regimentSplit" data-tip="Split regiment into 2 separate ones" class="icon-half"></button>
      <button id="regimentAttach" data-tip="Attach regiment to another one (include this regiment to another one)" class="icon-attach"></button>
      <button id="regimentRegenerateLegend" data-tip="Regenerate legend for this regiment" class="icon-retweet"></button>
      <button id="regimentLegend" data-tip="Edit free text notes (legend) for this regiment" class="icon-edit"></button>
      <button id="regimentRemove" data-tip="Remove regiment" data-shortcut="Delete" class="icon-trash fastDelete"></button>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  ensureEl("regimentNameRestore").addEventListener("click", restoreName);
  ensureEl("regimentNameSpeak").addEventListener("click", () =>
    speak(ensureEl<HTMLInputElement>("regimentName").value)
  );
  ensureEl("regimentType").addEventListener("click", changeType);
  ensureEl("regimentName").addEventListener("change", changeName);
  ensureEl("regimentEmblemChange").addEventListener("click", changeEmblem);
  ensureEl("regimentAttack").addEventListener("click", () => toggleMode("attack"));
  ensureEl("regimentRegenerateLegend").addEventListener("click", regenerateLegend);
  ensureEl("regimentLegend").addEventListener("click", editLegend);
  ensureEl("regimentSplit").addEventListener("click", splitRegiment);
  ensureEl("regimentAdd").addEventListener("click", () => toggleMode("add"));
  ensureEl("regimentAttach").addEventListener("click", () => toggleMode("attach"));
  ensureEl("regimentRemove").addEventListener("click", removeRegiment);
}

function getRegiment(): Regiment | undefined {
  return selectedRegiment ? getRegimentById(selectedRegiment.stateId, selectedRegiment.regimentId) : undefined;
}

function getRegimentById(stateId: number, regimentId: number): Regiment | undefined {
  return pack.states[stateId]?.military?.find(regiment => regiment.i === regimentId);
}

function getRegimentNoteId(key = selectedRegiment): string {
  return key ? `regiment${key.stateId}-${key.regimentId}` : "";
}

function updateRegimentData(regiment: Regiment): void {
  ensureEl("regimentType").className = regiment.n ? "icon-anchor" : "icon-users";
  ensureEl<HTMLInputElement>("regimentName").value = regiment.name;
  ensureEl("regimentEmblem").innerHTML = isExternalIcon(regiment.icon)
    ? `<img src="${regiment.icon}" style="width: 1em; height: 1em;">`
    : regiment.icon;

  const composition = ensureEl("regimentComposition");
  composition.innerHTML = options.military
    .map(
      unit => `<div data-tip="${capitalize(unit.name)} number. Input to change">
        <div class="label">${capitalize(unit.name)}:</div>
        <input data-u="${unit.name}" type="number" min="0" step="1" value="${regiment.u[unit.name] || 0}">
        <i>${unit.type}</i></div>`
    )
    .join("");
  composition.querySelectorAll<HTMLInputElement>("input").forEach(input => {
    input.addEventListener("change", changeUnit);
  });
}

function changeType(): void {
  const regiment = getRegiment();
  if (!regiment) return;
  if (setMilitaryRegimentNaval(regiment, +!regiment.n).changed) drawMilitary();
  ensureEl("regimentType").className = regiment.n ? "icon-anchor" : "icon-users";
  renderRegimentOverlay();
}

function changeName(this: HTMLInputElement): void {
  const regiment = getRegiment();
  if (!regiment) return;
  if (setMilitaryRegimentName(regiment, this.value).changed) drawMilitary();
}

function restoreName(): void {
  const regiment = getRegiment();
  if (!regiment || !selectedRegiment) return;
  const name = Military.getName(regiment, pack.states[selectedRegiment.stateId].military!);
  ensureEl<HTMLInputElement>("regimentName").value = name;
  if (setMilitaryRegimentName(regiment, name).changed) drawMilitary();
}

function changeEmblem(): void {
  const regiment = getRegiment();
  if (!regiment) return;
  Controllers.IconSelector.open(regiment.icon ?? "", value => {
    if (setMilitaryRegimentIcon(regiment, value).changed) drawMilitary();
    ensureEl("regimentEmblem").innerHTML = isExternalIcon(value)
      ? `<img src="${value}" style="width: 1em; height: 1em;">`
      : value;
  });
}

function changeUnit(this: HTMLInputElement): void {
  const regiment = getRegiment();
  if (!regiment) return;
  if (setMilitaryRegimentUnit(regiment, this.dataset.u!, +this.value || 0).changed) drawMilitary();
  refreshEditors();
}

function splitRegiment(): void {
  const regiment = getRegiment();
  if (!regiment || !selectedRegiment) return;
  const military = pack.states[selectedRegiment.stateId].military!;
  const newUnits = Object.fromEntries(Object.entries(regiment.u).map(([unit, count]) => [unit, Math.floor(count / 2)]));
  const total = Object.values(newUnits).reduce((sum, count) => sum + count, 0);
  if (!total) {
    tip("Not enough forces to split", false, "error");
    return;
  }

  const originalUnits = Object.fromEntries(
    Object.entries(regiment.u).map(([unit, count]) => [unit, Math.ceil(count / 2)])
  );
  replaceMilitaryRegimentUnits(regiment, originalUnits);
  ensureEl("regimentComposition")
    .querySelectorAll<HTMLInputElement>("input")
    .forEach(input => {
      input.value = String(regiment.u[input.dataset.u!] || 0);
    });

  const shift = getMapRendererStyle(style).military.boxSize * 2;
  const findY = (x: number, startY: number): number => {
    let y = startY;
    do y += shift;
    while (military.some(candidate => candidate.x === x && candidate.y === y));
    return y;
  };
  const newRegiment: Regiment = {
    a: total,
    bx: regiment.bx,
    by: regiment.by,
    cell: regiment.cell,
    i: military.length ? last(military).i + 1 : 0,
    icon: regiment.icon,
    n: regiment.n,
    name: "",
    s: 0,
    state: selectedRegiment.stateId,
    t: 0,
    type: regiment.type,
    u: newUnits,
    x: regiment.x,
    y: findY(regiment.x, regiment.y)
  };
  newRegiment.name = Military.getName(newRegiment, military);
  insertMilitaryRegiment(military, newRegiment);
  Military.generateNote(newRegiment, pack.states[selectedRegiment.stateId]);
  drawMilitary();
  renderRegimentOverlay();
  refreshEditors();
}

function toggleMode(mode: Exclude<RegimentMode, null>): void {
  setMode(activeMode === mode ? null : mode);
}

function setMode(mode: RegimentMode): void {
  activeMode = mode;
  for (const [buttonId, buttonMode] of [
    ["regimentAdd", "add"],
    ["regimentAttack", "attack"],
    ["regimentAttach", "attach"]
  ] as const) {
    document.getElementById(buttonId)?.classList.toggle("pressed", mode === buttonMode);
  }

  const viewbox = document.getElementById("viewbox");
  viewbox?.removeEventListener("click", handleModeClick, true);
  if (!mode) {
    if (viewbox) viewbox.style.cursor = "default";
    clearMainTip();
    return;
  }
  if (viewbox) viewbox.style.cursor = "crosshair";
  viewbox?.addEventListener("click", handleModeClick, true);
  const messages = {
    add: "Click on map to create new regiment or fleet",
    attack: "Click on another regiment to initiate battle",
    attach: "Click on another regiment to unite both regiments. The current regiment will be removed"
  };
  tip(messages[mode], true);
}

function handleModeClick(event: MouseEvent): void {
  if (!activeMode) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (activeMode === "add") addRegimentAt(event);
  else if (activeMode === "attack") attackRegimentAt(event);
  else attachRegimentAt(event);
}

function addRegimentAt(event: MouseEvent): void {
  if (!selectedRegiment) return;
  const point = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!point) return;
  const cell = findCell(point.x, point.y);
  if (cell === undefined) return;
  const [x, y] = pack.cells.p[cell];
  const stateId = selectedRegiment.stateId;
  const military = pack.states[stateId].military!;
  const regiment: Regiment = {
    a: 0,
    bx: x,
    by: y,
    cell,
    i: military.length ? last(military).i + 1 : 0,
    icon: "🛡️",
    n: +(pack.cells.h[cell] < 20),
    name: "",
    s: 0,
    state: stateId,
    t: 0,
    type: "",
    u: {},
    x,
    y
  };
  regiment.name = Military.getName(regiment, military);
  insertMilitaryRegiment(military, regiment);
  Military.generateNote(regiment, pack.states[stateId]);
  drawMilitary();
  refreshEditors();
  setMode(null);
}

function attackRegimentAt(event: MouseEvent): void {
  const target = getPickedRegiment(event);
  if (!target || !selectedRegiment) {
    tip("Please click on a regiment to attack", false, "error");
    return;
  }
  if (sameKey(target, selectedRegiment)) {
    tip("Regiment cannot attack itself", false, "error");
    return;
  }
  if (target.stateId === selectedRegiment.stateId) {
    tip("Cannot attack fraternal regiment", false, "error");
    return;
  }

  const attacker = getRegiment();
  const defender = getRegimentById(target.stateId, target.regimentId);
  if (!attacker || !defender || !attacker.a || !defender.a) {
    tip("Regiment has no troops to battle", false, "error");
    return;
  }
  attacker.px = attacker.x;
  attacker.py = attacker.y;
  defender.px = defender.x;
  defender.py = defender.y;
  moveMilitaryRegiment(attacker, { x: defender.x, y: defender.y - 8 });
  drawMilitary();
  closeEditor();
  window.setTimeout(() => Controllers.BattleScreen.open(attacker, defender), 700);
}

function attachRegimentAt(event: MouseEvent): void {
  const target = getPickedRegiment(event);
  if (!target || !selectedRegiment) {
    tip("Please click on a regiment", false, "error");
    return;
  }
  if (sameKey(target, selectedRegiment)) {
    tip("Cannot attach regiment to itself. Please click on another regiment", false, "error");
    return;
  }

  const sourceKey = { ...selectedRegiment };
  const source = getRegiment();
  const targetRegiment = getRegimentById(target.stateId, target.regimentId);
  if (!source || !targetRegiment) return;
  mergeMilitaryRegiments(source, targetRegiment);
  removeMilitaryRegiment(pack.states[sourceKey.stateId].military!, sourceKey.stateId, sourceKey.regimentId);
  removeRegimentNote(sourceKey);
  drawMilitary();
  refreshEditors();
  closeEditor();
  open(target.stateId, target.regimentId);
}

function getPickedRegiment(event: MouseEvent): RegimentKey | null {
  const hit = pickPixiRenderer(event.clientX, event.clientY);
  if (hit?.domainKind !== "regiment") return null;
  const stateId = Number(hit.subPart?.stateId);
  const regimentId = Number(hit.subPart?.regimentId);
  return Number.isFinite(stateId) && Number.isFinite(regimentId) ? { regimentId, stateId } : null;
}

function regenerateLegend(): void {
  const regiment = getRegiment();
  if (!regiment || !selectedRegiment) return;
  removeRegimentNote(selectedRegiment);
  Military.generateNote(regiment, pack.states[selectedRegiment.stateId]);
}

function editLegend(): void {
  const regiment = getRegiment();
  if (!regiment) return;
  void Controllers.NotesEditor.open(getRegimentNoteId(), regiment.name);
}

function removeRegiment(): void {
  confirmationDialog({
    confirm: "Remove",
    message: "Are you sure you want to remove the regiment?",
    onConfirm: () => {
      if (!selectedRegiment) return;
      const key = { ...selectedRegiment };
      const mutation = removeMilitaryRegiment(pack.states[key.stateId].military!, key.stateId, key.regimentId);
      if (!mutation.changed) return;
      removeRegimentNote(key);
      drawMilitary();
      refreshEditors();
      closeEditor();
    },
    title: "Remove regiment"
  });
}

function removeRegimentNote(key: RegimentKey): void {
  const index = notes.findIndex(note => note.id === getRegimentNoteId(key));
  if (index !== -1) notes.splice(index, 1);
}

function editRegimentHandle(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const handleId = String(event.detail.handleId);
  if (!handleId.startsWith("regiment:")) return;
  const kind = handleId.slice("regiment:".length) as RegimentHandle;
  if (!(["base", "position", "rotation"] as const).includes(kind)) return;
  const regiment = getRegiment();
  if (!regiment) return;

  if (event.detail.phase === "start") {
    activeHandle =
      kind === "rotation"
        ? { initialAngle: regiment.angle ?? 0, kind }
        : {
            initialPoint: kind === "base" ? { x: regiment.bx, y: regiment.by } : { x: regiment.x, y: regiment.y },
            kind
          };
    return;
  }
  if (event.detail.phase === "cancel") {
    restoreActiveHandle(regiment);
    activeHandle = null;
    drawMilitary();
    renderRegimentOverlay();
    return;
  }
  if (event.detail.phase === "move") {
    const point = { x: rn(event.detail.worldPoint.x, 2), y: rn(event.detail.worldPoint.y, 2) };
    const mutation =
      kind === "position"
        ? moveMilitaryRegiment(regiment, point)
        : kind === "base"
          ? moveRegimentBase(regiment, point)
          : rotateMilitaryRegiment(
              regiment,
              rn(Math.atan2(point.y - regiment.y, point.x - regiment.x) * (180 / Math.PI), 2)
            );
    if (mutation.changed) drawMilitary();
    return;
  }
  if (event.detail.phase !== "end" || activeHandle?.kind !== kind) return;
  activeHandle = null;
  renderRegimentOverlay();
  refreshEditors();
}

function restoreActiveHandle(regiment: Regiment): void {
  if (!activeHandle) return;
  if (activeHandle.kind === "rotation" && activeHandle.initialAngle !== undefined) {
    rotateMilitaryRegiment(regiment, activeHandle.initialAngle);
  } else if (activeHandle.initialPoint) {
    if (activeHandle.kind === "base") moveRegimentBase(regiment, activeHandle.initialPoint);
    else moveMilitaryRegiment(regiment, activeHandle.initialPoint);
  }
}

function renderRegimentOverlay(): void {
  const regiment = getRegiment();
  if (!regiment) return;
  const boxSize = getMapRendererStyle(style).military.boxSize;
  const angle = ((regiment.angle ?? 0) * Math.PI) / 180;
  const halfWidth = boxSize * (regiment.n ? 2 : 3);
  const halfHeight = boxSize;
  const outline = [
    rotateOffset(regiment, -halfWidth, -halfHeight, angle),
    rotateOffset(regiment, halfWidth, -halfHeight, angle),
    rotateOffset(regiment, halfWidth, halfHeight, angle),
    rotateOffset(regiment, -halfWidth, halfHeight, angle)
  ];
  const selection: MapInteractionGeometry[] = [
    { kind: "polygon", points: outline },
    {
      kind: "polyline",
      points: [
        { x: regiment.bx, y: regiment.by },
        { x: regiment.x, y: regiment.y }
      ]
    }
  ];
  updateMapInteractionOverlay({
    handles: [
      { id: "regiment:position", label: `Move ${regiment.name}`, point: { x: regiment.x, y: regiment.y } },
      { id: "regiment:base", label: `Move ${regiment.name} base`, point: { x: regiment.bx, y: regiment.by } },
      {
        id: "regiment:rotation",
        label: `Rotate ${regiment.name}`,
        point: rotateOffset(regiment, halfWidth + boxSize, 0, angle)
      }
    ],
    selection
  });
}

function rotateOffset(regiment: Regiment, x: number, y: number, angle: number): { x: number; y: number } {
  return {
    x: regiment.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: regiment.y + x * Math.sin(angle) + y * Math.cos(angle)
  };
}

function isExternalIcon(icon: string): boolean {
  return icon.startsWith("http") || icon.startsWith("data:image");
}

function sameKey(left: RegimentKey, right: RegimentKey): boolean {
  return left.stateId === right.stateId && left.regimentId === right.regimentId;
}

function closeEditor(): void {
  document
    .getElementById("map")
    ?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editRegimentHandle as EventListener);
  setMode(null);
  clearMapInteractionOverlay();
  activeHandle = null;
  selectedRegiment = null;
  applyDefaultViewboxEvents();
  destroyDialog("regimentEditor");
}

export const RegimentEditor = { open };
