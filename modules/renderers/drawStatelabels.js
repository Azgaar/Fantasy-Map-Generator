"use strict";

// list - an optional array of stateIds to regenerate
function drawStateLabels(list) {
  console.time("drawStateLabels");

  const {cells, states, features} = pack;
  const stateIds = cells.state;

  // increase step to 15 or 30 to make it faster and more horyzontal
  // decrease step to 5 to improve accuracy
  const ANGLE_STEP = 9;
  const raycast = precalculateAngles(ANGLE_STEP);

  const INITIAL_DISTANCE = 10;
  const DISTANCE_STEP = 15;
  const MAX_ITERATIONS = 100;

  const labelPaths = getLabelPaths();
  drawLabelPath();

  function getLabelPaths() {
    const labelPaths = [];

    for (const state of states) {
      if (!state.i || state.removed || state.lock) continue;
      if (list && !list.includes(state.i)) continue;

      const offset = getOffsetWidth(state.cells);
      const maxLakeSize = state.cells / 50;
      const [x0, y0] = state.pole;

      const offsetPoints = new Map(
        (offset ? raycast : []).map(({angle, x: x1, y: y1}) => {
          const [x, y] = [x0 + offset * x1, y0 + offset * y1];
          return [angle, {x, y}];
        })
      );

      const distances = raycast.map(({angle, x: dx, y: dy, modifier}) => {
        let distanceMin;
        const distance1 = getMaxDistance(state.i, {x: x0, y: y0}, dx, dy, maxLakeSize);

        if (offset) {
          const point2 = offsetPoints.get(angle - 90 < 0 ? angle + 270 : angle - 90);
          const distance2 = getMaxDistance(state.i, point2, dx, dy, maxLakeSize);

          const point3 = offsetPoints.get(angle + 90 >= 360 ? angle - 270 : angle + 90);
          const distance3 = getMaxDistance(state.i, point3, dx, dy, maxLakeSize);

          distanceMin = Math.min(distance1, distance2, distance3);
        } else {
          distanceMin = distance1;
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

      const pathPoints = [[x1, y1], state.pole, [x2, y2]];
      if (x1 > x2) pathPoints.reverse();
      labelPaths.push([state.i, pathPoints]);
    }

    return labelPaths;

    function getMaxDistance(stateId, point, dx, dy, maxLakeSize) {
      let distance = INITIAL_DISTANCE;

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const [x, y] = [point.x + distance * dx, point.y + distance * dy];
        const cellId = findCell(x, y, DISTANCE_STEP);

        // drawPoint([x, y], {color: cellId && isPassable(cellId) ? "blue" : "red", radius: 0.8});

        if (!cellId || !isPassable(cellId)) break;
        distance += DISTANCE_STEP;
      }

      return distance;

      function isPassable(cellId) {
        const feature = features[cells.f[cellId]];
        if (feature.type === "lake") return feature.cells <= maxLakeSize;
        return stateIds[cellId] === stateId;
      }
    }
  }

  function drawLabelPath() {
    const mode = options.stateLabelsMode || "auto";
    const lineGen = d3.line().curve(d3.curveBundle.beta(1));

    const textGroup = d3.select("g#labels > g#states");
    const pathGroup = d3.select("defs > g#deftemp > g#textPaths");

    const testLabel = textGroup.append("text").attr("x", 0).attr("y", 0).text("Example");
    const letterLength = testLabel.node().getComputedTextLength() / 7; // approximate length of 1 letter
    testLabel.remove();

    for (const [stateId, pathPoints] of labelPaths) {
      const state = states[stateId];
      if (!state.i || state.removed) throw new Error("State must not be neutral or removed");
      if (pathPoints.length < 2) throw new Error("Label path must have at least 2 points");

      textGroup.select("#stateLabel" + stateId).remove();
      pathGroup.select("#textPath_stateLabel" + stateId).remove();

      const textPath = pathGroup
        .append("path")
        .attr("d", round(lineGen(pathPoints)))
        .attr("id", "textPath_stateLabel" + stateId);

      const pathLength = textPath.node().getTotalLength() / letterLength; // path length in letters
      const [lines, ratio] = getLinesAndRatio(mode, state.name, state.fullName, pathLength);

      // prolongate path if it's too short
      const longestLineLength = d3.max(lines.map(({length}) => length));
      if (pathLength && pathLength < longestLineLength) {
        const [x1, y1] = pathPoints.at(0);
        const [x2, y2] = pathPoints.at(-1);
        const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];

        const mod = longestLineLength / pathLength;
        pathPoints[0] = [x1 + dx - dx * mod, y1 + dy - dy * mod];
        pathPoints[pathPoints.length - 1] = [x2 - dx + dx * mod, y2 - dy + dy * mod];

        textPath.attr("d", round(lineGen(pathPoints)));
      }

      const textElement = textGroup
        .append("text")
        .attr("id", "stateLabel" + stateId)
        .append("textPath")
        .attr("startOffset", "50%")
        .attr("font-size", ratio + "%")
        .node();

      const top = (lines.length - 1) / -2; // y offset
      const spans = lines.map((line, index) => `<tspan x="0" dy="${index ? 1 : top}em">${line}</tspan>`);
      textElement.insertAdjacentHTML("afterbegin", spans.join(""));

      const {width, height} = textElement.getBBox();
      textElement.setAttribute("href", "#textPath_stateLabel" + stateId);

      if (mode === "full" || lines.length === 1) continue;

      // check if label fits state boundaries. If no, replace it with short name
      const [[x1, y1], [x2, y2]] = [pathPoints.at(0), pathPoints.at(-1)];
      const angleRad = Math.atan2(y2 - y1, x2 - x1);

      const isInsideState = checkIfInsideState(textElement, angleRad, width / 2, height / 2, stateIds, stateId);
      if (isInsideState) continue;

      // replace name to one-liner
      const text = pathLength > state.fullName.length * 1.8 ? state.fullName : state.name;
      textElement.innerHTML = `<tspan x="0">${text}</tspan>`;

      const correctedRatio = minmax(rn((pathLength / text.length) * 50), 40, 130);
      textElement.setAttribute("font-size", correctedRatio + "%");
    }
  }

  // point offset to reduce label overlap with state borders
  function getOffsetWidth(cellsNumber) {
    if (cellsNumber < 80) return 0;
    if (cellsNumber < 140) return 5;
    if (cellsNumber < 200) return 15;
    if (cellsNumber < 300) return 20;
    if (cellsNumber < 500) return 25;
    return 30;
  }

  // difference between two angles in range [0, 180]
  function getAnglesDif(angle1, angle2) {
    return 180 - Math.abs(Math.abs(angle1 - angle2) - 180);
  }

  // score multiplier based on angle difference betwee left and right sides
  function getAngleModifier(angleDif) {
    if (angleDif === 0) return 1;
    if (angleDif <= 15) return 0.95;
    if (angleDif <= 30) return 0.9;
    if (angleDif <= 45) return 0.6;
    if (angleDif <= 60) return 0.3;
    if (angleDif <= 90) return 0.1;
    return 0; // >90
  }

  function precalculateAngles(step) {
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

  function getLinesAndRatio(mode, name, fullName, pathLength) {
    // short name
    if (mode === "short" || (mode === "auto" && pathLength <= name.length)) {
      const lines = splitInTwo(name);
      const longestLineLength = d3.max(lines.map(({length}) => length));
      const ratio = pathLength / longestLineLength;
      return [lines, minmax(rn(ratio * 60), 50, 150)];
    }

    // full name: one line
    if (pathLength > fullName.length * 2) {
      const lines = [fullName];
      const ratio = pathLength / lines[0].length;
      return [lines, minmax(rn(ratio * 70), 70, 170)];
    }

    // full name: two lines
    const lines = splitInTwo(fullName);
    const longestLineLength = d3.max(lines.map(({length}) => length));
    const ratio = pathLength / longestLineLength;
    return [lines, minmax(rn(ratio * 60), 70, 150)];
  }

  // check whether multi-lined label is mostly inside the state. If no, replace it with short name label
  function checkIfInsideState(textElement, angleRad, halfwidth, halfheight, stateIds, stateId) {
    const bbox = textElement.getBBox();
    const [cx, cy] = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];

    const points = [
      [-halfwidth, -halfheight],
      [+halfwidth, -halfheight],
      [+halfwidth, halfheight],
      [-halfwidth, halfheight],
      [0, halfheight],
      [0, -halfheight]
    ];

    const sin = Math.sin(angleRad);
    const cos = Math.cos(angleRad);
    const rotatedPoints = points.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);

    let pointsInside = 0;
    for (const [x, y] of rotatedPoints) {
      const isInside = stateIds[findCell(x, y)] === stateId;
      if (isInside) pointsInside++;
      if (pointsInside > 4) return true;
    }

    return false;
  }

  console.timeEnd("drawStateLabels");
}
