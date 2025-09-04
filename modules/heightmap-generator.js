"use strict";

window.HeightmapGenerator = (function () {
  let grid = null;
  let heights = null;
  let blobPower;
  let linePower;

  const setGraph = graph => {
    const {cellsDesired, cells, points} = graph;
    heights = cells.h ? Uint8Array.from(cells.h) : createTypedArray({maxValue: 100, length: points.length});
    blobPower = getBlobPower(cellsDesired);
    linePower = getLinePower(cellsDesired);
    grid = graph;
  };

  const getHeights = () => heights;

  const clearData = () => {
    heights = null;
    grid = null;
  };

  const fromTemplate = (graph, id) => {
    const templateString = heightmapTemplates[id]?.template || "";
    const steps = templateString.split("\n");

    if (!steps.length) throw new Error(`Heightmap template: no steps. Template: ${id}. Steps: ${steps}`);
    setGraph(graph);

    for (const step of steps) {
      const elements = step.trim().split(" ");
      if (elements.length < 2) throw new Error(`Heightmap template: steps < 2. Template: ${id}. Step: ${elements}`);
      addStep(...elements);
    }

    return heights;
  };

  const fromPrecreated = (graph, id) => {
    return new Promise(resolve => {
      // create canvas where 1px corresponts to a cell
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const {cellsX, cellsY} = graph;
      canvas.width = cellsX;
      canvas.height = cellsY;

      // load heightmap into image and render to canvas
      const img = new Image();
      img.src = `./heightmaps/${id}.png`;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, cellsX, cellsY);
        const imageData = ctx.getImageData(0, 0, cellsX, cellsY);
        setGraph(graph);
        getHeightsFromImageData(imageData.data);
        canvas.remove();
        img.remove();
        resolve(heights);
      };
    });
  };

  const generate = async function (graph) {
    TIME && console.time("defineHeightmap");
    const id = byId("templateInput").value;

    Math.random = aleaPRNG(seed);
    const isTemplate = id in heightmapTemplates;
    const heights = isTemplate ? fromTemplate(graph, id) : await fromPrecreated(graph, id);
    TIME && console.timeEnd("defineHeightmap");

    clearData();
    return heights;
  };

  function addStep(tool, a2, a3, a4, a5) {
    if (tool === "Hill") return addHill(a2, a3, a4, a5);
    if (tool === "Pit") return addPit(a2, a3, a4, a5);
    if (tool === "Range") return addRange(a2, a3, a4, a5);
    if (tool === "Trough") return addTrough(a2, a3, a4, a5);
    if (tool === "Strait") return addStrait(a2, a3);
    if (tool === "Mask") return mask(a2);
    if (tool === "Invert") return invert(a2, a3);
    if (tool === "Add") return modify(a3, +a2, 1);
    if (tool === "Multiply") return modify(a3, 0, +a2);
    if (tool === "Smooth") return smooth(a2);
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

  function getLinePower() {
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

  const addHill = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOneHill();
      count--;
    }

    function addOneHill() {
      // reuse a scratch buffer to avoid reallocations
      if (!addHill._change || addHill._change.length !== heights.length) addHill._change = new Uint8Array(heights.length);
      const change = addHill._change;
      change.fill(0);
      let limit = 0;
      let start;
      let h = lim(getNumberInRange(height));

      do {
        const x = getPointInRange(rangeX, graphWidth);
        const y = getPointInRange(rangeY, graphHeight);
        start = findGridCell(x, y, grid);
        limit++;
      } while (heights[start] + h > 90 && limit < 50);

      change[start] = h;
      const queue = [start];
      for (let qi = 0; qi < queue.length; qi++) {
        const q = queue[qi];
        const neibs = grid.cells.c[q];
        for (let k = 0; k < neibs.length; k++) {
          const c = neibs[k];
          if (change[c]) continue;
          change[c] = change[q] ** blobPower * (Math.random() * 0.2 + 0.9);
          if (change[c] > 1) queue.push(c);
        }
      }

      for (let i = 0; i < heights.length; i++) heights[i] = lim(heights[i] + change[i]);
    }
  };

  const addPit = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOnePit();
      count--;
    }

    function addOnePit() {
      if (!addPit._used || addPit._used.length !== heights.length) addPit._used = new Uint8Array(heights.length);
      const used = addPit._used;
      used.fill(0);
      let limit = 0,
        start;
      let h = lim(getNumberInRange(height));

      do {
        const x = getPointInRange(rangeX, graphWidth);
        const y = getPointInRange(rangeY, graphHeight);
        start = findGridCell(x, y, grid);
        limit++;
      } while (heights[start] < 20 && limit < 50);

      const queue = [start];
      for (let qi = 0; qi < queue.length; qi++) {
        const q = queue[qi];
        h = h ** blobPower * (Math.random() * 0.2 + 0.9);
        if (h < 1) return;
        const neibs = grid.cells.c[q];
        for (let k = 0; k < neibs.length; k++) {
          const c = neibs[k];
          if (used[c]) continue;
          heights[c] = lim(heights[c] - h * (Math.random() * 0.2 + 0.9));
          used[c] = 1;
          queue.push(c);
        }
      }
    }
  };

  // fromCell, toCell are options cell ids
  const addRange = (count, height, rangeX, rangeY, startCell, endCell) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOneRange();
      count--;
    }

    function addOneRange() {
      if (!addRange._used || addRange._used.length !== heights.length) addRange._used = new Uint8Array(heights.length);
      const used = addRange._used;
      used.fill(0);
      let h = lim(getNumberInRange(height));

      if (rangeX && rangeY) {
        // find start and end points
        const startX = getPointInRange(rangeX, graphWidth);
        const startY = getPointInRange(rangeY, graphHeight);

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

        startCell = findGridCell(startX, startY, grid);
        endCell = findGridCell(endX, endY, grid);
      }

      let range = getRange(startCell, endCell);

      // get main ridge
      function getRange(cur, end) {
        const range = [cur];
        const p = grid.points;
        used[cur] = 1;

        while (cur !== end) {
          let min = Infinity;
          grid.cells.c[cur].forEach(function (e) {
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
      let queue = range.slice();
      let i = 0;
      while (queue.length) {
        const frontier = queue.slice();
        queue.length = 0; i++;
        for (let fi = 0; fi < frontier.length; fi++) {
          const idx = frontier[fi];
          heights[idx] = lim(heights[idx] + h * (Math.random() * 0.3 + 0.85));
        }
        h = h ** linePower - 1;
        if (h < 2) break;
        for (let fi = 0; fi < frontier.length; fi++) {
          const f = frontier[fi];
          const neibs = grid.cells.c[f];
          for (let k = 0; k < neibs.length; k++) {
            const idx = neibs[k];
            if (!used[idx]) { queue.push(idx); used[idx] = 1; }
          }
        }
      }

      // generate prominences
      for (let d = 0; d < range.length; d++) {
        if (d % 6 !== 0) continue;
        let cur = range[d];
        for (let l = 0; l < i; l++) {
          const nbrs = grid.cells.c[cur];
          let minIdx = nbrs[0];
          let minVal = heights[minIdx];
          for (let k = 1; k < nbrs.length; k++) {
            const idk = nbrs[k];
            const hv = heights[idk];
            if (hv < minVal) { minVal = hv; minIdx = idk; }
          }
          heights[minIdx] = (heights[cur] * 2 + heights[minIdx]) / 3;
          cur = minIdx;
        }
      }
    }
  };

  const addTrough = (count, height, rangeX, rangeY, startCell, endCell) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOneTrough();
      count--;
    }

    function addOneTrough() {
      if (!addTrough._used || addTrough._used.length !== heights.length) addTrough._used = new Uint8Array(heights.length);
      const used = addTrough._used;
      used.fill(0);
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
          startX = getPointInRange(rangeX, graphWidth);
          startY = getPointInRange(rangeY, graphHeight);
          startCell = findGridCell(startX, startY, grid);
          limit++;
        } while (heights[startCell] < 20 && limit < 50);

        limit = 0;
        do {
          endX = Math.random() * graphWidth * 0.8 + graphWidth * 0.1;
          endY = Math.random() * graphHeight * 0.7 + graphHeight * 0.15;
          dist = Math.abs(endY - startY) + Math.abs(endX - startX);
          limit++;
        } while ((dist < graphWidth / 8 || dist > graphWidth / 2) && limit < 50);

        endCell = findGridCell(endX, endY, grid);
      }

      let range = getRange(startCell, endCell);

      // get main ridge
      function getRange(cur, end) {
        const range = [cur];
        const p = grid.points;
        used[cur] = 1;

        while (cur !== end) {
          let min = Infinity;
          grid.cells.c[cur].forEach(function (e) {
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
      let queue = range.slice();
      let i = 0;
      while (queue.length) {
        const frontier = queue.slice();
        queue.length = 0; i++;
        for (let fi = 0; fi < frontier.length; fi++) {
          const idx = frontier[fi];
          heights[idx] = lim(heights[idx] - h * (Math.random() * 0.3 + 0.85));
        }
        h = h ** linePower - 1;
        if (h < 2) break;
        for (let fi = 0; fi < frontier.length; fi++) {
          const f = frontier[fi];
          const neibs = grid.cells.c[f];
          for (let k = 0; k < neibs.length; k++) {
            const idx = neibs[k];
            if (!used[idx]) { queue.push(idx); used[idx] = 1; }
          }
        }
      }

      // generate prominences
      for (let d = 0; d < range.length; d++) {
        if (d % 6 !== 0) continue;
        let cur = range[d];
        for (let l = 0; l < i; l++) {
          const nbrs = grid.cells.c[cur];
          let minIdx = nbrs[0];
          let minVal = heights[minIdx];
          for (let k = 1; k < nbrs.length; k++) {
            const idk = nbrs[k];
            const hv = heights[idk];
            if (hv < minVal) { minVal = hv; minIdx = idk; }
          }
          heights[minIdx] = (heights[cur] * 2 + heights[minIdx]) / 3;
          cur = minIdx;
        }
      }
    }
  };

  const addStrait = (width, direction = "vertical") => {
    width = Math.min(getNumberInRange(width), grid.cellsX / 3);
    if (width < 1 && P(width)) return;
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

    const start = findGridCell(startX, startY, grid);
    const end = findGridCell(endX, endY, grid);
    let range = getRange(start, end);
    const query = [];

    function getRange(cur, end) {
      const range = [];
      const p = grid.points;

      while (cur !== end) {
        let min = Infinity;
        grid.cells.c[cur].forEach(function (e) {
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
        grid.cells.c[r].forEach(function (e) {
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
  };

  const modify = (range, add, mult, power) => {
    const min = range === "land" ? 20 : range === "all" ? 0 : +range.split("-")[0];
    const max = range === "land" || range === "all" ? 100 : +range.split("-")[1];
    const isLand = min === 20;

    for (let i = 0; i < heights.length; i++) {
      let h = heights[i];
      if (h < min || h > max) continue;
      if (add) h = isLand ? Math.max(h + add, 20) : h + add;
      if (mult !== 1) h = isLand ? (h - 20) * mult + 20 : h * mult;
      if (power) h = isLand ? (h - 20) ** power + 20 : h ** power;
      heights[i] = lim(h);
    }
  };

  const smooth = (fr = 2, add = 0) => {
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      const nbrs = grid.cells.c[i];
      let sum = h;
      for (let k = 0; k < nbrs.length; k++) sum += heights[nbrs[k]];
      const mean = sum / (nbrs.length + 1);
      heights[i] = fr === 1 ? mean + add : lim((h * (fr - 1) + mean + add) / fr);
    }
  };

  const mask = (power = 1) => {
    const fr = power ? Math.abs(power) : 1;
    for (let i = 0; i < heights.length; i++) {
      const h = heights[i];
      const [x, y] = grid.points[i];
      const nx = (2 * x) / graphWidth - 1; // [-1, 1]
      const ny = (2 * y) / graphHeight - 1; // [-1, 1]
      let distance = (1 - nx * nx) * (1 - ny * ny);
      if (power < 0) distance = 1 - distance;
      const masked = h * distance;
      heights[i] = lim((h * (fr - 1) + masked) / fr);
    }
  };

  const invert = (count, axes) => {
    if (!P(count)) return;

    const invertX = axes !== "y";
    const invertY = axes !== "x";
    const {cellsX, cellsY} = grid;

    const inverted = heights.map((h, i) => {
      const x = i % cellsX;
      const y = Math.floor(i / cellsX);

      const nx = invertX ? cellsX - x - 1 : x;
      const ny = invertY ? cellsY - y - 1 : y;
      const invertedI = nx + ny * cellsX;
      return heights[invertedI];
    });

    heights = inverted;
  };

  function getPointInRange(range, length) {
    if (typeof range !== "string") {
      ERROR && console.error("Range should be a string");
      return;
    }

    const min = range.split("-")[0] / 100 || 0;
    const max = range.split("-")[1] / 100 || min;
    return rand(min * length, max * length);
  }

  function getHeightsFromImageData(imageData) {
    for (let i = 0; i < heights.length; i++) {
      const lightness = imageData[i * 4] / 255;
      const powered = lightness < 0.2 ? lightness : 0.2 + (lightness - 0.2) ** 0.8;
      heights[i] = minmax(Math.floor(powered * 100), 0, 100);
    }
  }

  return {
    setGraph,
    getHeights,
    generate,
    fromTemplate,
    fromPrecreated,
    addHill,
    addRange,
    addTrough,
    addStrait,
    addPit,
    smooth,
    modify,
    mask,
    invert
  };
})();
