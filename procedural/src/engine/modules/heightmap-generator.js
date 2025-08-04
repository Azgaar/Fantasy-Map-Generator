"use strict";

export async function generate(graph, config, utils) {
  const { aleaPRNG, heightmapTemplates } = utils;
  const { TIME } = config.debug;
  const { templateId, seed } = config;

  TIME && console.time("defineHeightmap");

  const isTemplate = templateId in heightmapTemplates;
  const heights = isTemplate
    ? fromTemplate(graph, templateId, config, utils)
    : await fromPrecreated(graph, templateId, config, utils);

  TIME && console.timeEnd("defineHeightmap");

  return heights;
}

// Placeholder function for processing precreated heightmaps
// This will need further refactoring to work headlessly (see heightmap-generator_render.md)
export async function fromPrecreated(graph, id, config, utils) {
  // TODO: Implement headless image processing
  // This function currently requires DOM/Canvas which was removed
  // Future implementation will need:
  // - utils.loadImage() function to load PNG files headlessly
  // - Image processing library (e.g., canvas package for Node.js)
  // - getHeightsFromImageData() refactored for headless operation
  throw new Error(`fromPrecreated not yet implemented for headless operation. Template ID: ${id}`);
}

export function fromTemplate(graph, id, config, utils) {
  const { heightmapTemplates } = utils;
  const templateString = heightmapTemplates[id]?.template || "";
  const steps = templateString.split("\n");

  if (!steps.length) throw new Error(`Heightmap template: no steps. Template: ${id}. Steps: ${steps}`);

  let { heights, blobPower, linePower } = setGraph(graph, utils);

  for (const step of steps) {
    const elements = step.trim().split(" ");
    if (elements.length < 2) throw new Error(`Heightmap template: steps < 2. Template: ${id}. Step: ${elements}`);
    heights = addStep(heights, graph, blobPower, linePower, config, utils, ...elements);
  }

  return heights;
}

function setGraph(graph, utils) {
  const { createTypedArray } = utils;
  const { cellsDesired, cells, points } = graph;
  const heights = cells.h ? Uint8Array.from(cells.h) : createTypedArray({ maxValue: 100, length: points.length });
  const blobPower = getBlobPower(cellsDesired);
  const linePower = getLinePower(cellsDesired);

  return { heights, blobPower, linePower };
}

function addStep(heights, graph, blobPower, linePower, config, utils, tool, a2, a3, a4, a5) {
  if (tool === "Hill") return addHill(heights, graph, blobPower, config, utils, a2, a3, a4, a5);
  if (tool === "Pit") return addPit(heights, graph, blobPower, config, utils, a2, a3, a4, a5);
  if (tool === "Range") return addRange(heights, graph, linePower, config, utils, a2, a3, a4, a5);
  if (tool === "Trough") return addTrough(heights, graph, linePower, config, utils, a2, a3, a4, a5);
  if (tool === "Strait") return addStrait(heights, graph, config, utils, a2, a3);
  if (tool === "Mask") return mask(heights, graph, config, utils, a2);
  if (tool === "Invert") return invert(heights, graph, config, utils, a2, a3);
  if (tool === "Add") return modify(heights, a3, +a2, 1, utils);
  if (tool === "Multiply") return modify(heights, a3, 0, +a2, utils);
  if (tool === "Smooth") return smooth(heights, graph, utils, a2);
  return heights;
}

function getBlobPower(cells) {
  const blobPowerMap = {
    1000: 0.93,
    2000: 0.95,
    5000: 0.97,
    10000: 0.98,
    20000: 0.99,
    30000: 0.991,
    40000: 0.993,
    50000: 0.994,
    60000: 0.995,
    70000: 0.9955,
    80000: 0.996,
    90000: 0.9964,
    100000: 0.9973
  };
  return blobPowerMap[cells] || 0.98;
}

function getLinePower(cells) {
  const linePowerMap = {
    1000: 0.75,
    2000: 0.77,
    5000: 0.79,
    10000: 0.81,
    20000: 0.82,
    30000: 0.83,
    40000: 0.84,
    50000: 0.86,
    60000: 0.87,
    70000: 0.88,
    80000: 0.91,
    90000: 0.92,
    100000: 0.93
  };

  return linePowerMap[cells] || 0.81;
}

export function addHill(heights, graph, blobPower, config, utils, count, height, rangeX, rangeY) {
  const { getNumberInRange, lim, findGridCell } = utils;
  const { graphWidth, graphHeight } = config;

  heights = new Uint8Array(heights);
  count = getNumberInRange(count);

  while (count > 0) {
    addOneHill();
    count--;
  }

  function addOneHill() {
    const change = new Uint8Array(heights.length);
    let limit = 0;
    let start;
    let h = lim(getNumberInRange(height));

    do {
      const x = getPointInRange(rangeX, graphWidth, utils);
      const y = getPointInRange(rangeY, graphHeight, utils);
      start = findGridCell(x, y, graph);
      limit++;
    } while (heights[start] + h > 90 && limit < 50);

    change[start] = h;
    const queue = [start];
    while (queue.length) {
      const q = queue.shift();

      for (const c of graph.cells.c[q]) {
        if (change[c]) continue;
        change[c] = change[q] ** blobPower * (Math.random() * 0.2 + 0.9);
        if (change[c] > 1) queue.push(c);
      }
    }

    heights = heights.map((h, i) => lim(h + change[i]));
  }

  return heights;
}

export function addPit(heights, graph, blobPower, config, utils, count, height, rangeX, rangeY) {
  const { getNumberInRange, lim, findGridCell } = utils;
  const { graphWidth, graphHeight } = config;

  heights = new Uint8Array(heights);
  count = getNumberInRange(count);

  while (count > 0) {
    addOnePit();
    count--;
  }

  function addOnePit() {
    const used = new Uint8Array(heights.length);
    let limit = 0,
      start;
    let h = lim(getNumberInRange(height));

    do {
      const x = getPointInRange(rangeX, graphWidth, utils);
      const y = getPointInRange(rangeY, graphHeight, utils);
      start = findGridCell(x, y, graph);
      limit++;
    } while (heights[start] < 20 && limit < 50);

    const queue = [start];
    while (queue.length) {
      const q = queue.shift();
      h = h ** blobPower * (Math.random() * 0.2 + 0.9);
      if (h < 1) return;

      graph.cells.c[q].forEach(function (c, i) {
        if (used[c]) return;
        heights[c] = lim(heights[c] - h * (Math.random() * 0.2 + 0.9));
        used[c] = 1;
        queue.push(c);
      });
    }
  }

  return heights;
}

export function addRange(heights, graph, linePower, config, utils, count, height, rangeX, rangeY, startCell, endCell) {
  const { getNumberInRange, lim, findGridCell, d3 } = utils;
  const { graphWidth, graphHeight } = config;

  heights = new Uint8Array(heights);
  count = getNumberInRange(count);

  while (count > 0) {
    addOneRange();
    count--;
  }

  function addOneRange() {
    const used = new Uint8Array(heights.length);
    let h = lim(getNumberInRange(height));

    if (rangeX && rangeY) {
      // find start and end points
      const startX = getPointInRange(rangeX, graphWidth, utils);
      const startY = getPointInRange(rangeY, graphHeight, utils);

      let dist = 0,
        limit = 0,
        endX,
        endY;

      do {
        endX = Math.random() * graphWidth * 0.8 + graphWidth * 0.1;
        endY = Math.random() * graphHeight * 0.7 + graphHeight * 0.15;
        dist = Math.abs(endY - startY) + Math.abs(endX - startX);
        limit++;
      } while ((dist < graphWidth / 8 || dist > graphWidth / 3) && limit < 50);

      startCell = findGridCell(startX, startY, graph);
      endCell = findGridCell(endX, endY, graph);
    }

    let range = getRange(startCell, endCell);

    // get main ridge
    function getRange(cur, end) {
      const range = [cur];
      const p = graph.points;
      used[cur] = 1;

      while (cur !== end) {
        let min = Infinity;
        graph.cells.c[cur].forEach(function (e) {
          if (used[e]) return;
          let diff = (p[end][0] - p[e][0]) ** 2 + (p[end][1] - p[e][1]) ** 2;
          if (Math.random() > 0.85) diff = diff / 2;
          if (diff < min) {
            min = diff;
            cur = e;
          }
        });
        if (min === Infinity) return range;
        range.push(cur);
        used[cur] = 1;
      }

      return range;
    }

    // add height to ridge and cells around
    let queue = range.slice(),
      i = 0;
    while (queue.length) {
      const frontier = queue.slice();
      (queue = []), i++;
      frontier.forEach(i => {
        heights[i] = lim(heights[i] + h * (Math.random() * 0.3 + 0.85));
      });
      h = h ** linePower - 1;
      if (h < 2) break;
      frontier.forEach(f => {
        graph.cells.c[f].forEach(i => {
          if (!used[i]) {
            queue.push(i);
            used[i] = 1;
          }
        });
      });
    }

    // generate prominences
    range.forEach((cur, d) => {
      if (d % 6 !== 0) return;
      for (const l of d3.range(i)) {
        const min = graph.cells.c[cur][d3.scan(graph.cells.c[cur], (a, b) => heights[a] - heights[b])]; // downhill cell
        heights[min] = (heights[cur] * 2 + heights[min]) / 3;
        cur = min;
      }
    });
  }

  return heights;
}

export function addTrough(heights, graph, linePower, config, utils, count, height, rangeX, rangeY, startCell, endCell) {
  const { getNumberInRange, lim, findGridCell, d3 } = utils;
  const { graphWidth, graphHeight } = config;

  heights = new Uint8Array(heights);
  count = getNumberInRange(count);

  while (count > 0) {
    addOneTrough();
    count--;
  }

  function addOneTrough() {
    const used = new Uint8Array(heights.length);
    let h = lim(getNumberInRange(height));

    if (rangeX && rangeY) {
      // find start and end points
      let limit = 0,
        startX,
        startY,
        dist = 0,
        endX,
        endY;
      do {
        startX = getPointInRange(rangeX, graphWidth, utils);
        startY = getPointInRange(rangeY, graphHeight, utils);
        startCell = findGridCell(startX, startY, graph);
        limit++;
      } while (heights[startCell] < 20 && limit < 50);

      limit = 0;
      do {
        endX = Math.random() * graphWidth * 0.8 + graphWidth * 0.1;
        endY = Math.random() * graphHeight * 0.7 + graphHeight * 0.15;
        dist = Math.abs(endY - startY) + Math.abs(endX - startX);
        limit++;
      } while ((dist < graphWidth / 8 || dist > graphWidth / 2) && limit < 50);

      endCell = findGridCell(endX, endY, graph);
    }

    let range = getRange(startCell, endCell);

    // get main ridge
    function getRange(cur, end) {
      const range = [cur];
      const p = graph.points;
      used[cur] = 1;

      while (cur !== end) {
        let min = Infinity;
        graph.cells.c[cur].forEach(function (e) {
          if (used[e]) return;
          let diff = (p[end][0] - p[e][0]) ** 2 + (p[end][1] - p[e][1]) ** 2;
          if (Math.random() > 0.8) diff = diff / 2;
          if (diff < min) {
            min = diff;
            cur = e;
          }
        });
        if (min === Infinity) return range;
        range.push(cur);
        used[cur] = 1;
      }

      return range;
    }

    // add height to ridge and cells around
    let queue = range.slice(),
      i = 0;
    while (queue.length) {
      const frontier = queue.slice();
      (queue = []), i++;
      frontier.forEach(i => {
        heights[i] = lim(heights[i] - h * (Math.random() * 0.3 + 0.85));
      });
      h = h ** linePower - 1;
      if (h < 2) break;
      frontier.forEach(f => {
        graph.cells.c[f].forEach(i => {
          if (!used[i]) {
            queue.push(i);
            used[i] = 1;
          }
        });
      });
    }

    // generate prominences
    range.forEach((cur, d) => {
      if (d % 6 !== 0) return;
      for (const l of d3.range(i)) {
        const min = graph.cells.c[cur][d3.scan(graph.cells.c[cur], (a, b) => heights[a] - heights[b])]; // downhill cell
        //debug.append("circle").attr("cx", p[min][0]).attr("cy", p[min][1]).attr("r", 1);
        heights[min] = (heights[cur] * 2 + heights[min]) / 3;
        cur = min;
      }
    });
  }

  return heights;
}

export function addStrait(heights, graph, config, utils, width, direction = "vertical") {
  const { getNumberInRange, findGridCell, P } = utils;
  const { graphWidth, graphHeight } = config;

  heights = new Uint8Array(heights);
  width = Math.min(getNumberInRange(width), graph.cellsX / 3);
  if (width < 1 && P(width)) return heights;

  const used = new Uint8Array(heights.length);
  const vert = direction === "vertical";
  const startX = vert ? Math.floor(Math.random() * graphWidth * 0.4 + graphWidth * 0.3) : 5;
  const startY = vert ? 5 : Math.floor(Math.random() * graphHeight * 0.4 + graphHeight * 0.3);
  const endX = vert
    ? Math.floor(graphWidth - startX - graphWidth * 0.1 + Math.random() * graphWidth * 0.2)
    : graphWidth - 5;
  const endY = vert
    ? graphHeight - 5
    : Math.floor(graphHeight - startY - graphHeight * 0.1 + Math.random() * graphHeight * 0.2);

  const start = findGridCell(startX, startY, graph);
  const end = findGridCell(endX, endY, graph);
  let range = getRange(start, end);
  const query = [];

  function getRange(cur, end) {
    const range = [];
    const p = graph.points;

    while (cur !== end) {
      let min = Infinity;
      graph.cells.c[cur].forEach(function (e) {
        let diff = (p[end][0] - p[e][0]) ** 2 + (p[end][1] - p[e][1]) ** 2;
        if (Math.random() > 0.8) diff = diff / 2;
        if (diff < min) {
          min = diff;
          cur = e;
        }
      });
      range.push(cur);
    }

    return range;
  }

  const step = 0.1 / width;

  while (width > 0) {
    const exp = 0.9 - step * width;
    range.forEach(function (r) {
      graph.cells.c[r].forEach(function (e) {
        if (used[e]) return;
        used[e] = 1;
        query.push(e);
        heights[e] **= exp;
        if (heights[e] > 100) heights[e] = 5;
      });
    });
    range = query.slice();

    width--;
  }

  return heights;
}

export function modify(heights, range, add, mult, power, utils) {
  const { lim } = utils;

  heights = new Uint8Array(heights);
  const min = range === "land" ? 20 : range === "all" ? 0 : +range.split("-")[0];
  const max = range === "land" || range === "all" ? 100 : +range.split("-")[1];
  const isLand = min === 20;

  heights = heights.map(h => {
    if (h < min || h > max) return h;

    if (add) h = isLand ? Math.max(h + add, 20) : h + add;
    if (mult !== 1) h = isLand ? (h - 20) * mult + 20 : h * mult;
    if (power) h = isLand ? (h - 20) ** power + 20 : h ** power;
    return lim(h);
  });

  return heights;
}

export function smooth(heights, graph, utils, fr = 2, add = 0) {
  const { lim, d3 } = utils;

  heights = new Uint8Array(heights);
  heights = heights.map((h, i) => {
    const a = [h];
    graph.cells.c[i].forEach(c => a.push(heights[c]));
    if (fr === 1) return d3.mean(a) + add;
    return lim((h * (fr - 1) + d3.mean(a) + add) / fr);
  });

  return heights;
}

export function mask(heights, graph, config, utils, power = 1) {
  const { lim } = utils;
  const { graphWidth, graphHeight } = config;

  heights = new Uint8Array(heights);
  const fr = power ? Math.abs(power) : 1;

  heights = heights.map((h, i) => {
    const [x, y] = graph.points[i];
    const nx = (2 * x) / graphWidth - 1; // [-1, 1], 0 is center
    const ny = (2 * y) / graphHeight - 1; // [-1, 1], 0 is center
    let distance = (1 - nx ** 2) * (1 - ny ** 2); // 1 is center, 0 is edge
    if (power < 0) distance = 1 - distance; // inverted, 0 is center, 1 is edge
    const masked = h * distance;
    return lim((h * (fr - 1) + masked) / fr);
  });

  return heights;
}

export function invert(heights, graph, config, utils, count, axes) {
  const { P } = utils;

  if (!P(count)) return heights;

  heights = new Uint8Array(heights);
  const invertX = axes !== "y";
  const invertY = axes !== "x";
  const { cellsX, cellsY } = graph;

  const inverted = heights.map((h, i) => {
    const x = i % cellsX;
    const y = Math.floor(i / cellsX);

    const nx = invertX ? cellsX - x - 1 : x;
    const ny = invertY ? cellsY - y - 1 : y;
    const invertedI = nx + ny * cellsX;
    return heights[invertedI];
  });

  return inverted;
}

function getPointInRange(range, length, utils) {
  const { rand } = utils;

  if (typeof range !== "string") {
    console.error("Range should be a string");
    return;
  }

  const min = range.split("-")[0] / 100 || 0;
  const max = range.split("-")[1] / 100 || min;
  return rand(min * length, max * length);
}
