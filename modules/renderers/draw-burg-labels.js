"use strict";

function drawBurgLabels() {
  TIME && console.time("drawBurgLabels");
  createLabelGroups();

  for (const {name} of options.burgs.groups) {
    const burgsInGroup = pack.burgs.filter(b => b.group === name && !b.removed);
    if (!burgsInGroup.length) continue;

    const labelGroup = burgLabels.select("#" + name);
    if (labelGroup.empty()) continue;

    const dx = labelGroup.attr("data-dx");
    const dy = labelGroup.attr("data-dy");

    labelGroup
      .selectAll("text")
      .data(burgsInGroup)
      .enter()
      .append("text")
      .attr("id", d => "burgLabel" + d.i)
      .attr("data-id", d => d.i)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("dx", dx + "em")
      .attr("dy", dy + "em")
      .text(d => d.name);
  }

  TIME && console.timeEnd("drawBurgLabels");
}

function drawBurgLabel(burg) {
  const group = burgLabels.select("#" + burg.group);
  const dx = labelGroup.attr("data-dx");
  const dy = labelGroup.attr("data-dy");

  group
    .append("text")
    .attr("id", "burgLabel" + burg.i)
    .attr("data-id", burg.i)
    .attr("x", burg.x)
    .attr("y", burg.y)
    .attr("dx", dx + "em")
    .attr("dy", dy + "em")
    .text(burg.name);
}

function createLabelGroups() {
  const defaultStyle = style.burgLabels.towns || Object.values(style.burgLabels)[0];

  // save existing styles and remove all groups
  document.querySelectorAll("g#burgLabels > g").forEach(group => {
    const groupStyle = Object.keys(defaultStyle).reduce((acc, key) => {
      acc[key] = group.getAttribute(key);
      return acc;
    }, {});
    style.burgLabels[group.id] = groupStyle;
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const {name} of sortedGroups) {
    const group = burgLabels.append("g").attr("id", name);
    const styles = style.burgLabels[name] || defaultStyle;
    Object.entries(styles).forEach(([key, value]) => {
      group.attr(key, value);
    });
  }
}
