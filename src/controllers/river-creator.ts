import { select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { clearMainTip, tip } from "@/components/tooltips";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import { t } from "@/utils/i18n";
import { errorText } from "@/utils/stringUtils";
import { ensureEl, getPointer } from "../utils";

let creatorCells: number[] = [];

let isCellsLayerForced = false; // the cells layer is turned on for the editing mode

function open(): void {
  if (customization) return;
  closeDialogs();
  Layers.show("rivers");

  isCellsLayerForced = !Layers.isOn("cells");
  Layers.show("cells");

  tip(t("Click to add river point, click again to remove"), true);
  select("#debug").append("g").attr("id", "controlCells");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onCellClick);

  creatorCells = [];
  renderDialog();

  $("#riverCreator").dialog({
    title: t("Create River"),
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRiverCreator
  });
}

function renderDialog(): void {
  destroyDialog("riverCreator");

  const html = /* html */ `<div id="riverCreator" class="dialog">
    <div id="riverCreatorBody" class="table"></div>
    <div id="riverCreatorBottom">
      <button id="riverCreatorComplete" data-tip="${t("Complete river creation")}" class="icon-check"></button>
      <button id="riverCreatorCancel" data-tip="${t("Cancel the creation")}" class="icon-cancel"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreatorComplete").addEventListener("click", addRiver);
  ensureEl("riverCreatorCancel").addEventListener("click", cancelCreation);
  ensureEl("riverCreatorBody").addEventListener("click", onBodyClick);
}

function cancelCreation(): void {
  $("#riverCreator").dialog("close");
}

function onBodyClick(ev: Event): void {
  const el = ev.target as HTMLElement;
  const cl = el.classList;
  const cell = +(el.parentNode as HTMLElement).dataset.cell!;
  if (cl.contains("editFlux")) pack.cells.fl[cell] = +(el as HTMLInputElement).value;
  else if (cl.contains("icon-trash-empty")) removeCell(cell);
}

function onCellClick(this: any, event: any): void {
  const cell = Pack.findCell(...(getPointer(event, this) as [number, number]))!;

  if (creatorCells.includes(cell)) removeCell(cell);
  else addCell(cell);
}

function addCell(cell: number): void {
  creatorCells.push(cell);
  drawCells(creatorCells);

  const flux = pack.cells.fl[cell];
  const line = `<div class="editorLine" data-cell="${cell}">
      <span>Cell ${cell}</span>
      <span data-tip="${t("Set flux affects river width")}" style="margin-left: 0.4em">${t("Flux")}</span>
      <input type="number" min=0 value="${flux}" class="editFlux" style="width: 5em"/>
      <span data-tip="${t("Remove")}" class="icon-trash-empty pointer"></span>
    </div>`;
  ensureEl("riverCreatorBody").innerHTML += line;
}

function removeCell(cell: number): void {
  creatorCells = creatorCells.filter(c => c !== cell);
  drawCells(creatorCells);
  ensureEl("riverCreatorBody").querySelector(`div[data-cell='${cell}']`)?.remove();
}

function drawCells(cells: number[]): void {
  select("#debug")
    .select("#controlCells")
    .selectAll(`polygon`)
    .data(cells)
    .join("polygon")
    .attr("points", (d: number) => String(Pack.getPolygon(d)))
    .attr("class", "current");
}

function addRiver(): void {
  if (creatorCells.length < 2) {
    tip(t("Add at least 2 cells"), false, "error");
    return;
  }
  let riverId: number;
  try {
    riverId = Rivers.create(creatorCells);
  } catch (error) {
    tip(errorText(error), false, "error");
    return;
  }
  Layers.draw("rivers");
  void Controllers.RiverEditor.open(`river${riverId}`);
}

function closeRiverCreator(): void {
  select("#debug").select("#controlCells").remove();
  applyDefaultViewboxEvents();
  clearMainTip();

  if (isCellsLayerForced) Layers.hide("cells");
  isCellsLayerForced = false;

  destroyDialog("riverCreator");
}

export const RiverCreator = { open };
