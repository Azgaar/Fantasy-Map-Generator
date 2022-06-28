export function drawPrecipitation() {
  prec.selectAll("circle").remove();
  const {cells, points} = grid;

  prec.style("display", "block");
  const show = d3.transition().duration(800).ease(d3.easeSinIn);
  prec.selectAll("text").attr("opacity", 0).transition(show).attr("opacity", 1);

  const cellsNumberModifier = (pointsInput.dataset.cells / 10000) ** 0.25;
  const data = cells.i.filter(i => cells.h[i] >= 20 && cells.prec[i]);
  const getRadius = prec => rn(Math.sqrt(prec / 4) / cellsNumberModifier, 2);

  prec
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => points[d][0])
    .attr("cy", d => points[d][1])
    .attr("r", 0)
    .transition(show)
    .attr("r", d => getRadius(cells.prec[d]));
}
