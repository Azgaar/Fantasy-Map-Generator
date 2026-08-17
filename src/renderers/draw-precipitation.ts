import { easeSinIn, select, transition } from "d3";
import { ensureEl, rn } from "@/utils";

export function drawPrecipitation(): void {
  TIME && console.time("drawPrecipitation");
  const { cells, points } = grid;

  const prec = select(ensureEl<SVGGElement>("prec"));
  prec.selectAll("circle").remove();

  const show = transition().duration(800).ease(easeSinIn);
  prec.selectAll("text").attr("opacity", 0).transition(show).attr("opacity", 1);

  const cellsNumberModifier = (+ensureEl<HTMLInputElement>("pointsInput").dataset.cells! / 10000) ** 0.25;
  const data = Array.from(cells.i as ArrayLike<number>).filter(i => cells.h[i] >= 20 && cells.prec[i]);
  const getRadius = (precipitation: number) => rn(Math.sqrt(precipitation / 4) / cellsNumberModifier, 2);

  prec
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", cellId => points[cellId][0])
    .attr("cy", cellId => points[cellId][1])
    .attr("r", 0)
    .transition(show)
    .attr("r", cellId => getRadius(cells.prec[cellId]));

  TIME && console.timeEnd("drawPrecipitation");
}

/** drop the circles, keeping #wind: the wind direction arrows are written once, at map generation */
export function removePrecipitation(): void {
  select(ensureEl<SVGGElement>("prec")).selectAll("circle").remove();
}
