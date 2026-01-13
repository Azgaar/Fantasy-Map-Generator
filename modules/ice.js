"use strict";

// Ice layer data model - separates ice data from SVG rendering
window.Ice = (function () {
  // Initialize ice data structure
  function initialize() {
    pack.ice = {
      glaciers: [], // auto-generated glaciers on cold land
      icebergs: [] // manually edited and auto-generated icebergs on cold water
    };
  }

  // Generate glaciers and icebergs based on temperature and height
  function generate() {
    clear();
    const {cells, features} = grid;
    const {temp, h} = cells;
    Math.random = aleaPRNG(seed);

    const ICEBERG_MAX_TEMP = 0;
    const GLACIER_MAX_TEMP = -8;
    const minMaxTemp = d3.min(temp);

    // Generate glaciers on cold land
    {
      const type = "iceShield";
      const getType = cellId =>
        h[cellId] >= 20 && temp[cellId] <= GLACIER_MAX_TEMP ? type : null;
      const isolines = getIsolines(grid, getType, {polygons: true});

      if (isolines[type]?.polygons) {
        isolines[type].polygons.forEach(points => {
          const clipped = clipPoly(points);
          pack.ice.glaciers.push({
            points: clipped
          });
        });
      }
    }

    // Generate icebergs on cold water
    for (const cellId of grid.cells.i) {
      const t = temp[cellId];
      if (h[cellId] >= 20) continue; // no icebergs on land
      if (t > ICEBERG_MAX_TEMP) continue; // too warm: no icebergs
      if (features[cells.f[cellId]].type === "lake") continue; // no icebergs on lakes
      if (P(0.8)) continue; // skip most of eligible cells

      const randomFactor = 0.8 + rand() * 0.4; // random size factor
      let baseSize = (1 - normalize(t, minMaxTemp, 1)) * 0.8; // size: 0 = zero, 1 = full
      if (cells.t[cellId] === -1) baseSize /= 1.3; // coastline: smaller icebergs
      const size = minmax(rn(baseSize * randomFactor, 2), 0.1, 1);

      const [cx, cy] = grid.points[cellId];
      const points = getGridPolygon(cellId).map(([x, y]) => [
        rn(lerp(cx, x, size), 2),
        rn(lerp(cy, y, size), 2)
      ]);

      pack.ice.icebergs.push({
        cellId,
        size,
        points
      });
    }
  }

  function addIceberg(cellId, size) {
    const [cx, cy] = grid.points[cellId];
    const points = getGridPolygon(cellId).map(([x, y]) => [
      rn(lerp(cx, x, size), 2),
      rn(lerp(cy, y, size), 2)
    ]);
    //here we use the lose equality to find the first undefined or empty or null slot
    const nextIndex = pack.ice.icebergs.findIndex(iceberg => iceberg == undefined);
    if (nextIndex !== -1) {
      pack.ice.icebergs[nextIndex] = {
        cellId,
        size,
        points
      };
      redrawIceberg(nextIndex);
    } else {
      pack.ice.icebergs.push({
        cellId,
        size,
        points
      });
      redrawIceberg(pack.ice.icebergs.length - 1);
    }
  }

  function removeIce(type, index) {
    if (type === "glacier" && pack.ice.glaciers[index]) {
      delete pack.ice.glaciers[index];
      redrawGlacier(index);
    } else if (type === "iceberg" && pack.ice.icebergs[index]) {
      delete pack.ice.icebergs[index];
      redrawIceberg(index);
    }
  }

  function updateIceberg(index, points, size) {
    if (pack.ice.icebergs[index]) {
      pack.ice.icebergs[index].points = points;
      pack.ice.icebergs[index].size = size;
    }
  }

  function randomizeIcebergShape(index) {
    const iceberg = pack.ice.icebergs[index];
    if (!iceberg) return;

    const cellId = iceberg.cellId;
    const size = iceberg.size;
    const [cx, cy] = grid.points[cellId];

    // Get a different random cell for the polygon template
    const i = ra(grid.cells.i);
    const cn = grid.points[i];
    const poly = getGridPolygon(i).map(p => [p[0] - cn[0], p[1] - cn[1]]);
    const points = poly.map(p => [
      rn(cx + p[0] * size, 2),
      rn(cy + p[1] * size, 2)
    ]);

    iceberg.points = points;
  }

  function changeIcebergSize(index, newSize) {
    const iceberg = pack.ice.icebergs[index];
    if (!iceberg) return;

    const cellId = iceberg.cellId;
    const [cx, cy] = grid.points[cellId];
    const oldSize = iceberg.size;

    const flat = iceberg.points.flat();
    const pairs = [];
    while (flat.length) pairs.push(flat.splice(0, 2));
    const poly = pairs.map(p => [(p[0] - cx) / oldSize, (p[1] - cy) / oldSize]);
    const points = poly.map(p => [
      rn(cx + p[0] * newSize, 2),
      rn(cy + p[1] * newSize, 2)
    ]);

    iceberg.points = points;
    iceberg.size = newSize;
  }

  function getData() {
    return pack.ice;
  }

  // Clear all ice
  function clear() {
    pack.ice.glaciers = [];
    pack.ice.icebergs = [];
  }

  return {
    initialize,
    generate,
    addIceberg,
    removeIce,
    updateIceberg,
    randomizeIcebergShape,
    changeIcebergSize,
    getData,
    clear
  };
})();
