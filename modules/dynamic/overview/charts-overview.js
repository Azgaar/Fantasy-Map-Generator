import {rollup} from "../../../utils/functionUtils.js";
import {stack} from "https://cdn.skypack.dev/d3-shape@3";

const entities = ["states", "cultures", "religions"];
const quantitatives = ["total_population", "urban_population", "rural_population", "area", "cells"];
const groupings = ["cultures", "states", "religions"];

const dataMap = {
  states: {array: pack.states, getName: i => pack.states[i].name, cellsData: pack.cells.state},
  cultures: {array: pack.cultures, getName: i => pack.cultures[i].name, cellsData: pack.cells.culture},
  religions: {array: pack.religions, getName: i => pack.religions[i].name, cellsData: pack.cells.religion}
};

const quantizationMap = {
  total_population: cellId => getUrbanPopulation(cellId) + getRuralPopulation(cellId),
  urban_population: getUrbanPopulation,
  rural_population: getRuralPopulation,
  area: cellId => getArea(pack.cells.area[cellId]),
  cells: () => 1
};

const sortingMap = {
  value: (a, b) => b.value - a.value,
  name: (a, b) => a.name.localeCompare(b.name)
};

appendStyleSheet();

insertHtml();
const $entitiesSelect = byId("chartsOverview__entitiesSelect");
const $plotBySelect = byId("chartsOverview__plotBySelect");
const $groupBySelect = byId("chartsOverview__groupBySelect");
updateSelectorOptions();
addListeners();

export function open() {
  renderChart();

  $("#chartsOverview").dialog({
    title: "Charts"
  });
}

function appendStyleSheet() {
  const styles = /* css */ `
  `;

  const style = document.createElement("style");
  style.appendChild(document.createTextNode(styles));
  document.head.appendChild(style);
}

function insertHtml() {
  const createOption = value => `<option value="${value}">${value.replaceAll("_", " ")}</option>`;
  const createOptions = values => values.map(createOption).join("");

  const html = /* html */ `<div id="chartsOverview" style="overflow: disabled;">
    <div>
      <span>Plot</span>
      <select id="chartsOverview__entitiesSelect">${createOptions(entities)}</select>

      <span>by</span>
      <select id="chartsOverview__plotBySelect">${createOptions(quantitatives)}</select>

      <span>grouped by</span>
      <select id="chartsOverview__groupBySelect">${createOptions(groupings)}</select>
    </div>

    <div id="chartsOverview__svgContainer"></div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", html);
}

function addListeners() {
  $entitiesSelect.on("change", renderChart);
  $plotBySelect.on("change", renderChart);
  $groupBySelect.on("change", renderChart);

  $entitiesSelect.on("change", updateSelectorOptions);
  $groupBySelect.on("change", updateSelectorOptions);
}

function renderChart() {
  const entity = $entitiesSelect.value;
  const plotBy = $plotBySelect.value;
  const groupBy = $groupBySelect.value;

  const filterWater = true;
  const filterZeroes = true;
  const sorting = sortingMap["value"];

  const {getName: getEntityName, cellsData: entityCells} = dataMap[entity];
  const {getName: getGroupName, cellsData: groupCells} = dataMap[groupBy];
  const quantize = quantizationMap[plotBy];

  const dataCollection = {};
  for (const cellId of pack.cells.i) {
    if (filterWater && isWater(cellId)) continue;
    const entityId = entityCells[cellId];
    const groupId = groupCells[cellId];
    const value = quantize(cellId);

    if (!dataCollection[entityId]) dataCollection[entityId] = {[groupId]: value};
    else if (!dataCollection[entityId][groupId]) dataCollection[entityId][groupId] = value;
    else dataCollection[entityId][groupId] += value;
  }

  const chartData = Object.entries(dataCollection)
    .map(([entityId, groupData]) => {
      const name = getEntityName(entityId);
      return Object.entries(groupData).map(([groupId, rawValue]) => {
        const group = getGroupName(groupId);
        const value = rn(rawValue);
        return {name, group, value};
      });
    })
    .flat();

  const chartDataFiltered = filterZeroes ? chartData.filter(({value}) => value > 0) : chartData;

  const chart = plot(chartDataFiltered, {sorting});
  byId("chartsOverview__svgContainer").appendChild(chart);
}

function updateSelectorOptions() {
  const entity = $entitiesSelect.value;
  $groupBySelect.querySelector("option[disabled]")?.removeAttribute("disabled");
  $groupBySelect.querySelector(`option[value="${entity}"]`)?.setAttribute("disabled", "");

  const group = $groupBySelect.value;
  $entitiesSelect.querySelector("option[disabled]")?.removeAttribute("disabled");
  $entitiesSelect.querySelector(`option[value="${group}"]`)?.setAttribute("disabled", "");
}

// based on https://observablehq.com/@d3/grouped-bar-chart
function plot(
  data,
  {
    marginTop = 30, // top margin, in pixels
    marginRight = 0, // right margin, in pixels
    marginBottom = 40, // bottom margin, in pixels
    marginLeft = 100, // left margin, in pixels
    width = 800, // outer width, in pixels
    xRange = [marginLeft, width - marginRight], // [xmin, xmax]
    yPadding = 0.2,
    xFormat,
    xLabel = "Population (millions) →",
    sorting
  } = {}
) {
  const X = data.map(d => d.value);
  const Y = data.map(d => d.name);
  const Z = data.map(d => d.group);

  const yDomain = new Set(Y); // get from parent, already sorted
  const zDomain = new Set(Z);

  // omit any data not present in both the y- and z-domain
  const I = d3.range(X.length).filter(i => yDomain.has(Y[i]) && zDomain.has(Z[i]));

  const height = yDomain.size * 25 + marginTop + marginBottom;
  const yRange = [height - marginBottom, marginTop];

  const offset = d3.stackOffsetDiverging;
  const order = d3.stackOrderNone;

  const series = stack()
    .keys(zDomain)
    .value(([, I], z) => X[I.get(z)])
    .order(order)
    .offset(offset)(
      rollup(
        I,
        ([i]) => i,
        i => Y[i],
        i => Z[i]
      )
    )
    .map(s => s.map(d => Object.assign(d, {i: d.data[1].get(s.key)})));

  const xDomain = d3.extent(series.flat(2));

  const xScale = d3.scaleLinear(xDomain, xRange);
  const yScale = d3.scaleBand(Array.from(yDomain), yRange).paddingInner(yPadding);
  const color = d3.scaleOrdinal(Array.from(zDomain), d3.schemeCategory10);
  const xAxis = d3.axisTop(xScale).ticks(width / 80, xFormat);
  const yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

  const formatValue = xScale.tickFormat(100, xFormat);
  const title = i => `${Y[i]}\n${Z[i]}\n${formatValue(X[i])}`;

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  svg
    .append("g")
    .attr("transform", `translate(0,${marginTop})`)
    .call(xAxis)
    .call(g => g.select(".domain").remove())
    .call(g =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("y2", height - marginTop - marginBottom)
        .attr("stroke-opacity", 0.1)
    )
    .call(g =>
      g
        .append("text")
        .attr("x", width - marginRight)
        .attr("y", -22)
        .attr("fill", "currentColor")
        .attr("text-anchor", "end")
        .text(xLabel)
    );

  const bar = svg
    .append("g")
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("fill", ([{i}]) => color(Z[i]))
    .selectAll("rect")
    .data(d => d.filter(d => d.i !== undefined))
    .join("rect")
    .attr("x", ([x1, x2]) => Math.min(xScale(x1), xScale(x2)))
    .attr("y", ({i}) => yScale(Y[i]))
    .attr("width", ([x1, x2]) => Math.abs(xScale(x1) - xScale(x2)))
    .attr("height", yScale.bandwidth());

  bar.append("title").text(({i}) => title(i));

  svg
    .append("g")
    .attr("transform", `translate(${xScale(0)},0)`)
    .call(yAxis);

  return Object.assign(svg.node(), {scales: {color}});
}

// helper functions
function getUrbanPopulation(cellId) {
  const burgId = pack.cells.burg[cellId];
  if (!burgId) return 0;
  const populationPoints = pack.burgs[burgId].population;
  return populationPoints * populationRate * urbanization;
}

function getRuralPopulation(cellId) {
  return pack.cells.pop[cellId] * populationRate;
}
