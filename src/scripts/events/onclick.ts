import * as d3 from "d3";

import {openDialog} from "dialogs";
// @ts-expect-error js module
import {clearLegend, dragLegendBox} from "modules/legend";
// @ts-expect-error js module
import {updateCellInfo} from "modules/ui/cell-info";
import {findCell} from "utils/graphUtils";
import {defineEmblemData} from "./utils";

const getClickedElement = (
  tagName: string,
  parentId: string,
  grandId: string,
  greatId: string,
  greatGrandId: string,
  isCoastalCell: boolean
) => {
  if (grandId === "emblems") return "emblem";
  if (parentId === "rivers") return "river";
  if (grandId === "routes") return "route";
  if (tagName === "tspan" && greatGrandId === "labels") return "label";
  if (grandId === "burgLabels" || grandId === "burgIcons") return "burg";
  if (parentId === "ice") return "ice";
  if (parentId === "terrain") return "reliefIcon";
  if (grandId === "markers" || greatId === "markers") return "marker";
  if (grandId === "coastline" || isCoastalCell) return "coastline";
  if (greatId === "armies") return "regiment";
  if (grandId === "lakes") return "lake";
  return null;
};

type ClickedElement = ReturnType<typeof getClickedElement>;
type OnClickEvent = (el: HTMLElement) => void;
type OnClickEventMap = {[key in Exclude<ClickedElement, null>]: OnClickEvent};

const onClickEventsMap: OnClickEventMap = {
  emblem: el => openDialog("emblemEditor", null, defineEmblemData(el)),
  river: el => openDialog("riverEditor", null, el.id),
  route: () => openDialog("routeEditor"),
  label: el => openDialog("labelEditor", null, {el}),
  burg: el => openDialog("burgEditor", null, {id: +(el.dataset.id || 0)}),
  ice: () => openDialog("iceEditor"),
  reliefIcon: () => openDialog("reliefEditor"),
  marker: () => openDialog("markerEditor"),
  coastline: el => openDialog("coastlineEditor", null, {el}),
  regiment: () => openDialog("regimentEditor"),
  lake: el => openDialog("lakeEditor", null, {el})
};

// on viewbox click event - run function based on target
export function handleMapClick(this: d3.ContainerElement) {
  const path = d3.event.composedPath() as HTMLElement[];
  const [el, parent, grand, great, greatGrand] = path;
  if (!el || !parent || !grand || !great || !greatGrand) return;

  const p = d3.mouse(this);
  const i = findCell(p[0], p[1]);
  const isCoastalCell = pack.cells.t[i] === 1;

  const clickedElement = getClickedElement(el.tagName, parent.id, grand.id, great.id, greatGrand.id, isCoastalCell);
  if (clickedElement && clickedElement in onClickEventsMap) {
    onClickEventsMap[clickedElement](el);
  }
}
