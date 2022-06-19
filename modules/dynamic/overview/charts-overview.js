import {rollup} from "../../../utils/functionUtils.js";
import {stack} from "https://cdn.skypack.dev/d3-shape@3";

const entitiesMap = {
  states: {
    label: "State",
    array: pack.states,
    cellsData: pack.cells.state,
    getName: nameGetter("states"),
    getColors: colorsGetter("states")
  },
  cultures: {
    label: "Culture",
    array: pack.cultures,
    cellsData: pack.cells.culture,
    getName: nameGetter("cultures"),
    getColors: colorsGetter("cultures")
  },
  religions: {
    label: "Religion",
    array: pack.religions,
    cellsData: pack.cells.religion,
    getName: nameGetter("religions"),
    getColors: colorsGetter("religions")
  }
};

const quantizationMap = {
  total_population: {
    label: "Total population",
    quantize: cellId => getUrbanPopulation(cellId) + getRuralPopulation(cellId),
    formatTicks: value => si(value),
    stringify: value => `${value.toLocaleString()} people`
  },
  urban_population: {
    label: "Urban population",
    quantize: getUrbanPopulation,
    formatTicks: value => si(value),
    stringify: value => `${value.toLocaleString()} people`
  },
  rural_population: {
    label: "Rural population",
    quantize: getRuralPopulation,
    formatTicks: value => si(value),
    stringify: value => `${value.toLocaleString()} people`
  },
  area: {
    label: "Land area",
    quantize: cellId => getArea(pack.cells.area[cellId]),
    formatTicks: value => `${si(value)} ${getAreaUnit()}`,
    stringify: value => `${value.toLocaleString()} ${getAreaUnit()}`
  },
  cells: {
    label: "Number of cells",
    quantize: () => 1,
    formatTicks: value => value,
    stringify: value => `${value.toLocaleString()} cells`
  }
};

appendStyleSheet();

insertHtml();
addListeners();
changeViewColumns();

export function open() {
  const charts = byId("chartsOverview__charts").childElementCount;
  if (!charts) renderChart();

  $("#chartsOverview").dialog({title: "Data Charts"});
}

function appendStyleSheet() {
  const styles = /* css */ `
    #chartsOverview {
      max-width: 90vw !important;
      max-height: 90vh !important;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    #chartsOverview__form {
      font-size: 1.1em;
      margin: 0.3em;
      display: flex;
      justify-content: space-between;
    }

    #chartsOverview__charts {
      overflow: auto;
      scroll-behavior: smooth;
      display: grid;
    }

    #chartsOverview__charts figure {
      margin: 0;
    }

    #chartsOverview__charts figcaption {
      font-size: 1.2em;
      margin-left: 4%;
    }

    .chartsOverview__bars {
      stroke: #666;
      stroke-width: 0.5;
    }
  `;

  const style = document.createElement("style");
  style.appendChild(document.createTextNode(styles));
  document.head.appendChild(style);
}

function insertHtml() {
  const entities = Object.entries(entitiesMap).map(([entity, {label}]) => [entity, label]);
  const plotBy = Object.entries(quantizationMap).map(([plotBy, {label}]) => [plotBy, label]);

  const createOption = ([value, label]) => `<option value="${value}">${label}</option>`;
  const createOptions = values => values.map(createOption).join("");

  const html = /* html */ `<div id="chartsOverview">
    <form id="chartsOverview__form">
      <div>
        <button type="submit">Plot</button>
        <select id="chartsOverview__entitiesSelect">${createOptions(entities)}</select>

        <span>by</span>
        <select id="chartsOverview__plotBySelect">${createOptions(plotBy)}</select>

        <span>grouped by</span>
        <select id="chartsOverview__groupBySelect">${createOptions(entities)}</select>

        <span>sorted</span>
        <select id="chartsOverview__sortingSelect">
          <option value="value">by value</option>
          <option value="name">by name</option>
          <option value="natural">naturally</option>
        </select>
      </div>
      <div>
        <span>Columns</span>
        <select id="chartsOverview__viewColumns">
          <option value="1" selected>1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
    </form>

    <section id="chartsOverview__charts"></section>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", html);

  // set defaults
  byId("chartsOverview__entitiesSelect").value = "states";
  byId("chartsOverview__plotBySelect").value = "total_population";
  byId("chartsOverview__groupBySelect").value = "cultures";
}

function addListeners() {
  byId("chartsOverview__form").on("submit", renderChart);
  byId("chartsOverview__viewColumns").on("change", changeViewColumns);
}

function renderChart(event) {
  if (event) event.preventDefault();

  const entity = byId("chartsOverview__entitiesSelect").value;
  const plotBy = byId("chartsOverview__plotBySelect").value;
  const groupBy = byId("chartsOverview__groupBySelect").value;
  const sorting = byId("chartsOverview__sortingSelect").value;

  const noGrouping = groupBy === entity;

  const filterWater = true;

  const {label: plotByLabel, stringify, quantize, formatTicks} = quantizationMap[plotBy];
  const {label: entityLabel, getName: getEntityName, cellsData: entityCells} = entitiesMap[entity];
  const {label: groupLabel, getName: getGroupName, cellsData: groupCells, getColors} = entitiesMap[groupBy];

  const title = `${capitalize(entity)} by ${plotByLabel}${noGrouping ? "" : " grouped by " + groupLabel}`;

  const tooltip = (entity, group, value) => {
    const entityTip = `${entityLabel}: ${entity}`;
    const groupTip = noGrouping ? "" : `${groupLabel}: ${group}`;
    const valueTip = `${plotByLabel}: ${stringify(value)}`;
    tip([entityTip, groupTip, valueTip].filter(Boolean).join(". "));
  };

  const dataCollection = {};
  const groups = new Set();

  for (const cellId of pack.cells.i) {
    if (filterWater && isWater(cellId)) continue;
    const entityId = entityCells[cellId];
    const groupId = groupCells[cellId];
    const value = quantize(cellId);

    if (!dataCollection[entityId]) dataCollection[entityId] = {[groupId]: value};
    else if (!dataCollection[entityId][groupId]) dataCollection[entityId][groupId] = value;
    else dataCollection[entityId][groupId] += value;

    groups.add(groupId);
  }

  // fill missing groups with 0
  for (const entityId in dataCollection) {
    for (const groupId of groups) {
      if (!dataCollection[entityId][groupId]) dataCollection[entityId][groupId] = 0;
    }
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

  const colors = getColors();

  const chart = plot(chartData, {sorting, colors, formatTicks, tooltip});
  insertChart(chart, title);

  byId("chartsOverview__charts").lastChild.scrollIntoView();
  updateDialog();
}

// based on observablehq.com/@d3/stacked-horizontal-bar-chart
function plot(
  data,
  {
    marginTop = 30, // top margin, in pixels
    marginRight = 10, // right margin, in pixels
    marginBottom = 10, // bottom margin, in pixels
    marginLeft = 80, // left margin, in pixels
    width = 800, // outer width, in pixels
    xRange = [marginLeft, width - marginRight], // [xmin, xmax]
    yPadding = 0.2,
    sorting,
    colors,
    formatTicks,
    tooltip
  } = {}
) {
  const sortedData = sortData(data, sorting);

  const X = sortedData.map(d => d.value);
  const Y = sortedData.map(d => d.name);
  const Z = sortedData.map(d => d.group);

  const yDomain = new Set(Y);
  const zDomain = new Set(Z);

  const I = d3.range(X.length).filter(i => X[i] > 0 && yDomain.has(Y[i]) && zDomain.has(Z[i]));

  const height = yDomain.size * 25 + marginTop + marginBottom;
  const yRange = [height - marginBottom, marginTop];

  const rolled = rollup(...[I, ([i]) => i, i => Y[i], i => Z[i]]);

  const series = stack()
    .keys(zDomain)
    .value(([, I], z) => X[I.get(z)])
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetDiverging)(rolled)
    .map(s => {
      const nonNull = s.filter(d => Boolean(d[1]));
      const data = nonNull.map(d => Object.assign(d, {i: d.data[1].get(s.key)}));
      return {key: s.key, data};
    });

  const xDomain = d3.extent(series.map(d => d.data).flat(2));

  const xScale = d3.scaleLinear(xDomain, xRange);
  const yScale = d3.scaleBand(Array.from(yDomain), yRange).paddingInner(yPadding);

  const xAxis = d3.axisTop(xScale).ticks(width / 80, null);
  const yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

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
    .call(g => g.selectAll("text").text(d => formatTicks(d)))
    .call(g =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("y2", height - marginTop - marginBottom)
        .attr("stroke-opacity", 0.1)
    );

  const bar = svg
    .append("g")
    .attr("class", "chartsOverview__bars")
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("fill", d => colors[d.key])
    .selectAll("rect")
    .data(d => d.data)
    .join("rect")
    .attr("x", ([x1, x2]) => Math.min(xScale(x1), xScale(x2)))
    .attr("y", ({i}) => yScale(Y[i]))
    .attr("width", ([x1, x2]) => Math.abs(xScale(x1) - xScale(x2)))
    .attr("height", yScale.bandwidth());

  bar.on("mouseover", ({i}) => tooltip(Y[i], Z[i], X[i]));

  svg
    .append("g")
    .attr("transform", `translate(${xScale(0)},0)`)
    .call(yAxis);

  return svg.node();
}

function insertChart(chart, title) {
  const $chartContainer = byId("chartsOverview__charts");

  const $figure = document.createElement("figure");
  const $caption = document.createElement("figcaption");

  const figureNo = $chartContainer.childElementCount + 1;
  $caption.innerHTML = `<strong>Figure ${figureNo}</strong>. ${title}`;

  $figure.appendChild(chart);
  $figure.appendChild($caption);

  $chartContainer.appendChild($figure);
}

function changeViewColumns() {
  const columns = byId("chartsOverview__viewColumns").value;
  const $charts = byId("chartsOverview__charts");
  $charts.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  updateDialog();
}

function updateDialog() {
  $("#chartsOverview").dialog({position: {my: "center", at: "center", of: window}});
}

// config
const NEUTRAL_COLOR = "#ccc";

// helper functions
function nameGetter(entity) {
  return i => pack[entity][i].name;
}
function colorsGetter(entity) {
  return () => Object.fromEntries(pack[entity].map(({name, color}) => [name, color || NEUTRAL_COLOR]));
}

function getUrbanPopulation(cellId) {
  const burgId = pack.cells.burg[cellId];
  if (!burgId) return 0;
  const populationPoints = pack.burgs[burgId].population;
  return populationPoints * populationRate * urbanization;
}

function getRuralPopulation(cellId) {
  return pack.cells.pop[cellId] * populationRate;
}

function sortData(data, sorting) {
  if (sorting === "natural") return data;

  if (sorting === "name") {
    return data.sort((a, b) => {
      if (a.name !== b.name) return b.name.localeCompare(a.name); // reversed as 1st element is the bottom
      return a.group.localeCompare(b.group);
    });
  }

  if (sorting === "value") {
    const entitySum = {};
    const groupSum = {};
    for (const {name, group, value} of data) {
      entitySum[name] = (entitySum[name] || 0) + value;
      groupSum[group] = (groupSum[group] || 0) + value;
    }

    return data.sort((a, b) => {
      if (a.name !== b.name) return entitySum[a.name] - entitySum[b.name]; // reversed as 1st element is the bottom
      return groupSum[b.group] - groupSum[a.group];
    });
  }

  return data;
}
