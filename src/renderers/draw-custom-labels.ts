import { curveNatural, line } from "d3";
import type { CustomLabel } from "../modules/labels";

// remove this section once layer.js is refactored--------------------------------
declare global {
  var drawCustomLabels: () => void;
}

window.drawCustomLabels = customLabelRenderer;
// -------------------------------------------------------------------------------

export function customLabelRenderer() {
  const customLabels = Labels.getAll().filter(
    (labels) => labels.type === "custom",
  );
  const customLabelsHTML: string[] = [];
  const pathGroup = defs.select<SVGGElement>("g#deftemp > g#textPaths");
  for (const labelData of customLabels) {
    const pathId = addPathForLabel(labelData, pathGroup.node()!);
    customLabelsHTML.push(constructLabelHTML(labelData, pathId).outerHTML);
  }

  const customLabelsGroup = labels.select<SVGGElement>(`#addedLabels`);
  const groupNode = customLabelsGroup.node();
  if (groupNode) {
    groupNode.innerHTML = customLabelsHTML.join("");
  }
}

function constructLabelHTML(
  label: CustomLabel,
  pathId: string,
): SVGTextElement {
  const textParts = label.text.split("|");
  const tspans = textParts.map((part, index) => {
    const tspan = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "tspan",
    );
    tspan.setAttribute("x", "0");
    tspan.setAttribute(
      "dy",
      index ? "1em" : `${(textParts.length - 1) / -2}em`,
    );
    tspan.textContent = part;
    return tspan;
  });

  const textPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "textPath",
  );
  textPath.setAttribute("href", `#${pathId}`);
  textPath.setAttribute(
    "startOffset",
    label.startOffset != null ? `${label.startOffset}%` : "50%",
  );
  textPath.setAttribute(
    "font-size",
    label.fontSize != null ? `${label.fontSize}%` : "100%",
  );
  if (label.letterSpacing !== undefined) {
    textPath.setAttribute("letter-spacing", `${label.letterSpacing}`);
  }
  textPath.append(...tspans);

  const textDom = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );
  textDom.setAttribute("text-rendering", "optimizeSpeed");
  textDom.setAttribute("id", `customLabel${label.i}`);
  textDom.setAttribute(
    "transform",
    `translate(${label.dx || 0}, ${label.dy || 0})`,
  );
  textDom.appendChild(textPath);

  return textDom;
}

function addPathForLabel(label: CustomLabel, pathGroup: SVGGElement): string {
  const pathId = `textPath_customLabel${label.i}`;
  const pathData = line<[number, number]>().curve(curveNatural)(
    label.pathPoints || [],
  );
  let domPath = pathGroup.querySelector<SVGPathElement>(`#${pathId}`);

  if (!domPath) {
    domPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathGroup.appendChild(domPath);
  }

  domPath.setAttribute("id", pathId);
  domPath.setAttribute("d", pathData || "");

  return pathId;
}
