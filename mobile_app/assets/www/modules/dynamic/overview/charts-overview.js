const entitiesMap = {
  states: {
    label: "State",
    getCellsData: () => pack.cells.state,
    getName: nameGetter("states"),
    getColors: colorsGetter("states"),
    landOnly: true
  },
  cultures: {
    label: "Culture",
    getCellsData: () => pack.cells.culture,
    getName: nameGetter("cultures"),
    getColors: colorsGetter("cultures"),
    landOnly: true
  },
  religions: {
    label: "Religion",
    getCellsData: () => pack.cells.religion,
    getName: nameGetter("religions"),
    getColors: colorsGetter("religions"),
    landOnly: true
  },
  provinces: {
    label: "Province",
    getCellsData: () => pack.cells.province,
    getName: nameGetter("provinces"),
    getColors: colorsGetter("provinces"),
    landOnly: true
  },
  biomes: {
    label: "Biome",
    getCellsData: () => pack.cells.biome,
    getName: biomeNameGetter,
    getColors: biomeColorsGetter,
    landOnly: false
  }
};

const quantizationMap = {
  total_population: {
    label: "Total population",
    quantize: cellId => getUrbanPopulation(cellId) + getRuralPopulation(cellId),
    aggregate: values => rn(d3.sum(values)),
    formatTicks: value => si(value),
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  urban_population: {
    label: "Urban population",
    quantize: getUrbanPopulation,
    aggregate: values => rn(d3.sum(values)),
    formatTicks: value => si(value),
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  rural_population: {
    label: "Rural population",
    quantize: getRuralPopulation,
    aggregate: values => rn(d3.sum(values)),
    formatTicks: value => si(value),
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  area: {
    label: "Land area",
    quantize: cellId => getArea(pack.cells.area[cellId]),
    aggregate: values => rn(d3.sum(values)),
    formatTicks: value => `${si(value)} ${getAreaUnit()}`,
    stringify: value => `${value.toLocaleString()} ${getAreaUnit()}`,
    stackable: true,
    landOnly: true
  },
  cells: {
    label: "Number of cells",
    quantize: () => 1,
    aggregate: values => d3.sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  burgs_number: {
    label: "Number of burgs",
    quantize: cellId => (pack.cells.burg[cellId] ? 1 : 0),
    aggregate: values => d3.sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  average_elevation: {
    label: "Average elevation",
    quantize: cellId => pack.cells.h[cellId],
    aggregate: values => d3.mean(values),
    formatTicks: value => getHeight(value),
    stringify: value => getHeight(value),
    stackable: false,
    landOnly: false
  },
  max_elevation: {
    label: "Maximum mean elevation",
    quantize: cellId => pack.cells.h[cellId],
    aggregate: values => d3.max(values),
    formatTicks: value => getHeight(value),
    stringify: value => getHeight(value),
    stackable: false,
    landOnly: false
  },
  min_elevation: {
    label: "Minimum mean elevation",
    quantize: cellId => pack.cells.h[cellId],
    aggregate: values => d3.min(values),
    formatTicks: value => getHeight(value),
    stringify: value => getHeight(value),
    stackable: false,
    landOnly: false
  },
  average_temperature: {
    label: "Annual mean temperature",
    quantize: cellId => grid.cells.temp[pack.cells.g[cellId]],
    aggregate: values => d3.mean(values),
    formatTicks: value => convertTemperature(value),
    stringify: value => convertTemperature(value),
    stackable: false,
    landOnly: false
  },
  max_temperature: {
    label: "Mean annual maximum temperature",
    quantize: cellId => grid.cells.temp[pack.cells.g[cellId]],
    aggregate: values => d3.max(values),
    formatTicks: value => convertTemperature(value),
    stringify: value => convertTemperature(value),
    stackable: false,
    landOnly: false
  },
  min_temperature: {
    label: "Mean annual minimum temperature",
    quantize: cellId => grid.cells.temp[pack.cells.g[cellId]],
    aggregate: values => d3.min(values),
    formatTicks: value => convertTemperature(value),
    stringify: value => convertTemperature(value),
    stackable: false,
    landOnly: false
  },
  average_precipitation: {
    label: "Annual mean precipitation",
    quantize: cellId => grid.cells.prec[pack.cells.g[cellId]],
    aggregate: values => rn(d3.mean(values)),
    formatTicks: value => getPrecipitation(rn(value)),
    stringify: value => getPrecipitation(rn(value)),
    stackable: false,
    landOnly: true
  },
  max_precipitation: {
    label: "Mean annual maximum precipitation",
    quantize: cellId => grid.cells.prec[pack.cells.g[cellId]],
    aggregate: values => rn(d3.max(values)),
    formatTicks: value => getPrecipitation(rn(value)),
    stringify: value => getPrecipitation(rn(value)),
    stackable: false,
    landOnly: true
  },
  min_precipitation: {
    label: "Mean annual minimum precipitation",
    quantize: cellId => grid.cells.prec[pack.cells.g[cellId]],
    aggregate: values => rn(d3.min(values)),
    formatTicks: value => getPrecipitation(rn(value)),
    stringify: value => getPrecipitation(rn(value)),
    stackable: false,
    landOnly: true
  },
  coastal_cells: {
    label: "Number of coastal cells",
    quantize: cellId => (pack.cells.t[cellId] === 1 ? 1 : 0),
    aggregate: values => d3.sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  river_cells: {
    label: "Number of river cells",
    quantize: cellId => (pack.cells.r[cellId] ? 1 : 0),
    aggregate: values => d3.sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  }
};

const plotTypeMap = {
  stackedBar: {offset: d3.stackOffsetDiverging},
  normalizedStackedBar: {offset: d3.stackOffsetExpand, formatX: value => rn(value * 100) + "%"}
};

let charts = []; // store charts data
let prevMapId = mapId;

appendStyleSheet();
insertHtml();
addListeners();
changeViewColumns();

export function open() {
  closeDialogs("#chartsOverview, .stable");

  if (prevMapId !== mapId) {
    charts = [];
    prevMapId = mapId;
  }

  if (!charts.length) addChart();
  else charts.forEach(chart => renderChart(chart));

  $("#chartsOverview").dialog({
    title: "Data Charts",
    position: {my: "center", at: "center", of: "svg"},
    close: handleClose
  });
}

function appendStyleSheet() {
  const style = document.createElement("style");
  style.textContent = /* css */ `
    #chartsOverview {
      max-width: 90vw !important;
      max-height: 90vh !important;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    #chartsOverview__form {
      font-size: 1.1em;
      margin: 0.3em 0;
      display: grid;
      grid-template-columns: auto auto;
      grid-gap: 0.3em;
      align-items: start;
     justify-items: end;
    }

    @media (max-width: 600px) {
      #chartsOverview__form {
        font-size: 1em;
        grid-template-columns: 1fr;
        justify-items: normal;
      }
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
      margin: 0 1% 0 4%;
      display: grid;
      grid-template-columns: 1fr auto;
    }
  `;

  document.head.appendChild(style);
}

function insertHtml() {
  const entities = Object.entries(entitiesMap).map(([entity, {label}]) => [entity, label]);
  const plotBy = Object.entries(quantizationMap).map(([plotBy, {label}]) => [plotBy, label]);

  const createOption = ([value, label]) => `<option value="${value}">${label}</option>`;
  const createOptions = values => values.map(createOption).join("");

  const html = /* html */ `<div id="chartsOverview" class="dialog stable">
    <form id="chartsOverview__form">
      <div>
        <button data-tip="Add a chart" type="submit">Plot</button>

        <select data-tip="Select entity (y axis)" id="chartsOverview__entitiesSelect">
          ${createOptions(entities)}
        </select>

        <label>by
          <select data-tip="Select value to plot by (x axis)" id="chartsOverview__plotBySelect">
            ${createOptions(plotBy)}
          </select>
        </label>

        <label>grouped by
          <select data-tip="Select entoty to group by. If you don't need grouping, set it the same as the entity" id="chartsOverview__groupBySelect">
            ${createOptions(entities)}
          </select>
        </label>

        <label data-tip="Sorting type">sorted
          <select id="chartsOverview__sortingSelect">
            <option value="value">by value</option>
            <option value="name">by name</option>
            <option value="natural">naturally</option>
          </select>
        </label>
      </div>
      <div>
        <span data-tip="Chart type">Type</span>
        <select id="chartsOverview__chartType">
          <option value="stackedBar" selected>Stacked Bar</option>
          <option value="normalizedStackedBar">Normalized Stacked Bar</option>
        </select>

        <span data-tip="Columns to display">Columns</span>
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
  byId("chartsOverview__form").on("submit", addChart);
  byId("chartsOverview__viewColumns").on("change", changeViewColumns);
}

function addChart(event) {
  if (event) event.preventDefault();

  const entity = byId("chartsOverview__entitiesSelect").value;
  const plotBy = byId("chartsOverview__plotBySelect").value;
  let groupBy = byId("chartsOverview__groupBySelect").value;
  const sorting = byId("chartsOverview__sortingSelect").value;
  const type = byId("chartsOverview__chartType").value;

  const {stackable} = quantizationMap[plotBy];

  if (!stackable && groupBy !== entity) {
    tip(`Grouping is not supported for ${plotByLabel}`, false, "warn", 4000);
    groupBy = entity;
  }

  const chartOptions = {id: Date.now(), entity, plotBy, groupBy, sorting, type};
  charts.push(chartOptions);
  renderChart(chartOptions);
  updateDialogPosition();
}

function renderChart({id, entity, plotBy, groupBy, sorting, type}) {
  const {
    label: plotByLabel,
    stringify,
    quantize,
    aggregate,
    formatTicks,
    landOnly: plotByLandOnly
  } = quantizationMap[plotBy];

  const noGrouping = groupBy === entity;

  const {
    label: entityLabel,
    getName: getEntityName,
    getCellsData: getEntityCellsData,
    landOnly: entityLandOnly
  } = entitiesMap[entity];
  const {label: groupLabel, getName: getGroupName, getCellsData: getGroupCellsData, getColors} = entitiesMap[groupBy];

  const entityCells = getEntityCellsData();
  const groupCells = getGroupCellsData();

  const title = `${capitalize(entity)} by ${plotByLabel}${noGrouping ? "" : " grouped by " + groupLabel}`;

  const tooltip = (entity, group, value, percentage) => {
    const entityTip = `${entityLabel}: ${entity}`;
    const groupTip = noGrouping ? "" : `${groupLabel}: ${group}`;
    let valueTip = `${plotByLabel}: ${stringify(value)}`;
    if (!noGrouping) valueTip += ` (${rn(percentage * 100)}%)`;
    return [entityTip, groupTip, valueTip].filter(Boolean);
  };

  const dataCollection = {};
  const groups = new Set();

  for (const cellId of pack.cells.i) {
    if ((entityLandOnly || plotByLandOnly) && isWater(cellId)) continue;
    const entityId = entityCells[cellId];
    const groupId = groupCells[cellId];
    const value = quantize(cellId);

    if (!dataCollection[entityId]) dataCollection[entityId] = {[groupId]: [value]};
    else if (!dataCollection[entityId][groupId]) dataCollection[entityId][groupId] = [value];
    else dataCollection[entityId][groupId].push(value);

    groups.add(groupId);
  }

  const chartData = Object.entries(dataCollection)
    .map(([entityId, groupData]) => {
      const name = getEntityName(entityId);
      return Object.entries(groupData).map(([groupId, values]) => {
        const group = getGroupName(groupId);
        const value = aggregate(values);
        return {name, group, value};
      });
    })
    .flat();

  const sortedData = sortData(chartData, sorting);
  const colors = getColors();
  const {offset, formatX = formatTicks} = plotTypeMap[type];

  const $chart = createStackedBarChart(sortedData, {colors, tooltip, offset, formatX});
  insertChart(id, sortedData, $chart, title);

  byId("chartsOverview__charts").lastChild.scrollIntoView();
}

// based on observablehq.com/@d3/stacked-horizontal-bar-chart
function createStackedBarChart(sortedData, {colors, tooltip, offset, formatX}) {
  const X = sortedData.map(d => d.value);
  const Y = sortedData.map(d => d.name);
  const Z = sortedData.map(d => d.group);

  const yDomain = new Set(Y);
  const zDomain = new Set(Z);
  const I = d3.range(X.length).filter(i => yDomain.has(Y[i]) && zDomain.has(Z[i]));

  const entities = Array.from(yDomain);
  const groups = Array.from(zDomain);

  const yScaleMinWidth = getTextMinWidth(entities);
  const legendRows = calculateLegendRows(groups, WIDTH - yScaleMinWidth - 15);

  const margin = {top: 30, right: 15, bottom: legendRows * 20 + 10, left: yScaleMinWidth};
  const xRange = [margin.left, WIDTH - margin.right];
  const height = yDomain.size * 25 + margin.top + margin.bottom;
  const yRange = [height - margin.bottom, margin.top];

  const rolled = rollups(...[I, ([i]) => i, i => Y[i], i => Z[i]]);

  const series = d3
    .stack()
    .keys(groups)
    .value(([, I], z) => X[new Map(I).get(z)])
    .order(d3.stackOrderNone)
    .offset(offset)(rolled)
    .map(s => {
      const defined = s.filter(d => !isNaN(d[1]));
      const data = defined.map(d => Object.assign(d, {i: new Map(d.data[1]).get(s.key)}));
      return {key: s.key, data};
    });

  const xDomain = d3.extent(series.map(d => d.data).flat(2));

  const xScale = d3.scaleLinear(xDomain, xRange);
  const yScale = d3.scaleBand(entities, yRange).paddingInner(Y_PADDING);

  const xAxis = d3.axisTop(xScale).ticks(WIDTH / 80, null);
  const yAxis = d3.axisLeft(yScale).tickSizeOuter(0);

  const svg = d3
    .create("svg")
    .attr("version", "1.1")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", [0, 0, WIDTH, height])
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  svg
    .append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(xAxis)
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("text").text(d => formatX(d)))
    .call(g =>
      g
        .selectAll(".tick line")
        .clone()
        .attr("y2", height - margin.top - margin.bottom)
        .attr("stroke-opacity", 0.1)
    );

  const bar = svg
    .append("g")
    .attr("stroke", "#666")
    .attr("stroke-width", 0.5)
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("fill", d => colors[d.key])
    .selectAll("rect")
    .data(d => d.data.filter(([x1, x2]) => x1 !== x2))
    .join("rect")
    .attr("x", ([x1, x2]) => Math.min(xScale(x1), xScale(x2)))
    .attr("y", ({i}) => yScale(Y[i]))
    .attr("width", ([x1, x2]) => Math.abs(xScale(x1) - xScale(x2)))
    .attr("height", yScale.bandwidth());

  const totalZ = Object.fromEntries(
    rollups(...[I, ([i]) => i, i => Y[i], i => X[i]]).map(([y, yz]) => [y, d3.sum(yz, yz => yz[0])])
  );
  const getTooltip = ({i}) => tooltip(Y[i], Z[i], X[i], X[i] / totalZ[Y[i]]);

  bar.append("title").text(d => getTooltip(d).join("\r\n"));
  bar.on("mouseover", d => tip(getTooltip(d).join(". ")));

  svg
    .append("g")
    .attr("transform", `translate(${xScale(0)},0)`)
    .call(yAxis);

  const rowElements = Math.ceil(groups.length / legendRows);
  const columnWidth = WIDTH / (rowElements + 0.5);

  const ROW_HEIGHT = 20;

  const getLegendX = (d, i) => (i % rowElements) * columnWidth;
  const getLegendLabelX = (d, i) => getLegendX(d, i) + LABEL_GAP;
  const getLegendY = (d, i) => Math.floor(i / rowElements) * ROW_HEIGHT;

  const legend = svg
    .append("g")
    .attr("stroke", "#666")
    .attr("stroke-width", 0.5)
    .attr("dominant-baseline", "central")
    .attr("transform", `translate(${margin.left},${height - margin.bottom + 15})`);

  legend
    .selectAll("circle")
    .data(groups)
    .join("rect")
    .attr("x", getLegendX)
    .attr("y", getLegendY)
    .attr("width", 10)
    .attr("height", 10)
    .attr("transform", "translate(-5, -5)")
    .attr("fill", d => colors[d]);

  legend
    .selectAll("text")
    .data(groups)
    .join("text")
    .attr("x", getLegendLabelX)
    .attr("y", getLegendY)
    .text(d => d);

  return svg.node();
}

function insertChart(id, sortedData, $chart, title) {
  const $chartContainer = byId("chartsOverview__charts");

  const $figure = document.createElement("figure");
  const $caption = document.createElement("figcaption");

  const figureNo = $chartContainer.childElementCount + 1;
  $caption.innerHTML = /* html */ `
    <div>
      <strong>Figure ${figureNo}</strong>. ${title}
    </div>
    <div>
      <button data-tip="Download chart data as a text file (.csv)" class="icon-download"></button>
      <button data-tip="Download the chart in svg format (can open in browser or Inkscape)" class="icon-chart-bar"></button>
      <button data-tip="Remove the chart" class="icon-trash"></button>
    </div>
  `;

  $figure.appendChild($chart);
  $figure.appendChild($caption);
  $chartContainer.appendChild($figure);

  const downloadChartData = () => {
    const name = `${getFileName(title)}.csv`;
    const headers = "Name,Group,Value\n";
    const values = sortedData.map(({name, group, value}) => `${name},${group},${value}`).join("\n");
    downloadFile(headers + values, name);
  };

  const downloadChartSvg = () => {
    const name = `${getFileName(title)}.svg`;
    downloadFile($chart.outerHTML, name);
  };

  const removeChart = () => {
    $figure.remove();
    charts = charts.filter(chart => chart.id !== id);
    updateDialogPosition();
  };

  $figure.querySelector("button.icon-download").on("click", downloadChartData);
  $figure.querySelector("button.icon-chart-bar").on("click", downloadChartSvg);
  $figure.querySelector("button.icon-trash").on("click", removeChart);
}

function changeViewColumns() {
  const columns = byId("chartsOverview__viewColumns").value;
  const $charts = byId("chartsOverview__charts");
  $charts.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  updateDialogPosition();
}

function updateDialogPosition() {
  $("#chartsOverview").dialog({position: {my: "center", at: "center", of: "svg"}});
}

function handleClose() {
  const $chartContainer = byId("chartsOverview__charts");
  $chartContainer.innerHTML = "";
  $("#chartsOverview").dialog("destroy");
}

// config
const NEUTRAL_COLOR = "#ccc";
const EMPTY_NAME = "no";

const WIDTH = 800;
const Y_PADDING = 0.2;

const RESERVED_PX_PER_CHAR = 7;
const LABEL_GAP = 10;

function getTextMinWidth(entities) {
  return d3.max(entities.map(name => name.length)) * RESERVED_PX_PER_CHAR;
}

function calculateLegendRows(groups, availableWidth) {
  const minWidth = LABEL_GAP + getTextMinWidth(groups);
  const maxInRow = Math.floor(availableWidth / minWidth);
  const legendRows = Math.ceil(groups.length / maxInRow);
  return legendRows;
}

function nameGetter(entity) {
  return i => pack[entity][i].name || EMPTY_NAME;
}

function colorsGetter(entity) {
  return () => Object.fromEntries(pack[entity].map(({name, color}) => [name || EMPTY_NAME, color || NEUTRAL_COLOR]));
}

function biomeNameGetter(i) {
  return biomesData.name[i] || EMPTY_NAME;
}

function biomeColorsGetter() {
  return Object.fromEntries(biomesData.i.map(i => [biomesData.name[i], biomesData.color[i]]));
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
