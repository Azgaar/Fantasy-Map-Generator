import { curveNatural, line, max, select } from "d3";
import {
  checkIfLabelFitsState,
  generateStateLabelsData,
  getLinesAndRatio,
  type StateLabel,
} from "../modules/labels-generator";
import { minmax, rn, round } from "../utils";

declare global {
  var drawStateLabels: (list?: number[]) => void;
}

// list - an optional array of stateIds to regenerate
const stateLabelsRenderer = (list?: number[]): void => {
  TIME && console.time("drawStateLabels");

  // temporary make the labels visible
  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const { cells, states } = pack;
  const stateIds = cells.state;

  // Initialize pack.labels if needed
  if (!pack.labels) pack.labels = [];

  // Clear existing state labels from pack.labels if regenerating all
  if (!list) {
    pack.labels = pack.labels.filter((label) => label.type !== "state");
  } else {
    // Collect label IDs to remove
    const labelsToRemove = list.map((stateId) => `stateLabel${stateId}`);
    // Clear specific state labels in a single filter operation
    pack.labels = pack.labels.filter((l) => !labelsToRemove.includes(l.i));
  }

  // Generate label data using the generator
  const generatedLabels = generateStateLabelsData(list);

  // Render and refine labels
  const letterLength = checkExampleLetterLength();
  const refinedLabels = renderAndRefineLabels(generatedLabels, letterLength);

  // Store refined labels in pack.labels
  pack.labels.push(...refinedLabels);

  // restore labels visibility
  labels.style("display", layerDisplay);

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

  function renderAndRefineLabels(
    labels: StateLabel[],
    letterLength: number,
  ): StateLabel[] {
    const mode = options.stateLabelsMode || "auto";
    const lineGen = line<[number, number]>().curve(curveNatural);
    const textGroup = select<SVGGElement, unknown>("g#labels > g#states");
    const pathGroup = select<SVGGElement, unknown>(
      "defs > g#deftemp > g#textPaths",
    );
    const refinedLabels: typeof labels = [];

    for (const label of labels) {
      const state = states[label.stateId];
      if (!state.i || state.removed) continue;

      const pathPoints = label.points;
      if (pathPoints.length < 2) continue;

      textGroup.select(`#${label.i}`).remove();
      pathGroup.select(`#textPath_${label.i}`).remove();

      const textPath = pathGroup
        .append("path")
        .attr("d", round(lineGen(pathPoints) || ""))
        .attr("id", `textPath_${label.i}`);

      const pathLength =
        (textPath.node() as SVGPathElement).getTotalLength() / letterLength;
      const [lines, ratio] = getLinesAndRatio(
        mode,
        state.name!,
        state.fullName!,
        pathLength,
      );

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
        .attr("id", label.i)
        .append("textPath")
        .attr("startOffset", "50%")
        .attr("font-size", `${ratio}%`)
        .node() as SVGTextPathElement;

      const top = (lines.length - 1) / -2;
      const spans = lines.map(
        (lineText, index) =>
          `<tspan x="0" dy="${index ? 1 : top}em">${lineText}</tspan>`,
      );
      textElement.insertAdjacentHTML("afterbegin", spans.join(""));

      const { width, height } = textElement.getBBox();
      textElement.setAttribute("href", `#textPath_${label.i}`);

      let finalName = lines.join("|");
      let finalRatio = ratio;

      if (mode !== "full" && lines.length > 1) {
        const [[x1, y1], [x2, y2]] = [pathPoints.at(0)!, pathPoints.at(-1)!];
        const angleRad = Math.atan2(y2 - y1, x2 - x1);

        const isInsideState = checkIfLabelFitsState(
          textElement,
          angleRad,
          width / 2,
          height / 2,
          stateIds,
          label.stateId,
        );

        if (!isInsideState) {
          const text =
            pathLength > state.fullName!.length * 1.8
              ? state.fullName!
              : state.name!;
          textElement.innerHTML = `<tspan x="0">${text}</tspan>`;

          const correctedRatio = minmax(
            rn((pathLength / text.length) * 50),
            50,
            130,
          );
          textElement.setAttribute("font-size", `${correctedRatio}%`);
          finalName = text;
          finalRatio = correctedRatio;
        }
      }

      refinedLabels.push({
        ...label,
        name: finalName,
        fontSize: finalRatio,
        points: pathPoints,
      });
    }

    return refinedLabels;
  }

  TIME && console.timeEnd("drawStateLabels");
};

window.drawStateLabels = stateLabelsRenderer;
