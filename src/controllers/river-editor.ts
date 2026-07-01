import { drag, pointer, select } from "d3";
import { Controllers } from "@/controllers";
import type { River } from "@/generators/river-generator";
import type { Point } from "@/generators/voronoi";
import { ensureEl, getPackPolygon, getSegmentId, rand, rn } from "../utils";

const DIALOG_HTML = /* html */ `
  <div id="riverBody" style="padding-bottom: 0.3em">
    <div>
      <div class="label" style="width: 4.8em">Name:</div>
      <span id="riverNameCulture" data-tip="Generate culture-specific name for the river" class="icon-book pointer"></span>
      <span id="riverNameRandom" data-tip="Generate random name for the river" class="icon-globe pointer"></span>
      <input id="riverName" data-tip="Type to rename the river" autocorrect="off" spellcheck="false" />
      <span data-tip="Speak the name. You can change voice and language in options" class="speaker">🔊</span>
    </div>
    <div data-tip="Type to change river type (e.g. fork, creek, river, brook, stream)">
      <div class="label">Type:</div>
      <input id="riverType" autocorrect="off" spellcheck="false" />
    </div>
    <div data-tip="Select parent river">
      <div class="label">Mainstem:</div>
      <select id="riverMainstem"></select>
    </div>
    <div data-tip="River drainage basin (watershed)">
      <div class="label">Basin:</div>
      <input id="riverBasin" disabled />
    </div>
    <div data-tip="River discharge (flux power)">
      <div class="label">Discharge:</div>
      <input id="riverDischarge" disabled />
    </div>
    <div data-tip="River length in selected units">
      <div class="label">Length:</div>
      <input id="riverLength" disabled />
    </div>
    <div data-tip="River mouth width in selected units">
      <div class="label">Mouth width:</div>
      <input id="riverWidth" disabled />
    </div>
    <div data-tip="River source additional width. Default value is 0">
      <div class="label">Source width:</div>
      <input id="riverSourceWidth" type="number" min="0" max="3" step=".01" />
    </div>
    <div data-tip="River width multiplier. Default value is 1">
      <div class="label">Width modifier:</div>
      <input id="riverWidthFactor" type="number" min=".1" max="4" step=".1" />
    </div>
  </div>
  <div id="riverBottom">
    <button id="riverCreateSelectingCells" data-tip="Create a new river selecting river cells" class="icon-map-pin"></button>
    <button id="riverEditStyle" data-tip="Edit style for all rivers in Style Editor" class="icon-brush"></button>
    <button id="riverElevationProfile" data-tip="Show the elevation profile for the river" class="icon-chart-area"></button>
    <button id="riverLegend" data-tip="Edit free text notes (legend) for the river" class="icon-edit"></button>
    <button id="riverRemove" data-tip="Remove river" data-shortcut="Delete" class="icon-trash fastDelete"></button>
  </div>`;

function open(id: string): void {
  if (customization) return;
  if (elSelected && id === elSelected.attr("id")) return;
  closeDialogs(".stable");
  if (!layerIsOn("toggleRivers")) toggleRivers();

  ensureEl("toggleCells").dataset.forced = String(+!layerIsOn("toggleCells"));
  if (!layerIsOn("toggleCells")) toggleCells();

  elSelected = select<SVGElement, unknown>(`#${id}`).on("click", addControlPoint);

  tip(
    "Drag control points to change the river course. Click on point to remove it. Click on river to add additional control point. For major changes please create a new river instead",
    true
  );
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");

  ensureEl("riverEditor").innerHTML = DIALOG_HTML;
  updateRiverData();

  const river = getRiver();
  const { cells, points } = river;
  const riverPoints = Rivers.getRiverPoints(cells, points ?? null);
  drawControlPoints(riverPoints);
  drawCells(cells);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreateSelectingCells").on("click", openRiverCreator);
  ensureEl("riverEditStyle").on("click", openRiverStyle);
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

  $("#riverEditor").dialog({
    title: "Edit River",
    resizable: false,
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    close: closeRiverEditor
  });
}

function openRiverCreator(): void {
  void Controllers.RiverCreator.open();
}

function openRiverStyle(): void {
  editStyle("rivers");
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
  river.length = rn((elSelected.node() as SVGGeometryElement).getTotalLength() / 2, 2);
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
  select<SVGGElement, unknown>("#controlPoints")
    .selectAll<SVGCircleElement, Point>("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: Point) => d[0])
    .attr("cy", (d: Point) => d[1])
    .attr("r", 0.6)
    .call(drag<SVGCircleElement, Point>().on("start", dragControlPoint))
    .on("click", removeControlPoint);
}

function drawCells(cells: number[]): void {
  const validCells = [...new Set(cells)].filter(i => pack.cells.i[i]);
  select<SVGGElement, unknown>("#controlCells")
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
  river.points = select("#controlPoints").selectAll("*").data() as Point[];
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
  if (!river.points) river.points = select("#controlPoints").selectAll("*").data() as Point[];

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
  const points = (select("#controlPoints").selectAll("*").data() as Point[]).map(([x, y]) => findCell(x, y)!);
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
  select("#controlPoints").remove();
  select("#controlCells").remove();

  elSelected.on("click", null);
  unselect();
  clearMainTip();

  const forced = +ensureEl("toggleCells").dataset.forced!;
  ensureEl("toggleCells").dataset.forced = "0";
  if (forced && layerIsOn("toggleCells")) toggleCells();

  ensureEl("riverEditor").innerHTML = "";
}

export const RiverEditor = { open };
