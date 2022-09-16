import * as d3 from "d3";

import {findCell} from "utils/graphUtils";
import {isState} from "utils/typeUtils";
import {drawPath, drawPoint, drawPolyline} from "utils/debugUtils";
import {round, splitInTwo} from "utils/stringUtils";
import {minmax, rn} from "utils/numberUtils";

// increase step to 15 or 30 to make it faster and more horyzontal, decrease to 5 to improve accuracy
const STEP = 9;
const raycast = precalculateAngles(STEP);

const INITIAL_DISTANCE = 5;
const DISTANCE_STEP = 15;
const MAX_ITERATIONS = 100;

export function drawStateLabels(cells: IPack["cells"], states: TStates) {
  /* global: findCell, graphWidth, graphHeight */
  console.time("drawStateLabels");

  const labelPaths = getLabelPaths(cells.state, states);
  drawLabelPath(cells.state, states, labelPaths);

  console.timeEnd("drawStateLabels");
}

function getLabelPaths(stateIds: Uint16Array, states: TStates) {
  const labelPaths: [number, TPoints][] = [];

  for (const state of states) {
    if (!isState(state)) continue;

    const offset = getOffsetWidth(state.cells);
    const [x0, y0] = state.pole;

    const offsetPoints = new Map(
      (offset ? raycast : []).map(({angle, x: x1, y: y1}) => {
        const [x, y] = [x0 + offset * x1, y0 + offset * y1];
        return [angle, {x, y}];
      })
    );

    const distances = raycast.map(({angle, x: dx, y: dy, modifier}) => {
      let distanceMin: number;

      if (offset) {
        const point1 = offsetPoints.get(angle + 90 >= 360 ? angle - 270 : angle + 90)!;
        const distance1 = getMaxDistance(stateIds, state.i, point1, dx, dy);

        const point2 = offsetPoints.get(angle - 90 < 0 ? angle + 270 : angle - 90)!;
        const distance2 = getMaxDistance(stateIds, state.i, point2, dx, dy);
        distanceMin = Math.min(distance1, distance2);
      } else {
        distanceMin = getMaxDistance(stateIds, state.i, {x: x0, y: y0}, dx, dy);
      }

      const [x, y] = [x0 + distanceMin * dx, y0 + distanceMin * dy];
      return {angle, distance: distanceMin * modifier, x, y};
    });

    const {
      angle,
      x: x1,
      y: y1
    } = distances.reduce(
      (acc, {angle, distance, x, y}) => {
        if (distance > acc.distance) return {angle, distance, x, y};
        return acc;
      },
      {angle: 0, distance: 0, x: 0, y: 0}
    );

    const oppositeAngle = angle >= 180 ? angle - 180 : angle + 180;
    const {x: x2, y: y2} = distances.reduce(
      (acc, {angle, distance, x, y}) => {
        const angleDif = getAnglesDif(angle, oppositeAngle);
        const score = distance * getAngleModifier(angleDif);
        if (score > acc.score) return {angle, score, x, y};
        return acc;
      },
      {angle: 0, score: 0, x: 0, y: 0}
    );

    const pathPoints: TPoints = [[x1, y1], state.pole, [x2, y2]];
    if (x1 > x2) pathPoints.reverse();
    labelPaths.push([state.i, pathPoints]);
  }

  return labelPaths;
}

function getMaxDistance(stateIds: Uint16Array, stateId: number, point: {x: number; y: number}, dx: number, dy: number) {
  let distance = INITIAL_DISTANCE;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const [x, y] = [point.x + distance * dx, point.y + distance * dy];
    const cellId = findCell(x, y);

    // const inside = cells.state[cellId] === stateId;
    // drawPoint([x, y], {color: inside ? "blue" : "red", radius: 1});

    if (stateIds[cellId] !== stateId) break;
    distance += DISTANCE_STEP;
  }

  return distance;
}

function drawLabelPath(stateIds: Uint16Array, states: TStates, labelPaths: [number, TPoints][]) {
  const mode = options.stateLabelsMode || "auto";
  const lineGen = d3.line().curve(d3.curveBundle.beta(1));

  const textGroup = d3.select("g#labels > g#states");
  const pathGroup = d3.select("defs > g#deftemp > g#textPaths");

  const testLabel = textGroup.append("text").attr("x", 0).attr("x", 0).text("Example");
  const letterLength = testLabel.node()!.getComputedTextLength() / 7; // approximate length of 1 letter
  testLabel.remove();

  for (const [stateId, pathPoints] of labelPaths) {
    const state = states[stateId];
    if (!isState(state)) throw new Error("State must not be neutral");
    if (pathPoints.length < 2) throw new Error("Label path must have at least 2 points");

    textGroup.select("#textPath_stateLabel" + stateId).remove();
    pathGroup.select("#stateLabel" + stateId).remove();

    const textPath = pathGroup
      .append("path")
      .attr("d", round(lineGen(pathPoints)!))
      .attr("id", "textPath_stateLabel" + stateId);

    drawPath(round(lineGen(pathPoints)!), {stroke: "red", strokeWidth: 1});

    const pathLength = textPath.node()!.getTotalLength() / letterLength; // path length in letters
    const [lines, ratio] = getLinesAndRatio(mode, state.name, state.fullName, pathLength);

    // prolongate path if it's too short
    const longestLineLength = d3.max(lines.map(({length}) => length))!;
    if (pathLength && pathLength < longestLineLength) {
      const [x1, y1] = pathPoints.at(0)!;
      const [x2, y2] = pathPoints.at(-1)!;
      const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];

      const mod = longestLineLength / pathLength;
      pathPoints[0] = [x1 + dx - dx * mod, y1 + dy - dy * mod];
      pathPoints[pathPoints.length - 1] = [x2 - dx + dx * mod, y2 - dy + dy * mod];

      textPath.attr("d", round(lineGen(pathPoints)!));
      drawPath(round(lineGen(pathPoints)!), {stroke: "blue", strokeWidth: 0.4});
    }

    const textElement = textGroup
      .append("text")
      .attr("id", "stateLabel" + stateId)
      .append("textPath")
      .attr("startOffset", "50%")
      .attr("font-size", ratio + "%")
      .node()!;

    const top = (lines.length - 1) / -2; // y offset
    const spans = lines.map((line, index) => `<tspan x="0" dy="${index ? 1 : top}em">${line}</tspan>`);
    textElement.insertAdjacentHTML("afterbegin", spans.join(""));

    const {width, height} = textElement.getBBox();
    textElement.setAttribute("href", "#textPath_stateLabel" + stateId);

    if (mode === "full" || lines.length === 1) continue;

    // check if label fits state boundaries. If no, replace it with short name
    const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
    const angleRad = Math.atan2(y2 - y1, x2 - x1);

    const isInsideState = checkIfInsideState(textElement, angleRad, width / 2, height / 2, stateIds, stateId);
    if (isInsideState) continue;

    // replace name to one-liner
    const text = pathLength > state.fullName.length * 1.8 ? state.fullName : state.name;
    textElement.innerHTML = `<tspan x="0">${text}</tspan>`;

    const correctedRatio = minmax(rn((pathLength / text.length) * 60), 40, 130);
    textElement.setAttribute("font-size", correctedRatio + "%");
    textElement.setAttribute("fill", "blue");
  }
}

// point offset to reduce label overlap with state borders
function getOffsetWidth(cellsNumber: number) {
  if (cellsNumber < 80) return 0;
  if (cellsNumber < 140) return 5;
  if (cellsNumber < 200) return 15;
  if (cellsNumber < 300) return 20;
  if (cellsNumber < 500) return 25;
  return 30;
}

// difference between two angles in range [0, 180]
function getAnglesDif(angle1: number, angle2: number) {
  return 180 - Math.abs(Math.abs(angle1 - angle2) - 180);
}

// score multiplier based on angle difference betwee left and right sides
function getAngleModifier(angleDif: number) {
  if (angleDif === 0) return 1;
  if (angleDif <= 15) return 0.95;
  if (angleDif <= 30) return 0.9;
  if (angleDif <= 45) return 0.6;
  if (angleDif <= 60) return 0.3;
  if (angleDif <= 90) return 0.1;
  return 0; // >90
}

function precalculateAngles(step: number) {
  const angles = [];
  const RAD = Math.PI / 180;

  for (let angle = 0; angle < 360; angle += step) {
    const x = Math.cos(angle * RAD);
    const y = Math.sin(angle * RAD);
    const angleDif = 90 - Math.abs((angle % 180) - 90);
    const modifier = 1 - angleDif / 120; // [0.25, 1]
    angles.push({angle, modifier, x, y});
  }

  return angles;
}

function getLinesAndRatio(
  mode: "auto" | "short" | "full",
  name: string,
  fullName: string,
  pathLength: number
): [string[], number] {
  // short name
  if (mode === "short" || (mode === "auto" && pathLength <= name.length)) {
    const lines = splitInTwo(name);
    const longestLineLength = d3.max(lines.map(({length}) => length))!;
    const ratio = pathLength / longestLineLength;
    return [lines, minmax(rn(ratio * 60), 50, 150)];
  }

  // full name: one line
  if (pathLength > fullName.length * 2.5) {
    const lines = [fullName];
    const ratio = pathLength / lines[0].length;
    return [lines, minmax(rn(ratio * 70), 70, 170)];
  }

  // full name: two lines
  const lines = splitInTwo(fullName);
  const longestLineLength = d3.max(lines.map(({length}) => length))!;
  const ratio = pathLength / longestLineLength;
  return [lines, minmax(rn(ratio * 60), 70, 150)];
}

// check whether multi-lined label is mostly inside the state. If no, replace it with short name label
function checkIfInsideState(
  textElement: SVGTextPathElement,
  angleRad: number,
  halfwidth: number,
  halfheight: number,
  stateIds: Uint16Array,
  stateId: number
) {
  const bbox = textElement.getBBox();
  const [cx, cy] = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];

  const points: TPoints = [
    [-halfwidth, -halfheight],
    [+halfwidth, -halfheight],
    [+halfwidth, halfheight],
    [-halfwidth, halfheight],
    [0, halfheight],
    [0, -halfheight]
  ];

  const sin = Math.sin(angleRad);
  const cos = Math.cos(angleRad);
  const rotatedPoints: TPoints = points.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);

  drawPolyline([...rotatedPoints.slice(0, 4), rotatedPoints[0]], {stroke: "#333"});

  let pointsInside = 0;
  for (const [x, y] of rotatedPoints) {
    const isInside = stateIds[findCell(x, y)] === stateId;
    if (isInside) pointsInside++;
    drawPoint([x, y], {color: isInside ? "green" : "red"});
    if (pointsInside > 4) return true;
  }

  return false;
}
