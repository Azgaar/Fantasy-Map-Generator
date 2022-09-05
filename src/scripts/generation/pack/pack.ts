import * as d3 from "d3";

import {UINT16_MAX} from "config/constants";
import {DISTANCE_FIELD, MIN_LAND_HEIGHT} from "config/generation";
import {TIME} from "config/logging";
import {calculateVoronoi} from "scripts/generation/graph";
import {markupPackFeatures} from "scripts/generation/markup";
import {rankCells} from "scripts/generation/pack/rankCells";
import {createTypedArray} from "utils/arrayUtils";
import {pick} from "utils/functionUtils";
import {rn} from "utils/numberUtils";
import {generateCultures, expandCultures} from "./cultures";
import {generateRivers} from "./rivers";
import {generateBurgsAndStates} from "./burgsAndStates/generateBurgsAndStates";
import {generateRoutes} from "./generateRoutes";
import {generateReligions} from "./religions/generateReligions";

const {LAND_COAST, WATER_COAST, DEEPER_WATER} = DISTANCE_FIELD;
const {Biomes} = window;

export function createPack(grid: IGrid): {pack: IPack; conflicts: IConflict[]} {
  const {temp, prec} = grid.cells;
  const {vertices, cells} = repackGrid(grid);

  const {features, featureIds, distanceField, haven, harbor} = markupPackFeatures(
    grid,
    vertices,
    pick(cells, "v", "c", "b", "p", "h")
  );

  const {
    heights,
    flux,
    riverIds,
    conf,
    rivers: rawRivers,
    mergedFeatures
  } = generateRivers(
    {...pick(cells, "i", "c", "b", "g", "h", "p"), f: featureIds, t: distanceField, haven},
    features,
    prec,
    temp
  );

  const biome: Uint8Array = Biomes.define({
    temp,
    prec,
    flux,
    riverIds,
    heights,
    neighbors: cells.c,
    gridReference: cells.g
  });

  const {suitability, population} = rankCells(mergedFeatures, {
    t: distanceField,
    f: featureIds,
    fl: flux,
    conf,
    r: riverIds,
    h: heights,
    area: cells.area,
    biome,
    haven,
    harbor
  });

  const cultures = generateCultures(
    mergedFeatures,
    {
      p: cells.p,
      i: cells.i,
      g: cells.g,
      t: distanceField,
      h: heights,
      haven,
      harbor,
      f: featureIds,
      r: riverIds,
      fl: flux,
      s: suitability,
      pop: population,
      biome
    },
    temp
  );

  const cultureIds = expandCultures(cultures, mergedFeatures, {
    c: cells.c,
    area: cells.area,
    h: heights,
    t: distanceField,
    f: featureIds,
    r: riverIds,
    fl: flux,
    biome,
    pop: population
  });

  const {burgIds, stateIds, burgs, states, conflicts} = generateBurgsAndStates(
    cultures,
    mergedFeatures,
    temp,
    rawRivers,
    vertices,
    {
      ...pick(cells, "v", "c", "p", "b", "i", "g", "area"),
      h: heights,
      f: featureIds,
      t: distanceField,
      haven,
      harbor,
      r: riverIds,
      fl: flux,
      biome,
      s: suitability,
      pop: population,
      culture: cultureIds
    }
  );

  const {cellRoutes, routes} = generateRoutes(burgs, temp, {
    c: cells.c,
    p: cells.p,
    g: cells.g,
    h: heights,
    t: distanceField,
    biome,
    burg: burgIds
  });

  const {religionIds, religions} = generateReligions({
    states,
    cultures,
    burgs,
    cells: {
      i: cells.i,
      c: cells.c,
      p: cells.p,
      g: cells.g,
      h: heights,
      t: distanceField,
      biome,
      pop: population,
      culture: cultureIds,
      burg: burgIds,
      state: stateIds,
      route: cellRoutes
    }
  });

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
      h: heights,
      f: featureIds,
      t: distanceField,
      haven,
      harbor,
      fl: flux,
      r: riverIds,
      conf,
      biome,
      s: suitability,
      pop: population,
      culture: cultureIds,
      burg: burgIds,
      state: stateIds,
      route: cellRoutes,
      religion: religionIds,
      province: new Uint16Array(cells.i.length)
    },
    features: mergedFeatures,
    rivers: rawRivers, // "name" | "basin" | "type"
    cultures,
    states,
    burgs,
    routes,
    religions
  };

  return {pack, conflicts};
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

    // exclude ocean points far from coast
    if (height < MIN_LAND_HEIGHT && type !== WATER_COAST && type !== DEEPER_WATER) continue;

    const feature = features[gridCells.f[i]];
    const isLake = feature && feature.type === "lake";

    // exclude non-coastal lake points
    if (type === DEEPER_WATER && (i % 4 === 0 || isLake)) continue;

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
