import { drag, pointer, select } from "d3";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import type { Point } from "@/generators/voronoi";
import { ensureEl, getPackPolygon, getSegmentId, rand, rn } from "../utils";

declare let elSelected: any;

let isInitialized = false;

function editRiver(id: string): void {
  if (customization) return;
  if (elSelected && id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  elSelected = select(`#${id}`).on("click", addControlPoint);

  tip(
    "Drag control points to change the river course. Click on point to remove it. Click on river to add additional control point. For major changes please create a new river instead",
    true
  );
  debug.append("g").attr("id", "controlCells");
  debug.append("g").attr("id", "controlPoints");

  updateRiverData();

  const river = getRiver();
  const { cells, points } = river;
  const riverPoints = Rivers.getRiverPoints(cells, points ?? null);
  drawControlPoints(riverPoints);
  drawCells(cells);

  $("#riverEditor").dialog({
    title: "Edit River",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRiverEditor
  });

  if (isInitialized) return;
  isInitialized = true;

  // add listeners
  ensureEl("riverCreateSelectingCells").on("click", () => void Controllers.RiverCreator.open());
  ensureEl("riverEditStyle").on("click", () => editStyle("rivers"));
  ensureEl("riverElevationProfile").on("click", showRiverElevationProfile);
  ensureEl("riverLegend").on("click", editRiverLegend);
  ensureEl("riverRemove").on("click", removeRiver);
  ensureEl("riverName").on("input", changeName);
  ensureEl("riverType").on("input", changeType);
  ensureEl("riverNameCulture").on("click", generateNameCulture);
  ensureEl("riverNameRandom").on("click", generateNameRandom);
  ensureEl("riverMainstem").on("change", changeParent);
  ensureEl("riverSourceWidth").on("input", changeSourceWidth);
  ensureEl("riverWidthFactor").on("input", changeWidthFactor);
}

function getRiver(): River {
  const riverId = +elSelected.attr("id").slice(5);
  return pack.rivers.find((r: River) => r.i === riverId) as River;
}

function updateRiverData(): void {
  const r = getRiver();

  ensureEl<HTMLInputElement>("riverName").value = r.name;
  ensureEl<HTMLInputElement>("riverType").value = r.type;

  const parentSelect = ensureEl<HTMLSelectElement>("riverMainstem");
  parentSelect.options.length = 0;
  const parent = r.parent || r.i;
  const sortedRivers = pack.rivers.slice().sort((a: River, b: River) => (a.name > b.name ? 1 : -1));
  sortedRivers.forEach((river: River) => {
    const opt = new Option(river.name, String(river.i), false, river.i === parent);
    parentSelect.options.add(opt);
  });
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;

  ensureEl<HTMLInputElement>("riverDischarge").value = `${r.discharge} m³/s`;
  ensureEl<HTMLInputElement>("riverSourceWidth").value = String(r.sourceWidth);
  ensureEl<HTMLInputElement>("riverWidthFactor").value = String(r.widthFactor);

  updateRiverLength(r);
  updateRiverWidth(r);
}

function updateRiverLength(river: River): void {
  river.length = rn(elSelected.node().getTotalLength() / 2, 2);
  const lengthUI = `${rn(river.length * distanceScale)} ${distanceUnitInput.value}`;
  ensureEl<HTMLInputElement>("riverLength").value = lengthUI;
}

function updateRiverWidth(river: River): void {
  const { cells, discharge, widthFactor, sourceWidth } = river;
  const meanderedPoints = Rivers.addMeandering(cells);
  river.width = Rivers.getWidth(
    Rivers.getOffset({
      flux: discharge,
      pointIndex: meanderedPoints.length,
      widthFactor,
      startingWidth: sourceWidth
    })
  );

  const width = `${rn(river.width * distanceScale, 3)} ${distanceUnitInput.value}`;
  ensureEl<HTMLInputElement>("riverWidth").value = width;
}

function drawControlPoints(points: Point[]): void {
  debug
    .select("#controlPoints")
    .selectAll("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: Point) => d[0])
    .attr("cy", (d: Point) => d[1])
    .attr("r", 0.6)
    .call(drag().on("start", dragControlPoint) as any)
    .on("click", removeControlPoint);
}

function drawCells(cells: number[]): void {
  const validCells = [...new Set(cells)].filter(i => pack.cells.i[i]);
  debug
    .select("#controlCells")
    .selectAll(`polygon`)
    .data(validCells)
    .join("polygon")
    .attr("points", (d: number) => getPackPolygon(d, pack));
}

function dragControlPoint(event: any): void {
  const { r, fl } = pack.cells;
  const river = getRiver();

  const { x: x0, y: y0 } = event;
  const initCell = findCell(x0, y0);

  let movedToCell: number | null = null;

  event.on("drag", function (this: any, dragEvent: any) {
    const { x, y } = dragEvent;
    const currentCell = findCell(x, y);

    movedToCell = initCell !== currentCell ? currentCell! : null;

    this.setAttribute("cx", x);
    this.setAttribute("cy", y);
    this.__data__ = [rn(x, 1), rn(y, 1)];
    redrawRiver();
    drawCells(river.cells);
  });

  event.on("end", () => {
    if (movedToCell && !r[movedToCell]) {
      // swap river data
      r[initCell!] = 0;
      r[movedToCell] = river.i;
      const sourceFlux = fl[initCell!];
      fl[initCell!] = fl[movedToCell];
      fl[movedToCell] = sourceFlux;
      redrawRiver();
    }
  });
}

function redrawRiver(): void {
  const river = getRiver();
  river.points = debug.selectAll("#controlPoints > *").data() as Point[];
  river.cells = river.points.map(([x, y]) => findCell(x, y)!);

  const meanderedPoints = Rivers.addMeandering(river.cells, river.points);
  const path = Rivers.getRiverPath(meanderedPoints, river.widthFactor, river.sourceWidth);
  elSelected.attr("d", path);

  updateRiverLength(river);
  if (ensureEl("elevationProfile").offsetParent) showRiverElevationProfile();
}

function addControlPoint(this: any, event: any): void {
  const [x, y] = pointer(event, this);
  const point: Point = [rn(x, 1), rn(y, 1)];

  const river = getRiver();
  if (!river.points) river.points = debug.selectAll("#controlPoints > *").data() as Point[];

  const index = getSegmentId(river.points, point, 2);
  river.points.splice(index, 0, point);
  drawControlPoints(river.points);
  redrawRiver();
}

function removeControlPoint(this: any): void {
  this.remove();
  redrawRiver();

  const { cells } = getRiver();
  drawCells(cells);
}

function changeName(this: HTMLInputElement): void {
  getRiver().name = this.value;
}

function changeType(this: HTMLInputElement): void {
  getRiver().type = this.value;
}

function generateNameCulture(): void {
  const r = getRiver();
  r.name = ensureEl<HTMLInputElement>("riverName").value = Rivers.getName(r.mouth);
}

function generateNameRandom(): void {
  const r = getRiver();
  if (r) r.name = ensureEl<HTMLInputElement>("riverName").value = Names.getBase(rand(nameBases.length - 1));
}

function changeParent(this: HTMLInputElement): void {
  const r = getRiver();
  r.parent = +this.value;
  r.basin = pack.rivers.find((river: River) => river.i === r.parent)!.basin;
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;
}

function changeSourceWidth(this: HTMLInputElement): void {
  const river = getRiver();
  river.sourceWidth = +this.value;
  updateRiverWidth(river);
  redrawRiver();
}

function changeWidthFactor(this: HTMLInputElement): void {
  const river = getRiver();
  river.widthFactor = +this.value;
  updateRiverWidth(river);
  redrawRiver();
}

function showRiverElevationProfile(): void {
  const points = (debug.selectAll("#controlPoints > *").data() as Point[]).map(([x, y]) => findCell(x, y)!);
  const river = getRiver();
  const riverLen = rn(river.length * distanceScale);
  void Controllers.ElevationProfile.open(points, riverLen, true);
}

function editRiverLegend(): void {
  const id = elSelected.attr("id");
  const river = getRiver();
  editNotes(id, `${river.name} ${river.type}`);
}

function removeRiver(): void {
  alertMessage.innerHTML = "Are you sure you want to remove the river and all its tributaries";
  $("#alert").dialog({
    resizable: false,
    width: "22em",
    title: "Remove river and tributaries",
    buttons: {
      Remove: function (this: any) {
        $(this).dialog("close");
        const river = +elSelected.attr("id").slice(5);
        Rivers.remove(river);
        elSelected.remove();
        $("#riverEditor").dialog("close");
      },
      Cancel: function (this: any) {
        $(this).dialog("close");
      }
    }
  });
}

function closeRiverEditor(): void {
  debug.select("#controlPoints").remove();
  debug.select("#controlCells").remove();

  elSelected.on("click", null);
  unselect();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();
}

export const RiverEditor = { open: editRiver };
