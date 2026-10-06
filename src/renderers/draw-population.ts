import { easeSinIn, extent, hsl, select, transition } from "d3";
import { ensureEl, getCellPopulation, getIsolines } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

type Bar = [x: number, base: number, top: number];

export function drawPopulation(): void {
  select(ensureEl<SVGGElement>("population")).selectAll("line").remove();
  ensureEl("populationCells").innerHTML = "";

  if (styles.population.options.type === "cells") drawCells();
  else drawBars();
}

function drawBars(): void {
  const { cells, burgs } = pack;
  const population = select(ensureEl<SVGGElement>("population"));
  const show = transition().duration(2000).ease(easeSinIn);

  const rural: Bar[] = Array.from(cells.i as ArrayLike<number>)
    .filter(i => cells.pop[i] > 0)
    .map(i => [cells.p[i][0], cells.p[i][1], cells.p[i][1] - cells.pop[i] / 5]);
  appendBars(population.select("#rural"), rural, show, 0);

  const urban: Bar[] = burgs
    .filter(burg => burg.i && !burg.removed)
    .map(burg => [burg.x!, burg.y!, burg.y! - (burg.population! / 5) * options.map.units.population.urbanization.rate]);
  appendBars(population.select("#urban"), urban, show, 500);
}

function appendBars(
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

// hue goes from blue (rural) to red (urban) by the urban share; the denser, the darker (log scale from the least to the most populated cell)
function drawCells(): void {
  TIME && console.time("drawPopulationCells");
  const { cells } = pack;

  const land = Array.from(cells.i as ArrayLike<number>).filter(cellId => cells.h[cellId] >= 20);
  const populations = land.map(cellId => getCellPopulation(cellId, pack));
  const logs = populations.map(([rural, urban]) => Math.log1p(rural + urban));
  const [min, max] = extent(logs.filter(Boolean)) as [number, number]; // empty land stays the lightest
  const spread = max - min;

  const palette = new Map<string, number>();
  const cellColors = new Uint32Array(cells.i.length); // palette index + 1, 0 for water
  land.forEach((cellId, index) => {
    const [rural, urban] = populations[index];
    const total = rural + urban;
    const density = spread ? Math.max(0, logs[index] - min) / spread : 0;
    const color = hsl(240 + 120 * (total ? urban / total : 0), 1, 0.95 - 0.8 * density).formatHex();
    if (!palette.has(color)) palette.set(color, palette.size + 1);
    cellColors[cellId] = palette.get(color)!;
  });

  const colors = Array.from(palette.keys());
  const isolines = getIsolines(pack, cellId => cellColors[cellId] || null, { fill: true, waterGap: true });
  ensureEl("populationCells").innerHTML = buildFillPaths("populationCell", isolines, index => colors[index - 1]);

  TIME && console.timeEnd("drawPopulationCells");
}
