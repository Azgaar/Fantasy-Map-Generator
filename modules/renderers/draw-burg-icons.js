"use strict";

function drawBurgIcons() {
  TIME && console.time("drawBurgIcons");
  createIconGroups();

  for (const {name} of options.burgs.groups) {
    const burgsInGroup = pack.burgs.filter(b => b.group === name && !b.removed);
    if (!burgsInGroup.length) continue;

    const burgGroup = document.querySelector("#burgIcons > g#" + name);
    if (!burgGroup) continue;

    const icon = burgGroup.dataset.icon || "#icon-circle";
    burgGroup.innerHTML = burgsInGroup
      .map(b => `<use id="burg${b.i}" data-id="${b.i}" href="${icon}" x="${b.x}" y="${b.y}"></use>`)
      .join("");

    const portsInGroup = burgsInGroup.filter(b => b.port);
    if (!portsInGroup.length) continue;

    const portGroup = document.querySelector("#anchors > g#" + name);
    if (!portGroup) continue;

    portGroup.innerHTML = portsInGroup
      .map(b => `<use id="anchor${b.i}" data-id="${b.i}" href="#icon-anchor" x="${b.x}" y="${b.y}"></use>`)
      .join("");
  }

  TIME && console.timeEnd("drawBurgIcons");
}

function drawBurgIcon(burg) {
  burgIcons
    .select("#" + burg.group)
    .append("use")
    .attr("href", "#icon-circle")
    .attr("id", "burg" + burg.i)
    .attr("data-id", burg.i)
    .attr("x", burg.x)
    .attr("y", burg.y);

  if (burg.port) {
    anchors
      .select("#" + burg.group)
      .append("use")
      .attr("href", "#icon-anchor")
      .attr("id", "anchor" + burg.i)
      .attr("data-id", burg.i)
      .attr("x", burg.x)
      .attr("y", burg.y);
  }
}

function createIconGroups() {
  // save existing styles and remove all groups
  const defaultIconStyle = style.burgIcons.town || Object.values(style.burgIcons)[0];
  document.querySelectorAll("g#burgIcons > g").forEach(group => {
    const groupStyle = Object.keys(defaultIconStyle).reduce((acc, key) => {
      acc[key] = group.getAttribute(key);
      return acc;
    }, {});
    style.burgIcons[group.id] = groupStyle;
    group.remove();
  });

  const defaultAnchorStyle = style.anchors.town || Object.values(style.anchors)[0];
  document.querySelectorAll("g#anchors > g").forEach(group => {
    const groupStyle = Object.keys(defaultAnchorStyle).reduce((acc, key) => {
      acc[key] = group.getAttribute(key);
      return acc;
    }, {});
    style.anchors[group.id] = groupStyle;
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const {name} of sortedGroups) {
    const burgGroup = burgIcons.append("g").attr("id", name);
    const iconStyles = style.burgIcons[name] || defaultIconStyle;
    Object.entries(iconStyles).forEach(([key, value]) => {
      burgGroup.attr(key, value);
    });

    const anchorGroup = anchors.append("g").attr("id", name);
    const anchorStyles = style.anchors[name] || defaultAnchorStyle;
    Object.entries(anchorStyles).forEach(([key, value]) => {
      anchorGroup.attr(key, value);
    });
  }
}
