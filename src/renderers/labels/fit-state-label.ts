import type { State } from "@/generators/states-generator";
import type { Point } from "@/types/global";
import type { TypedArray } from "@/types/PackedGraph";
import { minmax, rn } from "@/utils";
import { getLabelGroupStyle } from "./label-groups";
import { ANGLES, findBestRayPair, type Ray, raycast } from "./label-raycast";

const MIN_FONT_SIZE = 50;
const MAX_FONT_SIZE = 160;
const MIN_FULL_NAME_SIZE = 70;
const PATH_USAGE = 0.9;
const LINE_HALF_HEIGHT = 0.55;
const WRAP_GAIN = 1.15;

export function fitStateLabel(state: State, group: string): { pathPoints: Point[]; text: string; fontSize: number } {
  const mode = options.labels.groups.find(option => option.name === group)?.mode || "auto";
  const fullName = state.fullName || state.name;
  const pole = state.pole || pack.cells.p[state.center];
  const cellsNumber = state.cells;
  if (!cellsNumber) return { pathPoints: [], text: mode === "short" ? state.name : fullName, fontSize: 100 };

  const groupStyle = getLabelGroupStyle(group, "state");
  const baseFontSize = Number.parseFloat(String(groupStyle["font-size"])) || 22;
  const letterSpacing = Number(groupStyle["letter-spacing"]) || 0;
  const basePath = getRegionLabelPath(state.i, pack.cells.state, pole, cellsNumber, 0);

  const fitLines = (lines: string[], fixedFontSize?: number) => {
    const getFontSize = (pathLength: number) => {
      const textWidth = Math.max(...lines.map(estimateTextWidth), 1) * baseFontSize;
      const spacingWidth = Math.max(...lines.map(line => Math.max([...line].length - 1, 0))) * letterSpacing;
      return ((pathLength * PATH_USAGE - spacingWidth) / textWidth) * 100;
    };

    const initialFontSize = fixedFontSize ?? minmax(getFontSize(basePath.pathLength), MIN_FONT_SIZE, MAX_FONT_SIZE);
    const offset = baseFontSize * (initialFontSize / 100) * lines.length * LINE_HALF_HEIGHT;
    let fittedPath = getRegionLabelPath(state.i, pack.cells.state, pole, cellsNumber, offset);

    if (!fittedPath.pathLength && initialFontSize > MIN_FONT_SIZE) {
      const minOffset = baseFontSize * (MIN_FONT_SIZE / 100) * lines.length * LINE_HALF_HEIGHT;
      fittedPath = getRegionLabelPath(state.i, pack.cells.state, pole, cellsNumber, minOffset);
    }
    if (!fittedPath.pathLength) fittedPath = basePath;

    const fitFontSize = fixedFontSize ?? getFontSize(fittedPath.pathLength);
    return {
      pathPoints: fittedPath.pathPoints,
      text: lines.join("|"),
      fontSize: fixedFontSize ?? minmax(rn(fitFontSize), MIN_FONT_SIZE, MAX_FONT_SIZE),
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
    const twoLines = splitName(fullName);
    const twoLine = twoLines.length === 2 ? fitLines(twoLines) : oneLine;
    const fullLabel = twoLine.fontSize >= oneLine.fontSize * WRAP_GAIN ? twoLine : oneLine;

    if (mode === "full" || fullLabel.fitFontSize >= MIN_FULL_NAME_SIZE || state.name === fullName) {
      selected = fullLabel;
    } else {
      const shortLabel = fitLines([state.name]);
      selected = shortLabel.fitFontSize >= fullLabel.fitFontSize * WRAP_GAIN ? shortLabel : fullLabel;
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

function estimateTextWidth(text: string): number {
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

function getRegionLabelPath(
  regionId: number,
  regionIds: TypedArray,
  pole: [number, number],
  cellsNumber: number,
  offset: number
): { pathPoints: Point[]; pathLength: number } {
  const maxLakeSize = cellsNumber / 20;
  const [x0, y0] = pole;
  const rays = ANGLES.map(({ angle, dx, dy }) => ({
    angle,
    ...raycast({ regionId, regionIds, x0, y0, dx, dy, maxLakeSize, offset })
  }));
  const [ray1, ray2] = findBestRayPair(rays);
  return getPathPoints(ray1, ray2, pole);
}

function getPathPoints(ray1: Ray, ray2: Ray, pole: Point) {
  const isStraight = Math.abs(ray1.angle - ray2.angle) === 180;
  if (isStraight) {
    const p1: Point = [ray1.x, ray1.y];
    const p2: Point = [ray2.x, ray2.y];
    return {
      pathPoints: [p1, p2],
      pathLength: ray1.length + ray2.length
    };
  }

  const smaller = ray1.length < ray2.length ? ray1 : ray2;
  // TODO: p1 = ray from pole with ray1.angle on smaller.length
  const p1: Point = [];
  // TODO: p2 = ray from pole with ray2.angle on smaller.length
  const p2: Point = [];
  return { pathPoints: [p1, pole, p2], pathLength: smaller.length * 2 };
}
