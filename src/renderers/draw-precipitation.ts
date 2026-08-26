import { easeSinIn, select, transition } from "d3";
import { ensureEl, rn } from "@/utils";

export function drawPrecipitation(): void {
  TIME && console.time("drawPrecipitation");
  const { cells, points } = grid;

  const prec = select(ensureEl<SVGGElement>("prec"));
  prec.selectAll("*").remove();

  const show = transition().duration(800).ease(easeSinIn);
  drawWindDirections();
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

export function removePrecipitation(): void {
  select(ensureEl<SVGGElement>("prec")).selectAll("*").remove();
}

/** arrows showing where the prevailing winds enter the map */
function drawWindDirections(): void {
  const { westerly, easterly, northerly, southerly } = Precipitation.getWinds();
  const wind = select(ensureEl<SVGGElement>("prec")).append("g").attr("id", "wind");

  const addArrow = (x: number, y: number, symbol: string) =>
    wind.append("text").attr("text-rendering", "optimizeSpeed").attr("x", x).attr("y", y).text(symbol);

  const getMeanY = (fromCellId: number, toCellId: number) =>
    (grid.points[fromCellId][1] + grid.points[toCellId][1]) / 2;

  for (let tier = 0; tier < 6; tier++) {
    if (westerly.length > 1) {
      const west = westerly.filter(band => band[2] === tier);
      if (west.length > 3) addArrow(20, getMeanY(west[0][0], west[west.length - 1][0]), "\u21C9");
    }

    if (easterly.length > 1) {
      const east = easterly.filter(band => band[2] === tier);
      if (east.length > 3) addArrow(graphWidth - 52, getMeanY(east[0][0], east[east.length - 1][0]), "\u21C7");
    }
  }

  if (northerly) addArrow(graphWidth / 2, 42, "\u21CA");
  if (southerly) addArrow(graphWidth / 2, graphHeight - 20, "\u21C8");
}
