"use strict";

function drawBurgLabels() {
  TIME && console.time("drawBurgLabels");

  burgLabels.selectAll("text").remove(); // cleanup

  for (const {name} of options.burgs.groups) {
    const burgsInGroup = pack.burgs.filter(b => b.group === name && !b.removed);
    if (!burgsInGroup.length) continue;

    const labelGroup = burgLabels.select("#" + name);
    if (labelGroup.empty()) continue;

    labelGroup
      .selectAll("text")
      .data(burgsInGroup)
      .enter()
      .append("text")
      .attr("id", d => "burgLabel" + d.i)
      .attr("data-id", d => d.i)
      .attr("x", d => d.x)
      .attr("y", d => d.y)
      .attr("dy", "-0.4em")
      .text(d => d.name);
  }

  TIME && console.timeEnd("drawBurgLabels");
}

function drawBurgLabel(burg) {
  burgLabels
    .select("#" + burg.group)
    .append("text")
    .attr("id", "burgLabel" + burg.i)
    .attr("data-id", burg.i)
    .attr("x", burg.x)
    .attr("y", burg.y)
    .attr("dy", "-0.4em")
    .text(burg.name);
}
