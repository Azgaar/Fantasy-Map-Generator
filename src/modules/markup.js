import {TIME} from "config/logging";
import {aleaPRNG} from "scripts/aleaPRNG";

// Mark features (ocean, lakes, islands) and calculate distance field
export function markFeatures() {
  TIME && console.time("markFeatures");
  Math.random = aleaPRNG(seed); // get the same result on heightmap edit in Erase mode

  const cells = grid.cells;
  const heights = grid.cells.h;

  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land coast; -1 = water near coast

  grid.features = [0];

  for (let i = 1, queue = [0]; queue[0] !== -1; i++) {
    cells.f[queue[0]] = i; // feature number
    const land = heights[queue[0]] >= 20;
    let border = false; // true if feature touches map border

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;

      cells.c[q].forEach(c => {
        const cLand = heights[c] >= 20;
        if (land === cLand && !cells.f[c]) {
          cells.f[c] = i;
          queue.push(c);
        } else if (land && !cLand) {
          cells.t[q] = 1;
          cells.t[c] = -1;
        }
      });
    }
    const type = land ? "island" : border ? "ocean" : "lake";
    grid.features.push({i, land, border, type});

    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  TIME && console.timeEnd("markFeatures");
}

export function markupGridOcean() {
  TIME && console.time("markupGridOcean");
  markup(grid.cells, -2, -1, -10);
  TIME && console.timeEnd("markupGridOcean");
}

// Calculate cell-distance to coast for every cell
export function markup(cells, start, increment, limit) {
  for (let t = start, count = Infinity; count > 0 && t > limit; t += increment) {
    count = 0;
    const prevT = t - increment;
    for (let i = 0; i < cells.i.length; i++) {
      if (cells.t[i] !== prevT) continue;

      for (const c of cells.c[i]) {
        if (cells.t[c]) continue;
        cells.t[c] = t;
        count++;
      }
    }
  }
}

// Re-mark features (ocean, lakes, islands)
export function reMarkFeatures() {
  TIME && console.time("reMarkFeatures");
  const {cells} = pack;
  const features = [0];

  cells.f = new Uint16Array(cells.i.length); // cell feature number
  cells.t = new Int8Array(cells.i.length); // cell type: 1 = land along coast; -1 = water along coast;
  cells.haven = cells.i.length < 65535 ? new Uint16Array(cells.i.length) : new Uint32Array(cells.i.length); // cell haven (opposite water cell);
  cells.harbor = new Uint8Array(cells.i.length); // cell harbor (number of adjacent water cells);

  const defineHaven = i => {
    const water = cells.c[i].filter(c => cells.h[c] < 20);
    const dist2 = water.map(c => (cells.p[i][0] - cells.p[c][0]) ** 2 + (cells.p[i][1] - cells.p[c][1]) ** 2);
    const closest = water[dist2.indexOf(Math.min.apply(Math, dist2))];

    cells.haven[i] = closest;
    cells.harbor[i] = water.length;
  };

  if (!cells.i.length) return; // no cells -> there is nothing to do
  for (let i = 1, queue = [0]; queue[0] !== -1; i++) {
    const start = queue[0]; // first cell
    cells.f[start] = i; // assign feature number
    const land = cells.h[start] >= 20;
    let border = false; // true if feature touches map border
    let cellNumber = 1; // to count cells number in a feature

    while (queue.length) {
      const q = queue.pop();
      if (cells.b[q]) border = true;
      cells.c[q].forEach(function (e) {
        const eLand = cells.h[e] >= 20;
        if (land && !eLand) {
          cells.t[q] = 1;
          cells.t[e] = -1;
          if (!cells.haven[q]) defineHaven(q);
        } else if (land && eLand) {
          if (!cells.t[e] && cells.t[q] === 1) cells.t[e] = 2;
          else if (!cells.t[q] && cells.t[e] === 1) cells.t[q] = 2;
        }
        if (!cells.f[e] && land === eLand) {
          queue.push(e);
          cells.f[e] = i;
          cellNumber++;
        }
      });
    }

    const type = land ? "island" : border ? "ocean" : "lake";
    let group;
    if (type === "ocean") group = defineOceanGroup(cellNumber);
    else if (type === "island") group = defineIslandGroup(start, cellNumber);
    features.push({i, land, border, type, cells: cellNumber, firstCell: start, group});
    queue[0] = cells.f.findIndex(f => !f); // find unmarked cell
  }

  // markupPackLand
  markup(pack.cells, 3, 1, 0);

  function defineOceanGroup(number) {
    if (number > grid.cells.i.length / 25) return "ocean";
    if (number > grid.cells.i.length / 100) return "sea";
    return "gulf";
  }

  function defineIslandGroup(cell, number) {
    if (cell && features[cells.f[cell - 1]].type === "lake") return "lake_island";
    if (number > grid.cells.i.length / 10) return "continent";
    if (number > grid.cells.i.length / 1000) return "island";
    return "isle";
  }

  pack.features = features;

  TIME && console.timeEnd("reMarkFeatures");
}
