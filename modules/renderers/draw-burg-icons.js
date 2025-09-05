"use strict";

function drawBurgIcons() {
  TIME && console.time("drawBurgIcons");

  icons.selectAll("circle, use").remove(); // cleanup

  // capitals (exclude sky burgs)
  const capitals = pack.burgs.filter(b => b.capital && !b.removed && !(b.flying || b.skyPort));
  const capitalIcons = burgIcons.select("#cities");
  const capitalSize = capitalIcons.attr("size") || 1;
  const capitalAnchors = anchors.selectAll("#cities");
  const capitalAnchorsSize = capitalAnchors.attr("size") || 2;

  capitalIcons
    .selectAll("circle")
    .data(capitals)
    .enter()
    .append("circle")
    .attr("id", d => "burg" + d.i)
    .attr("data-id", d => d.i)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", capitalSize);

  capitalAnchors
    .selectAll("use")
    .data(capitals.filter(c => c.port))
    .enter()
    .append("use")
    .attr("xlink:href", "#icon-anchor")
    .attr("data-id", d => d.i)
    .attr("x", d => rn(d.x - capitalAnchorsSize * 0.47, 2))
    .attr("y", d => rn(d.y - capitalAnchorsSize * 0.47, 2))
    .attr("width", capitalAnchorsSize)
    .attr("height", capitalAnchorsSize);

  // towns (exclude sky burgs)
  const towns = pack.burgs.filter(b => b.i && !b.capital && !b.removed && !(b.flying || b.skyPort));
  const townIcons = burgIcons.select("#towns");
  const townSize = townIcons.attr("size") || 0.5;
  const townsAnchors = anchors.selectAll("#towns");
  const townsAnchorsSize = townsAnchors.attr("size") || 1;

  townIcons
    .selectAll("circle")
    .data(towns)
    .enter()
    .append("circle")
    .attr("id", d => "burg" + d.i)
    .attr("data-id", d => d.i)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", townSize);

  townsAnchors
    .selectAll("use")
    .data(towns.filter(c => c.port))
    .enter()
    .append("use")
    .attr("xlink:href", "#icon-anchor")
    .attr("data-id", d => d.i)
    .attr("x", d => rn(d.x - townsAnchorsSize * 0.47, 2))
    .attr("y", d => rn(d.y - townsAnchorsSize * 0.47, 2))
    .attr("width", townsAnchorsSize)
    .attr("height", townsAnchorsSize);

  TIME && console.timeEnd("drawBurgIcons");

  // Sky burgs (flying or sky port) — styled separately
  const sky = pack.burgs.filter(b => b.i && !b.removed && (b.flying || b.skyPort));
  const skyIcons = burgIcons.select("#skyburgs");
  const skySize = skyIcons.attr("size") || 0.6;

  skyIcons
    .selectAll("circle")
    .data(sky)
    .enter()
    .append("circle")
    .attr("id", d => "burg" + d.i)
    .attr("data-id", d => d.i)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", skySize);
}
