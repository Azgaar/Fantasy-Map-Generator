import * as d3 from "d3";

import {findCell} from "utils/graphUtils";
import {isState} from "utils/typeUtils";
import {drawPath, drawPoint} from "utils/debugUtils";

export function drawLabels() {
  /* global */ const {cells, vertices, features, states, burgs} = pack;
  /* global: findCell, graphWidth, graphHeight */

  drawStateLabels(cells, features, states, vertices);
  // drawBurgLabels(burgs);
  // TODO: draw other labels

  window.Zoom.invoke();
}

function drawBurgLabels(burgs: TBurgs) {
  // remove old data
  burgLabels.selectAll("text").remove();

  const validBurgs = burgs.filter(burg => burg.i && !(burg as IBurg).removed) as IBurg[];

  // capitals
  const capitals = validBurgs.filter(burg => burg.capital);
  const capitalSize = Number(burgIcons.select("#cities").attr("size")) || 1;

  burgLabels
    .select("#cities")
    .selectAll("text")
    .data(capitals)
    .enter()
    .append("text")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${capitalSize * -1.5}px`)
    .text(d => d.name);

  // towns
  const towns = validBurgs.filter(burg => !burg.capital);
  const townSize = Number(burgIcons.select("#towns").attr("size")) || 0.5;

  burgLabels
    .select("#towns")
    .selectAll("text")
    .data(towns)
    .enter()
    .append("text")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${townSize * -1.5}px`)
    .text(d => d.name);
}

function drawStateLabels(cells: IPack["cells"], features: TPackFeatures, states: TStates, vertices: IGraphVertices) {
  console.time("drawStateLabels");
  const lineGen = d3.line().curve(d3.curveBundle.beta(1));
  const mode = options.stateLabelsMode || "auto";

  // increase step to increase performarce and make more horyzontal, decrease to increase accuracy
  const STEP = 9;
  const raycast = precalculateAngles(STEP);

  const INITIAL_DISTANCE = 5;
  const DISTANCE_STEP = 15;
  const MAX_ITERATIONS = 100;

  const labelPaths = getLabelPaths();

  function getLabelPaths() {
    const labelPaths: [number, TPoints][] = [];
    const lineGen = d3.line().curve(d3.curveBundle.beta(1));

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
          const distance1 = getMaxDistance(state.i, point1, dx, dy);

          const point2 = offsetPoints.get(angle - 90 < 0 ? angle + 270 : angle - 90)!;
          const distance2 = getMaxDistance(state.i, point2, dx, dy);
          distanceMin = Math.min(distance1, distance2);
        } else {
          distanceMin = getMaxDistance(state.i, {x: x0, y: y0}, dx, dy);
        }

        const [x, y] = [x0 + distanceMin * dx, y0 + distanceMin * dy];
        return {angle, distance: distanceMin * modifier, x, y};
      });

      const {angle, x, y} = distances.reduce(
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

      drawPath(lineGen([[x, y], state.pole, [x2, y2]])!, {stroke: "red", strokeWidth: 1});

      const pathPoints: TPoints = [];
      labelPaths.push([state.i, pathPoints]);
    }

    return labelPaths;
  }

  function getMaxDistance(stateId: number, point: {x: number; y: number}, dx: number, dy: number) {
    let distance = INITIAL_DISTANCE;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const [x, y] = [point.x + distance * dx, point.y + distance * dy];
      const cellId = findCell(x, y);

      // const inside = cells.state[cellId] === stateId;
      // drawPoint([x, y], {color: inside ? "blue" : "red", radius: 1});

      if (cells.state[cellId] !== stateId) break;
      distance += DISTANCE_STEP;
    }

    return distance;
  }

  console.timeEnd("drawStateLabels");
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
  const RAD = Math.PI / 180;
  const angles = [];

  for (let angle = 0; angle < 360; angle += step) {
    const x = Math.cos(angle * RAD);
    const y = Math.sin(angle * RAD);
    const angleDif = 90 - Math.abs((angle % 180) - 90);
    const modifier = 1 - angleDif / 120; // [0.25, 1]
    angles.push({angle, modifier, x, y});
  }

  return angles;
}
