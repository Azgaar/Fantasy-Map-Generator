export function drawLabels() {
  drawBurgLabels();
  // TODO: draw other labels

  window.Zoom.invoke();
}

function drawBurgLabels() {
  // remove old data
  burgLabels.selectAll("text").remove();

  const validBurgs = pack.burgs.filter(burg => burg.i && !(burg as IBurg).removed) as IBurg[];

  // capitals
  const capitals = validBurgs.filter(burg => burg.capital);
  const capitalSize = Number(burgIcons.select("#cities").attr("size")) || 1;

  burgLabels
    .select("#cities")
    .selectAll("text")
    .data(capitals)
    .enter()
    .append("text")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${capitalSize * -1.5}px`)
    .text(d => d.name);

  // towns
  const towns = validBurgs.filter(burg => !burg.capital);
  const townSize = Number(burgIcons.select("#towns").attr("size")) || 0.5;

  burgLabels
    .select("#towns")
    .selectAll("text")
    .data(towns)
    .enter()
    .append("text")
    .attr("id", d => "burgLabel" + d.i)
    .attr("data-id", d => d.i)
    .attr("x", d => d.x)
    .attr("y", d => d.y)
    .attr("dy", `${townSize * -1.5}px`)
    .text(d => d.name);
}
