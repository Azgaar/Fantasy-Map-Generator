import { pointer, select } from "d3";
import { Controllers } from "@/controllers";
import type { Point } from "@/generators/voronoi";
import { ensureEl, getPackPolygon, last, rn } from "../utils";

let creatorCells: number[] = [];

const DIALOG_HTML = /* html */ `
  <div id="riverCreatorBody" class="table"></div>
  <div id="riverCreatorBottom">
    <button id="riverCreatorComplete" data-tip="Complete river creation" class="icon-check"></button>
    <button id="riverCreatorCancel" data-tip="Cancel the creation" class="icon-cancel"></button>
  </div>`;

function open(): void {
  if (customization) return;
  closeDialogs();
  if (!layerIsOn("toggleRivers")) toggleRivers();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  tip("Click to add river point, click again to remove", true);
  debug.append("g").attr("id", "controlCells");
  select<SVGElement, unknown>("#viewbox").style("cursor", "crosshair").on("click", onCellClick);

  creatorCells = [];
  ensureEl("riverCreator").innerHTML = DIALOG_HTML;

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreatorComplete").on("click", addRiver);
  ensureEl("riverCreatorCancel").on("click", cancelCreation);
  ensureEl("riverCreatorBody").on("click", onBodyClick);

  $("#riverCreator").dialog({
    title: "Create River",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRiverCreator
  });
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
  const cell = findCell(...(pointer(event, this) as [number, number]))!;

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
  debug
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
  const id = `river${riverId}`;

  viewbox
    .select("#rivers")
    .append("path")
    .attr("id", id)
    .attr("d", Rivers.getRiverPath(meanderedPoints, widthFactor, sourceWidth));

  void Controllers.RiverEditor.open(id);
}

function closeRiverCreator(): void {
  debug.select("#controlCells").remove();
  restoreDefaultEvents();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();

  ensureEl("riverCreator").innerHTML = "";
}

export const RiverCreator = { open };
