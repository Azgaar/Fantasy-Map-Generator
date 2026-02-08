import type { Burg } from "../modules/burgs-generator";
import { generateBurgLabelsData } from "../modules/labels-generator";

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

  // Clear existing burg labels from pack.labels
  if (!pack.labels) pack.labels = [];
  pack.labels = pack.labels.filter((label) => label.type !== "burg");

  // Generate label data using the generator
  const generatedLabels = generateBurgLabelsData();

  // Render labels from generated data
  for (const label of generatedLabels) {
    const labelGroup = burgLabels.select<SVGGElement>(`#${label.group}`);
    if (labelGroup.empty()) continue;

    const dx = labelGroup.attr("data-dx") || 0;
    const dy = labelGroup.attr("data-dy") || 0;

    const burg = pack.burgs[label.burgId!];
    if (!burg || burg.removed) continue;

    labelGroup
      .append("text")
      .attr("text-rendering", "optimizeSpeed")
      .attr("id", label.i)
      .attr("data-id", label.burgId!)
      .attr("x", burg.x)
      .attr("y", burg.y)
      .attr("dx", `${dx}em`)
      .attr("dy", `${dy}em`)
      .text(label.name);
  }

  // Store labels in pack.labels
  pack.labels.push(...generatedLabels);

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

  // Create label data
  const labelData = {
    i: `burgLabel${burg.i}`,
    type: "burg" as const,
    name: burg.name!,
    group: burg.group!,
    burgId: burg.i!,
  };

  // Render label
  labelGroup
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", labelData.i)
    .attr("data-id", burg.i!)
    .attr("x", burg.x)
    .attr("y", burg.y)
    .attr("dx", `${dx}em`)
    .attr("dy", `${dy}em`)
    .text(burg.name!);

  // Update pack.labels
  if (!pack.labels) pack.labels = [];
  const existingIndex = pack.labels.findIndex((l) => l.i === labelData.i);

  if (existingIndex >= 0) {
    pack.labels[existingIndex] = labelData;
  } else {
    pack.labels.push(labelData);
  }
};

const removeBurgLabelRenderer = (burgId: number): void => {
  const existingLabel = document.getElementById(`burgLabel${burgId}`);
  if (existingLabel) existingLabel.remove();

  // Remove from pack.labels
  if (pack.labels) {
    const labelId = `burgLabel${burgId}`;
    pack.labels = pack.labels.filter((l) => l.i !== labelId);
  }
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
