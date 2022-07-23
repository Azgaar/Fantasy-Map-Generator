import * as d3 from "d3";

import {markupPackFeatures} from "modules/markup";
// @ts-expect-error js module
import {drawScaleBar} from "modules/measurers";
// @ts-expect-error js module
import {addZones} from "modules/zones";
import {DISTANCE_FIELD, MIN_LAND_HEIGHT} from "config/generation";
import {TIME} from "config/logging";
import {UINT16_MAX} from "config/constants";
import {calculateVoronoi} from "scripts/generation/graph";
import {createTypedArray} from "utils/arrayUtils";
import {pick} from "utils/functionUtils";
import {rn} from "utils/numberUtils";
import {generateRivers} from "./rivers";

const {LAND_COAST, WATER_COAST, DEEPER_WATER} = DISTANCE_FIELD;
// const {Lakes, OceanLayers, Biomes, Cultures, BurgsAndStates, Religions, Military, Markers, Names} = window;

export function createPack(grid: IGrid): IPack {
  const {vertices, cells} = repackGrid(grid);

  const {features, featureIds, distanceField, haven, harbor} = markupPackFeatures(
    grid,
    vertices,
    pick(cells, "v", "c", "b", "p", "h")
  );

  const {heights, flux, r, conf, rivers, mergedFeatures} = generateRivers(
    grid.cells.prec,
    grid.cells.temp,
    {...pick(cells, "i", "c", "b", "g", "h", "p"), f: featureIds, t: distanceField, haven},
    features
  );

  // Biomes.define(newPack, grid);

  // const rankCellsData = pick(newPack.cells, "i", "f", "fl", "conf", "r", "h", "area", "biome", "haven", "harbor");
  // rankCells(newPack.features!, rankCellsData);

  // Cultures.generate();
  // Cultures.expand();
  // BurgsAndStates.generate();
  // Religions.generate();
  // BurgsAndStates.defineStateForms();
  // BurgsAndStates.generateProvinces();
  // BurgsAndStates.defineBurgFeatures();

  // renderLayer("states");
  // renderLayer("borders");
  // BurgsAndStates.drawStateLabels();

  // Rivers.specify();
  // const updatedFeatures = generateLakeNames();

  // Military.generate();
  // Markers.generate();
  // addZones();

  // OceanLayers(newGrid);

  // drawScaleBar(window.scale);
  // Names.getMapName();

  const pack: IPack = {
    vertices,
    cells: {
      ...cells,
      h: new Uint8Array(heights),
      f: featureIds,
      t: distanceField,
      haven,
      harbor,
      fl: flux,
      r,
      conf
    },
    features: mergedFeatures,
    rivers
  };

  return pack;
}

// repack grid cells: discart deep water cells, add land cells along the coast
function repackGrid(grid: IGrid) {
  TIME && console.time("repackGrid");
  const {cells: gridCells, points, features} = grid;
  const newCells: {p: TPoints; g: number[]; h: number[]} = {p: [], g: [], h: []}; // store new data
  const spacing2 = grid.spacing ** 2;

  for (const i of gridCells.i) {
    const height = gridCells.h[i];
    const type = gridCells.t[i];
    if (height < MIN_LAND_HEIGHT && type !== WATER_COAST && type !== DEEPER_WATER) continue; // exclude all deep ocean points

    const feature = features[gridCells.f[i]];
    const isLake = feature && feature.type === "lake";

    if (type === DEEPER_WATER && (i % 4 === 0 || isLake)) continue; // exclude non-coastal lake points
    const [x, y] = points[i];

    addNewPoint(i, x, y, height);

    // add additional points for cells along coast
    if (type === LAND_COAST || type === WATER_COAST) {
      if (gridCells.b[i]) continue; // not for near-border cells
      gridCells.c[i].forEach(e => {
        if (i > e) return;
        if (gridCells.t[e] === type) {
          const dist2 = (y - points[e][1]) ** 2 + (x - points[e][0]) ** 2;
          if (dist2 < spacing2) return; // too close to each other
          const x1 = rn((x + points[e][0]) / 2, 1);
          const y1 = rn((y + points[e][1]) / 2, 1);
          addNewPoint(i, x1, y1, height);
        }
      });
    }
  }

  function addNewPoint(i: number, x: number, y: number, height: number) {
    newCells.p.push([x, y]);
    newCells.g.push(i);
    newCells.h.push(height);
  }

  const {cells, vertices} = calculateVoronoi(newCells.p, grid.boundary);

  function getCellArea(i: number) {
    const polygon = cells.v[i].map(v => vertices.p[v]);
    const area = Math.abs(d3.polygonArea(polygon));
    return Math.min(area, UINT16_MAX);
  }

  const pack = {
    vertices,
    cells: {
      ...cells,
      p: newCells.p,
      g: createTypedArray({maxValue: grid.points.length, from: newCells.g}),
      q: d3.quadtree(newCells.p.map(([x, y], i) => [x, y, i])) as unknown as Quadtree,
      h: new Uint8Array(newCells.h),
      area: createTypedArray({maxValue: UINT16_MAX, from: cells.i}).map(getCellArea)
    }
  };

  TIME && console.timeEnd("repackGrid");
  return pack;
}
