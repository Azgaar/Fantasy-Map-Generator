import { max, select } from "d3";
import type { StateLabel } from "@/generators/labels";
import type { State } from "@/generators/states-generator";
import type { TypedArray } from "@/types/PackedGraph";
import { findClosestCell, minmax, rn, splitInTwo } from "../utils";
import { getStateLabels } from "./draw-labels";
import { drawPathLabel, upsertLabelPath } from "./draw-path-label";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";

/**
 * Fit state labels into their state borders and store the result (pathPoints, text, fontSize)
 * in the Labels data model, then render. Overwrites manual label edits — call it when the
 * underlying state changed (name, borders), not for a plain redraw.
 * list - optional array of stateIds to refit
 */
export const fitStateLabels = (list?: number[]): void => {
  TIME && console.time("fitStateLabels");
  fitLabels(getStateLabels(list));
  TIME && console.timeEnd("fitStateLabels");
};

export function fitLabels(labelDataList: StateLabel[]): void {
  // temporary make the labels visible for text measurements
  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const { states } = pack;
  const mode = options.stateLabelsMode || "auto";
  const letterLength = checkExampleLetterLength();

  for (const labelData of labelDataList) {
    const state = states[labelData.stateId];
    if (!state?.i || state.removed) continue;
    fitLabel(labelData, state, letterLength, mode);
  }

  // restore labels visibility
  labels.style("display", layerDisplay);
}

function fitLabel(labelData: StateLabel, state: State, letterLength: number, mode: string): void {
  // calculate pathPoints using raycast algorithm
  const offset = getOffsetWidth(state.cells!);
  const maxLakeSize = state.cells! / 20;
  const [x0, y0] = state.pole!;

  const rays = ANGLES.map(({ angle, dx, dy }) => {
    const { length, x, y } = raycast({ stateId: state.i, x0, y0, dx, dy, maxLakeSize, offset });
    return { angle, length, x, y };
  });
  const [ray1, ray2] = findBestRayPair(rays);

  const pathPoints: [number, number][] = [[ray1.x, ray1.y], state.pole!, [ray2.x, ray2.y]];
  if (ray1.x > ray2.x) pathPoints.reverse();
  Labels.update(labelData.i, { pathPoints });

  const pathElement = upsertLabelPath(labelData);
  const pathLength = pathElement.getTotalLength() / letterLength; // path length in letters
  const [lines, ratio] = getLinesAndRatio(mode, state.name!, state.fullName!, pathLength);
  Labels.update(labelData.i, { text: lines.join("|"), fontSize: ratio });

  // prolongate path if it's too short
  const longestLineLength = max(lines.map(line => line.length)) || 0;
  if (pathLength && pathLength < longestLineLength) {
    const [x1, y1] = pathPoints.at(0)!;
    const [x2, y2] = pathPoints.at(-1)!;
    const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];

    const mod = longestLineLength / pathLength;
    pathPoints[0] = [x1 + dx - dx * mod, y1 + dy - dy * mod];
    pathPoints[pathPoints.length - 1] = [x2 - dx + dx * mod, y2 - dy + dy * mod];

    Labels.update(labelData.i, { pathPoints });
    upsertLabelPath(labelData);
  }

  const textElement = drawPathLabel(labelData);
  if (!textElement) return;

  if (mode === "full" || lines.length === 1) return;

  // check if label fits state boundaries. If no, replace it with short name
  const { width, height } = textElement.getBBox();
  const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
  const angleRad = Math.atan2(y2 - y1, x2 - x1);

  const isInsideState = checkIfInsideState(textElement, angleRad, width / 2, height / 2, labelData.stateId);
  if (isInsideState) return;

  // replace name to one-liner
  const text = pathLength > state.fullName!.length * 1.8 ? state.fullName! : state.name!;
  const correctedRatio = minmax(rn((pathLength / text.length) * 50), 50, 130);
  Labels.update(labelData.i, { text, fontSize: correctedRatio });
  drawPathLabel(labelData);
}

/**
 * Helper function to calculate offset width for raycast based on state size
 */
function getOffsetWidth(cellsNumber: number): number {
  if (cellsNumber < 40) return 0;
  if (cellsNumber < 200) return 5;
  return 10;
}

function checkExampleLetterLength(): number {
  const textGroup = select<SVGGElement, unknown>("g#labels > g#states");
  const testLabel = textGroup.append("text").attr("x", 0).attr("y", 0).text("Example");
  const letterLength = (testLabel.node() as SVGTextElement).getComputedTextLength() / 7; // approximate length of 1 letter
  testLabel.remove();

  return letterLength;
}

function getLinesAndRatio(mode: string, name: string, fullName: string, pathLength: number): [string[], number] {
  if (mode === "short") return getShortOneLine();
  if (pathLength > fullName.length * 2) return getFullOneLine();
  return getFullTwoLines();

  function getShortOneLine(): [string[], number] {
    const ratio = pathLength / name.length;
    return [[name], minmax(rn(ratio * 60), 50, 150)];
  }

  function getFullOneLine(): [string[], number] {
    const ratio = pathLength / fullName.length;
    return [[fullName], minmax(rn(ratio * 70), 70, 170)];
  }

  function getFullTwoLines(): [string[], number] {
    const lines = splitInTwo(fullName);
    const longestLineLength = max(lines.map(line => line.length)) || 0;
    const ratio = pathLength / longestLineLength;
    return [lines, minmax(rn(ratio * 60), 70, 150)];
  }
}

// check whether multi-lined label is mostly inside the state. If no, replace it with short name label
function checkIfInsideState(
  textElement: SVGGraphicsElement,
  angleRad: number,
  halfwidth: number,
  halfheight: number,
  stateId: number
): boolean {
  const stateIds: TypedArray = pack.cells.state;
  const bbox = textElement.getBBox();
  const [cx, cy] = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];

  const points: [number, number][] = [
    [-halfwidth, -halfheight],
    [+halfwidth, -halfheight],
    [+halfwidth, halfheight],
    [-halfwidth, halfheight],
    [0, halfheight],
    [0, -halfheight]
  ];

  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);
  const rotatedPoints = points.map(([x, y]): [number, number] => [cx + x * cos - y * sin, cy + x * sin + y * cos]);

  let pointsInside = 0;
  for (const [x, y] of rotatedPoints) {
    const isInside = stateIds[findClosestCell(x, y, undefined, pack) as number] === stateId;
    if (isInside) pointsInside++;
    if (pointsInside > 4) return true;
  }

  return false;
}

window.fitStateLabels = fitStateLabels;
