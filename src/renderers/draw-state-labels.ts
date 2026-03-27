import { curveNatural, line, max, select } from "d3";
import type { StateLabelData } from "../modules/labels";
import { findClosestCell, minmax, rn, round, splitInTwo } from "../utils";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";

declare global {
  var drawStateLabels: (list?: number[]) => void;
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
  const testLabel = textGroup
    .append("text")
    .attr("x", 0)
    .attr("y", 0)
    .text("Example");
  const letterLength =
    (testLabel.node() as SVGTextElement).getComputedTextLength() / 7; // approximate length of 1 letter
  testLabel.remove();

  return letterLength;
}

/**
 * Render state labels from pack.labels data to SVG.
 * Adjusts and fits labels based on layout constraints.
 * list - optional array of stateIds to re-render
 */
const stateLabelsRenderer = (list?: number[]): void => {
  TIME && console.time("drawStateLabels");

  // temporary make the labels visible
  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const { states } = pack;

  // Get labels to render
  const labelsToRender: StateLabelData[] =
    list && list.length > 0
      ? list
          .map((idx) => Labels.get(idx))
          .filter((label) => label?.type === "state")
      : Labels.getAll().filter((label) => label.type === "state");

  const letterLength = checkExampleLetterLength();
  drawLabelPath(letterLength, labelsToRender);

  // restore labels visibility
  labels.style("display", layerDisplay);

  function drawLabelPath(
    letterLength: number,
    labelDataList: StateLabelData[],
  ): void {
    const mode = options.stateLabelsMode || "auto";
    const lineGen = line<[number, number]>().curve(curveNatural);

    const textGroup = select<SVGGElement, unknown>("g#labels > g#states");
    const pathGroup = select<SVGGElement, unknown>(
      "defs > g#deftemp > g#textPaths",
    );

    for (const labelData of labelDataList) {
      const state = states[labelData.stateId];
      if (!state.i || state.removed) continue;

      // Calculate pathPoints using raycast algorithm (recalculated on each draw)
      const offset = getOffsetWidth(state.cells!);
      const maxLakeSize = state.cells! / 20;
      const [x0, y0] = state.pole!;

      const rays = ANGLES.map(({ angle, dx, dy }) => {
        const { length, x, y } = raycast({
          stateId: state.i,
          x0,
          y0,
          dx,
          dy,
          maxLakeSize,
          offset,
        });
        return { angle, length, x, y };
      });
      const [ray1, ray2] = findBestRayPair(rays);

      const pathPoints: [number, number][] = [
        [ray1.x, ray1.y],
        state.pole!,
        [ray2.x, ray2.y],
      ];
      if (ray1.x > ray2.x) pathPoints.reverse();

      textGroup.select(`#stateLabel${labelData.stateId}`).remove();
      pathGroup.select(`#textPath_stateLabel${labelData.stateId}`).remove();

      const textPath = pathGroup
        .append("path")
        .attr("d", round(lineGen(pathPoints) || ""))
        .attr("id", `textPath_stateLabel${labelData.stateId}`);

      const pathLength =
        (textPath.node() as SVGPathElement).getTotalLength() / letterLength; // path length in letters
      const [lines, ratio] = getLinesAndRatio(
        mode,
        state.name!,
        state.fullName!,
        pathLength,
      );

      // Update label data with font size
      Labels.updateLabel(labelData.i, { fontSize: ratio });

      // prolongate path if it's too short
      const longestLineLength = max(lines.map((line) => line.length)) || 0;
      if (pathLength && pathLength < longestLineLength) {
        const [x1, y1] = pathPoints.at(0)!;
        const [x2, y2] = pathPoints.at(-1)!;
        const [dx, dy] = [(x2 - x1) / 2, (y2 - y1) / 2];

        const mod = longestLineLength / pathLength;
        pathPoints[0] = [x1 + dx - dx * mod, y1 + dy - dy * mod];
        pathPoints[pathPoints.length - 1] = [
          x2 - dx + dx * mod,
          y2 - dy + dy * mod,
        ];

        textPath.attr("d", round(lineGen(pathPoints) || ""));
      }

      const textElement = textGroup
        .append("text")
        .attr("text-rendering", "optimizeSpeed")
        .attr("id", `stateLabel${labelData.stateId}`)
        .append("textPath")
        .attr("startOffset", "50%")
        .attr("font-size", `${ratio}%`)
        .node() as SVGTextPathElement;

      const top = (lines.length - 1) / -2; // y offset
      const spans = lines.map(
        (lineText, index) =>
          `<tspan x="0" dy="${index ? 1 : top}em">${lineText}</tspan>`,
      );
      textElement.insertAdjacentHTML("afterbegin", spans.join(""));

      const { width, height } = textElement.getBBox();
      textElement.setAttribute(
        "href",
        `#textPath_stateLabel${labelData.stateId}`,
      );

      const stateIds = pack.cells.state;
      if (mode === "full" || lines.length === 1) continue;

      // check if label fits state boundaries. If no, replace it with short name
      const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
      const angleRad = Math.atan2(y2 - y1, x2 - x1);

      const isInsideState = checkIfInsideState(
        textElement,
        angleRad,
        width / 2,
        height / 2,
        stateIds,
        labelData.stateId,
      );
      if (isInsideState) continue;

      // replace name to one-liner
      const text =
        pathLength > state.fullName!.length * 1.8
          ? state.fullName!
          : state.name!;
      textElement.innerHTML = `<tspan x="0">${text}</tspan>`;
      Labels.updateLabel(labelData.i, { text });

      const correctedRatio = minmax(
        rn((pathLength / text.length) * 50),
        50,
        130,
      );
      textElement.setAttribute("font-size", `${correctedRatio}%`);
      Labels.updateLabel(labelData.i, { fontSize: correctedRatio });
    }
  }

  function getLinesAndRatio(
    mode: string,
    name: string,
    fullName: string,
    pathLength: number,
  ): [string[], number] {
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
      const longestLineLength = max(lines.map((line) => line.length)) || 0;
      const ratio = pathLength / longestLineLength;
      return [lines, minmax(rn(ratio * 60), 70, 150)];
    }
  }

  // check whether multi-lined label is mostly inside the state. If no, replace it with short name label
  function checkIfInsideState(
    textElement: SVGTextPathElement,
    angleRad: number,
    halfwidth: number,
    halfheight: number,
    stateIds: number[],
    stateId: number,
  ): boolean {
    const bbox = textElement.getBBox();
    const [cx, cy] = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];

    const points: [number, number][] = [
      [-halfwidth, -halfheight],
      [+halfwidth, -halfheight],
      [+halfwidth, halfheight],
      [-halfwidth, halfheight],
      [0, halfheight],
      [0, -halfheight],
    ];

    const sin = Math.sin(angleRad);
    const cos = Math.cos(angleRad);
    const rotatedPoints = points.map(([x, y]): [number, number] => [
      cx + x * cos - y * sin,
      cy + x * sin + y * cos,
    ]);

    let pointsInside = 0;
    for (const [x, y] of rotatedPoints) {
      const isInside =
        stateIds[findClosestCell(x, y, undefined, pack) as number] === stateId;
      if (isInside) pointsInside++;
      if (pointsInside > 4) return true;
    }

    return false;
  }

  TIME && console.timeEnd("drawStateLabels");
};

window.drawStateLabels = stateLabelsRenderer;
