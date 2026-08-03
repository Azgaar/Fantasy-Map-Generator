import { max } from "d3";
import type { LabelNameMode, LabelType, PathLabel } from "@/generators/labels";
import type { TypedArray } from "@/types/PackedGraph";
import { findClosestCell, minmax, rn, splitInTwo } from "@/utils";
import { ensureLabelGroup } from "./label-groups";
import { getLabelPath } from "./label-markup";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";
import type { PathLabelData } from "./types";

type Region = { i: number; name: string; fullName?: string; label?: PathLabel };

export function getRegionLabel(
  region: Region,
  type: LabelType,
  regionIds: TypedArray,
  pole: [number, number],
  cellsNumber: number
): PathLabelData {
  const label: PathLabelData = {
    ...region.label,
    id: `${type}Label${region.i}`,
    type,
    text: region.label?.text ?? region.name ?? "",
    group: region.label?.group || type,
    pathPoints: region.label?.pathPoints || []
  };
  if (label.pathPoints.length) return label;

  const group = ensureLabelGroup(label.group, type);
  const sandbox = createMeasurementSandbox(group);
  const mode = options.labels.groups.find(groupOptions => groupOptions.name === label.group)?.mode || "auto";
  try {
    return { ...label, ...fitLabel(region, label, mode, sandbox, regionIds, pole, cellsNumber) };
  } finally {
    sandbox.remove();
  }
}

function fitLabel(
  region: Region,
  label: PathLabelData,
  mode: LabelNameMode,
  sandbox: SVGGElement,
  regionIds: TypedArray,
  pole: [number, number],
  cellsNumber: number
): Pick<PathLabelData, "pathPoints" | "text" | "fontSize"> {
  const pathPoints = getRegionLabelPath(region.i, regionIds, pole, cellsNumber);
  if (!pathPoints.length) return { pathPoints, text: label.text, fontSize: label.fontSize };

  const labelWithPath = { ...label, pathPoints };
  const letterLength = getAverageLetterLength(sandbox);
  const pathLength = measureLabelPath(labelWithPath, sandbox).getTotalLength() / letterLength;
  const fullName = region.fullName || region.name;
  const hasCustomText = region.label?.text !== undefined;
  const [lines, fontSize] = hasCustomText
    ? [region.label!.text!.split("|"), region.label!.fontSize ?? 100]
    : getLinesAndRatio(mode, region.name, fullName, pathLength);
  const text = lines.join("|");

  const longestLineLength = max(lines.map(line => line.length)) || 0;
  if (pathLength && pathLength < longestLineLength) {
    const [x1, y1] = pathPoints.at(0)!;
    const [x2, y2] = pathPoints.at(-1)!;
    const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];
    const modifier = longestLineLength / pathLength;

    pathPoints[0] = [x1 + dx - dx * modifier, y1 + dy - dy * modifier];
    pathPoints[pathPoints.length - 1] = [x2 - dx + dx * modifier, y2 - dy + dy * modifier];
    measureLabelPath({ ...labelWithPath, text, fontSize }, sandbox);
  }

  const result = { pathPoints, text, fontSize };
  if (hasCustomText || mode === "full" || lines.length === 1) return result;

  const { textElement, textPath } = measureLabelText({ ...labelWithPath, text, fontSize }, sandbox);
  const { width, height } = textPath.getBBox();
  textPath.setAttribute("href", `#${MEASURE_PATH_ID}`);
  const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const fitsRegion = isLabelInsideRegion(textPath, angle, width / 2, height / 2, region.i, regionIds);
  textElement.remove();
  if (fitsRegion) return result;

  const oneLineText = pathLength > fullName.length * 1.8 ? fullName : region.name;
  const correctedFontSize = minmax(rn((pathLength / oneLineText.length) * 50), 50, 130);
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

function measureLabelPath(label: PathLabelData, sandbox: SVGGElement): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = MEASURE_PATH_ID;
  path.setAttribute("d", getLabelPath(label));
  sandbox.querySelector(`#${MEASURE_PATH_ID}`)?.remove();
  sandbox.appendChild(path);
  return path;
}

function measureLabelText(
  label: PathLabelData,
  sandbox: SVGGElement
): { textElement: SVGTextElement; textPath: SVGTextPathElement } {
  const lines = label.text.split("|");
  const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
  const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
  textPath.setAttribute("startOffset", `${label.startOffset ?? 50}%`);
  textPath.setAttribute("font-size", `${label.fontSize ?? 100}%`);
  if (label.letterSpacing !== undefined) textPath.setAttribute("letter-spacing", `${label.letterSpacing}px`);
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
