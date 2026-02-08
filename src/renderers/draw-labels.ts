import { curveNatural, line } from "d3";
import type { Label } from "../modules/labels-generator";

declare global {
  var drawLabels: () => void;
  var drawLabel: (label: Label) => void;
  var removeLabel: (labelId: string) => void;
}

export type { Label } from "../modules/labels-generator";

// Main label renderer
const labelsRenderer = (): void => {
  TIME && console.time("drawLabels");

  // Render all labels from pack.labels
  if (pack.labels && pack.labels.length > 0) {
    pack.labels.forEach((label) => {
      drawLabelRenderer(label);
    });
  }

  TIME && console.timeEnd("drawLabels");
};

// Single label renderer
const drawLabelRenderer = (label: Label): void => {
  if (label.type === "burg") {
    drawBurgLabelFromData(label);
  } else if (label.type === "state") {
    drawStateLabelFromData(label);
  } else if (label.type === "custom") {
    drawCustomLabelFromData(label);
  }
};

// Remove a label by its ID
const removeLabelRenderer = (labelId: string): void => {
  const existingLabel = document.getElementById(labelId);
  if (existingLabel) existingLabel.remove();

  // Remove associated textPath if it exists
  const textPath = document.getElementById(`textPath_${labelId}`);
  if (textPath) textPath.remove();
};

// Render burg label from label data
function drawBurgLabelFromData(label: Label): void {
  if (label.type !== "burg") return;

  const burg = pack.burgs[label.burgId];
  if (!burg || burg.removed) return;

  const group = label.group || burg.group || "town";
  const labelGroup = burgLabels.select<SVGGElement>(`#${group}`);
  if (labelGroup.empty()) return;

  const dx = labelGroup.attr("data-dx") || 0;
  const dy = labelGroup.attr("data-dy") || 0;

  removeLabelRenderer(label.i);
  labelGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", label.i)
    .attr("data-id", label.burgId)
    .attr("x", burg.x)
    .attr("y", burg.y)
    .attr("dx", `${dx}em`)
    .attr("dy", `${dy}em`)
    .text(label.name);
}

// Render state label from label data
function drawStateLabelFromData(label: Label): void {
  if (label.type !== "state") return;
  if (!label.points || label.points.length < 2) return;

  const state = pack.states[label.stateId];
  if (!state || state.removed) return;

  const textGroup = labels.select<SVGGElement>("g#labels > g#states");
  const pathGroup = defs.select<SVGGElement>("g#deftemp > g#textPaths");

  removeLabelRenderer(label.i);

  // Create the path for the text
  const lineGen = line<[number, number]>().curve(curveNatural);
  const pathData = lineGen(label.points);
  if (!pathData) return;

  pathGroup
    .append("path")
    .attr("d", pathData)
    .attr("id", `textPath_${label.i}`);

  const textElement = textGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", label.i);

  if (label.transform) {
    textElement.attr("transform", label.transform);
  }

  const textPathElement = textElement
    .append("textPath")
    .attr("startOffset", `${label.startOffset || 50}%`)
    .attr("href", `#textPath_${label.i}`)
    .node() as SVGTextPathElement;

  if (label.fontSize) {
    textPathElement.setAttribute("font-size", `${label.fontSize}%`);
  }

  if (label.letterSpacing) {
    textPathElement.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  }

  // Parse multi-line labels
  const lines = label.name.split("|");
  if (lines.length > 1) {
    const top = (lines.length - 1) / -2;
    const spans = lines.map(
      (lineText, index) =>
        `<tspan x="0" dy="${index ? 1 : top}em">${lineText}</tspan>`,
    );
    textPathElement.insertAdjacentHTML("afterbegin", spans.join(""));
  } else {
    textPathElement.innerHTML = `<tspan x="0">${label.name}</tspan>`;
  }
}

// Render custom label from label data
function drawCustomLabelFromData(label: Label): void {
  if (label.type !== "custom") return;
  if (!label.points || label.points.length < 2) return;

  const group = label.group || "addedLabels";
  const textGroup = labels.select<SVGGElement>(`g#labels > g#${group}`);
  if (textGroup.empty()) return;

  const pathGroup = defs.select<SVGGElement>("g#deftemp > g#textPaths");

  removeLabelRenderer(label.i);

  // Create the path for the text
  const lineGen = line<[number, number]>().curve(curveNatural);
  const pathData = lineGen(label.points);
  if (!pathData) return;

  pathGroup
    .append("path")
    .attr("d", pathData)
    .attr("id", `textPath_${label.i}`);

  const textElement = textGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", label.i);

  if (label.transform) {
    textElement.attr("transform", label.transform);
  }

  const textPathElement = textElement
    .append("textPath")
    .attr("startOffset", `${label.startOffset || 50}%`)
    .attr("href", `#textPath_${label.i}`)
    .node() as SVGTextPathElement;

  if (label.fontSize) {
    textPathElement.setAttribute("font-size", `${label.fontSize}%`);
  }

  if (label.letterSpacing) {
    textPathElement.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  }

  // Parse multi-line labels
  const lines = label.name.split("|");
  if (lines.length > 1) {
    const top = (lines.length - 1) / -2;
    const spans = lines.map(
      (lineText, index) =>
        `<tspan x="0" dy="${index ? 1 : top}em">${lineText}</tspan>`,
    );
    textPathElement.insertAdjacentHTML("afterbegin", spans.join(""));
  } else {
    textPathElement.innerHTML = `<tspan x="0">${label.name}</tspan>`;
  }
}

window.drawLabels = labelsRenderer;
window.drawLabel = drawLabelRenderer;
window.removeLabel = removeLabelRenderer;
