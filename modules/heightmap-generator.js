"use strict";

window.HeightmapGenerator = (function () {
  let cells, p;

  const generate = async function () {
    cells = grid.cells;
    p = grid.points;
    cells.h = new Uint8Array(grid.points.length);

    const input = document.getElementById("templateInput");
    const selectedId = input.selectedIndex >= 0 ? input.selectedIndex : 0;
    const type = input.options[selectedId]?.parentElement?.label;

    if (type === "Specific") {
      // pre-defined heightmap
      TIME && console.time("defineHeightmap");
      return new Promise(resolve => {
        // create canvas where 1px correcponds to a cell
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const {cellsX, cellsY} = grid;
        canvas.width = cellsX;
        canvas.height = cellsY;

        // load heightmap into image and render to canvas
        const img = new Image();
        img.src = `./heightmaps/${input.value}.png`;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, cellsX, cellsY);
          const imageData = ctx.getImageData(0, 0, cellsX, cellsY);
          assignColorsToHeight(imageData.data);
          canvas.remove();
          img.remove();
          TIME && console.timeEnd("defineHeightmap");
          resolve();
        };
      });
    }

    // heightmap template
    TIME && console.time("generateHeightmap");
    const template = input.value;
    const templateString = HeightmapTemplates[template];
    const steps = templateString.split("\n");

    if (!steps.length) throw new Error(`Heightmap template: no steps. Template: ${template}. Steps: ${steps}`);

    for (const step of steps) {
      const elements = step.trim().split(" ");
      if (elements.length < 2) throw new Error(`Heightmap template: steps < 2. Template: ${template}. Step: ${elements}`);
      addStep(...elements);
    }

    TIME && console.timeEnd("generateHeightmap");
  };

  function addStep(a1, a2, a3, a4, a5) {
    if (a1 === "Hill") return addHill(a2, a3, a4, a5);
    if (a1 === "Pit") return addPit(a2, a3, a4, a5);
    if (a1 === "Range") return addRange(a2, a3, a4, a5);
    if (a1 === "Trough") return addTrough(a2, a3, a4, a5);
    if (a1 === "Strait") return addStrait(a2, a3);
    if (a1 === "Mask") return mask(a2);
    if (a1 === "Add") return modify(a3, +a2, 1);
    if (a1 === "Multiply") return modify(a3, 0, +a2);
    if (a1 === "Smooth") return smooth(a2);
  }

  function getBlobPower() {
    const cells = +pointsInput.dataset.cells;
    if (cells === 1000) return 0.93;
    if (cells === 2000) return 0.95;
    if (cells === 5000) return 0.96;
    if (cells === 10000) return 0.98;
    if (cells === 20000) return 0.985;
    if (cells === 30000) return 0.987;
    if (cells === 40000) return 0.9892;
    if (cells === 50000) return 0.9911;
    if (cells === 60000) return 0.9921;
    if (cells === 70000) return 0.9934;
    if (cells === 80000) return 0.9942;
    if (cells === 90000) return 0.9946;
    if (cells === 100000) return 0.995;
  }

  function getLinePower() {
    const cells = +pointsInput.dataset.cells;
    if (cells === 1000) return 0.74;
    if (cells === 2000) return 0.75;
    if (cells === 5000) return 0.78;
    if (cells === 10000) return 0.81;
    if (cells === 20000) return 0.82;
    if (cells === 30000) return 0.83;
    if (cells === 40000) return 0.84;
    if (cells === 50000) return 0.855;
    if (cells === 60000) return 0.87;
    if (cells === 70000) return 0.885;
    if (cells === 80000) return 0.91;
    if (cells === 90000) return 0.92;
    if (cells === 100000) return 0.93;
  }

  const addHill = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    const power = getBlobPower();
    while (count > 0) {
      addOneHill();
      count--;
    }

    function addOneHill() {
      const change = new Uint8Array(cells.h.length);
      let limit = 0;
      let start;
      let h = lim(getNumberInRange(height));

      do {
        const x = getPointInRange(rangeX, graphWidth);
        const y = getPointInRange(rangeY, graphHeight);
        start = findGridCell(x, y);
        limit++;
      } while (cells.h[start] + h > 90 && limit < 50);

      change[start] = h;
      const queue = [start];
      while (queue.length) {
        const q = queue.shift();

        for (const c of cells.c[q]) {
          if (change[c]) continue;
          change[c] = change[q] ** power * (Math.random() * 0.2 + 0.9);
          if (change[c] > 1) queue.push(c);
        }
      }

      cells.h = cells.h.map((h, i) => lim(h + change[i]));
    }
  };

  const addPit = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    while (count > 0) {
      addOnePit();
      count--;
    }

    function addOnePit() {
      const used = new Uint8Array(cells.h.length);
      let limit = 0,
        start;
      let h = lim(getNumberInRange(height));

      do {
        const x = getPointInRange(rangeX, graphWidth);
        const y = getPointInRange(rangeY, graphHeight);
        start = findGridCell(x, y);
        limit++;
      } while (cells.h[start] < 20 && limit < 50);

      const queue = [start];
      while (queue.length) {
        const q = queue.shift();
        h = h ** getBlobPower() * (Math.random() * 0.2 + 0.9);
        if (h < 1) return;

        cells.c[q].forEach(function (c, i) {
          if (used[c]) return;
          cells.h[c] = lim(cells.h[c] - h * (Math.random() * 0.2 + 0.9));
          used[c] = 1;
          queue.push(c);
        });
      }
    }
  };

  const addRange = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    const power = getLinePower();
    while (count > 0) {
      addOneRange();
      count--;
    }

    function addOneRange() {
      const used = new Uint8Array(cells.h.length);
      let h = lim(getNumberInRange(height));

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

      let range = getRange(findGridCell(startX, startY), findGridCell(endX, endY));

      // get main ridge
      function getRange(cur, end) {
        const range = [cur];
        used[cur] = 1;

        while (cur !== end) {
          let min = Infinity;
          cells.c[cur].forEach(function (e) {
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
          cells.h[i] = lim(cells.h[i] + h * (Math.random() * 0.3 + 0.85));
        });
        h = h ** power - 1;
        if (h < 2) break;
        frontier.forEach(f => {
          cells.c[f].forEach(i => {
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
          const min = cells.c[cur][d3.scan(cells.c[cur], (a, b) => cells.h[a] - cells.h[b])]; // downhill cell
          cells.h[min] = (cells.h[cur] * 2 + cells.h[min]) / 3;
          cur = min;
        }
      });
    }
  };

  const addTrough = (count, height, rangeX, rangeY) => {
    count = getNumberInRange(count);
    const power = getLinePower();
    while (count > 0) {
      addOneTrough();
      count--;
    }

    function addOneTrough() {
      const used = new Uint8Array(cells.h.length);
      let h = lim(getNumberInRange(height));

      // find start and end points
      let limit = 0,
        startX,
        startY,
        start,
        dist = 0,
        endX,
        endY;
      do {
        startX = getPointInRange(rangeX, graphWidth);
        startY = getPointInRange(rangeY, graphHeight);
        start = findGridCell(startX, startY);
        limit++;
      } while (cells.h[start] < 20 && limit < 50);

      limit = 0;
      do {
        endX = Math.random() * graphWidth * 0.8 + graphWidth * 0.1;
        endY = Math.random() * graphHeight * 0.7 + graphHeight * 0.15;
        dist = Math.abs(endY - startY) + Math.abs(endX - startX);
        limit++;
      } while ((dist < graphWidth / 8 || dist > graphWidth / 2) && limit < 50);

      let range = getRange(start, findGridCell(endX, endY));

      // get main ridge
      function getRange(cur, end) {
        const range = [cur];
        used[cur] = 1;

        while (cur !== end) {
          let min = Infinity;
          cells.c[cur].forEach(function (e) {
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
          cells.h[i] = lim(cells.h[i] - h * (Math.random() * 0.3 + 0.85));
        });
        h = h ** power - 1;
        if (h < 2) break;
        frontier.forEach(f => {
          cells.c[f].forEach(i => {
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
          const min = cells.c[cur][d3.scan(cells.c[cur], (a, b) => cells.h[a] - cells.h[b])]; // downhill cell
          //debug.append("circle").attr("cx", p[min][0]).attr("cy", p[min][1]).attr("r", 1);
          cells.h[min] = (cells.h[cur] * 2 + cells.h[min]) / 3;
          cur = min;
        }
      });
    }
  };

  const addStrait = (width, direction = "vertical") => {
    width = Math.min(getNumberInRange(width), grid.cellsX / 3);
    if (width < 1 && P(width)) return;
    const used = new Uint8Array(cells.h.length);
    const vert = direction === "vertical";
    const startX = vert ? Math.floor(Math.random() * graphWidth * 0.4 + graphWidth * 0.3) : 5;
    const startY = vert ? 5 : Math.floor(Math.random() * graphHeight * 0.4 + graphHeight * 0.3);
    const endX = vert ? Math.floor(graphWidth - startX - graphWidth * 0.1 + Math.random() * graphWidth * 0.2) : graphWidth - 5;
    const endY = vert ? graphHeight - 5 : Math.floor(graphHeight - startY - graphHeight * 0.1 + Math.random() * graphHeight * 0.2);

    const start = findGridCell(startX, startY),
      end = findGridCell(endX, endY);
    let range = getRange(start, end);
    const query = [];

    function getRange(cur, end) {
      const range = [];

      while (cur !== end) {
        let min = Infinity;
        cells.c[cur].forEach(function (e) {
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
        cells.c[r].forEach(function (e) {
          if (used[e]) return;
          used[e] = 1;
          query.push(e);
          cells.h[e] **= exp;
          if (cells.h[e] > 100) cells.h[e] = 5;
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

    grid.cells.h = grid.cells.h.map(h => {
      if (h < min || h > max) return h;

      if (add) h = isLand ? Math.max(h + add, 20) : h + add;
      if (mult !== 1) h = isLand ? (h - 20) * mult + 20 : h * mult;
      if (power) h = isLand ? (h - 20) ** power + 20 : h ** power;
      return lim(h);
    });
  };

  const smooth = (fr = 2, add = 0) => {
    cells.h = cells.h.map((h, i) => {
      const a = [h];
      cells.c[i].forEach(c => a.push(cells.h[c]));
      if (fr === 1) return d3.mean(a) + add;
      return lim((h * (fr - 1) + d3.mean(a) + add) / fr);
    });
  };

  const mask = (power = 1) => {
    const fr = power ? Math.abs(power) : 1;

    cells.h = cells.h.map((h, i) => {
      const [x, y] = p[i];
      const nx = (2 * x) / graphWidth - 1; // [-1, 1], 0 is center
      const ny = (2 * y) / graphHeight - 1; // [-1, 1], 0 is center
      let distance = (1 - nx ** 2) * (1 - ny ** 2); // 1 is center, 0 is edge
      if (power < 0) distance = 1 - distance; // inverted, 0 is center, 1 is edge
      const masked = h * distance;
      return lim((h * (fr - 1) + masked) / fr);
    });
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

  function assignColorsToHeight(imageData) {
    for (let i = 0; i < cells.i.length; i++) {
      const lightness = imageData[i * 4] / 255;
      const powered = lightness < 0.2 ? lightness : 0.2 + (lightness - 0.2) ** 0.8;
      cells.h[i] = minmax(Math.floor(powered * 100), 0, 100);
    }
  }

  return {generate, addHill, addRange, addTrough, addStrait, addPit, smooth, modify, mask};
})();
