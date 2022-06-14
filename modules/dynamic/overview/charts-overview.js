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

  const {array: entityArray, getName: getEntityName, cellsData: entityCells} = dataMap[entity];
  const {getName: getGroupName, cellsData: groupCells} = dataMap[groupBy];
  const quantize = quantizationMap[plotBy];

  const chartData = entityArray
    .filter(element => !element.removed)
    .map(({i}) => {
      const cells = pack.cells.i.filter(cellId => entityCells[cellId] === i);
      const name = getEntityName(i);

      return Array.from(cells).map(cellId => {
        const group = getGroupName(groupCells[cellId]);
        const value = quantize(cellId);
        return {name, group, value};
      });
    })
    .flat();

  console.log(chartData);
  const chart = plot(chartData, {});
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
    title, // given d in data, returns the title text
    marginTop = 30, // top margin, in pixels
    marginRight = 0, // right margin, in pixels
    marginBottom = 40, // bottom margin, in pixels
    marginLeft = 100, // left margin, in pixels
    width = 2400, // outer width, in pixels
    height = 400, // outer height, in pixels
    xRange = [marginLeft, width - marginRight], // [xmin, xmax]
    xPadding = 0.1, // amount of x-range to reserve to separate groups
    yType = d3.scaleLinear, // type of y-scale
    yRange = [height - marginBottom, marginTop], // [ymin, ymax]
    zPadding = 0.05, // amount of x-range to reserve to separate bars
    yFormat, // a format specifier string for the y-axis
    yLabel, // a label for the y-axis
    colors = d3.schemeCategory10 // array of colors
  } = {}
) {
  const X = data.map(d => d.name);
  const Y = data.map(d => d.value);
  const Z = data.map(d => d.group);

  const xDomain = new Set(X);
  const yDomain = [0, d3.max(Y)];
  const zDomain = new Set(Z);

  // omit any data not present in both the x- and z-domain
  const I = d3.range(X.length).filter(i => xDomain.has(X[i]) && zDomain.has(Z[i]));

  const xDomainArray = Array.from(xDomain);
  const zDomainArray = Array.from(zDomain);

  // Construct scales, axes, and formats
  const xScale = d3.scaleBand(xDomainArray, xRange).paddingInner(xPadding);
  const xzScale = d3.scaleBand(zDomainArray, [0, xScale.bandwidth()]).padding(zPadding);
  const yScale = yType(yDomain, yRange);
  const zScale = d3.scaleOrdinal(zDomainArray, colors);
  const xAxis = d3.axisBottom(xScale).tickSizeOuter(0);
  const yAxis = d3.axisLeft(yScale).ticks(height / 60, yFormat);

  // Compute titles
  if (title === undefined) {
    const formatValue = yScale.tickFormat(100, yFormat);
    title = i => `${X[i]}\n${Z[i]}\n${formatValue(Y[i])}`;
  } else {
    const O = d3.map(data, d => d);
    const T = title;
    title = i => T(O[i], i, data);
  }

  const svg = d3
    .create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  svg
    .append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(yAxis)
    .call(g => g.select(".domain").remove())
    .call(g =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("x2", width - marginLeft - marginRight)
        .attr("stroke-opacity", 0.1)
    )
    .call(g =>
      g
        .append("text")
        .attr("x", -marginLeft)
        .attr("y", 10)
        .attr("fill", "currentColor")
        .attr("text-anchor", "start")
        .text(yLabel)
    );

  const bar = svg
    .append("g")
    .selectAll("rect")
    .data(I)
    .join("rect")
    .attr("x", i => xScale(X[i]) + xzScale(Z[i]))
    .attr("y", i => yScale(Y[i]))
    .attr("width", xzScale.bandwidth())
    .attr("height", i => yScale(0) - yScale(Y[i]))
    .attr("fill", i => zScale(Z[i]));

  if (title) bar.append("title").text(title);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .call(xAxis);

  const chart = Object.assign(svg.node(), {scales: {color: zScale}});
  console.log(chart);
  return chart;
}

// helper functions
function getUrbanPopulation(cellId) {
  const burgId = pack.cells.burg[cellId];
  if (!burgId) return 0;
  const populationPoints = pack.burgs[burgId].population;
  return populationPoints * populationRate * urbanization;
}

function getRuralPopulation(cellId) {
  const populationPoints = pack.cells.pop[cellId] * populationRate;
  return populationPoints * populationRate;
}
