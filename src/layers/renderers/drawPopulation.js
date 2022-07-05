import * as d3 from "d3";

export function drawPopulation(event) {
  population.selectAll("line").remove();

  const {cells, burgs} = pack;
  const p = {cells};
  const show = d3.transition().duration(2000).ease(d3.easeSinIn);

  const rural = Array.from(
    cells.i.filter(i => cells.pop[i] > 0),
    i => [p[i][0], p[i][1], p[i][1] - cells.pop[i] / 8]
  );

  population
    .select("#rural")
    .selectAll("line")
    .data(rural)
    .enter()
    .append("line")
    .attr("x1", d => d[0])
    .attr("y1", d => d[1])
    .attr("x2", d => d[0])
    .attr("y2", d => d[1])
    .transition(show)
    .attr("y2", d => d[2]);

  const urban = burgs.filter(b => b.i && !b.removed).map(b => [b.x, b.y, b.y - (b.population / 8) * urbanization]);

  population
    .select("#urban")
    .selectAll("line")
    .data(urban)
    .enter()
    .append("line")
    .attr("x1", d => d[0])
    .attr("y1", d => d[1])
    .attr("x2", d => d[0])
    .attr("y2", d => d[1])
    .transition(show)
    .delay(500)
    .attr("y2", d => d[2]);
}
