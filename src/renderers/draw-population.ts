import { easeSinIn, select, transition } from "d3";
import { ensureEl } from "@/utils";

type Bar = [x: number, base: number, top: number];

export function drawPopulation(): void {
  const { cells, burgs } = pack;
  const population = select(ensureEl<SVGGElement>("population"));
  population.selectAll("line").remove();

  const show = transition().duration(2000).ease(easeSinIn);

  const rural: Bar[] = Array.from(cells.i as ArrayLike<number>)
    .filter(i => cells.pop[i] > 0)
    .map(i => [cells.p[i][0], cells.p[i][1], cells.p[i][1] - cells.pop[i] / 5]);
  drawBars(population.select("#rural"), rural, show, 0);

  const urban: Bar[] = burgs
    .filter(burg => burg.i && !burg.removed)
    .map(burg => [burg.x!, burg.y!, burg.y! - (burg.population! / 5) * urbanization]);
  drawBars(population.select("#urban"), urban, show, 500);
}

function drawBars(
  group: ReturnType<typeof select>,
  bars: Bar[],
  show: ReturnType<typeof transition>,
  delay: number
): void {
  group
    .selectAll("line")
    .data(bars)
    .enter()
    .append("line")
    .attr("x1", ([x]) => x)
    .attr("y1", ([, base]) => base)
    .attr("x2", ([x]) => x)
    .attr("y2", ([, base]) => base)
    .transition(show)
    .delay(delay)
    .attr("y2", ([, , top]) => top);
}
