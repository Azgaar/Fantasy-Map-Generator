import type { BurgLabel } from "../modules/labels";

interface BurgGroup {
  name: string;
  order: number;
}

// remove this section once layer.js is refactored--------------------------------
declare global {
  var drawBurgLabels: () => void;
}

window.drawBurgLabels = drawBurgLabels;
// section end -------------------------------------------------------------------

export function drawBurgLabels(): void {
  TIME && console.time("drawBurgLabels");
  createLabelGroups();

  // Get all burg labels grouped by group name
  const burgLabelsByGroup = new Map<string, BurgLabel[]>();
  for (const label of Labels.getAll()) {
    if (label.type !== "burg") continue;
    if (!burgLabelsByGroup.has(label.group)) {
      burgLabelsByGroup.set(label.group, []);
    }
    burgLabelsByGroup.get(label.group)!.push(label);
  }

  // Render each group and update label offsets from SVG attributes
  for (const [groupName, labels] of burgLabelsByGroup) {
    const labelGroup = burgLabels.select<SVGGElement>(`#${groupName}`);
    if (labelGroup.empty()) continue;

    const dxAttr = style.burgLabels?.[groupName]?.["data-dx"];
    const dyAttr = style.burgLabels?.[groupName]?.["data-dy"];
    const dx = dxAttr ? parseFloat(dxAttr) : 0;
    const dy = dyAttr ? parseFloat(dyAttr) : 0;

    const labelsHTML: SVGTextElement[] = [];
    for (const labelData of labels) {
      const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
      textElement.setAttribute("text-rendering", "optimizeSpeed");
      textElement.setAttribute("id", `burgLabel${labelData.i}`);
      textElement.setAttribute("data-id", labelData.burgId.toString());
      textElement.setAttribute("x", labelData.x.toString());
      textElement.setAttribute("y", labelData.y.toString());
      textElement.setAttribute("dx", `${dx}em`);
      textElement.setAttribute("dy", `${dy}em`);
      textElement.textContent = labelData.text;
      labelsHTML.push(
        textElement
      );
    }

    // Set all labels at once
    const groupNode = labelGroup.node();
    if (groupNode) {
      groupNode.replaceChildren(...labelsHTML);
    }
  }

  TIME && console.timeEnd("drawBurgLabels");
}

export function drawBurgLabel(burgLabel: BurgLabel): void {
  // TODO: remove label group dependency - for now, if group is missing, redraw all labels to recreate the group
  const labelGroup = burgLabels.select<SVGGElement>(`#${burgLabel.group}`);
  if (labelGroup.empty()) {
    drawBurgLabels();
    return; // redraw all labels if group is missing
  }

  const dxAttr = labelGroup.attr("data-dx");
  const dyAttr = labelGroup.attr("data-dy");
  const dx = dxAttr ? parseFloat(dxAttr) : 0;
  const dy = dyAttr ? parseFloat(dyAttr) : 0;

  const existingLabel = document.getElementById(`burgLabel${burgLabel.burgId}`);
  if (existingLabel) existingLabel.remove();

  // Render to SVG
  labelGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", `burgLabel${burgLabel.i}`)
    .attr("data-id", burgLabel.burgId)
    .attr("x", burgLabel.x)
    .attr("y", burgLabel.y)
    .attr("dx", `${dx}em`)
    .attr("dy", `${dy}em`)
    .text(burgLabel.text);
}

export function removeBurgLabel(burgId: number): void {
  const existingLabel = document.getElementById(`burgLabel${burgId}`);
  if (existingLabel) existingLabel.remove();
}

function createLabelGroups(): void {
  // save existing styles and remove all groups
  document.querySelectorAll("g#burgLabels > g").forEach((group) => {
    style.burgLabels[group.id] = Array.from(group.attributes).reduce(
      (acc: { [key: string]: string }, attribute) => {
        acc[attribute.name] = attribute.value;
        return acc;
      },
      {},
    );
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const defaultStyle =
    style.burgLabels.town || Object.values(style.burgLabels)[0] || {};
  const sortedGroups = [...(options.burgs.groups as BurgGroup[])].sort(
    (a, b) => a.order - b.order,
  );
  for (const { name } of sortedGroups) {
    const group = burgLabels.append("g");
    const styles = style.burgLabels[name] || defaultStyle;
    Object.entries(styles).forEach(([key, value]) => {
      group.attr(key, value);
    });
    group.attr("id", name);
  }
}
