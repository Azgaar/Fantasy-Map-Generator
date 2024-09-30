"use strict";

function drawBurgIcons() {
  TIME && console.time("drawBurgIcons");

  icons.selectAll("circle, use").remove(); // cleanup

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
