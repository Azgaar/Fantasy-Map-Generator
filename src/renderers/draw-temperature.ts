import {
  color,
  curveBasisClosed,
  interpolateSpectral,
  leastIndex,
  line,
  max,
  min,
  range,
  scaleSequential,
} from "d3";
import { byId, connectVertices, convertTemperature, round } from "../utils";

declare global {
  var drawTemperature: () => void;
}

const temperatureRenderer = (): void => {
  TIME && console.time("drawTemperature");

  temperature.selectAll("*").remove();
  const lineGen = line<[number, number]>().curve(curveBasisClosed);
  const scheme = scaleSequential(interpolateSpectral);

  const tMax = +(byId("temperatureEquatorOutput") as HTMLInputElement).max;
  const tMin = +(byId("temperatureEquatorOutput") as HTMLInputElement).min;
  const delta = tMax - tMin;

  const { cells, vertices } = grid;
  const n = cells.i.length;

  const checkedCells = new Uint8Array(n);
  const addToChecked = (cellId: number) => {
    checkedCells[cellId] = 1;
  };

  const minTemp = Number(min(cells.temp)) || 0;
  const maxTemp = Number(max(cells.temp)) || 0;
  const step = Math.max(Math.round(Math.abs(minTemp - maxTemp) / 5), 1);

  const isolines = range(minTemp + step, maxTemp, step);
  const chains: [number, [number, number][]][] = [];
  const labels: [number, number, number][] = []; // store label coordinates

  for (const cellId of cells.i) {
    const t = cells.temp[cellId];
    if (checkedCells[cellId] || !isolines.includes(t)) continue;

    const startingVertex = findStart(cellId, t);
    if (!startingVertex) continue;
    checkedCells[cellId] = 1;

    const ofSameType = (cellId: number) => cells.temp[cellId] >= t;
    const chain = connectVertices({
      vertices,
      startingVertex,
      ofSameType,
      addToChecked,
    });
    const relaxed = chain.filter(
      (v: number, i: number) =>
        i % 4 === 0 || vertices.c[v].some((c: number) => c >= n),
    );
    if (relaxed.length < 6) continue;

    const points: [number, number][] = relaxed.map(
      (v: number) => vertices.p[v],
    );
    chains.push([t, points]);
    addLabel(points, t);
  }

  // min temp isoline covers all graph
  temperature
    .append("path")
    .attr("d", `M0,0 h${graphWidth} v${graphHeight} h${-graphWidth} Z`)
    .attr("fill", scheme(1 - (minTemp - tMin) / delta))
    .attr("stroke", "none");

  for (const t of isolines) {
    const path = chains
      .filter((c) => c[0] === t)
      .map((c) => round(lineGen(c[1]) || ""))
      .join("");
    if (!path) continue;
    const fill = scheme(1 - (t - tMin) / delta);
    const stroke = color(fill)!.darker(0.2);
    temperature
      .append("path")
      .attr("d", path)
      .attr("fill", fill)
      .attr("stroke", stroke.toString());
  }

  const tempLabels = temperature
    .append("g")
    .attr("id", "tempLabels")
    .attr("fill-opacity", 1);
  tempLabels
    .selectAll("text")
    .data(labels)
    .enter()
    .append("text")
    .attr("x", (d) => d[0])
    .attr("y", (d) => d[1])
    .text((d) => convertTemperature(d[2]));

  // find cell with temp < isotherm and find vertex to start path detection
  function findStart(i: number, t: number): number | undefined {
    if (cells.b[i])
      return cells.v[i].find((v: number) =>
        vertices.c[v].some((c: number) => c >= n),
      ); // map border cell
    return cells.v[i][
      cells.c[i].findIndex((c: number) => cells.temp[c] < t || !cells.temp[c])
    ];
  }

  function addLabel(points: [number, number][], t: number): void {
    const xCenter = svgWidth / 2;

    // add label on isoline top center
    const tcIndex = leastIndex(
      points,
      (a: [number, number], b: [number, number]) =>
        a[1] - b[1] + (Math.abs(a[0] - xCenter) - Math.abs(b[0] - xCenter)) / 2,
    );
    const tc = points[tcIndex!];
    pushLabel(tc[0], tc[1], t);

    // add label on isoline bottom center
    if (points.length > 20) {
      const bcIndex = leastIndex(
        points,
        (a: [number, number], b: [number, number]) =>
          b[1] -
          a[1] +
          (Math.abs(a[0] - xCenter) - Math.abs(b[0] - xCenter)) / 2,
      );
      const bc = points[bcIndex!];
      const dist2 = (tc[1] - bc[1]) ** 2 + (tc[0] - bc[0]) ** 2; // square distance between this and top point
      if (dist2 > 100) pushLabel(bc[0], bc[1], t);
    }
  }

  function pushLabel(x: number, y: number, t: number): void {
    if (x < 20 || x > svgWidth - 20) return;
    if (y < 20 || y > svgHeight - 20) return;
    labels.push([x, y, t]);
  }

  TIME && console.timeEnd("drawTemperature");
};

window.drawTemperature = temperatureRenderer;
