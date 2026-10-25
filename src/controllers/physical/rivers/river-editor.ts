import { type D3DragEvent, drag, type Selection, select } from "d3";
import { Controllers } from "@/controllers";
import { Pack } from "@/model/graph/pack-generator";
import type { Point } from "@/model/graph/voronoi";
import type { River } from "@/model/physical/river-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Names } from "@/model/society/names-generator";
import { Tags } from "@/model/tags";
import { redrawRiver as redrawRiverShape, setEditedRiver } from "@/renderers/draw-rivers";
import { Layers } from "@/renderers/layers";
import { speak } from "@/services/speech";
import { Dialog } from "@/ui/dialog/dialog";
import { noteButton } from "@/ui/dialog/dialog-helpers";
import { clearMainTip, tip } from "@/ui/tooltips";
import { getSegmentId } from "@/utils/common-utils";
import { sentences, t } from "@/utils/i18n";
import { ensureEl, findEl, getPointer } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { rand } from "@/utils/probability-utils";

let selectedRiver: Selection<SVGElement, unknown, HTMLElement, unknown>;

let isCellsLayerForced = false; // the cells layer is turned on for the editing mode

function open(id: string): void {
  if (options.app.mode) return;
  if (findEl("riverEditor") && id === selectedRiver.attr("id")) return;
  Dialog.closeAll(".stable");
  Layers.show("rivers");

  isCellsLayerForced = !Layers.isOn("cells");
  Layers.show("cells");

  setEditedRiver(Number(id.slice(5))); // keep the river rendered while it is edited
  selectedRiver = select<SVGElement, unknown>(`#${id}`).on("click", addControlPoint);

  tip(
    sentences(
      t("Drag control points to change the river course"),
      t("Click on point to remove it"),
      t("Click on river to add additional control point"),
      t("For major changes please create a new river instead")
    ),
    true
  );
  select("#debug").append("g").attr("id", "controlCells");
  select("#debug").append("g").attr("id", "controlPoints");

  renderDialog();
  ensureEl("riverEditor").dataset.entity = `river:${Number(id.slice(5))}`;
  updateRiverData();

  const river = getRiver();
  const { cells, points } = river;
  const riverPoints = Rivers.getRiverPoints(cells, points ?? null);
  drawControlPoints(riverPoints);
  drawCells(cells);

  Dialog.open("riverEditor", {
    title: t("Edit River"),
    position: { my: "left top", at: "left+10 top+10", of: "#map" },
    onClose: closeRiverEditor
  });
}

function renderDialog(): void {
  Dialog.destroy("riverEditor");

  const html = /* html */ `<div id="riverEditor" class="dialog">
    <div id="riverBody" style="padding-bottom: 0.3em">
      <div>
        <div class="label" style="width: 4.8em">${t("Name")}:</div>
        <span id="riverNameCulture" data-tip="${t("Generate culture-specific name")}" class="icon-book pointer"></span>
        <span id="riverNameRandom" data-tip="${t("Generate random name")}" class="icon-globe pointer"></span>
        <input id="riverName" data-tip="${t("Type to rename")}" autocorrect="off" spellcheck="false" />
        <span id="riverNameSpeak" data-tip="${sentences(t("Speak the name"), t("You can change voice and language in options"))}" class="speaker">🔊</span>
      </div>
      <div data-tip="${t("Type to change river type (e.g. fork, creek, river, brook, stream)")}">
        <div class="label">${t("Type")}:</div>
        <input id="riverType" autocorrect="off" spellcheck="false" />
      </div>
      <div data-tip="${sentences(t("Rendering group: the svg group the river is drawn in"), t("Does not affect generation"))}">
        <div class="label">${t("Group")}:</div>
        <select id="riverGroup"></select>
        <span id="riverGroupEdit" data-tip="${t("Edit river groups")}" class="icon-pencil pointer"></span>
      </div>
      <div data-tip="${t("River tags (comma-separated)")}">
        <div class="label">${t("Tags")}:</div>
        <input
          id="riverTags"
          placeholder="${t("Tags")}"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      <div data-tip="${t("Select parent river")}">
        <div class="label">${t("Mainstem")}:</div>
        <select id="riverMainstem"></select>
      </div>
      <div data-tip="${t("River drainage basin (watershed)")}">
        <div class="label">${t("Basin")}:</div>
        <input id="riverBasin" disabled />
      </div>
      <div data-tip="${t("River discharge (flux power)")}">
        <div class="label">${t("Discharge")}:</div>
        <input id="riverDischarge" disabled />
      </div>
      <div data-tip="${t("River length in selected units")}">
        <div class="label">${t("Length")}:</div>
        <input id="riverLength" disabled />
      </div>
      <div data-tip="${t("River mouth width in selected units")}">
        <div class="label">${t("Mouth width")}:</div>
        <input id="riverWidth" disabled />
      </div>
      <div data-tip="${t("River source additional width. Default value is 0")}">
        <div class="label">${t("Source width")}:</div>
        <input id="riverSourceWidth" type="number" min="0" max="3" step=".01" />
      </div>
      <div data-tip="${t("River width multiplier. Default value is 1")}">
        <div class="label">${t("Width modifier")}:</div>
        <input id="riverWidthFactor" type="number" min=".1" max="4" step=".1" />
      </div>
    </div>
    <div id="riverBottom">
      <button id="riverCreateSelectingCells" data-tip="${t("Create a new river selecting river cells")}" class="icon-map-pin"></button>
      <button id="riverEditStyle" data-tip="${t("Edit style in Style Editor")}" class="icon-brush"></button>
      <button id="riverElevationProfile" data-tip="${t("Elevation profile")}" class="icon-chart-area"></button>
      ${noteButton("riverLegend", t("Edit free text notes (legend)"))}
      <button id="riverLock" class="icon-lock-open" data-lock-tip></button>
      <button id="riverRemove" data-tip="${t("Remove")}" data-shortcut="Delete" class="icon-trash fastDelete"></button>
    </div>
  </div>`;
  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // add listeners — dropped together with the dialog HTML on close
  ensureEl("riverCreateSelectingCells").addEventListener("click", openRiverCreator);
  ensureEl("riverEditStyle").addEventListener("click", openRiverStyle);
  ensureEl("riverElevationProfile").addEventListener("click", showRiverElevationProfile);
  ensureEl("riverLegend").addEventListener("click", editRiverLegend);
  ensureEl("riverLock").addEventListener("click", toggleLock);
  ensureEl("riverRemove").addEventListener("click", removeRiver);
  ensureEl("riverName").addEventListener("input", changeName);
  ensureEl("riverNameSpeak").addEventListener("click", () => speak(ensureEl<HTMLInputElement>("riverName").value));
  ensureEl("riverType").addEventListener("input", changeType);
  ensureEl("riverGroup").addEventListener("change", changeGroup);
  ensureEl("riverGroupEdit").addEventListener("click", () => void Controllers.RiverGroupsEditor.open());
  ensureEl("riverTags").addEventListener("change", changeTags);
  ensureEl("riverNameCulture").addEventListener("click", generateNameCulture);
  ensureEl("riverNameRandom").addEventListener("click", generateNameRandom);
  ensureEl("riverMainstem").addEventListener("change", changeParent);
  ensureEl("riverSourceWidth").addEventListener("input", changeSourceWidth);
  ensureEl("riverWidthFactor").addEventListener("input", changeWidthFactor);
}

function openRiverCreator(): void {
  void Controllers.RiverCreator.open();
}

function openRiverStyle(): void {
  void Controllers.StyleEditor.open("rivers", getRiver().group);
}

function getRiver(): River {
  const riverId = +selectedRiver.attr("id").slice(5);
  return pack.rivers.find((r: River) => r.i === riverId) as River;
}

function updateRiverData(): void {
  const r = getRiver();

  ensureEl<HTMLInputElement>("riverName").value = r.name;
  ensureEl<HTMLInputElement>("riverType").value = r.type;
  const groupSelect = ensureEl<HTMLSelectElement>("riverGroup");
  groupSelect.options.length = 0;
  for (const group of Object.keys(styles.rivers.groups)) {
    groupSelect.options.add(new Option(group, group, false, group === r.group));
  }
  ensureEl<HTMLInputElement>("riverTags").value = Tags.format(r.tags);
  updateLockIcon(r);

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
  Rivers.updateWidth(r);
  showRiverWidth(r);
}

function toggleLock(): void {
  const river = getRiver();
  Rivers.setLocked(river.i, !river.lock);
  updateLockIcon(river);
}

function updateLockIcon(river: River): void {
  ensureEl("riverLock").className = river.lock ? "icon-lock" : "icon-lock-open";
}

function updateRiverLength(river: River): void {
  river.length = rn((selectedRiver.node() as SVGGeometryElement).getTotalLength() / 2, 2);
  const lengthUI = `${rn(river.length * options.map.units.distance.scale)} ${options.map.units.distance.unit}`;
  ensureEl<HTMLInputElement>("riverLength").value = lengthUI;
}

function showRiverWidth(river: River): void {
  const width = `${rn(river.width * options.map.units.distance.scale, 3)} ${options.map.units.distance.unit}`;
  ensureEl<HTMLInputElement>("riverWidth").value = width;
}

function drawControlPoints(points: Point[]): void {
  select<SVGGElement, unknown>("#controlPoints")
    .selectAll<SVGCircleElement, Point>("circle")
    .data(points)
    .join("circle")
    .attr("cx", (d: Point) => d[0])
    .attr("cy", (d: Point) => d[1])
    .call(drag<SVGCircleElement, Point>().on("start", dragControlPoint))
    .on("click", removeControlPoint);
}

function drawCells(cells: number[]): void {
  const validCells = [...new Set(cells)].filter(i => pack.cells.i[i]);
  select<SVGGElement, unknown>("#controlCells")
    .selectAll(`polygon`)
    .data(validCells)
    .join("polygon")
    .attr("points", (d: number) => String(Pack.getPolygon(d)));
}

type PointDrag = D3DragEvent<SVGCircleElement, Point, Point>;

function dragControlPoint(event: PointDrag): void {
  const { r, fl } = pack.cells;
  const river = getRiver();

  const { x: x0, y: y0 } = event;
  const initCell = Pack.findCell(x0, y0);

  let movedToCell: number | null = null;

  event.on("drag", function (this: SVGCircleElement, dragEvent: PointDrag) {
    const { x, y } = dragEvent;
    const currentCell = Pack.findCell(x, y);

    movedToCell = initCell !== currentCell ? currentCell! : null;

    this.setAttribute("cx", String(x));
    this.setAttribute("cy", String(y));
    select<SVGCircleElement, Point>(this).datum([rn(x, 1), rn(y, 1)]);
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
  river.cells = river.points.map(([x, y]) => Pack.findCell(x, y)!);

  redrawRiverShape(river);

  updateRiverLength(river);
  Layers.draw("labels");
  if (findEl("elevationProfile")) showRiverElevationProfile();
}

function addControlPoint(this: SVGElement, event: MouseEvent): void {
  const [x, y] = getPointer(event, this);
  const point: Point = [rn(x, 1), rn(y, 1)];

  const river = getRiver();
  if (!river.points) river.points = select("#controlPoints").selectAll("*").data() as Point[];

  const index = getSegmentId(river.points, point, 2);
  river.points.splice(index, 0, point);
  drawControlPoints(river.points);
  redrawRiver();
}

function removeControlPoint(this: SVGCircleElement): void {
  this.remove();
  redrawRiver();

  const { cells } = getRiver();
  drawCells(cells);
}

function changeName(this: HTMLInputElement): void {
  if (this.value.trim()) {
    Rivers.rename(getRiver().i, this.value);
    Layers.draw("labels");
  }
}

function changeType(this: HTMLInputElement): void {
  if (!this.value.trim()) return;
  Rivers.setType(getRiver().i, this.value);
  Layers.draw("labels");
}

function changeGroup(this: HTMLSelectElement): void {
  const river = getRiver();
  Rivers.setGroup(river.i, this.value);
  redrawRiverShape(river); // the river's node moves to the new group with its editor handlers
}

function changeTags(this: HTMLInputElement): void {
  const river = getRiver();
  if (!river) return;
  Tags.set(river, this.value);
  this.value = Tags.format(river.tags);
}

function generateNameCulture(): void {
  const river = getRiver();
  const name = Rivers.getName(river.mouth);
  ensureEl<HTMLInputElement>("riverName").value = name;
  Rivers.rename(river.i, name);
  Layers.draw("labels");
}

function generateNameRandom(): void {
  const name = Names.getBase(rand(Names.nameBases.length - 1));
  ensureEl<HTMLInputElement>("riverName").value = name;
  Rivers.rename(getRiver().i, name);
  Layers.draw("labels");
}

function changeParent(this: HTMLInputElement): void {
  const r = getRiver();
  try {
    Rivers.setParent(r.i, +this.value);
  } catch (error) {
    tip((error as Error).message, false, "error");
    this.value = String(r.parent || r.i);
    return;
  }
  ensureEl<HTMLInputElement>("riverBasin").value = pack.rivers.find((river: River) => river.i === r.basin)!.name;
}

function changeSourceWidth(this: HTMLInputElement): void {
  const river = getRiver();
  Rivers.setWidth(river.i, Math.max(0, +this.value || 0), river.widthFactor);
  showRiverWidth(river);
  redrawRiver();
}

function changeWidthFactor(this: HTMLInputElement): void {
  const river = getRiver();
  Rivers.setWidth(river.i, river.sourceWidth ?? 0, Math.max(0, +this.value || 0)); // very old rivers have no source width
  showRiverWidth(river);
  redrawRiver();
}

function showRiverElevationProfile(): void {
  const points = (select("#controlPoints").selectAll("*").data() as Point[]).map(([x, y]) => Pack.findCell(x, y)!);
  const river = getRiver();
  const riverLen = rn(river.length * options.map.units.distance.scale);
  void Controllers.ElevationProfile.open(points, riverLen, true);
}

function editRiverLegend(): void {
  void Controllers.NotesEditor.open({ type: "river", id: getRiver().i });
}

function removeRiver(): void {
  Dialog.confirm({
    title: t("Remove"),
    message: t("Are you sure you want to remove the river? All tributaries will be auto-removed"),
    confirm: t("Remove"),
    width: "22em",
    onConfirm: () => {
      const river = +selectedRiver.attr("id").slice(5);
      Rivers.remove(river);
      Dialog.close("riverEditor");
      Layers.draw("rivers", "labels");
    }
  });
}

function closeRiverEditor(): void {
  select("#controlPoints").remove();
  select("#controlCells").remove();

  selectedRiver.on("click", null);
  setEditedRiver(null);
  clearMainTip();

  if (isCellsLayerForced) Layers.hide("cells");
  isCellsLayerForced = false;

  Dialog.destroy("riverEditor");
  selectedRiver = null!;
}

export const RiverEditor = { open };
