import {rn} from "utils/numberUtils";

export function drawBurgs() {
  // remove old data
  burgIcons.selectAll("circle").remove();
  icons.selectAll("use").remove();

  const validBurgs = pack.burgs.filter(burg => burg.i && !(burg as IBurg).removed) as IBurg[];

  // capitals
  const capitals = validBurgs.filter(burg => burg.capital);
  const capitalIcons = burgIcons.select("#cities");

  const capitalSize = Number(capitalIcons.attr("size")) || 1;
  const capitalAnchors = anchors.selectAll("#cities");
  const caSize = Number(capitalAnchors.attr("size")) || 2;

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
    .attr("x", d => rn(d.x - caSize * 0.47, 2))
    .attr("y", d => rn(d.y - caSize * 0.47, 2))
    .attr("width", caSize)
    .attr("height", caSize);

  // towns
  const towns = validBurgs.filter(burg => !burg.capital);
  const townIcons = burgIcons.select("#towns");
  const townSize = Number(townIcons.attr("size")) || 0.5;
  const townsAnchors = anchors.selectAll("#towns");
  const taSize = Number(townsAnchors.attr("size")) || 1;

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
    .attr("x", d => rn(d.x - taSize * 0.47, 2))
    .attr("y", d => rn(d.y - taSize * 0.47, 2))
    .attr("width", taSize)
    .attr("height", taSize);
}
