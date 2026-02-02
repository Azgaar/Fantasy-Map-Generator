import type { Burg } from "../modules/burgs-generator";

declare global {
  var drawBurgLabels: () => void;
  var drawBurgLabel: (burg: Burg) => void;
  var removeBurgLabel: (burgId: number) => void;
}

interface BurgGroup {
  name: string;
  order: number;
}

const burgLabelsRenderer = (): void => {
  TIME && console.time("drawBurgLabels");
  createLabelGroups();

  for (const { name } of options.burgs.groups as BurgGroup[]) {
    const burgsInGroup = pack.burgs.filter(
      (b) => b.group === name && !b.removed,
    );
    if (!burgsInGroup.length) continue;

    const labelGroup = burgLabels.select<SVGGElement>(`#${name}`);
    if (labelGroup.empty()) continue;

    const dx = labelGroup.attr("data-dx") || 0;
    const dy = labelGroup.attr("data-dy") || 0;

    labelGroup
      .selectAll("text")
      .data(burgsInGroup)
      .enter()
      .append("text")
      .attr("text-rendering", "optimizeSpeed")
      .attr("id", (d) => `burgLabel${d.i}`)
      .attr("data-id", (d) => d.i!)
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("dx", `${dx}em`)
      .attr("dy", `${dy}em`)
      .text((d) => d.name!);
  }

  TIME && console.timeEnd("drawBurgLabels");
};

const drawBurgLabelRenderer = (burg: Burg): void => {
  const labelGroup = burgLabels.select<SVGGElement>(`#${burg.group}`);
  if (labelGroup.empty()) {
    drawBurgLabels();
    return; // redraw all labels if group is missing
  }

  const dx = labelGroup.attr("data-dx") || 0;
  const dy = labelGroup.attr("data-dy") || 0;

  removeBurgLabelRenderer(burg.i!);
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
};

const removeBurgLabelRenderer = (burgId: number): void => {
  const existingLabel = document.getElementById(`burgLabel${burgId}`);
  if (existingLabel) existingLabel.remove();
};

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

window.drawBurgLabels = burgLabelsRenderer;
window.drawBurgLabel = drawBurgLabelRenderer;
window.removeBurgLabel = removeBurgLabelRenderer;
