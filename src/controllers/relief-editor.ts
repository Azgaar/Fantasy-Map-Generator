import { drag, quadtree, range, select } from "d3";
import { closeDialogs, confirmationDialog, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, showMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import {
  insertReliefIcon,
  moveReliefIcon,
  removeReliefIcons,
  reorderReliefIcon,
  resizeReliefIcon,
  setReliefIconType
} from "@/controllers/editor-mutations";
import { RELIEF_ICONS, RELIEF_SETS } from "@/data/relief-icons";
import { ensureReliefIconIds, getReliefIconId, type ReliefIcon } from "@/generators/relief-generator";
import { redrawRelief } from "@/renderers/draw-relief-icons";
import {
  MAP_INTERACTION_HANDLE_EVENT,
  type MapInteractionHandleEventDetail
} from "@/renderers/interaction/map-interaction-overlay";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import {
  clearMapInteractionOverlay,
  getPixiMapPointAtClient,
  updateMapInteractionOverlay
} from "@/renderers/pixi/pixi-renderer-controller";
import type { ReliefSet } from "@/types/relief";
import { capitalize, ensureEl, findAllInQuadtree, rn } from "../utils";

const ICON_BOX = 40; // icon preview box size in px, as defined in css

let selectedIcon: ReliefIcon | null = null;
let activeIcon: { initialPoint: { x: number; y: number }; reliefId: number } | null = null;

const setsHtml = (): string =>
  Object.entries(RELIEF_SETS)
    .map(([set, { name }]) => `<option value="${set}">${name}</option>`)
    .join("");

// icons of every set, only the selected set is displayed
const iconsHtml = (): string =>
  Object.keys(RELIEF_SETS)
    .map(set => `<div data-type="${set}" style="display: none">${setIconsHtml(set as ReliefSet)}</div>`)
    .join("");

const setIconsHtml = (set: ReliefSet): string =>
  RELIEF_ICONS.filter(({ set: iconsSet }) => iconsSet === RELIEF_SETS[set].base)
    .flatMap(({ type, variants, zoom = 1 }) => {
      const size = ICON_BOX * zoom;
      const offset = 50 - 50 * zoom; // percent, keeps the zoomed icon centered in the box
      const name = capitalize(type.replace(/([A-Z])/g, " $1").toLowerCase());

      return variants.map(variant => {
        const id = getReliefIconId(type, variant, set);
        return /* html */ `<svg data-type="${id}" data-tip="Select ${name} icon">
          <use href="#${id}" x="${offset}%" y="${offset}%" width="${size}" height="${size}"></use>
        </svg>`;
      });
    })
    .join("");

function open(reliefId: number): void {
  if (customization) return;
  closeDialogs(".stable");
  if (!window.LayerControls.isLayerOn("toggleRelief")) window.LayerControls.toggleLayer("toggleRelief");

  ensureReliefIconIds(pack.relief);
  selectedIcon = pack.relief.find(icon => icon.i === reliefId) ?? null;
  if (!selectedIcon) return;
  document.getElementById("map")?.addEventListener(MAP_INTERACTION_HANDLE_EVENT, editReliefIcon as EventListener);

  renderDialog();
  restoreEditMode();
  updateReliefIconSelected();
  updateReliefSizeInput();

  showDomDialog({
    content: ensureEl("reliefEditor"),
    onClose: closeReliefEditor,
    placement: "top-right",
    placementTarget: document.getElementById("map"),
    resizable: false,
    title: "Edit Relief Icons",
    width: "27em"
  });
}

function renderDialog(): void {
  destroyDialog("reliefEditor");
  const html = /* html */ `<div id="reliefEditor" class="dialog">
    <div id="reliefTools" data-tip="Select mode of operation">
      <div class="reliefEditorLabel">Mode:</div>
      <button id="reliefIndividual" data-tip="Edit individual selected icon" class="icon-info pressed"></button>
      <button id="reliefBulkAdd" data-tip="Place icons in a bulk" class="icon-brush"></button>
      <button id="reliefBulkRemove" data-tip="Remove icons in a bulk" class="icon-eraser"></button>
      <div style="margin-left: 4.6em">Set:</div>
      <select id="reliefEditorSet">${setsHtml()}</select>
    </div>
    <div id="reliefSizeDiv" data-tip="Set icon size for individual icon or for bulk placement">
      <div class="reliefEditorLabel">Size:</div>
      <input
        id="reliefSize"
        oninput="reliefSizeNumber.value = this.value"
        type="range"
        min="2"
        max="50"
        value="5"
      />
      <input id="reliefSizeNumber" oninput="reliefSize.value = this.value" type="number" min="2" value="5" />
    </div>
    <div id="reliefRadiusDiv" data-tip="Set brush radius for icons placement on deletion" style="display: none">
      <div class="reliefEditorLabel">Radius:</div>
      <input
        id="reliefRadius"
        oninput="reliefRadiusNumber.value = this.value"
        type="range"
        min="1"
        max="100"
        value="15"
      />
      <input id="reliefRadiusNumber" oninput="reliefRadius.value = this.value" type="number" min="1" value="15" />
    </div>
    <div id="reliefSpacingDiv" data-tip="Set spacing between relief icons" style="display: none">
      <div class="reliefEditorLabel">Spacing:</div>
      <input
        id="reliefSpacing"
        oninput="reliefSpacingNumber.value = this.value"
        type="range"
        min="2"
        max="20"
        value="5"
      />
      <input id="reliefSpacingNumber" oninput="reliefSpacing.value = this.value" type="number" min="2" value="5" />
    </div>
    <div id="reliefIconsDiv" data-tip="Select icon">
${iconsHtml()}
      <svg id="reliefIconsSeletionAny" data-tip="Select any type of icons"><text x="50%" y="50%">Any</text></svg>
    </div>
    <div id="reliefBottom">
      <button id="reliefEditStyle" data-tip="Edit Relief Icons style in Style Editor" class="icon-adjust"></button>
      <button id="reliefCopy" data-tip="Copy selected relief icon" class="icon-clone"></button>
      <button id="reliefMoveFront" data-tip="Move selected relief icon to front" class="icon-level-up"></button>
      <button id="reliefMoveBack" data-tip="Move selected relief icon back" class="icon-level-down"></button>
      <button
        id="reliefRemove"
        data-tip="Remove selected relief icon or icon type"
        data-shortcut="Delete"
        class="icon-trash fastDelete"
      ></button>
    </div>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  ensureEl("reliefIndividual").addEventListener("click", enterIndividualMode);
  ensureEl("reliefBulkAdd").addEventListener("click", enterBulkAddMode);
  ensureEl("reliefBulkRemove").addEventListener("click", enterBulkRemoveMode);

  ensureEl("reliefSize").addEventListener("input", changeIconSize);
  ensureEl("reliefSizeNumber").addEventListener("input", changeIconSize);
  ensureEl("reliefEditorSet").addEventListener("change", changeIconsSet);
  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg")
    .forEach(el => {
      el.addEventListener("click", changeIcon);
    });

  ensureEl("reliefEditStyle").addEventListener("click", () => window.StyleEditor.edit("terrain"));
  ensureEl("reliefCopy").addEventListener("click", copyIcon);
  ensureEl("reliefMoveFront").addEventListener("click", () => moveIcon("front"));
  ensureEl("reliefMoveBack").addEventListener("click", () => moveIcon("back"));
  ensureEl("reliefRemove").addEventListener("click", removeIcon);

  changeIconsSet(); // all sets are hidden in markup, show the selected one
}

function restoreEditMode(): void {
  if (!ensureEl("reliefTools").querySelector("button.pressed")) enterIndividualMode();
  else if (ensureEl("reliefBulkAdd").classList.contains("pressed")) enterBulkAddMode();
  else if (ensureEl("reliefBulkRemove").classList.contains("pressed")) enterBulkRemoveMode();
}

function updateReliefIconSelected(): void {
  if (!selectedIcon) return;
  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const button = reliefIconsDiv.querySelector(`svg[data-type='${selectedIcon.icon}']`);
  if (!button) return;

  reliefIconsDiv.querySelectorAll("svg.pressed").forEach(b => {
    b.classList.remove("pressed");
  });
  button.classList.add("pressed");
  reliefIconsDiv.querySelectorAll<HTMLElement>("div").forEach(b => {
    b.style.display = "none";
  });
  const parent = button.parentNode as HTMLElement;
  parent.style.display = "block";
  ensureEl<HTMLSelectElement>("reliefEditorSet").value = parent.dataset.type!;
}

function updateReliefSizeInput(): void {
  if (!selectedIcon) return;
  ensureEl<HTMLInputElement>("reliefSize").value = ensureEl<HTMLInputElement>("reliefSizeNumber").value = String(
    rn(selectedIcon.s)
  );
}

function enterIndividualMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefIndividual").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "block";
  ensureEl("reliefRadiusDiv").style.display = "none";
  ensureEl("reliefSpacingDiv").style.display = "none";
  ensureEl("reliefIconsSeletionAny").style.display = "none";

  removeCircle();
  updateReliefSizeInput();
  applyDefaultViewboxEvents();
  clearMainTip();
  renderReliefOverlay();
}

function enterBulkAddMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkAdd").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "block";
  ensureEl("reliefRadiusDiv").style.display = "block";
  ensureEl("reliefSpacingDiv").style.display = "block";
  ensureEl("reliefIconsSeletionAny").style.display = "none";

  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const pressedType = reliefIconsDiv.querySelector("svg.pressed");
  if (pressedType?.id === "reliefIconsSeletionAny") {
    // if "any" is pressed, select first type
    ensureEl("reliefIconsSeletionAny").classList.remove("pressed");
    reliefIconsDiv.querySelector("svg")?.classList.add("pressed");
  }

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToAdd))
    .on("touchmove mousemove", moveBrush);
  updateMapInteractionOverlay({ handles: [], selection: null });
  tip("Drag to place relief icons within radius", true);
}

function moveBrush(this: SVGElement, event: MouseEvent): void {
  showMainTip();
  const point = getPixiMapPointAtClient(event.clientX, event.clientY);
  if (!point) return;
  const radius = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  moveCircle(point.x, point.y, radius);
}

function dragToAdd(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("Please select an icon", false, "error");
    return;
  }

  const icon = pressed.dataset.type!;
  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const spacing = +ensureEl<HTMLInputElement>("reliefSpacingNumber").value;
  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;

  const tree = quadtree(pack.relief.map(({ x, y, s }) => [x + s / 2, y + s / 2] as [number, number]));

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const point = getReliefMapPoint(dragEvent);
    if (!point) return;
    moveCircle(point.x, point.y, r);

    range(Math.ceil(r / 10)).forEach(() => {
      const a = Math.PI * 2 * Math.random();
      const rad = r * Math.random();
      const cx = point.x + rad * Math.cos(a);
      const cy = point.y + rad * Math.sin(a);

      if (tree.find(cx, cy, spacing)) return; // too close to existing icon
      if (pack.cells.h[findCell(cx, cy)!] < 20) return; // on water cell

      const h = rn((size / 2) * (Math.random() * 0.4 + 0.8), 2);
      tree.add([cx, cy]);
      insertIcon({ icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2) });
    });

    redrawRelief();
  });
}

// icons are kept sorted by their bottom edge, so the closer ones are drawn on top
function insertIcon(icon: ReliefIcon): void {
  const bottom = icon.y + icon.s;
  let low = 0;
  let high = pack.relief.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pack.relief[mid].y + pack.relief[mid].s <= bottom) low = mid + 1;
    else high = mid;
  }
  insertReliefIcon(pack, icon, low);
}

function enterBulkRemoveMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkRemove").classList.add("pressed");

  ensureEl("reliefSizeDiv").style.display = "none";
  ensureEl("reliefRadiusDiv").style.display = "block";
  ensureEl("reliefSpacingDiv").style.display = "none";
  ensureEl("reliefIconsSeletionAny").style.display = "inline-block";

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToRemove))
    .on("touchmove mousemove", moveBrush);
  updateMapInteractionOverlay({ handles: [], selection: null });
  tip("Drag to remove relief icons in radius", true);
}

function dragToRemove(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("Please select an icon", false, "error");
    return;
  }

  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const icon = pressed.dataset.type;
  const tree = quadtree<[number, number, ReliefIcon]>();
  for (const reliefIcon of pack.relief) {
    if (icon && reliefIcon.icon !== icon) continue;
    tree.add([reliefIcon.x + reliefIcon.s / 2, reliefIcon.y + reliefIcon.s / 2, reliefIcon]);
  }

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const point = getReliefMapPoint(dragEvent);
    if (!point) return;
    moveCircle(point.x, point.y, r);

    const found: [number, number, ReliefIcon][] = findAllInQuadtree(point.x, point.y, r, tree);
    if (!found.length) return;

    const removed = new Set(found.map(entry => entry[2]));
    for (const entry of found) tree.remove(entry);
    removeReliefIcons(pack, new Set([...removed].flatMap(icon => (icon.i === undefined ? [] : [icon.i]))));
    if (selectedIcon && removed.has(selectedIcon)) selectedIcon = null;
    redrawRelief();
  });
}

function changeIconSize(): void {
  if (!selectedIcon?.i || !ensureEl("reliefIndividual").classList.contains("pressed")) return;

  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;
  if (resizeReliefIcon(pack, selectedIcon.i, size).changed) {
    redrawRelief();
    renderReliefOverlay();
  }
}

function changeIconsSet(): void {
  const set = ensureEl<HTMLSelectElement>("reliefEditorSet").value;
  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  reliefIconsDiv.querySelectorAll<HTMLElement>("div").forEach(b => {
    b.style.display = "none";
  });
  reliefIconsDiv.querySelector<HTMLElement>(`div[data-type='${set}']`)!.style.display = "block";
}

function changeIcon(this: SVGElement): void {
  if (this.classList.contains("pressed")) return;

  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  this.classList.add("pressed");

  if (ensureEl("reliefIndividual").classList.contains("pressed") && selectedIcon?.i) {
    if (setReliefIconType(pack, selectedIcon.i, this.dataset.type!).changed) redrawRelief();
  }
}

function copyIcon(): void {
  if (!selectedIcon) return;

  let { x, y } = selectedIcon;
  do {
    x -= 3;
    y -= 3;
  } while (pack.relief.some(icon => icon.x === x && icon.y === y));

  const copy = { ...selectedIcon, i: undefined, x, y };
  insertReliefIcon(pack, copy);
  selectedIcon = copy;
  redrawRelief();
  renderReliefOverlay();
}

// move the icon to the top (front) or to the bottom (back) of the drawing order
function moveIcon(direction: "front" | "back"): void {
  if (!selectedIcon) return;

  if (selectedIcon.i && reorderReliefIcon(pack, selectedIcon.i, direction).changed) redrawRelief();
}

function removeIcon(): void {
  const isIndividual = ensureEl("reliefTools").querySelector("button.pressed")?.id === "reliefIndividual";
  const icon = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed")?.dataset.type;

  const doomed = isIndividual
    ? new Set(selectedIcon ? [selectedIcon] : [])
    : new Set(pack.relief.filter(reliefIcon => !icon || reliefIcon.icon === icon));

  const message = isIndividual
    ? "Are you sure you want to remove the icon?"
    : icon
      ? `Are you sure you want to remove all ${icon} icons (${doomed.size})?`
      : `Are you sure you want to remove all icons (${doomed.size})?`;

  confirmationDialog({
    confirm: "Remove",
    message,
    onConfirm: () => {
      removeReliefIcons(
        pack,
        new Set([...doomed].flatMap(reliefIcon => (reliefIcon.i === undefined ? [] : [reliefIcon.i])))
      );
      selectedIcon = null;
      redrawRelief();
      destroyDialog("reliefEditor");
    },
    title: "Remove relief icons"
  });
}

function editReliefIcon(event: CustomEvent<MapInteractionHandleEventDetail>): void {
  const serializedId = String(event.detail.handleId);
  if (!serializedId.startsWith("relief-icon:")) return;
  const reliefId = Number(serializedId.split(":")[1]);
  const icon = pack.relief.find(candidate => candidate.i === reliefId);
  if (!icon || selectedIcon?.i !== reliefId) return;

  if (event.detail.phase === "start") {
    activeIcon = { initialPoint: { x: icon.x, y: icon.y }, reliefId };
    return;
  }
  if (event.detail.phase === "cancel") {
    if (activeIcon?.reliefId === reliefId) {
      moveReliefIcon(pack, reliefId, activeIcon.initialPoint);
      activeIcon = null;
      redrawRelief();
      renderReliefOverlay();
    }
    return;
  }
  if (event.detail.phase === "move") {
    const point = {
      x: rn(event.detail.worldPoint.x - icon.s / 2, 2),
      y: rn(event.detail.worldPoint.y - icon.s / 2, 2)
    };
    if (moveReliefIcon(pack, reliefId, point).changed) redrawRelief();
    return;
  }
  if (event.detail.phase !== "end" || activeIcon?.reliefId !== reliefId) return;
  activeIcon = null;
  renderReliefOverlay();
}

function renderReliefOverlay(): void {
  if (!selectedIcon?.i || !ensureEl("reliefIndividual").classList.contains("pressed")) return;
  updateMapInteractionOverlay({
    handles: [
      {
        id: `relief-icon:${selectedIcon.i}`,
        label: `Move relief icon ${selectedIcon.i}`,
        point: { x: selectedIcon.x + selectedIcon.s / 2, y: selectedIcon.y + selectedIcon.s / 2 }
      }
    ],
    selection: [
      {
        height: selectedIcon.s,
        kind: "bounds",
        width: selectedIcon.s,
        x: selectedIcon.x,
        y: selectedIcon.y
      }
    ]
  });
}

function getReliefMapPoint(event: any): { x: number; y: number } | null {
  const source = event.sourceEvent ?? event;
  const touch = source.touches?.[0] ?? source.changedTouches?.[0];
  const clientX = touch?.clientX ?? source.clientX;
  const clientY = touch?.clientY ?? source.clientY;
  return Number.isFinite(clientX) && Number.isFinite(clientY) ? getPixiMapPointAtClient(clientX, clientY) : null;
}

function closeReliefEditor(): void {
  const wasUsingBrush = !ensureEl("reliefIndividual").classList.contains("pressed");
  document.getElementById("map")?.removeEventListener(MAP_INTERACTION_HANDLE_EVENT, editReliefIcon as EventListener);
  selectedIcon = null;
  activeIcon = null;
  removeCircle();
  clearMapInteractionOverlay();
  if (wasUsingBrush) applyDefaultViewboxEvents();
  clearMainTip();
  destroyDialog("reliefEditor");
}

export const ReliefEditor = { open };
