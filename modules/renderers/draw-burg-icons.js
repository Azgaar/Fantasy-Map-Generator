"use strict";

function drawBurgIcons() {
  TIME && console.time("drawBurgIcons");

  icons.selectAll("circle, use").remove(); // cleanup

  // capitals
  const capitals = pack.burgs.filter(b => b.capital && !b.removed);
  const capitalIcons = burgIcons.select("#cities");
  const capitalIcon = capitalIcons.attr("data-icon") || "#icon-circle";
  const capitalAnchors = anchors.selectAll("#cities");
  const capitalAnchorsSize = capitalAnchors.attr("size") || 2;

  capitalIcons
    .selectAll("use")
    .data(capitals)
    .enter()
    .append("use")
    .attr("id", d => "burg" + d.i)
    .attr("href", capitalIcon)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y);

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

  // towns
  const towns = pack.burgs.filter(b => b.i && !b.capital && !b.removed);
  const townIcons = burgIcons.select("#towns");
  const townIcon = townIcons.attr("data-icon") || "#icon-circle";
  const townsAnchors = anchors.selectAll("#towns");
  const townsAnchorsSize = townsAnchors.attr("size") || 1;

  townIcons
    .selectAll("use")
    .data(towns)
    .enter()
    .append("use")
    .attr("id", d => "burg" + d.i)
    .attr("href", townIcon)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y);

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
}
