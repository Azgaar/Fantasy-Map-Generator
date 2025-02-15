"use strict";

function drawBurgLabels() {
  TIME && console.time("drawBurgLabels");

  burgLabels.selectAll("text").remove(); // cleanup

  const capitals = pack.burgs.filter(b => b.capital && !b.removed);
  const capitalSize = burgIcons.select("#cities").attr("size") || 1;
  burgLabels
    .select("#cities")
    .selectAll("text")
    .data(capitals)
    .enter()
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${capitalSize * -1.5}px`)
    .text(d => d.name);

  const towns = pack.burgs.filter(b => b.i && !b.capital && !b.removed);
  const townSize = burgIcons.select("#towns").attr("size") || 0.5;
  burgLabels
    .select("#towns")
    .selectAll("text")
    .data(towns)
    .enter()
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${townSize * -2}px`)
    .text(d => d.name);

  TIME && console.timeEnd("drawBurgLabels");
}
