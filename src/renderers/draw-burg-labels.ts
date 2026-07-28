import { select } from "d3";
import type { BurgLabel } from "../generators/labels";

declare global {
  var drawBurgLabels: () => void;
}

const burgLabelsRenderer = (): void => {
  TIME && console.time("drawBurgLabels");
  createLabelGroups();

  for (const { name } of options.burgs.groups) {
    const labelsInGroup = pack.labels.filter((label): label is BurgLabel => label.type === "burg" && label.group === name);
    if (!labelsInGroup.length) continue;

    const labelGroup = select("#burgLabels").select<SVGGElement>(`#${name}`);
    if (labelGroup.empty()) continue;

    const dx = labelGroup.attr("data-dx") || 0;
    const dy = labelGroup.attr("data-dy") || 0;

    labelGroup
      .selectAll("text")
      .data(labelsInGroup)
      .enter()
      .append("text")
      .attr("text-rendering", "optimizeSpeed")
      .attr("id", d => `burgLabel${d.burgId}`)
      .attr("data-id", d => d.burgId)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("dx", `${dx}em`)
      .attr("dy", `${dy}em`)
      .text(d => d.text);
  }

  TIME && console.timeEnd("drawBurgLabels");
};

const drawBurgLabelRenderer = (label: BurgLabel): void => {
  const labelGroup = select("#burgLabels").select<SVGGElement>(`#${label.group}`);
  if (labelGroup.empty()) {
    drawBurgLabels();
    return; // redraw all labels if group is missing
  }

  const dx = labelGroup.attr("data-dx") || 0;
  const dy = labelGroup.attr("data-dy") || 0;

  removeBurgLabelRenderer(label.burgId);
  labelGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", `burgLabel${label.burgId}`)
    .attr("data-id", label.burgId)
    .attr("x", label.x)
    .attr("y", label.y)
    .attr("dx", `${dx}em`)
    .attr("dy", `${dy}em`)
    .text(label.text);
};

const removeBurgLabelRenderer = (burgId: number): void => {
  const existingLabel = document.getElementById(`burgLabel${burgId}`);
  if (existingLabel) existingLabel.remove();
};

function createLabelGroups(): void {
  // save existing styles and remove all groups
  document.querySelectorAll("g#burgLabels > g").forEach(group => {
    style.burgLabels[group.id] = Array.from(group.attributes).reduce((acc: { [key: string]: string }, attribute) => {
      acc[attribute.name] = attribute.value;
      return acc;
    }, {});
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const defaultStyle = style.burgLabels.town || Object.values(style.burgLabels)[0] || {};
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const { name } of sortedGroups) {
    const group = select("#burgLabels").append("g");
    const styles = style.burgLabels[name] || defaultStyle;
    Object.entries(styles).forEach(([key, value]) => {
      group.attr(key, value);
    });
    group.attr("id", name);
  }
}

window.drawBurgLabels = burgLabelsRenderer;

export { drawBurgLabelRenderer as drawBurgLabel, removeBurgLabelRenderer as removeBurgLabel };

// burgs-generator still draws labels directly; it cannot import upwards, so the bridge stays
window.drawBurgLabel = drawBurgLabelRenderer;
window.removeBurgLabel = removeBurgLabelRenderer;

export { burgLabelsRenderer as drawBurgLabels };
