"use strict";

function drawBurgIcons() {
  TIME && console.time("drawBurgIcons");
  createIconGroups();

  for (const {name} of options.burgs.groups) {
    const burgsInGroup = pack.burgs.filter(b => b.group === name && !b.removed);
    if (!burgsInGroup.length) continue;

    const g = burgIcons.select("#" + name);
    if (g.empty()) continue;

    const icon = g.attr("data-icon") || "#icon-circle";

    g.selectAll("use")
      .data(burgsInGroup)
      .enter()
      .append("use")
      .attr("href", icon)
      .attr("id", d => "burg" + d.i)
      .attr("data-id", d => d.i)
      .attr("x", d => d.x)
      .attr("y", d => d.y);

    // g.selectAll("circle")
    //   .data(burgsInGroup)
    //   .enter()
    //   .append("circle")
    //   .attr("id", d => "burg_circle" + d.i)
    //   .attr("cx", d => d.x)
    //   .attr("cy", d => d.y)
    //   .attr("r", 0.2)
    //   .attr("fill", "red")
    //   .attr("stroke", "none");

    // capitalAnchors
    //   .selectAll("use")
    //   .data(capitals.filter(c => c.port))
    //   .enter()
    //   .append("use")
    //   .attr("xlink:href", "#icon-anchor")
    //   .attr("data-id", d => d.i)
    //   .attr("x", d => rn(d.x - capitalAnchorsSize * 0.47, 2))
    //   .attr("y", d => rn(d.y - capitalAnchorsSize * 0.47, 2))
    //   .attr("width", capitalAnchorsSize)
    //   .attr("height", capitalAnchorsSize);
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
}

function createIconGroups() {
  const defaultStyle = style.burgIcons.towns || Object.values(style.burgIcons)[0];

  // save existing styles and remove all groups
  document.querySelectorAll("g#burgIcons > g").forEach(group => {
    const groupStyle = Object.keys(defaultStyle).reduce((acc, key) => {
      acc[key] = group.getAttribute(key);
      return acc;
    }, {});
    style.burgIcons[group.id] = groupStyle;
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const {name} of sortedGroups) {
    const group = burgIcons.append("g").attr("id", name);
    const styles = style.burgIcons[name] || defaultStyle;
    Object.entries(styles).forEach(([key, value]) => {
      group.attr(key, value);
    });
  }
}
