"use strict";

function drawBurgIcons() {
  TIME && console.time("drawBurgIcons");
  createIconGroups();

  for (const {name} of options.burgs.groups) {
    const burgsInGroup = pack.burgs.filter(b => b.group === name && !b.removed);
    if (!burgsInGroup.length) continue;

    const iconsGroup = document.querySelector("#burgIcons > g#" + name);
    if (!iconsGroup) continue;

    const icon = iconsGroup.dataset.icon || "#icon-circle";
    iconsGroup.innerHTML = burgsInGroup
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
  removeBurgIcon(burg.i);

  const iconGroup = burgIcons.select("#" + burg.group);
  if (iconGroup.empty()) return;

  const icon = iconGroup.attr("data-icon") || "#icon-circle";
  burgIcons
    .select("#" + burg.group)
    .append("use")
    .attr("href", icon)
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

function removeBurgIcon(burgId) {
  const existingIcon = document.getElementById("burg" + burgId);
  if (existingIcon) existingIcon.remove();

  const existingAnchor = document.getElementById("anchor" + burgId);
  if (existingAnchor) existingAnchor.remove();
}

function createIconGroups() {
  // save existing styles and remove all groups
  document.querySelectorAll("g#burgIcons > g").forEach(group => {
    style.burgIcons[group.id] = Array.from(group.attributes).reduce((acc, attribute) => {
      acc[attribute.name] = attribute.value;
      return acc;
    }, {});
    group.remove();
  });

  document.querySelectorAll("g#anchors > g").forEach(group => {
    style.anchors[group.id] = Array.from(group.attributes).reduce((acc, attribute) => {
      acc[attribute.name] = attribute.value;
      return acc;
    }, {});
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const defaultIconStyle = style.burgIcons.town || Object.values(style.burgIcons)[0] || {};
  const defaultAnchorStyle = style.anchors.town || Object.values(style.anchors)[0] || {};
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const {name} of sortedGroups) {
    const burgGroup = burgIcons.append("g");
    const iconStyles = style.burgIcons[name] || defaultIconStyle;
    Object.entries(iconStyles).forEach(([key, value]) => {
      burgGroup.attr(key, value);
    });
    burgGroup.attr("id", name);

    const anchorGroup = anchors.append("g");
    const anchorStyles = style.anchors[name] || defaultAnchorStyle;
    Object.entries(anchorStyles).forEach(([key, value]) => {
      anchorGroup.attr(key, value);
    });
    anchorGroup.attr("id", name);
  }
}
