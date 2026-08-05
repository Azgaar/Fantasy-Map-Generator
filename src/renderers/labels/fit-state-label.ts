import { max } from "d3";
import type { LabelNameMode } from "@/generators/labels";
import type { State } from "@/generators/states-generator";
import type { Point } from "@/types/global";
import type { TypedArray } from "@/types/PackedGraph";
import { findClosestCell, minmax, rn, splitInTwo } from "@/utils";
import { ensureLabelGroup } from "./label-groups";
import { getLabelPath } from "./label-markup";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";

export function fitStateLabel(state: State, group: string): { pathPoints: Point[]; text: string; fontSize: number } {
  const groupName = ensureLabelGroup(group, "state");
  const sandbox = createMeasurementSandbox(groupName);

  const mode = options.labels.groups.find(opt => opt.name === group)?.mode || "auto";
  const name = mode === "short" ? state.name : state.fullName || state.name;

  const pathPoints = getRegionLabelPath(
    state.i,
    pack.cells.state,
    state.pole || pack.cells.p[state.center],
    state.cells || 0
  );
  if (!pathPoints.length) return { pathPoints, text: name, fontSize: 100 };

  const letterLength = getAverageLetterLength(sandbox);
  const pathLength = measureLabelPath(pathPoints, sandbox).getTotalLength() / letterLength;
  const hasCustomText = state.label?.text !== undefined;
  const [lines, fontSize] = hasCustomText
    ? [state.label!.text!.split("|"), state.label!.fontSize ?? 100]
    : getLinesAndRatio(mode, state.name, name, pathLength);
  const text = lines.join("|");

  const longestLineLength = max(lines.map(line => line.length)) || 0;
  if (pathLength && pathLength < longestLineLength) {
    const [x1, y1] = pathPoints.at(0)!;
    const [x2, y2] = pathPoints.at(-1)!;
    const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];
    const modifier = longestLineLength / pathLength;

    pathPoints[0] = [x1 + dx - dx * modifier, y1 + dy - dy * modifier];
    pathPoints[pathPoints.length - 1] = [x2 - dx + dx * modifier, y2 - dy + dy * modifier];
    measureLabelPath(pathPoints, sandbox);
  }

  if (hasCustomText || mode === "full" || lines.length === 1) return { pathPoints, text, fontSize };

  const { textElement, textPath } = measureLabelText(text, fontSize, sandbox);
  const { width, height } = textPath.getBBox();
  textPath.setAttribute("href", `#${MEASURE_PATH_ID}`);
  const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const fitsRegion = isLabelInsideRegion(textPath, angle, width / 2, height / 2, state.i, pack.cells.state);
  textElement.remove();
  if (fitsRegion) return { pathPoints, text, fontSize };

  const oneLineText = pathLength > name.length * 1.8 ? name : state.name;
  const correctedFontSize = minmax(rn((pathLength / oneLineText.length) * 50), 50, 130);

  sandbox.remove();
  return { pathPoints, text: oneLineText, fontSize: correctedFontSize };
}

function getRegionLabelPath(
  regionId: number,
  regionIds: TypedArray,
  pole: [number, number],
  cellsNumber: number
): [number, number][] {
  if (cellsNumber <= 0) return [];
  const offset = cellsNumber < 40 ? 0 : cellsNumber < 200 ? 5 : 10;
  const maxLakeSize = cellsNumber / 20;
  const [x0, y0] = pole;
  const rays = ANGLES.map(({ angle, dx, dy }) => ({
    angle,
    ...raycast({ regionId, regionIds, x0, y0, dx, dy, maxLakeSize, offset })
  }));
  const [ray1, ray2] = findBestRayPair(rays);
  const pathPoints: [number, number][] = [[ray1.x, ray1.y], pole, [ray2.x, ray2.y]];
  if (ray1.x > ray2.x) pathPoints.reverse();
  return pathPoints;
}

function createMeasurementSandbox(group: SVGGElement): SVGGElement {
  const sandbox = document.createElementNS("http://www.w3.org/2000/svg", "g");
  sandbox.style.visibility = "hidden";

  const groupStyle = getComputedStyle(group);
  sandbox.setAttribute("font-family", groupStyle.fontFamily);
  sandbox.setAttribute("font-size", groupStyle.fontSize);
  sandbox.setAttribute("letter-spacing", groupStyle.letterSpacing);
  sandbox.setAttribute("text-anchor", groupStyle.textAnchor);
  sandbox.setAttribute("dominant-baseline", groupStyle.dominantBaseline);

  document.getElementById("viewbox")!.appendChild(sandbox);
  return sandbox;
}

function getAverageLetterLength(sandbox: SVGGElement): number {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.textContent = "Example";
  sandbox.appendChild(text);
  const letterLength = text.getComputedTextLength() / 7;
  text.remove();
  return letterLength;
}

const MEASURE_PATH_ID = "measureLabelPath";

function measureLabelPath(pathPoints: Point[], sandbox: SVGGElement): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = MEASURE_PATH_ID;
  path.setAttribute("d", getLabelPath({ pathPoints }));
  sandbox.querySelector(`#${MEASURE_PATH_ID}`)?.remove();
  sandbox.appendChild(path);
  return path;
}

function measureLabelText(
  text: string,
  fontSize: number,
  sandbox: SVGGElement
): { textElement: SVGTextElement; textPath: SVGTextPathElement } {
  const lines = text.split("|");
  const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
  const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
  textPath.setAttribute("text-anchor", "middle");
  textPath.setAttribute("font-size", `${fontSize ?? 100}%`);
  textPath.append(
    ...lines.map((line, index) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", "0");
      tspan.setAttribute("dy", index ? "1em" : `${(lines.length - 1) / -2}em`);
      tspan.textContent = line;
      return tspan;
    })
  );
  textElement.appendChild(textPath);
  sandbox.appendChild(textElement);
  return { textElement, textPath };
}

function getLinesAndRatio(mode: LabelNameMode, name: string, fullName: string, pathLength: number): [string[], number] {
  if (mode === "short") return getShortOneLine();
  if (pathLength > fullName.length * 2) return getFullOneLine();
  return getFullTwoLines();

  function getShortOneLine(): [string[], number] {
    return [[name], minmax(rn((pathLength / name.length) * 60), 50, 150)];
  }

  function getFullOneLine(): [string[], number] {
    return [[fullName], minmax(rn((pathLength / fullName.length) * 70), 70, 170)];
  }

  function getFullTwoLines(): [string[], number] {
    const lines = splitInTwo(fullName);
    const longestLineLength = max(lines.map(line => line.length)) || 0;
    return [lines, minmax(rn((pathLength / longestLineLength) * 60), 70, 150)];
  }
}

function isLabelInsideRegion(
  textElement: SVGGraphicsElement,
  angle: number,
  halfWidth: number,
  halfHeight: number,
  regionId: number,
  regionIds: TypedArray
): boolean {
  const { x, y, width, height } = textElement.getBBox();
  const [centerX, centerY] = [x + width / 2, y + height / 2];
  const points: [number, number][] = [
    [-halfWidth, -halfHeight],
    [+halfWidth, -halfHeight],
    [+halfWidth, halfHeight],
    [-halfWidth, halfHeight],
    [0, halfHeight],
    [0, -halfHeight]
  ];
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  let pointsInside = 0;
  for (const [x, y] of points) {
    const pointX = centerX + x * cos - y * sin;
    const pointY = centerY + x * sin + y * cos;
    const cellId = findClosestCell(pointX, pointY, undefined, pack) as number;
    if (regionIds[cellId] === regionId) pointsInside++;
    if (pointsInside > 4) return true;
  }

  return false;
}
