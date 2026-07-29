import { max } from "d3";
import type { Label } from "@/generators/labels";
import type { State } from "@/generators/states-generator";
import type { TypedArray } from "@/types/PackedGraph";
import { findClosestCell, minmax, rn, splitInTwo } from "../utils";
import { ensureLabelGroup, getLabelPath, getLabelPathMarkup, getLabelTextMarkup } from "./draw-label-utils";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";

export function drawStateLabels(): void {
  clearStateLabels();

  let paths = "";
  let texts = "";

  const sandbox = createMeasurementSandbox("states");
  const mode = options.stateLabelsMode || "auto";
  const letterLength = checkExampleLetterLength(sandbox);

  try {
    for (const state of pack.states) {
      if (!state.i || state.removed) continue;
      const label = resolveStateLabel(state, sandbox, mode, letterLength);
      paths += getLabelPathMarkup(label);
      texts += getLabelTextMarkup(label);
    }
  } finally {
    sandbox.remove();
  }

  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", paths);
  ensureLabelGroup("states", "state").insertAdjacentHTML("beforeend", texts);
}

export function drawStateLabel(stateId: number): void {
  const state = pack.states[stateId];
  if (!state?.i || state.removed) return;

  const sandbox = createMeasurementSandbox("states");
  const mode = options.stateLabelsMode || "auto";
  const letterLength = checkExampleLetterLength(sandbox);

  try {
    const label = resolveStateLabel(state, sandbox, mode, letterLength);
    const path = getLabelPathMarkup(label);
    const text = getLabelTextMarkup(label);

    document.getElementById(`textPath_stateLabel${state.i}`)?.remove();
    document.getElementById(`stateLabel${state.i}`)?.remove();
    document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", path);
    ensureLabelGroup("states", "state").insertAdjacentHTML("beforeend", text);
  } finally {
    sandbox.remove();
  }
}

function resolveStateLabel(state: State, sandbox: SVGGElement, mode: string, letterLength: number) {
  const label = createStateLabel(state);
  return label.pathPoints.length ? label : { ...label, ...fitLabel(state, sandbox, mode, letterLength) };
}

function createStateLabel(state: State) {
  return {
    ...state.label,
    id: `stateLabel${state.i}`,
    text: state.label?.text ?? state.name ?? "",
    pathPoints: state.label?.pathPoints || []
  };
}

function clearStateLabels(): void {
  document.querySelector("#labels > #states")?.replaceChildren();
  document.querySelectorAll("#textPaths > path[id^='textPath_stateLabel']").forEach(path => {
    path.remove();
  });
}

// hidden group in the map viewbox carrying the label group's computed text context, so
// measurements match the real render even while the labels layer itself is display:none
function createMeasurementSandbox(group: string): SVGGElement {
  const sandbox = document.createElementNS("http://www.w3.org/2000/svg", "g");
  sandbox.id = "labelMeasurement";
  sandbox.style.visibility = "hidden";

  const groupStyle = getComputedStyle(ensureLabelGroup(group, "state"));
  sandbox.setAttribute("font-family", groupStyle.fontFamily);
  sandbox.setAttribute("font-size", groupStyle.fontSize);
  sandbox.setAttribute("letter-spacing", groupStyle.letterSpacing);
  sandbox.setAttribute("text-anchor", groupStyle.textAnchor);
  sandbox.setAttribute("dominant-baseline", groupStyle.dominantBaseline);

  document.getElementById("viewbox")!.appendChild(sandbox);
  return sandbox;
}

function fitLabel(state: State, sandbox: SVGGElement, mode: string, letterLength: number) {
  const hasCustomText = state.label?.text !== undefined;

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

  const labelWithPath = { ...createStateLabel(state), pathPoints };
  const pathElement = measureLabelPath(labelWithPath, sandbox);
  const pathLength = pathElement.getTotalLength() / letterLength; // path length in letters
  const [lines, fontSize] = hasCustomText
    ? [state.label!.text!.split("|"), state.label!.fontSize ?? 100]
    : getLinesAndRatio(mode, state.name!, state.fullName!, pathLength);
  const text = lines.join("|");
  const fittedLabel = { ...labelWithPath, text, fontSize };

  // prolongate path if it's too short
  const longestLineLength = max(lines.map(line => line.length)) || 0;
  if (pathLength && pathLength < longestLineLength) {
    const [x1, y1] = pathPoints.at(0)!;
    const [x2, y2] = pathPoints.at(-1)!;
    const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];

    const mod = longestLineLength / pathLength;
    pathPoints[0] = [x1 + dx - dx * mod, y1 + dy - dy * mod];
    pathPoints[pathPoints.length - 1] = [x2 - dx + dx * mod, y2 - dy + dy * mod];

    measureLabelPath(fittedLabel, sandbox);
  }

  const result = { pathPoints, text, fontSize };
  if (hasCustomText || mode === "full" || lines.length === 1) return result;

  // check if label fits state boundaries. If no, replace it with short name
  const { text: measurementText, textPath } = measureLabelText(fittedLabel, sandbox);
  const { width, height } = textPath.getBBox();
  textPath.setAttribute("href", `#${MEASURE_PATH_ID}`);
  const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
  const angleRad = Math.atan2(y2 - y1, x2 - x1);

  const isInsideState = checkIfInsideState(textPath, angleRad, width / 2, height / 2, state.i);
  measurementText.remove();
  if (isInsideState) return result;

  // replace name to one-liner
  const oneLineText = pathLength > state.fullName!.length * 1.8 ? state.fullName! : state.name!;
  const correctedRatio = minmax(rn((pathLength / oneLineText.length) * 50), 50, 130);
  return { pathPoints, text: oneLineText, fontSize: correctedRatio };
}

const MEASURE_PATH_ID = "measureLabelPath";

// create or update the sandbox measurement path for the label's current pathPoints
function measureLabelPath(label: Label, sandbox: SVGGElement): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = MEASURE_PATH_ID;
  path.setAttribute("d", getLabelPath(label));
  sandbox.querySelector(`#${MEASURE_PATH_ID}`)?.remove();
  sandbox.appendChild(path);
  return path;
}

// attach a measurement copy of the label's text to the sandbox; caller removes it after measuring
function measureLabelText(
  label: Label & { text: string },
  sandbox: SVGGElement
): { text: SVGTextElement; textPath: SVGTextPathElement } {
  const lines = label.text.split("|");
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
  textPath.setAttribute("startOffset", `${label.startOffset ?? 50}%`);
  textPath.setAttribute("font-size", `${label.fontSize ?? 100}%`);
  if (label.letterSpacing) textPath.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  textPath.append(
    ...lines.map((lineText, index) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", "0");
      tspan.setAttribute("dy", index ? "1em" : `${(lines.length - 1) / -2}em`);
      tspan.textContent = lineText;
      return tspan;
    })
  );
  text.appendChild(textPath);
  sandbox.appendChild(text);
  return { text, textPath };
}

function getOffsetWidth(cellsNumber: number): number {
  if (cellsNumber < 40) return 0;
  if (cellsNumber < 200) return 5;
  return 10;
}

function checkExampleLetterLength(sandbox: SVGGElement): number {
  const testLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  testLabel.setAttribute("x", "0");
  testLabel.setAttribute("y", "0");
  testLabel.textContent = "Example";
  sandbox.appendChild(testLabel);
  const letterLength = testLabel.getComputedTextLength() / 7; // approximate length of 1 letter
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
