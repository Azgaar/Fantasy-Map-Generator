import type { State } from "@/generators/states-generator";
import type { Point } from "@/types/global";
import type { TypedArray } from "@/types/PackedGraph";
import { minmax, rn } from "@/utils";
import { getGroupStyle } from "./label-groups";
import { ANGLES, findBestRayPair, type Ray, raycast } from "./label-raycast";

const MIN_FONT_SIZE = 40;
const MAX_FONT_SIZE = 160;
const MIN_FULL_NAME_SIZE = 70;
const PATH_USAGE = 0.9;
const PATH_EXTENSION = 1.1;
const LINE_HALF_HEIGHT = 0.55;
const ONE_LINE_GAIN = 1.25;
const SHORT_NAME_GAIN = 1.15;

export function fitStateLabel(state: State, group: string): { pathPoints: Point[]; text: string; fontSize: number } {
  const mode = options.labels.groups.find(option => option.name === group)?.mode || "auto";
  const fullName = state.fullName || state.name;
  const pole = state.pole || pack.cells.p[state.center];
  const cellsNumber = state.cells;
  if (!cellsNumber) return { pathPoints: [], text: mode === "short" ? state.name : fullName, fontSize: 100 };

  const groupStyle = getGroupStyle({ name: group, type: "state" });
  const baseFontSize = Number.parseFloat(groupStyle.attrs["font-size"]) || 22;
  const letterSpacing = groupStyle.attrs["letter-spacing"] || 0;
  const basePath = getRegionLabelPath(state.i, pack.cells.state, pole, cellsNumber, 0);

  const fitLines = (lines: string[], fixedFontSize?: number) => {
    const textWidth = Math.max(...lines.map(estimateTextWidth), 1) * baseFontSize;
    const spacingWidth = Math.max(...lines.map(line => Math.max([...line].length - 1, 0))) * letterSpacing;
    const getFontSize = (pathLength: number) => {
      return ((pathLength * PATH_USAGE - spacingWidth) / textWidth) * 100;
    };

    const initialFontSize = fixedFontSize ?? minmax(getFontSize(basePath.length), MIN_FONT_SIZE, MAX_FONT_SIZE);
    const offset = baseFontSize * (initialFontSize / 100) * lines.length * LINE_HALF_HEIGHT;
    let fittedPath = getRegionLabelPath(state.i, pack.cells.state, pole, cellsNumber, offset);

    if (!fittedPath.length && initialFontSize > MIN_FONT_SIZE) {
      const minOffset = baseFontSize * (MIN_FONT_SIZE / 100) * lines.length * LINE_HALF_HEIGHT;
      fittedPath = getRegionLabelPath(state.i, pack.cells.state, pole, cellsNumber, minOffset);
    }
    if (!fittedPath.length) fittedPath = basePath;

    const fitFontSize = fixedFontSize ?? getFontSize(fittedPath.length);
    const fontSize = fixedFontSize ?? minmax(rn(fitFontSize), MIN_FONT_SIZE, MAX_FONT_SIZE);
    const requiredPathLength = ((textWidth * (fontSize / 100) + spacingWidth) / PATH_USAGE) * PATH_EXTENSION;
    const pathPoints =
      fontSize < 100 ? extendPathShoulders(fittedPath.pathPoints, requiredPathLength) : fittedPath.pathPoints;

    return {
      pathPoints,
      text: lines.join("|"),
      fontSize,
      fitFontSize
    };
  };

  let selected: ReturnType<typeof fitLines>;
  if (state.label?.text) {
    selected = fitLines(state.label.text.split("|"), state.label.fontSize ?? 100);
  } else if (mode === "short") {
    selected = fitLines([state.name]);
  } else {
    const oneLine = fitLines([fullName]);
    const splitLines = splitName(fullName);
    const twoLine = splitLines.length === 2 ? fitLines(splitLines) : oneLine;
    const fullLabel = oneLine.fitFontSize >= twoLine.fitFontSize * ONE_LINE_GAIN ? oneLine : twoLine;

    if (mode === "full" || fullLabel.fitFontSize >= MIN_FULL_NAME_SIZE || state.name === fullName) {
      selected = fullLabel;
    } else {
      const shortLabel = fitLines([state.name]);
      selected = shortLabel.fitFontSize >= fullLabel.fitFontSize * SHORT_NAME_GAIN ? shortLabel : fullLabel;
    }
  }

  return { pathPoints: selected.pathPoints, text: selected.text, fontSize: selected.fontSize };
}

function splitName(name: string): string[] {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return [name];

  let bestLines = [name];
  let bestWidth = Infinity;
  for (let index = 1; index < words.length; index++) {
    const lines = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
    const width = Math.max(...lines.map(estimateTextWidth));
    if (width < bestWidth) [bestLines, bestWidth] = [lines, width];
  }
  return bestLines;
}

export function estimateTextWidth(text: string): number {
  let width = 0;
  for (const character of text) {
    if (character === " ") width += 0.32;
    else if ("ilIjtfr.,'|".includes(character)) width += 0.35;
    else if ("MWQO@%".includes(character)) width += 0.85;
    else if (character !== character.toLowerCase() && character === character.toUpperCase()) width += 0.68;
    else width += 0.55;
  }
  return width;
}

function extendPathShoulders(pathPoints: Point[], requiredLength: number): Point[] {
  if (pathPoints.length === 2) {
    const [p1, p2] = pathPoints;
    const length = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    if (!length || length >= requiredLength) return pathPoints;

    const extension = (requiredLength - length) / 2;
    const [dx, dy] = [(p2[0] - p1[0]) / length, (p2[1] - p1[1]) / length];
    return [
      [p1[0] - dx * extension, p1[1] - dy * extension],
      [p2[0] + dx * extension, p2[1] + dy * extension]
    ];
  }

  const [p1, pole, p2] = pathPoints;
  const shoulderLength = Math.hypot(p1[0] - pole[0], p1[1] - pole[1]);
  if (!shoulderLength || shoulderLength * 2 >= requiredLength) return pathPoints;

  const scale = requiredLength / 2 / shoulderLength;
  return [
    [pole[0] + (p1[0] - pole[0]) * scale, pole[1] + (p1[1] - pole[1]) * scale],
    pole,
    [pole[0] + (p2[0] - pole[0]) * scale, pole[1] + (p2[1] - pole[1]) * scale]
  ];
}

function getRegionLabelPath(
  regionId: number,
  regionIds: TypedArray,
  pole: [number, number],
  cellsNumber: number,
  offset: number
): { pathPoints: Point[]; length: number } {
  const maxLakeSize = cellsNumber / 20;
  const [x0, y0] = pole;
  const rays = ANGLES.map(({ angle, dx, dy }) => ({
    angle,
    ...raycast({ regionId, regionIds, x0, y0, dx, dy, maxLakeSize, offset })
  }));
  const [ray1, ray2] = findBestRayPair(rays);
  const { points, length } = getPathPoints(ray1, ray2, pole);
  if (points.at(0)![0] > points.at(-1)![0]) points.reverse();
  return { pathPoints: points, length };
}

function getPathPoints(ray1: Ray, ray2: Ray, pole: Point) {
  const isStraight = Math.abs(ray1.angle - ray2.angle) === 180;
  const minLength = Math.min(ray1.length, ray2.length);
  const maxLength = Math.max(ray1.length, ray2.length);
  const shouldersProportion = maxLength / minLength;

  if (isStraight || shouldersProportion > 2) {
    const p1: Point = [ray1.x, ray1.y];
    const p2: Point = [ray2.x, ray2.y];
    return { points: [p1, p2], length: ray1.length + ray2.length };
  }

  const radians = Math.PI / 180;
  const p1: Point = [
    pole[0] + Math.cos(ray1.angle * radians) * minLength,
    pole[1] + Math.sin(ray1.angle * radians) * minLength
  ];
  const p2: Point = [
    pole[0] + Math.cos(ray2.angle * radians) * minLength,
    pole[1] + Math.sin(ray2.angle * radians) * minLength
  ];
  return { points: [p1, pole, p2], length: minLength * 2 };
}
