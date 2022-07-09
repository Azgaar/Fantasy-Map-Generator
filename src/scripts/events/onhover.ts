import * as d3 from "d3";

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
import {showMainTip, tip} from "scripts/tooltips";
import {defineEmblemData} from "./utils";

export const onMouseMove = debounce(handleMouseMove, 100);

function handleMouseMove(this: d3.ContainerElement) {
  const [x, y] = d3.mouse(this);
  const i = findCell(x, y); // pack cell id
  if (i === undefined) return;

  showNotes(d3.event);
  const gridCell = findGridCell(x, y, grid);
  if (byId("tooltip")?.dataset.main) showMainTip();
  else showTooltipOnMapHover([x, y], d3.event, i, gridCell);
  if (byId("cellInfo")?.offsetParent) updateCellInfo([x, y], i, gridCell);
}

// show note box on hover (if any)
function showNotes(event: Event) {
  if (byId("notesEditor")?.offsetParent) return;

  const path = event.composedPath() as HTMLElement[];
  const [el, parent, grand] = path;
  if (!el || !parent || !grand) return;

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

const getHoveredElement = (tagName: string, group: string, subgroup: string, isLand: boolean, cellId: number) => {
  const {biome, religion, state, culture} = pack.cells;

  if (group === "armies") return "regiment";
  if (group === "emblems" && tagName === "use") return "emblem";
  if (group === "rivers") return "river";
  if (group === "routes") return "route";
  if (group === "terrain") return "reliefIcon";
  if (subgroup === "burgLabels" || subgroup === "burgIcons") return "burg";
  if (group === "labels") return "label";
  if (group === "markers") return "marker";
  if (group === "ruler") return "ruler";
  if (group === "lakes" && !isLand) return "lake";
  if (group === "coastline") return "coastline";
  if (group === "zones") return "zone";
  if (group === "ice") return "ice";
  if (layerIsOn("togglePrec") && isLand) return "precipitationLayer";
  if (layerIsOn("togglePopulation")) return "populationLayer";
  if (layerIsOn("toggleTemp")) return "temperatureLayer";
  if (layerIsOn("toggleBiomes") && biome[cellId]) return "biomesLayer";
  if (layerIsOn("toggleReligions") && religion[cellId]) return "religionsLayer";
  if (layerIsOn("toggleProvinces") || (layerIsOn("toggleStates") && state[cellId])) return "statesLayer";
  if (layerIsOn("toggleCultures") && culture[cellId]) return "culturesLayer";
  if (layerIsOn("toggleHeight")) return "heightLayer";

  return null;
};

type HoveredElement = ReturnType<typeof getHoveredElement>;
type OnHoverEvent = (props: {
  path: HTMLElement[];
  element: HTMLElement;
  parent: HTMLElement;
  subgroup: string;
  point: TPoint;
  packCellId: number;
  gridCellId: number;
}) => void;
type OnHoverEventMap = {[key in Exclude<HoveredElement, null>]: OnHoverEvent};

const onHoverEventsMap: OnHoverEventMap = {
  regiment: ({parent}) => tip(parent.dataset.name + ". Click to edit"),

  emblem: ({element, parent}) => {
    d3.select(element).raise();
    d3.select(parent).raise();

    const emblemData = defineEmblemData(element);
    if (emblemData) {
      const {type, el} = emblemData;
      const name = ("fullName" in el && el.fullName) || el.name;
      tip(`${name} ${type} emblem. Click to edit`);
    }
  },

  river: ({element}) => {
    const riverId = +element.id.slice(5);
    const river = pack.rivers.find(r => r.i === riverId);
    const name = river ? `${river.name} ${river.type}` : "";
    tip(name + ". Click to edit");

    highlightDialogLine("riversOverview", riverId, 5000);
  },

  route: () => tip("Click to edit the Route"),

  reliefIcon: () => tip("Click to edit the Relief Icon"),

  burg: ({path}) => {
    const burgId = +(path.at(-10)?.dataset.id || 0);
    const {population, name} = pack.burgs[burgId];
    tip(`${name}. Population: ${si(getBurgPopulation(population))}. Click to edit`);

    highlightDialogLine("burgOverview", burgId, 5000);
  },

  label: () => tip("Click to edit the Label"),

  marker: () => tip("Click to edit the Marker and pin the marker note"),

  ruler: ({element}) => {
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
  },

  lake: ({element, subgroup}) => {
    const lakeId = +(element.dataset.f || 0);
    const name = pack.features[lakeId]?.name;
    const fullName = subgroup === "freshwater" ? name : name + " " + subgroup;
    tip(`${fullName} lake. Click to edit`);
  },

  coastline: () => tip("Click to edit the coastline"),

  zone: ({path}) => {
    const $zone = path[path.length - 8];
    tip($zone.dataset.description || "");

    highlightDialogLine("zonesEditor", $zone.id, 5000);
  },

  ice: () => tip("Click to edit the Ice"),

  precipitationLayer: ({packCellId}) => tip("Annual Precipitation: " + getCellIdPrecipitation(packCellId)),

  populationLayer: ({packCellId}) => {
    const [rural, urban] = getCellPopulation(packCellId);
    tip(getPopulationTip("Cell population", rural, urban));
  },

  temperatureLayer: ({gridCellId}) => tip("Temperature: " + convertTemperature(grid.cells.temp[gridCellId])),

  biomesLayer: ({packCellId}) => {
    const biome = pack.cells.biome[packCellId];
    tip("Biome: " + biomesData.name[biome]);

    highlightDialogLine("biomesEditor", biome);
  },

  religionsLayer: ({packCellId}) => {
    const religionId = pack.cells.religion[packCellId];
    const {type, name} = pack.religions[religionId] || {};
    const typeTip = type === "Cult" || type == "Heresy" ? type : type + " religion";
    tip(`${typeTip}: ${name}`);

    highlightDialogLine("religionsEditor", religionId);
  },

  statesLayer: ({packCellId}) => {
    const state = pack.cells.state[packCellId];
    const stateName = pack.states[state].fullName;
    const province = pack.cells.province[packCellId];
    const prov = province ? `${pack.provinces[province].fullName}, ` : "";
    tip(prov + stateName);

    highlightDialogLine("statesEditor", state);
    highlightDialogLine("diplomacyEditor", state);
    highlightDialogLine("militaryEditor", state);
    highlightDialogLine("provincesEditor", province);
  },

  culturesLayer: ({packCellId}) => {
    const culture = pack.cells.culture[packCellId];
    tip("Culture: " + pack.cultures[culture].name);

    highlightDialogLine("culturesEditor", culture);
  },

  heightLayer: ({point}) => tip("Height: " + getFriendlyHeight(point))
};

// show viewbox tooltip if main tooltip is blank
function showTooltipOnMapHover(point: TPoint, event: Event, packCellId: number, gridCellId: number) {
  tip(""); // clear tip

  const path = event.composedPath() as HTMLElement[];
  const [element, parent] = path;
  if (!element || !parent || !path.at(-7) || !path.at(-8)) return;

  const group = path.at(-7)!.id;
  const subgroup = path.at(-8)!.id;
  const land = isLand(packCellId);

  const hoveredMapElement = getHoveredElement(element.tagName, group, subgroup, land, packCellId);
  if (hoveredMapElement && hoveredMapElement in onHoverEventsMap) {
    onHoverEventsMap[hoveredMapElement]({path, element, parent, subgroup, point, packCellId, gridCellId});
  }
}

function highlightDialogLine(dialogId: string, lineId: number | string, timeout = 5000) {
  const $dialog = byId(dialogId);
  if (!$dialog || !$dialog.offsetParent) return; // check if dialog is visible

  Array.from($dialog.getElementsByClassName("states hovered")).forEach(el => el.classList.remove("hovered")); // clear all hovered
  const hovered = Array.from($dialog.querySelectorAll("div")).find(el => el.dataset.id === String(lineId));
  if (hovered) hovered.classList.add("hovered"); // add hovered class

  if (timeout)
    setTimeout(() => {
      hovered && hovered.classList.remove("hovered");
    }, timeout);
}
