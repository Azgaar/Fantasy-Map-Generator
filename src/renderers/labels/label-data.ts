import type { AddedLabel } from "@/generators/added-labels";
import type { Burg } from "@/generators/burgs-generator";
import type { Label, LabelType } from "@/generators/labels-generator";
import type { Province } from "@/generators/provinces-generator";
import type { River } from "@/generators/river-generator";
import type { Route } from "@/generators/routes-generator";
import type { State } from "@/generators/states-generator";
import type { LabelData } from "@/renderers/labels/labels";
import type { Point } from "@/types/global";
import { fitStateLabel } from "./fit-state-label";

export function getLabelsData(): LabelData[] {
  const byType: Record<LabelType, LabelData[]> = {
    state: collect(pack.states, buildStateLabel),
    province: collect(pack.provinces, buildProvinceLabel),
    added: collect(pack.addedLabels, buildAddedLabel),
    burg: collect(pack.burgs, buildBurgLabel),
    river: collect(pack.rivers, buildRiverLabel),
    route: collect(pack.routes, buildRouteLabel)
  };
  return Object.values(byType).flat();
}

function collect<T extends { i: number }>(entities: T[], build: (entity: T) => LabelData | undefined): LabelData[] {
  const labels: LabelData[] = [];
  for (const entity of entities) {
    if (!entity.i) continue; // index 0 is a placeholder in every entity array
    const label = build(entity);
    if (label) labels.push(label);
  }
  return labels;
}

function buildBurgLabel(burg: Burg): LabelData | undefined {
  if (burg.removed) return undefined;
  return {
    ...burg.label,
    id: `burgLabel${burg.i}`,
    entityId: burg.i,
    text: burg.label?.text ?? burg.name ?? "",
    type: "burg",
    group: burg.label?.group || burg.group || "burg",
    anchor: [burg.x, burg.y],
    pathPoints: getCustomPath(burg.label)
  };
}

function buildProvinceLabel(province: Province): LabelData | undefined {
  if (province.removed) return undefined;
  return {
    ...province.label,
    id: `provinceLabel${province.i}`,
    entityId: province.i,
    text: province.label?.text ?? province.name,
    type: "province",
    group: province.label?.group || "province",
    anchor: province.pole || pack.cells.p[province.center],
    pathPoints: getCustomPath(province.label)
  };
}

function buildStateLabel(state: State): LabelData | undefined {
  if (state.removed) return undefined;
  const group = state.label?.group || "state";
  const customPath = getCustomPath(state.label);

  const fitted = customPath || isPlainText(state.label) ? null : fitStateLabel(state, group);
  if (fitted && !fitted.pathPoints.length) return undefined; // state has no cells to fit the label into

  const text = state.label?.text ?? fitted?.text ?? getStateName(state, group);
  if (!text) return undefined;

  return {
    ...state.label,
    id: `stateLabel${state.i}`,
    entityId: state.i,
    type: "state",
    group,
    text,
    fontSize: state.label?.fontSize ?? fitted?.fontSize,
    anchor: state.pole || pack.cells.p[state.center],
    pathPoints: customPath ?? fitted?.pathPoints
  };
}

function buildRiverLabel(river: River): LabelData | undefined {
  if (!river.cells?.length || !river.name) return undefined;
  const anchor = getMiddleCellPoint(river.cells);
  if (!anchor) return undefined; // no on-map cell to anchor to
  const customPath = getCustomPath(river.label);
  const defaultPath = isPlainText(river.label)
    ? undefined
    : formatPathPoints(Rivers.addMeandering(river.cells, river.points));
  return {
    ...river.label,
    id: `riverLabel${river.i}`,
    entityId: river.i,
    type: "river",
    text: river.label?.text ?? `${river.name} ${river.type}`,
    group: river.label?.group || "river",
    anchor,
    pathPoints: customPath ?? defaultPath
  };
}

function buildRouteLabel(route: Route): LabelData | undefined {
  if (!route.name) return undefined;
  const customPath = getCustomPath(route.label);
  const defaultPath = isPlainText(route.label) ? undefined : formatPathPoints(route.points);
  return {
    ...route.label,
    id: `routeLabel${route.i}`,
    entityId: route.i,
    type: "route",
    text: route.label?.text ?? route.name,
    group: route.label?.group || "route",
    anchor: getMiddlePoint(route.points),
    pathPoints: customPath ?? defaultPath
  };
}

function buildAddedLabel(addedLabel: AddedLabel): LabelData {
  return {
    ...addedLabel.label,
    id: `addedLabel${addedLabel.i}`,
    entityId: addedLabel.i,
    text: addedLabel.label.text ?? "",
    type: "added",
    group: addedLabel.label.group || "added",
    anchor: [addedLabel.x, addedLabel.y],
    pathPoints: getCustomPath(addedLabel.label)
  };
}

/** Path drawn for this particular label, if any */
function getCustomPath(label?: Label): Point[] | undefined {
  return label?.pathPoints?.length ? label.pathPoints : undefined;
}

/** Label is explicitly stripped of its path, so it should not fall back to the default geometry */
function isPlainText(label?: Label): boolean {
  return label?.pathPoints?.length === 0;
}

// name mode is resolved by group name, the same way fitStateLabel resolves it
function getStateName(state: State, group: string): string {
  const mode = options.labels.groups.find(option => option.name === group)?.mode || "auto";
  return mode === "short" ? state.name : state.fullName || state.name;
}

function formatPathPoints(pointLike: number[][]): Point[] {
  const points: Point[] = pointLike.map(([x, y]) => [x, y]);
  const trimmed = trimAroundCenter(points);
  if (trimmed.length && trimmed.at(0)![0] > trimmed.at(-1)![0]) trimmed.reverse();
  return trimmed;
}

const LABEL_PATH_POINTS_RADIUS = 12;
function trimAroundCenter(points: Point[], radius = LABEL_PATH_POINTS_RADIUS): Point[] {
  if (points.length <= radius * 2 + 1) return points;
  const middleIndex = Math.floor(points.length / 2);
  const start = Math.max(0, middleIndex - radius);
  const end = Math.min(points.length, middleIndex + radius + 1);
  return points.slice(start, end);
}

function getMiddlePoint(points: number[][]): Point {
  if (!points.length) return [0, 0];
  const [x, y] = points[Math.floor(points.length / 2)];
  return [x, y];
}

// river.cells uses -1 for a cell past the map edge, and it has no entry in cells.p
function getMiddleCellPoint(cells: number[]): Point | undefined {
  const onMap = cells.filter(cellId => cellId >= 0);
  const point = pack.cells.p[onMap[Math.floor(onMap.length / 2)]];
  return point && [point[0], point[1]];
}
