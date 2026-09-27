import { drag, quadtree, range, select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { clearMainTip, showMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import type { ReliefIcon, ReliefIconRef, ReliefIconType, ReliefSet, ReliefType } from "@/generators/relief-generator";
import { getReliefIcon, redrawRelief } from "@/renderers/draw-relief-icons";
import { moveCircle, removeCircle } from "@/renderers/overlays/brush-circle";
import { capitalize, ensureEl, findAllInQuadtree, getPointer, rn } from "../utils";
import { createBrushStroke } from "../utils/brushUtils";
import { fitReliefArt, reliefArtHtml } from "./relief-previews";

let selectedIcon: ReliefIcon | null = null;

let previewRequest = 0;
const setsHtml = (): string =>
  '<option value="">Default (style)</option>' +
  Relief.sets.map(set => `<option value="${set}">${capitalize(set)}</option>`).join("");

const setIconsHtml = (set: ReliefSet): string =>
  (Relief.types as readonly ReliefType[])
    .flatMap(({ type, label, variants }) =>
      range(1, variants + 1).map(variant => {
        const id = Relief.symbolId({ type, variant }, set);
        return reliefArtHtml(
          id,
          ` data-type="${type}" data-variant="${variant}" data-symbol="${id}" data-tip="Select ${label}"`
        );
      })
    )
    .join("");

/** the set the tiles show: the chosen one, else the style's */
const previewSet = (): ReliefSet =>
  (ensureEl<HTMLSelectElement>("reliefEditorSet").value || styles.relief.options.set) as ReliefSet;

function pickedRef(element: SVGElement): ReliefIconRef | null {
  const type = element.dataset.type as ReliefIconType | undefined;
  if (!type) return null;
  const set = ensureEl<HTMLSelectElement>("reliefEditorSet").value as ReliefSet | "";
  return Relief.ref(type, Number(element.dataset.variant) || 1, set || undefined);
}

function matchesTypeTile(icon: ReliefIcon, symbol: string | undefined): boolean {
  return !symbol || ("type" in icon && Relief.symbolId(icon, styles.relief.options.set) === symbol);
}

function open(element: SVGElement): void {
  if (customization) return;
  closeDialogs(".stable");
  Layers.show("relief");

  selectedIcon = getIconData(element);
  select<SVGGElement, unknown>("#terrain")
    .call(drag<SVGGElement, unknown>().on("start", dragReliefIcon))
    .classed("draggable", true);

  renderDialog();
  restoreEditMode();
  ensureEl<HTMLSelectElement>("reliefEditorSet").value =
    (selectedIcon && "set" in selectedIcon && selectedIcon.set) || "";
  void loadPreviews();
  updateReliefSizeInput();

  $("#reliefEditor").dialog({
    title: "Edit Relief Icons",
    resizable: false,
    width: "27em",
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeReliefEditor
  });
}

function renderDialog(): void {
  destroyDialog("reliefEditor");
  const slider = (
    name: string,
    tipText: string,
    min: number,
    max: number,
    value: number,
    hidden = false
  ) => /* html */ `
    <div id="relief${name}Div" class="reliefRow" data-tip="${tipText}"${hidden ? " hidden" : ""}>
      <div class="reliefEditorLabel">${name}:</div>
      <input id="relief${name}" oninput="relief${name}Number.value = this.value" type="range" min="${min}" max="${max}" value="${value}" />
      <input id="relief${name}Number" oninput="relief${name}.value = this.value" type="number" min="${min}" value="${value}" />
    </div>`;
  const html = /* html */ `<div id="reliefEditor" class="dialog">
    <div id="reliefTools" class="reliefRow">
      <div class="reliefEditorLabel">Mode:</div>
      <button id="reliefIndividual" data-tip="Edit individual selected icon" class="icon-info pressed"></button>
      <button id="reliefBulkAdd" data-tip="Place icons in a bulk" class="icon-brush"></button>
      <button id="reliefBulkRemove" data-tip="Remove icons in a bulk" class="icon-eraser"></button>
      <label class="reliefSet" data-tip="Relief set the icons are drawn in: the style's, or one pinned for the icon">
        <span class="reliefEditorLabel">Set:</span>
        <select id="reliefEditorSet">${setsHtml()}</select>
      </label>
    </div>
    ${slider("Size", "Set icon size for individual icon or for bulk placement", 2, 50, 5)}
    ${slider("Radius", "Set brush radius for icons placement on deletion", 1, 100, 15, true)}
    ${slider("Spacing", "Set spacing between relief icons", 2, 20, 5, true)}
    <div id="reliefIconsDiv" data-tip="Select icon">
      <div id="reliefSetIcons"></div>
      <svg id="reliefIconsSeletionAny" hidden viewBox="0 0 40 40" data-tip="Select any type of icons"><text x="20" y="20">Any</text></svg>
    </div>
    <div id="reliefBottom">
      <button id="reliefEditStyle" data-tip="Edit Relief Icons style in Style Editor" class="icon-adjust"></button>
      <button id="reliefEditRules" data-tip="Edit the relief rules: hills, mountains and other relief placed by elevation" class="icon-mountain"></button>
      <button id="reliefPickIcon" data-tip="Select own your own relief icon" class="icon-plus"></button>
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
  ensureEl("reliefIconsDiv").addEventListener("click", event => {
    const icon = (event.target as Element).closest<SVGElement>("svg");
    if (icon) changeIcon.call(icon);
  });

  ensureEl("reliefEditStyle").addEventListener("click", () => void Controllers.StyleEditor.open("relief"));
  ensureEl("reliefEditRules").addEventListener("click", () => void Controllers.ReliefRulesEditor.open());
  ensureEl("reliefPickIcon").addEventListener("click", pickAnyIcon);
  ensureEl("reliefCopy").addEventListener("click", copyIcon);
  ensureEl("reliefMoveFront").addEventListener("click", () => moveIcon("front"));
  ensureEl("reliefMoveBack").addEventListener("click", () => moveIcon("back"));
  ensureEl("reliefRemove").addEventListener("click", removeIcon);
}

function dragReliefIcon(event: any): void {
  const icon = getIconData(event.sourceEvent?.target);
  if (!icon) return;

  const dx = icon.x - event.x;
  const dy = icon.y - event.y;

  event.on("drag", (dragEvent: any) => {
    icon.x = rn(dx + dragEvent.x, 2);
    icon.y = rn(dy + dragEvent.y, 2);
    redrawRelief();
  });
}

function restoreEditMode(): void {
  if (!ensureEl("reliefTools").querySelector("button.pressed")) enterIndividualMode();
  else if (ensureEl("reliefBulkAdd").classList.contains("pressed")) enterBulkAddMode();
  else if (ensureEl("reliefBulkRemove").classList.contains("pressed")) enterBulkRemoveMode();
}

function updateReliefIconSelected(set: ReliefSet): void {
  const container = ensureEl("reliefIconsDiv");
  container.querySelectorAll("svg.pressed").forEach(icon => {
    icon.classList.remove("pressed");
  });
  if (!selectedIcon) return;
  const id = Relief.symbolId(selectedIcon, set);
  container.querySelector(`svg[data-symbol="${id}"]`)?.classList.add("pressed");
}

function updateReliefSizeInput(): void {
  if (!selectedIcon) return;
  const size = rn(selectedIcon.s * styles.relief.options.size); // the input is the drawn size
  ensureEl<HTMLInputElement>("reliefSize").value = ensureEl<HTMLInputElement>("reliefSizeNumber").value = String(size);
}

function showControls(shown: { size: boolean; radius: boolean; spacing: boolean; any: boolean }): void {
  ensureEl("reliefSizeDiv").hidden = !shown.size;
  ensureEl("reliefRadiusDiv").hidden = !shown.radius;
  ensureEl("reliefSpacingDiv").hidden = !shown.spacing;
  ensureEl("reliefIconsSeletionAny").toggleAttribute("hidden", !shown.any);
}

function enterIndividualMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefIndividual").classList.add("pressed");

  showControls({ size: true, radius: false, spacing: false, any: false });

  removeCircle();
  updateReliefSizeInput();
  applyDefaultViewboxEvents();
  clearMainTip();
}

function enterBulkAddMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkAdd").classList.add("pressed");

  showControls({ size: true, radius: true, spacing: true, any: false });

  const reliefIconsDiv = ensureEl("reliefIconsDiv");
  const pressedType = reliefIconsDiv.querySelector("svg.pressed");
  if (pressedType?.id === "reliefIconsSeletionAny") {
    // if "any" is pressed, select first type (never the "any" placeholder itself)
    ensureEl("reliefIconsSeletionAny").classList.remove("pressed");
    reliefIconsDiv.querySelector("svg[data-type]")?.classList.add("pressed");
  }

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToAdd))
    .on("touchmove mousemove", moveBrush);
  tip("Drag to place relief icons within radius", true);
}

function moveBrush(this: SVGElement, event: any): void {
  showMainTip();
  const point = getPointer(event, this);
  const radius = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  moveCircle(point[0], point[1], radius);
}

function dragToAdd(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  const icon = pressed && pickedRef(pressed);
  if (!icon) {
    tip("Please select an icon", false, "error");
    return;
  }
  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const spacing = +ensureEl<HTMLInputElement>("reliefSpacingNumber").value;
  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value;
  const scale = styles.relief.options.size;
  // the style size scales the drawing about the anchor, so the centre is x + s / 2 at every size
  const tree = quadtree(pack.relief.map(({ x, y, s }) => [x + s / 2, y + s / 2] as [number, number]));

  const stroke = createBrushStroke(r / 2, (x, y) => {
    range(Math.ceil(r / 10)).forEach(() => {
      const a = Math.PI * 2 * Math.random();
      const rad = r * Math.random();
      const cx = x + rad * Math.cos(a);
      const cy = y + rad * Math.sin(a);

      if (tree.find(cx, cy, spacing)) return; // too close to existing icon
      if (pack.cells.h[Pack.findCell(cx, cy)!] < 20) return; // on water cell

      const h = rn((size / scale / 2) * (Math.random() * 0.4 + 0.8), 2); // the input is the drawn size
      tree.add([cx, cy]);
      Relief.insert({ ...icon, x: rn(cx - h, 2), y: rn(cy - h, 2), s: rn(h * 2, 2) });
    });
  });
  const [startX, startY] = getPointer(event, this);
  let started = false;

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const [x, y] = getPointer(dragEvent, this);
    moveCircle(x, y, r);

    if (!started) {
      started = true;
      stroke.moveTo(startX, startY); // no stamps on a plain click
    }
    stroke.moveTo(x, y);
    redrawRelief();
  });
}

function enterBulkRemoveMode(): void {
  ensureEl("reliefTools")
    .querySelectorAll("button.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  ensureEl("reliefBulkRemove").classList.add("pressed");

  showControls({ size: false, radius: true, spacing: false, any: true });

  select<SVGElement, unknown>("#viewbox")
    .style("cursor", "crosshair")
    .call(drag<SVGElement, unknown>().on("start", dragToRemove))
    .on("touchmove mousemove", moveBrush);
  tip("Drag to remove relief icons in radius", true);
}

function dragToRemove(this: SVGElement, event: any): void {
  const pressed = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed");
  if (!pressed) {
    tip("Please select an icon", false, "error");
    return;
  }

  const r = +ensureEl<HTMLInputElement>("reliefRadiusNumber").value;
  const icon = pressed.dataset.symbol;
  const tree = quadtree<[number, number, ReliefIcon]>();
  for (const reliefIcon of pack.relief) {
    if (!matchesTypeTile(reliefIcon, icon)) continue;
    tree.add([reliefIcon.x + reliefIcon.s / 2, reliefIcon.y + reliefIcon.s / 2, reliefIcon]);
  }

  const stroke = createBrushStroke(r / 2, (x, y) => {
    const found = findAllInQuadtree(x, y, r, tree);
    if (!found.length) return;

    const removed = new Set(found.map(entry => entry[2]));
    for (const entry of found) tree.remove(entry);
    pack.relief = pack.relief.filter(reliefIcon => !removed.has(reliefIcon));
    if (selectedIcon && removed.has(selectedIcon)) selectedIcon = null;
    redrawRelief();
  });
  const [startX, startY] = getPointer(event, this);
  let started = false;

  event.on("drag", function (this: SVGElement, dragEvent: any) {
    const [x, y] = getPointer(dragEvent, this);
    moveCircle(x, y, r);

    if (!started) {
      started = true;
      stroke.moveTo(startX, startY);
    }
    stroke.moveTo(x, y);
  });
}

function changeIconSize(): void {
  if (!selectedIcon || !ensureEl("reliefIndividual").classList.contains("pressed")) return;

  const size = +ensureEl<HTMLInputElement>("reliefSizeNumber").value / styles.relief.options.size; // the input is the drawn size
  const shift = (size - selectedIcon.s) / 2;
  selectedIcon.s = size;
  selectedIcon.x = rn(selectedIcon.x - shift, 2);
  selectedIcon.y = rn(selectedIcon.y - shift, 2);
  redrawRelief();
}

function changeIconsSet(): void {
  // an icon drawn with a library icon has no set to pin
  if (selectedIcon && "type" in selectedIcon && ensureEl("reliefIndividual").classList.contains("pressed")) {
    const set = ensureEl<HTMLSelectElement>("reliefEditorSet").value as ReliefSet | "";
    if (set) selectedIcon.set = set;
    else delete selectedIcon.set;
    redrawRelief();
  }
  void loadPreviews();
}

async function loadPreviews(): Promise<void> {
  const request = ++previewRequest;
  const container = ensureEl("reliefSetIcons");
  container.replaceChildren();
  const set = previewSet();
  try {
    await Icons.retry(Relief.iconSetId(set));
    if (request !== previewRequest || !container.isConnected) return;
    container.innerHTML = setIconsHtml(set);
    updateReliefIconSelected(set);
    await fitReliefArt(container, set);
  } catch {
    /* the loader reports the failed attempt */
  }
}

function changeIcon(this: SVGElement): void {
  if (this.classList.contains("pressed")) return;

  ensureEl("reliefIconsDiv")
    .querySelectorAll("svg.pressed")
    .forEach(b => {
      b.classList.remove("pressed");
    });
  this.classList.add("pressed");

  if (ensureEl("reliefIndividual").classList.contains("pressed") && selectedIcon) {
    const ref = pickedRef(this);
    if (!ref) return;
    replaceSelected({ ...ref, x: selectedIcon.x, y: selectedIcon.y, s: selectedIcon.s });
  }
}

function pickAnyIcon(): void {
  if (!selectedIcon) return void tip("Please select a relief icon on the map", false, "error");
  const original = selectedIcon;
  Controllers.IconPicker.open({
    current: "icon" in original ? original.icon : "",
    live: true,
    onPick: id => {
      if (!selectedIcon) return;
      const { x, y, s } = original;
      replaceSelected(id ? { icon: id, x, y, s } : original);
      updateReliefIconSelected(previewSet());
    }
  });
}

function replaceSelected(replacement: ReliefIcon): void {
  const index = pack.relief.indexOf(selectedIcon!);
  if (index >= 0) pack.relief[index] = replacement;
  selectedIcon = replacement;
  redrawRelief();
}

function copyIcon(): void {
  if (!selectedIcon) return;

  let { x, y } = selectedIcon;
  do {
    x -= 3;
    y -= 3;
  } while (pack.relief.some(icon => icon.x === x && icon.y === y));

  const copy = { ...selectedIcon, x, y };
  pack.relief.push(copy); // the copy is placed on top of the other icons
  selectedIcon = copy;
  redrawRelief();
}

// move the icon to the top (front) or to the bottom (back) of the drawing order
function moveIcon(direction: "front" | "back"): void {
  if (!selectedIcon) return;

  const index = pack.relief.indexOf(selectedIcon);
  if (index < 0) return;

  pack.relief.splice(index, 1);
  if (direction === "front") pack.relief.push(selectedIcon);
  else pack.relief.unshift(selectedIcon);
  redrawRelief();
}

function removeIcon(): void {
  const isIndividual = ensureEl("reliefTools").querySelector("button.pressed")?.id === "reliefIndividual";
  const icon = ensureEl("reliefIconsDiv").querySelector<SVGElement>("svg.pressed")?.dataset.symbol;

  const doomed = isIndividual
    ? new Set(selectedIcon ? [selectedIcon] : [])
    : new Set(pack.relief.filter(reliefIcon => matchesTypeTile(reliefIcon, icon)));

  if (isIndividual) alertMessage.innerHTML = "Are you sure you want to remove the icon?";
  else
    alertMessage.innerHTML = icon
      ? `Are you sure you want to remove all ${icon} icons (${doomed.size})?`
      : `Are you sure you want to remove all icons (${doomed.size})?`;

  $("#alert").dialog({
    resizable: false,
    title: "Remove relief icons",
    buttons: {
      Remove: function (this: HTMLElement) {
        pack.relief = pack.relief.filter(reliefIcon => !doomed.has(reliefIcon));
        selectedIcon = null;
        redrawRelief();
        $(this).dialog("close");
        $("#reliefEditor").dialog("close");
      },
      Cancel: function (this: HTMLElement) {
        $(this).dialog("close");
      }
    }
  });
}

function getIconData(element?: Element): ReliefIcon | null {
  if (element?.tagName !== "use") return null;
  const id = (element as SVGUseElement).dataset.id;
  return (id && getReliefIcon(id)) || null;
}

function closeReliefEditor(): void {
  previewRequest++;
  const wasUsingBrush = !ensureEl("reliefIndividual").classList.contains("pressed");
  select<SVGGElement, unknown>("#terrain").on(".drag", null).classed("draggable", false);
  selectedIcon = null;
  removeCircle();
  if (wasUsingBrush) applyDefaultViewboxEvents();
  clearMainTip();
  $("#reliefEditor").dialog("destroy");
  ensureEl("reliefEditor").remove();
}

export const ReliefEditor = { open };
