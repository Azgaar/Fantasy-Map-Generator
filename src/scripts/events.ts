import * as d3 from "d3";

import {openDialog} from "dialogs";
import {layerIsOn} from "layers";
// @ts-expect-error js module
import {clearLegend, dragLegendBox} from "modules/legend";
// @ts-expect-error js module
import {updateCellInfo} from "modules/ui/cell-info";
import {debounce} from "utils/functionUtils";
import {findCell, findGridCell, isLand} from "utils/graphUtils";
import {byId} from "utils/shorthands";
import {
  convertTemperature,
  getBurgPopulation,
  getCellIdPrecipitation,
  getFriendlyHeight,
  getCellPopulation,
  getPopulationTip,
  si
} from "utils/unitUtils";
import {showMainTip, tip} from "./tooltips";

export function restoreDefaultEvents() {
  window.Zoom.setZoomBehavior();
  viewbox
    .style("cursor", "default")
    .on(".drag", null)
    .on("click", handleMapClick)
    .on("touchmove mousemove", onMouseMove);
  scaleBar.on("mousemove", () => tip("Click to open Units Editor")).on("click", () => openDialog("unitsEditor"));
  legend
    .on("mousemove", () => tip("Drag to change the position. Click to hide the legend"))
    .on("click", clearLegend)
    .call(d3.drag().on("start", dragLegendBox));
}

// on viewbox click event - run function based on target
function handleMapClick(this: d3.ContainerElement) {
  const el: HTMLElement = d3.event.target;
  if (!el?.parentElement?.parentElement?.parentElement) return;

  const parent = el.parentElement;
  const grand = parent.parentElement!;
  const great = grand.parentElement!;
  const greatGreat = great.parentElement;

  const p = d3.mouse(this);
  const i = findCell(p[0], p[1]);

  if (grand.id === "emblems" && defineEmblemData(el)) openDialog("emblemEditor", null, defineEmblemData(el));
  else if (parent.id === "rivers") editRiver(el.id);
  else if (grand.id === "routes") editRoute();
  else if (el.tagName === "tspan" && greatGreat?.id === "labels") openDialog("labelEditor", null, {el});
  else if (grand.id === "burgLabels" || grand.id === "burgIcons")
    openDialog("burgEditor", null, {id: +(el.dataset.id || 0)});
  else if (parent.id === "ice") openDialog("iceEditor");
  else if (parent.id === "terrain") editReliefIcon();
  else if (grand.id === "markers" || great.id === "markers") editMarker();
  else if (grand.id === "coastline") openDialog("coastlineEditor", null, {el});
  else if (great.id === "armies") editRegiment();
  else if (pack.cells.t[i] === 1) {
    openDialog("coastlineEditor", null, {node: byId("island_" + pack.cells.f[i])});
  } else if (grand.id === "lakes") openDialog("lakeEditor", null, {el});
}

function defineEmblemData(el: HTMLElement) {
  const i = +(el.dataset?.i || 0);

  type TEmblemType = "state" | "burg" | "province";
  type TEmblemTypeArray = IPack[`${TEmblemType}s`];

  const emblemTypeMap: Dict<[TEmblemTypeArray, TEmblemType]> = {
    burgEmblems: [pack.burgs, "burg"],
    provinceEmblems: [pack.provinces, "province"],
    stateEmblems: [pack.states, "state"]
  };

  const emblemType = el.parentElement?.id;
  if (emblemType && emblemType in emblemTypeMap) {
    const [data, type] = emblemTypeMap[emblemType];
    return {type, id: type + "COA" + i, el: data[i]};
  }

  return undefined;
}

const onMouseMove = debounce(handleMouseMove, 100);
function handleMouseMove(this: d3.ContainerElement) {
  const point = d3.mouse(this);
  const i = findCell(point[0], point[1]); // pack cell id
  if (i === undefined) return;

  showNotes(d3.event);
  const gridCell = findGridCell(point[0], point[1], grid);
  if (byId("tooltip")?.dataset.main) showMainTip();
  else showTooltipOnMapHover(point, d3.event, i, gridCell);
  if (byId("cellInfo")?.offsetParent) updateCellInfo(point, i, gridCell);
}

// show note box on hover (if any)
function showNotes(event: Event) {
  if (byId("notesEditor")?.offsetParent) return;

  const el = event.target as SVGElement;
  if (!el?.parentElement?.parentElement?.parentElement) return;

  const parent = el.parentElement;
  const grand = parent.parentElement!;

  let id = el.id || parent.id || grand.id;
  if (grand.id === "burgLabels") id = "burg" + el.dataset.id;
  else if (grand.id === "burgIcons") id = "burg" + el.dataset.id;

  const note = notes.find(note => note.id === id);
  if (note !== undefined && note.legend !== "") {
    byId("notes")!.style.display = "block";
    byId("notesHeader")!.innerHTML = note.name;
    byId("notesBody")!.innerHTML = note.legend;
  } else if (!options.pinNotes && !byId("markerEditor")?.offsetParent) {
    byId("notes")!.style.display = "none";
    byId("notesHeader")!.innerHTML = "";
    byId("notesBody")!.innerHTML = "";
  }
}

// show viewbox tooltip if main tooltip is blank
function showTooltipOnMapHover(point: TPoint, event: Event, packCellId: number, gridCellId: number) {
  tip(""); // clear tip
  const path = event.composedPath() as HTMLElement[];
  if (!path[path.length - 8]) return;

  const group = path[path.length - 7].id;
  const subgroup = path[path.length - 8].id;

  const element = event.target as HTMLElement;
  const parent = element.parentElement!;

  const land = isLand(packCellId);

  // specific elements
  if (group === "armies") return tip(parent.dataset.name + ". Click to edit");

  if (group === "emblems" && element.tagName === "use") {
    d3.select(element).raise();
    d3.select(parent).raise();

    const emblemData = defineEmblemData(element);
    if (!emblemData) return;

    const {type, el} = emblemData;
    const name = ("fullName" in el && el.fullName) || el.name;
    tip(`${name} ${type} emblem. Click to edit`);
    return;
  }

  if (group === "rivers") {
    const riverId = +element.id.slice(5);
    const river = pack.rivers.find(r => r.i === riverId);
    const name = river ? `${river.name} ${river.type}` : "";
    tip(name + ". Click to edit");

    const $riversOverview = byId("riversOverview")!;
    if ($riversOverview?.offsetParent) highlightEditorLine($riversOverview, riverId, 5000);
    return;
  }

  if (group === "routes") return tip("Click to edit the Route");

  if (group === "terrain") return tip("Click to edit the Relief Icon");

  if (subgroup === "burgLabels" || subgroup === "burgIcons") {
    const burgId = +(path[path.length - 10].dataset.id || 0);
    const burg = pack.burgs[burgId];

    const population = si(getBurgPopulation(burg.population));
    tip(`${burg.name}. Population: ${population}. Click to edit`);

    const $burgOverview = byId("burgOverview");
    if ($burgOverview?.offsetParent) highlightEditorLine($burgOverview, burgId, 5000);
    return;
  }
  if (group === "labels") return tip("Click to edit the Label");

  if (group === "markers") return tip("Click to edit the Marker and pin the marker note");

  if (group === "ruler") {
    const tag = element.tagName;
    const className = element.getAttribute("class");
    if (tag === "circle" && className === "edge")
      return tip("Drag to adjust. Hold Ctrl and drag to add a point. Click to remove the point");
    if (tag === "circle" && className === "control")
      return tip("Drag to adjust. Hold Shift and drag to keep axial direction. Click to remove the point");
    if (tag === "circle") return tip("Drag to adjust the measurer");
    if (tag === "polyline") return tip("Click on drag to add a control point");
    if (tag === "path") return tip("Drag to move the measurer");
    if (tag === "text") return tip("Drag to move, click to remove the measurer");
  }

  if (subgroup === "burgIcons") return tip("Click to edit the Burg");

  if (subgroup === "burgLabels") return tip("Click to edit the Burg");

  if (group === "lakes" && !land) {
    const lakeId = +element.dataset.f;
    const name = pack.features[lakeId]?.name;
    const fullName = subgroup === "freshwater" ? name : name + " " + subgroup;
    tip(`${fullName} lake. Click to edit`);
    return;
  }
  if (group === "coastline") return tip("Click to edit the coastline");

  if (group === "zones") {
    const zone = path[path.length - 8];
    tip(zone.dataset.description);
    if (zonesEditor?.offsetParent) highlightEditorLine(zonesEditor, zone.id, 5000);
    return;
  }

  if (group === "ice") return tip("Click to edit the Ice");

  // covering elements
  if (layerIsOn("togglePrec") && land) tip("Annual Precipitation: " + getCellIdPrecipitation(packCellId));
  else if (layerIsOn("togglePopulation")) {
    const [rural, urban] = getCellPopulation(packCellId);
    tip(getPopulationTip("Cell population", rural, urban));
  } else if (layerIsOn("toggleTemp")) tip("Temperature: " + convertTemperature(grid.cells.temp[gridCellId]));
  else if (layerIsOn("toggleBiomes") && pack.cells.biome[packCellId]) {
    const biome = pack.cells.biome[packCellId];
    tip("Biome: " + biomesData.name[biome]);
    if (biomesEditor?.offsetParent) highlightEditorLine(biomesEditor, biome);
  } else if (layerIsOn("toggleReligions") && pack.cells.religion[packCellId]) {
    const religion = pack.cells.religion[packCellId];
    const r = pack.religions[religion];
    const type = r.type === "Cult" || r.type == "Heresy" ? r.type : r.type + " religion";
    tip(type + ": " + r.name);
    if (religionsEditor?.offsetParent) highlightEditorLine(religionsEditor, religion);
  } else if (pack.cells.state[packCellId] && (layerIsOn("toggleProvinces") || layerIsOn("toggleStates"))) {
    const state = pack.cells.state[packCellId];
    const stateName = pack.states[state].fullName;
    const province = pack.cells.province[packCellId];
    const prov = province ? pack.provinces[province].fullName + ", " : "";
    tip(prov + stateName);
    if (byId("statesEditor")?.offsetParent) highlightEditorLine(statesEditor, state);
    if (byId("diplomacyEditor")?.offsetParent) highlightEditorLine(diplomacyEditor, state);
    if (byId("militaryOverview")?.offsetParent) highlightEditorLine(militaryOverview, state);
    if (byId("provincesEditor")?.offsetParent) highlightEditorLine(provincesEditor, province);
  } else if (layerIsOn("toggleCultures") && pack.cells.culture[packCellId]) {
    const culture = pack.cells.culture[packCellId];
    tip("Culture: " + pack.cultures[culture].name);
    if (byId("culturesEditor")?.offsetParent) highlightEditorLine(culturesEditor, culture);
  } else if (layerIsOn("toggleHeight")) tip("Height: " + getFriendlyHeight(point));
}

function highlightEditorLine($editor, id, timeout = 10000) {
  Array.from($editor.getElementsByClassName("states hovered")).forEach(el => el.classList.remove("hovered")); // clear all hovered
  const hovered = Array.from($editor.querySelectorAll("div")).find(el => el.dataset.id == id);
  if (hovered) hovered.classList.add("hovered"); // add hovered class
  if (timeout)
    setTimeout(() => {
      hovered && hovered.classList.remove("hovered");
    }, timeout);
}
