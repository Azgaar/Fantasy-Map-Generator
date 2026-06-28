import {
  axisLeft,
  axisTop,
  create,
  extent,
  max,
  mean,
  min,
  range,
  rollups,
  type SeriesPoint,
  scaleBand,
  scaleLinear,
  stack,
  stackOffsetDiverging,
  stackOffsetExpand,
  stackOrderNone,
  sum
} from "d3";
import { capitalize, convertTemperature, ensureEl, formatPrice, isWater, rn, si } from "../utils";

interface Dimension {
  label: string;
  getId: (cellId: number, contribution: Contribution) => number;
  getName: (id: string | number) => string;
  getColors: () => Record<string, string>;
  landOnly: boolean;
  requires?: string;
}

interface Metric {
  label: string;
  hint?: string;
  stringify: (value: number) => string;
  aggregate: (values: number[]) => number;
  formatTicks: (value: number) => string | number;
  stackable: boolean;
  landOnly: boolean;
  quantize?: (cellId: number) => number; // scalar metrics: one value per cell
  getContributions?: (cellId: number, ctx: ProductionContext) => Contribution[]; // tagged metrics: many per cell
  prepare?: () => ProductionContext; // computed once per render and passed to getContributions
  provides?: string[]; // contribution tags this metric supplies (matched against Dimension.requires)
}

interface Contribution {
  value: number;
  good?: number;
}

interface ChartOptions {
  id: number;
  entity: string;
  plotBy: string;
  groupBy: string;
  sorting: string;
  type: string;
  excludeNeutral: boolean;
}

interface ChartDatum {
  name: string;
  group: string;
  value: number;
}

type BiomeProduction = Record<number, { goodId: number; production: number }[]>;

interface ProductionContext {
  biomeProduction: BiomeProduction;
}

type NamedColored = { name?: string; color?: string };
type CollectionKey = "states" | "cultures" | "religions" | "provinces";

type RolledEntry = [string, [string, number][]];
type BarPoint = SeriesPoint<RolledEntry> & { i: number };
interface StackSeries {
  key: string;
  data: BarPoint[];
}

const entitiesMap: Record<string, Dimension> = {
  states: {
    label: "State",
    getId: cellId => pack.cells.state[cellId],
    getName: nameGetter("states"),
    getColors: colorsGetter("states"),
    landOnly: true
  },
  cultures: {
    label: "Culture",
    getId: cellId => pack.cells.culture[cellId],
    getName: nameGetter("cultures"),
    getColors: colorsGetter("cultures"),
    landOnly: true
  },
  religions: {
    label: "Religion",
    getId: cellId => pack.cells.religion[cellId],
    getName: nameGetter("religions"),
    getColors: colorsGetter("religions"),
    landOnly: true
  },
  provinces: {
    label: "Province",
    getId: cellId => pack.cells.province[cellId],
    getName: nameGetter("provinces"),
    getColors: colorsGetter("provinces"),
    landOnly: true
  },
  biomes: {
    label: "Biome",
    getId: cellId => pack.cells.biome[cellId],
    getName: biomeNameGetter,
    getColors: biomeColorsGetter,
    landOnly: false
  },
  markets: {
    label: "Market",
    getId: cellId => pack.cells.market[cellId],
    getName: marketNameGetter,
    getColors: marketColorsGetter,
    landOnly: false
  },
  goods: {
    label: "Good",
    requires: "good",
    getId: (_cellId, contribution) => contribution.good!,
    getName: goodNameGetter,
    getColors: goodColorsGetter,
    landOnly: false
  }
};

const quantizationMap: Record<string, Metric> = {
  total_population: {
    label: "Total population",
    quantize: cellId => getUrbanPopulation(cellId) + getRuralPopulation(cellId),
    aggregate: values => rn(sum(values)),
    formatTicks: value => si(value),
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  urban_population: {
    label: "Urban population",
    quantize: getUrbanPopulation,
    aggregate: values => rn(sum(values)),
    formatTicks: value => si(value),
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  rural_population: {
    label: "Rural population",
    quantize: getRuralPopulation,
    aggregate: values => rn(sum(values)),
    formatTicks: value => si(value),
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  area: {
    label: "Land area",
    quantize: cellId => getArea(pack.cells.area[cellId]),
    aggregate: values => rn(sum(values)),
    formatTicks: value => `${si(value)} ${getAreaUnit()}`,
    stringify: value => `${value.toLocaleString()} ${getAreaUnit()}`,
    stackable: true,
    landOnly: true
  },
  cells: {
    label: "Cells",
    hint: "Number of land cells",
    quantize: () => 1,
    aggregate: values => sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  burgs_number: {
    label: "Burgs",
    hint: "Number of burgs",
    quantize: cellId => (pack.cells.burg[cellId] ? 1 : 0),
    aggregate: values => sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  average_elevation: {
    label: "Average elevation",
    quantize: cellId => pack.cells.h[cellId],
    aggregate: values => mean(values)!,
    formatTicks: value => getHeight(value),
    stringify: value => getHeight(value),
    stackable: false,
    landOnly: false
  },
  max_elevation: {
    label: "Maximum mean elevation",
    quantize: cellId => pack.cells.h[cellId],
    aggregate: values => max(values)!,
    formatTicks: value => getHeight(value),
    stringify: value => getHeight(value),
    stackable: false,
    landOnly: false
  },
  min_elevation: {
    label: "Minimum mean elevation",
    quantize: cellId => pack.cells.h[cellId],
    aggregate: values => min(values)!,
    formatTicks: value => getHeight(value),
    stringify: value => getHeight(value),
    stackable: false,
    landOnly: false
  },
  average_temperature: {
    label: "Annual mean temperature",
    quantize: cellId => grid.cells.temp[pack.cells.g[cellId]],
    aggregate: values => mean(values)!,
    formatTicks: value => convertTemperature(value),
    stringify: value => convertTemperature(value),
    stackable: false,
    landOnly: false
  },
  max_temperature: {
    label: "Annual max temperature",
    hint: "Highest mean temperature of the year",
    quantize: cellId => grid.cells.temp[pack.cells.g[cellId]],
    aggregate: values => max(values)!,
    formatTicks: value => convertTemperature(value),
    stringify: value => convertTemperature(value),
    stackable: false,
    landOnly: false
  },
  min_temperature: {
    label: "Annual min temperature",
    hint: "Lowest mean temperature of the year",
    quantize: cellId => grid.cells.temp[pack.cells.g[cellId]],
    aggregate: values => min(values)!,
    formatTicks: value => convertTemperature(value),
    stringify: value => convertTemperature(value),
    stackable: false,
    landOnly: false
  },
  average_precipitation: {
    label: "Annual mean precipitation",
    quantize: cellId => grid.cells.prec[pack.cells.g[cellId]],
    aggregate: values => rn(mean(values)!),
    formatTicks: value => getPrecipitation(rn(value)),
    stringify: value => getPrecipitation(rn(value)),
    stackable: false,
    landOnly: true
  },
  max_precipitation: {
    label: "Annual max precipitation",
    hint: "Highest mean precipitation of the year",
    quantize: cellId => grid.cells.prec[pack.cells.g[cellId]],
    aggregate: values => rn(max(values)!),
    formatTicks: value => getPrecipitation(rn(value)),
    stringify: value => getPrecipitation(rn(value)),
    stackable: false,
    landOnly: true
  },
  min_precipitation: {
    label: "Annual min precipitation",
    hint: "Lowest mean precipitation of the year",
    quantize: cellId => grid.cells.prec[pack.cells.g[cellId]],
    aggregate: values => rn(min(values)!),
    formatTicks: value => getPrecipitation(rn(value)),
    stringify: value => getPrecipitation(rn(value)),
    stackable: false,
    landOnly: true
  },
  coastal_cells: {
    label: "Number of coastal cells",
    quantize: cellId => (pack.cells.t[cellId] === 1 ? 1 : 0),
    aggregate: values => sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  river_cells: {
    label: "Number of river cells",
    quantize: cellId => (pack.cells.r[cellId] ? 1 : 0),
    aggregate: values => sum(values),
    formatTicks: value => value,
    stringify: value => value.toLocaleString(),
    stackable: true,
    landOnly: true
  },
  production_value: {
    label: "Production value",
    hint: "Worth of produced goods",
    provides: ["good"],
    prepare: () => ({ biomeProduction: Goods.getBiomesProduction() }),
    getContributions: (cellId, { biomeProduction }) => {
      const produced = getCellProductionByGood(cellId, biomeProduction);
      const contributions: Contribution[] = [];
      for (const [goodId, units] of Object.entries(produced)) {
        const good = Goods.get(+goodId);
        if (good) contributions.push({ good: +goodId, value: units * good.value });
      }
      return contributions;
    },
    aggregate: values => rn(sum(values)),
    formatTicks: value => si(value),
    stringify: value => formatPrice(value),
    stackable: true,
    landOnly: true
  },
  production_units: {
    label: "Production volume",
    hint: "Units of goods produced",
    provides: ["good"],
    prepare: () => ({ biomeProduction: Goods.getBiomesProduction() }),
    getContributions: (cellId, { biomeProduction }) => {
      const produced = getCellProductionByGood(cellId, biomeProduction);
      const contributions: Contribution[] = [];
      for (const [goodId, units] of Object.entries(produced)) contributions.push({ good: +goodId, value: units });
      return contributions;
    },
    aggregate: values => rn(sum(values)),
    formatTicks: value => si(value),
    stringify: value => `${value.toLocaleString()} units`,
    stackable: true,
    landOnly: true
  },
  burgs_profit: {
    label: "Burgs profit",
    hint: "Burgs profit from trade and manufacturing",
    quantize: cellId => {
      const burgId = pack.cells.burg[cellId];
      return burgId ? pack.burgs[burgId].product || 0 : 0;
    },
    aggregate: values => rn(sum(values)),
    formatTicks: value => si(value),
    stringify: value => formatPrice(value),
    stackable: true,
    landOnly: true
  }
};

const plotTypeMap: Record<
  string,
  { offset: typeof stackOffsetDiverging; formatX?: (value: number) => string | number }
> = {
  stackedBar: { offset: stackOffsetDiverging },
  normalizedStackedBar: { offset: stackOffsetExpand, formatX: value => `${rn(value * 100)}%` }
};

let charts: ChartOptions[] = [];
let prevMapId: number | undefined;
let isInitialized = false;

function open() {
  if (!isInitialized) {
    appendStyleSheet();
    insertHtml();
    addListeners();
    changeViewColumns();
    updateMetricInfo();
    isInitialized = true;
  }

  closeDialogs("#chartsOverview, .stable");

  if (prevMapId !== mapId) {
    charts = [];
    prevMapId = mapId;
  }

  if (!charts.length) addChart();
  else for (const chart of charts) renderChart(chart);

  $("#chartsOverview").dialog({
    title: "Data Charts",
    width: "60vw",
    height: "auto",
    position: { my: "center", at: "center", of: "svg" },
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
      display: grid;
      font-size: 1.1em;
      margin: 0.3em 0;
    }

    #chartsOverview__form > div:first-child {
      display: flex;
      align-items: center;
      gap: 0.2em;
    }

    #chartsOverview__form > div:nth-child(2) {
      display: flex;
      align-items: center;
      gap: 1em;
    }

    #chartsOverview__form label {
      display: inline-flex;
      align-items: center;
    }

    #chartsOverview__charts {
      overflow: auto;
      scroll-behavior: smooth;
      display: grid;
    }

    #chartsOverview__charts figure {
      margin: 0;
      padding: 0.6em 0 1em;
      border-top: 1px solid rgba(128, 128, 128, 0.4);
    }

    #chartsOverview__charts figcaption {
      font-size: 1.2em;
      margin: 0 1% 0.4em 4%;
      display: grid;
      align-items: center;
      grid-template-columns: 1fr auto;
    }

    #chartsOverview__plotByInfo {
      margin-left: 0.3em;
      cursor: help;
      opacity: 0.6;
    }
  `;

  document.head.appendChild(style);
}

function insertHtml() {
  const entities = Object.entries(entitiesMap).map(([entity, { label }]): [string, string] => [entity, label]);
  const plotBy = Object.entries(quantizationMap).map(([plotBy, { label }]): [string, string] => [plotBy, label]);

  const createOption = ([value, label]: [string, string]) => `<option value="${value}">${label}</option>`;
  const createOptions = (values: [string, string][]) => values.map(createOption).join("");

  const html = /* html */ `<div id="chartsOverview" class="dialog stable">
    <form id="chartsOverview__form">
      <div>
        <button data-tip="Add a chart" type="submit">Plot</button>

        <select data-tip="Select entity (y axis)" id="chartsOverview__entitiesSelect">
          ${createOptions(entities)}
        </select>

        <label for="chartsOverview__plotBySelect" data-tip="Select metric to plot (x axis)">
          <span>by</span>
          <select id="chartsOverview__plotBySelect">
            ${createOptions(plotBy)}
          </select>
          <i id="chartsOverview__plotByInfo" class="icon-info-circled" style="display: none"></i>
        </label>

        <label for="chartsOverview__groupBySelect" data-tip="Select entity to group by. If you don't need grouping, set it the same as the entity">
          <span>grouped by</span>
          <select id="chartsOverview__groupBySelect">
            ${createOptions(entities)}
          </select>
        </label>

        <label data-tip="Sorting type" for="chartsOverview__sortingSelect">
          <span>sorted</span>
          <select id="chartsOverview__sortingSelect">
            <option value="value">by value</option>
            <option value="name">by name</option>
            <option value="natural">naturally</option>
          </select>
        </label>
      </div>

      <div>
        <label data-tip="Select chart type" for="chartsOverview__chartType">
          <span>Type</span>
          <select id="chartsOverview__chartType">
            <option value="stackedBar" selected>Stacked Bar</option>
            <option value="normalizedStackedBar">Normalized Bar</option>
          </select>
        </label>

        <label data-tip="Show the charts in 1, 2, 3 or 4 columns" for="chartsOverview__viewColumns">
          <span>Columns</span>
          <select id="chartsOverview__viewColumns">
            <option value="1" selected>1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </label>

        <label data-tip="Exclude zero element from the results (id 0, e.g. the neutral state)" for="chartsOverview__excludeNeutral">
          <input id="chartsOverview__excludeNeutral" type="checkbox" class="native" />
          <span>Exclude neutral</span>
        </label>
      </div>
    </form>

    <section id="chartsOverview__charts"></section>
  </div>`;

  ensureEl("dialogs").insertAdjacentHTML("beforeend", html);

  // set defaults
  ensureEl<HTMLSelectElement>("chartsOverview__entitiesSelect").value = "states";
  ensureEl<HTMLSelectElement>("chartsOverview__plotBySelect").value = "total_population";
  ensureEl<HTMLSelectElement>("chartsOverview__groupBySelect").value = "cultures";
}

function addListeners() {
  ensureEl("chartsOverview__form").on("submit", addChart as EventListener);
  ensureEl("chartsOverview__viewColumns").on("change", changeViewColumns);
  ensureEl("chartsOverview__plotBySelect").on("change", updateMetricInfo);
}

// Show the selected metric's hint via an info icon tooltip (keeps the dropdown labels compact).
function updateMetricInfo() {
  const plotBy = ensureEl<HTMLSelectElement>("chartsOverview__plotBySelect").value;
  const info = ensureEl("chartsOverview__plotByInfo");
  const { hint } = quantizationMap[plotBy];
  if (hint) {
    info.dataset.tip = hint;
    info.style.display = "";
  } else {
    info.style.display = "none";
  }
}

function addChart(event?: Event) {
  if (event) event.preventDefault();

  const entity = ensureEl<HTMLSelectElement>("chartsOverview__entitiesSelect").value;
  const plotBy = ensureEl<HTMLSelectElement>("chartsOverview__plotBySelect").value;
  let groupBy = ensureEl<HTMLSelectElement>("chartsOverview__groupBySelect").value;
  const sorting = ensureEl<HTMLSelectElement>("chartsOverview__sortingSelect").value;
  const type = ensureEl<HTMLSelectElement>("chartsOverview__chartType").value;
  const excludeNeutral = ensureEl<HTMLInputElement>("chartsOverview__excludeNeutral").checked;

  const { label: plotByLabel, stackable, provides = [] } = quantizationMap[plotBy];

  // some dimensions need a contribution tag the metric must provide (e.g. goods need a per-good
  // metric); show an error and skip plotting when the requested chart is not possible
  const lacksTag = (dimension: string) => {
    const required = entitiesMap[dimension].requires;
    return required ? !provides.includes(required) : false;
  };
  const incompatible = [entity, groupBy].find(lacksTag);
  if (incompatible) {
    tip(
      `${plotByLabel} cannot be broken down by ${entitiesMap[incompatible].label.toLowerCase()}`,
      false,
      "error",
      4000
    );
    return;
  }

  if (!stackable && groupBy !== entity) {
    tip(`Grouping is not supported for ${plotBy}`, false, "warn", 4000);
    groupBy = entity;
  }

  const chartOptions: ChartOptions = { id: Date.now(), entity, plotBy, groupBy, sorting, type, excludeNeutral };
  charts.push(chartOptions);
  renderChart(chartOptions);
  updateDialogPosition();
}

function renderChart({ id, entity, plotBy, groupBy, sorting, type, excludeNeutral }: ChartOptions) {
  const {
    label: plotByLabel,
    stringify,
    quantize,
    getContributions,
    prepare,
    aggregate,
    formatTicks,
    landOnly: plotByLandOnly
  } = quantizationMap[plotBy];

  const noGrouping = groupBy === entity;

  const {
    label: entityLabel,
    getName: getEntityName,
    getId: getEntityId,
    landOnly: entityLandOnly
  } = entitiesMap[entity];
  const { label: groupLabel, getName: getGroupName, getId: getGroupId, getColors } = entitiesMap[groupBy];

  // A metric turns each cell into one or more {value, ...tags} contributions; scalar metrics emit
  // a single untagged value. Each dimension then reads its bucket id off the cell or the contribution.
  const ctx = prepare ? prepare() : undefined;
  const contributionsOf: (cellId: number) => Contribution[] = getContributions
    ? cellId => getContributions(cellId, ctx!)
    : cellId => [{ value: quantize!(cellId) }];

  const title = `${capitalize(entity)} by ${plotByLabel}${noGrouping ? "" : ` grouped by ${groupLabel}`}`;

  const tooltip = (entityName: string, group: string, value: number, percentage: number) => {
    const entityTip = `${entityLabel}: ${entityName}`;
    const groupTip = noGrouping ? "" : `${groupLabel}: ${group}`;
    let valueTip = `${plotByLabel}: ${stringify(value)}`;
    if (!noGrouping) valueTip += ` (${rn(percentage * 100)}%)`;
    return [entityTip, groupTip, valueTip].filter(Boolean);
  };

  const dataCollection: Record<number, Record<number, number[]>> = {};
  const groups = new Set<number>();

  for (const cellId of pack.cells.i) {
    if ((entityLandOnly || plotByLandOnly) && isWater(cellId, pack)) continue;

    for (const contribution of contributionsOf(cellId)) {
      const entityId = getEntityId(cellId, contribution);
      const groupId = getGroupId(cellId, contribution);

      // id 0 is the neutral placeholder; skip it when requested
      if (excludeNeutral && (entityId === 0 || groupId === 0)) continue;

      const { value } = contribution;

      if (!dataCollection[entityId]) dataCollection[entityId] = { [groupId]: [value] };
      else if (!dataCollection[entityId][groupId]) dataCollection[entityId][groupId] = [value];
      else dataCollection[entityId][groupId].push(value);

      groups.add(groupId);
    }
  }

  const chartData: ChartDatum[] = Object.entries(dataCollection).flatMap(([entityId, groupData]) => {
    const name = getEntityName(entityId);
    return Object.entries(groupData).map(([groupId, values]): ChartDatum => {
      const group = getGroupName(groupId);
      const value = aggregate(values);
      return { name, group, value };
    });
  });

  const sortedData = sortData(chartData, sorting);
  const colors = getColors();
  const { offset, formatX = formatTicks } = plotTypeMap[type];

  const $chart = createStackedBarChart(sortedData, { colors, tooltip, offset, formatX });
  insertChart(id, sortedData, $chart, title);

  ensureEl("chartsOverview__charts").lastElementChild?.scrollIntoView();
}

// based on observablehq.com/@d3/stacked-horizontal-bar-chart
function createStackedBarChart(
  sortedData: ChartDatum[],
  {
    colors,
    tooltip,
    offset,
    formatX
  }: {
    colors: Record<string, string>;
    tooltip: (entity: string, group: string, value: number, percentage: number) => string[];
    offset: typeof stackOffsetDiverging;
    formatX: (value: number) => string | number;
  }
): SVGSVGElement {
  const X = sortedData.map(d => d.value);
  const Y = sortedData.map(d => d.name);
  const Z = sortedData.map(d => d.group);

  const yDomain = new Set(Y);
  const zDomain = new Set(Z);
  const I = range(X.length).filter(i => yDomain.has(Y[i]) && zDomain.has(Z[i]));

  const entities = Array.from(yDomain);
  const groups = Array.from(zDomain);

  const yScaleMinWidth = getTextMinWidth(entities);
  const legendRows = calculateLegendRows(groups, WIDTH - yScaleMinWidth - 15);

  const margin = { top: 30, right: 15, bottom: legendRows * 20 + 10, left: yScaleMinWidth };
  const xRange = [margin.left, WIDTH - margin.right];
  const height = yDomain.size * 25 + margin.top + margin.bottom;
  const yRange = [height - margin.bottom, margin.top];

  const rolled = rollups(
    I,
    ([i]) => i,
    i => Y[i],
    i => Z[i]
  );

  const series: StackSeries[] = stack<RolledEntry, string>()
    .keys(groups)
    .value(([, zEntries], z) => X[new Map(zEntries).get(z)!])
    .order(stackOrderNone)
    .offset(offset)(rolled)
    .map(s => {
      const defined = s.filter(d => !Number.isNaN(d[1]));
      const data: BarPoint[] = defined.map(d => Object.assign(d, { i: new Map(d.data[1]).get(s.key)! }));
      return { key: s.key, data };
    });

  const edges = series.flatMap(s => s.data.flatMap(p => [p[0], p[1]]));
  const xDomain = extent(edges) as [number, number];

  const xScale = scaleLinear(xDomain, xRange);
  const yScale = scaleBand(entities, yRange).paddingInner(Y_PADDING);

  const xAxis = axisTop(xScale).ticks(WIDTH / 80, null);
  const yAxis = axisLeft(yScale).tickSizeOuter(0);

  const svg = create("svg")
    .attr("version", "1.1")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", `0 0 ${WIDTH} ${height}`)
    .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  svg
    .append("g")
    .attr("transform", `translate(0,${margin.top})`)
    .call(xAxis)
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll<SVGTextElement, number>("text").text(d => formatX(d)))
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
    .selectAll<SVGGElement, StackSeries>("g")
    .data(series)
    .join("g")
    .attr("fill", d => colors[d.key])
    .selectAll<SVGRectElement, BarPoint>("rect")
    .data(d => d.data.filter(([x1, x2]) => x1 !== x2))
    .join("rect")
    .attr("x", ([x1, x2]) => Math.min(xScale(x1), xScale(x2)))
    .attr("y", ({ i }) => yScale(Y[i])!)
    .attr("width", ([x1, x2]) => Math.abs(xScale(x1) - xScale(x2)))
    .attr("height", yScale.bandwidth());

  const totalZ: Record<string, number> = Object.fromEntries(
    rollups(
      I,
      indices => sum(indices, i => X[i]),
      i => Y[i]
    )
  );
  const getTooltip = ({ i }: { i: number }) => tooltip(Y[i], Z[i], X[i], X[i] / totalZ[Y[i]]);

  bar.append("title").text(d => getTooltip(d).join("\r\n"));
  bar.on("mouseover", (_event, d) => tip(getTooltip(d).join(". ")));

  svg
    .append("g")
    .attr("transform", `translate(${xScale(0)},0)`)
    .call(yAxis);

  const rowElements = Math.ceil(groups.length / legendRows);
  const columnWidth = WIDTH / (rowElements + 0.5);

  const ROW_HEIGHT = 20;

  const getLegendX = (_d: string, i: number) => (i % rowElements) * columnWidth;
  const getLegendLabelX = (d: string, i: number) => getLegendX(d, i) + LABEL_GAP;
  const getLegendY = (_d: string, i: number) => Math.floor(i / rowElements) * ROW_HEIGHT;

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
    .attr("fill", (d: string) => colors[d]);

  legend
    .selectAll("text")
    .data(groups)
    .join("text")
    .attr("x", getLegendLabelX)
    .attr("y", getLegendY)
    .text((d: string) => d);

  return svg.node() as SVGSVGElement;
}

function insertChart(id: number, sortedData: ChartDatum[], $chart: SVGSVGElement, title: string) {
  const $chartContainer = ensureEl("chartsOverview__charts");

  const $figure = document.createElement("figure");
  const $caption = document.createElement("figcaption");

  const figureNo = $chartContainer.childElementCount + 1;
  $caption.innerHTML = /* html */ `
    <div>
      <strong>Figure ${figureNo}</strong>. ${title}
    </div>
    <div>
      <button data-tip="Download chart data as a text file (.csv)" class="icon-download"></button>
      <button data-tip="Download the chart as a PNG image" class="icon-export"></button>
      <button data-tip="Download the chart in SVG format (vector, opens in a browser or Inkscape)" class="icon-chart-bar"></button>
      <button data-tip="Remove the chart" class="icon-trash"></button>
    </div>
  `;

  // caption (label + controls) sits above the chart
  $figure.appendChild($caption);
  $figure.appendChild($chart);
  $chartContainer.appendChild($figure);

  const downloadChartData = () => {
    const name = `${getFileName(title)}.csv`;
    const headers = "Name,Group,Value\n";
    const values = sortedData.map(({ name, group, value }) => `${name},${group},${value}`).join("\n");
    downloadFile(headers + values, name);
  };

  const downloadChartSvg = () => {
    const name = `${getFileName(title)}.svg`;
    downloadFile($chart.outerHTML, name);
  };

  // rasterize the SVG onto a canvas for users unfamiliar with the vector format
  const downloadChartPng = () => {
    const { width, height } = $chart.viewBox.baseVal;
    const clone = $chart.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    const svgString = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));

    const image = new Image();
    image.onload = () => {
      const scale = 2; // export at 2x for a crisp raster
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => blob && downloadFile(blob, `${getFileName(title)}.png`, "image/png"));
      }
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const removeChart = () => {
    $figure.remove();
    charts = charts.filter(chart => chart.id !== id);
    updateDialogPosition();
  };

  $figure.querySelector("button.icon-download")?.on("click", downloadChartData);
  $figure.querySelector("button.icon-export")?.on("click", downloadChartPng);
  $figure.querySelector("button.icon-chart-bar")?.on("click", downloadChartSvg);
  $figure.querySelector("button.icon-trash")?.on("click", removeChart);
}

function changeViewColumns() {
  const columns = ensureEl<HTMLSelectElement>("chartsOverview__viewColumns").value;
  const $charts = ensureEl("chartsOverview__charts");
  $charts.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  updateDialogPosition();
}

function updateDialogPosition() {
  $("#chartsOverview").dialog({ position: { my: "center", at: "center", of: "svg" } });
}

function handleClose() {
  const $chartContainer = ensureEl("chartsOverview__charts");
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

function getTextMinWidth(entities: string[]): number {
  return max(entities.map(name => name.length))! * RESERVED_PX_PER_CHAR;
}

function calculateLegendRows(groups: string[], availableWidth: number): number {
  if (!groups.length) return 0;
  const minWidth = LABEL_GAP + getTextMinWidth(groups);
  const maxInRow = Math.max(1, Math.floor(availableWidth / minWidth));
  return Math.ceil(groups.length / maxInRow);
}

function nameGetter(entity: CollectionKey) {
  return (i: string | number): string => (pack[entity] as NamedColored[])[+i]?.name || EMPTY_NAME;
}

function colorsGetter(entity: CollectionKey) {
  return (): Record<string, string> =>
    Object.fromEntries((pack[entity] as NamedColored[]).map(e => [e.name || EMPTY_NAME, e.color || NEUTRAL_COLOR]));
}

function biomeNameGetter(i: string | number): string {
  return biomesData.name[+i] || EMPTY_NAME;
}

function biomeColorsGetter(): Record<string, string> {
  return Object.fromEntries(biomesData.i.map(i => [biomesData.name[i], biomesData.color[i]]));
}

// markets have no default name, so fall back to the center burg's name
function marketNameGetter(i: string | number): string {
  const market = Markets.get(+i);
  if (!market) return EMPTY_NAME;
  return market.name || pack.burgs[market.centerBurgId]?.name || `Market ${market.i}`;
}

function marketColorsGetter(): Record<string, string> {
  return Object.fromEntries((pack.markets || []).map(m => [marketNameGetter(m.i), m.color || NEUTRAL_COLOR]));
}

function goodNameGetter(i: string | number): string {
  return Goods.get(+i)?.name || EMPTY_NAME;
}

function goodColorsGetter(): Record<string, string> {
  return Object.fromEntries((pack.goods || []).map(g => [g.name || EMPTY_NAME, g.color || NEUTRAL_COLOR]));
}

function getCellProductionByGood(cellId: number, biomeProduction: BiomeProduction): Record<number, number> {
  const produced = Production.getCellProduction(cellId, biomeProduction);
  const burgId = pack.cells.burg[cellId];
  if (burgId) {
    const urban = Production.getBurgProduction(pack.burgs[burgId]);
    for (const [goodId, units] of Object.entries(urban)) produced[+goodId] = (produced[+goodId] || 0) + units;
  }
  return produced;
}

function getUrbanPopulation(cellId: number): number {
  const burgId = pack.cells.burg[cellId];
  if (!burgId) return 0;
  const populationPoints = pack.burgs[burgId].population || 0;
  return populationPoints * populationRate * urbanization;
}

function getRuralPopulation(cellId: number): number {
  return pack.cells.pop[cellId] * populationRate;
}

function sortData(data: ChartDatum[], sorting: string): ChartDatum[] {
  if (sorting === "natural") return data;

  if (sorting === "name") {
    return data.sort((a, b) => {
      if (a.name !== b.name) return b.name.localeCompare(a.name); // reversed as 1st element is the bottom
      return a.group.localeCompare(b.group);
    });
  }

  if (sorting === "value") {
    const entitySum: Record<string, number> = {};
    const groupSum: Record<string, number> = {};
    for (const { name, group, value } of data) {
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

export const ChartsOverview = { open };
