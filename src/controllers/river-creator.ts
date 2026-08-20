import { select } from "d3";
import { closeDialogs, destroyDialog } from "@/components/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/components/tooltips";
import { showDomDialog } from "@/components/ui/dom-dialog";
import { applyDefaultViewboxEvents } from "@/components/viewbox-events";
import { Controllers } from "@/controllers";
import type { Point } from "@/generators/voronoi";
import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { ensureEl, getPackPolygon, getPointer, last, rn } from "../utils";

let creatorCells: number[] = [];

function open(): void {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleRivers")) toggleRivers();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add river point, click again to remove", true);
  select("#debug").append("g").attr("id", "controlCells");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onCellClick);

  creatorCells = [];
  renderDialog();

  showDomDialog({
    content: ensureEl("riverCreator"),
    onClose: closeRiverCreator,
    placement: "top-left",
    placementTarget: document.getElementById("map"),
    placementOffset: { x: 10, y: 10 },
    resizable: false,
    title: "Create River"
  });
}

function renderDialog(): void {
  destroyDialog("riverCreator");

  const html = /* html */ `<div id="riverCreator" class="dialog">
    <div id="riverCreatorBody" class="table"></div>
    <div id="riverCreatorBottom">
      <button id="riverCreatorComplete" data-tip="Complete river creation" class="icon-check"></button>
      <button id="riverCreatorCancel" data-tip="Cancel the creation" class="icon-cancel"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreatorComplete").addEventListener("click", addRiver);
  ensureEl("riverCreatorCancel").addEventListener("click", cancelCreation);
  ensureEl("riverCreatorBody").addEventListener("click", onBodyClick);
}

function cancelCreation(): void {
  destroyDialog("riverCreator");
}

function onBodyClick(ev: Event): void {
  const el = ev.target as HTMLElement;
  const cl = el.classList;
  const cell = +(el.parentNode as HTMLElement).dataset.cell!;
  if (cl.contains("editFlux")) pack.cells.fl[cell] = +(el as HTMLInputElement).value;
  else if (cl.contains("icon-trash-empty")) removeCell(cell);
}

function onCellClick(this: any, event: any): void {
  const cell = findCell(...(getPointer(event, this) as [number, number]))!;

  if (creatorCells.includes(cell)) removeCell(cell);
  else addCell(cell);
}

function addCell(cell: number): void {
  creatorCells.push(cell);
  drawCells(creatorCells);

  const flux = pack.cells.fl[cell];
  const line = `<div class="editorLine" data-cell="${cell}">
      <span>Cell ${cell}</span>
      <span data-tip="Set flux affects river width" style="margin-left: 0.4em">Flux</span>
      <input type="number" min=0 value="${flux}" class="editFlux" style="width: 5em"/>
      <span data-tip="Remove the cell" class="icon-trash-empty pointer"></span>
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
    .attr("points", (d: number) => getPackPolygon(d, pack))
    .attr("class", "current");
}

function addRiver(): void {
  const { rivers: packRivers, cells } = pack;
  const riverCells = creatorCells;
  if (riverCells.length < 2) {
    tip("Add at least 2 cells", false, "error");
    return;
  }

  const riverId = Rivers.getNextId(packRivers);
  const parent = cells.r[last(riverCells)] || riverId;

  riverCells.forEach(cell => {
    if (!cells.r[cell]) cells.r[cell] = riverId;
  });

  const source = riverCells[0];
  const mouth = parent === riverId ? last(riverCells) : riverCells[riverCells.length - 2];
  const sourceWidth = Rivers.getSourceWidth(cells.fl[source]);
  const defaultWidthFactor = rn(1 / (+pointsInput.dataset.cells! / 10000) ** 0.25, 2);
  const widthFactor = 1.2 * defaultWidthFactor;

  const meanderedPoints = Rivers.addMeandering(riverCells);

  const discharge = cells.fl[mouth]; // m3 in second
  const length = Rivers.getApproximateLength(meanderedPoints as unknown as Point[]);
  const width = Rivers.getWidth(
    Rivers.getOffset({
      flux: discharge,
      pointIndex: meanderedPoints.length,
      widthFactor,
      startingWidth: sourceWidth
    })
  );
  const name = Rivers.getName(mouth);
  const basin = Rivers.getBasin(parent);

  packRivers.push({
    i: riverId,
    source,
    mouth,
    discharge,
    length,
    width,
    widthFactor,
    sourceWidth,
    parent,
    cells: riverCells,
    basin,
    name,
    type: "River"
  });
  invalidatePixiRendererLayer("rivers");
  void Controllers.RiverEditor.open(riverId);
}

function closeRiverCreator(): void {
  select("#debug").select("#controlCells").remove();
  applyDefaultViewboxEvents();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();

  destroyDialog("riverCreator");
}

export const RiverCreator = { open };
