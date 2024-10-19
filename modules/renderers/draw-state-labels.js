"use strict";

// list - an optional array of stateIds to regenerate
function drawStateLabels(list) {
  TIME && console.time("drawStateLabels");

  // temporary make the labels visible
  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const {cells, states, features} = pack;
  const stateIds = cells.state;

  // increase step to 15 or 30 to make it faster and more horyzontal
  // decrease step to 5 to improve accuracy
  const ANGLE_STEP = 9;
  const angles = precalculateAngles(ANGLE_STEP);

  const LENGTH_START = 5;
  const LENGTH_STEP = 5;
  const LENGTH_MAX = 300;

  const labelPaths = getLabelPaths();
  const letterLength = checkExampleLetterLength();
  drawLabelPath(letterLength);

  // restore labels visibility
  labels.style("display", layerDisplay);

  function getLabelPaths() {
    const labelPaths = [];

    for (const state of states) {
      if (!state.i || state.removed || state.lock) continue;
      if (list && !list.includes(state.i)) continue;

      const offset = getOffsetWidth(state.cells);
      const maxLakeSize = state.cells / 20;
      const [x0, y0] = state.pole;

      const rays = angles.map(({angle, dx, dy}) => {
        const {length, x, y} = raycast({stateId: state.i, x0, y0, dx, dy, maxLakeSize, offset});
        return {angle, length, x, y};
      });
      const [ray1, ray2] = findBestRayPair(rays);

      const pathPoints = [[ray1.x, ray1.y], state.pole, [ray2.x, ray2.y]];
      if (ray1.x > ray2.x) pathPoints.reverse();

      DEBUG && drawPoint(state.pole, {color: "black", radius: 1});
      DEBUG && drawPath(pathPoints, {color: "black", width: 0.2});

      labelPaths.push([state.i, pathPoints]);
    }

    return labelPaths;
  }

  function checkExampleLetterLength() {
    const textGroup = d3.select("g#labels > g#states");
    const testLabel = textGroup.append("text").attr("x", 0).attr("y", 0).text("Example");
    const letterLength = testLabel.node().getComputedTextLength() / 7; // approximate length of 1 letter
    testLabel.remove();

    return letterLength;
  }

  function drawLabelPath(letterLength) {
    const mode = options.stateLabelsMode || "auto";
    const lineGen = d3.line().curve(d3.curveNatural);

    const textGroup = d3.select("g#labels > g#states");
    const pathGroup = d3.select("defs > g#deftemp > g#textPaths");

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

      const correctedRatio = minmax(rn((pathLength / text.length) * 50), 50, 130);
      textElement.setAttribute("font-size", correctedRatio + "%");
    }
  }

  function getOffsetWidth(cellsNumber) {
    if (cellsNumber < 40) return 0;
    if (cellsNumber < 200) return 5;
    return 10;
  }

  function precalculateAngles(step) {
    const angles = [];
    const RAD = Math.PI / 180;

    for (let angle = 0; angle < 360; angle += step) {
      const dx = Math.cos(angle * RAD);
      const dy = Math.sin(angle * RAD);
      angles.push({angle, dx, dy});
    }

    return angles;
  }

  function raycast({stateId, x0, y0, dx, dy, maxLakeSize, offset}) {
    let ray = {length: 0, x: x0, y: y0};

    for (let length = LENGTH_START; length < LENGTH_MAX; length += LENGTH_STEP) {
      const [x, y] = [x0 + length * dx, y0 + length * dy];
      // offset points are perpendicular to the ray
      const offset1 = [x + -dy * offset, y + dx * offset];
      const offset2 = [x + dy * offset, y + -dx * offset];

      DEBUG && drawPoint([x, y], {color: isInsideState(x, y) ? "blue" : "red", radius: 0.8});
      DEBUG && drawPoint(offset1, {color: isInsideState(...offset1) ? "blue" : "red", radius: 0.4});
      DEBUG && drawPoint(offset2, {color: isInsideState(...offset2) ? "blue" : "red", radius: 0.4});

      const inState = isInsideState(x, y) && isInsideState(...offset1) && isInsideState(...offset2);
      if (!inState) break;
      ray = {length, x, y};
    }

    return ray;

    function isInsideState(x, y) {
      if (x < 0 || x > graphWidth || y < 0 || y > graphHeight) return false;
      const cellId = findCell(x, y);

      const feature = features[cells.f[cellId]];
      if (feature.type === "lake") return isInnerLake(feature) || isSmallLake(feature);

      return stateIds[cellId] === stateId;
    }

    function isInnerLake(feature) {
      return feature.shoreline.every(cellId => stateIds[cellId] === stateId);
    }

    function isSmallLake(feature) {
      return feature.cells <= maxLakeSize;
    }
  }

  function findBestRayPair(rays) {
    let bestPair = null;
    let bestScore = -Infinity;

    for (let i = 0; i < rays.length; i++) {
      const score1 = rays[i].length * scoreRayAngle(rays[i].angle);

      for (let j = i + 1; j < rays.length; j++) {
        const score2 = rays[j].length * scoreRayAngle(rays[j].angle);
        const pairScore = (score1 + score2) * scoreCurvature(rays[i].angle, rays[j].angle);

        if (pairScore > bestScore) {
          bestScore = pairScore;
          bestPair = [rays[i], rays[j]];
        }
      }
    }

    return bestPair;
  }

  function scoreRayAngle(angle) {
    const normalizedAngle = Math.abs(angle % 180); // [0, 180]
    const horizontality = Math.abs(normalizedAngle - 90) / 90; // [0, 1]

    if (horizontality === 1) return 1; // Best: horizontal
    if (horizontality >= 0.75) return 0.9; // Very good: slightly slanted
    if (horizontality >= 0.5) return 0.6; // Good: moderate slant
    if (horizontality >= 0.25) return 0.5; // Acceptable: more slanted
    if (horizontality >= 0.15) return 0.2; // Poor: almost vertical
    return 0.1; // Very poor: almost vertical
  }

  function scoreCurvature(angle1, angle2) {
    const delta = getAngleDelta(angle1, angle2);
    const similarity = evaluateArc(angle1, angle2);

    if (delta === 180) return 1; // straight line: best
    if (delta < 90) return 0; // acute: not allowed
    if (delta < 120) return 0.6 * similarity;
    if (delta < 140) return 0.7 * similarity;
    if (delta < 160) return 0.8 * similarity;

    return similarity;
  }

  function getAngleDelta(angle1, angle2) {
    let delta = Math.abs(angle1 - angle2) % 360;
    if (delta > 180) delta = 360 - delta; // [0, 180]
    return delta;
  }

  // compute arc similarity towards x-axis
  function evaluateArc(angle1, angle2) {
    const proximity1 = Math.abs((angle1 % 180) - 90);
    const proximity2 = Math.abs((angle2 % 180) - 90);
    return 1 - Math.abs(proximity1 - proximity2) / 90;
  }

  function getLinesAndRatio(mode, name, fullName, pathLength) {
    if (mode === "short") return getShortOneLine();
    if (pathLength > fullName.length * 2) return getFullOneLine();
    return getFullTwoLines();

    function getShortOneLine() {
      const ratio = pathLength / name.length;
      return [[name], minmax(rn(ratio * 60), 50, 150)];
    }

    function getFullOneLine() {
      const ratio = pathLength / fullName.length;
      return [[fullName], minmax(rn(ratio * 70), 70, 170)];
    }

    function getFullTwoLines() {
      const lines = splitInTwo(fullName);
      const longestLineLength = d3.max(lines.map(({length}) => length));
      const ratio = pathLength / longestLineLength;
      return [lines, minmax(rn(ratio * 60), 70, 150)];
    }
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

  TIME && console.timeEnd("drawStateLabels");
}
