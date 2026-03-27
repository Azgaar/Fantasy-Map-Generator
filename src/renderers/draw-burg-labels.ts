import type { Burg } from "../modules/burgs-generator";
import type { BurgLabelData } from "../modules/labels";

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
  const burgLabelsByGroup = new Map<string, BurgLabelData[]>();
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

    const labelsHTML: string[] = [];
    for (const labelData of labels) {
      labelsHTML.push(
        `<text text-rendering="optimizeSpeed" id="burgLabel${labelData.burgId}" data-id="${labelData.burgId}" x="${labelData.x}" y="${labelData.y}" dx="${dx}em" dy="${dy}em">${labelData.text}</text>`,
      );
    }

    // Set all labels at once
    const groupNode = labelGroup.node();
    if (groupNode) {
      groupNode.innerHTML = labelsHTML.join("");
    }
  }

  TIME && console.timeEnd("drawBurgLabels");
}

export function drawBurgLabel(burg: Burg): void {
  // TODO: remove label group dependency - for now, if group is missing, redraw all labels to recreate the group
  const labelGroup = burgLabels.select<SVGGElement>(`#${burg.group}`);
  if (labelGroup.empty()) {
    drawBurgLabels();
    return; // redraw all labels if group is missing
  }

  const dxAttr = labelGroup.attr("data-dx");
  const dyAttr = labelGroup.attr("data-dy");
  const dx = dxAttr ? parseFloat(dxAttr) : 0;
  const dy = dyAttr ? parseFloat(dyAttr) : 0;

  const existingLabel = document.getElementById(`burgLabel${burg.i}`);
  if (existingLabel) existingLabel.remove();

  // Render to SVG
  labelGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", `burgLabel${burg.i}`)
    .attr("data-id", burg.i!)
    .attr("x", burg.x)
    .attr("y", burg.y)
    .attr("dx", `${dx}em`)
    .attr("dy", `${dy}em`)
    .text(burg.name!);
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
